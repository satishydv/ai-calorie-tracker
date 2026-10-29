import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useProfile } from '@/lib/api';

export default function AppLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { data: profile, isPending, isError, refetch } = useProfile();

  // one guard for every tab, instead of one per screen
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/" />;
  if (isPending) return <Centered />;

  // don't bounce someone into onboarding just because the network blinked
  if (isError) {
    return (
      <Centered>
        <Text className="text-center text-[16px] leading-[22px] text-[#4A4A52]">
          We couldn&apos;t load your profile.
        </Text>
        <Pressable
          onPress={() => refetch()}
          className="mt-[16px] h-[44px] items-center justify-center rounded-full bg-black px-[26px] active:opacity-90">
          <Text className="text-[15px] font-semibold text-white">Try again</Text>
        </Pressable>
      </Centered>
    );
  }

  // no row at all, or a row that never finished the questionnaire: everyone gets
  // targets before they get the app.
  if (!profile?.onboardingCompletedAt) {
    return <Redirect href={{ pathname: '/onboarding/[step]', params: { step: 'gender' } }} />;
  }

  return (
    <NativeTabs
      backgroundColor="#FEFDFD"
      tintColor="#000000"
      iconColor={{ default: '#9A9AA0', selected: '#000000' }}
      labelStyle={{ default: { color: '#9A9AA0' }, selected: { color: '#000000' } }}
      disableTransparentOnScrollEdge>
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          md={{ default: 'home', selected: 'home_filled' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="camera">
        <NativeTabs.Trigger.Label>Scan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="camera.fill" md="photo_camera" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function Centered({ children }: { children?: React.ReactNode }) {
  return (
    <View className="flex-1 items-center justify-center bg-[#FEFDFD] px-[40px]">
      {children ?? <ActivityIndicator color="#000000" />}
    </View>
  );
}
