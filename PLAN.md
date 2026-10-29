# Cal AI Clone — Spec & Implementation Plan

## Context

Greenfield build of a photo-based calorie tracking app (a Cal AI clone) in an empty
directory. The user photographs a meal; a vision model returns calories and macros;
the meal is logged against personalized daily targets produced during onboarding.

This is a **tutorial/course build**. That governs every trade-off below: linear flows,
minimal magic, no infrastructure theater. Correctness where a silent bug would be
invisible on camera (timezones, AI response validation), simplicity everywhere else.

Stack is user-specified and non-negotiable: Expo/React Native, Clerk, Neon Postgres,
Trigger.dev, Sentry, ImageKit, OpenAI.

---

## 1. Spec Summary

### Product

Photo → macros. One repo, one TypeScript codebase. A user onboards, gets an
AI-generated daily calorie/macro plan, then logs meals by camera and tracks progress
against that plan.

### Users

Single role: the individual tracking their own food. No admin, no teams, no sharing.

### In scope for v1

- Anonymous onboarding questionnaire → AI-generated plan → sign-up → app
- Clerk auth: native Google + Apple sign-in
- Camera capture → ImageKit → OpenAI vision → calories + protein/carbs/fat
- Home: calorie ring, macro bars, horizontal date strip, today's meals, streak
- Meal detail: manual macro editing, delete
- Profile: edit body stats/goal; changes auto-regenerate targets in the background

### Explicitly OUT of v1

Payments/paywall · push notifications · barcode scanning · manual food search or text
entry · food database · weight history charts · water tracking · exercise/calorie burn ·
social features · web app · offline mode · i18n.

### Core flow

```
Welcome → gender → DOB → height/weight → goal → target weight → activity
   → pace → diet preference → "Building your plan…" (AI runs)
   → plan reveal → sign up (Google/Apple) → persist profile+plan → Home
```

Aha moment: the plan reveal, then the first meal photo resolving into real numbers.

### Architecture

| Layer      | Choice                                                                    |
| ---------- | ------------------------------------------------------------------------- |
| App        | Expo + React Native, Expo Router, NativeWind, TanStack Query              |
| API        | Expo Router API routes (`app/api/*+api.ts`), `server` output, EAS Hosting |
| DB         | Neon Postgres via Drizzle ORM + `@neondatabase/serverless`                |
| Background | Trigger.dev tasks in `/trigger`, deployed to Trigger.dev cloud            |
| Auth       | `@clerk/expo` v3.1.x — native Google/Apple, requires EAS dev build        |
| Images     | ImageKit, uploaded phone-direct via a signed auth endpoint                |
| AI         | OpenAI Responses API, vision + structured outputs                         |
| Errors     | Sentry in app, API routes, and Trigger.dev tasks                          |

**Why one repo:** app and server share types and the Drizzle schema with zero plumbing.
Trigger.dev tasks import the same `db/schema.ts`.

### Data model

`users` — one row per Clerk user, keyed by `clerk_user_id` (text, unique).

```
id                  uuid pk
clerk_user_id       text unique not null      -- Clerk is source of truth for identity
email               text
timezone            text                      -- IANA, e.g. "America/New_York"
unit_preference     text                      -- metric | imperial (display only)
gender              text
date_of_birth       date
height_cm           numeric                   -- always stored metric, converted at UI
weight_kg           numeric
goal                text                      -- lose | maintain | gain
target_weight_kg    numeric
activity_level      text                      -- sedentary | light | moderate | very
pace_kg_per_week    numeric
diet_preference     text                      -- classic | keto | vegan | vegetarian
daily_calories      integer                   -- AI-generated targets
protein_g           integer
carbs_g             integer
fat_g               integer
plan_rationale      text                      -- one-line AI explanation
plan_generated_at   timestamptz
onboarding_completed_at timestamptz
created_at / updated_at
```

`meals`

