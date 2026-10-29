import { SymbolView } from 'expo-symbols';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const line = (streak: number) =>
  streak === 0
    ? 'Log one meal today and the fire starts burning.'
    : streak < 3
      ? 'The first days are the hardest. You are past them.'
      : streak < 7
        ? 'Momentum is real. Do not let it cool off.'
        : 'A week strong. This is who you are now.';

export function StreakSheet({ streak, onClose }: { streak: number; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    // fade = the dim overlay fades in; the sheet itself slides up over it
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Animated.View entering={SlideInDown.duration(320)}>
          <Pressable
            className="rounded-t-[28px] bg-[#FEFDFD] px-[26px] pt-[26px]"
            style={{ paddingBottom: insets.bottom + 22 }}>
            <View className="h-[5px] w-[42px] self-center rounded-full bg-[#E2E2E7]" />

            <View className="mt-[24px] items-center">
              <View className="h-[86px] w-[86px] items-center justify-center rounded-full bg-[#FDECEA]">
                <SymbolView name="flame.fill" size={42} tintColor="#F4685C" />
              </View>
              <Text className="mt-[16px] text-[46px] font-bold leading-[52px] tracking-[-1px] text-black">
                {streak}
              </Text>
              <Text className="mt-[2px] text-[16px] text-[#6E6E78]">day streak</Text>
              <Text className="mt-[14px] text-center text-[16px] leading-[22px] text-[#6E6E78]">
                {line(streak)}
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              className="mt-[26px] h-[54px] items-center justify-center rounded-full bg-black active:opacity-90">
              <Text className="text-[16px] font-semibold text-white">Let&apos;s go</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
