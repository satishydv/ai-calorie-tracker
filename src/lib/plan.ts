import { z } from 'zod';

/**
 * The nine onboarding answers. Storage is metric — conversion happens at the
 * display edge only (PLAN.md A9). This schema is the trust boundary for
 * `POST /api/plan`, which is deliberately unauthenticated (PLAN.md R2).
 */
export const planInputSchema = z.object({
  gender: z.enum(['male', 'female']),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected yyyy-mm-dd'),
  heightCm: z.number().min(80).max(260),
  weightKg: z.number().min(25).max(400),
  goal: z.enum(['lose', 'maintain', 'gain']),
  targetWeightKg: z.number().min(25).max(400),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'very', 'extra']),
  paceKgPerWeek: z.number().min(0).max(2),
  dietPreference: z.enum(['classic', 'keto', 'vegan', 'vegetarian']),
});

export type PlanInput = z.infer<typeof planInputSchema>;

export type Plan = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  rationale: string;
};

const YEAR_MS = 31557600000;

export const ageFrom = (dateOfBirth: string) =>
  Math.max(14, Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / YEAR_MS));

/**
 * R6: the model is non-deterministic, so anything outside a sane calorie band —
 * or whose macros don't add back up to the calorie total — is rejected.
 */
export function isPlausible(plan: Omit<Plan, 'rationale'>) {
  const numbers = [plan.calories, plan.protein, plan.carbs, plan.fat];
  if (numbers.some((n) => !Number.isFinite(n) || n < 0)) return false;
  if (plan.calories < 1200 || plan.calories > 5000) return false;

  const fromMacros = plan.protein * 4 + plan.carbs * 4 + plan.fat * 9;
  return Math.abs(fromMacros - plan.calories) <= plan.calories * 0.15;
}

const ACTIVITY_FACTOR = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

const SPLIT = {
  classic: [0.3, 0.4, 0.3],
  keto: [0.25, 0.1, 0.65],
  vegan: [0.25, 0.5, 0.25],
  vegetarian: [0.25, 0.5, 0.25],
};

/** R6 fallback: Mifflin-St Jeor, so the user always gets a number. */
export function formulaPlan(input: PlanInput): Plan {
  const bmr =
    10 * input.weightKg +
    6.25 * input.heightCm -
    5 * ageFrom(input.dateOfBirth) +
    (input.gender === 'female' ? -161 : 5);

  const tdee = bmr * ACTIVITY_FACTOR[input.activityLevel];
  const dailyDelta = (input.paceKgPerWeek * 7700) / 7; // ~7700 kcal per kg
  const raw = tdee + (input.goal === 'lose' ? -dailyDelta : input.goal === 'gain' ? dailyDelta : 0);

  const calories = Math.round(Math.min(5000, Math.max(1200, raw)) / 10) * 10;
  const [p, c, f] = SPLIT[input.dietPreference];

  return {
    calories,
    protein: Math.round((calories * p) / 4),
    carbs: Math.round((calories * c) / 4),
    fat: Math.round((calories * f) / 9),
    rationale: `Based on your body stats and activity level, adjusted for your goal to ${input.goal} weight.`,
  };
}
