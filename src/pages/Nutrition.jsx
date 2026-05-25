/**
 * Nutrition.jsx — Premium final pass
 *
 * Changes from previous version:
 *  • Calorie ring shows progress % label + arc fills correctly
 *  • Stats row "Burned" replaced with "Progress %" — no more misleading 0
 *  • Chip cards refactored: proper icon + label stacking, larger hit targets
 *  • Macro card gains per-row value badges and a subtle separator
 *  • Meal grid replaced with WeeklyNutritionTrend bar chart + Wellness Insights
 *  • Chart reads real AsyncStorage data using nutritionLog_YYYY-MM-DD keys
 *  • Scan cards: icon + title + sub balanced with flex layout
 *  • Consult banner shadow fixed to use #000 for Android compatibility
 *  • Animated stagger on section entry (cards slide up sequentially)
 *  • WellnessNutrition constrained to a fixed box to prevent layout shift
 *  • All logic, navigation, and AsyncStorage keys unchanged
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StyleSheet,
  Animated,
  Platform,
  Modal,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text } from "../components/TextWrapper";
import { C } from "../theme";
import { getTodayKey, STORAGE_KEYS } from "../utils";
import { BarChart } from "react-native-chart-kit";
import NutritionSetGoalSVG from "../../assets/NutritionSetGoal.svg";
import WellnessNutrition from "../../assets/WellnessNutrition.svg";
import MacroLensHero from "../../assets/MacroLens.svg";
import FoodGroup from "../../assets/Group.svg";
import HelixInsightCard from "../../assets/Group 1000004737.svg";
import CalorieTargetCard from "../../assets/Group 1000004803.svg";
import Rectangle3464971 from "../../assets/Rectangle 3464971.svg";
import Rectangle3464972 from "../../assets/Rectangle 3464972.svg";
import Rectangle3464973 from "../../assets/Rectangle 3464973.svg";
import SpoonFork from "../../assets/Group 1000004794.svg";
import ScanIcon from "../../assets/scan.svg";
import BarcodeIcon from "../../assets/barcode.svg";
import Svg, {
  Circle, Defs, LinearGradient as SvgGradient, Stop,
  Rect, Text as SvgText, Line,
} from "react-native-svg";
import BreakFastMeal from "../../assets/BreakFastMeal.svg";
import LunchMeal from "../../assets/LunchMeal.svg";
import SnackMeal from "../../assets/SnackMeal.svg";
import DinnerMeal from "../../assets/DinnerMeal.svg";

const { width } = Dimensions.get("window");
const isSmall = width < 380;

// ─────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MEAL_META = [
  {
    title: "Breakfast",
    img: BreakFastMeal,
    bg: C.amberLight,
    accent: C.amber,
    iconBg: "#FEF3C7",
  },
  {
    title: "Lunch",
    img: LunchMeal,
    bg: C.blueLight,
    accent: C.blue,
    iconBg: "#DBEAFE",
  },
  {
    title: "Snacks",
    img: SnackMeal,
    bg: C.emeraldLight,
    accent: C.emerald,
    iconBg: "#D1FAE5",
  },
  {
    title: "Dinner",
    img: DinnerMeal,
    bg: C.purpleLight,
    accent: C.purple,
    iconBg: "#EDE9FE",
  },
];

// ─────────────────────────────────────────────
// REUSABLE PRIMITIVES
// ─────────────────────────────────────────────

/** Spring-scale press feedback wrapper */
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
        onPressIn={() => spring(0.965)}
        onPressOut={() => spring(1)}
        onPress={onPress}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

