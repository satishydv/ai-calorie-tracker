import { logger, schemaTask } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

// Relative, not "@/" — these tasks are bundled by Trigger.dev, not Metro.
import { db, meals } from "../db";

const MODEL = "gpt-5.6-luna"; // PLAN.md A1 — vision-capable

/**
 * ImageKit resize applied only for the model's copy of the photo — the row keeps the
 * full-size URL for the UI. A phone camera JPEG is ~4000px/4MB; the model downsamples
 * to well under 1024px anyway, so the extra pixels are pure upload latency and tokens.
 * Width alone preserves the aspect ratio.
 */
const VISION_TRANSFORM = "?tr=w-1024,q-80,f-jpg";

const SYSTEM_PROMPT = `You are a nutritionist estimating what is on a plate from a single photo.

Rules:
- is_food is false for anything that is not edible food or drink. When it is false, the other fields are ignored — return zeros and an empty name.
- name: what a person would call this meal, 2-4 words, no brand names. e.g. "Grilled chicken salad".
- Estimate the portion actually visible, using the plate, cutlery or hand for scale. Do not return a generic per-100g figure.
- protein_g * 4 + carbs_g * 4 + fat_g * 9 should land within 10% of calories.`;

/** Snake_case because that is how the model is asked to name them. */
const visionSchema = z.object({
  is_food: z.boolean(), // A3: the "couldn't identify this" path
  name: z.string(),
  calories: z.number().int(),
  protein_g: z.number().int(),
  carbs_g: z.number().int(),
  fat_g: z.number().int(),
});

/**
 * Meal photo → macros, written back to the `meals` row.
 *
 * The row already exists in `analyzing` when this starts (POST /api/meals), so every
 * exit has to move it to `completed` or `failed` — a row left `analyzing` is a spinner
 * on Home forever.
 *
 * ponytail: `onFailure` covers exhausted retries but not CRASHED / SYSTEM_FAILURE runs.
 * Sweep stale `analyzing` rows with a scheduled task if that ever shows up in the data.
 */
export const analyzeMeal = schemaTask({
  id: "analyze-meal",
  schema: z.object({
    mealId: z.string().uuid(),
    imageUrl: z.string().url(),
  }),
  retry: { maxAttempts: 2 }, // one transient/parse retry, then failed
  maxDuration: 120,
  run: async ({ mealId, imageUrl }) => {
    // Constructed per call so a missing key fails inside the run, not at import time.
    const openai = new OpenAI({ timeout: 45_000, maxRetries: 0 });

    const response = await openai.responses.parse({
      model: MODEL,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "input_image", image_url: imageUrl + VISION_TRANSFORM, detail: "auto" },
          ],
        },
      ],
      text: { format: zodTextFormat(visionSchema, "meal") },
    });

    const out = response.output_parsed;
    if (!out) throw new Error("OpenAI returned no structured output"); // retried once

    // A photo of a chair is not a meal that failed — it is not a meal. Dropping the row
    // keeps it out of Home, the totals and the streak without any of them filtering for
    // it. The scan screen reads this run's output, not the row, so it still says why.
    //
    // ponytail: the ImageKit file outlives the row. Account deletion still sweeps it
    // (it searches by the `meal-<userId>-` filename, not by row), so this is wasted
    // storage rather than stranded data. Store `fileId` and delete it here if rejected
    // scans turn out to be common.
    if (!out.is_food) {
      logger.warn("Photo is not food, discarding meal", { mealId });
      await db.delete(meals).where(eq(meals.id, mealId));
      return { status: "failed" as const, errorReason: "not_food" as const };
    }

    const result = {
      name: out.name,
      calories: out.calories,
      proteinG: out.protein_g,
      carbsG: out.carbs_g,
      fatG: out.fat_g,
    };

    await db.update(meals).set({ ...result, status: "completed" }).where(eq(meals.id, mealId));

    // Returned as well as written: the scan screen renders straight off the Realtime
    // run output, so it never has to re-fetch the row it just created.
    return { status: "completed" as const, ...result };
  },
  onFailure: async ({ payload, error }) => {
    logger.error("analyze-meal exhausted retries", { mealId: payload.mealId, error: String(error) });
    await db
      .update(meals)
      .set({ status: "failed", errorReason: "analysis_failed" })
      .where(eq(meals.id, payload.mealId));
  },
});
