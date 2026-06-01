/**
 * NutritionPlate.jsx — Improved visual presentation
 *
 * Changes from original:
 *  • Top summary card: segmented donut where each arc = one meal type (colored)
 *  • Meal toggle tabs (Breakfast | Lunch | Snacks | Dinner) — styled from History.jsx
 *  • CalorieBadge ring now uses REAL macro percentages per food item
 *  • Nutrition Score badge (A–E letter grade) per food card, derived from macros
 *    → Tapping the badge opens a bottom tray explaining WHY this food got that grade
 *  • Nutrition score calculation fixed: all percentages are now kcal-based (grams × kcal/g)
 *  • Macro progress bars per selected meal section
 *  • Donut legend now shows short labels instead of single letters (Bfst/Lunch/Snck/Din)
 *  • All original logic, AsyncStorage, navigation preserved exactly
 *  • HeaderVeggies SVG untouched
 *  • Theme / colors unchanged
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
  Image,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Text } from "../components/TextWrapper";
import {
  normalizeMealType,
  getTodayKey,
  ensureMealsShape,
} from "../utils";
import HeaderVeggies from "../../assets/Group 1000004769.svg";

const { width } = Dimensions.get("window");
const isSmall = width < 380;

// ── Brand colors (unchanged) ───────────────────────────────
const PURPLE      = "#553FB5";
const GREEN_DARK  = "#35A329";
const GREEN_LIGHT = "#93D056";

// ── Meal metadata ──────────────────────────────────────────
const MEAL_TABS = ["Breakfast", "Lunch", "Snacks", "Dinner"];

const MEAL_META = {
  Breakfast: { accent: "#D97706", bg: "#FEF3C7", text: "#92400E", icon: "sunny-outline" },
  Lunch:     { accent: "#2563EB", bg: "#DBEAFE", text: "#1E3A8A", icon: "restaurant-outline" },
  Snacks:    { accent: "#059669", bg: "#D1FAE5", text: "#065F46", icon: "leaf-outline" },
  Dinner:    { accent: PURPLE,    bg: "#F3E8FF", text: "#581C87", icon: "moon-outline" },
};

// ── Short labels for donut legend ─────────────────────────
const MEAL_SHORT = {
  Breakfast: "Bfst",
  Lunch:     "Lunch",
  Snacks:    "Snck",
  Dinner:    "Din",
};

// ── Macro colors ───────────────────────────────────────────
const MACRO_COLORS = {
  protein: "#2563EB",
  carbs:   "#D97706",
  fat:     "#9333EA",
  fibre:   "#059669",
};
const MACRO_BAR_COLORS = {
  protein: "#5ec9fb",
  carbs:   "#ffa361",
  fat:     "#c383ff",
};

// ── Grade scale ────────────────────────────────────────────
const GRADES = [
  { grade: "A", bg: "#16A34A", dimBg: "#D1FAE5", dimText: "#6EE7B7" },
  { grade: "B", bg: "#65A30D", dimBg: "#ECFCCB", dimText: "#A3E635" },
  { grade: "C", bg: "#F59E0B", dimBg: "#FEF3C7", dimText: "#FCD34D" },
  { grade: "D", bg: "#EA580C", dimBg: "#FFEDD5", dimText: "#FDBA74" },
  { grade: "E", bg: "#DC2626", dimBg: "#FEE2E2", dimText: "#FCA5A5" },
];

// ── Nutrition score logic (kcal-based) ────────────────────
const getNutritionScore = (item) => {
  const cal  = (item.calories || 0) * (item.quantity || 1);
  const prot = (item.protein  || 0) * (item.quantity || 1);
  const carb = (item.carbs    || 0) * (item.quantity || 1);
  const fat  = (item.fat      || 0) * (item.quantity || 1);

  if (cal === 0) return { grade: "C", color: "#F59E0B", bg: "#FEF3C7" };

  const protKcal = prot * 4;
  const carbKcal = carb * 4;
  const fatKcal  = fat  * 9;

  const proteinPct = (protKcal / cal) * 100;
  const carbPct    = (carbKcal / cal) * 100;
  const fatPct     = (fatKcal  / cal) * 100;

  const proteinScore = Math.min(proteinPct * 0.6, 30);
  const carbPenalty  = Math.max(0, carbPct - 40);
  const fatPenalty   = Math.max(0, fatPct  - 30);

  const score = 70 + proteinScore - carbPenalty - fatPenalty;

  if (score >= 85) return { grade: "A", color: "#fff", bg: "#16A34A" };
  if (score >= 70) return { grade: "B", color: "#fff", bg: "#65A30D" };
  if (score >= 55) return { grade: "C", color: "#fff", bg: "#F59E0B" };
  if (score >= 40) return { grade: "D", color: "#fff", bg: "#EA580C" };
  return              { grade: "E", color: "#fff", bg: "#DC2626" };
};

// ── Accurate per-item macro donut ──────────────────────────
const CalorieBadge = ({ item, size = 72 }) => {
  const qty      = item.quantity || 1;
  const protKcal = (item.protein || 0) * qty * 4;
  const carbKcal = (item.carbs   || 0) * qty * 4;
  const fatKcal  = (item.fat     || 0) * qty * 9;
  const total    = protKcal + carbKcal + fatKcal || 1;
  const cal      = Math.round((item.calories || 0) * qty);

  const segments = [
    { color: MACRO_COLORS.protein, pct: protKcal / total },
    { color: MACRO_COLORS.carbs,   pct: carbKcal / total },
    { color: MACRO_COLORS.fat,     pct: fatKcal  / total },
  ];

  const r    = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const cx   = size / 2;
  const cy   = size / 2;
  let cumPct = 0;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={cx} cy={cy} r={r} stroke="#F0F0F0" strokeWidth={5} fill="none" />
        {segments.map((seg, i) => {
          const dash   = seg.pct * circ;
          const gap    = circ - dash;
          const offset = -cumPct * circ;
          cumPct += seg.pct;
          return (
            <Circle
              key={i}
              cx={cx} cy={cy} r={r}
              stroke={seg.color}
              strokeWidth={5}
              fill="none"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              transform={`rotate(-90, ${cx}, ${cy})`}
            />
          );
        })}
      </Svg>
      <Text weight="800" style={{ fontSize: isSmall ? 13 : 15, color: "#1A1A1A", lineHeight: 18 }}>
        {cal}
      </Text>
      <Text style={{ fontSize: 9, color: "#888", marginTop: 1 }}>Cal</Text>
    </View>
  );
};

// ── Segmented daily overview donut ─────────────────────────
const DailyDonut = ({ mealCalories, calorieGoal, totalCal, size = 110 }) => {
  const cx   = size / 2;
  const cy   = size / 2;
  const r    = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const pct  = Math.min(totalCal / (calorieGoal || 2000), 1);

  const totalForSegments = totalCal || 1;
  let cumPct = 0;

  const segments = MEAL_TABS.map((meal) => {
    const kcal = mealCalories[meal] || 0;
    return { color: MEAL_META[meal].accent, pct: kcal / totalForSegments, kcal };
  }).filter(s => s.kcal > 0);

  const showEmpty = segments.length === 0;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={cx} cy={cy} r={r} stroke="#F0F0F0" strokeWidth={10} fill="none" />
        {showEmpty ? null : segments.map((seg, i) => {
          const dash   = seg.pct * circ * pct;
          const gap    = circ - dash;
          const offset = -cumPct * circ * pct;
          cumPct += seg.pct;
          return (
            <Circle
              key={i}
              cx={cx} cy={cy} r={r}
              stroke={seg.color}
              strokeWidth={10}
              fill="none"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              transform={`rotate(-90, ${cx}, ${cy})`}
              strokeLinecap="butt"
            />
          );
        })}
      </Svg>
      <Text weight="800" style={{ fontSize: isSmall ? 15 : 18, color: "#1A1A1A", lineHeight: 22 }}>
        {Math.round(totalCal)}
      </Text>
      <Text style={{ fontSize: 9, color: "#888" }}>/{calorieGoal}</Text>
      <Text style={{ fontSize: 9, color: "#aaa" }}>kcal</Text>
    </View>
  );
};

// ── Macro progress bar ─────────────────────────────────────
const MacroBar = ({ label, value, goal, color }) => {
  const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
  return (
    <View style={q.macroBarWrap}>
      <View style={q.macroBarRow}>
        <Text style={q.macroBarLabel}>{label}</Text>
        <Text style={q.macroBarVal}>
          {Math.round(value)}
          <Text style={q.macroBarGoal}>/{goal}g</Text>
        </Text>
      </View>
      <View style={q.macroBarTrack}>
        <View style={[q.macroBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

// ── Summary card (top) ─────────────────────────────────────
const CaloriesIntakeCard = ({ allMeals, calorieGoal, goalMacros }) => {
  const mealCalories = {};
  let totalCal = 0, totalProt = 0, totalCarb = 0, totalFat = 0;

  MEAL_TABS.forEach((meal) => {
    const items = allMeals[meal] || [];
    const kcal = items.reduce((s, x) => s + (x.calories || 0) * (x.quantity || 1), 0);
    mealCalories[meal] = Math.round(kcal);
    totalCal  += kcal;
    totalProt += items.reduce((s, x) => s + (x.protein || 0) * (x.quantity || 1), 0);
    totalCarb += items.reduce((s, x) => s + (x.carbs   || 0) * (x.quantity || 1), 0);
    totalFat  += items.reduce((s, x) => s + (x.fat     || 0) * (x.quantity || 1), 0);
  });

  const remaining = Math.max(0, calorieGoal - totalCal);
  const isOver    = totalCal > calorieGoal;

  return (
    <View style={q.intakeCard}>
      <Text weight="700" style={q.intakeTitle}>Today's Overview</Text>
      <View style={q.intakeBody}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <MacroBar label="Protein" value={totalProt} goal={goalMacros?.protein_g} color={MACRO_BAR_COLORS.protein} />
          <MacroBar label="Carbs"   value={totalCarb} goal={goalMacros?.carbs_g}   color={MACRO_BAR_COLORS.carbs}   />
          <MacroBar label="Fat"     value={totalFat}  goal={goalMacros?.fat_g}     color={MACRO_BAR_COLORS.fat}     />
          <View style={[q.goalChip, isOver && q.goalChipOver]}>
            <Ionicons
              name={isOver ? "warning-outline" : "checkmark-circle-outline"}
              size={12}
              color={isOver ? "#DC2626" : GREEN_DARK}
            />
            <Text style={[q.goalChipTxt, isOver && { color: "#DC2626" }]}>
              {isOver
                ? `${Math.round(totalCal - calorieGoal)} over goal`
                : `${Math.round(remaining)} kcal left`}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "center", gap: 8 }}>
          <DailyDonut
            mealCalories={mealCalories}
            calorieGoal={calorieGoal}
            totalCal={totalCal}
            size={isSmall ? 95 : 110}
          />
          <View style={q.donutLegend}>
            {MEAL_TABS.map((meal) => (
              <View key={meal} style={q.donutLegendItem}>
                <View style={[q.donutDot, { backgroundColor: MEAL_META[meal].accent }]} />
                <Text style={q.donutLegendTxt}>{MEAL_SHORT[meal]}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

// ── Nutrition score badge (tappable — opens bottom tray) ───
const NutritionBadge = ({ item }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const score = getNutritionScore(item);

  const qty      = item.quantity || 1;
  const cal      = (item.calories || 0) * qty;
  const protKcal = (item.protein  || 0) * qty * 4;
  const carbKcal = (item.carbs    || 0) * qty * 4;
  const fatKcal  = (item.fat      || 0) * qty * 9;
  const protPct  = cal > 0 ? Math.round((protKcal / cal) * 100) : 0;
  const carbPct  = cal > 0 ? Math.round((carbKcal / cal) * 100) : 0;
  const fatPct   = cal > 0 ? Math.round((fatKcal  / cal) * 100) : 0;

  const reasons = [
    protPct >= 30
      ? { icon: "✅", text: `High protein: ${protPct}% of calories` }
      : { icon: "⚠️", text: `Low protein: only ${protPct}% of calories` },
    carbPct > 40
      ? { icon: "⚠️", text: `High carbs: ${carbPct}% of calories` }
      : { icon: "✅", text: `Carbs in range: ${carbPct}% of calories` },
    fatPct > 30
      ? { icon: "⚠️", text: `High fat: ${fatPct}% of calories` }
      : { icon: "✅", text: `Fat in range: ${fatPct}% of calories` },
  ];

  return (
    <>
      <TouchableOpacity onPress={() => setModalVisible(true)} activeOpacity={0.75} style={q.nutScaleRow}>
        {GRADES.map((g) => {
          const isActive = g.grade === score.grade;
          return (
            <View
              key={g.grade}
              style={[
                q.nutScaleItem,
                isActive
                  ? { backgroundColor: g.bg, transform: [{ scale: 1.25 }], zIndex: 2 }
                  : { backgroundColor: g.dimBg },
              ]}
            >
              <Text
                weight={isActive ? "800" : "600"}
                style={{ fontSize: isActive ? 11 : 9, color: isActive ? "#fff" : g.dimText }}
              >
                {g.grade}
              </Text>
            </View>
          );
        })}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={q.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={q.modalCard} onStartShouldSetResponder={() => true}>
            {/* Drag handle */}
            <View style={q.modalHandle} />

            {/* Title */}
            <Text weight="700" style={q.modalTitle}>Nutrition Score</Text>

            {/* Big grade badge */}
            <View style={[q.modalGradeHighlight, { backgroundColor: score.bg }]}>
              <Text weight="800" style={q.modalGradeLetter}>{score.grade}</Text>
            </View>

            {/* Per-food reasons */}
            <View style={q.modalReasonCard}>
              {reasons.map((r, i) => (
                <View key={i} style={q.modalReasonRow}>
                  <Text style={q.modalReasonIcon}>{r.icon}</Text>
                  <Text style={q.modalReasonTxt}>{r.text}</Text>
                </View>
              ))}
            </View>

            {/* Close button */}
            <TouchableOpacity
              style={q.modalCloseBtn}
              activeOpacity={0.85}
              onPress={() => setModalVisible(false)}
            >
              <Text weight="700" style={q.modalCloseTxt}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// ── Food card ──────────────────────────────────────────────
