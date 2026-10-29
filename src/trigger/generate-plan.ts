import { logger, schemaTask } from "@trigger.dev/sdk";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

// Relative, not "@/" — these tasks are bundled by Trigger.dev, not Metro.
import {
  ageFrom,
  formulaPlan,
  isPlausible,
  planInputSchema,
  type Plan,
  type PlanInput,
} from "../lib/plan";

const MODEL = "gpt-5.6-luna"; // PLAN.md A1 — pinned here, nowhere else

const SYSTEM_PROMPT = `You are a registered dietitian building a daily nutrition target for one person.

Rules:
- Start from Mifflin-St Jeor BMR, multiply by their activity factor, then adjust for their goal and weekly pace (1 kg of body weight is roughly 7700 kcal).
- Keep calories between 1200 and 5000.
- protein_g * 4 + carbs_g * 4 + fat_g * 9 must equal the calorie target within 2%.
- Respect the diet preference: keto is very low carb and high fat; vegan and vegetarian lean carb-heavier with moderate protein; classic is balanced.
- Protein should support their goal — higher when losing weight, to protect muscle.
- rationale: one short second-person sentence explaining how the target was derived. Do not repeat the numbers back.`;

/** Snake_case because that is how the model is asked to name them. */
const aiPlanSchema = z.object({
  calories: z.number().int(),
  protein_g: z.number().int(),
  carbs_g: z.number().int(),
  fat_g: z.number().int(),
  rationale: z.string(),
});

async function askOpenAI(input: PlanInput): Promise<Plan> {
  // Constructed per call so a missing key fails inside the try, not at import time.
  const openai = new OpenAI({ timeout: 25_000, maxRetries: 0 });

  const response = await openai.responses.parse({
    model: MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({ ...input, age: ageFrom(input.dateOfBirth) }),
      },
    ],
    text: { format: zodTextFormat(aiPlanSchema, "daily_plan") },
  });

  const out = response.output_parsed;
  if (!out) throw new Error("OpenAI returned no structured output");

  return {
    calories: out.calories,
    protein: out.protein_g,
    carbs: out.carbs_g,
    fat: out.fat_g,
    rationale: out.rationale,
  };
}

/**
 * Onboarding answers → validated daily targets.
 *
 * Never throws: an implausible or failed generation falls back to Mifflin-St Jeor
 * so the user always gets a number (PLAN.md R6). That also keeps `POST /api/plan`,
 * which polls this run, from hanging on Trigger.dev's retry backoff.
 */
export const generatePlan = schemaTask({
  id: "generate-plan",
  schema: planInputSchema,
  maxDuration: 120,
  run: async (input) => {
    // one generation, one retry, then the formula
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const plan = await askOpenAI(input);
        if (isPlausible(plan)) return { ...plan, source: "ai" as const };
        logger.warn("Implausible plan, discarding", { attempt, plan });
      } catch (error) {
        logger.error("OpenAI plan generation failed", { attempt, error: String(error) });
      }
    }

    return { ...formulaPlan(input), source: "formula" as const };
  },
});
