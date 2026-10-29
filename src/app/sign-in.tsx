import { useAuth, useSSO } from '@clerk/expo';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSaveProfile } from '@/lib/api';
import { draft } from '@/onboarding/steps';

type Provider = 'oauth_apple' | 'oauth_google';

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { startSSOFlow } = useSSO();
  const { isSignedIn } = useAuth();
  const save = useSaveProfile();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  // only show the plan chip to someone who just finished the questionnaire
  const plan = draft.plan;

  /** A plan generated before sign-up is persisted the moment there's an account. */
  const finish = async () => {
    if (draft.plan) await save.mutateAsync();
    router.replace('/home');
  };

  const signInWith = async (strategy: Provider) => {
    if (busy) return;
    setBusy(strategy);
    setError(null);
    try {
      // already signed in means the save failed last time — retry just that
      if (isSignedIn) {
        await finish();
        return;
      }

      const { createdSessionId, setActive, signUp } = await startSSOFlow({ strategy });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        await finish();
        return;
      }
      if (signUp?.status === 'missing_requirements') {
        setError('Your account needs a few more details. Please try the other provider.');
      }
      // otherwise the sheet was dismissed — stay put, say nothing
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error('SSO error:', JSON.stringify(err, null, 2));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View
      className="flex-1 bg-[#FEFDFD]"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <StatusBar style="dark" />

      <View className="mt-[4px] h-[24px] flex-row items-center px-[26px]">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <SymbolView name="arrow.left" size={22} weight="medium" tintColor="#000000" />
        </Pressable>
      </View>

      <View className="flex-1 items-center justify-center px-[26px]">
        <Image
          source={require('@/assets/images/logo-mark.png')}
          style={{ width: 62, height: 72 }}
          contentFit="contain"
        />
        <Text className="mt-[26px] text-center text-[32px] font-bold leading-[38px] text-black">
          Save your plan
        </Text>
        <Text className="mt-[8px] w-[290px] text-center text-[17px] leading-[23px] text-[#4A4A52]">
          Sign in to keep your targets, streak and meal history on every device.
        </Text>

        {plan ? (
          <View className="mt-[26px] flex-row items-center rounded-full border border-[#EDEDEF] bg-white px-[18px] py-[10px]">
            <SymbolView name="checkmark.circle.fill" size={17} tintColor="#000000" />
            <Text className="ml-[8px] text-[15px] leading-[20px] text-[#4A4A52]">
              Your plan is ready —{' '}
              <Text className="font-semibold text-black">
                {plan.calories.toLocaleString('en-US')} cal / day
              </Text>
            </Text>
          </View>
        ) : null}
      </View>

      <View className="px-[26px]">
        {Platform.OS === 'ios' ? (
          <Pressable
            onPress={() => signInWith('oauth_apple')}
            disabled={busy !== null}
            className={`h-[52px] flex-row items-center justify-center rounded-[15px] bg-black ${
              busy ? 'opacity-60' : 'active:opacity-90'
            }`}>
            {busy === 'oauth_apple' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <SymbolView name="apple.logo" size={19} tintColor="#FFFFFF" />
                <Text className="ml-[10px] text-[17px] font-semibold text-white">
                  Continue with Apple
                </Text>
              </>
            )}
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => signInWith('oauth_google')}
          disabled={busy !== null}
          className={`mt-[12px] h-[52px] flex-row items-center justify-center rounded-[15px] border border-[#DEDEE2] bg-white ${
            busy ? 'opacity-60' : 'active:opacity-90'
          }`}>
          {busy === 'oauth_google' ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <>
              <Image
                source={require('@/assets/images/google-g.svg')}
                style={{ width: 19, height: 19 }}
                contentFit="contain"
              />
              <Text className="ml-[10px] text-[17px] font-semibold text-black">
                Continue with Google
              </Text>
            </>
          )}
        </Pressable>

        {error ? (
          <Text className="mt-[12px] text-center text-[14px] leading-[19px] text-[#C4453C]">
            {error}
          </Text>
        ) : null}

        <Text className="mb-[6px] mt-[16px] text-center text-[12px] leading-[17px] text-[#8A8A90]">
          By continuing you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </View>
  );
}
