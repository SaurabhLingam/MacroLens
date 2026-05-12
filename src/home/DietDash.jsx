/**
 * DietDash.jsx — Premium redesign
 * Dark hero, restructured meal cards (SVG no longer bleeds outside),
 * per-meal calorie bars, improved suggested pills, safe bottom bar.
 * All logic, navigation, and AsyncStorage usage preserved exactly.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../components/TextWrapper";
import { C } from "../theme";
import { DEFAULT_MEALS, getTodayKey } from "../utils";

import BreakFastMeal from "../../assets/BreakFastMeal.svg";
import LunchMeal from "../../assets/LunchMeal.svg";
import SnackMeal from "../../assets/SnackMeal.svg";
import DinnerMeal from "../../assets/DinnerMeal.svg";

const { width } = Dimensions.get("window");
const isSmall = width < 380;


const MEAL_META = [
  {
    name: "Breakfast",
    img: BreakFastMeal,
    accent: C.amber,
    bg: "#FFF7ED",
    suggestCal: 400,
  },
  {
    name: "Lunch",
    img: LunchMeal,
    accent: C.blue,
    bg: "#EFF6FF",
    suggestCal: 700,
  },
  {
    name: "Snacks",
    img: SnackMeal,
    accent: C.emerald,
    bg: "#F0FDF4",
    suggestCal: 200,
  },
  {
    name: "Dinner",
    img: DinnerMeal,
    accent: C.purple,
    bg: "#FDF4FF",
    suggestCal: 600,
  },
];

const SUGGESTED = {
  Breakfast: ["Eggs", "Oatmeal", "Banana"],
  Lunch: ["Rice", "Chicken", "Salad"],
  Snacks: ["Apple", "Nuts", "Yogurt"],
  Dinner: ["Fish", "Vegetables", "Soup"],
};

// ─────────────────────────────────────────────────────
const DietDashRN = () => {
  const navigation = useNavigation();
  const [mealTray, setMealTray] = useState({ ...DEFAULT_MEALS });



  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const raw = await AsyncStorage.getItem(getTodayKey());
          if (raw) {
            const data = JSON.parse(raw);
            if (data.meals) setMealTray(data.meals);
          } else {
            setMealTray({ ...DEFAULT_MEALS });
          }
        } catch (e) {console.warn("DietDash load failed:", e);}
      };
      load();
    }, []),
  );

  const handleAddClick = (meal) => {
    navigation.navigate("NutritionAddDiet", { mealType: meal });
  };

  // Total for the day
  const grandTotal = Object.values(mealTray).reduce(
    (sum, items) =>
      sum +
      items.reduce((s, x) => s + (x.calories || 0) * (x.quantity || 1), 0),
    0,
  );

  return (
    <View style={s.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ══ HERO ══════════════════════════════════ */}
        <LinearGradient
          colors={[C.primaryDark, C.primary, C.primaryMid]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 1 }}
          style={s.hero}
        >
          <View style={s.heroTop}>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.75}
            >
              <Feather name="arrow-left" size={18} color="#fff" />
            </TouchableOpacity>
            <View style={s.heroCenter}>
              <Text weight="800" style={s.heroTitle}>
                My Diet Plan
              </Text>
              <Text style={s.heroSub}>Track what you eat today</Text>
            </View>
            <View style={s.heroTotalPill}>
              <Text weight="800" style={s.heroTotalVal}>
                {Math.round(grandTotal)}
              </Text>
              <Text style={s.heroTotalUnit}>kcal</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ══ MEAL CARDS ════════════════════════════ */}
        <View style={s.mealList}>
          {MEAL_META.map((meta) => {
            const items = mealTray[meta.name] || [];
            const totalCalories = items.reduce(
              (sum, item) => sum + (item.calories || 0) * (item.quantity || 1),
              0,
            );
            const hasItems = items.length > 0;

            return (
              <View key={meta.name} style={s.mealCard}>
                {/* Card header */}
                <View style={[s.mealCardHeader, { backgroundColor: meta.bg }]}>
                  <View style={s.mealSvgBox}>
                    <meta.img
                      width={isSmall ? 44 : 52}
                      height={isSmall ? 44 : 52}
                    />
                  </View>
                  <View style={s.mealHeaderText}>
                    <Text weight="700" style={s.mealName}>
                      {meta.name}
                    </Text>
                    {hasItems ? (
                      <Text style={[s.mealCalCount, { color: meta.accent }]}>
                        {Math.round(totalCalories)} kcal · {items.length} item
                        {items.length > 1 ? "s" : ""}
                      </Text>
                    ) : (
                      <Text style={s.mealEmpty}>No items added yet</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[
                      s.addIconBtn,
                      { backgroundColor: meta.accent + "20" },
                    ]}
                    onPress={() => handleAddClick(meta.name)}
                    activeOpacity={0.7}
                  >
                    <Feather name="plus" size={18} color={meta.accent} />
                  </TouchableOpacity>
                </View>

                {/* Calorie bar */}
                {hasItems && (
                  <View style={s.mealBarWrap}>
                    <View style={s.mealBarTrack}>
                      <View
                        style={[
                          s.mealBarFill,
                          {
                            width: `${Math.min((totalCalories / meta.suggestCal) * 100, 100)}%`,
                            backgroundColor: meta.accent,
                          },
                        ]}
                      />
                    </View>
                    <Text style={s.mealBarHint}>
                      of ~{meta.suggestCal} recommended
                    </Text>
                  </View>
                )}

                {/* Items summary + View Plate */}
                {hasItems && (
                  <View style={s.mealItemsRow}>
                    <TouchableOpacity
                      style={s.mealSummaryPill}
                      onPress={() =>
                        navigation.navigate("NutritionPlate", {
                          mealType: meta.name,
                          items,
                        })
                      }
                      activeOpacity={0.75}
                    >
                      <Ionicons name="list" size={13} color={C.textSub} />
                      <Text weight="500" style={s.mealSummaryTxt}>
                        {items
                          .map((x) => x.name)
                          .slice(0, 2)
                          .join(", ")}
                        {items.length > 2 ? ` +${items.length - 2}` : ""}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.viewPlateBtn, { backgroundColor: meta.accent }]}
                      onPress={() =>
                        navigation.navigate("NutritionPlate", {
                          mealType: meta.name,
                          items,
                        })
                      }
                      activeOpacity={0.75}
                    >
                      <Text weight="600" style={s.viewPlateTxt}>
                        View Plate
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Suggested */}
                <View style={s.suggestedRow}>
                  <Text style={s.suggestedLabel}>Suggested</Text>
                  {(SUGGESTED[meta.name] || []).map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        s.suggestedChip,
                        { backgroundColor: meta.accent + "14" },
                      ]}
                      onPress={() => handleAddClick(meta.name)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[s.suggestedChipTxt, { color: meta.accent }]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* ══ DONE BAR ══════════════════════════════ */}
      <View style={s.bottomBar}>
        <View>
          <Text style={s.bottomLabel}>Today's Total</Text>
          <Text weight="800" style={s.bottomVal}>
            {Math.round(grandTotal)} kcal
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[C.primaryLight, C.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.doneBtn}
          >
            <Text weight="700" style={s.doneTxt}>
              Done
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default DietDashRN;

// ── Styles ─────────────────────────────────────────
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 56 : 38,
    paddingBottom: 22,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCenter: { flex: 1 },
  heroTitle: { color: "#fff", fontSize: isSmall ? 20 : 22 },
  heroSub: { color: "rgba(255,255,255,0.68)", fontSize: 12, marginTop: 2 },
  heroTotalPill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  heroTotalVal: { fontSize: isSmall ? 18 : 20, color: "#fff" },
  heroTotalUnit: { fontSize: 10, color: "rgba(255,255,255,0.7)" },

  // Meal list
  mealList: { padding: 16, gap: 14 },

  // Meal card
  mealCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  // Card header
  mealCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  mealSvgBox: {
    width: isSmall ? 44 : 52,
    height: isSmall ? 44 : 52,
    alignItems: "center",
    justifyContent: "center",
  },
  mealHeaderText: { flex: 1 },
  mealName: { fontSize: isSmall ? 16 : 17, color: C.text },
  mealCalCount: { fontSize: 12, marginTop: 2 },
  mealEmpty: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  addIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  // Calorie bar
  mealBarWrap: { paddingHorizontal: 14, paddingTop: 2, paddingBottom: 10 },
  mealBarTrack: {
    height: 5,
    backgroundColor: C.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 5,
  },
  mealBarFill: { height: "100%", borderRadius: 3 },
  mealBarHint: { fontSize: 10, color: C.textMuted },

  // Items row
  mealItemsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 8,
  },
  mealSummaryPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.bg,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  mealSummaryTxt: { fontSize: 12, color: C.textSub, flex: 1 },
  viewPlateBtn: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 8 },
  viewPlateTxt: { fontSize: 12, color: "#fff" },

  // Suggested
  suggestedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 6,
  },
  suggestedLabel: { fontSize: 12, color: C.textMuted },
  suggestedChip: {
    paddingVertical: isSmall ? 4 : 5,
    paddingHorizontal: isSmall ? 10 : 12,
    borderRadius: 20,
  },
  suggestedChipTxt: { fontSize: 12 },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.surface,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 6,
  },
  bottomLabel: { fontSize: 12, color: C.textMuted },
  bottomVal: { fontSize: 20, color: C.text, marginTop: 2 },
  doneBtn: { borderRadius: 14, paddingVertical: 13, paddingHorizontal: 32 },
  doneTxt: { color: "#fff", fontSize: isSmall ? 14 : 16 },
});