const FoodCard = ({ item, index, onEdit }) => {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, speed: 16, bounciness: 3, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const qty = item.quantity || 1;

  return (
    <Animated.View style={[q.foodCard, { opacity, transform: [{ translateY }] }]}>
      <Text style={q.timeLabel}>7:30 am</Text>
      <View style={q.foodCardInner}>
        <View style={q.foodImgWrap}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={q.foodImg} />
          ) : (
            <View style={[q.foodImg, q.foodImgFallback]}>
              <Ionicons name="restaurant-outline" size={26} color="#ccc" />
            </View>
          )}
        </View>
        <View style={q.foodMid}>
          <Text weight="700" style={q.foodName} numberOfLines={1}>{item.name}</Text>
          <View style={q.qtyRow}>
            <Text style={q.qtyLabel}>Qty  {qty}</Text>
            <Feather name="chevron-down" size={14} color={GREEN_DARK} />
          </View>
          <View style={q.macroChipRow}>
            {item.protein > 0 && (
              <View style={[q.macroChip, { backgroundColor: "#EFF6FF" }]}>
                <Text style={[q.macroChipTxt, { color: MACRO_COLORS.protein }]}>
                  P {Math.round(item.protein * qty)}g
                </Text>
              </View>
            )}
            {item.carbs > 0 && (
              <View style={[q.macroChip, { backgroundColor: "#FFFBEB" }]}>
                <Text style={[q.macroChipTxt, { color: MACRO_COLORS.carbs }]}>
                  C {Math.round(item.carbs * qty)}g
                </Text>
              </View>
            )}
            {item.fat > 0 && (
              <View style={[q.macroChip, { backgroundColor: "#FAF5FF" }]}>
                <Text style={[q.macroChipTxt, { color: MACRO_COLORS.fat }]}>
                  F {Math.round(item.fat * qty)}g
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={q.foodRight}>
          <NutritionBadge item={item} />
          <TouchableOpacity onPress={onEdit} activeOpacity={0.7} style={q.editBtn}>
            <Feather name="edit-2" size={14} color={PURPLE} />
          </TouchableOpacity>
          <CalorieBadge item={item} size={isSmall ? 62 : 70} />
        </View>
      </View>
    </Animated.View>
  );
};

