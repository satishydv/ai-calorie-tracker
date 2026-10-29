import * as Sentry from '@sentry/react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ponytail: temporary QA screen for the Sentry dashboard — delete it (and the Profile
// row that links here) once the alerts, issue grouping and log views are verified.

/** Named subclasses so the issue title in Sentry isn't just "Error". */
class MealAnalysisError extends Error {
  name = 'MealAnalysisError';
}
class PaywallPurchaseError extends Error {
  name = 'PaywallPurchaseError';
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toast = (message: string) => Alert.alert('Sent to Sentry', message);

// ---------------------------------------------------------------- crashes

function crashInRender(): never {
  throw new Error("Cannot read property 'calories' of undefined");
}

/** Escapes the onPress call stack, so it lands in the global handler as uncaught. */
function uncaughtHandlerError() {
  setTimeout(() => {
    throw new MealAnalysisError('Meal analysis worker returned a malformed macro payload');
  }, 0);
}

function unhandledRejection() {
  // no .catch() on purpose — this is the shape a forgotten await leaves behind
  Promise.reject(new Error('POST /api/meals timed out after 30000ms'));
}

function nativeCrash() {
  Alert.alert('Hard crash the app?', 'The app closes immediately. The report uploads on relaunch.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Crash', style: 'destructive', onPress: () => Sentry.nativeCrash() },
  ]);
}

// ------------------------------------------------------- handled exceptions

function captureMealFailure() {
  Sentry.withScope((scope) => {
    scope.setTag('feature', 'meal-analysis');
    scope.setTag('model', 'gpt-4o-mini');
    scope.setLevel('error');
    scope.setContext('meal', {
      meal_id: 'meal_8f2a41',
      image_bytes: 2_184_302,
      retry_count: 2,
      trigger_run_id: 'run_01JQZ8K3',
    });
    Sentry.captureException(
      new MealAnalysisError('Vision model returned calories outside the plausible range (11840)'),
    );
  });
  toast('MealAnalysisError with tags + meal context');
}

function capturePurchaseFailure() {
  Sentry.withScope((scope) => {
    scope.setTag('feature', 'paywall');
    scope.setTag('store', 'app_store');
    // one issue per decline reason instead of one giant "purchase failed" bucket
    scope.setFingerprint(['paywall', 'purchase-failed', 'payment_declined']);
    scope.setContext('purchase', {
      product_id: 'bulky_pro_yearly',
      price_usd: 39.99,
      store_error_code: 'SKErrorDomain-2',
    });
    Sentry.captureException(new PaywallPurchaseError('Payment declined by the App Store'));
  });
  toast('PaywallPurchaseError with a custom fingerprint');
}

async function captureNetworkFailure() {
  Sentry.addBreadcrumb({ category: 'auth', message: 'Clerk token refreshed', level: 'info' });
  Sentry.addBreadcrumb({ category: 'ui', message: 'Tapped "Log meal"', level: 'info' });
  try {
    // real request to a host that cannot resolve — a genuine network failure, not a fake one
    await fetch('https://api.bulky-ai.invalid/v1/meals');
    toast('Request unexpectedly succeeded');
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag('feature', 'sync');
      scope.setContext('request', { url: 'https://api.bulky-ai.invalid/v1/meals', method: 'GET' });
      Sentry.captureException(error);
    });
    toast('Network failure with a breadcrumb trail');
  }
}

function captureCameraWarning() {
  Sentry.withScope((scope) => {
    scope.setTag('feature', 'camera');
    scope.setContext('permission', { status: 'denied', can_ask_again: false });
    Sentry.captureMessage('Camera permission denied after the user reached the scan tab', 'warning');
  });
  toast('captureMessage at warning level');
}

// ------------------------------------------------------------------- logs

const LOGS: { label: string; run: () => void }[] = [
  {
    label: 'trace — cache read',
    run: () => Sentry.logger.trace('Profile cache hit', { key: 'profile', age_ms: 412 }),
  },
  {
    label: 'debug — camera frame',
    run: () =>
      Sentry.logger.debug('Captured frame compressed', { width: 1024, quality: 0.8, bytes: 184302 }),
  },
  {
    label: 'info — meal logged',
    run: () =>
      Sentry.logger.info('Meal logged', { calories: 642, protein_g: 38, source: 'camera' }),
  },
  {
    label: 'warn — formula fallback',
    run: () =>
      Sentry.logger.warn('Plan fell back to Mifflin-St Jeor', {
        reason: 'model_returned_implausible_plan',
        calories: 2100,
      }),
  },
  {
    label: 'error — upload failed',
    run: () =>
      Sentry.logger.error('Meal upload failed', {
        reason: 'HTTP 502 from /api/meals',
        image_bytes: 2_184_302,
      }),
  },
  {
    label: 'fatal — db unreachable',
    run: () =>
      Sentry.logger.fatal('Database unreachable, every write is failing', {
        db: 'neon-primary',
        consecutive_failures: 12,
      }),
  },
];

// ------------------------------------------------------------ performance

