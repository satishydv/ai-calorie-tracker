import * as Sentry from '@sentry/react-native';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { requestPlan } from '@/lib/api';
import type { PlanInput } from '@/lib/plan';
import { answers, draft } from '@/onboarding/steps';

const LINES = [
  'Reading your answers…',
  'Estimating your daily burn…',
  'Balancing your macros…',
  'Finishing your plan…',
];
const TICK = 700;

export default function BuildingPlan() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  const generate = useCallback(async () => {
    setFailed(false);
    try {
      draft.plan = await requestPlan(answers as PlanInput);
      router.replace('/onboarding/plan');
    } catch (error) {
      // Swallowed into a "Try again" screen, so this log is the only trace it left.
      Sentry.logger.error('Onboarding plan generation failed', {
        reason: String(error),
        retry: started.current,
      });
      setFailed(true);
    }
  }, [router]);

  useEffect(() => {
    const id = setInterval(() => setI((n) => n + 1), TICK);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // one paid generation per visit, even through a Fast Refresh
    if (started.current) return;
    started.current = true;
    generate();
  }, [generate]);

  // landed here without answers (deep link, or a reload) — start over
  if (!answers.gender) {
    return <Redirect href={{ pathname: '/onboarding/[step]', params: { step: 'gender' } }} />;
  }

  return (
    <View className="flex-1 items-center justify-center bg-[#FEFDFD] px-[40px]">
      <StatusBar style="dark" />
      <Image
        source={require('@/assets/images/logo-mark.png')}
        style={{ width: 84, height: 96 }}
        contentFit="contain"
      />
      <Text className="mt-[34px] text-center text-[28px] font-bold leading-[34px] text-black">
        {failed ? "That didn't work" : 'Building your plan'}
      </Text>

      {failed ? (
        <>
          <Text className="mt-[8px] text-center text-[16px] leading-[22px] text-[#4A4A52]">
            We couldn&apos;t build your plan just now. Check your connection and try again.
          </Text>
          <Pressable
            onPress={generate}
            className="mt-[24px] h-[48px] items-center justify-center rounded-full bg-black px-[30px] active:opacity-90">
            <Text className="text-[16px] font-semibold text-white">Try again</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text className="mt-[8px] text-center text-[16px] leading-[22px] text-[#4A4A52]">
            {LINES[Math.min(i, LINES.length - 1)]}
          </Text>
          <View className="mt-[30px] h-[5px] w-[210px] overflow-hidden rounded-full bg-[#E8E8EA]">
            <View
              className="h-full rounded-full bg-black"
              style={{ width: `${Math.min(95, ((i + 1) / LINES.length) * 95)}%` }}
            />
          </View>
        </>
      )}
    </View>
  );
}