```
id             uuid pk
user_id        uuid fk → users.id
image_url      text not null                  -- ImageKit URL
status         text not null                  -- analyzing | completed | failed
name           text
calories       integer
protein_g      integer
carbs_g        integer
fat_g          integer
error_reason   text                           -- "not_food" | "parse_failed" | …
trigger_run_id text                           -- for Realtime subscribe / debugging
logged_at      timestamptz not null           -- UTC instant
created_at / updated_at

index (user_id, logged_at desc)
```

**Storage is metric + UTC. Conversion happens at the display edge only.**

**Day boundary:** meals store a UTC instant; "today" is computed in the user's stored
IANA timezone. A day's meals = instants falling inside that local day.

**Streak:** derived on read — count consecutive local dates having ≥1 meal. No stored
column, nothing to drift or backfill.

### API routes

| Route                      | Auth     | Purpose                                                                                                 |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `POST /api/plan`           | **none** | Onboarding answers → trigger `generate-plan`. Returns `runId` + public token. Writes nothing to the DB. |
| `POST /api/profile`        | Clerk    | Upsert user + persist onboarding answers and the generated plan                                         |
| `GET /api/profile`         | Clerk    | Profile + targets                                                                                       |
| `PATCH /api/profile`       | Clerk    | Edit stats → triggers `generate-plan` to refresh targets                                                |
| `GET /api/meals?date=`     | Clerk    | Meals for a local day                                                                                   |
| `POST /api/meals`          | Clerk    | Create `analyzing` meal, trigger `analyze-meal`, return meal + `runId` + token                          |
| `GET /api/meals/:id`       | Clerk    | Single meal — the polling target                                                                        |
| `PATCH /api/meals/:id`     | Clerk    | Manual macro correction                                                                                 |
| `DELETE /api/meals/:id`    | Clerk    | Delete                                                                                                  |
| `GET /api/imagekit-auth`   | Clerk    | Short-lived ImageKit upload signature                                                                   |
| `POST /api/webhooks/clerk` | svix sig | Verify, then trigger `sync-clerk-user`                                                                  |

### Trigger.dev tasks (`/trigger`)

- **`generate-plan`** — profile → OpenAI → validated targets → returns them (onboarding)
  or writes them to `users` (profile edit). Guardrails reject implausible output.
- **`analyze-meal`** — image URL → OpenAI vision → structured macros → update `meals`.
  Retries once on transient/parse failure, then marks `failed`.
- **`sync-clerk-user`** — upsert `users` from a Clerk webhook payload.

### Race condition, handled

The Clerk webhook is asynchronous, so `POST /api/profile` can land before
`sync-clerk-user` creates the row. **Both paths upsert on `clerk_user_id`**, so either
order produces the same result. This is the one piece of the design that must not be
simplified away.

---

## 2. Assumptions

Where a firm answer wasn't given, these are the defaults. Each is cheap to reverse.

| #   | Assumption                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **OpenAI model: `gpt-5.6-luna`** ($1/$6 per MTok, vision-capable) via the Responses API with structured outputs. Escalate to `gpt-5.6-terra` only if food-recognition accuracy disappoints. Pinned in one constant. |
| A2  | Meal data is **name + calories + protein/carbs/fat only** — no ingredient breakdown, health score, or confidence score.                                                                                             |
| A3  | Since there's no confidence field, the "couldn't identify this" path is driven by a required **`is_food` boolean** in the structured output plus schema validation failure.                                         |
| A4  | **Meal type (breakfast/lunch/dinner/snack) is inferred from time of day**, not asked. It's a display label only.                                                                                                    |
| A5  | Onboarding answers persist in **AsyncStorage** between the questionnaire and sign-up, so a user who backgrounds the app mid-flow doesn't restart.                                                                   |
| A6  | The **generated plan is held client-side** between AI generation and sign-up, then POSTed with the profile. `/api/plan` never touches the DB.                                                                       |
| A7  | **Sentry**: crash + error reporting only. No performance tracing, session replay, or custom dashboards.                                                                                                             |
| A8  | **One environment.** Local dev + a single EAS Hosting deployment. No staging, no CI/CD.                                                                                                                             |
| A9  | Height/weight collected in the user's preferred units, **stored metric**, converted at the UI.                                                                                                                      |
| A10 | **Expo SDK + all package versions pinned at scaffold time** and verified against live docs then — not from memory.                                                                                                  |
| A11 | Streak counts **consecutive days with ≥1 logged meal**, ending today or yesterday (so it doesn't break before you've eaten).                                                                                        |

