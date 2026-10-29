import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MACROS } from '@/constants/macros';
import { draft } from '@/onboarding/steps';

// left / top within the 260pt-tall hero, size, rotation, color
const CONFETTI: [number, number, number, number, string][] = [
  [58, 18, 11, 25, '#8B7BE8'],
  [126, 12, 10, -15, '#8FC7EE'],
  [232, 16, 10, 20, '#F0A868'],
  [292, 22, 11, -25, '#7BC98F'],
  [30, 54, 10, -20, '#7BC98F'],
  [86, 62, 9, 35, '#F08A5D'],
  [258, 50, 10, 15, '#F5B841'],
  [318, 66, 10, -30, '#E86A92'],
  [14, 96, 11, 30, '#F5A623'],
  [340, 108, 9, 20, '#E86A92'],
  [46, 132, 10, -25, '#E8C4A0'],
  [300, 130, 10, 25, '#E8C4A0'],
  [22, 176, 10, 15, '#7BC9C9'],
  [330, 182, 10, -20, '#8FC7EE'],
  [64, 208, 11, -30, '#E86A92'],
  [286, 202, 10, 25, '#F5B841'],
];

export default function PlanReveal() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const plan = draft.plan;

  // nothing to reveal without a generated plan — send them back through the flow
  if (!plan) {
    return <Redirect href={{ pathname: '/onboarding/[step]', params: { step: 'gender' } }} />;
  }

  return (
    <View className="flex-1 bg-[#FEFDFD]" style={{ paddingTop: insets.top }}>
      <StatusBar style="dark" />

      {/* the rationale is model-written, so its length varies — scroll rather than squeeze */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}>
        <View className="h-[224px] items-center justify-center">
          {CONFETTI.map(([left, top, size, rotate, backgroundColor], i) => (
            <View
              key={i}
              className="absolute rounded-[2px]"
              style={{
                left,
                top,
                width: size,
                height: size,
                backgroundColor,
                transform: [{ rotate: `${rotate}deg` }],
              }}
            />
          ))}
          <View className="h-[140px] w-[140px] items-center justify-center rounded-full bg-white shadow-sm">
            <Image
              source={require('@/assets/images/logo-mark.png')}
              style={{ width: 80, height: 92 }}
              contentFit="contain"
            />
          </View>
        </View>

        <Text className="px-[26px] text-center text-[22px] font-bold leading-[27px] text-black">
          Your daily calorie target
        </Text>
        <Text className="mt-[8px] px-[34px] text-center text-[16px] leading-[22px] text-[#4A4A52]">
          Based on your info, here&apos;s your personalized target to reach your goal.
        </Text>

        <Text className="mt-[22px] text-center text-[50px] font-bold leading-[56px] text-black">
          {plan.calories.toLocaleString('en-US')}
        </Text>
        <Text className="mt-[2px] text-center text-[19px] leading-[24px] text-[#4A4A52]">
          Calories / day
        </Text>

        <View className="mx-[26px] mt-[22px] flex-row rounded-[16px] border border-[#EDEDEF] bg-white py-[20px]">
          {MACROS.map((macro) => (
            <View key={macro.key} className="flex-1 items-center">
              <SymbolView name={macro.icon} size={28} tintColor={macro.color} />
              <Text className="mt-[12px] text-[18px] font-bold leading-[23px] text-black">
                {plan[macro.key]}g
              </Text>
              <Text className="mt-[1px] text-[14px] leading-[19px] text-[#6E6E78]">
                {macro.label}
              </Text>
            </View>
          ))}
        </View>

        <View className="mx-[26px] mt-[12px] rounded-[16px] bg-[#EFEDFB] p-[16px]">
          <View className="flex-row items-center">
            <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-[#DAD4F7]">
              <SymbolView name="star.fill" size={11} tintColor="#4A3FA8" />
            </View>
            <Text className="ml-[10px] text-[15px] font-bold leading-[20px] text-black">
              How we got here
            </Text>
          </View>
          <Text className="mt-[8px] text-[14px] leading-[20px] text-[#4A4A52]">
            {plan.rationale}
          </Text>
        </View>

        <Text className="mt-[14px] px-[34px] text-center text-[13px] leading-[18px] text-[#8A8A90]">
          You can change your targets any time from your profile.
        </Text>
      </ScrollView>

      {/* pinned: the CTA never depends on how much the model wrote */}
      <View
        className="border-t border-[#F2F2F4] bg-[#FEFDFD] px-[26px] pt-[12px]"
        style={{ paddingBottom: insets.bottom + 12 }}>
        <Pressable
          onPress={() => router.push('/onboarding/plan-includes')}
          className="h-[50px] items-center justify-center rounded-[15px] bg-black active:opacity-90">
          <Text className="text-[17px] font-semibold text-white">Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}
