import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Ring } from "@/components/ring";
import { StreakSheet } from "@/components/streak-sheet";
import { MACROS } from "@/constants/macros";
import { useMeals, useProfile } from "@/lib/api";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const THUMB = 62;

/**
 * The native tab bar floats over the content and `NativeTabs` exposes no height hook,
 * so the last meal card sits underneath it. These are the stock bar heights.
 *
 * ponytail: replace with a measured value if expo-router ever ships one.
 */
const TAB_BAR = Platform.select({ ios: 49, default: 80 });

/**
 * ImageKit resizes at the edge, so the phone pulls a ~10KB square instead of the ~2MB
 * original the camera uploaded. `q-70` is invisible at this size; the default crop
 * keeps the aspect ratio and centre-crops.
 */
const thumbnail = (url: string, pt: number) => `${url}?tr=w-${pt * 3},h-${pt * 3},q-70`;

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Local calendar date, not `toISOString()` — that would shift the day west of UTC. */
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// A4: meal type is inferred from the clock, never asked
const mealType = (d: Date) => {
  const h = d.getHours();
  return h < 11 ? "Breakfast" : h < 16 ? "Lunch" : h < 21 ? "Dinner" : "Snack";
};

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const today = midnight(new Date());
  const [selected, setSelected] = useState(today);
  const [showStreak, setShowStreak] = useState(false);

  // Two past weeks plus the current one, a week per screen. Future days stay disabled,
  // so the strip stops at this Saturday.
  const { width } = useWindowDimensions();
  const strip = useRef<ScrollView>(null);
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() - 14);
  const days = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  // AI-generated during onboarding, stored on the user row. The tabs' gate
  // guarantees these are set before this screen renders.
  const { data: profile } = useProfile();
  const plan = {
    calories: profile?.dailyCalories ?? 0,
    protein: profile?.proteinG ?? 0,
    carbs: profile?.carbsG ?? 0,
    fat: profile?.fatG ?? 0,
  };

  const isToday = selected === today;
  const selectedDate = new Date(selected);

  // ponytail: streak in SQL still to come — the pill reads 0 until then.
  const streak = 0;

  // Flattened to the shape the card renders: `loggedAt` parsed, macros under the MACROS
  // keys, and the nulls an `analyzing` row still carries resolved to 0.
  const { data = [] } = useMeals(isoDate(selectedDate));
  const meals = data.map((m) => ({
    ...m,
    loggedAt: new Date(m.loggedAt),
    calories: m.calories ?? 0,
    protein: m.proteinG ?? 0,
    carbs: m.carbsG ?? 0,
    fat: m.fatG ?? 0,
  }));

  const eaten = meals.reduce(
    (t, m) =>
      m.status !== "completed" // don't count a meal the model hasn't read yet
        ? t
        : {
            calories: t.calories + m.calories,
            protein: t.protein + m.protein,
            carbs: t.carbs + m.carbs,
            fat: t.fat + m.fat,
          },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return (
    <View collapsable={false} className="flex-1 bg-[#FEFDFD]" style={{ paddingTop: insets.top }}>
      <StatusBar style="dark" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR + 28 }}
      >
        <View className="mt-[10px] flex-row items-center px-[22px]">
          <Image
            source={require("@/assets/images/logo-mark.png")}
            style={{ width: 26, height: 30 }}
            contentFit="contain"
          />
          <Text className="ml-[8px] text-[26px] font-bold tracking-[-0.6px] text-black">
            Bulky AI
          </Text>
          <View className="flex-1" />
          <Pressable
            onPress={() => setShowStreak(true)}
            className="flex-row items-center rounded-full border border-[#EDEDEF] bg-white px-[14px] py-[7px] active:opacity-70"
          >
            <SymbolView name="flame.fill" size={16} tintColor="#F4685C" />
            <Text className="ml-[6px] text-[15px] font-bold text-black">{streak}</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={strip}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Fixed 21 days, so this fires once on mount and lands on the current week.
          onContentSizeChange={() => strip.current?.scrollToEnd({ animated: false })}
          snapToInterval={width}
          decelerationRate="fast"
          className="mt-[18px] flex-grow-0"
        >
          {days.map((d) => {
            const time = midnight(d);
            const isSelected = time === selected;
            const isFuture = time > today;
            return (
              <Pressable
                key={time}
                disabled={isFuture}
                onPress={() => setSelected(time)}
                className="items-center"
                style={{ width: width / 7 }}
              >
                <View
                  className="w-[46px] items-center rounded-[16px] py-[7px]"
                  style={
                    isSelected
                      ? { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EDEDEF" }
                      : undefined
                  }
                >
                  <Text
                    className="text-[13px] font-medium"
                    style={{ color: isFuture ? "#C8C8CC" : isSelected ? "#000000" : "#8A8A90" }}
                  >
                    {WEEKDAYS[d.getDay()]}
                  </Text>
                  <View
                    className="mt-[6px] h-[36px] w-[36px] items-center justify-center rounded-full"
                    style={{
                      borderWidth: 1.5,
                      borderStyle: isSelected || isFuture ? "solid" : "dashed",
                      borderColor: isFuture ? "#EDEDEF" : isSelected ? "#000000" : "#D3D3D8",
                    }}
                  >
                    <Text
                      className="text-[16px] font-semibold"
                      style={{ color: isFuture ? "#C8C8CC" : "#000000" }}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="mx-[22px] mt-[20px] flex-row items-center rounded-[22px] border border-[#EDEDEF] bg-white px-[22px] py-[22px]">
          <View className="flex-1">
            <Text className="text-[46px] font-bold leading-[52px] tracking-[-1px] text-black">
              {Math.max(0, plan.calories - eaten.calories).toLocaleString("en-US")}
            </Text>
            <Text className="mt-[2px] text-[16px] leading-[21px] text-[#6E6E78]">
              Calories left
            </Text>
          </View>
          <Ring size={96} stroke={10} progress={eaten.calories / plan.calories}>
            <SymbolView name="flame.fill" size={30} tintColor="#000000" />
          </Ring>
        </View>

        <View className="mt-[12px] flex-row gap-[10px] px-[22px]">
          {MACROS.map((macro) => {
            const target = plan[macro.key];
            const left = Math.max(0, target - eaten[macro.key]);
            return (
              <View
                key={macro.key}
                className="flex-1 items-start rounded-[20px] border border-[#EDEDEF] bg-white px-[16px] py-[16px]"
              >
                <Text className="text-[22px] font-bold leading-[27px] tracking-[-0.4px] text-black">
                  {left}g
                </Text>
                <Text className="mt-[1px] text-[13px] leading-[18px] text-[#6E6E78]">
                  {macro.label} left
                </Text>
                <View className="mt-[14px] w-full items-center">
                  <Ring
                    size={58}
                    stroke={7}
                    progress={eaten[macro.key] / target}
                    color={macro.color}
                  >
                    <SymbolView name={macro.icon} size={20} tintColor={macro.color} />
                  </Ring>
                </View>
              </View>
            );
          })}
        </View>

        <Text className="ml-[22px] mt-[28px] text-[22px] font-bold tracking-[-0.4px] text-black">
          {isToday
            ? "Today's meals"
            : selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
        </Text>

        {meals.length ? (
          <View className="mt-[12px] gap-[10px] px-[22px]">
            {meals.map((meal) => (
              // ponytail: tapping opens meal detail once that screen exists (PLAN phase 6)
              <View
                key={meal.id}
                className="flex-row items-center rounded-[18px] border border-[#EDEDEF] bg-white p-[10px]"
              >
                <Image
                  source={{ uri: thumbnail(meal.imageUrl, THUMB) }}
                  style={{ width: THUMB, height: THUMB, borderRadius: 14 }}
                  contentFit="cover"
                  transition={200}
                />
                <View className="ml-[14px] flex-1">
                  <Text numberOfLines={1} className="text-[16px] font-semibold text-black">
                    {meal.status === "completed"
                      ? meal.name
                      : meal.status === "analyzing"
                        ? "Analyzing…"
                        : meal.errorReason === "not_food"
                          ? "Not food"
                          : "Couldn't read this one"}
                  </Text>
                  <Text className="mt-[2px] text-[13px] text-[#8A8A90]">
                    {meal.loggedAt.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    · {mealType(meal.loggedAt)}
                  </Text>
                  {meal.status === "completed" ? (
                    <View className="mt-[6px] flex-row gap-[10px]">
                      {MACROS.map((macro) => (
                        <View key={macro.key} className="flex-row items-center">
                          <View
                            className="h-[7px] w-[7px] rounded-full"
                            style={{ backgroundColor: macro.color }}
                          />
                          <Text className="ml-[4px] text-[12px] text-[#6E6E78]">
                            {meal[macro.key]}g
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
                {meal.status === "completed" ? (
                  <Text className="ml-[10px] mr-[6px] text-[16px] font-bold text-black">
                    {meal.calories}
                  </Text>
                ) : meal.status === "analyzing" ? (
                  <ActivityIndicator className="ml-[10px] mr-[6px]" color="#8A8A90" />
                ) : (
                  <SymbolView
                    name="exclamationmark.triangle.fill"
                    size={18}
                    tintColor="#D8D8DE"
                    style={{ marginLeft: 10, marginRight: 6 }}
                  />
                )}
              </View>
            ))}
          </View>
        ) : (
          <View className="mx-[22px] mt-[12px] items-center rounded-[20px] bg-[#F3F3F7] px-[18px] py-[22px]">
            <View className="w-full flex-row items-center rounded-[16px] bg-white p-[12px]">
              <View className="h-[46px] w-[46px] items-center justify-center rounded-[12px] bg-[#F3F3F7]">
                <SymbolView name="fork.knife" size={22} tintColor="#B4B4BC" />
              </View>
              <View className="ml-[12px] flex-1 gap-[7px]">
                <View className="h-[9px] w-full rounded-full bg-[#ECECEF]" />
                <View className="h-[9px] w-[60%] rounded-full bg-[#ECECEF]" />
              </View>
            </View>
            <Text className="mt-[16px] text-center text-[15px] leading-[20px] text-[#6E6E78]">
              {isToday
                ? "Snap your first meal of the day and the numbers land here."
                : "No meals logged on this day."}
            </Text>
          </View>
        )}
      </ScrollView>

      {showStreak ? <StreakSheet streak={streak} onClose={() => setShowStreak(false)} /> : null}
    </View>
  );
}
