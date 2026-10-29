import { createClerkClient } from "@clerk/backend";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, users } from "@/db";
import { deleteUserImages } from "@/lib/imagekit";
import { planInputSchema } from "@/lib/plan";
import { getAuthUserId, unauthorized } from "@/lib/server-auth";

/** What a screen is allowed to see. Everything else on the row is internal. */
const PROFILE_COLUMNS = {
  gender: users.gender,
  dateOfBirth: users.dateOfBirth,
  heightCm: users.heightCm,
  weightKg: users.weightKg,
  goal: users.goal,
  targetWeightKg: users.targetWeightKg,
  activityLevel: users.activityLevel,
  paceKgPerWeek: users.paceKgPerWeek,
  dietPreference: users.dietPreference,
  timezone: users.timezone,
  dailyCalories: users.dailyCalories,
  proteinG: users.proteinG,
  carbsG: users.carbsG,
  fatG: users.fatG,
  planRationale: users.planRationale,
  planGeneratedAt: users.planGeneratedAt,
  onboardingCompletedAt: users.onboardingCompletedAt,
  createdAt: users.createdAt,
};

const saveProfileSchema = planInputSchema.extend({
  timezone: z.string().min(1).max(64), // IANA, from the device
  plan: z.object({
    calories: z.number().int().min(1),
    protein: z.number().int().min(0),
    carbs: z.number().int().min(0),
    fat: z.number().int().min(0),
    rationale: z.string().max(500),
  }),
});

/** Profile + targets, or `null` for a user who hasn't finished onboarding. */
export async function GET(request: Request) {
  const clerkUserId = await getAuthUserId(request);
  if (!clerkUserId) return unauthorized();

  const [profile] = await db
    .select(PROFILE_COLUMNS)
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId));

  return Response.json(profile ?? null);
}

/**
 * Persist the onboarding answers and the plan that was generated for them.
 *
 * Upsert, never a plain insert: the Clerk webhook may or may not have created the
 * row yet, and either order has to produce exactly one row (PLAN.md "Race
 * condition, handled"). `email` is left alone here — the webhook owns it.
 */
export async function POST(request: Request) {
  const clerkUserId = await getAuthUserId(request);
  if (!clerkUserId) return unauthorized();

  const parsed = saveProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid profile", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { plan, ...answers } = parsed.data;
  const now = new Date();
  const columns = {
    ...answers,
    dailyCalories: plan.calories,
    proteinG: plan.protein,
    carbsG: plan.carbs,
    fatG: plan.fat,
    planRationale: plan.rationale,
    planGeneratedAt: now,
    onboardingCompletedAt: now,
  };

  const [profile] = await db
    .insert(users)
    .values({ clerkUserId, ...columns })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: { ...columns, updatedAt: now }, // $onUpdate doesn't fire on conflict-update
    })
    .returning(PROFILE_COLUMNS);

  return Response.json(profile);
}

/**
 * Erase the account, everywhere it exists: the meal photos in ImageKit, the row
 * (its meals cascade off the FK) and the Clerk identity.
 *
 * Done here rather than left to the `user.deleted` webhook — that fires after the
 * fact, never at all against a dev server Clerk can't reach, and knows nothing
 * about ImageKit. It still runs afterwards and finds the row already gone, which
 * its task treats as a no-op.
 *
 * Strictly widest-to-narrowest, so a failure anywhere leaves an account that can
 * still authenticate and retry:
 *  1. photos — named after `users.id`, so they must go while that id is still known
 *  2. the row + meals
 *  3. Clerk, last: it is what proves who is asking
 *
 * Nothing is swallowed. A half-finished delete answers 500 and the client retries;
 * each step is idempotent, so the retry finishes whatever is left.
 */
export async function DELETE(request: Request) {
  const clerkUserId = await getAuthUserId(request);
  if (!clerkUserId) return unauthorized();

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId));

  // No row means they never finished onboarding — there are no photos either.
  const photos = user ? await deleteUserImages(user.id) : 0;

  await db.delete(users).where(eq(users.clerkUserId, clerkUserId));
  await createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }).users.deleteUser(clerkUserId);

  console.log(`Deleted account ${clerkUserId}: ${photos} photo(s), row, Clerk user`);
  return new Response(null, { status: 204 });
}
