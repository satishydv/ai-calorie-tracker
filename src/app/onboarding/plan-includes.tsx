import { useAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSaveProfile } from '@/lib/api';
import { answers } from '@/onboarding/steps';

const FEATURES: [SFSymbol, string, string][] = [
  ['target', 'Calorie Tracking', 'Track effortlessly and stay on target'],
  ['viewfinder', 'AI Food Scanner', 'Snap a meal, get instant nutrition'],
  ['chart.pie', 'Macro Breakdown', 'Protein, carbs and fat for every meal'],
  ['chart.bar', 'Progress Tracking', 'See your progress and stay motivated'],
  ['flame', 'Daily Streaks', 'Keep your logging streak alive'],
];

export default function PlanIncludes() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const save = useSaveProfile();
  const target = answers.targetWeightKg?.toFixed(1);

  // someone who redid onboarding is already signed in — no reason to ask again
  const onContinue = () =>
    isSignedIn
      ? save.mutate(undefined, { onSuccess: () => router.replace('/home') })
      : router.push('/sign-in');

  return (
    <View
      className="flex-1 bg-[#FEFDFD]"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <StatusBar style="dark" />

      <View className="mt-[4px] h-[24px] flex-row items-center px-[26px]">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <SymbolView name="arrow.left" size={22} weight="medium" tintColor="#000000" />
        </Pressable>
        <View className="ml-[26px] flex-row gap-[10px]">
          {Array.from({ length: 4 }, (_, i) => (
            <View key={i} className="h-[5px] w-[34px] rounded-full bg-black" />
          ))}
        </View>
      </View>

      <Text className="ml-[26px] mt-[26px] w-[290px] text-[32px] font-bold leading-[38px] text-black">
        Here&apos;s what your plan includes
      </Text>
      <Text className="ml-[26px] mt-[6px] w-[230px] text-[17px] leading-[23px] text-[#4A4A52]">
        Your personalized plan to help you reach {target} kg.
      </Text>

      <View className="mt-[30px] gap-[10px] px-[26px]">
        {FEATURES.map(([icon, title, subtitle]) => (
          <View
            key={title}
            className="h-[70px] flex-row items-center rounded-[14px] border border-[#EDEDEF] bg-white px-[22px]">
            <View className="w-[32px] items-center">
              <SymbolView name={icon} size={26} weight="regular" tintColor="#000000" />
            </View>
            <View className="ml-[20px] flex-1">
              <Text className="text-[16px] font-semibold leading-[21px] text-black">{title}</Text>
              <Text className="mt-[2px] text-[14px] leading-[19px] text-[#6E6E78]">{subtitle}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="flex-1" />

      {save.isError ? (
        <Text className="mx-[26px] mb-[10px] text-center text-[14px] leading-[19px] text-[#C4453C]">
          We couldn&apos;t save your plan. Please try again.
        </Text>
      ) : null}

      <Pressable
        onPress={onContinue}
        disabled={save.isPending}
        className={`mx-[26px] mb-[16px] h-[50px] items-center justify-center rounded-[15px] bg-black ${
          save.isPending ? 'opacity-60' : 'active:opacity-90'
        }`}>
        {save.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-[17px] font-semibold text-white">Continue</Text>
        )}
      </Pressable>
    </View>
  );
}
