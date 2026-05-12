/**
 * AddDiet.jsx — Food catalogue integration
 *
 * New features:
 *  • Imports FOOD_DATA from foodData.js
 *  • Category filter tabs (All · Breakfast · Lunch · Snacks · Dinner)
 *    — default tab pre-selected to match the current mealType
 *  • "Browse Foods" section shows food catalogue cards
 *  • Search queries both recentFoods AND FOOD_DATA simultaneously
 *  • Each catalogue card shows name, serving, calorie badge, macro chips
 *  • Tapping a catalogue card opens MealInfo sheet (same flow as recent foods)
 *  • Animated tab indicator slides under the active tab
 *  • All existing logic, navigation, AsyncStorage, and tray management unchanged
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Feather,
  Ionicons,
  FontAwesome,
  MaterialIcons,
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Text } from "../components/TextWrapper";
import MealInfo from "./MealInfo";
import { FOOD_DATA, MEAL_TO_CATEGORY } from "./foodData";
import { searchFoodsAsync } from "./foodService";
import { C } from "../theme";
import { DEFAULT_MEALS, MEAL_TYPES, MAX_RECENT_FOODS, normalizeMealType, toNumber, parseJsonSafe, getTodayKey, STORAGE_KEYS, createEmptyLog, ensureMealsShape } from "../utils";

const { width } = Dimensions.get("window");
const isSmall = width < 380;



const MEAL_COLOR = {
  Breakfast: "#D97706",
  Lunch: "#2563EB",
  Snacks: "#059669",
  Dinner: "#9333EA",
};

// ── Category tab config ────────────────────────
const CATEGORY_TABS = [
  { key: "all", label: "All" },
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "snack", label: "Snacks" },
  { key: "dinner", label: "Dinner" },
];

// ── Constants ─────────────────────────────────












// ─────────────────────────────────────────────
// SHARED PRIMITIVES
// ─────────────────────────────────────────────

const PressScale = ({ onPress, style, children, disabled }) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        disabled={disabled}
        activeOpacity={1}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.96,
            useNativeDriver: true,
            speed: 40,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 40,
          }).start()
        }
        onPress={onPress}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

const SectionHeader = ({ title, right, rightLabel, onRight, subtitle }) => (
  <View style={s.sectionHeader}>
    <View>
      <Text weight="700" style={s.sectionTitle}>
        {title}
      </Text>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
    {right && (
      <TouchableOpacity onPress={onRight} activeOpacity={0.7}>
        <Text weight="600" style={s.sectionLink}>
          {rightLabel}
        </Text>
      </TouchableOpacity>
    )}
  </View>
);

const EmptyHint = ({ icon, text }) => (
  <View style={s.emptyHint}>
    <Feather
      name={icon}
      size={22}
      color={C.textMuted}
      style={{ marginBottom: 8 }}
    />
    <Text style={s.emptyHintText}>{text}</Text>
  </View>
);

// ── Mini macro chip ────────────────────────────
const MiniMacro = ({ label, value, color, bg }) => (
  <View style={[s.miniMacro, { backgroundColor: bg }]}>
    <Text weight="700" style={[s.miniMacroTxt, { color }]}>
      {label} {value}g
    </Text>
  </View>
);

// ── Catalogue food card ────────────────────────
const CatalogueCard = ({ food, onAdd }) => (
  <PressScale onPress={onAdd}>
    <View style={s.catCard}>
      <View style={s.catCardInner}>
        {/* Left — name + serving + macros */}
        <View style={s.catCardLeft}>
          <Text weight="700" style={s.catCardName} numberOfLines={1}>
            {food.name}
          </Text>
          <Text style={s.catCardServing}>{food.serving}</Text>
          <View style={s.catCardMacros}>
            <MiniMacro
              label="P"
              value={toNumber(food.protein).toFixed(1)}
              color={C.blue}
              bg={C.blueLight}
            />
            <MiniMacro
              label="C"
              value={toNumber(food.carbs).toFixed(1)}
              color={C.emerald}
              bg={C.emeraldLight}
            />
            <MiniMacro
              label="F"
              value={toNumber(food.fats ?? food.fat).toFixed(1)}
              color={C.orange}
              bg={C.orangeLight}
            />
          </View>
        </View>

        {/* Right — calorie badge + add */}
        <View style={s.catCardRight}>
          <View style={s.catCalBadge}>
            <Text weight="800" style={s.catCalVal}>
              {food.calories}
            </Text>
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

