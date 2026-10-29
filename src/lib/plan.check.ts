/**
 * Self-check for the plan math and the AI-response validator.
 * Run: node --experimental-strip-types src/lib/plan.check.ts
 *
 * Kept because both are silent when wrong — a bad calorie target or a bad
 * validator only shows up as odd numbers on someone's home screen.
 */
import assert from 'node:assert/strict';

import { steps } from '../onboarding/steps.ts';
import { formulaPlan, isPlausible, planInputSchema, type PlanInput } from './plan.ts';

const base: PlanInput = {
  gender: 'male',
  dateOfBirth: '1995-01-01',
  heightCm: 180,
  weightKg: 80,
  goal: 'maintain',
  targetWeightKg: 75,
  activityLevel: 'moderate',
  paceKgPerWeek: 0.5,
  dietPreference: 'classic',
};

// --- formula fallback -------------------------------------------------------

// male, 80kg, 180cm, ~30yo, moderate -> TDEE ≈ 2760
const maintain = formulaPlan(base);
assert.ok(Math.abs(maintain.calories - 2760) < 60, `maintain ${maintain.calories}`);

// a 0.5 kg/week deficit is ~550 kcal/day either side of maintenance
const lose = formulaPlan({ ...base, goal: 'lose' });
const gain = formulaPlan({ ...base, goal: 'gain' });
assert.ok(maintain.calories - lose.calories > 500, `lose ${lose.calories}`);
assert.ok(gain.calories - maintain.calories > 500, `gain ${gain.calories}`);

// macros must add back up to the calorie target
for (const p of [lose, maintain, gain]) {
  const kcal = p.protein * 4 + p.carbs * 4 + p.fat * 9;
  assert.ok(Math.abs(kcal - p.calories) < 15, `macros ${kcal} vs ${p.calories}`);
}

// keto shifts calories out of carbs and into fat
const keto = formulaPlan({ ...base, dietPreference: 'keto' });
assert.ok(keto.carbs < maintain.carbs / 3 && keto.fat > maintain.fat * 1.9, 'keto split');

// clamped, never absurd, whatever the inputs
const tiny = formulaPlan({
  ...base,
  weightKg: 35,
  heightCm: 140,
  goal: 'lose',
  paceKgPerWeek: 1.5,
});
assert.equal(tiny.calories, 1200);

// whatever the formula produces must survive its own validator
for (const p of [lose, maintain, gain, keto, tiny])
  assert.ok(isPlausible(p), 'formula is plausible');

// --- AI response validator (R6) --------------------------------------------

assert.ok(!isPlausible({ calories: 900, protein: 60, carbs: 90, fat: 30 }), 'too few calories');
assert.ok(
  !isPlausible({ calories: 6000, protein: 300, carbs: 900, fat: 133 }),
  'too many calories',
);
assert.ok(!isPlausible({ calories: 2000, protein: 10, carbs: 10, fat: 10 }), 'macros too low');
assert.ok(!isPlausible({ calories: 2000, protein: 200, carbs: 200, fat: 100 }), 'macros too high');
assert.ok(!isPlausible({ calories: 2000, protein: -50, carbs: 300, fat: 50 }), 'negative macro');
assert.ok(!isPlausible({ calories: NaN, protein: 150, carbs: 200, fat: 60 }), 'NaN calories');
// 150*4 + 200*4 + 67*9 = 2003, inside the 15% band
assert.ok(isPlausible({ calories: 2000, protein: 150, carbs: 200, fat: 67 }), 'sane plan');

// --- the trust boundary -----------------------------------------------------

assert.ok(planInputSchema.safeParse(base).success, 'valid input parses');
assert.ok(!planInputSchema.safeParse({ ...base, heightCm: 5 }).success, 'absurd height rejected');
assert.ok(!planInputSchema.safeParse({ ...base, dateOfBirth: '01/01/1995' }).success, 'bad date');
assert.ok(!planInputSchema.safeParse({ ...base, goal: 'shrink' }).success, 'unknown goal');

// --- questionnaire ----------------------------------------------------------

// every step writes a field that exists on PlanInput, and keys are unique
const keys = new Set(steps.map((s) => s.key));
assert.equal(keys.size, steps.length);
for (const s of steps) assert.ok(s.field in base, s.key);

console.log('plan.check: ok');
