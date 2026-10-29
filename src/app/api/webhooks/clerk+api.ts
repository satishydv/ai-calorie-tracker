import type { UserJSON } from "@clerk/backend";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";

// Type-only: importing the task instances would bundle them into the server.
import type { clerkUserCreated, clerkUserDeleted, clerkUserUpdated } from "@/trigger/clerk-users";

/** A user can have several emails; [0] isn't necessarily the one they signed up with. */
function primaryEmail(data: UserJSON): string | null {
  const emails = data.email_addresses ?? [];
  const primary = emails.find((e) => e.id === data.primary_email_address_id);
  return primary?.email_address ?? emails[0]?.email_address ?? null;
}

export async function POST(request: Request) {
  let evt;
  try {
    // Reads CLERK_WEBHOOK_SIGNING_SECRET; throws on a bad or replayed signature.
    evt = await verifyWebhook(request);
  } catch (err) {
    console.error("Clerk webhook verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  // Svix retries with the same svix-id. Global scope = one event, one run, ever.
  const svixId = request.headers.get("svix-id");
  const idempotencyKey = svixId ? await idempotencyKeys.create(svixId, { scope: "global" }) : undefined;

  switch (evt.type) {
    case "user.created": {
      await tasks.trigger<typeof clerkUserCreated>(
        "clerk-user-created",
        { clerkUserId: evt.data.id, email: primaryEmail(evt.data) },
        { idempotencyKey },
      );
      break;
    }

    case "user.updated": {
      await tasks.trigger<typeof clerkUserUpdated>(
        "clerk-user-updated",
        { clerkUserId: evt.data.id, email: primaryEmail(evt.data) },
        { idempotencyKey },
      );
      break;
    }

    case "user.deleted": {
      // id is optional on a deleted object — nothing to do without it.
      if (!evt.data.id) break;
      await tasks.trigger<typeof clerkUserDeleted>(
        "clerk-user-deleted",
        { clerkUserId: evt.data.id },
        { idempotencyKey },
      );
      break;
    }
  }

  // 200 on everything we verified, including events we don't handle — a non-2xx
  // makes Svix retry on a schedule, forever, for an event we're ignoring on purpose.
  return new Response("OK", { status: 200 });
}
