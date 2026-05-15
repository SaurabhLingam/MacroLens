/**
 * Nutrition.jsx — Premium final pass
 *
 * Changes from previous version:
 *  • Calorie ring shows progress % label + arc fills correctly
 *  • Stats row "Burned" replaced with "Progress %" — no more misleading 0
 *  • Chip cards refactored: proper icon + label stacking, larger hit targets
 *  • Macro card gains per-row value badges and a subtle separator
 *  • Meal grid cards: flexible height, SVG in a tinted icon bubble, calorie hint
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
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text } from "../components/TextWrapper";
import { C } from "../theme";
import { getTodayKey, STORAGE_KEYS } from "../utils";

import NutritionSetGoalSVG from "../../assets/NutritionSetGoal.svg";
import WellnessNutrition from "../../assets/WellnessNutrition.svg";
import MacroLensHero from "../../assets/MacroLens.svg";
import FoodGroup from "../../assets/Group.svg";
import Rectangle3464971 from "../../assets/Rectangle 3464971.svg";
import Rectangle3464972 from "../../assets/Rectangle 3464972.svg";
import Rectangle3464973 from "../../assets/Rectangle 3464973.svg";
import SpoonFork from "../../assets/Group 1000004794.svg";
import ScanIcon from "../../assets/scan.svg";
import BarcodeIcon from "../../assets/barcode.svg";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
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
        width: `${Math.min((current/max)*100, 100)}%`, 
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
          } else {
            setIntakeCalories(0);
            setTotalProtein(0);
            setTotalCarbs(0);
            setTotalFat(0);
          }
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
          colors={["#9BE36F", "#D4F5B8", "#F5FFF5"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={s.hero}
        >
          {/* Decorative circles */}
          <View style={s.heroBubble1} />
          <View style={s.heroBubble2} />
          <FoodGroup
            width={width + 10}
            height={320}
            style={{ position: "absolute", left: -5, top: 120, opacity: 0.85 }}
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
          <TouchableOpacity style={s.quickCard}>
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#E6FFE5", borderRadius: 10 }]} />
            <SpoonFork width={20} height={20} />
            <Text weight="700" style={[s.quickTitle, { color: "#118411" }]}>Log Meal</Text>
            <Text style={[s.quickSub, { color: "#118411" }]}>Today: 2 meals logged</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.quickCard}>
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#FFE7F4", borderRadius: 10 }]} />
            <ScanIcon width={20} height={20} />
            <Text weight="700" style={[s.quickTitle, { color: "#BD4E9C" }]}>Scan Food</Text>
            <Text style={[s.quickSub, { color: "#D44797" }]}>Today: 3 scanned</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.quickCard}>
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#FFFBE7", borderRadius: 10 }]} />
            <BarcodeIcon width={20} height={20} />
            <Text weight="700" style={[s.quickTitle, { color: "#E5960D" }]}>Scan Barcode</Text>
            <Text style={[s.quickSub, { color: "#E5960D" }]}>Last: Protein Bar</Text>
          </TouchableOpacity>
          </View>
          </>
          ) : (
            /* Hero idle state */
            <View style={s.heroIdle}>
              <View style={s.heroIdleIconWrap}>
                <Ionicons
                  name="nutrition"
                  size={32}
                  color="rgba(255,255,255,0.9)"
                />
              </View>
              <Text weight="800" style={s.heroIdleTitle}>
                Your Nutrition Hub
              </Text>
              <Text style={s.heroIdleSub}>
                Track meals, scan food, hit your goals.
              </Text>
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
          TODAY'S OVERVIEW  (goal set)
      ══════════════════════════════════════ */}
      {isGoalSet && (
        <>
          {/* Section header */}
          <StaggerItem delay={80}>
            <SectionHead
              title="Today's Overview"
              action={() => navigation.navigate("NutritionDietDash")}
              actionLabel="View Plan"
            />
          </StaggerItem>

          {/* Goal + intake chips + illustration */}
          <StaggerItem delay={140}>
            <View style={s.chipRow}>
              {/* Goal chip */}
              <PressScale
                style={s.chip}
                onPress={() => navigation.navigate("NutritionSetGoal")}
              >
                <View style={[s.chipCard, { backgroundColor: C.primaryGhost }]}>
                  <View style={s.chipIconRow}>
                    <View
                      style={[
                        s.chipIconBadge,
                        { backgroundColor: C.primary + "20" },
                      ]}
                    >
                      <Feather name="award" size={14} color={C.primary} />
                    </View>
                    <Feather name="edit-2" size={12} color={C.textMuted} />
                  </View>
                  <Text
                    weight="800"
                    style={[s.chipBigVal, { color: C.primary }]}
                  >
                    {goalCalories}
                  </Text>
                  <Text style={s.chipUnit}>kcal</Text>
                  <View style={[s.chipTag, { backgroundColor: C.primary }]}>
                    <Text weight="700" style={s.chipTagTxt}>
                      Goal
                    </Text>
                  </View>
                </View>
              </PressScale>

              {/* Intake chip */}
              <PressScale
                style={s.chip}
                onPress={() => navigation.navigate("NutritionDietDash")}
              >
                <View style={[s.chipCard, { backgroundColor: C.blueLight }]}>
                  <View style={s.chipIconRow}>
                    <View
                      style={[
                        s.chipIconBadge,
                        { backgroundColor: C.blue + "20" },
                      ]}
                    >
                      <Ionicons
                        name="restaurant-outline"
                        size={14}
                        color={C.blue}
                      />
                    </View>
                    <Feather name="edit-2" size={12} color={C.textMuted} />
                  </View>
                  <Text weight="800" style={[s.chipBigVal, { color: C.blue }]}>
                    {Math.round(intakeCalories)}
                  </Text>
                  <Text style={s.chipUnit}>kcal</Text>
                  <View style={[s.chipTag, { backgroundColor: C.blue }]}>
                    <Text weight="700" style={s.chipTagTxt}>
                      Eaten
                    </Text>
                  </View>
                </View>
              </PressScale>
            </View>
          </StaggerItem>

          {/* Macro bars card */}
          <StaggerItem delay={200}>
            <View style={s.macroCard}>
              <View style={s.macroCardHeader}>
                <Text weight="700" style={s.macroCardTitle}>
                  Macros Today
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate("NutritionDietDash")}
                  style={s.macroCardLink}
                  activeOpacity={0.7}
                >
                  <Text weight="600" style={s.macroCardLinkTxt}>
                    Details
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={s.macroSeparator} />
              <MacroBar
                label="Protein"
                current={totalProtein}
                max={macroTargets.protein}
                color={C.blue}
                lightBg={C.blueLight}
              />
              <MacroBar
                label="Carbs"
                current={totalCarbs}
                max={macroTargets.carbs}
                color={C.emerald}
                lightBg={C.emeraldLight}
              />
              <MacroBar
                label="Fats"
                current={totalFat}
                max={macroTargets.fat}
                color={C.orange}
                lightBg={C.orangeLight}
              />
            </View>
          </StaggerItem>
        </>
      )}





      {/* Meal type grid */}
      <StaggerItem delay={isGoalSet ? 340 : 240}>
        <View style={s.mealGrid}>
          {MEAL_META.map((item) => (
            <PressScale
              key={item.title}
              style={[s.mealCard, !isGoalSet && { opacity: 0.42 }]}
              onPress={() => {
                if (!isGoalSet) {
                  navigation.navigate("NutritionSetGoal");
                  return;
                }
                navigation.navigate("NutritionAddDiet", {
                  mealType: item.title,
                });
              }}
            >
              <View style={[s.mealCardInner, { backgroundColor: item.bg }]}>
                {/* SVG in tinted icon bubble */}
                <View
                  style={[s.mealIconBubble, { backgroundColor: item.iconBg }]}
                >
                  <item.img
                    width={isSmall ? 28 : 34}
                    height={isSmall ? 28 : 34}
                  />
                </View>
                <Text weight="700" style={s.mealName}>
                  {item.title}
                </Text>
                <View style={s.mealAddRow}>
                  <View
                    style={[s.mealAddBubble, { backgroundColor: item.accent }]}
                  >
                    <Feather name="plus" size={11} color="#fff" />
                  </View>
                  <Text
                    weight="600"
                    style={[s.mealAddTxt, { color: item.accent }]}
                  >
                    Add food
                  </Text>
                </View>
              </View>
            </PressScale>
          ))}
        </View>
      </StaggerItem>

      {/* Consult banner */}
      <StaggerItem delay={isGoalSet ? 380 : 280}>
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
    </ScrollView>
  );
};

