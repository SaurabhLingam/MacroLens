/**
 * NutritionPlate.jsx — Premium redesign
 *
 * Key improvements:
 *  • Dark forest-green hero matching the rest of the app design system
 *  • Summary strip is a proper card row inside the hero (not a separate pill)
 *  • Removed network-loaded FOOD_IMG; replaced with a meal-category icon bubble
 *  • Food card layout: icon bubble | content | calorie badge (no overflow risk)
 *  • Macro chips use View containers (not inline Text styles)
 *  • Per-item calorie breakdown (calories × quantity) shown cleanly
 *  • Animated list entry — each card stagger-slides in
 *  • Empty state: icon + illustration text + CTA
 *  • Bottom buttons use LinearGradient on confirm + proper safe-area padding
 *  • All logic, navigation, and AsyncStorage calls preserved exactly
 */

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, MaterialIcons, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Text } from "../components/TextWrapper";

const { width } = Dimensions.get("window");
const isSmall = width < 380;

// ── Design tokens ──────────────────────────────
const C = {
  bg: "#F2F6F3",
  surface: "#FFFFFF",
  border: "#E4EDE7",
  primary: "#0A7A3E",
  primaryMid: "#14A855",
  primaryLight: "#1DB954",
  primaryDark: "#064D27",
  primaryGhost: "#E8F5EE",
  text: "#0D1F16",
  textSub: "#3D5C47",
  textMuted: "#7EA98A",
  blue: "#2563EB",
  blueLight: "#EFF6FF",
  orange: "#EA580C",
  orangeLight: "#FFF4EE",
  emerald: "#059669",
  emeraldLight: "#ECFDF5",
  amber: "#D97706",
  amberLight: "#FFFBEB",
  purple: "#9333EA",
  purpleLight: "#FAF5FF",
  danger: "#DC2626",
  dangerLight: "#FEF2F2",
};

// ── Meal-type metadata ─────────────────────────
const MEAL_META = {
  Breakfast: { iconBg: "#FEF3C7", accent: C.amber, icon: "sunny-outline" },
  Lunch: { iconBg: "#DBEAFE", accent: C.blue, icon: "restaurant-outline" },
  Snacks: { iconBg: "#D1FAE5", accent: C.emerald, icon: "leaf-outline" },
  Dinner: { iconBg: "#EDE9FE", accent: C.purple, icon: "moon-outline" },
};

const DEFAULT_MEALS = { Breakfast: [], Lunch: [], Snacks: [], Dinner: [] };
const VALID_MEAL_TYPES = Object.keys(DEFAULT_MEALS);
const normalizeMealType = (v) => (VALID_MEAL_TYPES.includes(v) ? v : "Snacks");

const ensureMealsShape = (log) => {
  if (!log.meals || typeof log.meals !== "object") {
    log.meals = { ...DEFAULT_MEALS };
    return;
  }
  const legacy = Array.isArray(log.meals.Meal) ? log.meals.Meal : [];
  VALID_MEAL_TYPES.forEach((m) => {
    if (!Array.isArray(log.meals[m])) log.meals[m] = [];
  });
  if (legacy.length > 0) {
    log.meals.Snacks = [...legacy, ...log.meals.Snacks];
    delete log.meals.Meal;
  }
};

