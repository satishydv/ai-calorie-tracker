import { useAuth } from "@clerk/expo";
import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) return <Redirect href="/home" />;

  return (
    <View
      className="flex-1 bg-[#FEFDFD]"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <StatusBar style="dark" />

      <View className="mt-[22px] flex-row items-center justify-center gap-[10px]">
        <Image
          source={require("@/assets/images/logo-mark.png")}
          style={{ width: 41, height: 47, marginBottom: 8 }}
          contentFit="contain"
        />
        <Text className="text-[32px] font-bold text-black">Bulky AI</Text>
      </View>

      <View className="mt-[13px] items-center">
        <Image
          source={require("@/assets/images/phone-mockup.png")}
          style={{ width: 231, height: 455 }}
          contentFit="contain"
        />
      </View>

      <View className="items-center px-[26px]">
        <Text className="mt-[14px] w-[265px] text-center text-[32px] font-bold leading-[37px] tracking-[-0.4px] text-black">
          Calorie tracking made easy
        </Text>

        <Pressable
          onPress={() =>
            router.push({ pathname: "/onboarding/[step]", params: { step: "gender" } })
          }
          className="mt-[17px] h-[48px] w-full flex-row items-center justify-center rounded-full bg-black active:opacity-90"
        >
          <Text className="text-[16px] font-bold tracking-[-0.4px] text-white">Get Started</Text>
          <Text className="absolute right-[22px] text-[24px] text-white">→</Text>
        </Pressable>

        <Pressable onPress={() => router.push("/sign-in")} hitSlop={12}>
          <Text className="mt-[13px] text-center text-[15px] tracking-[-0.5px] text-[#262626]">
            Already have an account? <Text className="font-bold text-black">Sign In</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