/** Stagger-animated container — slides up + fades in with a per-item delay */
const StaggerItem = ({ delay = 0, children, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        speed: 16,
        bounciness: 3,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
};

/** Labelled macro progress bar */
const MacroBar = ({ label, current, max, color, lightBg }) => {
  const pct = Math.min((current / max) * 100, 100);
  const val =
    label === "Protein" ? Number(current).toFixed(1) : Math.round(current);
  return (
    <View style={s.macroItem}>
      <View style={s.macroLabelRow}>
        <View style={[s.macroDot, { backgroundColor: color }]} />
        <Text style={s.macroLabel}>{label}</Text>
        <Text weight="700" style={[s.macroCurrentVal, { color }]}>
          {val}g
        </Text>
        <Text style={s.macroMaxVal}>/ {max}g</Text>
      </View>
      <View style={s.macroTrack}>
        <Animated.View
          style={[s.macroFill, { width: `${pct}%`, backgroundColor: color }]}
        />
      </View>
    </View>
  );
};

const MiniMacroBar = ({ label, current, max, color }) => (
  <View style={s.miniMacro}>
    <View style={s.miniMacroLabelRow}>
      <Text weight="700" style={s.miniMacroName}>{label}</Text>
      <Text style={s.miniMacroVal}>{Math.round(current)}/{max}g</Text>
    </View>
    <View style={s.miniTrack}>
      <View style={[s.miniFill, {
        width: `${Math.min((current / max) * 100, 100)}%`,
        backgroundColor: color
      }]} />
    </View>
  </View>
);

/** Section header with optional right action */
const SectionHead = ({ title, action, actionLabel }) => (
  <View style={s.sectionRow}>
    <Text weight="700" style={s.sectionTitle}>
      {title}
    </Text>
    {action && (
      <TouchableOpacity
        onPress={action}
        activeOpacity={0.7}
        style={s.sectionAction}
      >
        <Text weight="600" style={s.sectionActionTxt}>
          {actionLabel}
        </Text>
        <Feather name="chevron-right" size={13} color={C.primary} />
      </TouchableOpacity>
    )}
  </View>
);

// ─────────────────────────────────────────────
// WEEKLY NUTRITION TREND COMPONENT
// ─────────────────────────────────────────────

const WeeklyNutritionTrend = ({ goalCalories, macroTargets }) => {
  const navigation = useNavigation();
  const [weekData, setWeekData] = useState(
    DAYS.map(() => ({ calories: 0, protein: 0, carbs: 0, fat: 0 }))
  );

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const today = new Date();
          const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
          const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

          const results = await Promise.all(
            DAYS.map(async (_, i) => {
              const dd = new Date(today);
              dd.setDate(today.getDate() + mondayOffset + i);
              const y = dd.getFullYear();
              const m = String(dd.getMonth() + 1).padStart(2, "0");
              const day = String(dd.getDate()).padStart(2, "0");
              const key = `nutritionLog_${y}-${m}-${day}`;

              const raw = await AsyncStorage.getItem(key);
              if (raw) {
                const p = JSON.parse(raw);
                return {
                  calories: p.totalCalories || 0,
                  protein: p.totalProtein || 0,
                  carbs: p.totalCarbs || 0,
                  fat: p.totalFat || 0,
                };
              }
              return { calories: 0, protein: 0, carbs: 0, fat: 0 };
            })
          );
          setWeekData(results);
        } catch (e) {
          console.warn("WeeklyNutritionTrend load error:", e);
        }
      };
      load();
    }, [])
  );

  // Today's column index (0=Mon … 6=Sun)
  const todayCol = (() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  })();

  const maxCal = Math.max(goalCalories || 2000, ...weekData.map((d) => d.calories), 100);
  const BAR_MAX_H = 120;

  // Dynamic wellness insights from real data
  const insights = [];
  const avgProtein = weekData.reduce((s, d) => s + d.protein, 0) / 7;
  const weekendAvg = (weekData[5].calories + weekData[6].calories) / 2;
  const weekdayAvg = weekData.slice(0, 5).reduce((s, d) => s + d.calories, 0) / 5;
  if (weekendAvg > weekdayAvg * 1.1)
    insights.push("You consume more calories on weekends.");
  if (avgProtein < (macroTargets?.protein || 80) * 0.8)
    insights.push("Your protein intake is slightly below recommended levels.");
  const avgCarbs = weekData.reduce((s, d) => s + d.carbs, 0) / 7;
  if (avgCarbs > (macroTargets?.carbs || 200) * 1.1)
    insights.push("Your carb intake is on the higher side this week.");
  const daysLogged = weekData.filter((d) => d.calories > 0).length;
  if (daysLogged < 3)
    insights.push("Log more meals to get personalised insights.");
  if (insights.length === 0)
    insights.push("Great consistency this week! Keep it up.");

  return (
    <>
      <StaggerItem delay={200}>
        <View style={wt.card}>
          {/* Header */}
          <View style={wt.header}>
            <Text weight="700" style={wt.title}>Weekly Nutrition Trend</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("NutritionStats")}
              activeOpacity={0.7}
              style={wt.viewBtn}
            >
              <Text weight="600" style={wt.viewTxt}>View Stats</Text>
              <Feather name="arrow-right" size={13} color={C.primary} />
            </TouchableOpacity>
          </View>

          {/* Chart */}
          <View style={wt.chartArea}>
            {/* Y-axis labels */}
            <View style={wt.yAxis}>
              {[maxCal, Math.round(maxCal * 0.75), Math.round(maxCal * 0.5), Math.round(maxCal * 0.25), 0].map((v) => (
                <Text key={v} style={wt.yLabel}>{v}</Text>
              ))}
            </View>

            {/* Stacked bars */}
            <View style={wt.barsRow}>
              {weekData.map((d, i) => {
                const totalH = (d.calories / maxCal) * BAR_MAX_H;
                // Split height proportionally by calorie density
                const proteinCal = d.protein * 4;
                const fatCal = d.fat * 9;
                const carbCal = d.carbs * 4;
                const totalMacroCal = proteinCal + fatCal + carbCal || 1;
                const proteinH = (proteinCal / totalMacroCal) * totalH;
                const fatH = (fatCal / totalMacroCal) * totalH;
                const carbH = Math.max(totalH - proteinH - fatH, 0);
                const isToday = i === todayCol;
                return (
                  <View key={i} style={wt.barCol}>
                    <View style={[wt.barWrap, { height: BAR_MAX_H }]}>
                      <View style={[wt.barStack, { height: Math.max(totalH, 0) }]}>
                        {/* Carbs — bottom — teal */}
                        <View style={[wt.seg, { height: carbH, backgroundColor: "#4ECDC4" }]} />
                        {/* Fat — middle — yellow */}
                        <View style={[wt.seg, { height: fatH, backgroundColor: "#FFD166" }]} />
                        {/* Protein — top — purple */}
                        <View style={[wt.seg, {
                          height: proteinH,
                          backgroundColor: "#9B5DE5",
                          borderTopLeftRadius: 5,
                          borderTopRightRadius: 5,
                        }]} />
                      </View>
                      {/* Goal line */}
                      {goalCalories > 0 && (
                        <View style={[wt.goalLine, {
                          bottom: (goalCalories / maxCal) * BAR_MAX_H - 1,
                        }]} />
                      )}
                    </View>
                    <Text
                      weight={isToday ? "700" : "400"}
                      style={[wt.dayLabel, isToday && { color: C.primary }]}
                    >
                      {DAYS[i]}
                    </Text>
                    {isToday && <View style={wt.todayDot} />}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Legend */}
          <View style={wt.legend}>
            {[["#9B5DE5", "Protein"], ["#FFD166", "Fat"], ["#4ECDC4", "Carbs"]].map(([color, label]) => (
              <View key={label} style={wt.legendItem}>
                <View style={[wt.legendDot, { backgroundColor: color }]} />
                <Text style={wt.legendTxt}>{label}</Text>
              </View>
            ))}
            {goalCalories > 0 && (
              <View style={wt.legendItem}>
                <View style={wt.goalLineLegend} />
                <Text style={wt.legendTxt}>Goal</Text>
              </View>
            )}
          </View>
        </View>
      </StaggerItem>

      {/* Wellness Insights card */}
      <StaggerItem delay={260}>
    <TouchableOpacity
      onPress={() => navigation.navigate("NutritionStats")}
      activeOpacity={0.85}
      style={{ marginHorizontal: 16, marginTop: 12 }}
    >
      <HelixInsightCard width="100%" height={137} />
    </TouchableOpacity>
  </StaggerItem>
    </>
  );
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
const NutritionHomeRN = () => {
  const navigation = useNavigation();

  const [goalData, setGoalData] = useState(null);
  const [goalCalories, setGoalCalories] = useState(0);
  const [intakeCalories, setIntakeCalories] = useState(0);
  const [totalProtein, setTotalProtein] = useState(0);
  const [totalCarbs, setTotalCarbs] = useState(0);
  const [totalFat, setTotalFat] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [macroTargets, setMacroTargets] = useState({ protein: 120, carbs: 200, fat: 70 });
  const [mealTray, setMealTray] = useState({ Breakfast: [], Lunch: [], Snacks: [], Dinner: [] });
  const [activeMealTab, setActiveMealTab] = useState("Breakfast");
  const [scanCount, setScanCount] = useState(0);
  const [lastBarcodeItem, setLastBarcodeItem] = useState(null);
  const [showMealPicker, setShowMealPicker] = useState(false);

  // Hero fade/slide
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(heroSlide, {
        toValue: 0,
        speed: 13,
        bounciness: 3,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ── Ring geometry ──────────────────────────
  const RING_R = 54;
  const RING_CIRC = 2 * Math.PI * RING_R;
  const consumed =
    goalCalories > 0 ? Math.min(intakeCalories / goalCalories, 1) : 0;
  const ringOffset = RING_CIRC - consumed * RING_CIRC;
  const caloriesLeft = Math.max(goalCalories - intakeCalories, 0);
  const progressPct = Math.round(consumed * 100);
  const totalMealsLogged = Object.values(mealTray).reduce(
    (sum, items) => sum + items.length, 0
  );

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const raw = await AsyncStorage.getItem(getTodayKey());
          if (raw) {
            const p = JSON.parse(raw);
            setIntakeCalories(p.totalCalories || 0);
            setTotalProtein(p.totalProtein || 0);
            setTotalCarbs(p.totalCarbs || 0);
            setTotalFat(p.totalFat || 0);
            if (p.meals) setMealTray(p.meals);
          } else {
            setIntakeCalories(0);
            setTotalProtein(0);
            setTotalCarbs(0);
            setTotalFat(0);
          }
          const todayScanKey = `scan_count_${getTodayKey()}`;
          const scanRaw = await AsyncStorage.getItem(todayScanKey);
          setScanCount(parseInt(scanRaw) || 0);

          const lastBarcode = await AsyncStorage.getItem(STORAGE_KEYS.LAST_BARCODE);
          setLastBarcodeItem(lastBarcode || null);

          const goalRaw = await AsyncStorage.getItem(STORAGE_KEYS.CALORIE_GOAL);
          if (goalRaw) {
            const p = JSON.parse(goalRaw);
            setGoalData(p);
            setGoalCalories(p.calorieGoal || 0);
            setMacroTargets({
              protein: p.protein_g || 120,
              carbs: p.carbs_g || 200,
              fat: p.fat_g || 70,
            });
          } else {
            setGoalData(null);
            setGoalCalories(0);
          }
          const userRaw = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER);
          if (userRaw) setCurrentUser(JSON.parse(userRaw));
        } catch (e) {
          console.warn("Nutrition load failed:", e);
        }
      };
      loadData();
    }, []),
  );

  const isGoalSet = !!goalData;

  const handleLogout = async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_DONE);
    navigation.reset({ index: 0, routes: [{ name: "NutritionSetGoal" }] });
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // ─── RENDER ─────────────────────────────────
  return (
    <ScrollView
      style={s.container}
      showsVerticalScrollIndicator={false}
      bounces={false}
      alwaysBounceVertical={false}
      overScrollMode="never"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
    >
      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <Animated.View
        style={{ opacity: heroOpacity, transform: [{ translateY: heroSlide }] }}
      >
        <LinearGradient
          colors={["#5a9f2f", "#9BE36F", "#D4F5B8", "#fcfffa", "#ffffff"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={s.hero}
        >
          {/* Decorative circles */}
          <View style={s.heroBubble1} />
          <View style={s.heroBubble2} />
          <FoodGroup
            width={width + 10}
            height={320}
            style={{ position: "absolute", left: -5, top: 100, opacity: 0.85 }}
          />

          {/* Top bar */}
          <View style={s.topBar}>
            <View style={s.topCenter}>
              {currentUser && (
                <>
                  <Text weight="700" style={s.greetText}>
                    Hi, {currentUser.name?.split(" ")[0]}
                  </Text>
                  <Text weight="700" style={s.greetSubText}>
                    Your Today's Nutrition
                  </Text>
                </>
              )}
            </View>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={handleLogout}
              activeOpacity={0.75}
            >
              <Feather name="log-out" size={17} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Calorie ring — shown when goal set */}
          {isGoalSet ? (
            <>
              <View style={s.ringSection}>
                <View style={s.macroSide}>
                  <MiniMacroBar label="Protein" current={totalProtein} max={macroTargets.protein} color="#1C6BF3" />
                  <MiniMacroBar label="Fats" current={totalFat} max={macroTargets.fat} color="#F3C51C" />
                </View>
                <View style={s.ringWrap}>
                  <Svg width={160} height={160} viewBox="0 0 140 140">
                    <Circle cx="70" cy="70" r={RING_R} stroke="rgba(13,92,48,0.15)" strokeWidth="11" fill="none" />
                    <Circle cx="70" cy="70" r={RING_R} stroke="#087B08" strokeWidth="11" fill="none"
                      strokeDasharray={RING_CIRC} strokeDashoffset={ringOffset}
                      strokeLinecap="round" rotation="-90" origin="70,70" />
                  </Svg>
                  <View style={s.ringCenter}>
                    <Text weight="700" style={s.ringMainVal}>{Math.round(intakeCalories)} Kcal</Text>
                    <Text style={s.ringMainLabel}>/ {goalCalories} kcal</Text>
                    <TouchableOpacity onPress={() => navigation.navigate("NutritionSetGoal")} style={s.editGoalBtn}>
                      <Text weight="700" style={s.editGoalTxt}>Edit Goal</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={s.macroSide}>
                  <MiniMacroBar label="Carbs" current={totalCarbs} max={macroTargets.carbs} color="#F31C1C" />
                  <View style={{ height: 21 }} />
                </View>
              </View>

              <View style={s.quickRow}>
                <TouchableOpacity style={s.quickCard} onPress={() => setShowMealPicker(true)}>
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#E6FFE5", borderRadius: 10 }]} />
                  <SpoonFork width={20} height={20} />
                  <Text weight="700" style={[s.quickTitle, { color: "#118411" }]}>Log Meal</Text>
                  <Text style={[s.quickSub, { color: "#118411" }]}>Today: {totalMealsLogged} item{totalMealsLogged !== 1 ? "s" : ""} logged</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.quickCard} onPress={() => navigation.navigate("NutritionScan")}>
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#FFE7F4", borderRadius: 10 }]} />
                  <ScanIcon width={20} height={20} />
                  <Text weight="700" style={[s.quickTitle, { color: "#BD4E9C" }]}>Scan Food</Text>
                  <Text style={[s.quickSub, { color: "#D44797" }]}>Today: {scanCount} scanned</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.quickCard} onPress={() => navigation.navigate("NutritionBarcode")}>
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#FFFBE7", borderRadius: 10 }]} />
                  <BarcodeIcon width={20} height={20} />
                  <Text weight="700" style={[s.quickTitle, { color: "#E5960D" }]}>Scan Barcode</Text>
                  <Text style={[s.quickSub, { color: "#E5960D" }]}>{lastBarcodeItem ? `Last: ${lastBarcodeItem}` : "Tap to scan"}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            /* Hero idle state */
            <View style={s.heroIdle}>
              <Text weight="800" style={s.heroIdleTitle}>
                Track your meals to maintain{"\n"}a balanced diet.
              </Text>
              <TouchableOpacity
                style={s.viewPlateBtn}
                onPress={() => navigation.navigate("NutritionSetGoal")}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#93D056", "#35A329"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={s.viewPlateBtnInner}
                >
                  <Text weight="700" style={s.viewPlateBtnTxt}>Set Goal</Text>
                </LinearGradient>
              </TouchableOpacity>
                <View style={[s.quickRow, { paddingHorizontal: 0, width: "100%" }]}>
                  <TouchableOpacity style={s.quickCard} onPress={() => setShowMealPicker(true)}>
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#E6FFE5", borderRadius: 10 }]} />
                    <SpoonFork width={20} height={20} />
                    <Text weight="700" style={[s.quickTitle, { color: "#118411" }]}>Log Meal</Text>
                    <Text style={[s.quickSub, { color: "#118411" }]}>Today: {totalMealsLogged} item{totalMealsLogged !== 1 ? "s" : ""} logged</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={s.quickCard} onPress={() => navigation.navigate("NutritionScan")}>
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#FFE7F4", borderRadius: 10 }]} />
                    <ScanIcon width={20} height={20} />
                    <Text weight="700" style={[s.quickTitle, { color: "#BD4E9C" }]}>Scan Food</Text>
                    <Text style={[s.quickSub, { color: "#D44797" }]}>Today: {scanCount} scanned</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={s.quickCard} onPress={() => navigation.navigate("NutritionBarcode")}>
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#FFFBE7", borderRadius: 10 }]} />
                    <BarcodeIcon width={20} height={20} />
                    <Text weight="700" style={[s.quickTitle, { color: "#E5960D" }]}>Scan Barcode</Text>
                    <Text style={[s.quickSub, { color: "#E5960D" }]}>{lastBarcodeItem ? `Last: ${lastBarcodeItem}` : "Tap to scan"}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => navigation.navigate("NutritionSetGoal")}
                  activeOpacity={0.85}
                  style={{ marginTop: 12, width: "100%" }}
                >
                  <CalorieTargetCard width="100%" height={137} />
                </TouchableOpacity>
            </View>
          )}
        </LinearGradient>
      </Animated.View>

      {/* ══════════════════════════════════════
          GOAL BANNER  (no goal set)
      ══════════════════════════════════════ */}
      {!isGoalSet && (
        <StaggerItem delay={100}>
          <View style={s.goalBanner}>
            <View style={s.goalBannerIcon}>
              <NutritionSetGoalSVG width={48} height={48} />
            </View>
            <View style={s.goalBannerText}>
              <Text weight="700" style={s.goalBannerTitle}>
                Set your daily goal
              </Text>
              <Text style={s.goalBannerSub}>
                Enable personalised nutrition tracking
              </Text>
            </View>
            <PressScale onPress={() => navigation.navigate("NutritionSetGoal")}>
              <LinearGradient
                colors={[C.primaryLight, C.primaryDark]}
                style={s.goalBannerBtn}
              >
                <Text weight="700" style={s.goalBannerBtnTxt}>
                  Set Goal
                </Text>
              </LinearGradient>
            </PressScale>
          </View>
        </StaggerItem>
      )}

      {/* ══════════════════════════════════════
          TODAY'S MEALS  (goal set)
      ══════════════════════════════════════ */}
      {isGoalSet && (
        <>
          {/* Section header */}
          <StaggerItem delay={80}>
            <SectionHead title="Today's Meals" />
          </StaggerItem>

          {/* Meal tabs */}
          <StaggerItem delay={120}>
            <View style={[s.mealTabRow, { flexDirection: "row", justifyContent: "space-between" }]}>
              {MEAL_META.map((m) => {
                const isActive = activeMealTab === m.title;
                return (
                  <TouchableOpacity
                    key={m.title}
                    style={[s.mealTab]}
                    onPress={() => setActiveMealTab(m.title)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.mealTabIconWrap, { backgroundColor: isActive ? m.iconBg : "#F3F4F6" }]}>
                      <m.img width={28} height={28} />
                    </View>
                    <Text weight={isActive ? "700" : "500"} style={[s.mealTabLabel, isActive && { color: m.accent }]}>
                      {m.title}
                    </Text>
                    {(() => {
                      const cal = (mealTray[m.title] || []).reduce(
                        (s, x) => s + (x.calories || 0) * (x.quantity || 1), 0
                      );
                      return cal > 0 ? (
                        <Text style={[s.mealTabCal, { color: m.accent }]}>{Math.round(cal)} kcal</Text>
                      ) : null;
                    })()}
                    {isActive && <View style={[s.mealTabIndicator, { backgroundColor: m.accent }]} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </StaggerItem>

          {/* Logged items for active tab */}
          <StaggerItem delay={160}>
            <View style={s.mealItemsWrap}>
              {(mealTray[activeMealTab] || []).length === 0 ? (
                <View style={s.mealEmptyWrap}>
                  <Feather name="inbox" size={22} color={C.textMuted} />
                  <Text style={s.mealEmptyTxt}>Nothing logged for {activeMealTab} yet</Text>
                </View>
              ) : (
                <>
                  {(mealTray[activeMealTab] || []).map((item, i) => (
                    <View key={i} style={s.mealLogItem}>
                      <View style={s.mealLogDot} />
                      <View style={{ flex: 1 }}>
                        <Text weight="600" style={s.mealLogName}>{item.name}</Text>
                        <Text style={s.mealLogMeta}>
                          {(item.calories || 0) * (item.quantity || 1)} kcal · {item.quantity || 1}×
                        </Text>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={s.viewPlateBtn}
                    onPress={() => navigation.navigate("NutritionPlate", { mealType: activeMealTab })}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={["#93D056", "#35A329"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={s.viewPlateBtnInner}
                    >
                      <Text weight="700" style={s.viewPlateBtnTxt}>View Plate</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </StaggerItem>
        </>
      )}

      {/* ══════════════════════════════════════
          WEEKLY NUTRITION TREND + INSIGHTS
      ══════════════════════════════════════ */}
      <StaggerItem delay={isGoalSet ? 220 : 160}>
        <SectionHead
          title="This Week"
          action={() => navigation.navigate("NutritionStats")}
          actionLabel="View Stats"
        />
      </StaggerItem>

      <WeeklyNutritionTrend
        goalCalories={goalCalories}
        macroTargets={macroTargets}
      />

      {/* ══════════════════════════════════════
          CONSULT BANNER
      ══════════════════════════════════════ */}
      <StaggerItem delay={isGoalSet ? 320 : 240}>
        <View style={s.consultPad}>
          <PressScale onPress={() => navigation.navigate("Consultation")}>
            <LinearGradient
              colors={[C.primaryDark, "#0D6633"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.consultCard}
            >
              {/* Left content */}
              <View style={s.consultLeft}>
                <View style={s.consultIconWrap}>
                  <Ionicons name="medkit-outline" size={20} color="#fff" />
                </View>
                <View>
                  <Text weight="700" style={s.consultTitle}>
                    Talk to a Dietitian
                  </Text>
                  <Text style={s.consultSub}>Get personalised guidance</Text>
                </View>
              </View>
              {/* Arrow */}
              <View style={s.consultArrow}>
                <Feather name="arrow-right" size={18} color="#fff" />
              </View>
            </LinearGradient>
          </PressScale>
        </View>
      </StaggerItem>
      {/* Meal Type Picker Modal */}
<Modal
  visible={showMealPicker}
  transparent
  animationType="slide"
  onRequestClose={() => setShowMealPicker(false)}
>
  <TouchableOpacity
    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
    activeOpacity={1}
    onPress={() => setShowMealPicker(false)}
  />
  <View style={{
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  }}>
    <Text weight="700" style={{ fontSize: 17, color: C.text, marginBottom: 16 }}>
      What meal are you logging?
    </Text>
    {MEAL_META.map((m) => (
      <TouchableOpacity
        key={m.title}
        onPress={() => {
          setShowMealPicker(false);
          navigation.navigate("NutritionAddDiet", { mealType: m.title });
        }}
        activeOpacity={0.8}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: m.iconBg, alignItems: "center", justifyContent: "center" }}>
          <m.img width={26} height={26} />
        </View>
        <Text weight="600" style={{ fontSize: 15, color: C.text, flex: 1 }}>{m.title}</Text>
        <Feather name="chevron-right" size={16} color={C.textMuted} />
      </TouchableOpacity>
    ))}
  </View>
</Modal>
    </ScrollView>
  );
};

export default NutritionHomeRN;

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },

  // ── Hero ──────────────────────────────────
  hero: {
    paddingTop: 140,
    paddingHorizontal: 20,
    paddingBottom: 16,
    overflow: "hidden",
  },
  heroBubble1: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.04)",
    top: -60,
    right: -60,
  },
  heroBubble2: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: -30,
    left: -30,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    zIndex: 2,
    paddingLeft: 40,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "rgba(13,92,48,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  topCenter: { flex: 1, alignItems: "center" },
  dateLabel: {
    fontSize: 22,
    color: "rgba(20,80,20,0.6)",
    textAlign: "center",
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  greetText: { fontSize: isSmall ? 17 : 20, color: "#1A4A0F", textAlign: "center" },
  greetSubText: { fontSize: 13, color: "#118411", textAlign: "center" },

  // Hero idle
  heroIdle: { alignItems: "center", paddingVertical: 24, gap: 12 },
  heroIdleIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
heroIdleTitle: {
  fontSize: isSmall ? 20 : 24,
  color: "#1A5C0F",
  textAlign: "center",
  lineHeight: 32,
},
  heroIdleSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.68)",
    textAlign: "center",
  },

  // Calorie ring
  ringSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    zIndex: 2,
    paddingHorizontal: 8,
  },
  ringWrap: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: { position: "absolute", alignItems: "center", gap: 2 },
  ringMainVal: {
    fontSize: isSmall ? 16 : 18,
    color: "#0D5C30",
    lineHeight: isSmall ? 28 : 32,
  },
  ringMainLabel: { fontSize: 11, color: "rgba(20,80,20,0.6)" },
  ringPctBadge: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: "rgba(13,92,48,0.12)",
  },
  ringPctTxt: { fontSize: 11, color: "#0D5C30" },
  editGoalBtn: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: "#35A329",
  },
  editGoalTxt: { color: "#fff", fontSize: 8 },

  // Stats strip
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(13,92,48,0.08)",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 0,
    width: "100%",
  },
  statItem: { flex: 1, alignItems: "center" },
  statVal: { fontSize: isSmall ? 15 : 17, color: "#0D5C30" },
  statLabel: {
    fontSize: 10,
    color: "rgba(20,80,20,0.55)",
    marginTop: 3,
    letterSpacing: 0.2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(13,92,48,0.15)",
  },

  // ── Goal banner ──────────────────────────
  goalBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  goalBannerIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  goalBannerText: { flex: 1 },
  goalBannerTitle: { fontSize: 14, color: C.text, marginBottom: 3 },
  goalBannerSub: { fontSize: 12, color: C.textMuted },
  goalBannerBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  goalBannerBtnTxt: { color: "#fff", fontSize: 13 },

  // ── Section header ────────────────────────
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: "#ffffff",
  },
  sectionTitle: { fontSize: isSmall ? 16 : 18, color: C.text },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 2 },
  sectionActionTxt: { fontSize: 13, color: C.primary },

  // ── Chip row ─────────────────────────────
  chipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    gap: 10,
  },
  chip: { flex: 1 },
  chipCard: {
    borderRadius: 16,
    padding: isSmall ? 12 : 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipIconRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  chipIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  chipBigVal: { fontSize: isSmall ? 24 : 28, lineHeight: isSmall ? 28 : 34 },
  chipUnit: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 1,
    marginBottom: 10,
  },
  chipTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  chipTagTxt: { color: "#fff", fontSize: 10 },
  illustBox: {
    width: isSmall ? 100 : 118,
    height: isSmall ? 100 : 118,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  // ── Macro card ────────────────────────────
  macroCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    borderWidth: 1,
    borderColor: C.border,
  },
  macroCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  macroCardTitle: { fontSize: isSmall ? 14 : 15, color: C.text },
  macroCardLink: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: C.primaryGhost,
  },
  macroCardLinkTxt: { fontSize: 12, color: C.primary },
  macroSeparator: { height: 1, backgroundColor: C.border, marginBottom: 12 },

  // Per-macro row
  macroItem: { marginBottom: 12 },
  macroLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 6,
  },
  macroDot: { width: 7, height: 7, borderRadius: 3.5 },
  macroLabel: { flex: 1, fontSize: 13, color: C.textSub },
  macroCurrentVal: { fontSize: 13 },
  macroMaxVal: { fontSize: 12, color: C.textMuted },
  macroTrack: {
    height: 7,
    backgroundColor: C.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  macroFill: { height: "100%", borderRadius: 4 },

  // ── Scan cards ────────────────────────────
  scanRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 6,
  },
  scanCard: {
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  scanIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  scanCardTitle: {
    color: "#fff",
    fontSize: isSmall ? 13 : 14,
    marginBottom: 2,
  },
  scanCardSub: { color: "rgba(255,255,255,0.62)", fontSize: 11 },
  scanArrow: { marginLeft: "auto" },

  // ── Consult banner ────────────────────────
  consultPad: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 32 },
  consultCard: {
    borderRadius: 18,
    padding: isSmall ? 14 : 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  consultLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  consultIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  consultTitle: { color: "#fff", fontSize: isSmall ? 15 : 16, marginBottom: 3 },
  consultSub: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  consultArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // ── Mini macro bars (ring section) ───────
  macroSide: { width: 75, gap: 10, alignItems: "center" },
  miniMacro: { width: 65, gap: 3 },
  miniMacroLabelRow: { flexDirection: "column", gap: 1 },
  miniMacroName: { fontSize: 8, color: "#1A4A0F", fontWeight: "700" },
  miniMacroVal: { fontSize: 8, color: "rgba(0,0,0,0.65)" },
  miniTrack: { height: 12, backgroundColor: "rgba(255,255,255,0.6)", borderRadius: 8, overflow: "hidden" },
  miniFill: { height: "100%", borderRadius: 8 },

  // ── Quick action row ─────────────────────
  quickRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 16,
    marginBottom: 0,
    justifyContent: "space-between",
  },
  quickCard: {
    flex: 1,
    height: 90,
    borderRadius: 10,
    overflow: "hidden",
    padding: 10,
    justifyContent: "center",
    gap: 2,
  },
  quickTitle: { fontSize: 14, fontWeight: "700" },
  quickSub: { fontSize: 8 },

  // ── Meal tabs ────────────────────────────
  mealTabRow: {
    paddingLeft: 16,
    paddingRight: 16,
    gap: 8,
    paddingBottom: 4,
  },
  mealTab: {
    alignItems: "center",
    paddingBottom: 8,
    paddingHorizontal: 6,
    position: "relative",
    minWidth: 72,
  },
  mealTabIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  mealTabLabel: { fontSize: 13, color: C.textSub },
  mealTabCal: { fontSize: 10, marginTop: 2 },
  mealTabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 6,
    right: 6,
    height: 3,
    borderRadius: 2,
  },

  // ── Meal log items ────────────────────────
  mealItemsWrap: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  mealEmptyWrap: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  mealEmptyTxt: { fontSize: 13, color: C.textMuted },
  mealEmptyBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: C.primaryGhost,
  },
  mealEmptyBtnTxt: { fontSize: 13, color: C.primary },
  mealLogItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  mealLogDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primary,
  },
  mealLogName: { fontSize: 14, color: C.text },
  mealLogMeta: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  viewPlateBtn: {
    alignSelf: "center",
    marginVertical: 12,
    borderRadius: 20,
    overflow: "hidden",
  },
  viewPlateBtnInner: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  viewPlateBtnTxt: { color: "#fff", fontSize: 14 },
});

