/**
 * AddDiet.jsx — Redesigned to match screenshot
 * Simple white header, search with mic, Quick Daily Logs grid,
 * Add Custom Food bottom bar. All logic preserved.
 * + Nutrition grade bottom tray on NutriScaleRow tap
 */

import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Dimensions,
  Animated,
  ActivityIndicator,
  StatusBar,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Feather,
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Text } from "../components/TextWrapper";
import MealInfo from "./MealInfo";
import { FOOD_DATA, MEAL_TO_CATEGORY } from "./foodData";
import { searchFoodsAsync } from "./foodService";
import { C } from "../theme";
import {
  MAX_RECENT_FOODS,
  normalizeMealType,
  toNumber,
  parseJsonSafe,
  getTodayKey,
  STORAGE_KEYS,
  createEmptyLog,
  ensureMealsShape,
} from "../utils";

const { width } = Dimensions.get("window");
const isSmall = width < 380;
const STATUS_BAR_H = Platform.OS === "ios" ? 56 : (StatusBar.currentHeight ?? 38) + 8;

const MEAL_COLOR = {
  Breakfast: "#D97706",
  Lunch:     "#2563EB",
  Snacks:    "#059669",
  Dinner:    "#9333EA",
};

const CARD_COLORS = [
  "#fff", "#fff", "#fff", "#fff",
  "#fff", "#fff", "#fff", "#fff",
];

const CATEGORY_TABS = [
  { key: "all",       label: "All"       },
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch",     label: "Lunch"     },
  { key: "snack",     label: "Snacks"    },
  { key: "dinner",    label: "Dinner"    },
];

// ─────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────

const PressScale = ({ onPress, style, children, disabled }) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        disabled={disabled}
        activeOpacity={1}
        onPressIn={() =>
          Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40 }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start()
        }
        onPress={onPress}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

const EmptyHint = ({ icon, text }) => (
  <View style={s.emptyHint}>
    <Feather name={icon} size={22} color={C.textMuted} style={{ marginBottom: 8 }} />
    <Text style={s.emptyHintText}>{text}</Text>
  </View>
);

const MiniMacro = ({ label, value, color, bg }) => (
  <View style={[s.miniMacro, { backgroundColor: bg }]}>
    <Text weight="700" style={[s.miniMacroTxt, { color }]}>
      {label} {value}g
    </Text>
  </View>
);

// ── Quick Daily Log grid card ─────────────────
const QuickLogCard = ({ food, index, onAdd }) => {
  const bg = CARD_COLORS[index % CARD_COLORS.length];
  return (
    <TouchableOpacity
      style={[s.quickCard, { backgroundColor: bg }]}
      onPress={onAdd}
      activeOpacity={0.8}
    >
      <View style={s.quickCardImg} />
      <Text weight="600" style={s.quickCardName} numberOfLines={2}>
        {food.name}
      </Text>
      <Text style={s.quickCardCal}>
        {toNumber(food.calories || food.totalCalories)} kcal
      </Text>
    </TouchableOpacity>
  );
};

// ── Nutrition grade scale + logic ─────────────
const CAT_GRADES = [
  { grade: "A", bg: "#16A34A", dimBg: "#D1FAE5", dimText: "#6EE7B7" },
  { grade: "B", bg: "#65A30D", dimBg: "#ECFCCB", dimText: "#A3E635" },
  { grade: "C", bg: "#F59E0B", dimBg: "#FEF3C7", dimText: "#FCD34D" },
  { grade: "D", bg: "#EA580C", dimBg: "#FFEDD5", dimText: "#FDBA74" },
  { grade: "E", bg: "#DC2626", dimBg: "#FEE2E2", dimText: "#FCA5A5" },
];

