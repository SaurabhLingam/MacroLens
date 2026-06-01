/**
 * BarcodeScanner.jsx — Redesigned
 * White header with purple text, animated scan line,
 * white bottom sheet result modal matching reference screenshots.
 * All logic, navigation, and AsyncStorage usage preserved exactly.
 */

import React, { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  Dimensions,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Camera from "expo-camera";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "../components/TextWrapper";
import { C } from "../theme";
import {
  MAX_RECENT_FOODS,
  MAX_BARCODE_CACHE,
  normalizeMealType,
  toNumber,
  parseJsonSafe,
  getTodayKey,
  STORAGE_KEYS,
  createEmptyLog,
  ensureMealsShape,
  recalculateLogTotals,
  readCameraPermission,
  requestCameraPermissionApi,
  MEAL_TYPES,
} from "../utils";

const { width, height } = Dimensions.get("window");

// ── Design tokens ──────────────────────────────
const PURPLE = "#553FB5";
const PURPLE_LIGHT = "#EEE9FF";
const GREEN_GRAD = ["#93D056", "#35A329"];
const STATUS_BAR_H =
  Platform.OS === "ios" ? 56 : (StatusBar.currentHeight ?? 38) + 8;

// ── Helpers (unchanged) ────────────────────────
const clampPositive = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const parseServingAmount = (value) => {
  const text = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/,/g, ".");
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(kg|g|gram|grams|ml|l|oz)\b/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = String(match[2]).toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (unit === "kg") return { amount: amount * 1000, basis: "g" };
  if (unit === "g" || unit === "gram" || unit === "grams")
    return { amount, basis: "g" };
  if (unit === "l") return { amount: amount * 1000, basis: "ml" };
  if (unit === "ml") return { amount, basis: "ml" };
  if (unit === "oz") return { amount: amount * 28.3495, basis: "g" };
  return null;
};

const firstValidNumber = (src, keys) => {
  for (const key of keys) {
    const v = clampPositive(src?.[key]);
    if (v !== null) return v;
  }
  return null;
};

const calculateNutrient = ({
  nutriments,
  servingAmount,
  servingKeys,
  per100gKeys,
  per100mlKeys,
  preferPer100ml = false,
}) => {
  const ps = firstValidNumber(nutriments, servingKeys);
  if (ps !== null) return ps;
  if (servingAmount?.basis === "g") {
    const v = firstValidNumber(nutriments, per100gKeys);
    if (v !== null) return (v * servingAmount.amount) / 100;
  }
  if (servingAmount?.basis === "ml") {
    const v = firstValidNumber(nutriments, per100mlKeys);
    if (v !== null) return (v * servingAmount.amount) / 100;
  }
  const fg = firstValidNumber(nutriments, per100gKeys);
  const fm = firstValidNumber(nutriments, per100mlKeys);
  if (preferPer100ml) return fm ?? fg ?? 0;
  return fg ?? fm ?? 0;
};

const calculateCalories = ({ nutriments, servingAmount, preferPer100ml = false }) => {
  const ks = firstValidNumber(nutriments, ["energy-kcal_serving"]);
  if (ks !== null) return ks;
  const kjs = firstValidNumber(nutriments, ["energy_serving"]);
  if (kjs !== null) return kjs / 4.184;
  const k100 = calculateNutrient({
    nutriments,
    servingAmount,
    servingKeys: [],
    per100gKeys: ["energy-kcal_100g"],
    per100mlKeys: ["energy-kcal_100ml"],
    preferPer100ml,
  });
  if (k100 > 0) return k100;
  const j100 = calculateNutrient({
    nutriments,
    servingAmount,
    servingKeys: [],
    per100gKeys: ["energy_100g"],
    per100mlKeys: ["energy_100ml"],
    preferPer100ml,
  });
  return j100 > 0 ? j100 / 4.184 : 0;
};

const readBarcodeCache = async () => {
  const r = await AsyncStorage.getItem(STORAGE_KEYS.BARCODE_CACHE);
  const p = parseJsonSafe(r, []);
  return Array.isArray(p) ? p : [];
};
const writeBarcodeCache = async (e) =>
  AsyncStorage.setItem(STORAGE_KEYS.BARCODE_CACHE, JSON.stringify(e));