// ─────────────────────────────────────────────
// WEEKLY TREND STYLES
// ─────────────────────────────────────────────
const wt = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 16, color: C.text },
  viewBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  viewTxt: { fontSize: 13, color: C.primary },

  chartArea: { flexDirection: "row", alignItems: "flex-end" },
  yAxis: {
    width: 36,
    height: 140,
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingRight: 6,
    paddingBottom: 20,
  },
  yLabel: { fontSize: 9, color: C.textMuted },

  barsRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  barCol: { alignItems: "center", flex: 1 },
  barWrap: {
    justifyContent: "flex-end",
    alignItems: "center",
    position: "relative",
  },
  barStack: {
    width: 22,
    justifyContent: "flex-end",
    borderRadius: 5,
    overflow: "hidden",
  },
  seg: { width: "100%" },
  goalLine: {
    position: "absolute",
    left: -2,
    right: -2,
    height: 1.5,
    backgroundColor: "#FF6B6B",
    borderRadius: 1,
  },
  dayLabel: { fontSize: 10, color: C.textMuted, marginTop: 5 },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.primary,
    marginTop: 2,
  },

  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginTop: 12,
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  goalLineLegend: {
    width: 14,
    height: 2,
    backgroundColor: "#FF6B6B",
    borderRadius: 1,
  },
  legendTxt: { fontSize: 11, color: C.textSub },

  // Insight card
  insightCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    overflow: "hidden",
  },
  insightGrad: { padding: 18, borderRadius: 18 },
  insightTitle: { fontSize: 15, color: "#4B2D8F", marginBottom: 10 },
  insightTxt: { fontSize: 13, color: "#5A4080", marginBottom: 4, lineHeight: 18 },
  insightBtn: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
  },
  insightBtnTxt: { color: "#fff", fontSize: 13 },
  heroIdleBtn: {
  paddingVertical: 12,
  paddingHorizontal: 40,
  borderRadius: 25,
  marginTop: 8,
},
heroIdleBtnTxt: {
  color: "#fff",
  fontSize: 15,
},
});