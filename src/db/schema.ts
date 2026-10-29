import { date, index, integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Storage is metric + UTC. Conversion happens at the display edge only.

export const unitPreferenceEnum = pgEnum("unit_preference", ["metric", "imperial"]);
export const goalEnum = pgEnum("goal", ["lose", "maintain", "gain"]);
// "extra" exists because the onboarding questionnaire offers it — see src/onboarding/steps.ts.
export const activityLevelEnum = pgEnum("activity_level", ["sedentary", "light", "moderate", "very", "extra"]);
export const dietPreferenceEnum = pgEnum("diet_preference", ["classic", "keto", "vegan", "vegetarian"]);
export const mealStatusEnum = pgEnum("meal_status", ["analyzing", "completed", "failed"]);

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  clerkUserId: text().notNull().unique(), // Clerk is source of truth for identity
  email: text(),
  timezone: text(), // IANA, e.g. "America/New_York"
  unitPreference: unitPreferenceEnum(), // display only

  gender: text(),
  dateOfBirth: date({ mode: "string" }), // string, not Date — a DOB has no timezone
  heightCm: numeric({ mode: "number" }),
  weightKg: numeric({ mode: "number" }),
  goal: goalEnum(),
  targetWeightKg: numeric({ mode: "number" }),
  activityLevel: activityLevelEnum(),
  paceKgPerWeek: numeric({ mode: "number" }),
  dietPreference: dietPreferenceEnum(),

  // AI-generated targets
  dailyCalories: integer(),
  proteinG: integer(),
  carbsG: integer(),
  fatG: integer(),
  planRationale: text(),
  planGeneratedAt: timestamp({ withTimezone: true }),

  onboardingCompletedAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

export const meals = pgTable(
  "meals",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    imageUrl: text().notNull(), // ImageKit URL
    status: mealStatusEnum().notNull().default("analyzing"),

    name: text(),
    calories: integer(),
    proteinG: integer(),
    carbsG: integer(),
    fatG: integer(),

    errorReason: text(), // "not_food" | "parse_failed" | …
    triggerRunId: text(), // for Realtime subscribe / debugging

    loggedAt: timestamp({ withTimezone: true }).notNull().defaultNow(), // UTC instant
    ...timestamps,
  },
  (t) => [index("meals_user_logged_at_idx").on(t.userId, t.loggedAt.desc())],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Meal = typeof meals.$inferSelect;
export type NewMeal = typeof meals.$inferInsert;