const upsertBarcodeCache = async (code, product) => {
  const cache = await readBarcodeCache();
  const next = [
    { code: String(code), product, updatedAt: Date.now() },
    ...cache.filter((e) => String(e?.code) !== String(code)),
  ].slice(0, MAX_BARCODE_CACHE);
  await writeBarcodeCache(next);
};
const getCachedProduct = async (code) => {
  const c = await readBarcodeCache();
  return c.find((e) => String(e?.code) === String(code))?.product || null;
};

const buildFoodFromOpenFoodFacts = (barcode, product) => {
  const nutriments = product?.nutriments || {};
  const servingText = String(product?.serving_size || "").trim();
  const servingAmount = parseServingAmount(servingText);
  const hasPer100ml =
    firstValidNumber(nutriments, [
      "energy-kcal_100ml",
      "energy_100ml",
      "proteins_100ml",
      "carbohydrates_100ml",
      "fat_100ml",
    ]) !== null;
  const preferPer100ml =
    servingAmount?.basis === "ml" || (!servingAmount && hasPer100ml);
  const serving = servingText || (preferPer100ml ? "100 ml" : "100 g");
  const calories = calculateCalories({ nutriments, servingAmount, preferPer100ml });
  const protein = calculateNutrient({
    nutriments, servingAmount,
    servingKeys: ["proteins_serving"],
    per100gKeys: ["proteins_100g"],
    per100mlKeys: ["proteins_100ml"],
    preferPer100ml,
  });
  const carbs = calculateNutrient({
    nutriments, servingAmount,
    servingKeys: ["carbohydrates_serving"],
    per100gKeys: ["carbohydrates_100g"],
    per100mlKeys: ["carbohydrates_100ml"],
    preferPer100ml,
  });
  const fat = calculateNutrient({
    nutriments, servingAmount,
    servingKeys: ["fat_serving"],
    per100gKeys: ["fat_100g"],
    per100mlKeys: ["fat_100ml"],
    preferPer100ml,
  });
  return {
    id: `barcode_${barcode}`,
    barcode,
    name:
      String(product?.product_name || "").trim() ||
      String(product?.generic_name || "").trim() ||
      `Product ${barcode}`,
    brand: String(product?.brands || "").trim(),
    serving,
    calories: toNumber(calories),
    protein: toNumber(protein),
    carbs: toNumber(carbs),
    fat: toNumber(fat),
  };
};

// ── Calorie ring ───────────────────────────────
const CalRing = ({ calories }) => {
  const size = 72;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  // ring always full for barcode (exact nutrition known)
  return (
    <View style={bs.ringWrap}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#F3F0FF" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="url(#ringGrad)" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={circ * 0.15}
          strokeLinecap="round" fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#93D056" />
            <stop offset="100%" stopColor="#35A329" />
          </linearGradient>
        </defs>
      </svg>
      <View style={bs.ringInner}>
        <Text weight="800" style={bs.ringCal}>{Math.round(calories)}</Text>
        <Text style={bs.ringCalLabel}>Cal</Text>
      </View>
    </View>
  );
};

// Use RN SVG instead of inline svg
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";

