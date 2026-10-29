import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle } from '@expo/ui/swift-ui/modifiers';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { OnboardingScreen, OptionCard, RulerPicker } from '@/components/onboarding';
import { answers, stepIndex, steps } from '@/onboarding/steps';

const YEAR = 31557600000;

export default function OnboardingStep() {
  const { step: key } = useLocalSearchParams<{ step: string }>();
  const router = useRouter();
  const index = stepIndex(key);
  const step = steps[index];
  const store = answers as Record<string, string | number | undefined>;
  const [value, setValue] = useState(() => (step ? store[step.field] : undefined));

  if (!step) return <Redirect href="/" />;

  const commit = (v: string | number) => {
    setValue(v);
    store[step.field] = v;
  };

  const next = steps[index + 1];
  const shell = {
    progress: (index + 1) / steps.length,
    title: step.title,
    subtitle: step.subtitle,
    disabled: value === undefined,
    onNext: () =>
      next
        ? router.push({ pathname: '/onboarding/[step]', params: { step: next.key } })
        : router.push('/onboarding/building'),
  };

  if (step.kind === 'cards') {
    return (
      <OnboardingScreen {...shell}>
        <View className="mt-[38px] gap-[10px] px-[26px]">
          {step.options.map((o) => (
            <OptionCard
              key={o.value}
              title={o.title}
              subtitle={o.subtitle}
              icon={o.icon}
              glyph={o.glyph}
              tall={step.tall}
              selected={value === o.value}
              onPress={() => commit(o.value)}
            />
          ))}
        </View>
      </OnboardingScreen>
    );
  }

  if (step.kind === 'date') {
    return (
      <OnboardingScreen {...shell}>
        <View className="mt-[20px] px-[26px]">
          <Host matchContents>
            <DatePicker
              modifiers={[datePickerStyle('wheel')]}
              selection={
                typeof value === 'string' ? new Date(value) : new Date(Date.now() - 25 * YEAR)
              }
              displayedComponents={['date']}
              range={{ end: new Date(Date.now() - 18 * YEAR) }}
              onDateChange={(d) => commit(d.toISOString().slice(0, 10))}
            />
          </Host>
        </View>
      </OnboardingScreen>
    );
  }

  const current = typeof value === 'number' ? value : step.min;
  const note = step.note?.(current);
  return (
    <OnboardingScreen {...shell} disabled={false}>
      <View className="mt-[30px]">
        <RulerPicker
          value={current}
          onChange={commit}
          min={step.min}
          max={step.max}
          increment={step.increment}
          decimals={step.decimals}
          labelEvery={step.labelEvery}
          labelDecimals={step.labelDecimals}
          unit={step.unit}
        />
        {note ? (
          <Text className="mt-[28px] px-[40px] text-center text-[14px] leading-[19px] text-[#8A6D2F]">
            {note}
          </Text>
        ) : null}
      </View>
    </OnboardingScreen>
  );
}