const getCatNutritionGrade = (food) => {
  const cal  = toNumber(food.calories);
  const prot = toNumber(food.protein);
  const carb = toNumber(food.carbs);
  const fat  = toNumber(food.fat ?? food.fats ?? 0);
  if (cal === 0) return "C";
  const protKcal   = prot * 4;
  const carbKcal   = carb * 4;
  const fatKcal    = fat  * 9;
  const proteinPct = (protKcal / cal) * 100;
  const carbPct    = (carbKcal / cal) * 100;
  const fatPct     = (fatKcal  / cal) * 100;
  const score = 70 + Math.min(proteinPct * 0.6, 30) - Math.max(0, carbPct - 40) - Math.max(0, fatPct - 30);
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "E";
};

const NutriScaleRow = ({ food }) => {
  const activeGrade = getCatNutritionGrade(food);
  return (
    <View style={s.nutriScaleRow}>
      {CAT_GRADES.map((g) => {
        const isActive = g.grade === activeGrade;
        return (
          <View
            key={g.grade}
            style={[
              s.nutriScaleItem,
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
    </View>
  );
};

// ── Catalogue card with grade tray ────────────
const CatalogueCard = ({ food, onAdd }) => {
  const [gradeModal, setGradeModal] = useState(false);
  const grade     = getCatNutritionGrade(food);
  const gradeInfo = CAT_GRADES.find(g => g.grade === grade);

  const cal      = toNumber(food.calories);
  const protKcal = toNumber(food.protein) * 4;
  const carbKcal = toNumber(food.carbs)   * 4;
  const fatKcal  = toNumber(food.fats ?? food.fat ?? 0) * 9;
  const protPct  = cal > 0 ? Math.round((protKcal / cal) * 100) : 0;
  const carbPct  = cal > 0 ? Math.round((carbKcal / cal) * 100) : 0;
  const fatPct   = cal > 0 ? Math.round((fatKcal  / cal) * 100) : 0;

  const reasons = [
    protPct >= 30
      ? { icon: "✅", text: `High protein — ${protPct}% of calories` }
      : { icon: "⚠️", text: `Low protein — only ${protPct}% of calories` },
    carbPct > 40
      ? { icon: "⚠️", text: `High carbs — ${carbPct}% of calories` }
      : { icon: "✅", text: `Carbs in range — ${carbPct}% of calories` },
    fatPct > 30
      ? { icon: "⚠️", text: `High fat — ${fatPct}% of calories` }
      : { icon: "✅", text: `Fat in range — ${fatPct}% of calories` },
  ];

  return (
    <>
      <PressScale onPress={onAdd}>
        <View style={s.catCard}>
          <View style={s.catCardInner}>
            <View style={s.catCardLeft}>
              <Text weight="700" style={s.catCardName} numberOfLines={1}>
                {food.name}
              </Text>
              <Text style={s.catCardServing}>{food.serving}</Text>
              <View style={s.catCardMacros}>
                <MiniMacro label="P" value={toNumber(food.protein).toFixed(1)}           color={C.blue}    bg={C.blueLight}    />
                <MiniMacro label="C" value={toNumber(food.carbs).toFixed(1)}             color={C.emerald} bg={C.emeraldLight} />
                <MiniMacro label="F" value={toNumber(food.fats ?? food.fat).toFixed(1)} color={C.orange}  bg={C.orangeLight}  />
              </View>
              {/* Tappable grade scale */}
              <TouchableOpacity onPress={() => setGradeModal(true)} activeOpacity={0.75}>
                <NutriScaleRow food={food} />
              </TouchableOpacity>
            </View>
            <View style={s.catCardRight}>
              <View style={s.catCalBadge}>
                <Text weight="800" style={s.catCalVal}>{food.calories}</Text>
                <Text style={s.catCalUnit}>kcal</Text>
              </View>
              <View style={s.catAddBtn}>
                <Ionicons name="add" size={16} color="#fff" />
              </View>
            </View>
          </View>
        </View>
      </PressScale>

      {/* Grade bottom tray */}
      <Modal
        visible={gradeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setGradeModal(false)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setGradeModal(false)}
        >
          <View style={s.modalCard} onStartShouldSetResponder={() => true}>
            <View style={s.modalHandle} />
            <Text weight="700" style={s.modalTitle}>Nutrition Score</Text>
            <View style={[s.modalGradeHighlight, { backgroundColor: gradeInfo?.bg }]}>
              <Text weight="800" style={s.modalGradeLetter}>{grade}</Text>
            </View>
            <View style={s.modalReasonCard}>
              {reasons.map((r, i) => (
                <View key={i} style={s.modalReasonRow}>
                  <Text style={s.modalReasonIcon}>{r.icon}</Text>
                  <Text style={s.modalReasonTxt}>{r.text}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={s.modalCloseBtn}
              activeOpacity={0.85}
              onPress={() => setGradeModal(false)}
            >
              <Text weight="700" style={s.modalCloseTxt}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
const AddDietRN = () => {
  const navigation = useNavigation();
  const route      = useRoute();
  const mealType   = normalizeMealType(route.params?.mealType);
  const accent     = MEAL_COLOR[mealType] || C.primary;

  const [searchQuery,    setSearchQuery]    = useState("");
  const [recentFoods,    setRecentFoods]    = useState([]);
  const [selectedFood,   setSelectedFood]   = useState(null);
  const [mealTray,       setMealTray]       = useState([]);
  const [activeCategory, setActiveCategory] = useState(MEAL_TO_CATEGORY[mealType] || "all");
  const [searchResults,  setSearchResults]  = useState([]);
  const [searchLoading,  setSearchLoading]  = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const tabIndicX = useRef(new Animated.Value(0)).current;
  const tabWidth  = (width - 32) / CATEGORY_TABS.length;

  useEffect(() => {
    const initialIdx = CATEGORY_TABS.findIndex(t => t.key === (MEAL_TO_CATEGORY[mealType] || "all"));
    tabIndicX.setValue(initialIdx * tabWidth);
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const handleTabPress = (key, index) => {
    setActiveCategory(key);
    Animated.spring(tabIndicX, { toValue: index * tabWidth, speed: 20, bounciness: 6, useNativeDriver: true }).start();
  };

  // ── Helpers ──────────────────────────────────
  const saveRecentFood = async (food, quantity = 1) => {
    const raw  = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_FOODS);
    const arr  = Array.isArray(parseJsonSafe(raw, [])) ? parseJsonSafe(raw, []) : [];
    const key  = String(food?.name || "").trim().toLowerCase();
    if (!key) return;
    const item = {
      id:            food?.id || `${Date.now()}_${key}`,
      name:          food?.name,
      serving:       food?.serving || "1 serving",
      calories:      toNumber(food?.calories),
      protein:       toNumber(food?.protein),
      carbs:         toNumber(food?.carbs),
      fat:           toNumber(food?.fat ?? food?.fats),
      servings:      Math.max(1, toNumber(quantity, 1)),
      totalCalories: toNumber(food?.calories) * Math.max(1, toNumber(quantity, 1)),
      addedAt:       new Date().toISOString(),
    };
    const next = [item, ...arr.filter(x => String(x?.name || "").trim().toLowerCase() !== key)].slice(0, MAX_RECENT_FOODS);
    await AsyncStorage.setItem(STORAGE_KEYS.RECENT_FOODS, JSON.stringify(next));
    setRecentFoods(next);
  };

  // ── Load ──────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        const raw = await AsyncStorage.getItem(getTodayKey());
        if (raw) {
          const ex = parseJsonSafe(raw, createEmptyLog(getTodayKey()));
          ensureMealsShape(ex);
          if (ex.meals?.[mealType]) setMealTray(ex.meals[mealType]);
        }
        const rr = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_FOODS);
        if (rr) {
          const pr = parseJsonSafe(rr, []);
          setRecentFoods(Array.isArray(pr) ? pr : []);
        }
      } catch (err) {
        console.error("Error loading meals:", err);
      }
    };
    loadData();
  }, [mealType]);

  // ── Save log ──────────────────────────────────
  const saveNutritionLog = async (tray) => {
    const key = getTodayKey();
    const raw = await AsyncStorage.getItem(key);
    const ex  = raw ? parseJsonSafe(raw, createEmptyLog(key)) : createEmptyLog(key);
    ensureMealsShape(ex);
    ex.meals[mealType] = tray;
    const all = Object.values(ex.meals).flat();
    ex.totalCalories = all.reduce((s, x) => s + (x.calories || 0) * (x.quantity || 1), 0);
    ex.totalProtein  = all.reduce((s, x) => s + (x.protein  || 0) * (x.quantity || 1), 0);
    ex.totalCarbs    = all.reduce((s, x) => s + (x.carbs    || 0) * (x.quantity || 1), 0);
    ex.totalFat      = all.reduce((s, x) => s + (x.fat      || 0) * (x.quantity || 1), 0);
    await AsyncStorage.setItem(key, JSON.stringify(ex));
  };

  const updateMealTray       = async (t) => { setMealTray(t); await saveNutritionLog(t); };
  const handleRemoveFromTray = async (i) => updateMealTray(mealTray.filter((_, idx) => idx !== i));

  // ── Search ────────────────────────────────────
  const isSearching = searchQuery.trim().length > 0;

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const apiResults = await searchFoodsAsync(q);
        const ql = q.toLowerCase();
        const fromRecent = recentFoods
          .filter(f => f.name.toLowerCase().includes(ql))
          .map(f => ({ ...f, _source: "recent" }));
        const recentNames = new Set(fromRecent.map(f => f.name.toLowerCase()));
        const fromApi = apiResults
          .filter(f => !recentNames.has(f.name.toLowerCase()))
          .map(f => ({ ...f, fat: f.fats ?? f.fat ?? 0, totalCalories: f.calories, servings: 1 }));
        setSearchResults([...fromRecent, ...fromApi]);
      } catch (err) {
        console.error("[AddDiet] search error:", err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, recentFoods]);

  // ── Catalogue ─────────────────────────────────
  const catalogueFoods = useMemo(() => {
    if (activeCategory === "all") return FOOD_DATA;
    return FOOD_DATA.filter(f => f.category === activeCategory);
  }, [activeCategory]);

  const totalCalories = mealTray.reduce((s, m) => s + (m.calories || 0) * (m.quantity || 1), 0);

  const toMealInfoProps = (food) => ({
    name:     food.name,
    calories: toNumber(food.calories),
    protein:  toNumber(food.protein),
    carbs:    toNumber(food.carbs),
    fat:      toNumber(food.fat ?? food.fats ?? 0),
  });

  // ─── RENDER ──────────────────────────────────
  return (
    <View style={s.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ══ HEADER ══════════════════════════════ */}
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
          >
            <Feather name="arrow-left" size={18} color="#553FB5" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text weight="800" style={s.headerTitle}>Log Meal</Text>
            <Text style={s.headerSub}>Ensure the entire meal is visible for better accuracy.</Text>
          </View>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          {/* ══ SEARCH BAR ══════════════════════════ */}
          <View style={s.searchWrap}>
            <View style={s.searchBar}>
              <Ionicons name="search" size={17} color={C.textMuted} />
              <TextInput
                style={s.searchInput}
                placeholder="Search"
                placeholderTextColor={C.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 ? (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={15} color={C.textMuted} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="mic-outline" size={18} color={C.textMuted} />
              )}
            </View>
          </View>

          {/* ══ SEARCH RESULTS ══════════════════════ */}
          {isSearching && (
            <View style={s.section}>
              <Text weight="700" style={s.sectionTitle}>
                {searchLoading
                  ? "Searching..."
                  : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${searchQuery}"`}
              </Text>
              {searchLoading ? (
                <View style={s.centeredPad}>
                  <ActivityIndicator size="small" color={C.primary} />
                </View>
              ) : searchResults.length > 0 ? (
                <View style={s.catalogueList}>
                  {searchResults.map((food, i) => (
                    <CatalogueCard key={food.id || i} food={food} onAdd={() => setSelectedFood(food)} />
                  ))}
                </View>
              ) : (
                <EmptyHint icon="search" text="No matching foods found." />
              )}
            </View>
          )}

          {/* ══ NON-SEARCH CONTENT ══════════════════ */}
          {!isSearching && (
            <>
              {/* ── In tray ── */}
              {mealTray.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionRow}>
                    <Text weight="700" style={s.sectionTitle}>
                      In Tray · {mealTray.length} item{mealTray.length > 1 ? "s" : ""}
                    </Text>
                    <TouchableOpacity
                      onPress={() => navigation.navigate("NutritionPlate", { mealType })}
                      activeOpacity={0.7}
                    >
                      <Text weight="600" style={s.sectionLink}>View Plate →</Text>
                    </TouchableOpacity>
                  </View>
                  {mealTray.map((meal, i) => (
                    <View key={meal.id ?? i} style={s.trayCard}>
                      <View style={[s.trayDot, { backgroundColor: accent }]} />
                      <View style={{ flex: 1 }}>
                        <Text weight="600" style={s.trayName}>{meal.name}</Text>
                        <Text style={s.trayMeta}>
                          {(meal.calories || 0) * (meal.quantity || 1)} kcal · {meal.quantity || 1}×
                        </Text>
                      </View>
                      <View style={s.qtyRow}>
                        <TouchableOpacity
                          style={s.qtyBtn}
                          onPress={() => {
                            if ((meal.quantity || 1) > 1) {
                              const u = [...mealTray];
                              u[i] = { ...meal, quantity: (meal.quantity || 1) - 1 };
                              updateMealTray(u);
                            }
                          }}
                        >
                          <Text style={s.qtyBtnTxt}>−</Text>
                        </TouchableOpacity>
                        <Text weight="700" style={s.qtyNum}>{meal.quantity || 1}</Text>
                        <TouchableOpacity
                          style={s.qtyBtn}
                          onPress={() => {
                            const u = [...mealTray];
                            u[i] = { ...meal, quantity: (meal.quantity || 1) + 1 };
                            updateMealTray(u);
                          }}
                        >
                          <Text style={s.qtyBtnTxt}>+</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.delBtn} onPress={() => handleRemoveFromTray(i)}>
                          <MaterialIcons name="delete-outline" size={18} color={C.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* ── Quick Daily Logs ── */}
              <View style={s.section}>
                <Text weight="700" style={s.sectionTitle}>Quick Daily Logs</Text>
                {recentFoods.length === 0 ? (
                  <EmptyHint icon="clock" text="Foods you log often will appear here." />
                ) : (
                  <View style={s.catalogueList}>
                    {recentFoods.slice(0, 3).map((f, i) => (
                      <CatalogueCard
                        key={f.id || i}
                        food={f}
                        onAdd={() => setSelectedFood(f)}
                      />
                    ))}
                  </View>
                )}
              </View>

              {/* ── Browse catalogue ── */}
              <View style={s.section}>
                <Text weight="700" style={s.sectionTitle}>Browse Foods</Text>
                <Text style={s.sectionSub}>{catalogueFoods.length} items · tap to add</Text>

                {/* Category tabs */}
                <View style={s.tabBar}>
                  <Animated.View
                    style={[s.tabIndicator, { width: tabWidth, transform: [{ translateX: tabIndicX }] }]}
                  />
                  {CATEGORY_TABS.map((tab, idx) => {
                    const active = activeCategory === tab.key;
                    return (
                      <TouchableOpacity
                        key={tab.key}
                        style={[s.tab, { width: tabWidth }]}
                        onPress={() => handleTabPress(tab.key, idx)}
                        activeOpacity={0.75}
                      >
                        <Text weight={active ? "700" : "500"} style={[s.tabTxt, active && s.tabTxtActive]}>
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={s.catalogueList}>
                  {catalogueFoods.map(food => (
                    <CatalogueCard key={food.id} food={food} onAdd={() => setSelectedFood(food)} />
                  ))}
                </View>
              </View>
            </>
          )}
        </Animated.View>
      </ScrollView>

      {/* ══ BOTTOM BAR ══════════════════════════ */}
      <View style={s.bottomBar}>
        <View style={s.scanRow}>
          <TouchableOpacity
            style={s.bottomBtn}
            activeOpacity={0.75}
            onPress={() => navigation.navigate("NutritionScan", { mealType })}
          >
            <Text weight="600" style={s.bottomBtnTxt}>Scan Food</Text>
          </TouchableOpacity>
          <View style={s.bottomDivider} />
          <TouchableOpacity
            style={s.bottomBtn}
            activeOpacity={0.75}
            onPress={() => navigation.navigate("NutritionBarcode", { mealType })}
          >
            <Text weight="600" style={s.bottomBtnTxt}>Scan Barcode</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.bottomHint}>Didn't find what you were looking for?</Text>
        <TouchableOpacity
          style={s.customFoodBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("AddCustomFood", { mealType })}
        >
          <LinearGradient
            colors={["#93D056", "#35A329"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={s.customFoodBtnInner}
          >
            <Text weight="700" style={s.customFoodBtnTxt}>+ Add Custom Food</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ══ MEALINFO SHEET ══════════════════════ */}
      {selectedFood && (
        <MealInfo
          isOpen={!!selectedFood}
          onClose={() => setSelectedFood(null)}
          {...toMealInfoProps(selectedFood)}
          onMealAdded={(newMeal) => {
            const updated = [
              ...mealTray,
              {
                id:       Date.now().toString(),
                name:     newMeal.name,
                calories: newMeal.calories,
                protein:  newMeal.protein,
                carbs:    newMeal.carbs,
                fat:      newMeal.fat,
                quantity: newMeal.quantity || 1,
              },
            ];
            updateMealTray(updated);
            saveRecentFood(
              { ...selectedFood, fat: toNumber(selectedFood.fat ?? selectedFood.fats) },
              newMeal.quantity || 1,
            );
            setSelectedFood(null);
          }}
          animationType="none"
          statusBarTranslucent
          presentationStyle="overFullScreen"
        />
      )}
    </View>
  );
};

export default AddDietRN;

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: STATUS_BAR_H,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#fff",
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  headerTitle: { fontSize: 18, color: "#553FB5" },
  headerSub:   { fontSize: 12, color: "Black", marginTop: 3, lineHeight: 17 },

  // ── Search ──
  searchWrap: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F6FB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E8EBF0",
  },
  searchInput: { flex: 1, fontSize: 15, color: C.text },

  // ── Section ──
  section:      { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 4 },
  sectionRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: isSmall ? 15 : 16, color: C.text, marginBottom: 4 },
  sectionSub:   { fontSize: 11, color: C.textMuted, marginBottom: 10 },
  sectionLink:  { fontSize: 13, color: C.primary },
  centeredPad:  { alignItems: "center", paddingVertical: 24 },

  // ── Quick Daily Logs grid ──
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  quickCard: {
    width: (width - 32 - 10) / 2,
    borderRadius: 14,
    padding: 12,
    minHeight: 110,
    backgroundColor: "#fff",
    justifyContent: "flex-end",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  quickCardImg:  { flex: 1, minHeight: 48 },
  quickCardName: { fontSize: 13, color: "#333", marginTop: 8, lineHeight: 18 },
  quickCardCal:  { fontSize: 11, color: C.textMuted, marginTop: 3 },

  // ── In-tray card ──
  trayCard: {
    backgroundColor: "#fff",
    borderRadius: 13,
    padding: 13,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  trayDot:  { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  trayName: { fontSize: isSmall ? 14 : 15, color: C.text, marginBottom: 2 },
  trayMeta: { fontSize: 12, color: C.textMuted },

  // Qty controls
  qtyRow:    { flexDirection: "row", alignItems: "center", gap: 4 },
  qtyBtn:    { width: 26, height: 26, borderRadius: 8, backgroundColor: C.primary + "18", alignItems: "center", justifyContent: "center" },
  qtyBtnTxt: { color: C.primary, fontSize: 16, lineHeight: 18 },
  qtyNum:    { minWidth: 22, textAlign: "center", fontSize: 14, color: C.text },
  delBtn:    { marginLeft: 4, padding: 4 },

  // ── Tab bar ──
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8EBF0",
    overflow: "hidden",
    position: "relative",
    height: 40,
    marginBottom: 12,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 3,
    backgroundColor: C.primary,
    borderRadius: 2,
  },
  tab:          { height: 40, alignItems: "center", justifyContent: "center" },
  tabTxt:       { fontSize: isSmall ? 11 : 12, color: C.textMuted },
  tabTxtActive: { color: C.primary },

  // ── Catalogue cards ──
  catalogueList: { gap: 8, paddingBottom: 8 },
  catCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8EBF0",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  catCardInner:   { flexDirection: "row", alignItems: "center", padding: isSmall ? 12 : 14, gap: 10 },
  catCardLeft:    { flex: 1 },
  catCardName:    { fontSize: isSmall ? 14 : 15, color: C.text, marginBottom: 2 },
  catCardServing: { fontSize: 11, color: C.textMuted, marginBottom: 7 },
  catCardMacros:  { flexDirection: "row", gap: 5 },
  miniMacro:      { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  miniMacroTxt:   { fontSize: 10 },
  nutriScaleRow:  { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 6, paddingVertical: 2 },
  nutriScaleItem: { width: 18, height: 22, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  catCardRight:   { alignItems: "center", gap: 8 },
  catCalBadge:    { alignItems: "center", backgroundColor: C.primaryGhost, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 8, minWidth: 54 },
  catCalVal:      { fontSize: isSmall ? 15 : 17, color: C.primary },
  catCalUnit:     { fontSize: 9, color: C.primary, opacity: 0.7 },
  catAddBtn:      { width: 28, height: 28, borderRadius: 8, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },

  // ── Empty hint ──
  emptyHint:     { alignItems: "center", paddingVertical: 28, paddingHorizontal: 20 },
  emptyHintText: { fontSize: 13, color: C.textMuted, textAlign: "center", lineHeight: 19 },

  // ── Bottom bar ──
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 30 : 18,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 6,
  },
  scanRow:       { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  bottomBtn:     { flex: 1, alignItems: "center", paddingVertical: 6 },
  bottomBtnTxt:  { fontSize: 14, color: "#35A329" },
  bottomDivider: { width: 1, height: 20, backgroundColor: "#E0E0E0" },
  bottomHint:    { fontSize: 13, color: C.textMuted, textAlign: "center", marginBottom: 12 },
  customFoodBtn: { borderRadius: 14, overflow: "hidden" },
  customFoodBtnInner: { paddingVertical: 14, alignItems: "center", alignSelf: "stretch" },
  customFoodBtnTxt:   { color: "#fff", fontSize: 15 },

  // ── Nutrition grade bottom tray ──
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
  modalTitle: { fontSize: 17, color: "#1A1A1A", marginBottom: 14 },
  modalGradeHighlight: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalGradeLetter: { fontSize: 28, color: "#fff" },
  modalReasonCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 8,
  },
  modalReasonRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  modalReasonIcon: { fontSize: 16 },
  modalReasonTxt:  { fontSize: 13, color: "#333", flex: 1, lineHeight: 18 },
  modalCloseBtn: {
    marginTop: 12,
    backgroundColor: "#553FB5",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCloseTxt: { color: "#fff", fontSize: 14 },
});