/**
 * AddDiet.jsx — Redesigned to match screenshot
 * Simple white header, search with mic, Quick Daily Logs grid,
 * Add Custom Food bottom bar. All logic preserved.
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

// Soft pastel card backgrounds for Quick Daily Logs grid
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
      {/* Placeholder illustration area */}
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

// ── Search result / catalogue card ───────────
const CatalogueCard = ({ food, onAdd }) => (
  <PressScale onPress={onAdd}>
    <View style={s.catCard}>
      <View style={s.catCardInner}>
        <View style={s.catCardLeft}>
          <Text weight="700" style={s.catCardName} numberOfLines={1}>
            {food.name}
          </Text>
          <Text style={s.catCardServing}>{food.serving}</Text>
          <View style={s.catCardMacros}>
            <MiniMacro label="P" value={toNumber(food.protein).toFixed(1)}  color={C.blue}    bg={C.blueLight}    />
            <MiniMacro label="C" value={toNumber(food.carbs).toFixed(1)}    color={C.emerald} bg={C.emeraldLight} />
            <MiniMacro label="F" value={toNumber(food.fats ?? food.fat).toFixed(1)} color={C.orange}  bg={C.orangeLight}  />
          </View>
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
);

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
const AddDietRN = () => {
  const navigation = useNavigation();
  const route     = useRoute();
  const mealType  = normalizeMealType(route.params?.mealType);
  const accent    = MEAL_COLOR[mealType] || C.primary;

  const [searchQuery,   setSearchQuery]   = useState("");
  const [recentFoods,   setRecentFoods]   = useState([]);
  const [selectedFood,  setSelectedFood]  = useState(null);
  const [mealTray,      setMealTray]      = useState([]);
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

  const updateMealTray      = async (t) => { setMealTray(t); await saveNutritionLog(t); };
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
        contentContainerStyle={{ paddingBottom: mealTray.length > 0 ? 100 : 100 }}
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
                {searchLoading ? "Searching..." : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${searchQuery}"`}
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
              {/* ── In tray (if items logged) ── */}
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

              {/* ── Quick Daily Logs grid ── */}
              <View style={s.section}>
                <Text weight="700" style={s.sectionTitle}>Quick Daily Logs</Text>
                {recentFoods.length === 0 ? (
                  <EmptyHint icon="clock" text="Foods you log often will appear here." />
                ) : (
                  <View style={s.quickGrid}>
                    {recentFoods.map((f, i) => (
                      <QuickLogCard
                        key={f.id || i}
                        food={f}
                        index={i}
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
  section:    { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 4 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
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
    width: (width - 32 - 10) / 2,   // 2 columns with gap
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
  quickCardImg: {
    flex: 1,
    minHeight: 48,
  },
  quickCardName: {
    fontSize: 13,
    color: "#333",
    marginTop: 8,
    lineHeight: 18,
  },
  quickCardCal: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 3,
  },

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
  qtyRow:   { flexDirection: "row", alignItems: "center", gap: 4 },
  qtyBtn:   { width: 26, height: 26, borderRadius: 8, backgroundColor: C.primary + "18", alignItems: "center", justifyContent: "center" },
  qtyBtnTxt:{ color: C.primary, fontSize: 16, lineHeight: 18 },
  qtyNum:   { minWidth: 22, textAlign: "center", fontSize: 14, color: C.text },
  delBtn:   { marginLeft: 4, padding: 4 },

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
  tab:        { height: 40, alignItems: "center", justifyContent: "center" },
  tabTxt:     { fontSize: isSmall ? 11 : 12, color: C.textMuted },
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
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 30 : 18,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 6,
  },
  bottomTrayRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bottomLabel:   { fontSize: 12, color: C.textMuted },
  bottomVal:     { fontSize: 18, color: C.text, marginTop: 2 },
  doneBtn:       { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  doneTxt:       { color: "#fff", fontSize: isSmall ? 14 : 15 },

  bottomHint: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
    marginBottom: 12,
  },
  customFoodBtn: {
    borderRadius: 14,
    overflow: "hidden",  // ← replaces backgroundColor
  },
  customFoodBtnInner: {
    paddingVertical: 14,
    alignItems: "center",
    alignSelf: "stretch",
  },
  customFoodBtnTxt: { color: "#fff", fontSize: 15 },
});