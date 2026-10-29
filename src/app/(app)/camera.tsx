import * as Sentry from '@sentry/react-native';
import { useRealtimeRun } from '@trigger.dev/react-hooks';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MACROS } from '@/constants/macros';
import { useLogMeal, type LoggedMeal } from '@/lib/api';
import type { analyzeMeal } from '@/trigger/analyze-meal';

type Shot = { uri: string; base64: string };

export default function Camera() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const logMeal = useLogMeal();

  // Native tabs render every tab eagerly — without this the camera holds the sensor
  // open (and drains the battery) while the user is sitting on Home.
  const isFocused = useIsFocused();

  const reset = () => {
    setShot(null);
    logMeal.reset();
  };

  const capture = async () => {
    // ponytail: full-resolution JPEG at quality 0.5, base64'd over the wire — roughly
    // 2MB per scan. Add expo-image-manipulator to downscale first if that ever bites.
    const picture = await cameraRef.current?.takePictureAsync({ quality: 0.5, base64: true });
    if (picture?.base64) setShot({ uri: picture.uri, base64: picture.base64 });
  };

  // No permission gate: the system picker hands back only what the user taps, so iOS
  // and Android both launch it without one.
  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });

    const asset = result.assets?.[0];
    if (asset?.base64) setShot({ uri: asset.uri, base64: asset.base64 });
  };

  const galleryButton = (
    <Pressable
      onPress={pickFromGallery}
      className="h-[52px] w-[52px] items-center justify-center rounded-full bg-[#1E1E23] active:opacity-70">
      <SymbolView name="photo.on.rectangle" size={22} tintColor="#FFFFFF" />
    </Pressable>
  );

  if (!permission) return <Screen />; // permission state still loading

  if (!permission.granted) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-[40px]">
          <View className="h-[76px] w-[76px] items-center justify-center rounded-full bg-[#1E1E23]">
            <SymbolView name="camera.fill" size={32} tintColor="#FFFFFF" />
          </View>
          <Text className="mt-[22px] text-center text-[22px] font-bold text-white">
            Camera access
          </Text>
          <Text className="mt-[8px] text-center text-[15px] leading-[21px] text-[#9A9AA0]">
            Bulky AI reads your meals from a photo. Nothing leaves your phone until you take one.
          </Text>
          <Pressable
            onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
            className="mt-[24px] h-[52px] items-center justify-center rounded-full bg-white px-[34px] active:opacity-90">
            <Text className="text-[16px] font-semibold text-black">
              {permission.canAskAgain ? 'Allow camera' : 'Open Settings'}
            </Text>
          </Pressable>
          {/* The picker needs no permission of its own, so a denied camera doesn't
              have to dead-end the whole screen. */}
          <Pressable onPress={pickFromGallery} className="mt-[16px] p-[8px] active:opacity-70">
            <Text className="text-[15px] font-medium text-[#9A9AA0]">Choose from gallery</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (logMeal.data && shot) {
    return (
      <Screen>
        <Result logged={logMeal.data} uri={shot.uri} onDone={reset} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-1">
        {shot ? (
          <Image source={{ uri: shot.uri }} style={{ flex: 1 }} contentFit="cover" />
        ) : isFocused ? (
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
        ) : null}
      </View>

      <View className="absolute inset-x-0 bottom-0" style={{ paddingBottom: insets.bottom + 26 }}>
        {logMeal.isError ? (
          <Text className="mb-[14px] px-[40px] text-center text-[14px] text-[#FF6B6B]">
            {logMeal.error.message}
          </Text>
        ) : null}

        {shot ? (
          <View className="flex-row items-center justify-center gap-[12px] px-[24px]">
            <Pressable
              onPress={reset}
              disabled={logMeal.isPending}
              className="h-[56px] w-[56px] items-center justify-center rounded-full bg-[#1E1E23] active:opacity-70">
              <SymbolView name="arrow.counterclockwise" size={22} tintColor="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={() => logMeal.mutate(shot.base64)}
              disabled={logMeal.isPending}
              className="h-[56px] flex-1 flex-row items-center justify-center rounded-full bg-white active:opacity-90">
              {logMeal.isPending ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <>
                  <SymbolView name="sparkles" size={18} tintColor="#000000" />
                  <Text className="ml-[8px] text-[17px] font-semibold text-black">
                    Analyze the food
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <View className="items-center">
            <Text className="mb-[18px] text-[15px] text-white/70">
              Fit the whole plate in frame
            </Text>
            {/* Absolute, so the shutter stays centred on the screen rather than on the row */}
            <View className="w-full flex-row items-center justify-center">
              <View className="absolute left-[34px]">{galleryButton}</View>
              <Pressable
                onPress={capture}
                className="h-[76px] w-[76px] items-center justify-center rounded-full border-[4px] border-white/40 active:opacity-70">
                <View className="h-[60px] w-[60px] rounded-full bg-white" />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}

/**
 * The analysis is a Trigger.dev run, watched over Realtime rather than polled.
 * Expo SDK 57 installs `expo/fetch` as the global fetch on native, so the hook's
 * streaming response body works with no polyfill (PLAN.md R1).
 */
function Result({ logged, uri, onDone }: { logged: LoggedMeal; uri: string; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { run, error } = useRealtimeRun<typeof analyzeMeal>(logged.runId, {
    accessToken: logged.publicAccessToken,
    skipColumns: ['payload'], // the payload is just ids; the output is what we render
  });

  const output = run?.output;
  const notFood = output?.status === 'failed';
  const failed =
    !!error ||
    notFood ||
    (!!run &&
      ['FAILED', 'CRASHED', 'CANCELED', 'SYSTEM_FAILURE', 'TIMED_OUT', 'EXPIRED'].includes(
        run.status,
      ));

  // One wide event per scan, at the only point that knows how it ended. The server
  // starts the run but never learns whether the user got a number out of it.
  const startedAt = useRef(0);
  const recorded = useRef(false);
  const settled = output?.status === 'completed' || failed;

  // Stamped in an effect, not at render — the compiler treats `Date.now()` as impure.
  // This component mounts the moment the run starts, so mount time is the run's start.
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (!settled || recorded.current) return; // the hook re-renders on every run update
    recorded.current = true;

    const outcome = notFood ? 'not_food' : failed ? 'failed' : 'completed';
    const record = outcome === 'completed' ? Sentry.logger.info : Sentry.logger.warn;

    record('Meal scan finished', {
      outcome,
      meal_id: logged.meal.id,
      run_id: logged.runId,
      run_status: run?.status ?? 'unknown',
      calories: output?.status === 'completed' ? output.calories : 0,
      duration_ms: Date.now() - startedAt.current,
    });
  }, [settled, failed, notFood, output, run?.status, logged.meal.id, logged.runId]);

  return (
    <View className="flex-1" style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom }}>
      <Image
        source={{ uri }}
        style={{ height: 250, marginHorizontal: 22, borderRadius: 24 }}
        contentFit="cover"
      />

      <View className="flex-1 justify-center px-[22px]">
        {failed ? (
          <View className="items-center">
            <Text className="text-[20px] font-bold text-white">
              {notFood ? "That doesn't look like food" : "We couldn't read that one"}
            </Text>
            <Text className="mt-[8px] text-center text-[15px] leading-[21px] text-[#9A9AA0]">
              Try again with the meal centred and well lit.
            </Text>
          </View>
        ) : output?.status === 'completed' ? (
          <View>
            <Text className="text-center text-[24px] font-bold text-white">{output.name}</Text>
            <Text className="mt-[2px] text-center text-[44px] font-bold leading-[52px] text-white">
              {output.calories}
              <Text className="text-[18px] font-medium text-[#9A9AA0]"> kcal</Text>
            </Text>
            <View className="mt-[22px] flex-row gap-[10px]">
              {MACROS.map((macro) => (
                <View
                  key={macro.key}
                  className="flex-1 items-center rounded-[18px] bg-[#1E1E23] py-[14px]">
                  <SymbolView name={macro.icon} size={18} tintColor={macro.color} />
                  <Text className="mt-[8px] text-[19px] font-bold text-white">
                    {macro.key === 'protein'
                      ? output.proteinG
                      : macro.key === 'carbs'
                        ? output.carbsG
                        : output.fatG}
                    g
                  </Text>
                  <Text className="mt-[1px] text-[13px] text-[#9A9AA0]">{macro.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View className="items-center">
            <ActivityIndicator color="#FFFFFF" />
            <Text className="mt-[14px] text-[17px] font-semibold text-white">
              Analyzing your meal…
            </Text>
            <Text className="mt-[6px] text-[15px] text-[#9A9AA0]">This takes a few seconds.</Text>
          </View>
        )}
      </View>

      <View className="flex-row gap-[12px] px-[22px] pb-[26px]">
        <Pressable
          onPress={onDone}
          className="h-[56px] flex-1 items-center justify-center rounded-full bg-[#1E1E23] active:opacity-70">
          <Text className="text-[16px] font-semibold text-white">Scan another</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            onDone();
            router.push('/home');
          }}
          className="h-[56px] flex-1 items-center justify-center rounded-full bg-white active:opacity-90">
          <Text className="text-[16px] font-semibold text-black">Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Screen({ children }: { children?: React.ReactNode }) {
  return (
    <View collapsable={false} className="flex-1 bg-[#111114]">
      <StatusBar style="light" />
      {children}
    </View>
  );
}
