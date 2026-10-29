// Seed: one user + 5 completed meals (3 today, 2 yesterday) in the user's local timezone.
// Run: node --experimental-strip-types scripts/seed.ts
import { neon } from "@neondatabase/serverless";

process.loadEnvFile();
const sql = neon(process.env.DATABASE_URL!);

const USER = {
  id: "02352420-5673-44cc-8b31-bf7211d46ffa",
  clerkUserId: "user_3HAVVFFsIEoyK2RwMZfjrlJDMaK",
  email: "devburakork@gmail.com",
  timezone: "Asia/Makassar",
  gender: "male",
  dateOfBirth: "2001-07-29",
  heightCm: 175,
  weightKg: 70,
  goal: "gain",
  targetWeightKg: 73.5,
  activityLevel: "moderate",
  paceKgPerWeek: 0.8,
  dietPreference: "classic",
  dailyCalories: 3210,
  proteinG: 140,
  carbsG: 448,
  fatG: 95,
  planRationale:
    "This target uses your Mifflin-St Jeor maintenance estimate with moderate activity and adds the surplus needed to support your requested rate of weight gain, with balanced macros and ample protein for muscle support.",
};

// dayOffset 0 = today, 1 = yesterday — as dates in the user's timezone, not UTC.
const MEALS = [
  { dayOffset: 0, time: "08:15", name: "Greek Yogurt Parfait", calories: 420, protein: 28, carbs: 52, fat: 11, image: "photo-1488477181946-6428a0291777" },
  { dayOffset: 0, time: "12:45", name: "Chicken Burrito Bowl", calories: 780, protein: 52, carbs: 88, fat: 22, image: "photo-1512621776951-a57141f2eefd" },
  { dayOffset: 0, time: "19:30", name: "Salmon with Roasted Potatoes", calories: 690, protein: 45, carbs: 55, fat: 30, image: "photo-1467003909585-2f8a72700288" },
  { dayOffset: 1, time: "09:00", name: "Avocado Toast with Eggs", calories: 520, protein: 24, carbs: 42, fat: 29, image: "photo-1541519227354-08fa5d50c44d" },
  { dayOffset: 1, time: "13:30", name: "Beef Pho", calories: 610, protein: 38, carbs: 72, fat: 18, image: "photo-1591814468924-caf88d1232e1" },
];

/** Local wall-clock in the user's timezone -> UTC instant. */
function loggedAt(dayOffset: number, time: string) {
  const day = new Date(Date.now() - dayOffset * 86_400_000);
  // en-CA gives YYYY-MM-DD; the offset comes from the same formatter so DST is handled.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: USER.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZoneName: "longOffset",
  }).formatToParts(day);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const offset = get("timeZoneName").replace("GMT", "") || "+00:00";
  return new Date(`${get("year")}-${get("month")}-${get("day")}T${time}:00${offset}`);
}

await sql`
  insert into users (
    id, clerk_user_id, email, timezone, gender, date_of_birth, height_cm, weight_kg,
    goal, target_weight_kg, activity_level, pace_kg_per_week, diet_preference,
    daily_calories, protein_g, carbs_g, fat_g, plan_rationale,
    plan_generated_at, onboarding_completed_at
  ) values (
    ${USER.id}, ${USER.clerkUserId}, ${USER.email}, ${USER.timezone}, ${USER.gender},
    ${USER.dateOfBirth}, ${USER.heightCm}, ${USER.weightKg}, ${USER.goal}, ${USER.targetWeightKg},
    ${USER.activityLevel}, ${USER.paceKgPerWeek}, ${USER.dietPreference}, ${USER.dailyCalories},
    ${USER.proteinG}, ${USER.carbsG}, ${USER.fatG}, ${USER.planRationale}, now(), now()
  )
  on conflict (clerk_user_id) do update set
    timezone = excluded.timezone,
    daily_calories = excluded.daily_calories,
    protein_g = excluded.protein_g,
    carbs_g = excluded.carbs_g,
    fat_g = excluded.fat_g,
    onboarding_completed_at = excluded.onboarding_completed_at
`;

// Re-runnable: wipe this user's meals rather than piling up duplicates.
await sql`delete from meals where user_id = ${USER.id}`;

for (const m of MEALS) {
  const at = loggedAt(m.dayOffset, m.time);
  await sql`
    insert into meals (user_id, image_url, status, name, calories, protein_g, carbs_g, fat_g, logged_at, created_at)
    values (
      ${USER.id}, ${`https://images.unsplash.com/${m.image}`}, 'completed',
      ${m.name}, ${m.calories}, ${m.protein}, ${m.carbs}, ${m.fat}, ${at}, ${at}
    )
  `;
  console.log(`${m.name} — ${at.toISOString()}`);
}

console.log(`\nSeeded ${MEALS.length} meals for ${USER.email}`);