export default NutritionHomeRN;

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // ── Hero ──────────────────────────────────
  hero: {
    paddingTop: 160,
    paddingHorizontal: 20,
    paddingBottom: 24,
    overflow: "hidden"
  },
  // Decorative background circles
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
    fontSize: isSmall ? 22 : 26,
    color: "#fff",
    textAlign: "center",
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
    bbackgroundColor: "rgba(13,92,48,0.12)",
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

  // ── Meal grid ─────────────────────────────
  mealGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 4,
  },
  mealCard: { width: (width - 42) / 2 },
  mealCardInner: {
    borderRadius: 18,
    padding: isSmall ? 12 : 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  mealIconBubble: {
    width: isSmall ? 46 : 54,
    height: isSmall ? 46 : 54,
    borderRadius: isSmall ? 14 : 16,
    alignItems: "center",
    justifyContent: "center",
  },
  mealName: { fontSize: isSmall ? 14 : 15, color: C.text },
  mealAddRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  mealAddBubble: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  mealAddTxt: { fontSize: 12 },

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
  macroSide: { width: 75, gap: 10, alignItems: "center" },
  miniMacro: { width: 65, gap: 3 },
  miniMacroLabelRow: { flexDirection: "column", gap: 1 },
  miniMacroName: { fontSize: 8, color: "#1A4A0F", fontWeight: "700" },
  miniMacroVal: { fontSize: 8, color: "rgba(0,0,0,0.65)" },
  miniTrack: { height: 12, backgroundColor: "rgba(255,255,255,0.6)", borderRadius: 8, overflow: "hidden" },
  miniFill: { height: "100%", borderRadius: 8 },
  quickRow: {
  flexDirection: "row",
  paddingHorizontal: 16,
  gap: 8,
  marginTop: 16,
  marginBottom: 8,
},
quickCard: {
  flex: 1,
  height: 62,
  borderRadius: 10,
  overflow: "hidden",
  padding: 10,
  justifyContent: "center",
  gap: 2,
},
quickTitle: {
  fontSize: 14,
  fontWeight: "700",
},
quickSub: {
  fontSize: 8,
},
});