import { useAuth } from '@clerk/expo';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Type-only: the schema file pulls in zod, which the app bundle doesn't need.
import type { Plan, PlanInput } from '@/lib/plan';
import type { Meal, User } from '@/db/schema';
import { answers, draft } from '@/onboarding/steps';

/**
 * Relative URLs resolve to the dev server automatically. A production build needs
 * `origin` set on the expo-router plugin in app.json, pointing at the deployment.
 */
export type Profile = Pick<
  User,
  | 'gender'
  | 'dateOfBirth'
  | 'heightCm'
  | 'weightKg'
  | 'goal'
  | 'targetWeightKg'
  | 'activityLevel'
  | 'paceKgPerWeek'
  | 'dietPreference'
  | 'timezone'
  | 'dailyCalories'
  | 'proteinG'
  | 'carbsG'
  | 'fatG'
  | 'planRationale'
> & {
  planGeneratedAt: string | null;
  onboardingCompletedAt: string | null;
  createdAt: string;
};

export const PROFILE_KEY = ['profile'];

/** Onboarding answers → AI-generated targets. No auth: this runs before sign-up. */
export async function requestPlan(input: PlanInput): Promise<Plan & { source: string }> {
  const startedAt = Date.now();

  const response = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) throw new Error(`Plan generation failed (${response.status})`);

  const plan: Plan & { source: string } = await response.json();

  // `source: 'formula'` means the model failed or returned an implausible plan and the
  // user silently got the Mifflin-St Jeor fallback (lib/plan.ts). The UI looks identical
  // either way, so this log is the only place that difference is visible.
  const record = plan.source === 'formula' ? Sentry.logger.warn : Sentry.logger.info;
  record('Onboarding plan generated', {
    plan_source: plan.source,
    calories: plan.calories,
    goal: input.goal,
    activity_level: input.activityLevel,
    diet_preference: input.dietPreference,
    duration_ms: Date.now() - startedAt,
  });

  return plan;
}

export function useProfile() {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: PROFILE_KEY,
    enabled: !!isSignedIn,
    staleTime: 60_000,
    queryFn: async (): Promise<Profile | null> => {
      const response = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });

      if (!response.ok) throw new Error(`Could not load your profile (${response.status})`);
      return response.json();
    },
  });
}

/**
 * Persists the questionnaire answers plus the plan generated from them. Reads the
 * onboarding draft directly — there is only ever one in flight.
 */
export function useSaveProfile() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<Profile> => {
      if (!draft.plan) throw new Error('No generated plan to save');

      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({
          ...(answers as PlanInput),
          plan: draft.plan,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!response.ok) throw new Error(`Could not save your profile (${response.status})`);
      return response.json();
    },
    // seed the cache so the tabs' onboarding gate sees a completed profile immediately
    onSuccess: (profile) => {
      queryClient.setQueryData(PROFILE_KEY, profile);
      // The end of the funnel — the point a visitor becomes a user with targets.
      Sentry.logger.info('Onboarding completed', {
        goal: profile.goal ?? 'unknown',
        daily_calories: profile.dailyCalories ?? 0,
        timezone: profile.timezone ?? 'unknown',
      });
    },
    onError: (error) =>
      Sentry.logger.error('Onboarding profile save failed', { reason: String(error) }),
  });
}

/** Deletes the row, the meals and the Clerk user. Sign out and clear the cache after. */
export async function deleteAccount(token: string | null) {
  const response = await fetch('/api/profile', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error(`Could not delete your account (${response.status})`);
}

/** What the scan screen needs to render the row and subscribe to its analysis. */
export type LoggedMeal = {
  meal: Meal;
  runId: string;
  publicAccessToken: string;
};

/** A meal as a screen sees it — `loggedAt` is an ISO string once it crosses JSON. */
export type DayMeal = Pick<
  Meal,
  'id' | 'imageUrl' | 'status' | 'name' | 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'errorReason'
> & { loggedAt: string };

export const MEALS_KEY = ['meals'];

/** Meals for one local calendar day, `YYYY-MM-DD` in the user's own timezone. */
export function useMeals(date: string) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: [...MEALS_KEY, date],
    enabled: !!isSignedIn,
    queryFn: async (): Promise<DayMeal[]> => {
      const response = await fetch(`/api/meals?date=${date}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });

      if (!response.ok) throw new Error(`Could not load your meals (${response.status})`);
      return response.json();
    },
    // A row analysing in the background is the one thing this screen can't see change.
    // Polling only while that's true beats a Realtime subscription per card.
    refetchInterval: (query) =>
      query.state.data?.some((meal) => meal.status === 'analyzing') ? 3000 : false,
  });
}

/** Photo (base64 JPEG) → an `analyzing` meal plus the Realtime credentials to watch it. */
export function useLogMeal() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (image: string): Promise<LoggedMeal> => {
      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({ image }),
      });

      if (!response.ok) throw new Error(`Could not log your meal (${response.status})`);
      return response.json();
    },
    // Home stays mounted behind the native tabs, so nothing else would make it refetch.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEALS_KEY }),
    // `image` is the base64 payload — its length is the one attribute that tells a
    // failed upload apart from a photo too big to survive the round trip.
    onError: (error, image) =>
      Sentry.logger.error('Meal upload failed', {
        reason: String(error),
        image_bytes: image.length,
      }),
  });
}