async function tracedMealAnalysis() {
  await Sentry.startSpan({ name: 'Analyze meal photo', op: 'meal.analyze' }, async () => {
    await Sentry.startSpan({ name: 'Compress image', op: 'image.compress' }, () => sleep(180));
    await Sentry.startSpan({ name: 'Upload to ImageKit', op: 'http.client' }, () => sleep(520));
    await Sentry.startSpan({ name: 'Vision model', op: 'gen_ai.chat' }, async (span) => {
      span.setAttribute('model', 'gpt-4o-mini');
      await sleep(1400);
    });
  });
  toast('Transaction "Analyze meal photo" with 3 child spans');
}

async function tracedFailingSpan() {
  try {
    await Sentry.startSpan({ name: 'Sync meals', op: 'db.sync' }, async () => {
      await sleep(250);
      throw new Error('Connection terminated unexpectedly');
    });
  } catch {
    toast('Span recorded with status internal_error');
  }
}

// -------------------------------------------------------------------- UI

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-[8px] ml-[26px] mt-[26px] text-[15px] font-medium text-[#8A8A90]">
      {children}
    </Text>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <View className="mx-[18px] overflow-hidden rounded-[20px] bg-white">{children}</View>;
}

function Row({
  icon,
  label,
  onPress,
  tint = '#000000',
  divider,
}: {
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  tint?: string;
  divider?: boolean;
}) {
  return (
    <View style={divider ? { borderTopWidth: 1, borderTopColor: '#F1F1F3' } : undefined}>
      <Pressable onPress={onPress} className="active:bg-[#F7F7F9]">
        <View className="flex-row items-center px-[18px] py-[15px]">
          <SymbolView name={icon} size={21} tintColor={tint} style={{ width: 24, height: 24 }} />
          <Text className="ml-[12px] flex-1 text-[17px]" style={{ color: tint }} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

export default function DebugSentry() {
  const insets = useSafeAreaInsets();
  const [crash, setCrash] = useState(false);

  if (crash) crashInRender();

  return (
    <View className="flex-1 bg-[#F4F4F6]" style={{ paddingTop: insets.top }}>
      <StatusBar style="dark" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View className="mt-[10px] flex-row items-center px-[22px]">
          <Text className="flex-1 text-[34px] font-bold tracking-[-0.8px] text-black">Sentry</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text className="text-[17px] text-[#8A8A90]">Close</Text>
          </Pressable>
        </View>
        <Text className="mt-[4px] px-[22px] text-[15px] text-[#8A8A90]">
          Every button below sends something real to the dashboard.
        </Text>

        <SectionTitle>Crashes</SectionTitle>
        <Card>
          <Row
            icon="exclamationmark.triangle"
            label="Uncaught error in render"
            tint="#E5484D"
            onPress={() => setCrash(true)}
          />
          <Row
            divider
            icon="hand.tap"
            label="Uncaught error in a handler"
            tint="#E5484D"
            onPress={uncaughtHandlerError}
          />
          <Row
            divider
            icon="arrow.triangle.2.circlepath"
            label="Unhandled promise rejection"
            tint="#E5484D"
            onPress={unhandledRejection}
          />
          <Row
            divider
            icon="bolt.trianglebadge.exclamationmark"
            label="Native crash"
            tint="#E5484D"
            onPress={nativeCrash}
          />
        </Card>

        <SectionTitle>Handled errors</SectionTitle>
        <Card>
          <Row icon="fork.knife" label="Meal analysis failed" onPress={captureMealFailure} />
          <Row divider icon="creditcard" label="Purchase declined" onPress={capturePurchaseFailure} />
          <Row divider icon="wifi.slash" label="Network request failed" onPress={captureNetworkFailure} />
          <Row divider icon="camera" label="Camera permission denied" onPress={captureCameraWarning} />
        </Card>

        <SectionTitle>Logs</SectionTitle>
        <Card>
          {LOGS.map((log, index) => (
            <Row
              key={log.label}
              divider={index > 0}
              icon="text.alignleft"
              label={log.label}
              onPress={() => {
                log.run();
                toast(log.label);
              }}
            />
          ))}
        </Card>

        <SectionTitle>Performance</SectionTitle>
        <Card>
          <Row icon="timer" label="Slow meal analysis trace" onPress={tracedMealAnalysis} />
          <Row divider icon="xmark.octagon" label="Span that fails" onPress={tracedFailingSpan} />
        </Card>

        <SectionTitle>Other</SectionTitle>
        <Card>
          <Row
            icon="mappin.and.ellipse"
            label="Add breadcrumbs only"
            onPress={() => {
              Sentry.addBreadcrumb({ category: 'ui', message: 'Opened camera', level: 'info' });
              Sentry.addBreadcrumb({ category: 'ui', message: 'Retook photo', level: 'info' });
              toast('Breadcrumbs attached to the next event');
            }}
          />
          {/* the feedback widget lives on Profile — it's a real feature, not a test */}
          <Row
            divider
            icon="paperplane"
            label="Flush queued events now"
            onPress={async () => {
              await Sentry.flush();
              toast('Queue flushed');
            }}
          />
        </Card>
      </ScrollView>
    </View>
  );
}