// ── Meal section macro summary ─────────────────────────────
const MealMacroSummary = ({ items, accent }) => {
  if (items.length === 0) return null;
  const totProt = items.reduce((s, x) => s + (x.protein  || 0) * (x.quantity || 1), 0);
  const totCarb = items.reduce((s, x) => s + (x.carbs    || 0) * (x.quantity || 1), 0);
  const totFat  = items.reduce((s, x) => s + (x.fat      || 0) * (x.quantity || 1), 0);
  const totCal  = items.reduce((s, x) => s + (x.calories || 0) * (x.quantity || 1), 0);

  return (
    <View style={[q.mealSummary, { borderLeftColor: accent }]}>
      <View style={q.mealSummaryRow}>
        <View style={q.mealSummaryItem}>
          <Text style={[q.mealSummaryVal, { color: accent }]}>{Math.round(totCal)}</Text>
          <Text style={q.mealSummaryLbl}>kcal</Text>
        </View>
        <View style={q.mealSumDivider} />
        <View style={q.mealSummaryItem}>
          <Text style={[q.mealSummaryVal, { color: MACRO_COLORS.protein }]}>{Math.round(totProt)}g</Text>
          <Text style={q.mealSummaryLbl}>protein</Text>
        </View>
        <View style={q.mealSumDivider} />
        <View style={q.mealSummaryItem}>
          <Text style={[q.mealSummaryVal, { color: MACRO_COLORS.carbs }]}>{Math.round(totCarb)}g</Text>
          <Text style={q.mealSummaryLbl}>carbs</Text>
        </View>
        <View style={q.mealSumDivider} />
        <View style={q.mealSummaryItem}>
          <Text style={[q.mealSummaryVal, { color: MACRO_COLORS.fat }]}>{Math.round(totFat)}g</Text>
          <Text style={q.mealSummaryLbl}>fat</Text>
        </View>
      </View>
    </View>
  );
};