// ── Press-scale wrapper ────────────────────────
const PressScale = ({ onPress, style, children, disabled }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        disabled={disabled}
        activeOpacity={1}
        onPressIn={() => spring(0.97)}
        onPressOut={() => spring(1)}
        onPress={onPress}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Animated food card ─────────────────────────
const FoodCard = ({ item, mealMeta, index, onEdit, onDelete }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        speed: 16,
        bounciness: 3,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const itemCal = (item.calories || 0) * (item.quantity || 1);
  const itemProt = ((item.protein || 0) * (item.quantity || 1)).toFixed(1);
  const itemCarbs = ((item.carbs || 0) * (item.quantity || 1)).toFixed(1);
  const itemFat = ((item.fat || 0) * (item.quantity || 1)).toFixed(1);

  return (
    <Animated.View
      style={[p.foodCard, { opacity, transform: [{ translateY }] }]}
    >
      {/* Meal icon bubble */}
      <View style={[p.foodIconBubble, { backgroundColor: mealMeta.iconBg }]}>
        <Ionicons name={mealMeta.icon} size={22} color={mealMeta.accent} />
      </View>

      {/* Content */}
      <View style={p.foodContent}>
        {/* Name + actions */}
        <View style={p.foodHeader}>
          <Text weight="700" style={p.foodName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={p.foodActions}>
            <TouchableOpacity
              style={p.actionBtn}
              onPress={onEdit}
              activeOpacity={0.7}
            >
              <Feather name="edit-2" size={13} color={C.textSub} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[p.actionBtn, p.actionBtnDanger]}
              onPress={onDelete}
              activeOpacity={0.7}
            >
              <MaterialIcons name="delete-outline" size={15} color={C.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quantity + total cals */}
        <Text style={p.foodServingLine}>
          {item.quantity || 1} serving{(item.quantity || 1) > 1 ? "s" : ""} ·{" "}
          {item.calories} kcal/serving
        </Text>

        {/* Macro chips */}
        <View style={p.macroChipRow}>
          <View style={[p.macroChip, { backgroundColor: C.blueLight }]}>
            <Text weight="700" style={[p.macroChipTxt, { color: C.blue }]}>
              P {itemProt}g
            </Text>
          </View>
          <View style={[p.macroChip, { backgroundColor: C.emeraldLight }]}>
            <Text weight="700" style={[p.macroChipTxt, { color: C.emerald }]}>
              C {itemCarbs}g
            </Text>
          </View>
          <View style={[p.macroChip, { backgroundColor: C.orangeLight }]}>
            <Text weight="700" style={[p.macroChipTxt, { color: C.orange }]}>
              F {itemFat}g
            </Text>
          </View>
        </View>
      </View>

      {/* Calorie badge */}
      <View style={[p.calBadge, { borderColor: mealMeta.accent }]}>
        <Text weight="800" style={[p.calBadgeVal, { color: mealMeta.accent }]}>
          {Math.round(itemCal)}
        </Text>
        <Text style={p.calBadgeUnit}>kcal</Text>
      </View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────
const NutritionPlate = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const mealType = normalizeMealType(route.params?.mealType);
  const meta = MEAL_META[mealType] || MEAL_META.Snacks;

  const [items, setItems] = useState([]);

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(heroSlide, {
        toValue: 0,
        speed: 14,
        bounciness: 3,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ── Today key ─────────────────────────────────
  const getTodayKey = () => {
    const t = new Date();
    return `nutritionLog_${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  };

  // ── Load ──────────────────────────────────────
  useEffect(() => {
    const loadPlate = async () => {
      try {
        const raw = await AsyncStorage.getItem(getTodayKey());
        if (!raw) return;
        const parsed = JSON.parse(raw);
        ensureMealsShape(parsed);
        setItems(parsed.meals?.[mealType] || []);
      } catch (err) {
        console.log("Error loading plate:", err);
      }
    };
    loadPlate();
  }, [mealType]);

  // ── Remove ────────────────────────────────────
  const removeItem = async (id) => {
    try {
      const updated = items.filter((x) => x.id !== id);
      setItems(updated);
      const key = getTodayKey();
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return;
      const log = JSON.parse(raw);
      ensureMealsShape(log);
      log.meals[mealType] = updated;
      const allMeals = Object.values(log.meals).flat();
      log.totalCalories = allMeals.reduce(
        (s, x) => s + (x.calories || 0) * (x.quantity || 1),
        0,
      );
      log.totalProtein = allMeals.reduce(
        (s, x) => s + (x.protein || 0) * (x.quantity || 1),
        0,
      );
      log.totalCarbs = allMeals.reduce(
        (s, x) => s + (x.carbs || 0) * (x.quantity || 1),
        0,
      );
      log.totalFat = allMeals.reduce(
        (s, x) => s + (x.fat || 0) * (x.quantity || 1),
        0,
      );
      await AsyncStorage.setItem(key, JSON.stringify(log));
    } catch (err) {
      console.log("Error removing item:", err);
    }
  };

  // ── Totals ────────────────────────────────────
  const totalItems = items.length;
  const totalCalories = items.reduce(
    (s, x) => s + (x.calories || 0) * (x.quantity || 1),
    0,
  );
  const totalProtein = items.reduce(
    (s, x) => s + (x.protein || 0) * (x.quantity || 1),
    0,
  );
  const totalCarbs = items.reduce(
    (s, x) => s + (x.carbs || 0) * (x.quantity || 1),
    0,
  );
  const totalFat = items.reduce(
    (s, x) => s + (x.fat || 0) * (x.quantity || 1),
    0,
  );

  // ─── RENDER ─────────────────────────────────
  return (
    <View style={p.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingBottom: totalItems > 0 ? 110 : 32 }}
      >
        {/* ══ HERO ══════════════════════════════ */}
        <Animated.View
          style={{ opacity: heroFade, transform: [{ translateY: heroSlide }] }}
        >
          <LinearGradient
            colors={[C.primaryDark, C.primary, C.primaryMid]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={p.hero}
          >
            {/* Decorative bubble */}
            <View style={p.heroBubble} />

            {/* Top bar */}
            <View style={p.topBar}>
              <TouchableOpacity
                style={p.backBtn}
                onPress={() => navigation.goBack()}
                activeOpacity={0.75}
              >
                <Feather name="arrow-left" size={18} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={p.heroEyebrow}>Meal Plate</Text>
                <Text weight="800" style={p.heroTitle}>
                  My {mealType}
                </Text>
              </View>
              <PressScale
                onPress={() =>
                  navigation.navigate("NutritionAddDiet", { mealType })
                }
              >
                <View style={p.addMoreBtnHero}>
                  <Feather name="plus" size={16} color="#fff" />
                  <Text weight="700" style={p.addMoreBtnHeroTxt}>
                    Add
                  </Text>
                </View>
              </PressScale>
            </View>

            {/* Summary strip */}
            <View style={p.summaryStrip}>
              <View style={p.summaryItem}>
                <Text weight="800" style={p.summaryBigVal}>
                  {totalItems < 10 ? `0${totalItems}` : totalItems}
                </Text>
                <Text style={p.summarySmallLabel}>Items</Text>
              </View>
              <View style={p.summaryDivider} />
              <View style={p.summaryItem}>
                <Text weight="800" style={p.summaryBigVal}>
                  {Math.round(totalCalories)}
                </Text>
                <Text style={p.summarySmallLabel}>kcal</Text>
              </View>
              <View style={p.summaryDivider} />
              <View style={p.summaryItem}>
                <Text weight="800" style={p.summaryBigVal}>
                  {totalProtein.toFixed(1)}g
                </Text>
                <Text style={p.summarySmallLabel}>Protein</Text>
              </View>
              <View style={p.summaryDivider} />
              <View style={p.summaryItem}>
                <Text weight="800" style={p.summaryBigVal}>
                  {totalCarbs.toFixed(1)}g
                </Text>
                <Text style={p.summarySmallLabel}>Carbs</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ══ EMPTY STATE ═══════════════════════ */}
        {totalItems === 0 && (
          <Animated.View style={[p.emptyState, { opacity: heroFade }]}>
            <View style={[p.emptyIconWrap, { backgroundColor: meta.iconBg }]}>
              <Ionicons name={meta.icon} size={36} color={meta.accent} />
            </View>
            <Text weight="700" style={p.emptyTitle}>
              Your {mealType} plate is empty
            </Text>
            <Text style={p.emptySubtitle}>
              Add food items to track calories and macronutrients for this meal.
            </Text>
            <PressScale
              onPress={() =>
                navigation.navigate("NutritionAddDiet", { mealType })
              }
            >
              <LinearGradient
                colors={[C.primaryLight, C.primaryDark]}
                style={p.emptyBtn}
              >
                <Feather name="plus" size={16} color="#fff" />
                <Text weight="700" style={p.emptyBtnTxt}>
                  Add food to plate
                </Text>
              </LinearGradient>
            </PressScale>
          </Animated.View>
        )}

        {/* ══ FOOD CARDS ════════════════════════ */}
        {totalItems > 0 && (
          <View style={p.cardList}>
            {/* Total macros summary card */}
            <Animated.View style={[p.totalSummaryCard, { opacity: heroFade }]}>
              <Text weight="700" style={p.totalSummaryTitle}>
                Meal Summary
              </Text>
              <View style={p.totalMacroRow}>
                {[
                  {
                    l: "Calories",
                    v: `${Math.round(totalCalories)} kcal`,
                    c: C.primary,
                    bg: C.primaryGhost,
                  },
                  {
                    l: "Protein",
                    v: `${totalProtein.toFixed(1)}g`,
                    c: C.blue,
                    bg: C.blueLight,
                  },
                  {
                    l: "Carbs",
                    v: `${totalCarbs.toFixed(1)}g`,
                    c: C.emerald,
                    bg: C.emeraldLight,
                  },
                  {
                    l: "Fats",
                    v: `${totalFat.toFixed(1)}g`,
                    c: C.orange,
                    bg: C.orangeLight,
                  },
                ].map((m) => (
                  <View
                    key={m.l}
                    style={[p.totalMacroItem, { backgroundColor: m.bg }]}
                  >
                    <Text
                      weight="800"
                      style={[p.totalMacroVal, { color: m.c }]}
                    >
                      {m.v}
                    </Text>
                    <Text style={[p.totalMacroLabel, { color: m.c }]}>
                      {m.l}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            {/* Individual food items */}
            {items.map((item, idx) => (
              <FoodCard
                key={item.id}
                item={item}
                mealMeta={meta}
                index={idx}
                onEdit={() =>
                  navigation.navigate("NutritionAddDiet", { mealType })
                }
                onDelete={() => removeItem(item.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* ══ BOTTOM BUTTONS ════════════════════ */}
      {totalItems > 0 && (
        <View style={p.bottomBar}>
          <PressScale
            style={{ flex: 1 }}
            onPress={() =>
              navigation.navigate("NutritionAddDiet", { mealType })
            }
          >
            <View style={p.addMoreBtn}>
              <Feather name="plus" size={16} color={C.primary} />
              <Text weight="600" style={p.addMoreBtnTxt}>
                Add more
              </Text>
            </View>
          </PressScale>

          <PressScale style={{ flex: 1 }} onPress={() => navigation.goBack()}>
            <LinearGradient
              colors={[C.primaryLight, C.primaryDark]}
              style={p.confirmBtn}
            >
              <Feather name="check" size={16} color="#fff" />
              <Text weight="700" style={p.confirmBtnTxt}>
                Confirm plate
              </Text>
            </LinearGradient>
          </PressScale>
        </View>
      )}
    </View>
  );
};

export default NutritionPlate;

// ── Styles ─────────────────────────────────────────
const p = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 56 : 38,
    paddingBottom: 22,
    overflow: "hidden",
  },
  heroBubble: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.05)",
    top: -50,
    right: -40,
  },
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroEyebrow: {
    fontSize: 11,
    color: "rgba(255,255,255,0.62)",
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  heroTitle: { fontSize: isSmall ? 20 : 24, color: "#fff" },
  addMoreBtnHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  addMoreBtnHeroTxt: { color: "#fff", fontSize: 13 },

  // Summary strip
  summaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.13)",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryBigVal: { fontSize: isSmall ? 16 : 18, color: "#fff" },
  summarySmallLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.62)",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
  },

  // Card list
  cardList: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },

  // Total summary card
  totalSummaryCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  totalSummaryTitle: { fontSize: 14, color: C.text, marginBottom: 10 },
  totalMacroRow: { flexDirection: "row", gap: 8 },
  totalMacroItem: {
    flex: 1,
    borderRadius: 12,
    padding: isSmall ? 8 : 10,
    alignItems: "center",
  },
  totalMacroVal: { fontSize: isSmall ? 12 : 13, marginBottom: 2 },
  totalMacroLabel: { fontSize: 10 },

  // Food card
  foodCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  foodIconBubble: {
    width: isSmall ? 44 : 50,
    height: isSmall ? 44 : 50,
    borderRadius: isSmall ? 14 : 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  foodContent: { flex: 1 },
  foodHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  foodName: { flex: 1, fontSize: isSmall ? 14 : 15, color: C.text },
  foodActions: { flexDirection: "row", gap: 4, marginLeft: 6 },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnDanger: { backgroundColor: C.dangerLight },
  foodServingLine: { fontSize: 12, color: C.textMuted, marginBottom: 8 },
  macroChipRow: { flexDirection: "row", gap: 6 },
  macroChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  macroChipTxt: { fontSize: 11 },

  // Calorie badge
  calBadge: {
    width: isSmall ? 56 : 64,
    height: isSmall ? 56 : 64,
    borderRadius: isSmall ? 28 : 32,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surface,
    flexShrink: 0,
  },
  calBadgeVal: { fontSize: isSmall ? 14 : 16, lineHeight: isSmall ? 17 : 20 },
  calBadgeUnit: { fontSize: 9, color: C.textMuted, marginTop: 1 },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, color: C.text, textAlign: "center" },
  emptySubtitle: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  emptyBtnTxt: { color: "#fff", fontSize: 15 },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 6,
  },
  addMoreBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: C.primary,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: C.primaryGhost,
  },
  addMoreBtnTxt: { color: C.primary, fontSize: isSmall ? 14 : 15 },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    paddingVertical: 13,
  },
  confirmBtnTxt: { color: "#fff", fontSize: isSmall ? 14 : 15 },
});
