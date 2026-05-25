/**
 * NutritionPlate.jsx — Redesigned to match Health Wellness reference screenshot
 *
 * Design:
 *  • Flat white header — purple back arrow (bare, no container), bold purple title,
 *    small dark-gray subtitle ("Your today's plate")
 *  • Calories Intake card with macro legend rows + donut progress ring
 *  • Food cards: image left, name + quantity dropdown, circular multi-ring calorie badge right
 *  • Purple pencil edit icon top-right of each card
 *  • Bottom bar: "Scan Food" | divider | "Scan Barcode" — green text, same green as SetGoal
 *  • Empty state preserved
 *  • All logic, navigation, AsyncStorage calls preserved exactly
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, MaterialIcons, Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Text } from "../components/TextWrapper";
import { C } from "../theme";
import {
  normalizeMealType,
  getTodayKey,
  ensureMealsShape,
} from "../utils";
import HeaderVeggies from "../../assets/Group 1000004769.svg";

const { width } = Dimensions.get("window");
const isSmall = width < 380;

// ── Brand colors ───────────────────────────────
const PURPLE = "#553FB5";
const GREEN_DARK = "#35A329";
const GREEN_LIGHT = "#93D056";

// ── Meal-type metadata ─────────────────────────
const MEAL_META = {
  Breakfast: { accent: "#4CAF50", icon: "sunny-outline" },
  Lunch:     { accent: "#2196F3", icon: "restaurant-outline" },
  Snacks:    { accent: "#FF9800", icon: "leaf-outline" },
  Dinner:    { accent: PURPLE,    icon: "moon-outline" },
};

// ── Macro ring segments (colors matching screenshot) ──
const MACRO_COLORS = {
  protein: "#2196F3",
  carbs:   "#F44336",
  fats:    "#FFC107",
  fibres:  "#4CAF50",
};

// ── Multi-color donut calorie badge ───────────────
const CalorieBadge = ({ calories, size = 72 }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const segments = [
    { color: "#2196F3", pct: 0.28 },
    { color: "#F44336", pct: 0.25 },
    { color: "#FFC107", pct: 0.22 },
    { color: "#4CAF50", pct: 0.25 },
  ];
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        {/* Background ring */}
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="#F0F0F0" strokeWidth={5} fill="none"
        />
        {segments.map((seg, i) => {
          const dash = seg.pct * circ;
          const gap = circ - dash;
          const rot = -90 + (offset / 1) * 360;
          offset += seg.pct;
          return (
            <Circle
              key={i}
              cx={size / 2} cy={size / 2} r={r}
              stroke={seg.color}
              strokeWidth={5}
              fill="none"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-(offset - seg.pct) * circ}
              transform={`rotate(-90, ${size / 2}, ${size / 2})`}
            />
          );
        })}
      </Svg>
      <Text weight="800" style={{ fontSize: isSmall ? 14 : 16, color: "#1A1A1A", lineHeight: 20 }}>
        {calories}
      </Text>
      <Text style={{ fontSize: 9, color: "#888", marginTop: 1 }}>Cal</Text>
    </View>
  );
};

