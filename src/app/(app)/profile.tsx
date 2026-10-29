import { useAuth, useUser } from '@clerk/expo';
import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { openBrowserAsync } from 'expo-web-browser';
import { type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { deleteAccount } from '@/lib/api';

// Cloudflare Pages serves these extensionless — /privacy, not /privacy.html.
//
// ponytail: this is the draft deployment. Both pages still carry unfilled
// placeholders and their reviewer notes, and are marked noindex. Repoint at the
// production domain before store submission — Apple rejects an account-deleting
// app without a reachable privacy policy.
const LEGAL_ORIGIN = 'https://bulky-ai-legal-demo.pages.dev';
const PRIVACY_URL = `${LEGAL_ORIGIN}/privacy`;
const TERMS_URL = `${LEGAL_ORIGIN}/terms`;

const soon = () => Alert.alert('Coming soon');

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text className="ml-[26px] mb-[8px] mt-[26px] text-[15px] font-medium text-[#8A8A90]">
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
  value,
  onPress,
  tint = '#000000',
  divider,
}: {
  icon: SFSymbol;
  label: string;
  value?: string;
  onPress?: () => void;
  tint?: string;
  divider?: boolean;
}) {
  const body = (
    <View className="flex-row items-center px-[18px] py-[15px]">
      <SymbolView name={icon} size={21} tintColor={tint} style={{ width: 24, height: 24 }} />
      <Text className="ml-[12px] flex-1 text-[17px]" style={{ color: tint }} numberOfLines={1}>
        {label}
      </Text>
      {value ? <Text className="text-[16px] text-[#8A8A90]">{value}</Text> : null}
      {onPress ? (
        <SymbolView
          name="chevron.right"
          size={14}
          tintColor="#C2C2C9"
          style={{ width: 16, height: 16, marginLeft: 6 }}
        />
      ) : null}
    </View>
  );

  return (
    <View style={divider ? { borderTopWidth: 1, borderTopColor: '#F1F1F3' } : undefined}>
      {onPress ? (
        <Pressable onPress={onPress} className="active:bg-[#F7F7F9]">
          {body}
        </Pressable>
      ) : (
        body
      )}
    </View>
  );
}

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();

  const memberSince = user?.createdAt
    ? user.createdAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'This permanently removes your profile, your targets and every meal you have logged. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount(await getToken()); // row + meals + Clerk user
              queryClient.clear(); // the next account must never see this one's data
              await signOut().catch(() => {}); // the session is already dead server-side
            } catch (error) {
              Sentry.logger.error('Account deletion failed', { reason: String(error) });
              Alert.alert('We couldn’t delete your account', 'Please try again in a moment.');
            }
          },
        },
      ],
    );

  return (
    <View collapsable={false} className="flex-1 bg-[#F4F4F6]" style={{ paddingTop: insets.top }}>
      <StatusBar style="dark" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + BottomTabInset + 28 }}>
        <Text className="ml-[22px] mt-[10px] text-[34px] font-bold tracking-[-0.8px] text-black">
          Profile
        </Text>

        <View className="mx-[18px] mt-[18px] flex-row items-center rounded-[20px] bg-white p-[16px]">
          {user?.imageUrl ? (
            <Image
              source={{ uri: user.imageUrl }}
              style={{ width: 56, height: 56, borderRadius: 28 }}
              contentFit="cover"
            />
          ) : (
            <View className="h-[56px] w-[56px] items-center justify-center rounded-full bg-[#F1F1F6]">
              <SymbolView name="person.fill" size={26} tintColor="#B4B4BC" />
            </View>
          )}
          <View className="ml-[14px] flex-1">
            <Text numberOfLines={1} className="text-[20px] font-bold text-black">
              {user?.fullName ?? user?.firstName ?? 'Your profile'}
            </Text>
            <Text numberOfLines={1} className="mt-[2px] text-[15px] text-[#8A8A90]">
              {user?.primaryEmailAddress?.emailAddress ?? 'Signed in'}
            </Text>
          </View>
        </View>

        <SectionTitle>Account</SectionTitle>
        <Card>
          <Row icon="calendar" label="Member since" value={memberSince} />
          {/* ponytail: UI only — each of these gets a screen when there's something to
              put on it. `soon` is what tells a placeholder row apart from a live one. */}
          <Row divider icon="person.text.rectangle" label="Personal Details" onPress={soon} />
          <Row divider icon="gearshape" label="Preferences" onPress={soon} />
          <Row divider icon="globe" label="Language" onPress={soon} />
          <Row divider icon="person.2.badge.plus" label="Upgrade to Family Plan" onPress={soon} />
        </Card>

        <SectionTitle>About</SectionTitle>
        <Card>
          <Row
            icon="hand.raised"
            label="Privacy Policy"
            onPress={() => openBrowserAsync(PRIVACY_URL)}
          />
          <Row
            divider
            icon="doc.text"
            label="Terms of Service"
            onPress={() => openBrowserAsync(TERMS_URL)}
          />
          {/* ponytail: temporary — delete with src/app/debug-sentry.tsx once Sentry is verified */}
          <Row
            divider
            icon="ladybug"
            label="Sentry test bench"
            onPress={() => router.push('/debug-sentry')}
          />
        </Card>

        <SectionTitle>Support</SectionTitle>
        <Card>
          {/* Sentry's own widget — the report arrives with the user id, the session
              replay and the last events already attached. */}
          <Row
            icon="bubble.left.and.text.bubble.right"
            label="Send feedback"
            onPress={() => Sentry.showFeedbackWidget()}
          />
        </Card>

        <View className="mt-[26px]">
          <Card>
            <Row
              icon="rectangle.portrait.and.arrow.right"
              label="Sign out"
              onPress={async () => {
                await signOut();
                queryClient.clear(); // never show the next account this one's targets
              }}
            />
          </Card>
        </View>

        <View className="mt-[10px]">
          <Card>
            <Row icon="trash" label="Delete your account" tint="#E5484D" onPress={confirmDelete} />
          </Card>
        </View>
        <Text className="mt-[10px] px-[26px] text-[13px] leading-[18px] text-[#A0A0A8]">
          Deleting your account removes your profile and meal history for good.
        </Text>
      </ScrollView>
    </View>
  );
}
