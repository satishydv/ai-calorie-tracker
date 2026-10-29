import { task } from "@trigger.dev/sdk";
import { eq, sql } from "drizzle-orm";

// Relative, not "@/db" — these tasks are bundled by Trigger.dev, not Metro.
import { db, users } from "../db";

type SyncUserPayload = { clerkUserId: string; email: string | null };

/**
 * Upsert, never a plain insert. `POST /api/profile` can land before this webhook
 * does, so both paths key on clerk_user_id and either order produces one row.
 * See PLAN.md "Race condition, handled".
 *
 * Only `email` is touched — every other column is owned by /api/profile, and a
 * blind overwrite here would wipe the onboarding answers.
 */
function upsertUser({ clerkUserId, email }: SyncUserPayload) {
  return db
    .insert(users)
    .values({ clerkUserId, email })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        email: sql`coalesce(excluded.email, ${users.email})`, // never null out a known email
        updatedAt: new Date(), // $onUpdate doesn't fire on conflict-update
      },
    })
    .returning({ id: users.id });
}

export const clerkUserCreated = task({
  id: "clerk-user-created",
  run: async (payload: SyncUserPayload) => {
    const [user] = await upsertUser(payload);
    return { userId: user.id };
  },
});

export const clerkUserUpdated = task({
  id: "clerk-user-updated",
  run: async (payload: SyncUserPayload) => {
    const [user] = await upsertUser(payload);
    return { userId: user.id };
  },
});

export const clerkUserDeleted = task({
  id: "clerk-user-deleted",
  run: async (payload: { clerkUserId: string }) => {
    // Their meals go too, via the meals.user_id FK's onDelete: "cascade".
    const deleted = await db
      .delete(users)
      .where(eq(users.clerkUserId, payload.clerkUserId))
      .returning({ id: users.id });

    // Not an error: the user may never have finished onboarding.
    return { deleted: deleted.length };
  },
});
