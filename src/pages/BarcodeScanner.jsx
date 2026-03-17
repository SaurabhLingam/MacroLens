/**
 * BarcodeScanner.jsx — Premium redesign
 * Branded permission screen, animated scan line, cleaner result card,
 * proper bottom safe-area, consistent token system.
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Camera from "expo-camera";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "../components/TextWrapper";

const { width } = Dimensions.get("window");

// ── Design tokens ──────────────────────────────
const C = {
  primary: "#0A7A3E",
  primaryMid: "#14A855",
  primaryLight: "#16aa16",
  primaryDark: "#064D27",
  blue: "#2563EB",
  orange: "#EA580C",
  emerald: "#059669",
};

// ── Constants ─────────────────────────────────
const DEFAULT_MEALS = { Breakfast: [], Lunch: [], Snacks: [], Dinner: [] };
const VALID_MEAL_TYPES = Object.keys(DEFAULT_MEALS);
const RECENT_FOODS_KEY = "recentFoods";
const MAX_RECENT_FOODS = 20;
const BARCODE_CACHE_KEY = "barcodeProductCache";
const MAX_BARCODE_CACHE = 80;

const normalizeMealType = (v) => (VALID_MEAL_TYPES.includes(v) ? v : "Snacks");
const toNumber = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const parseJsonSafe = (raw, fb) => {
  try {
    return JSON.parse(raw) ?? fb;
  } catch {
    return fb;
  }
};
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

const calculateCalories = ({
  nutriments,
  servingAmount,
  preferPer100ml = false,
}) => {
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
  const r = await AsyncStorage.getItem(BARCODE_CACHE_KEY);
  const p = parseJsonSafe(r, []);
  return Array.isArray(p) ? p : [];
};
const writeBarcodeCache = async (e) =>
  AsyncStorage.setItem(BARCODE_CACHE_KEY, JSON.stringify(e));
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

const getTodayKey = () => {
  const t = new Date();
  return `nutritionLog_${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};
const createEmptyLog = (key) => ({
  date: key.replace("nutritionLog_", ""),
  totalCalories: 0,
  totalProtein: 0,
  totalCarbs: 0,
  totalFat: 0,
  meals: { ...DEFAULT_MEALS },
});
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
const recalculateLogTotals = (log) => {
  const all = Object.values(log.meals || {}).flat();
  log.totalCalories = all.reduce(
    (s, x) => s + toNumber(x.calories) * toNumber(x.quantity, 1),
    0,
  );
  log.totalProtein = all.reduce(
    (s, x) => s + toNumber(x.protein) * toNumber(x.quantity, 1),
    0,
  );
  log.totalCarbs = all.reduce(
    (s, x) => s + toNumber(x.carbs) * toNumber(x.quantity, 1),
    0,
  );
  log.totalFat = all.reduce(
    (s, x) => s + toNumber(x.fat) * toNumber(x.quantity, 1),
    0,
  );
};
const readCameraPermission = async () => {
  if (typeof Camera.getCameraPermissionsAsync === "function")
    return Camera.getCameraPermissionsAsync();
  if (typeof Camera.requestCameraPermissionsAsync === "function")
    return Camera.requestCameraPermissionsAsync();
  if (typeof Camera?.Camera?.requestCameraPermissionsAsync === "function")
    return Camera.Camera.requestCameraPermissionsAsync();
  throw new Error("Camera permission APIs are unavailable.");
};
const requestCameraPermissionApi = async () => {
  if (typeof Camera.requestCameraPermissionsAsync === "function")
    return Camera.requestCameraPermissionsAsync();
  if (typeof Camera?.Camera?.requestCameraPermissionsAsync === "function")
    return Camera.Camera.requestCameraPermissionsAsync();
  if (typeof Camera.getCameraPermissionsAsync === "function")
    return Camera.getCameraPermissionsAsync();
  throw new Error("Camera permission APIs are unavailable.");
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
  const calories = calculateCalories({
    nutriments,
    servingAmount,
    preferPer100ml,
  });
  const protein = calculateNutrient({
    nutriments,
    servingAmount,
    servingKeys: ["proteins_serving"],
    per100gKeys: ["proteins_100g"],
    per100mlKeys: ["proteins_100ml"],
    preferPer100ml,
  });
  const carbs = calculateNutrient({
    nutriments,
    servingAmount,
    servingKeys: ["carbohydrates_serving"],
    per100gKeys: ["carbohydrates_100g"],
    per100mlKeys: ["carbohydrates_100ml"],
    preferPer100ml,
  });
  const fat = calculateNutrient({
    nutriments,
    servingAmount,
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

// ── Macro pill ─────────────────────────────────
const Pill = ({ label, value, bg, fg }) => (
  <View style={[bs.pill, { backgroundColor: bg }]}>
    <Text weight="600" style={[bs.pillTxt, { color: fg }]}>
      {label}: {value}
    </Text>
  </View>
);

// ─────────────────────────────────────────────────────
const BarcodeScanner = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const mealType = normalizeMealType(route.params?.mealType);

  const [cameraPermission, setCameraPermission] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanSuccess, setScanSuccess] = useState("");
  const [scannedFood, setScannedFood] = useState(null);
  const [isAdded, setIsAdded] = useState(false);

  // Animated scan line
  const lineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lineAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(lineAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

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
    return () => {
      mounted = false;
    };
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

  const addToTray = async (food, quantity = 1) => {
    const key = getTodayKey();
    const raw = await AsyncStorage.getItem(key);
    const log = raw
      ? parseJsonSafe(raw, createEmptyLog(key))
      : createEmptyLog(key);
    ensureMealsShape(log);
    const items = Array.isArray(log.meals[mealType])
      ? [...log.meals[mealType]]
      : [];
    const qty = Math.max(1, toNumber(quantity, 1));
    const nm = String(food.name || "")
      .trim()
      .toLowerCase();
    const idx = items.findIndex(
      (x) =>
        String(x.name || "")
          .trim()
          .toLowerCase() === nm,
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
        quantity: toNumber(ex.quantity, 1) + qty,
        totalCalories:
          toNumber(food.calories, ex.calories) *
          (toNumber(ex.quantity, 1) + qty),
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
        quantity: qty,
        totalCalories: toNumber(food.calories) * qty,
        addedAt: new Date().toISOString(),
        mealType,
        barcode: food.barcode,
      });
    }
    log.meals[mealType] = items;
    recalculateLogTotals(log);
    await AsyncStorage.setItem(key, JSON.stringify(log));
    // update recent
    const rr = await AsyncStorage.getItem(RECENT_FOODS_KEY);
    const rarr = Array.isArray(parseJsonSafe(rr, []))
      ? parseJsonSafe(rr, [])
      : [];
    const rk = String(food.name || "")
      .trim()
      .toLowerCase();
    const ri = {
      id: food.id || `${Date.now()}_${rk}`,
      name: food.name,
      serving: food.serving || "1 serving",
      calories: toNumber(food.calories),
      protein: toNumber(food.protein),
      carbs: toNumber(food.carbs),
      fat: toNumber(food.fat),
      servings: qty,
      totalCalories: toNumber(food.calories) * qty,
      addedAt: new Date().toISOString(),
      barcode: food.barcode,
    };
    await AsyncStorage.setItem(
      RECENT_FOODS_KEY,
      JSON.stringify(
        [
          ri,
          ...rarr.filter(
            (x) =>
              String(x?.name || "")
                .trim()
                .toLowerCase() !== rk,
          ),
        ].slice(0, MAX_RECENT_FOODS),
      ),
    );
  };

  const handleBarcodeScanned = async ({ data }) => {
    const code = String(data || "").trim();
    if (isProcessing || scannedFood || !code) return;
    setIsProcessing(true);
    setScanError("");
    setScanSuccess("");
    setIsAdded(false);
    try {
      let product = await getCachedProduct(code);
      if (!product) {
        const res = await fetch(
          `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,generic_name,brands,serving_size,nutriments`,
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
      await addToTray(scannedFood, 1);
      setIsAdded(true);
      setScanSuccess(`${scannedFood.name} added to ${mealType}.`);
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
  };

  // ── Permission: loading ───────────────────────
  if (hasPermission === null) {
    return (
      <View style={bs.centered}>
        <View style={bs.permIconWrap}>
          <Ionicons name="barcode-outline" size={40} color={C.primaryLight} />
        </View>
        <ActivityIndicator
          size="large"
          color={C.primaryLight}
          style={{ marginBottom: 14 }}
        />
        <Text weight="700" style={bs.centeredTitle}>
          Camera Access
        </Text>
        <Text style={bs.centeredSub}>
          Requesting permission to use your camera...
        </Text>
      </View>
    );
  }

  // ── Permission: denied ────────────────────────
  if (hasPermission === false) {
    return (
      <LinearGradient colors={["#0D1F16", "#1a2e1f"]} style={bs.centered}>
        <View
          style={[bs.permIconWrap, { backgroundColor: "rgba(229,57,53,0.15)" }]}
        >
          <Feather name="camera-off" size={36} color="#E53935" />
        </View>
        <Text weight="700" style={bs.centeredTitle}>
          Camera Blocked
        </Text>
        <Text style={bs.centeredSub}>
          Enable camera access to scan barcodes.
        </Text>
        <TouchableOpacity
          style={bs.permBtn}
          onPress={
            cameraPermission?.canAskAgain
              ? requestCameraPermission
              : () => Linking.openSettings()
          }
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[C.primaryLight, C.primaryDark]}
            style={bs.permBtnInner}
          >
            <Text weight="700" style={bs.permBtnTxt}>
              {cameraPermission?.canAskAgain
                ? "Allow Camera Access"
                : "Open App Settings"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  // ── Main scanner ──────────────────────────────
  return (
    <View style={bs.container}>
      <Camera.CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={
          scannedFood || isProcessing ? undefined : handleBarcodeScanned
        }
        barcodeScannerSettings={{
          barcodeTypes: [
            "ean13",
            "ean8",
            "upc_a",
            "upc_e",
            "qr",
            "itf14",
            "codabar",
            "code128",
            "code39",
            "code93",
          ],
        }}
      />

      {/* Dark gradient header */}
      <LinearGradient
        colors={["rgba(0,0,0,0.85)", "transparent"]}
        style={bs.header}
      >
        <TouchableOpacity
          style={bs.iconBtn}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text weight="700" style={bs.headerTitle}>
          Scan for {mealType}
        </Text>
        <View style={{ width: 44 }} />
      </LinearGradient>

      {/* Overlay */}
      <View style={bs.overlay}>
        {/* Scan window */}
        <View style={bs.scanWindow}>
          {/* Corner brackets */}
          {[bs.tl, bs.tr, bs.bl, bs.br].map((cs, i) => (
            <View key={i} style={[bs.corner, cs]} />
          ))}
          {/* Animated scan line */}
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

        {/* Instruction label above card */}
        {!scannedFood && !isProcessing && (
          <View style={bs.instructLabel}>
            <Text weight="500" style={bs.instructLabelTxt}>
              Align barcode within the frame
            </Text>
          </View>
        )}

        {/* Results card */}
        <View style={bs.card}>
          {/* Processing */}
          {isProcessing && (
            <View style={bs.cardRow}>
              <ActivityIndicator size="small" color={C.primaryLight} />
              <Text weight="500" style={bs.lookupTxt}>
                Looking up product...
              </Text>
            </View>
          )}

          {/* Scanned food */}
          {scannedFood && (
            <View style={bs.foodResult}>
              <View style={bs.foodResultHeader}>
                <View style={{ flex: 1 }}>
                  <Text weight="700" style={bs.foodResultName}>
                    {scannedFood.name}
                  </Text>
                  {scannedFood.brand ? (
                    <Text style={bs.foodResultBrand}>{scannedFood.brand}</Text>
                  ) : null}
                  <Text style={bs.foodResultServing}>
                    {scannedFood.serving}
                  </Text>
                </View>
                <View style={bs.calBubble}>
                  <Text weight="800" style={bs.calBubbleVal}>
                    {Math.round(toNumber(scannedFood.calories))}
                  </Text>
                  <Text style={bs.calBubbleUnit}>Cal</Text>
                </View>
              </View>
              <View style={bs.pillRow}>
                <Pill
                  label="P"
                  value={`${toNumber(scannedFood.protein).toFixed(1)}g`}
                  bg="#DBEAFE"
                  fg={C.blue}
                />
                <Pill
                  label="C"
                  value={`${toNumber(scannedFood.carbs).toFixed(1)}g`}
                  bg="#D1FAE5"
                  fg={C.emerald}
                />
                <Pill
                  label="F"
                  value={`${toNumber(scannedFood.fat).toFixed(1)}g`}
                  bg="#FEE0D1"
                  fg={C.orange}
                />
              </View>
              <TouchableOpacity
                style={[bs.addToTrayBtn, isAdded && bs.addToTrayBtnDone]}
                onPress={handleAddToTray}
                disabled={isAdded}
                activeOpacity={0.9}
              >
                {isAdded ? (
                  <>
                    <Feather name="check" size={16} color="#fff" />
                    <Text weight="700" style={bs.addToTrayTxt}>
                      Added to {mealType}
                    </Text>
                  </>
                ) : (
                  <Text weight="700" style={bs.addToTrayTxt}>
                    Add to Tray
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Success */}
          {scanSuccess && !scanError && (
            <View style={bs.successBox}>
              <Feather name="check-circle" size={16} color="#059669" />
              <Text weight="600" style={bs.successTxt}>
                {scanSuccess}
              </Text>
            </View>
          )}

          {/* Error */}
          {scanError && (
            <View style={bs.errorBox}>
              <Text style={bs.errorTxt}>{scanError}</Text>
              <TouchableOpacity style={bs.retryBtn} onPress={resetScanner}>
                <Ionicons name="refresh" size={14} color="#fff" />
                <Text weight="600" style={bs.retryTxt}>
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Default hint */}
          {!isProcessing && !scannedFood && !scanError && (
            <Text style={bs.cardHint}>
              We fetch nutrition details after a single scan
            </Text>
          )}

          {/* Action row */}
          {scannedFood && !scanError && (
            <View style={bs.actionRow}>
              <TouchableOpacity
                style={bs.scanAnotherBtn}
                onPress={resetScanner}
              >
                <Ionicons name="barcode-outline" size={15} color="#fff" />
                <Text weight="600" style={bs.scanAnotherTxt}>
                  Scan Another
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[bs.doneBtn, !isAdded && bs.doneBtnDisabled]}
                onPress={() => navigation.goBack()}
                disabled={!isAdded}
              >
                <Text weight="700" style={bs.doneBtnTxt}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

export default BarcodeScanner;

const GUIDE_W = width * 0.88;
const GUIDE_H = 160;

const bs = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  // Permission screens
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D1F16",
    paddingHorizontal: 28,
  },
  permIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(22,170,22,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  centeredTitle: { fontSize: 22, color: "#fff", marginBottom: 8 },
  centeredSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  permBtn: { width: "100%", borderRadius: 14, overflow: "hidden" },
  permBtnInner: { paddingVertical: 14, alignItems: "center" },
  permBtnTxt: { color: "#fff", fontSize: 16 },

  // Header
  header: {
    position: "absolute",
    top: 0,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 52 : 32,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: 17, textAlign: "center" },

  // Overlay
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  // Scan window
  scanWindow: {
    width: GUIDE_W,
    height: GUIDE_H,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    position: "relative",
    marginBottom: 14,
  },
  corner: {
    position: "absolute",
    width: 22,
    height: 22,
    borderWidth: 3,
    borderColor: C.primaryLight,
  },
  tl: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
  },
  tr: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 4,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
  },
  br: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 4,
  },
  scanLine: {
    position: "absolute",
    top: 4,
    left: 12,
    right: 12,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: C.primaryLight,
    shadowColor: C.primaryLight,
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },

  instructLabel: { marginBottom: 10 },
  instructLabelTxt: { color: "rgba(255,255,255,0.75)", fontSize: 13 },

  // Card
  card: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: "rgba(10,10,10,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  cardHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    textAlign: "center",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  lookupTxt: { color: "#d1fae5", fontSize: 14 },

  // Food result
  foodResult: { gap: 10 },
  foodResultHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  foodResultName: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 2,
    flexShrink: 1,
  },
  foodResultBrand: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    marginBottom: 2,
  },
  foodResultServing: { color: "rgba(255,255,255,0.55)", fontSize: 12 },
  calBubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(22,170,22,0.18)",
    borderWidth: 2,
    borderColor: C.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  calBubbleVal: { fontSize: 16, color: "#fff" },
  calBubbleUnit: { fontSize: 10, color: "rgba(255,255,255,0.65)" },

  // Pills
  pillRow: { flexDirection: "row", gap: 8 },
  pill: { flex: 1, paddingVertical: 6, borderRadius: 20, alignItems: "center" },
  pillTxt: { fontSize: 12 },

  addToTrayBtn: {
    backgroundColor: C.primaryLight,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  addToTrayBtnDone: { backgroundColor: "#374151" },
  addToTrayTxt: { color: "#fff", fontSize: 14 },

  // Success / Error
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(5,150,105,0.2)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.5)",
    padding: 10,
  },
  successTxt: { color: "#d1fae5", fontSize: 13, flex: 1 },
  errorBox: {
    backgroundColor: "rgba(220,38,38,0.2)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.5)",
    padding: 10,
    gap: 8,
  },
  errorTxt: { color: "#fee2e2", fontSize: 12, textAlign: "center" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    backgroundColor: "#1F2937",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  retryTxt: { color: "#fff", fontSize: 13 },

  // Action row
  actionRow: { flexDirection: "row", gap: 8 },
  scanAnotherBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#1F2937",
    borderRadius: 12,
    paddingVertical: 10,
  },
  scanAnotherTxt: { color: "#fff", fontSize: 13 },
  doneBtn: {
    flex: 1,
    backgroundColor: C.primaryLight,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  doneBtnDisabled: { opacity: 0.45 },
  doneBtnTxt: { color: "#fff", fontSize: 13 },
});