// ─────────────────────────────────────────────────────
const AddDietRN = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const mealType = normalizeMealType(route.params?.mealType);
  const accent = MEAL_COLOR[mealType] || C.primary;

  const [searchQuery, setSearchQuery] = useState("");
  const [recentFoods, setRecentFoods] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [mealTray, setMealTray] = useState([]);
  const [activeCategory, setActiveCategory] = useState(
    MEAL_TO_CATEGORY[mealType] || "all",
  );

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const tabIndicX = useRef(new Animated.Value(0)).current;

  // Find initial tab index to position indicator correctly
  const initialTabIdx = CATEGORY_TABS.findIndex(
    (t) => t.key === (MEAL_TO_CATEGORY[mealType] || "all"),
  );
  const tabWidth = (width - 32) / CATEGORY_TABS.length;

  useEffect(() => {
    // Set initial tab indicator position
    tabIndicX.setValue(initialTabIdx * tabWidth);
    // Page enter animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        speed: 14,
        bounciness: 3,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleTabPress = (key, index) => {
    setActiveCategory(key);
    Animated.spring(tabIndicX, {
      toValue: index * tabWidth,
      speed: 20,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

  // ── Helpers ──────────────────────────────────


  const saveRecentFood = async (food, quantity = 1) => {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_FOODS);
    const arr = Array.isArray(parseJsonSafe(raw, []))
      ? parseJsonSafe(raw, [])
      : [];
    const key = String(food?.name || "")
      .trim()
      .toLowerCase();
    if (!key) return;
    const item = {
      id: food?.id || `${Date.now()}_${key}`,
      name: food?.name,
      serving: food?.serving || "1 serving",
      calories: toNumber(food?.calories),
      protein: toNumber(food?.protein),
      carbs: toNumber(food?.carbs),
      fat: toNumber(food?.fat ?? food?.fats),
      servings: Math.max(1, toNumber(quantity, 1)),
      totalCalories:
        toNumber(food?.calories) * Math.max(1, toNumber(quantity, 1)),
      addedAt: new Date().toISOString(),
    };
    const next = [
      item,
      ...arr.filter(
        (x) =>
          String(x?.name || "")
            .trim()
            .toLowerCase() !== key,
      ),
    ].slice(0, MAX_RECENT_FOODS);
    await AsyncStorage.setItem(STORAGE_KEYS.RECENT_FOODS, JSON.stringify(next));
    setRecentFoods(next);
  };

  // ── Initial load ─────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        const key = getTodayKey();
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const ex = parseJsonSafe(raw, createEmptyLog(key));
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

  // ── Save nutrition log ────────────────────────
  const saveNutritionLog = async (tray) => {
    const key = getTodayKey();
    const raw = await AsyncStorage.getItem(key);
    const ex = raw
      ? parseJsonSafe(raw, createEmptyLog(key))
      : createEmptyLog(key);
    ensureMealsShape(ex);
    ex.meals[mealType] = tray;
    const all = Object.values(ex.meals).flat();
    ex.totalCalories = all.reduce(
      (sum, x) => sum + (x.calories || 0) * (x.quantity || 1),
      0,
    );
    ex.totalProtein = all.reduce(
      (sum, x) => sum + (x.protein || 0) * (x.quantity || 1),
      0,
    );
    ex.totalCarbs = all.reduce(
      (sum, x) => sum + (x.carbs || 0) * (x.quantity || 1),
      0,
    );
    ex.totalFat = all.reduce(
      (sum, x) => sum + (x.fat || 0) * (x.quantity || 1),
      0,
    );
    await AsyncStorage.setItem(key, JSON.stringify(ex));
  };

  const updateMealTray = async (t) => {
    setMealTray(t);
    await saveNutritionLog(t);
  };
  const handleRemoveFromTray = async (i) =>
    updateMealTray(mealTray.filter((_, idx) => idx !== i));

  // ── Unified search across recent + local food databases ──
  const isSearching = searchQuery.trim().length > 0;

  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);

    // 300 ms debounce
    const timer = setTimeout(async () => {
      try {
        const apiResults = await searchFoodsAsync(q);

        // Prepend recent foods (they always win, deduplicated by name)
        const ql = q.toLowerCase();
        const fromRecent = recentFoods
          .filter((f) => f.name.toLowerCase().includes(ql))
          .map((f) => ({ ...f, _source: "recent" }));
        const recentNames = new Set(fromRecent.map((f) => f.name.toLowerCase()));

        // Normalise fats→fat for downstream MealInfo compatibility
        const fromApi = apiResults
          .filter((f) => !recentNames.has(f.name.toLowerCase()))
          .map((f) => ({
            ...f,
            fat: f.fats ?? f.fat ?? 0,
            totalCalories: f.calories,
            servings: 1,
          }));

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

  // ── Catalogue filtered by active tab ──────────
  const catalogueFoods = useMemo(() => {
    if (activeCategory === "all") return FOOD_DATA;
    return FOOD_DATA.filter((f) => f.category === activeCategory);
  }, [activeCategory]);

  const totalCalories = mealTray.reduce(
    (s, m) => s + (m.calories || 0) * (m.quantity || 1),
    0,
  );
  const handleViewPlate = () =>
    navigation.navigate("NutritionPlate", { mealType });

  // Normalize any food item for MealInfo props
  const toMealInfoProps = (food) => ({
    name: food.name,
    calories: toNumber(food.calories),
    protein: toNumber(food.protein),
    carbs: toNumber(food.carbs),
    fat: toNumber(food.fat ?? food.fats ?? 0),
  });

  // ─── RENDER ─────────────────────────────────
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
        contentContainerStyle={{ paddingBottom: mealTray.length > 0 ? 96 : 32 }}
      >
        {/* ══ HERO ══════════════════════════════ */}
        <LinearGradient
          colors={[C.primaryDark, C.primary, C.primaryMid]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 1 }}
          style={s.hero}
        >
          <View style={s.heroTopBar}>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.75}
            >
              <Feather name="arrow-left" size={18} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.heroEyebrow}>Adding to</Text>
              <Text weight="800" style={s.heroTitle}>
                {mealType}
              </Text>
            </View>
            {mealTray.length > 0 && (
              <TouchableOpacity
                style={s.plateBtn}
                onPress={handleViewPlate}
                activeOpacity={0.75}
              >
                <Text weight="600" style={s.plateBtnTxt}>
                  View Plate
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ height: 32 }} />
        </LinearGradient>

        {/* ══ FLOATING SEARCH BAR ═══════════════ */}
        <Animated.View
          style={[
            s.searchWrap,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={s.searchBar}>
            <Ionicons name="search" size={17} color={C.textMuted} />
            <TextInput
              style={s.searchInput}
              placeholder="Search foods..."
              placeholderTextColor={C.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={15} color={C.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* ══ SCAN QUICK-ACTIONS ════════════════ */}
        <Animated.View style={[s.scanRow, { opacity: fadeAnim }]}>
          <PressScale
            style={{ flex: 1 }}
            onPress={() => navigation.navigate("NutritionScan", { mealType })}
          >
            <LinearGradient
              colors={[C.primaryDark, C.primary]}
              style={s.scanCard}
            >
              <View style={s.scanIconCircle}>
                <FontAwesome name="camera" size={20} color="#fff" />
              </View>
              <Text weight="700" style={s.scanCardTitle}>
                Scan Meal
              </Text>
              <Text style={s.scanCardSub}>AI recognition</Text>
            </LinearGradient>
          </PressScale>
          <PressScale
            style={{ flex: 1 }}
            onPress={() =>
              navigation.navigate("NutritionBarcode", { mealType })
            }
          >
            <LinearGradient colors={["#1E3A5F", "#2563EB"]} style={s.scanCard}>
              <View style={s.scanIconCircle}>
                <Ionicons name="barcode" size={22} color="#fff" />
              </View>
              <Text weight="700" style={s.scanCardTitle}>
                Scan Barcode
              </Text>
              <Text style={s.scanCardSub}>Packaged food</Text>
            </LinearGradient>
          </PressScale>
        </Animated.View>

        {/* ══ IN-TRAY ═══════════════════════════ */}
        {mealTray.length > 0 && !isSearching && (
          <Animated.View style={[s.section, { opacity: fadeAnim }]}>
            <SectionHeader
              title={`In Tray · ${mealTray.length} item${mealTray.length > 1 ? "s" : ""}`}
              right
              rightLabel="View Plate →"
              onRight={handleViewPlate}
            />
            {mealTray.map((meal, i) => {
              const mealCalories = (meal.calories || 0) * (meal.quantity || 1);
              return (
                <View key={meal.id ?? i} style={s.foodCard}>
                  <View style={[s.foodDot, { backgroundColor: accent }]} />
                  <View style={{ flex: 1 }}>
                    <Text weight="600" style={s.foodName}>
                      {meal.name}
                    </Text>
                    <Text style={s.foodMeta}>
                      {mealCalories} kcal · {meal.quantity || 1}×
                    </Text>
                  </View>
                  <View style={s.qtyRow}>
                    <TouchableOpacity
                      style={s.qtyBtn}
                      onPress={() => {
                        if ((meal.quantity || 1) > 1) {
                          const u = [...mealTray];
                          u[i] = {
                            ...meal,
                            quantity: (meal.quantity || 1) - 1,
                          };
                          updateMealTray(u);
                        }
                      }}
                    >
                      <Text style={s.qtyBtnTxt}>−</Text>
                    </TouchableOpacity>
                    <Text weight="700" style={s.qtyNum}>
                      {meal.quantity || 1}
                    </Text>
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
                    <TouchableOpacity
                      style={s.delBtn}
                      onPress={() => handleRemoveFromTray(i)}
                    >
                      <MaterialIcons
                        name="delete-outline"
                        size={18}
                        color={C.danger}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </Animated.View>
        )}

        {/* ══ SEARCH RESULTS ════════════════════ */}
        {isSearching && (
          <Animated.View style={[s.section, { opacity: fadeAnim }]}>
            <SectionHeader
              title={`Results for "${searchQuery}"`}
              subtitle={
                searchLoading
                  ? "Searching..."
                  : `${searchResults.length} item${searchResults.length !== 1 ? "s" : ""} found`
              }
            />
            {searchLoading ? (
              <View style={s.searchLoadingWrap}>
                <ActivityIndicator size="small" color={C.primary} />
              </View>
            ) : searchResults.length > 0 ? (
              <View style={s.catalogueList}>
                {searchResults.map((food, i) => (
                  <CatalogueCard
                    key={food.id || i}
                    food={food}
                    onAdd={() => setSelectedFood(food)}
                  />
                ))}
              </View>
            ) : (
              <EmptyHint
                icon="search"
                text="No matching foods found. Try scanning the meal instead."
              />
            )}
          </Animated.View>
        )}

        {/* ══ NON-SEARCH CONTENT ════════════════ */}
        {!isSearching && (
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Recent foods */}
            {recentFoods.length > 0 && (
              <View style={s.section}>
                <SectionHeader title="Recent Foods" />
                {recentFoods.map((f, i) => (
                  <View key={i} style={s.foodCard}>
                    <View
                      style={[s.foodDot, { backgroundColor: C.textMuted }]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text weight="600" style={s.foodName}>
                        {f.name}
                      </Text>
                      <Text style={s.foodMeta}>
                        {f.totalCalories} kcal · {f.servings} serving
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={s.addBtn}
                      onPress={() => setSelectedFood(f)}
                    >
                      <Ionicons name="add" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* ── Food catalogue ──────────────── */}
            <View style={s.catalogueSectionHeader}>
              <View>
                <Text weight="700" style={s.sectionTitle}>
                  Browse Foods
                </Text>
                <Text style={s.sectionSubtitle}>
                  {catalogueFoods.length} items · tap to add
                </Text>
              </View>
            </View>

            {/* Category tab bar */}
            <View style={s.tabBar}>
              <Animated.View
                style={[
                  s.tabIndicator,
                  { width: tabWidth, transform: [{ translateX: tabIndicX }] },
                ]}
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
                    <Text
                      weight={active ? "700" : "500"}
                      style={[s.tabTxt, active && s.tabTxtActive]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Food cards */}
            <View style={s.catalogueList}>
              {catalogueFoods.map((food) => (
                <CatalogueCard
                  key={food.id}
                  food={food}
                  onAdd={() => setSelectedFood(food)}
                />
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* ══ BOTTOM TRAY BAR ═══════════════════ */}
      {mealTray.length > 0 && (
        <View style={s.bottomBar}>
          <View>
            <Text style={s.bottomLabel}>Total Calories</Text>
            <Text weight="800" style={s.bottomVal}>
              {totalCalories} kcal
            </Text>
          </View>
          <PressScale onPress={() => navigation.goBack()}>
            <LinearGradient
              colors={[C.primaryLight, C.primaryDark]}
              style={s.doneBtn}
            >
              <Text weight="700" style={s.doneTxt}>
                Done
              </Text>
            </LinearGradient>
          </PressScale>
        </View>
      )}

      {/* ══ MEALINFO SHEET ════════════════════ */}
      {selectedFood && (
        <MealInfo
          isOpen={!!selectedFood}
          onClose={() => setSelectedFood(null)}
          {...toMealInfoProps(selectedFood)}
          onMealAdded={(newMeal) => {
            const updated = [
              ...mealTray,
              {
                id: Date.now().toString(),
                name: newMeal.name,
                calories: newMeal.calories,
                protein: newMeal.protein,
                carbs: newMeal.carbs,
                fat: newMeal.fat,
                quantity: newMeal.quantity || 1,
              },
            ];
            updateMealTray(updated);
            saveRecentFood(
              {
                ...selectedFood,
                fat: toNumber(selectedFood.fat ?? selectedFood.fats),
              },
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

// ── Styles ─────────────────────────────────────────
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 56 : 38,
    paddingBottom: 0,
  },
  heroTopBar: { flexDirection: "row", alignItems: "center" },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroEyebrow: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    marginBottom: 2,
  },
  heroTitle: { fontSize: isSmall ? 22 : 26, color: "#fff" },
  plateBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  plateBtnTxt: { fontSize: 13, color: "#fff" },

  // Floating search
  searchWrap: {
    alignItems: "center",
    marginTop: -20,
    marginBottom: 14,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 13 : 9,
    width: width - 32,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text },

  // Scan cards
  scanRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 4,
  },
  scanCard: {
    borderRadius: 16,
    padding: 16,
    height: 105,
    justifyContent: "space-between",
  },
  scanIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanCardTitle: { color: "#fff", fontSize: isSmall ? 13 : 14 },
  scanCardSub: { color: "rgba(255,255,255,0.65)", fontSize: 11 },

  // Section
  section: { paddingHorizontal: 16, paddingVertical: 10 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: isSmall ? 15 : 16, color: C.text },
  sectionSubtitle: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  sectionLink: { fontSize: 13, color: C.primary },

  // Tray food card
  foodCard: {
    backgroundColor: C.surface,
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
  foodDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  foodName: { fontSize: isSmall ? 14 : 15, color: C.text, marginBottom: 2 },
  foodMeta: { fontSize: 12, color: C.textMuted },

  // Qty controls
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: C.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnTxt: { color: C.primary, fontSize: 16, lineHeight: 18 },
  qtyNum: { minWidth: 22, textAlign: "center", fontSize: 14, color: C.text },
  delBtn: { marginLeft: 4, padding: 4 },

  // Add button (recent)
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  searchLoadingWrap: {
    alignItems: "center",
    paddingVertical: 24,
  },

  // Empty hint
  emptyHint: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  emptyHintText: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 19,
  },

  // ── CATALOGUE ──────────────────────────────
  catalogueSectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    position: "relative",
    height: 40,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 3,
    backgroundColor: C.primary,
    borderRadius: 2,
  },
  tab: { height: 40, alignItems: "center", justifyContent: "center" },
  tabTxt: { fontSize: isSmall ? 11 : 12, color: C.textMuted },
  tabTxtActive: { color: C.primary },

  // Catalogue list
  catalogueList: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },

  // Catalogue card
  catCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  catCardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: isSmall ? 12 : 14,
    gap: 10,
  },
  catCardLeft: { flex: 1 },
  catCardName: { fontSize: isSmall ? 14 : 15, color: C.text, marginBottom: 2 },
  catCardServing: { fontSize: 11, color: C.textMuted, marginBottom: 7 },
  catCardMacros: { flexDirection: "row", gap: 5 },

  // Mini macro chip
  miniMacro: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  miniMacroTxt: { fontSize: 10 },

  // Catalogue card right side
  catCardRight: { alignItems: "center", gap: 8 },
  catCalBadge: {
    alignItems: "center",
    backgroundColor: C.primaryGhost,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 8,
    minWidth: 54,
  },
  catCalVal: { fontSize: isSmall ? 15 : 17, color: C.primary },
  catCalUnit: { fontSize: 9, color: C.primary, opacity: 0.7 },
  catAddBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },

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
    paddingTop: 13,
    paddingBottom: Platform.OS === "ios" ? 30 : 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 6,
  },
  bottomLabel: { fontSize: 12, color: C.textMuted },
  bottomVal: { fontSize: 18, color: C.text, marginTop: 2 },
  doneBtn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  doneTxt: { color: "#fff", fontSize: isSmall ? 14 : 15 },
});