---

## 3. Open Risks

| #   | Risk                                                                                                                                                                                                                                           | Mitigation                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Trigger.dev Realtime in React Native.** The hooks stream over `fetch`+`ReadableStream`; Hermes needs `expo/fetch` polyfilled onto global `fetch`, and the polyfill has documented rough edges. This sits on the app's most important screen. | Agreed approach: attempt Realtime first, **ship polling as the fallback**. Build the meal card against a `useMealResult()` hook so the transport swaps in one file. Timebox Realtime; if it fights back, polling is ~3 lines of `refetchInterval` and the UX is identical. |
| R2  | **`POST /api/plan` is unauthenticated** — accepted by explicit decision. Anyone who finds it can burn OpenAI tokens.                                                                                                                           | Blast radius is token spend only (no DB writes, no data exposure). Set a hard spend cap in the OpenAI dashboard. Revisit if this ever ships publicly.                                                                                                                      |
| R3  | **AI portion estimates are frequently wrong** — the #1 real-world complaint about these apps.                                                                                                                                                  | Manual macro editing is in v1 specifically for this. Don't over-promise accuracy in the tutorial narrative.                                                                                                                                                                |
| R4  | **EAS Hosting is comparatively young** and there are open reports of production 500s with server deployments.                                                                                                                                  | Deploy a trivial API route end-to-end in Phase 1, before any real work depends on it. Fallback is a standalone Hono server — the route handlers port almost verbatim.                                                                                                      |
| R5  | **Native Google/Apple sign-in requires a dev build**, which means Apple Developer account setup, bundle IDs, and Clerk credential config before auth works at all.                                                                             | Front-load this in Phase 1. It's the single most common place this stack stalls.                                                                                                                                                                                           |
| R6  | **AI-generated targets are non-deterministic** — the same profile can yield different numbers, and profile edits regenerate them.                                                                                                              | Validate output against a plausible range (e.g. 1200–5000 kcal, macros summing near the calorie total); reject and retry once, then fall back to a Mifflin-St Jeor calculation so the user always gets a number.                                                           |
| R7  | **Cold starts** on serverless API routes may make the first request of a session feel slow.                                                                                                                                                    | Acceptable for v1. Note it rather than engineering around it.                                                                                                                                                                                                              |
| R8  | **App Store / privacy work is entirely out of scope** — no privacy policy, no data disclosure, no health-data review prep.                                                                                                                     | Fine for a tutorial. Blocking if the goal ever changes to shipping.                                                                                                                                                                                                        |

---

## 4. Implementation Plan

Ordered so each phase is independently demonstrable — which is also the right order to film in.

### Phase 1 — Foundation _(riskiest things first, deliberately)_

1. Scaffold Expo app (Expo Router, TypeScript), pin SDK version, configure NativeWind.
2. Create the EAS dev build early — Apple/Google credentials, bundle IDs. **Do not defer this.**
3. Add a trivial `app/api/ping+api.ts`, deploy to EAS Hosting, hit it from the device. Proves R4/R5 before anything depends on them.
4. Neon project, Drizzle schema (`db/schema.ts`), first migration via drizzle-kit.
5. Env plumbing: `EXPO_PUBLIC_*` for client, server-only secrets for API routes and Trigger.dev.

### Phase 2 — Auth

