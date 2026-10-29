import { tasks } from '@trigger.dev/sdk';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db, meals, users } from '@/db';
import { uploadToImageKit } from '@/lib/imagekit';
import { getAuthUserId, unauthorized } from '@/lib/server-auth';
// Type-only: importing the task instance would bundle it into the server.
import type { analyzeMeal } from '@/trigger/analyze-meal';

/** What a screen is allowed to see. `userId` and `triggerRunId` are internal. */
const MEAL_COLUMNS = {
  id: meals.id,
  imageUrl: meals.imageUrl,
  status: meals.status,
  name: meals.name,
  calories: meals.calories,
  proteinG: meals.proteinG,
  carbsG: meals.carbsG,
  fatG: meals.fatG,
  errorReason: meals.errorReason,
  loggedAt: meals.loggedAt,
};

/**
 * A local day's meals, newest first.
 *
 * `date` is the user's calendar day; rows store a UTC instant. Postgres does the
 * conversion because it knows the DST history for the IANA zone — the same sum in
 * JS needs offset arithmetic that is wrong twice a year.
 *
 * ponytail: `AT TIME ZONE` on the column means only the `user_id` prefix of
 * meals_user_logged_at_idx is used. Precompute the day's UTC range if one user ever
 * has enough meals for that to matter.
 */
export async function GET(request: Request) {
  const clerkUserId = await getAuthUserId(request);
  if (!clerkUserId) return unauthorized();

  const date = new URL(request.url).searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'Expected ?date=YYYY-MM-DD' }, { status: 400 });
  }

  const [user] = await db
    .select({ id: users.id, timezone: users.timezone })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId));

  if (!user) return Response.json([]);

  return Response.json(
    await db
      .select(MEAL_COLUMNS)
      .from(meals)
      .where(
        and(
          eq(meals.userId, user.id),
          sql`(${meals.loggedAt} AT TIME ZONE ${user.timezone ?? 'UTC'})::date = ${date}::date`,
        ),
      )
      .orderBy(desc(meals.loggedAt)),
  );
}

/**
 * The photo arrives as base64 rather than multipart. Expo SDK 57 installs `expo/fetch`
 * as the global fetch on native, and that implementation cannot read `{ uri }` FormData
 * parts off disk — so a file upload from the app has to be a string either way.
 */
const logMealSchema = z.object({
  image: z.string().min(100).max(12_000_000), // ~9MB of JPEG
});

/**
 * Photo → an `analyzing` meal the client can watch.
 *
 * Three writes in one round trip: the image lands in ImageKit, the row lands in the DB
 * as `analyzing`, and `analyze-meal` starts. The handle's own `publicAccessToken` is
 * what the scan screen subscribes with — no separate `auth.createPublicToken` call.
 */
export async function POST(request: Request) {
  const clerkUserId = await getAuthUserId(request);
  if (!clerkUserId) return unauthorized();

  const parsed = logMealSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid photo', issues: parsed.error.issues }, { status: 400 });
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId));

  // The tabs' gate means an onboarded user always has a row; a missing one is a bug,
  // not a race, and inventing a user here would hide it.
  if (!user) return Response.json({ error: 'Finish onboarding first' }, { status: 409 });

  const imageUrl = await uploadToImageKit(parsed.data.image, `meal-${user.id}-${Date.now()}.jpg`);

  const [meal] = await db.insert(meals).values({ userId: user.id, imageUrl }).returning();

  const handle = await tasks.trigger<typeof analyzeMeal>('analyze-meal', {
    mealId: meal.id,
    imageUrl,
  });

  await db.update(meals).set({ triggerRunId: handle.id }).where(eq(meals.id, meal.id));

  return Response.json({
    meal,
    runId: handle.id,
    publicAccessToken: handle.publicAccessToken,
  });
}
