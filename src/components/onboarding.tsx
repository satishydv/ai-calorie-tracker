import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Pressable, ScrollView, Text, View, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SEGMENTS = 4;

export function OnboardingScreen({
  progress,
  title,
  subtitle,
  cta = 'Next',
  onNext,
  disabled,
  header,
  children,
}: {
  progress: number; // 0..1
  title?: string;
  subtitle?: string;
  cta?: string;
  onNext: () => void;
  disabled?: boolean;
  header?: ReactNode;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const filled = 1 + Math.floor(progress * (SEGMENTS - 1));

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
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <View
              key={i}
              className={`h-[5px] w-[34px] rounded-full ${i < filled ? 'bg-black' : 'bg-[#D9D9DA]'}`}
            />
          ))}
        </View>
      </View>

      {title ? (
        <Text className="ml-[26px] mt-[26px] w-[290px] text-[32px] font-bold leading-[38px] text-black">
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text className="ml-[26px] mt-[6px] w-[264px] text-[17px] leading-[23px] text-[#4A4A52]">
          {subtitle}
        </Text>
      ) : null}
      {header}

      <View className="flex-1">{children}</View>

      <Pressable
        onPress={onNext}
        disabled={disabled}
        className={`mx-[26px] mb-[16px] h-[50px] items-center justify-center rounded-[15px] ${
          disabled ? 'bg-[#C8C8CC]' : 'bg-black active:opacity-90'
        }`}>
        <Text className="text-[17px] font-semibold text-white">{cta}</Text>
      </Pressable>
    </View>
  );
}

export function OptionCard({
  title,
  subtitle,
  icon,
  glyph,
  selected,
  tall,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon?: SFSymbol;
  glyph?: string;
  selected: boolean;
  tall?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: tall ? 96 : 70,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? '#000000' : '#EDEDEF',
      }}
      className="flex-row items-center rounded-[14px] bg-white px-[22px] py-[13px]">
      <View className={`items-center ${tall ? 'w-[48px]' : 'w-[32px]'}`}>
        {glyph ? (
          <Text className="text-[46px] leading-[54px] text-black">{glyph}</Text>
        ) : icon ? (
          <SymbolView name={icon} size={tall ? 36 : 29} weight="regular" tintColor="#000000" />
        ) : null}
      </View>
      <View className="ml-[20px] flex-1">
        <Text className="text-[16px] font-semibold leading-[21px] text-black">{title}</Text>
        {subtitle ? (
          <Text className="mt-[2px] text-[14px] leading-[19px] text-[#6E6E78]">{subtitle}</Text>
        ) : null}
      </View>
      {selected ? (
        <View className="h-[24px] w-[24px] items-center justify-center rounded-full bg-black">
          <SymbolView name="checkmark" size={13} weight="bold" tintColor="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );
}

const ITEM = 14;
const VISIBLE = 16;
const FADE = [1, 0.9, 0.72, 0.5, 0.3, 0.14];
const fadeStyle = (top: number, opacity: number) =>
  ({ position: 'absolute', left: 0, right: 0, top, height: 7, opacity, backgroundColor: '#FEFDFD' }) as const;

export function RulerPicker({
  value,
  onChange,
  min,
  max,
  increment,
  decimals = 0,
  unit,
  labelEvery = 5,
  labelDecimals = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  increment: number;
  decimals?: number;
  unit: string;
  labelEvery?: number;
  labelDecimals?: number;
}) {
  const count = Math.round((max - min) / increment) + 1;
  const height = ITEM * VISIBLE;
  const pad = height / 2 - ITEM / 2;
  const last = useRef(value);
  const centerIndex = Math.round((max - value) / increment);

  // rendered high → low, so the ruler reads like a tape measure
  const onScroll = (e: NativeSyntheticEvent<{ contentOffset: { y: number } }>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM);
    const v = Math.min(max, Math.max(min, max - i * increment));
    const rounded = Number(v.toFixed(decimals + 1));
    if (rounded !== last.current) {
      last.current = rounded;
      onChange(rounded);
    }
  };

  return (
    <View>
      <View className="flex-row items-end justify-center">
        <Text className="text-[42px] font-bold leading-[46px] text-black">
          {value.toFixed(decimals)}
        </Text>
        <Text className="mb-[7px] ml-[8px] text-[17px] leading-[20px] text-[#6E6E78]">{unit}</Text>
      </View>

      <View className="mt-[26px]" style={{ height }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          contentOffset={{ x: 0, y: Math.round((max - value) / increment) * ITEM }}
          contentContainerStyle={{ paddingVertical: pad }}>
          {Array.from({ length: count }, (_, i) => {
            const v = Number((max - i * increment).toFixed(decimals + 1));
            const major = i % labelEvery === 0;
            // a label within one row of the centre would collide with the selected one
            const showLabel = major && Math.abs(i - centerIndex) > 1;
            return (
              <View key={i} className="justify-center" style={{ height: ITEM }}>
                <View
                  className="absolute left-1/2 rounded-full"
                  style={{
                    marginLeft: major ? -13 : -9,
                    width: major ? 26 : 18,
                    height: major ? 2 : 1.5,
                    backgroundColor: major ? '#C9C9CE' : '#DEDEE2',
                  }}
                />
                {showLabel ? (
                  <Text
                    className="absolute text-[17px] leading-[20px] text-[#9A9AA0]"
                    style={{ left: '50%', marginLeft: 94, top: -3 }}>
                    {v.toFixed(labelDecimals)}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        {/* stepped fade so the ruler dissolves at both ends, like the design */}
        {FADE.map((o, i) => (
          <View key={`t${i}`} pointerEvents="none" style={fadeStyle(i * 7, o)} />
        ))}
        {FADE.map((o, i) => (
          <View key={`b${i}`} pointerEvents="none" style={fadeStyle(height - (i + 1) * 7, o)} />
        ))}

        <View pointerEvents="none" className="absolute left-0 right-0" style={{ top: pad }}>
          <View className="h-[14px] justify-center">
            <View
              className="absolute h-[2px] bg-black"
              style={{ left: '50%', marginLeft: -87, width: 174 }}
            />
            <View
              className="absolute h-[26px] w-[26px] rounded-full bg-black"
              style={{ left: '50%', marginLeft: -13 }}
            />
            <Text
              className="absolute text-[17px] font-semibold leading-[20px] text-black"
              style={{ left: '50%', marginLeft: 94 }}>
              {value % 1 === 0 ? String(value) : value.toFixed(decimals)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