// ── Main screen ────────────────────────────────────────────
const NutritionPlate = () => {
  const navigation = useNavigation();
  const route      = useRoute();

  const routeMealType = normalizeMealType(route.params?.mealType);
  const [activeMeal, setActiveMeal] = useState(routeMealType || "Breakfast");
  const [allMeals, setAllMeals]     = useState({ Breakfast: [], Lunch: [], Snacks: [], Dinner: [] });
  const [calorieGoal, setCalorieGoal] = useState(null);
  const [goalMacros, setGoalMacros]   = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(getTodayKey());
        if (raw) {
          const parsed = JSON.parse(raw);
          ensureMealsShape(parsed);
          const meals = {};
          MEAL_TABS.forEach((m) => { meals[m] = parsed.meals?.[m] || []; });
          setAllMeals(meals);
        }
        const goalRaw = await AsyncStorage.getItem("calorieGoalData");
        if (goalRaw) {
          const g = JSON.parse(goalRaw);
          setCalorieGoal(g.calorieGoal);
          setGoalMacros(g);
        }
      } catch (err) {
        console.log("Error loading plate:", err);
      }
    };
    load();
  }, []);

  const removeItem = async (mealType, id) => {
    try {
      const updated = { ...allMeals, [mealType]: allMeals[mealType].filter((x) => x.id !== id) };
      setAllMeals(updated);
      const key = getTodayKey();
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return;
      const log = JSON.parse(raw);
      ensureMealsShape(log);
      MEAL_TABS.forEach((m) => { log.meals[m] = updated[m]; });
      const flat = Object.values(log.meals).flat();
      log.totalCalories = flat.reduce((s, x) => s + (x.calories || 0) * (x.quantity || 1), 0);
      log.totalProtein  = flat.reduce((s, x) => s + (x.protein  || 0) * (x.quantity || 1), 0);
      log.totalCarbs    = flat.reduce((s, x) => s + (x.carbs    || 0) * (x.quantity || 1), 0);
      log.totalFat      = flat.reduce((s, x) => s + (x.fat      || 0) * (x.quantity || 1), 0);
      await AsyncStorage.setItem(key, JSON.stringify(log));
    } catch (err) {
      console.log("Error removing item:", err);
    }
  };

  const currentItems = allMeals[activeMeal] || [];
  const meta         = MEAL_META[activeMeal];

  return (
    <View style={q.page}>
      {/* ══ HEADER ════════════════════════════════════════ */}
      <View style={q.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={q.backBtn}>
          <Feather name="arrow-left" size={22} color={PURPLE} />
        </TouchableOpacity>
        <View style={{ marginLeft: 10 }}>
          <Text weight="700" style={q.headerTitle}>Health Wellness</Text>
          <Text style={q.headerSub}>Your today's plate</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingBottom: 90 }}
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ══ HEADER VEGGIES BANNER ════════════════════ */}
          <HeaderVeggies width={width} height={90} preserveAspectRatio="xMidYMid slice" />

          {/* ══ TODAY'S OVERVIEW CARD ════════════════════ */}
          <CaloriesIntakeCard allMeals={allMeals} calorieGoal={calorieGoal} goalMacros={goalMacros} />

          {/* ══ MEAL TOGGLE TABS ═════════════════════════ */}
          <View style={q.toggleWrap}>
            {MEAL_TABS.map((meal) => {
              const isActive  = activeMeal === meal;
              const itemCount = allMeals[meal]?.length || 0;
              return (
                <TouchableOpacity
                  key={meal}
                  style={[q.toggleTab, isActive && { borderBottomColor: meta.accent, borderBottomWidth: 2 }]}
                  onPress={() => setActiveMeal(meal)}
                  activeOpacity={0.8}
                >
                  <Text
                    weight={isActive ? "700" : "500"}
                    style={[q.toggleTabTxt, isActive && { color: meta.accent }]}
                  >
                    {meal}
                  </Text>
                  {itemCount > 0 && (
                    <View style={[q.mealCountDot, { backgroundColor: meta.accent }]}>
                      <Text style={q.mealCountTxt}>{itemCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ══ MEAL MACRO SUMMARY BAR ═══════════════════ */}
          <MealMacroSummary items={currentItems} accent={meta.accent} />

          {/* ══ EMPTY STATE ══════════════════════════════ */}
          {currentItems.length === 0 && (
            <View style={q.emptyState}>
              <View style={[q.emptyIconWrap, { backgroundColor: meta.accent + "18" }]}>
                <Ionicons name={meta.icon} size={36} color={meta.accent} />
              </View>
              <Text weight="700" style={q.emptyTitle}>Your {activeMeal} plate is empty</Text>
              <Text style={q.emptySubtitle}>
                Add food items to track calories and macronutrients for this meal.
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigation.navigate("NutritionAddDiet", { mealType: activeMeal })}
              >
                <LinearGradient
                  colors={[GREEN_LIGHT, GREEN_DARK]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={q.emptyBtn}
                >
                  <Feather name="plus" size={16} color="#fff" />
                  <Text weight="700" style={q.emptyBtnTxt}>Add food to plate</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* ══ FOOD CARDS ═══════════════════════════════ */}
          {currentItems.map((item, idx) => (
            <FoodCard
              key={item.id}
              item={item}
              index={idx}
              onEdit={() => navigation.navigate("NutritionAddDiet", { mealType: activeMeal })}
              onDelete={() => removeItem(activeMeal, item.id)}
            />
          ))}

          {/* ══ ADD MORE BUTTON ═══════════════════════════ */}
          {currentItems.length > 0 && (
            <TouchableOpacity
              style={q.addMoreBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("NutritionAddDiet", { mealType: activeMeal })}
            >
              <Feather name="plus" size={16} color={GREEN_DARK} />
              <Text weight="600" style={q.addMoreTxt}>Add more to {activeMeal}</Text>
            </TouchableOpacity>
          )}

        </Animated.View>
      </ScrollView>

      {/* ══ BOTTOM BAR ════════════════════════════════════ */}
      <View style={q.bottomBar}>
        <TouchableOpacity
          style={q.bottomBtn}
          activeOpacity={0.75}
          onPress={() => navigation.navigate("ScanFood", { mealType: activeMeal })}
        >
          <Text weight="600" style={q.bottomBtnTxt}>Scan Food</Text>
        </TouchableOpacity>
        <View style={q.bottomDivider} />
        <TouchableOpacity
          style={q.bottomBtn}
          activeOpacity={0.75}
          onPress={() => navigation.navigate("ScanBarcode", { mealType: activeMeal })}
        >
          <Text weight="600" style={q.bottomBtnTxt}>Scan Barcode</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default NutritionPlate;

// ── Styles ──────────────────────────────────────────────────
const q = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 38,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backBtn:     { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, color: PURPLE },
  headerSub:   { fontSize: 12, color: "#333", marginTop: 2 },

  // ── Overview card ──
  intakeCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    margin: 16,
    marginTop: -20,
    marginBottom: 0,
    zIndex: 1,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  intakeTitle: { fontSize: 15, color: "#1A1A1A", marginBottom: 12 },
  intakeBody:  { flexDirection: "row", alignItems: "center" },

  // Donut legend
  donutLegend:     { flexDirection: "row", gap: 4, justifyContent: "center", flexWrap: "wrap" },
  donutLegendItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  donutDot:        { width: 8, height: 8, borderRadius: 4 },
  donutLegendTxt:  { fontSize: 9, color: "#888" },

  // Goal chip
  goalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
  },
  goalChipOver: { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" },
  goalChipTxt:  { fontSize: 11, color: GREEN_DARK, fontWeight: "600" },

  // Macro progress bars
  macroBarWrap:  { marginBottom: 7 },
  macroBarRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  macroBarLabel: { fontSize: 11, color: "#666" },
  macroBarVal:   { fontSize: 11, color: "#1A1A1A", fontWeight: "600" },
  macroBarGoal:  { fontWeight: "400", color: "#aaa" },
  macroBarTrack: { height: 5, borderRadius: 3, backgroundColor: "#F0F0F0", overflow: "hidden" },
  macroBarFill:  { height: "100%", borderRadius: 3 },

  // ── Meal toggle tabs ──
  toggleWrap: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  toggleTabTxt: { fontSize: isSmall ? 11 : 12, color: "#999" },
  mealCountDot: {
    position: "absolute",
    top: 4,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  mealCountTxt: { fontSize: 9, color: "#fff", fontWeight: "700" },

  // ── Meal macro summary ──
  mealSummary: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  mealSummaryRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mealSummaryItem: { alignItems: "center", flex: 1 },
  mealSummaryVal:  { fontSize: 14, fontWeight: "700" },
  mealSummaryLbl:  { fontSize: 10, color: "#888", marginTop: 1 },
  mealSumDivider:  { width: 1, height: 28, backgroundColor: "#E5E7EB" },

  // ── Food card ──
  foodCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  timeLabel:     { fontSize: 11, color: "#999", marginBottom: 8 },
  foodCardInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  foodImgWrap:   { flexShrink: 0 },
  foodImg: {
    width: isSmall ? 52 : 58,
    height: isSmall ? 52 : 58,
    borderRadius: isSmall ? 26 : 29,
  },
  foodImgFallback: {
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  foodMid:      { flex: 1 },
  foodName:     { fontSize: isSmall ? 13 : 14, color: "#1A1A1A", marginBottom: 4 },
  qtyRow:       { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 5 },
  qtyLabel:     { fontSize: 12, color: "#666" },
  macroChipRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  macroChip:    { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  macroChipTxt: { fontSize: 10, fontWeight: "600" },
  foodRight:    { alignItems: "center", gap: 6 },
  editBtn:      { padding: 4 },

  // ── Nutrition badge (scale) ──
  nutScaleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
  },
  nutScaleItem: {
    width: 18,
    height: 22,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Nutrition score bottom tray ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    width: "100%",
    maxHeight: "55%",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    color: "#1A1A1A",
    marginBottom: 14,
  },
  modalGradeHighlight: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalGradeLetter: {
    fontSize: 28,
    color: "#fff",
  },
  modalReasonCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 8,
  },
  modalReasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalReasonIcon: { fontSize: 16 },
  modalReasonTxt:  { fontSize: 13, color: "#333", flex: 1, lineHeight: 18 },
  modalCloseBtn: {
    marginTop: 12,
    backgroundColor: PURPLE,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCloseTxt: { color: "#fff", fontSize: 14 },

  // ── Empty state ──
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 32,
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
  emptyTitle:    { fontSize: 17, color: "#1A1A1A", textAlign: "center" },
  emptySubtitle: { fontSize: 13, color: "#888", textAlign: "center", lineHeight: 19 },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  emptyBtnTxt: { color: "#fff", fontSize: 15 },

  // ── Add more ──
  addMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: GREEN_DARK,
    borderStyle: "dashed",
  },
  addMoreTxt: { fontSize: 14, color: GREEN_DARK },

  // ── Bottom bar ──
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 5,
  },
  bottomBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  bottomBtnTxt:  { fontSize: 15, color: GREEN_DARK },
  bottomDivider: { width: 1, height: 22, backgroundColor: "#E0E0E0" },
});