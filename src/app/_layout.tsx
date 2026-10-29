import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import * as Sentry from "@sentry/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isRunningInExpoGo } from "expo";
import { Stack, useNavigationContainerRef } from "expo-router";
import { useEffect, useState } from "react";

import "@/global.css";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error("Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to your .env file");
}

/**
 * Turns each screen change into a transaction. Expo Router runs on React Navigation, so
 * this is the integration it uses — there is no expo-router-specific one.
 *
 * Time to Initial Display and native frame timings need the native layer, which Expo Go
 * doesn't ship. This app uses a dev client, so both are on in practice.
 */
const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

Sentry.init({
  dsn: "https://2967ae7137a81835e74a8f9c69a8d26f@o4509813037137920.ingest.de.sentry.io/4511816995962960",
  // The SDK would default this to "development" on a dev build, which the dashboard's
  // environment filter hides unless you switch it. Explicit so it's visible in the UI.
  environment: __DEV__ ? "development" : "production",
  // logs every envelope it sends to the Metro console — the only way to tell "the SDK
  // never sent it" apart from "the dashboard is filtering it out"
  debug: __DEV__,
  sendDefaultPii: true,
  enableLogs: true,
  // ponytail: sample everything while the app is small; drop to ~0.1 once traffic costs quota
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableNativeFramesTracking: !isRunningInExpoGo(),
  integrations: [
    Sentry.mobileReplayIntegration({
      maskAllImages: false,
      maskAllText: false,
      maskAllVectors: false,
    }),
    navigationIntegration,
  ],
});

function RootLayout() {
  // per-instance, not module scope, so a server render can't share one client
  const [queryClient] = useState(() => new QueryClient());

  // Stable object from expo-router's store; React attaches `.current` during commit,
  // so it is already populated by the time this effect runs.
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <SentryUser />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

/**
 * Attaches the signed-in user to every log and error Sentry sends. Lives here rather
 * than in `(app)/_layout` so it also covers onboarding, which sits outside that group.
 */
function SentryUser() {
  const { isLoaded, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    Sentry.setUser(userId ? { id: userId } : null); // null on sign-out, so logs don't
  }, [isLoaded, userId]); //                           keep carrying the previous user

  return null;
}

export default Sentry.wrap(RootLayout);
