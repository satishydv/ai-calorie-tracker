import { runs, tasks } from "@trigger.dev/sdk";

import { planInputSchema } from "@/lib/plan";
// Type-only: importing the task instance would bundle it into the server.
import type { generatePlan } from "@/trigger/generate-plan";

/**
 * Onboarding answers → daily targets. Deliberately unauthenticated (PLAN.md R2):
 * it runs before the user has an account and writes nothing to the DB.
 *
 * Deviates from PLAN.md in one way: rather than handing the client a runId and a
 * public token to watch over Realtime (R1), the route polls the run and returns
 * the finished plan. One round trip, no Realtime-in-Hermes risk, same UX — the
 * "Building your plan…" screen is a fixed animation either way.
 */
export async function POST(request: Request) {
  const parsed = planInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid onboarding answers", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const handle = await tasks.trigger<typeof generatePlan>("generate-plan", parsed.data);
  const run = await runs.poll(handle, { pollIntervalMs: 500 });

  if (run.status !== "COMPLETED" || !run.output) {
    console.error("generate-plan did not complete:", run.status, run.error);
    return Response.json({ error: "Could not build your plan" }, { status: 502 });
  }

  return Response.json(run.output);
}