// ── Calories Intake summary card ───────────────
const CaloriesIntakeCard = ({ items, calorieGoal = 2000 }) => {
  const totalCal  = Math.round(items.reduce((s, x) => s + (x.calories || 0) * (x.quantity || 1), 0));
  const totalProt = items.reduce((s, x) => s + (x.protein || 0) * (x.quantity || 1), 0);
  const totalCarb = items.reduce((s, x) => s + (x.carbs   || 0) * (x.quantity || 1), 0);
  const totalFat  = items.reduce((s, x) => s + (x.fat     || 0) * (x.quantity || 1), 0);

  const goal = calorieGoal || 2000;
  const pct  = Math.min(totalCal / goal, 1);
  const size = 100;
  const r    = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  const macroRows = [
    { label: "Protein", val: totalProt, goal: 50, color: MACRO_COLORS.protein },
    { label: "Carbs",   val: totalCarb, goal: 50, color: MACRO_COLORS.carbs   },
    { label: "Fats",    val: totalFat,  goal: 50, color: MACRO_COLORS.fats    },
    { label: "Fibres",  val: 0,         goal: 50, color: MACRO_COLORS.fibres  },
  ];

  return (
    <View style={q.intakeCard}>
      <Text weight="700" style={q.intakeTitle}>Calories Intake</Text>
      <View style={q.intakeBody}>
        {/* Macro legend grid */}
        <View style={q.macroGrid}>
          {macroRows.map((m) => (
            <View key={m.label} style={q.macroRow}>
              <View style={[q.macroDot, { backgroundColor: m.color }]} />
              <Text style={q.macroLabelTxt}>{m.label}</Text>
              <Text weight="600" style={q.macroValTxt}>
                {m.val.toFixed(0)}/{m.goal}g
              </Text>
            </View>
          ))}
        </View>

        {/* Donut ring */}
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <Svg width={size} height={size} style={{ position: "absolute" }}>
            <Circle
              cx={size / 2} cy={size / 2} r={r}
              stroke="#E8F5E9" strokeWidth={10} fill="none"
            />
            <Circle
              cx={size / 2} cy={size / 2} r={r}
              stroke={GREEN_DARK}
              strokeWidth={10}
              fill="none"
              strokeDasharray={`${dash} ${circ - dash}`}
              transform={`rotate(-90, ${size / 2}, ${size / 2})`}
              strokeLinecap="round"
            />
          </Svg>
          <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
            <Text weight="800" style={q.donutVal}>{totalCal}</Text>
            <Text style={q.donutSub}>/{goal}</Text>
            <Text style={q.donutUnit}>kcal</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// ── Food card ──────────────────────────────────
const FoodCard = ({ item, index, onEdit, onDelete }) => {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, speed: 16, bounciness: 3, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const itemCal = Math.round((item.calories || 0) * (item.quantity || 1));
  const qty     = item.quantity || 1;

  return (
    <Animated.View style={[q.foodCard, { opacity, transform: [{ translateY }] }]}>
      {/* Time label */}
      <Text style={q.timeLabel}>7:30 am</Text>

      <View style={q.foodCardInner}>
        {/* Food image */}
        <View style={q.foodImgWrap}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={q.foodImg} />
          ) : (
            <View style={[q.foodImg, q.foodImgFallback]}>
              <Ionicons name="restaurant-outline" size={26} color="#ccc" />
            </View>
          )}
        </View>

        {/* Content */}
        <View style={q.foodMid}>
          <Text weight="700" style={q.foodName} numberOfLines={1}>{item.name}</Text>
          <View style={q.qtyRow}>
            <Text style={q.qtyLabel}>Quantity  {qty}</Text>
            <Feather name="chevron-down" size={14} color={GREEN_DARK} />
          </View>
        </View>

        {/* Edit icon */}
        <TouchableOpacity style={q.editBtn} onPress={onEdit} activeOpacity={0.7}>
          <Feather name="edit-2" size={15} color={PURPLE} />
        </TouchableOpacity>

        {/* Calorie badge */}
        <CalorieBadge calories={itemCal} size={isSmall ? 64 : 72} />
      </View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────
const NutritionPlate = () => {
  const navigation = useNavigation();
  const route      = useRoute();
  const mealType   = normalizeMealType(route.params?.mealType);
  const meta       = MEAL_META[mealType] || MEAL_META.Snacks;

  const [items, setItems]           = useState([]);
  const [calorieGoal, setCalorieGoal] = useState(2000);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  // ── Load ──────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(getTodayKey());
        if (raw) {
          const parsed = JSON.parse(raw);
          ensureMealsShape(parsed);
          setItems(parsed.meals?.[mealType] || []);
        }
        const goalRaw = await AsyncStorage.getItem("calorieGoalData");
        if (goalRaw) {
          const g = JSON.parse(goalRaw);
          setCalorieGoal(g.calorieGoal || 2000);
        }
      } catch (err) {
        console.log("Error loading plate:", err);
      }
    };
    load();
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
      log.totalCalories = allMeals.reduce((s, x) => s + (x.calories || 0) * (x.quantity || 1), 0);
      log.totalProtein  = allMeals.reduce((s, x) => s + (x.protein  || 0) * (x.quantity || 1), 0);
      log.totalCarbs    = allMeals.reduce((s, x) => s + (x.carbs    || 0) * (x.quantity || 1), 0);
      log.totalFat      = allMeals.reduce((s, x) => s + (x.fat      || 0) * (x.quantity || 1), 0);
      await AsyncStorage.setItem(key, JSON.stringify(log));
    } catch (err) {
      console.log("Error removing item:", err);
    }
  };

  const totalItems = items.length;

  // ─── RENDER ─────────────────────────────────
  return (
    <View style={q.page}>
      {/* ══ HEADER ══════════════════════════════ */}
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

          {/* ══ HEADER VEGGIES BANNER ════════════ */}
          <HeaderVeggies
            width={width}
            height={90}
            preserveAspectRatio="xMidYMid slice"
          />

          {/* ══ CALORIES INTAKE CARD ════════════ */}
          <CaloriesIntakeCard items={items} calorieGoal={calorieGoal} />

          {/* ══ MEAL SECTION HEADER ═════════════ */}
          <Text weight="700" style={q.sectionHeader}>{mealType} Plate</Text>

          {/* ══ EMPTY STATE ═════════════════════ */}
          {totalItems === 0 && (
            <View style={q.emptyState}>
              <View style={[q.emptyIconWrap, { backgroundColor: meta.accent + "18" }]}>
                <Ionicons name={meta.icon} size={36} color={meta.accent} />
              </View>
              <Text weight="700" style={q.emptyTitle}>Your {mealType} plate is empty</Text>
              <Text style={q.emptySubtitle}>
                Add food items to track calories and macronutrients for this meal.
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigation.navigate("NutritionAddDiet", { mealType })}
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

          {/* ══ FOOD CARDS ══════════════════════ */}
          {items.map((item, idx) => (
            <FoodCard
              key={item.id}
              item={item}
              index={idx}
              onEdit={() => navigation.navigate("NutritionAddDiet", { mealType })}
              onDelete={() => removeItem(item.id)}
            />
          ))}
        </Animated.View>
      </ScrollView>

      {/* ══ BOTTOM BAR ══════════════════════════ */}
      <View style={q.bottomBar}>
        <TouchableOpacity
          style={q.bottomBtn}
          activeOpacity={0.75}
          onPress={() => navigation.navigate("ScanFood", { mealType })}
        >
          <Text weight="600" style={q.bottomBtnTxt}>Scan Food</Text>
        </TouchableOpacity>

        <View style={q.bottomDivider} />

        <TouchableOpacity
          style={q.bottomBtn}
          activeOpacity={0.75}
          onPress={() => navigation.navigate("ScanBarcode", { mealType })}
        >
          <Text weight="600" style={q.bottomBtnTxt}>Scan Barcode</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default NutritionPlate;

// ── Styles ─────────────────────────────────────────
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
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, color: PURPLE },
  headerSub:   { fontSize: 12, color: "#333", marginTop: 2 },

  // ── Calories Intake card ──
  intakeCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    margin: 16,
    marginTop: -20,
    marginBottom: 8,
    zIndex: 1,  
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  intakeTitle: { fontSize: 15, color: "#1A1A1A", marginBottom: 14 },
  intakeBody:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  macroGrid:   { flex: 1, gap: 10, paddingRight: 8 },
  macroRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  macroDot:    { width: 10, height: 10, borderRadius: 5 },
  macroLabelTxt: { fontSize: 12, color: "#555", flex: 1 },
  macroValTxt:   { fontSize: 12, color: "#1A1A1A" },

  donutVal:  { fontSize: isSmall ? 15 : 18, color: "#1A1A1A", lineHeight: 22 },
  donutSub:  { fontSize: 11, color: "#888" },
  donutUnit: { fontSize: 10, color: "#aaa" },

  // ── Section header ──
  sectionHeader: {
    fontSize: 16,
    color: "#1A1A1A",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
  },

  // ── Food card ──
  foodCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  timeLabel:     { fontSize: 11, color: "#999", marginBottom: 8 },
  foodCardInner: { flexDirection: "row", alignItems: "center", gap: 12 },

  foodImgWrap: { flexShrink: 0 },
  foodImg: {
    width: isSmall ? 52 : 60,
    height: isSmall ? 52 : 60,
    borderRadius: isSmall ? 26 : 30,
  },
  foodImgFallback: {
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },

  foodMid:  { flex: 1 },
  foodName: { fontSize: isSmall ? 14 : 15, color: "#1A1A1A", marginBottom: 5 },
  qtyRow:   { flexDirection: "row", alignItems: "center", gap: 4 },
  qtyLabel: { fontSize: 13, color: "#555" },

  editBtn: {
    position: "absolute",
    top: -30,
    right: 0,
    padding: 4,
  },

  // ── Empty state ──
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
  bottomBtnTxt: { fontSize: 15, color: GREEN_DARK },
  bottomDivider: {
    width: 1,
    height: 22,
    backgroundColor: "#E0E0E0",
  },
});