/**
 * Scan.jsx (MealScan) — Premium redesign
 * Fixed frame overflow on small screens, proper handle bar on results sheet,
 * legible scan result cards, animated scan line, improved permission screen.
 * All logic, navigation, and AsyncStorage usage preserved exactly.
 */

import React, { memo, useEffect, useRef, useState } from "react";
import {
  View,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Linking,
  Image,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Camera from "expo-camera";
import { Text } from "../components/TextWrapper";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { analyzeMealImageWithGroq } from "./llm";

const { width, height } = Dimensions.get("window");
const isSmall = width < 380;

// ── Design tokens ──────────────────────────────
const C = {
  primary: "#0A7A3E",
  primaryMid: "#14A855",
  primaryLight: "#16aa16",
  primaryDark: "#064D27",
  surface: "#FFFFFF",
  border: "#E8EEE9",
  text: "#0D1F16",
  textMuted: "#8CA898",
  blue: "#2563EB",
  orange: "#EA580C",
  emerald: "#059669",
  amber: "#D97706",
};

// ── Frame: safe height so it never overflows ──
const FRAME_W = isSmall ? width * 0.82 : Math.min(width * 0.82, 300);
const FRAME_H = Math.min(isSmall ? width * 0.9 : 380, height * 0.42);

// ── Constants ─────────────────────────────────
const DEFAULT_MEALS = { Breakfast: [], Lunch: [], Snacks: [], Dinner: [] };
const VALID_MEAL_TYPES = Object.keys(DEFAULT_MEALS);
const RECENT_FOODS_KEY = "recentFoods";
const MAX_RECENT_FOODS = 20;

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
const toMimeType = (uri) =>
  uri?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
const normalizeScanFood = (food, index) => ({
  id: food?.id || `scan_food_${Date.now()}_${index}`,
  name: String(food?.name || "Unknown item"),
  serving: String(food?.serving || "1 serving"),
  calories: toNumber(food?.calories),
  protein: toNumber(food?.protein),
  carbs: toNumber(food?.carbs),
  fat: toNumber(food?.fat),
  confidence: toNumber(food?.confidence, 0.65),
});

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

// ── Circular macro widget ──────────────────────
const CircularMacro = memo(({ label, value, unit, color, percentage }) => {
  const r = 18;
  const sw = 3;
  const circ = 2 * Math.PI * r;
  const safe = Math.max(0, Math.min(100, toNumber(percentage, 0)));
  const offset = circ - (safe / 100) * circ;
  return (
    <View style={ss.circWrap}>
      <Svg height="48" width="48" viewBox="0 0 48 48">
        <Circle
          cx="24"
          cy="24"
          r={r}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={sw}
          fill="none"
        />
        <Circle
          cx="24"
          cy="24"
          r={r}
          stroke={color}
          strokeWidth={sw}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          rotation="-90"
          origin="24,24"
        />
      </Svg>
      <View style={ss.circInner}>
        <Text weight="700" style={ss.circVal}>
          {value}
        </Text>
        <Text weight="500" style={ss.circLabel}>
          {label}
        </Text>
      </View>
      <Text weight="500" style={ss.circUnit}>
        {unit}
      </Text>
    </View>
  );
});

// ── Scan result food card ──────────────────────
const ScanResultFoodCard = memo(({ food, alreadyAdded, onAdd }) => {
  const cal = toNumber(food.calories);
  const prot = toNumber(food.protein);
  const carb = toNumber(food.carbs);
  const fat = toNumber(food.fat);
  const conf = toNumber(food.confidence, 0.65);
  return (
    <View style={ss.resultCard}>
      {/* Name + serving */}
      <View style={ss.resultHeader}>
        <View style={{ flex: 1 }}>
          <Text weight="700" style={ss.resultName}>
            {food.name}
          </Text>
          <Text style={ss.resultServing}>{food.serving}</Text>
        </View>
        <View style={ss.confBadge}>
          <Text weight="600" style={ss.confTxt}>
            {Math.round(conf * 100)}%
          </Text>
        </View>
      </View>
      {/* Macro rings */}
      <View style={ss.macroRingRow}>
        <CircularMacro
          label="Cal"
          value={Math.round(cal)}
          unit="kcal"
          color="#22c55e"
          percentage={Math.min((cal / 600) * 100, 100)}
        />
        <CircularMacro
          label="Prot"
          value={prot.toFixed(1)}
          unit="g"
          color="#3b82f6"
          percentage={Math.min((prot / 50) * 100, 100)}
        />
        <CircularMacro
          label="Carb"
          value={carb.toFixed(1)}
          unit="g"
          color="#eab308"
          percentage={Math.min((carb / 80) * 100, 100)}
        />
        <CircularMacro
          label="Fat"
          value={fat.toFixed(1)}
          unit="g"
          color="#f97316"
          percentage={Math.min((fat / 30) * 100, 100)}
        />
      </View>
      {/* Add button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onAdd}
        style={[ss.cardAddBtn, alreadyAdded && ss.cardAddBtnDone]}
        disabled={alreadyAdded}
      >
        {alreadyAdded ? (
          <>
            <Feather name="check" size={14} color="#fff" />
            <Text weight="700" style={ss.cardAddBtnTxt}>
              Added
            </Text>
          </>
        ) : (
          <Text weight="700" style={ss.cardAddBtnTxt}>
            + Add to Tray
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
});

// ─────────────────────────────────────────────────────
const ScanRN = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const mealType = normalizeMealType(route.params?.mealType);

  const cameraRef = useRef(null);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanResult, setScanResult] = useState([]);
  const [scanTotals, setScanTotals] = useState(null);
  const [scanError, setScanError] = useState("");
  const [addedItems, setAddedItems] = useState({});
  const [capturedUri, setCapturedUri] = useState("");
  const [animValue] = useState(new Animated.Value(0));
  const [cameraKey, setCameraKey] = useState(Date.now());

  const lineAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lineAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(lineAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const hasPermission = cameraPermission?.granted ?? null;

  useFocusEffect(
    React.useCallback(() => {
      setCameraKey(Date.now());
      readCameraPermission()
        .then((p) => setCameraPermission(p))
        .catch(() => {});
      return undefined;
    }, []),
  );

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

  useEffect(() => {
    let mounted = true;
    const ask = async () => {
      try {
        const p = await requestCameraPermissionApi();
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

  useEffect(() => {
    if (!isAnalyzing) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animValue, isAnalyzing]);

  const resetScanState = () => {
    setScanComplete(false);
    setScanResult([]);
    setScanTotals(null);
    setScanError("");
    setAddedItems({});
    setCapturedUri("");
    setCameraKey(Date.now());
  };

  const startScanning = async () => {
    if (isAnalyzing) return;
    if (!cameraRef.current) {
      setScanError("Camera is not ready yet. Please try again.");
      return;
    }
    setScanError("");
    setScanResult([]);
    setScanTotals(null);
    setAddedItems({});
    setScanComplete(false);
    try {
      const pic = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.45,
        skipProcessing: true,
      });
      if (!pic?.base64)
        throw new Error("Image capture failed. Please retake the scan.");
      setCapturedUri(pic.uri || "");
      setIsAnalyzing(true);
      const result = await analyzeMealImageWithGroq({
        base64Image: pic.base64,
        mimeType: toMimeType(pic.uri),
      });
      const items = (result?.items || []).map(normalizeScanFood);
      setScanResult(items);
      setScanTotals(result?.totals || null);
      setScanComplete(true);
      if (items.length === 0)
        setScanError("No food items detected. Try another angle or lighting.");
    } catch (e) {
      const msg =
        e?.message === "Image capture failed. Please retake the scan."
          ? e.message
          : "Could not analyze this photo. Please try again.";
      setScanError(msg);
      setScanComplete(false);
      setCapturedUri("");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addToTray = async (food, quantity = 1) => {
    try {
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
          confidence: toNumber(food.confidence, ex.confidence || 0.65),
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
          confidence: toNumber(food.confidence, 0.65),
          quantity: qty,
          totalCalories: toNumber(food.calories) * qty,
          addedAt: new Date().toISOString(),
          mealType,
        });
      }
      log.meals[mealType] = items;
      recalculateLogTotals(log);
      await AsyncStorage.setItem(key, JSON.stringify(log));
      // recent
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
      setAddedItems((prev) => ({ ...prev, [food.id || ri.id]: true }));
    } catch {
      setScanError("Could not save item to tray. Please try again.");
    }
  };

  const addAllToTray = async () => {
    const remaining = scanResult.filter((f) => !addedItems[f.id]);
    for (const f of remaining) await addToTray(f, 1);
    return remaining.length;
  };

  // ── Permission: loading ───────────────────────
  if (hasPermission === null) {
    return (
      <View style={ss.centered}>
        <View style={ss.permIconWrap}>
          <Feather name="camera" size={36} color={C.primaryLight} />
        </View>
        <ActivityIndicator
          size="large"
          color={C.primaryLight}
          style={{ marginBottom: 14 }}
        />
        <Text weight="700" style={ss.centeredTitle}>
          Camera Access
        </Text>
        <Text style={ss.centeredSub}>
          Requesting permission to use your camera...
        </Text>
      </View>
    );
  }

  // ── Permission: denied ────────────────────────
  if (hasPermission === false) {
    return (
      <LinearGradient colors={["#0D1F16", "#1a2e1f"]} style={ss.centered}>
        <View
          style={[ss.permIconWrap, { backgroundColor: "rgba(229,57,53,0.15)" }]}
        >
          <Feather name="camera-off" size={36} color="#E53935" />
        </View>
        <Text weight="700" style={ss.centeredTitle}>
          Camera Blocked
        </Text>
        <Text style={ss.centeredSub}>
          Enable camera access to scan food and estimate nutrition details.
        </Text>
        <TouchableOpacity
          style={ss.permBtn}
          onPress={
            cameraPermission?.canAskAgain
              ? requestCameraPermission
              : () => Linking.openSettings()
          }
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[C.primaryLight, C.primaryDark]}
            style={ss.permBtnInner}
          >
            <Text weight="700" style={ss.permBtnTxt}>
              {cameraPermission?.canAskAgain
                ? "Allow Camera Access"
                : "Open App Settings"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  // ── Main camera ───────────────────────────────
  return (
    <View style={ss.container}>
      <StatusBar translucent backgroundColor="transparent" />

      {capturedUri ? (
        <Image
          source={{ uri: capturedUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <Camera.CameraView
          key={cameraKey}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableZoomGesture
        />
      )}

      {/* Header */}
      <LinearGradient
        colors={["rgba(0,0,0,0.85)", "transparent"]}
        style={ss.header}
      >
        <TouchableOpacity
          style={ss.iconBtn}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text weight="700" style={ss.headerTitle}>
          Scan Food · {mealType}
        </Text>
        <View style={{ width: 44 }} />
      </LinearGradient>

      {/* Scanning UI */}
      {!scanComplete && (
        <View style={ss.overlay}>
          {/* Frame */}
          {!capturedUri && (
            <View style={ss.frame}>
              {[ss.tl, ss.tr, ss.bl, ss.br].map((cs, i) => (
                <View key={i} style={[ss.corner, cs]} />
              ))}
              <Animated.View
                style={[
                  ss.scanLine,
                  {
                    transform: [
                      {
                        translateY: lineAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, FRAME_H - 10],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>
          )}

          {/* Analyzing */}
          {isAnalyzing && (
            <View style={ss.analyzingBox}>
              <Animated.View
                style={[
                  ss.analyzingPulse,
                  {
                    opacity: animValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.85],
                    }),
                    transform: [
                      {
                        scale: animValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.9, 1.22],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <ActivityIndicator size="large" color={C.primaryLight} />
              <Text weight="600" style={ss.analyzingTxt}>
                Analyzing your photo...
              </Text>
            </View>
          )}

          {/* Instructions */}
          {!isAnalyzing && (
            <View style={ss.instructions}>
              <Text weight="700" style={ss.instructTitle}>
                Position food in frame
              </Text>
              <Text style={ss.instructSub}>
                Take one photo to estimate nutritional details
              </Text>
              <TouchableOpacity
                style={ss.captureBtn}
                onPress={startScanning}
                activeOpacity={0.85}
              >
                <Feather name="camera" size={18} color="#fff" />
                <Text weight="700" style={ss.captureBtnTxt}>
                  Take Photo
                </Text>
              </TouchableOpacity>
              {scanError ? (
                <View style={ss.inlineError}>
                  <Text style={ss.inlineErrorTxt}>{scanError}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      )}

      {/* Results bottom sheet */}
      {scanComplete && (
        <View style={ss.resultsSheet}>
          {/* Handle */}
          <View style={ss.sheetHandle} />

          {/* Header */}
          <View style={ss.sheetHeader}>
            <View>
              <Text weight="800" style={ss.sheetTitle}>
                Scan Results
              </Text>
              <Text style={ss.sheetSub}>Tap + to add items to your tray</Text>
            </View>
            <View style={ss.completeBadge}>
              <Feather name="check" size={13} color="#fff" />
              <Text weight="600" style={ss.completeBadgeTxt}>
                Done
              </Text>
            </View>
          </View>

          {/* Total pills */}
          {scanTotals && (
            <View style={ss.totalsRow}>
              {[
                {
                  l: "Cal",
                  v: `${Math.round(toNumber(scanTotals.calories))} kcal`,
                  bg: "#D1FAE5",
                  fg: C.emerald,
                },
                {
                  l: "P",
                  v: `${toNumber(scanTotals.protein).toFixed(1)}g`,
                  bg: "#DBEAFE",
                  fg: C.blue,
                },
                {
                  l: "C",
                  v: `${toNumber(scanTotals.carbs).toFixed(1)}g`,
                  bg: "#FEF3C7",
                  fg: C.amber,
                },
                {
                  l: "F",
                  v: `${toNumber(scanTotals.fat).toFixed(1)}g`,
                  bg: "#FEE0D1",
                  fg: C.orange,
                },
              ].map((x) => (
                <View
                  key={x.l}
                  style={[ss.totalPill, { backgroundColor: x.bg }]}
                >
                  <Text weight="600" style={[ss.totalPillTxt, { color: x.fg }]}>
                    {x.v}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {scanError && (
            <View style={ss.sheetError}>
              <Text style={ss.sheetErrorTxt}>{scanError}</Text>
            </View>
          )}

          {/* Food cards */}
          <ScrollView
            contentContainerStyle={ss.resultsScroll}
            showsVerticalScrollIndicator={false}
          >
            {scanResult.map((food) => (
              <ScanResultFoodCard
                key={food.id}
                food={food}
                alreadyAdded={!!addedItems[food.id]}
                onAdd={() => addToTray(food, 1)}
              />
            ))}
            {scanResult.length === 0 && (
              <View style={ss.noResults}>
                <Feather name="alert-circle" size={24} color={C.textMuted} />
                <Text style={ss.noResultsTxt}>
                  No food items detected from this image.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action row */}
          <View style={ss.sheetActions}>
            <TouchableOpacity
              style={ss.scanAgainBtn}
              onPress={resetScanState}
              activeOpacity={0.85}
            >
              <Text weight="700" style={ss.scanAgainTxt}>
                Scan Again
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              style={ss.saveContinueWrap}
              onPress={async () => {
                await addAllToTray();
                navigation.goBack();
              }}
            >
              <LinearGradient
                colors={[C.primaryLight, C.primaryDark]}
                start={[0, 0]}
                end={[1, 1]}
                style={ss.saveContinueBtn}
              >
                <Text weight="700" style={ss.saveContinueTxt}>
                  Save & Continue
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default ScanRN;

// ── Styles ─────────────────────────────────────────
const ss = StyleSheet.create({
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
    color: "rgba(255,255,255,0.62)",
    textAlign: "center",
    marginBottom: 28,
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
    paddingHorizontal: isSmall ? 16 : 20,
    zIndex: 10,
  },
  iconBtn: {
    width: isSmall ? 38 : 44,
    height: isSmall ? 38 : 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: isSmall ? 15 : 17,
    textAlign: "center",
  },

  // Overlay
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },

  // Frame
  frame: {
    width: FRAME_W,
    height: FRAME_H,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    position: "relative",
    marginBottom: 22,
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: isSmall ? 22 : 28,
    height: isSmall ? 22 : 28,
    borderWidth: isSmall ? 3 : 4,
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
    height: 2,
    borderRadius: 1,
    backgroundColor: C.primaryLight,
    shadowColor: C.primaryLight,
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },

  // Analyzing
  analyzingBox: {
    width: "78%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 22,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    overflow: "hidden",
    gap: 10,
  },
  analyzingPulse: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(22,170,22,0.22)",
  },
  analyzingTxt: {
    color: "#fff",
    fontSize: isSmall ? 13 : 15,
    textAlign: "center",
  },

  // Instructions
  instructions: {
    position: "absolute",
    bottom: isSmall ? 32 : 52,
    alignItems: "center",
    paddingHorizontal: 20,
    width: "100%",
  },
  instructTitle: {
    color: "#fff",
    fontSize: isSmall ? 16 : 18,
    marginBottom: 5,
    textAlign: "center",
  },
  instructSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: isSmall ? 12 : 13,
    marginBottom: 18,
    textAlign: "center",
  },
  captureBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.primaryLight,
    borderRadius: 18,
    paddingHorizontal: isSmall ? 24 : 32,
    paddingVertical: isSmall ? 13 : 15,
    shadowColor: C.primaryLight,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  captureBtnTxt: { color: "#fff", fontSize: isSmall ? 15 : 17 },
  inlineError: {
    marginTop: 14,
    backgroundColor: "rgba(220,38,38,0.25)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.6)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: width * 0.84,
  },
  inlineErrorTxt: { color: "#fee2e2", fontSize: 12, textAlign: "center" },

  // Results sheet
  resultsSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: isSmall ? 16 : 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 18,
    maxHeight: height * 0.8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 14,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: isSmall ? 18 : 21, color: C.text },
  sheetSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  completeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  completeBadgeTxt: { color: "#fff", fontSize: 12 },

  totalsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 12,
  },
  totalPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  totalPillTxt: { fontSize: 12 },

  sheetError: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  sheetErrorTxt: { color: "#B91C1C", fontSize: 12, textAlign: "center" },

  resultsScroll: { gap: 10, paddingBottom: 12 },

  // Result card
  resultCard: {
    backgroundColor: "#1A2B1E",
    borderRadius: 16,
    padding: isSmall ? 12 : 14,
    borderWidth: 1,
    borderColor: "rgba(22,170,22,0.2)",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 8,
  },
  resultName: {
    color: "#fff",
    fontSize: isSmall ? 15 : 17,
    marginBottom: 2,
    flexShrink: 1,
  },
  resultServing: { color: "rgba(255,255,255,0.55)", fontSize: 12 },
  confBadge: {
    backgroundColor: "rgba(22,170,22,0.2)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  confTxt: { color: "#34D070", fontSize: 11 },

  macroRingRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  cardAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.primaryLight,
    borderRadius: 10,
    paddingVertical: 9,
  },
  cardAddBtnDone: { backgroundColor: "#374151" },
  cardAddBtnTxt: { color: "#fff", fontSize: 13 },

  // Circular macro
  circWrap: { alignItems: "center", justifyContent: "center", width: 52 },
  circInner: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    top: 9,
    left: 0,
    right: 0,
  },
  circVal: { color: "#fff", fontSize: 11, lineHeight: 13 },
  circLabel: { color: "#A0A0A0", fontSize: 8, lineHeight: 10 },
  circUnit: { marginTop: 4, color: "#9ca3af", fontSize: 9 },

  noResults: { alignItems: "center", paddingVertical: 28, gap: 10 },
  noResultsTxt: { fontSize: 13, color: C.textMuted, textAlign: "center" },

  // Action row
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  scanAgainBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.primaryLight,
    backgroundColor: "#F0FDF4",
    paddingVertical: isSmall ? 13 : 15,
    alignItems: "center",
    justifyContent: "center",
  },
  scanAgainTxt: { color: C.primary, fontSize: isSmall ? 14 : 15 },
  saveContinueWrap: { flex: 1 },
  saveContinueBtn: {
    borderRadius: 14,
    paddingVertical: isSmall ? 13 : 15,
    alignItems: "center",
  },
  saveContinueTxt: { color: "#fff", fontSize: isSmall ? 14 : 16 },
});