const CalorieRing = ({ calories }) => {
  const size = 72;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * 0.05; // almost full

  return (
    <View style={bs.ringWrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <SvgLinearGradient id="rg" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#93D056" />
            <Stop offset="100%" stopColor="#35A329" />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="#F3F0FF" strokeWidth={stroke} fill="none"
        />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="url(#rg)" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" fill="none"
          rotation="-90" origin={`${size / 2},${size / 2}`}
        />
      </Svg>
      <View style={bs.ringInner}>
        <Text weight="800" style={bs.ringCal}>{Math.round(calories)}</Text>
        <Text style={bs.ringCalLabel}>Cal</Text>
      </View>
    </View>
  );
};

// ── Macro label ────────────────────────────────
const MacroLabel = ({ label, value, color }) => (
  <View style={bs.macroCol}>
    <Text weight="700" style={[bs.macroVal, { color }]}>{value}</Text>
    <Text style={[bs.macroLbl, { color }]}>{label}</Text>
  </View>
);

// ── Nutri-score scale ──────────────────────────
const BC_GRADES = [
  { grade: "A", bg: "#16A34A", dimBg: "#D1FAE5", dimText: "#6EE7B7" },
  { grade: "B", bg: "#65A30D", dimBg: "#ECFCCB", dimText: "#A3E635" },
  { grade: "C", bg: "#F59E0B", dimBg: "#FEF3C7", dimText: "#FCD34D" },
  { grade: "D", bg: "#EA580C", dimBg: "#FFEDD5", dimText: "#FDBA74" },
  { grade: "E", bg: "#DC2626", dimBg: "#FEE2E2", dimText: "#FCA5A5" },
];

const getBarcodeNutritionGrade = (food) => {
  const cal  = toNumber(food.calories);
  const prot = toNumber(food.protein);
  const carb = toNumber(food.carbs);
  const fat  = toNumber(food.fat);
  if (cal === 0) return "C";
  const protKcal = prot * 4;
  const carbKcal = carb * 4;
  const fatKcal  = fat  * 9;
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

const BarcodeNutriScale = ({ food }) => {
  const activeGrade = getBarcodeNutritionGrade(food);
  return (
    <View style={bs.nutriScaleWrap}>
      <Text style={bs.nutriScaleLabel}>Nutrition Score</Text>
      <View style={bs.nutriScaleRow}>
        {BC_GRADES.map((g) => {
          const isActive = g.grade === activeGrade;
          return (
            <View
              key={g.grade}
              style={[
                bs.nutriScaleItem,
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
    </View>
  );
};

// ── Meal type tab ──────────────────────────────
const MEAL_TABS = ["Breakfast", "Lunch", "Snacks", "Dinner"];

// ─────────────────────────────────────────────────────
const BarcodeScanner = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const initialMeal = normalizeMealType(route.params?.mealType);

  const [cameraPermission, setCameraPermission] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanSuccess, setScanSuccess] = useState("");
  const [scannedFood, setScannedFood] = useState(null);
  const [isAdded, setIsAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedMeal, setSelectedMeal] = useState(
    MEAL_TABS.find((t) => t.toLowerCase() === initialMeal?.toLowerCase()) || "Breakfast"
  );

  // Sheet slide-up animation
  const sheetAnim = useRef(new Animated.Value(300)).current;

  // Animated scan line
  const lineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lineAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(lineAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Slide sheet up when food arrives
  useEffect(() => {
    if (scannedFood) {
      Animated.spring(sheetAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 14,
      }).start();
    } else {
      sheetAnim.setValue(300);
    }
  }, [scannedFood]);

  const hasPermission = cameraPermission?.granted ?? null;

  useEffect(() => {
    let mounted = true;
    const ask = async () => {
      try {
        const p = await readCameraPermission();
        if (mounted) setCameraPermission(p);
      } catch {
        if (mounted) {
          setCameraPermission({ granted: false, canAskAgain: false });
          setScanError("Could not request camera permission.");
        }
      }
    };
    ask();
    return () => { mounted = false; };
  }, []);

  const requestCameraPermission = async () => {
    try {
      const p = await requestCameraPermissionApi();
      setCameraPermission(p);
      return p;
    } catch {
      setScanError("Could not request camera permission.");
      return null;
    }
  };

  const addToTray = async (food, qty = 1) => {
    // Use capitalized key to match Nutrition.jsx's mealTray["Breakfast"] etc.
    const mealType = selectedMeal;
    const key = getTodayKey();
    const raw = await AsyncStorage.getItem(key);
    const log = raw ? parseJsonSafe(raw, createEmptyLog(key)) : createEmptyLog(key);
    ensureMealsShape(log);
    const items = Array.isArray(log.meals[mealType]) ? [...log.meals[mealType]] : [];
    const q = Math.max(1, toNumber(qty, 1));
    const nm = String(food.name || "").trim().toLowerCase();
    const idx = items.findIndex(
      (x) => String(x.name || "").trim().toLowerCase() === nm
    );
    if (idx >= 0) {
      const ex = items[idx];
      items[idx] = {
        ...ex,
        serving: food.serving || ex.serving || "1 serving",
        calories: toNumber(food.calories, ex.calories),
        protein: toNumber(food.protein, ex.protein),
        carbs: toNumber(food.carbs, ex.carbs),
        fat: toNumber(food.fat, ex.fat),
        quantity: toNumber(ex.quantity, 1) + q,
        totalCalories: toNumber(food.calories, ex.calories) * (toNumber(ex.quantity, 1) + q),
        addedAt: new Date().toISOString(),
        mealType,
      };
    } else {
      items.push({
        id: food.id || `${Date.now()}_${nm}`,
        name: food.name,
        serving: food.serving || "1 serving",
        calories: toNumber(food.calories),
        protein: toNumber(food.protein),
        carbs: toNumber(food.carbs),
        fat: toNumber(food.fat),
        quantity: q,
        totalCalories: toNumber(food.calories) * q,
        addedAt: new Date().toISOString(),
        mealType,
        barcode: food.barcode,
      });
    }
    log.meals[mealType] = items;
    recalculateLogTotals(log);
    await AsyncStorage.setItem(key, JSON.stringify(log));
    // update recent
    const rr = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_FOODS);
    const rarr = Array.isArray(parseJsonSafe(rr, [])) ? parseJsonSafe(rr, []) : [];
    const rk = String(food.name || "").trim().toLowerCase();
    const ri = {
      id: food.id || `${Date.now()}_${rk}`,
      name: food.name,
      serving: food.serving || "1 serving",
      calories: toNumber(food.calories),
      protein: toNumber(food.protein),
      carbs: toNumber(food.carbs),
      fat: toNumber(food.fat),
      servings: q,
      totalCalories: toNumber(food.calories) * q,
      addedAt: new Date().toISOString(),
      barcode: food.barcode,
    };
    await AsyncStorage.setItem(
      STORAGE_KEYS.RECENT_FOODS,
      JSON.stringify(
        [ri, ...rarr.filter((x) => String(x?.name || "").trim().toLowerCase() !== rk)].slice(
          0, MAX_RECENT_FOODS
        )
      )
    );
  };

  const handleBarcodeScanned = async ({ data }) => {
    const code = String(data || "").trim();
    if (isProcessing || scannedFood || !code) return;
    setIsProcessing(true);
    setScanError("");
    setScanSuccess("");
    setIsAdded(false);
    setQuantity(1);
    try {
      let product = await getCachedProduct(code);
      if (!product) {
        const res = await fetch(
          `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,generic_name,brands,serving_size,nutriments`
        );
        if (!res.ok) throw new Error("Could not fetch product details.");
        const payload = await res.json();
        if (toNumber(payload?.status) !== 1 || !payload?.product)
          throw new Error("Product not found for this barcode.");
        product = payload.product;
        await upsertBarcodeCache(code, product);
      }
      setScannedFood(buildFoodFromOpenFoodFacts(code, product));
    } catch (e) {
      setScanError(e?.message || "Could not scan barcode. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddToTray = async () => {
    if (!scannedFood || isAdded) return;
    try {
      await addToTray(scannedFood, quantity);
      setIsAdded(true);
      setScanSuccess(`${scannedFood.name} added to ${selectedMeal}.`);
      const todayBarcodeKey = `barcode_scan_count_${getTodayKey()}`;
      const prev = await AsyncStorage.getItem(todayBarcodeKey);
      await AsyncStorage.setItem(todayBarcodeKey, String((parseInt(prev) || 0) + 1));
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_BARCODE, scannedFood.name);
    } catch {
      setScanError("Could not save item to tray. Please try again.");
    }
  };

  const resetScanner = () => {
    setScannedFood(null);
    setIsAdded(false);
    setScanError("");
    setScanSuccess("");
    setIsProcessing(false);
    setQuantity(1);
  };

  // ── Permission: loading ───────────────────────
  if (hasPermission === null) {
    return (
      <View style={bs.centered}>
        <View style={bs.permIconWrap}>
          <Ionicons name="barcode-outline" size={40} color={PURPLE} />
        </View>
        <ActivityIndicator size="large" color={PURPLE} style={{ marginBottom: 14 }} />
        <Text weight="700" style={bs.centeredTitle}>Camera Access</Text>
        <Text style={bs.centeredSub}>Requesting permission to use your camera...</Text>
      </View>
    );
  }

  // ── Permission: denied ────────────────────────
  if (hasPermission === false) {
    return (
      <View style={bs.centeredDenied}>
        <View style={[bs.permIconWrap, { backgroundColor: "rgba(229,57,53,0.1)" }]}>
          <Feather name="camera-off" size={36} color="#E53935" />
        </View>
        <Text weight="700" style={[bs.centeredTitle, { color: "#111" }]}>Camera Blocked</Text>
        <Text style={[bs.centeredSub, { color: "#666" }]}>
          Enable camera access to scan barcodes.
        </Text>
        <TouchableOpacity
          style={bs.permBtn}
          onPress={cameraPermission?.canAskAgain ? requestCameraPermission : () => Linking.openSettings()}
          activeOpacity={0.85}
        >
          <LinearGradient colors={GREEN_GRAD} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={bs.permBtnInner}>
            <Text weight="700" style={bs.permBtnTxt}>
              {cameraPermission?.canAskAgain ? "Allow Camera Access" : "Open App Settings"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main scanner ──────────────────────────────
  return (
    <View style={bs.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />

      {/* ── White header ── */}
      <View style={bs.header}>
        <TouchableOpacity style={bs.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={PURPLE} />
        </TouchableOpacity>
        <View>
          <Text weight="700" style={bs.headerTitle}>Scan Barcode</Text>
          <Text style={bs.headerSub}>
            Scan the barcode on packaged food to instantly view nutrition details.
          </Text>
        </View>
      </View>

      {/* ── Camera ── */}
      <Camera.CameraView
        style={bs.camera}
        facing="back"
        onBarcodeScanned={scannedFood || isProcessing ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "qr", "itf14", "codabar", "code128", "code39", "code93"],
        }}
      />

      {/* ── Scan guide overlay ── */}
      <View style={bs.guideOverlay} pointerEvents="none">
        {/* dark top mask */}
        <View style={bs.maskTop} />
        <View style={bs.guideRow}>
          <View style={bs.maskSide} />
          {/* scan window */}
          <View style={bs.scanWindow}>
            {[bs.tl, bs.tr, bs.bl, bs.br].map((cs, i) => (
              <View key={i} style={[bs.corner, cs]} />
            ))}
            <Animated.View
              style={[
                bs.scanLine,
                {
                  transform: [
                    {
                      translateY: lineAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 148],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
          <View style={bs.maskSide} />
        </View>
        <View style={bs.maskBottom} />
      </View>

      {/* ── Processing indicator ── */}
      {isProcessing && (
        <View style={bs.processingBadge}>
          <ActivityIndicator size="small" color={PURPLE} />
          <Text weight="600" style={bs.processingTxt}>Looking up product...</Text>
        </View>
      )}

      {/* ── Instruction label ── */}
      {!scannedFood && !isProcessing && !scanError && (
        <View style={bs.instructWrap} pointerEvents="none">
          <Text weight="500" style={bs.instructTxt}>Align barcode within the frame</Text>
        </View>
      )}

      {/* ── Error badge ── */}
      {scanError && !scannedFood && (
        <View style={bs.errorBadge}>
          <Text style={bs.errorBadgeTxt}>{scanError}</Text>
          <TouchableOpacity style={bs.retryBtn} onPress={resetScanner}>
            <Ionicons name="refresh" size={14} color="#fff" />
            <Text weight="600" style={bs.retryTxt}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Result bottom sheet ── */}
      {scannedFood && (
        <Animated.View
          style={[bs.sheet, { transform: [{ translateY: sheetAnim }] }]}
        >
          {/* handle */}
          <View style={bs.sheetHandle} />

          {/* Food row: image placeholder + name + ring */}
          <View style={bs.foodRow}>
            {/* Food icon placeholder */}
            <View style={bs.foodIcon}>
              <Ionicons name="fast-food-outline" size={28} color={PURPLE} />
            </View>

            {/* Name + quantity */}
            <View style={bs.foodMeta}>
              <Text weight="700" style={bs.foodName} numberOfLines={2}>
                {scannedFood.name}
              </Text>
              {scannedFood.brand ? (
                <Text style={bs.foodBrand}>{scannedFood.brand}</Text>
              ) : null}
              {/* Quantity row */}
              <View style={bs.qtyRow}>
                <Text style={bs.qtyLabel}>Quantity</Text>
                <View style={bs.qtyStepper}>
                  <TouchableOpacity
                    style={bs.qtyBtn}
                    onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={isAdded}
                  >
                    <Feather name="minus" size={14} color={isAdded ? "#ccc" : PURPLE} />
                  </TouchableOpacity>
                  <Text weight="700" style={bs.qtyVal}>{quantity}</Text>
                  <TouchableOpacity
                    style={bs.qtyBtn}
                    onPress={() => setQuantity((q) => q + 1)}
                    disabled={isAdded}
                  >
                    <Feather name="plus" size={14} color={isAdded ? "#ccc" : PURPLE} />
                  </TouchableOpacity>
                </View>
                <View style={bs.servingBadge}>
                  <Text style={bs.servingBadgeTxt}>{scannedFood.serving}</Text>
                  <Feather name="check" size={10} color="#35A329" />
                </View>
              </View>
            </View>

            {/* Calorie ring */}
            <CalorieRing calories={toNumber(scannedFood.calories) * quantity} />
          </View>

          {/* Macro row */}
          <View style={bs.macroRow}>
            <MacroLabel
              label="Protein"
              value={`${(toNumber(scannedFood.protein) * quantity).toFixed(1)}g`}
              color="#553FB5"
            />
            <View style={bs.macroDivider} />
            <MacroLabel
              label="Carbs"
              value={`${(toNumber(scannedFood.carbs) * quantity).toFixed(1)}g`}
              color="#35A329"
            />
            <View style={bs.macroDivider} />
            <MacroLabel
              label="Fats"
              value={`${(toNumber(scannedFood.fat) * quantity).toFixed(1)}g`}
              color="#F97316"
            />
          </View>
          {/* Nutri-score */}
          <BarcodeNutriScale food={scannedFood} />
          {/* Divider */}
          <View style={bs.divider} />

          {/* Meal type tabs */}
          <View style={bs.mealTabs}>
            {MEAL_TABS.map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[bs.mealTab, selectedMeal === tab && bs.mealTabActive]}
                onPress={() => !isAdded && setSelectedMeal(tab)}
                activeOpacity={0.75}
              >
                <Text
                  weight={selectedMeal === tab ? "700" : "500"}
                  style={[bs.mealTabTxt, selectedMeal === tab && bs.mealTabTxtActive]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Success message */}
          {scanSuccess ? (
            <View style={bs.successBox}>
              <Feather name="check-circle" size={14} color="#35A329" />
              <Text weight="600" style={bs.successTxt}>{scanSuccess}</Text>
            </View>
          ) : null}

          {/* Action buttons */}
          <View style={bs.actionRow}>
            <TouchableOpacity
              style={bs.scanAnotherBtn}
              onPress={resetScanner}
              activeOpacity={0.85}
            >
              <Text weight="600" style={bs.scanAnotherTxt}>Scan Another</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={bs.addBtnWrap}
              onPress={isAdded ? () => navigation.goBack() : handleAddToTray}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={isAdded ? ["#4CAF50", "#2E7D32"] : GREEN_GRAD}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={bs.addBtn}
              >
                {isAdded ? (
                  <View style={bs.addBtnInner}>
                    <Feather name="check" size={16} color="#fff" />
                    <Text weight="700" style={bs.addBtnTxt}>Done</Text>
                  </View>
                ) : (
                  <Text weight="700" style={bs.addBtnTxt}>+ Add</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

export default BarcodeScanner;

// ── Styles ─────────────────────────────────────────
const GUIDE_W = width * 0.82;
const GUIDE_H = 160;

const bs = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  // ── Permission screens ──
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 28,
  },
  centeredDenied: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 28,
  },
  permIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PURPLE_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  centeredTitle: { fontSize: 22, color: PURPLE, marginBottom: 8 },
  centeredSub: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 20,
  },
  permBtn: { width: "100%", borderRadius: 14, overflow: "hidden" },
  permBtnInner: { paddingVertical: 14, alignItems: "center" },
  permBtnTxt: { color: "#fff", fontSize: 16 },

  // ── Header ──
  header: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : (StatusBar.currentHeight ?? 28) + 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    zIndex: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, color: PURPLE },
  headerSub: { fontSize: 12, color: PURPLE, marginTop: 2, opacity: 0.8 },

  // ── Camera ──
  camera: { flex: 1 },

  // ── Guide overlay ──
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    // push below header is handled by the camera being flex:1
  },
  maskTop: { flex: 2, backgroundColor: "rgba(0,0,0,0.55)" },
  maskBottom: { flex: 3, backgroundColor: "rgba(0,0,0,0.55)" },
  guideRow: { flexDirection: "row", height: GUIDE_H },
  maskSide: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },

  // ── Scan window ──
  scanWindow: {
    width: GUIDE_W,
    height: GUIDE_H,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 22,
    height: 22,
    borderWidth: 3,
    borderColor: "#fff",
  },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  scanLine: {
    position: "absolute",
    top: 4,
    left: 12,
    right: 12,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: "#93D056",
    shadowColor: "#93D056",
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },

  // ── Instruction label ──
  instructWrap: {
    position: "absolute",
    bottom: 220,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  instructTxt: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },

  // ── Processing badge ──
  processingBadge: {
    position: "absolute",
    bottom: 230,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  processingTxt: { color: PURPLE, fontSize: 14 },

  // ── Error badge ──
  errorBadge: {
    position: "absolute",
    bottom: 60,
    left: 24,
    right: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  errorBadgeTxt: { color: "#B91C1C", fontSize: 13, textAlign: "center" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PURPLE,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  retryTxt: { color: "#fff", fontSize: 13 },

  // ── Bottom sheet ──
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 16,
  },

  // ── Food row ──
  foodRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  foodIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: PURPLE_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  foodMeta: { flex: 1 },
  foodName: { fontSize: 16, color: "#111", marginBottom: 2 },
  foodBrand: { fontSize: 12, color: "#888", marginBottom: 6 },

  // ── Quantity ──
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  qtyLabel: { fontSize: 13, color: "#555" },
  qtyStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5F3FF",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  qtyBtn: { padding: 2 },
  qtyVal: { fontSize: 14, color: PURPLE, minWidth: 18, textAlign: "center" },
  servingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F0FDF4",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  servingBadgeTxt: { fontSize: 10, color: "#166534" },

  // ── Calorie ring ──
  ringWrap: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  ringInner: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  ringCal: { fontSize: 16, color: "#111" },
  ringCalLabel: { fontSize: 10, color: "#888" },

  // ── Macros ──
  macroRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  macroCol: { flex: 1, alignItems: "center" },
  macroVal: { fontSize: 15 },
  macroLbl: { fontSize: 11, marginTop: 2 },
  macroDivider: { width: 1, height: 28, backgroundColor: "#E5E7EB" },

  // ── Divider ──
  divider: { height: 1, backgroundColor: "#F0F0F0", marginBottom: 14 },
  nutriScaleWrap:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  nutriScaleLabel: { fontSize: 12, color: "#888" },
  nutriScaleRow:   { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 2 },
  nutriScaleItem:  { width: 18, height: 22, borderRadius: 4, alignItems: "center", justifyContent: "center" },

  // ── Meal tabs ──
  mealTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  mealTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  mealTabActive: { backgroundColor: PURPLE },
  mealTabTxt: { fontSize: 12, color: "#888" },
  mealTabTxtActive: { color: "#fff" },

  // ── Success ──
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  successTxt: { color: "#166534", fontSize: 13, flex: 1 },

  // ── Action row ──
  actionRow: { flexDirection: "row", gap: 10 },
  scanAnotherBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PURPLE,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  scanAnotherTxt: { color: PURPLE, fontSize: 15 },
  addBtnWrap: { flex: 1, borderRadius: 14, overflow: "hidden" },
  addBtn: { paddingVertical: 14, alignItems: "center" },
  addBtnInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  addBtnTxt: { color: "#fff", fontSize: 15 },
});