6. `@clerk/expo` provider + token cache; `useSignInWithGoogle()` / `useSignInWithApple()`.
7. Expo Router protected route groups: `(onboarding)`, `(auth)`, `(app)`.
8. Clerk-verified helper for API routes; `POST /api/webhooks/clerk` → `sync-clerk-user` task.
9. Verify the upsert race: sign up, confirm exactly one user row regardless of webhook timing.

### Phase 3 — Onboarding + plan

10. Questionnaire screens with AsyncStorage persistence and a progress indicator.
11. Trigger.dev init; `generate-plan` task with structured output + range validation + formula fallback.
12. `POST /api/plan`; "Building your plan…" screen; plan reveal.
13. Sign-up → `POST /api/profile` persists answers + plan → land on Home.

### Phase 4 — Camera → macros _(the core loop)_

14. `expo-camera` capture screen + permission handling.
15. `GET /api/imagekit-auth`; phone-direct upload to ImageKit.
16. `POST /api/meals` creates the `analyzing` row and triggers `analyze-meal`.
17. `analyze-meal` task: vision call, structured output, `is_food` guard, one retry, write result.
18. **Result transport behind a `useMealResult()` hook** — Realtime first, polling fallback (R1).
19. Optimistic skeleton card on Home that fills in live.

### Phase 5 — Home

20. Calorie ring + macro bars against targets.
21. Horizontal date strip; meals-for-a-day query in the user's timezone.
22. Meals list with thumbnails; streak computed in SQL.
23. Empty states, `failed` meal card with retake.

### Phase 6 — Meal detail, profile, polish

24. Meal detail: edit macros (`PATCH`), delete (`DELETE`), optimistic updates.
25. Profile: edit stats → `PATCH /api/profile` → background target regeneration; sign out.
26. Sentry across app, API routes, and tasks.
27. Loading/error/empty state sweep; slow-network behavior.

---

## 5. Verification

**Definition of done — the manual happy path, on a real device:**

1. Fresh install → complete onboarding → see a plausible plan
2. Sign up with Google _and_ Apple (separate accounts) → plan persists
3. Photograph a real meal → card appears immediately as "Analyzing" → macros land within ~10s
4. Edit the macros → ring and bars update → delete the meal → totals recalculate
5. Force-quit and relaunch → everything is still there, still signed in
6. Log a meal at 11pm → confirm it lands on **today**, not tomorrow (the timezone check)
7. Photograph something that isn't food → "couldn't identify" + retake, no phantom meal
8. Airplane mode mid-analysis → recoverable error, no corrupt row
9. Change weight in Profile → targets regenerate in the background
10. Confirm the meal appears in Trigger.dev's dashboard and errors reach Sentry

**Checks worth writing** (small, no framework): the local-day boundary calculation and
the AI response validator. Both are pure functions where a bug is silent and would
otherwise only surface as wrong numbers on screen.

---

## Notes

- On approval, this file gets copied into the project root as `plan.md`.
- No code is written and no Expo project is initialized until then, per the user's instruction.
- Every package version gets verified against live docs at scaffold time (A10).

**Sources consulted:**
[OpenAI Models](https://developers.openai.com/api/docs/models) ·
[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) ·
[Expo API Routes](https://docs.expo.dev/router/web/api-routes/) ·
[EAS Hosting](https://docs.expo.dev/eas/hosting/introduction/) ·
[Trigger.dev Realtime hooks](https://trigger.dev/docs/realtime/react-hooks/overview) ·
[Trigger.dev auth](https://trigger.dev/docs/realtime/auth) ·
[Clerk in Expo 54/55](https://clerk.com/articles/clerk-compatibility-in-expo-54-and-55) ·
[Clerk Expo SDK](https://clerk.com/docs/reference/expo/overview) ·
[expo/fetch](https://docs.expo.dev/versions/latest/sdk/expo/) ·
[EAS server deploy issue #35968](https://github.com/expo/expo/issues/35968)
