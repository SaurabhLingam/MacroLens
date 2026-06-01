/**
 * Scan.jsx (MealScan) — Redesigned to match BarcodeScanner
 * White header with purple text, white bottom sheet result modal,
 * meal type tabs, green gradient Add button, calorie ring per item.
 * All logic, navigation, and AsyncStorage usage preserved exactly.
 * Fixed: mealType key now uses capitalized form to match Nutrition.jsx.
 * + Nutrition grade bottom tray on ScanNutriScale tap
 */

import React, { memo, useEffect, useRef, useState, useCallback } from "react";
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
  Modal,
} from "react-native";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
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
  recalculateLogTotals,
  readCameraPermission,
  requestCameraPermissionApi,
} from "../utils";

const { width, height } = Dimensions.get("window");
const isSmall = width < 380;

// ── Design tokens ──────────────────────────────
const PURPLE       = "#553FB5";
const PURPLE_LIGHT = "#EEE9FF";
const GREEN_GRAD   = ["#93D056", "#35A329"];

// ── Frame dimensions ───────────────────────────
const FRAME_W = isSmall ? width * 0.82 : Math.min(width * 0.82, 300);
const FRAME_H = Math.min(isSmall ? width * 0.9 : 380, height * 0.42);

// ── Meal tabs ──────────────────────────────────
const MEAL_TABS = ["Breakfast", "Lunch", "Snacks", "Dinner"];

// ── Helpers ────────────────────────────────────
const toMimeType = (uri) =>
  uri?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

const normalizeScanFood = (food, index) => ({
  id:         food?.id || `scan_food_${Date.now()}_${index}`,
  name:       String(food?.name || "Unknown item"),
  serving:    String(food?.serving || "1 serving"),
  calories:   toNumber(food?.calories),
  protein:    toNumber(food?.protein),
  carbs:      toNumber(food?.carbs),
  fat:        toNumber(food?.fat),
  confidence: toNumber(food?.confidence, 0.65),
});

// ── Calorie ring ───────────────────────────────
const CalorieRing = ({ calories }) => {
  const size   = 72;
  const stroke = 6;
  const r      = (size - stroke) / 2;
  const circ   = 2 * Math.PI * r;
  const offset = circ * 0.05;
  return (
    <View style={ss.ringWrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <SvgLinearGradient id="scanRg" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#93D056" />
            <Stop offset="100%" stopColor="#35A329" />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={size/2} cy={size/2} r={r} stroke="#F3F0FF" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size/2} cy={size/2} r={r}
          stroke="url(#scanRg)" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" fill="none"
          rotation="-90" origin={`${size/2},${size/2}`}
        />
      </Svg>
      <View style={ss.ringInner}>
        <Text weight="800" style={ss.ringCal}>{Math.round(calories)}</Text>
        <Text style={ss.ringCalLabel}>Cal</Text>
      </View>
    </View>
  );
};

// ── Macro label ────────────────────────────────
const MacroLabel = ({ label, value, color }) => (
  <View style={ss.macroCol}>
    <Text weight="700" style={[ss.macroVal, { color }]}>{value}</Text>
    <Text style={[ss.macroLbl, { color }]}>{label}</Text>
  </View>
);

// ── Nutrition grade scale + logic ──────────────
const SCAN_GRADES = [
  { grade: "A", bg: "#16A34A", dimBg: "#D1FAE5", dimText: "#6EE7B7" },
  { grade: "B", bg: "#65A30D", dimBg: "#ECFCCB", dimText: "#A3E635" },
  { grade: "C", bg: "#F59E0B", dimBg: "#FEF3C7", dimText: "#FCD34D" },
  { grade: "D", bg: "#EA580C", dimBg: "#FFEDD5", dimText: "#FDBA74" },
  { grade: "E", bg: "#DC2626", dimBg: "#FEE2E2", dimText: "#FCA5A5" },
];

const getScanNutritionGrade = (food) => {
  const cal  = toNumber(food.calories);
  const prot = toNumber(food.protein);
  const carb = toNumber(food.carbs);
  const fat  = toNumber(food.fat);
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

// ── Tappable NutriScale — opens bottom tray ────
const ScanNutriScale = ({ food }) => {
  const [gradeModal, setGradeModal] = useState(false);
  const grade     = getScanNutritionGrade(food);
  const gradeInfo = SCAN_GRADES.find(g => g.grade === grade);

  const cal      = toNumber(food.calories);
  const protKcal = toNumber(food.protein) * 4;
  const carbKcal = toNumber(food.carbs)   * 4;
  const fatKcal  = toNumber(food.fat)     * 9;
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
      <TouchableOpacity
        onPress={() => setGradeModal(true)}
        activeOpacity={0.75}
        style={ss.nutriScaleWrap}
      >
        <Text style={ss.nutriScaleLabel}>Nutrition Score</Text>
        <View style={ss.nutriScaleRow}>
          {SCAN_GRADES.map((g) => {
            const isActive = g.grade === grade;
            return (
              <View
                key={g.grade}
                style={[
                  ss.nutriScaleItem,
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
      </TouchableOpacity>

      <Modal
        visible={gradeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setGradeModal(false)}
      >
        <TouchableOpacity
          style={ss.modalOverlay}
          activeOpacity={1}
          onPress={() => setGradeModal(false)}
        >
          <View style={ss.modalCard} onStartShouldSetResponder={() => true}>
            <View style={ss.modalHandle} />
            <Text weight="700" style={ss.modalTitle}>Nutrition Score</Text>
            <View style={[ss.modalGradeHighlight, { backgroundColor: gradeInfo?.bg }]}>
              <Text weight="800" style={ss.modalGradeLetter}>{grade}</Text>
            </View>
            <View style={ss.modalReasonCard}>
              {reasons.map((r, i) => (
                <View key={i} style={ss.modalReasonRow}>
                  <Text style={ss.modalReasonIcon}>{r.icon}</Text>
                  <Text style={ss.modalReasonTxt}>{r.text}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={ss.modalCloseBtn}
              activeOpacity={0.85}
              onPress={() => setGradeModal(false)}
            >
              <Text weight="700" style={ss.modalCloseTxt}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// ── Individual food result card ─────────────────
const ScanResultFoodCard = memo(({ food, alreadyAdded, onAdd, mealLabel }) => {
  const cal  = toNumber(food.calories);
  const prot = toNumber(food.protein);
  const carb = toNumber(food.carbs);
  const fat  = toNumber(food.fat);
  const conf = toNumber(food.confidence, 0.65);

  return (
    <View style={ss.resultCard}>
      {/* Food row: icon + name + ring */}
      <View style={ss.foodRow}>
        <View style={ss.foodIcon}>
          <Feather name="camera" size={22} color={PURPLE} />
        </View>
        <View style={ss.foodMeta}>
          <Text weight="700" style={ss.foodName} numberOfLines={2}>
            {food.name}
          </Text>
          <View style={ss.foodSubRow}>
            <Text style={ss.foodServing}>{food.serving}</Text>
            <View style={ss.confBadge}>
              <Text weight="600" style={ss.confTxt}>
                {Math.round(conf * 100)}% match
              </Text>
            </View>
          </View>
        </View>
        <CalorieRing calories={cal} />
      </View>

      {/* Macro row */}
      <View style={ss.macroRow}>
        <MacroLabel label="Protein" value={`${prot.toFixed(1)}g`} color={PURPLE}     />
        <View style={ss.macroDivider} />
        <MacroLabel label="Carbs"   value={`${carb.toFixed(1)}g`} color="#35A329"   />
        <View style={ss.macroDivider} />
        <MacroLabel label="Fats"    value={`${fat.toFixed(1)}g`}  color="#F97316"   />
      </View>

      {/* Tappable nutri-score */}
      <ScanNutriScale food={food} />

      {/* Add button */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onAdd}
        disabled={alreadyAdded}
        style={ss.addBtnWrap}
      >
        <LinearGradient
          colors={alreadyAdded ? ["#374151", "#374151"] : GREEN_GRAD}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={ss.addBtn}
        >
          {alreadyAdded ? (
            <View style={ss.addBtnInner}>
              <Feather name="check" size={14} color="#fff" />
              <Text weight="700" style={ss.addBtnTxt}>Added to {mealLabel}</Text>
            </View>
          ) : (
            <Text weight="700" style={ss.addBtnTxt}>+ Add to Tray</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
});

// ─────────────────────────────────────────────────────
const ScanRN = () => {
  const navigation  = useNavigation();
  const route       = useRoute();
  const initialMeal = normalizeMealType(route.params?.mealType);

  const cameraRef = useRef(null);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [isAnalyzing,  setIsAnalyzing]  = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanResult,   setScanResult]   = useState([]);
  const [scanTotals,   setScanTotals]   = useState(null);
  const [scanError,    setScanError]    = useState("");
  const [addedItems,   setAddedItems]   = useState({});
  const [capturedUri,  setCapturedUri]  = useState("");
  const [cameraKey,    setCameraKey]    = useState(Date.now());
  const [selectedMeal, setSelectedMeal] = useState(
    MEAL_TABS.find((t) => t.toLowerCase() === initialMeal?.toLowerCase()) || "Breakfast"
  );

  const [animValue] = useState(new Animated.Value(0));
  const lineAnim  = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(400)).current;

  // ── Scan line loop ─────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lineAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(lineAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Analyzing pulse ────────────────────────
  useEffect(() => {
    if (!isAnalyzing) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(animValue, { toValue: 0, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animValue, isAnalyzing]);

  // ── Sheet slide-up ─────────────────────────
  useEffect(() => {
    if (scanComplete) {
      Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
    } else {
      sheetAnim.setValue(400);
    }
  }, [scanComplete]);

  const hasPermission = cameraPermission?.granted ?? null;

  useFocusEffect(
    useCallback(() => {
      setCameraKey(Date.now());
      readCameraPermission().then((p) => setCameraPermission(p)).catch(() => {});
      return undefined;
    }, [])
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
    return () => { mounted = false; };
  }, []);

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
        quality: 0.7,
        skipProcessing: true,
      });
      if (!pic?.base64) throw new Error("Image capture failed. Please retake the scan.");
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
      const mealType = selectedMeal;
      const key = getTodayKey();
      const raw = await AsyncStorage.getItem(key);
      const log = raw ? parseJsonSafe(raw, createEmptyLog(key)) : createEmptyLog(key);
      ensureMealsShape(log);
      const items = Array.isArray(log.meals[mealType]) ? [...log.meals[mealType]] : [];
      const qty = Math.max(1, toNumber(quantity, 1));
      const nm  = String(food.name || "").trim().toLowerCase();
      const idx = items.findIndex((x) => String(x.name || "").trim().toLowerCase() === nm);
      if (idx >= 0) {
        const ex = items[idx];
        items[idx] = {
          ...ex,
          serving:    food.serving || ex.serving || "1 serving",
          calories:   toNumber(food.calories, ex.calories),
          protein:    toNumber(food.protein, ex.protein),
          carbs:      toNumber(food.carbs, ex.carbs),
          fat:        toNumber(food.fat, ex.fat),
          confidence: toNumber(food.confidence, ex.confidence || 0.65),
          quantity:   toNumber(ex.quantity, 1) + qty,
          totalCalories: toNumber(food.calories, ex.calories) * (toNumber(ex.quantity, 1) + qty),
          addedAt:    new Date().toISOString(),
          mealType,
        };
      } else {
        items.push({
          id:           food.id || `${Date.now()}_${nm}`,
          name:         food.name,
          serving:      food.serving || "1 serving",
          calories:     toNumber(food.calories),
          protein:      toNumber(food.protein),
          carbs:        toNumber(food.carbs),
          fat:          toNumber(food.fat),
          confidence:   toNumber(food.confidence, 0.65),
          quantity:     qty,
          totalCalories: toNumber(food.calories) * qty,
          addedAt:      new Date().toISOString(),
          mealType,
        });
      }
      log.meals[mealType] = items;
      recalculateLogTotals(log);
      await AsyncStorage.setItem(key, JSON.stringify(log));
      // recent foods
      const rr   = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_FOODS);
      const rarr = Array.isArray(parseJsonSafe(rr, [])) ? parseJsonSafe(rr, []) : [];
      const rk   = String(food.name || "").trim().toLowerCase();
      const ri   = {
        id:            food.id || `${Date.now()}_${rk}`,
        name:          food.name,
        serving:       food.serving || "1 serving",
        calories:      toNumber(food.calories),
        protein:       toNumber(food.protein),
        carbs:         toNumber(food.carbs),
        fat:           toNumber(food.fat),
        servings:      qty,
        totalCalories: toNumber(food.calories) * qty,
        addedAt:       new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.RECENT_FOODS,
        JSON.stringify(
          [ri, ...rarr.filter((x) => String(x?.name || "").trim().toLowerCase() !== rk)].slice(0, MAX_RECENT_FOODS)
        )
      );
      setAddedItems((prev) => ({ ...prev, [food.id || ri.id]: true }));
      const todayScanKey = `scan_count_${getTodayKey()}`;
      const prev = await AsyncStorage.getItem(todayScanKey);
      await AsyncStorage.setItem(todayScanKey, String((parseInt(prev) || 0) + 1));
    } catch {
      setScanError("Could not save item to tray. Please try again.");
    }
  };

  const addAllToTray = async () => {
    const remaining = scanResult.filter((f) => !addedItems[f.id]);
    for (const f of remaining) await addToTray(f, 1);
    return remaining.length;
  };

  // ── Permission: loading ────────────────────
  if (hasPermission === null) {
    return (
      <View style={ss.centered}>
        <View style={ss.permIconWrap}>
          <Feather name="camera" size={36} color={PURPLE} />
        </View>
        <ActivityIndicator size="large" color={PURPLE} style={{ marginBottom: 14 }} />
        <Text weight="700" style={ss.centeredTitle}>Camera Access</Text>
        <Text style={ss.centeredSub}>Requesting permission to use your camera...</Text>
      </View>
    );
  }

  // ── Permission: denied ─────────────────────
  if (hasPermission === false) {
    return (
      <View style={ss.centeredDenied}>
        <View style={[ss.permIconWrap, { backgroundColor: "rgba(229,57,53,0.1)" }]}>
          <Feather name="camera-off" size={36} color="#E53935" />
        </View>
        <Text weight="700" style={[ss.centeredTitle, { color: "#111" }]}>Camera Blocked</Text>
        <Text style={[ss.centeredSub, { color: "#666" }]}>
          Enable camera access to scan food and estimate nutrition details.
        </Text>
        <TouchableOpacity
          style={ss.permBtn}
          onPress={cameraPermission?.canAskAgain ? requestCameraPermission : () => Linking.openSettings()}
          activeOpacity={0.85}
        >
          <LinearGradient colors={GREEN_GRAD} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={ss.permBtnInner}>
            <Text weight="700" style={ss.permBtnTxt}>
              {cameraPermission?.canAskAgain ? "Allow Camera Access" : "Open App Settings"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main camera ────────────────────────────
  return (
    <View style={ss.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />

      {/* ── White header ── */}
      <View style={ss.header}>
        <TouchableOpacity style={ss.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={PURPLE} />
        </TouchableOpacity>
        <View>
          <Text weight="700" style={ss.headerTitle}>Scan Meal</Text>
          <Text style={ss.headerSub}>Ensure the entire meal is visible for better accuracy.</Text>
        </View>
      </View>

      {/* ── Camera / captured image ── */}
      {capturedUri ? (
        <Image source={{ uri: capturedUri }} style={ss.camera} resizeMode="cover" />
      ) : (
        <Camera.CameraView key={cameraKey} ref={cameraRef} style={ss.camera} facing="back" enableZoomGesture />
      )}

      {/* ── Scan guide overlay ── */}
      {!capturedUri && !scanComplete && (
        <View style={ss.guideOverlay} pointerEvents="none">
          <View style={ss.maskTop} />
          <View style={ss.guideRow}>
            <View style={ss.maskSide} />
            <View style={[ss.scanFrame, { width: FRAME_W, height: FRAME_H }]}>
              {[ss.tl, ss.tr, ss.bl, ss.br].map((cs, i) => (
                <View key={i} style={[ss.corner, cs]} />
              ))}
              <Animated.View
                style={[
                  ss.scanLine,
                  {
                    transform: [{
                      translateY: lineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, FRAME_H - 10] }),
                    }],
                  },
                ]}
              />
            </View>
            <View style={ss.maskSide} />
          </View>
          <View style={ss.maskBottom} />
        </View>
      )}

      {/* ── Analyzing overlay ── */}
      {isAnalyzing && (
        <View style={ss.analyzingOverlay}>
          <View style={ss.analyzingBox}>
            <Animated.View
              style={[
                ss.analyzingPulse,
                {
                  opacity:   animValue.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] }),
                  transform: [{ scale: animValue.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.22] }) }],
                },
              ]}
            />
            <ActivityIndicator size="large" color={PURPLE} />
            <Text weight="600" style={ss.analyzingTxt}>Analyzing your photo...</Text>
          </View>
        </View>
      )}

      {/* ── Instructions ── */}
      {!capturedUri && !isAnalyzing && !scanComplete && (
        <View style={ss.instructWrap} pointerEvents="box-none">
          <Text weight="700" style={ss.instructTitle}>Position food in frame</Text>
          <Text style={ss.instructSub}>Take one photo to estimate nutritional details</Text>
          <TouchableOpacity style={ss.captureBtn} onPress={startScanning} activeOpacity={0.85}>
            <LinearGradient colors={GREEN_GRAD} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={ss.captureBtnInner}>
              <Feather name="camera" size={18} color="#fff" />
              <Text weight="700" style={ss.captureBtnTxt}>Take Photo</Text>
            </LinearGradient>
          </TouchableOpacity>
          {scanError ? (
            <View style={ss.inlineError}>
              <Text style={ss.inlineErrorTxt}>{scanError}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* ── Result bottom sheet ── */}
      {scanComplete && (
        <Animated.View style={[ss.sheet, { transform: [{ translateY: sheetAnim }] }]}>
          <View style={ss.sheetHandle} />

          <View style={ss.sheetHeader}>
            <View>
              <Text weight="800" style={ss.sheetTitle}>Scan Results</Text>
              <Text style={ss.sheetSub}>
                {scanResult.length} item{scanResult.length !== 1 ? "s" : ""} detected
              </Text>
            </View>
            <View style={ss.doneBadge}>
              <Feather name="check" size={13} color="#fff" />
              <Text weight="600" style={ss.doneBadgeTxt}>Done</Text>
            </View>
          </View>

          {scanTotals && (
            <View style={ss.totalsRow}>
              {[
                { l: "Cal", v: `${Math.round(toNumber(scanTotals.calories))} kcal`, bg: "#D1FAE5", fg: "#059669" },
                { l: "P",   v: `${toNumber(scanTotals.protein).toFixed(1)}g`,       bg: "#EEE9FF", fg: PURPLE    },
                { l: "C",   v: `${toNumber(scanTotals.carbs).toFixed(1)}g`,         bg: "#FEF3C7", fg: "#D97706" },
                { l: "F",   v: `${toNumber(scanTotals.fat).toFixed(1)}g`,           bg: "#FEE0D1", fg: "#EA580C" },
              ].map((x) => (
                <View key={x.l} style={[ss.totalPill, { backgroundColor: x.bg }]}>
                  <Text weight="600" style={[ss.totalPillTxt, { color: x.fg }]}>{x.v}</Text>
                </View>
              ))}
            </View>
          )}

          {scanError ? (
            <View style={ss.sheetError}>
              <Text style={ss.sheetErrorTxt}>{scanError}</Text>
            </View>
          ) : null}

          <View style={ss.divider} />

          {/* Meal type tabs */}
          <View style={ss.mealTabs}>
            {MEAL_TABS.map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[ss.mealTab, selectedMeal === tab && ss.mealTabActive]}
                onPress={() => setSelectedMeal(tab)}
                activeOpacity={0.75}
              >
                <Text
                  weight={selectedMeal === tab ? "700" : "500"}
                  style={[ss.mealTabTxt, selectedMeal === tab && ss.mealTabTxtActive]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Food cards */}
          <ScrollView contentContainerStyle={ss.resultsScroll} showsVerticalScrollIndicator={false}>
            {scanResult.length === 0 ? (
              <View style={ss.noResults}>
                <Feather name="alert-circle" size={24} color="#9CA3AF" />
                <Text style={ss.noResultsTxt}>No food items detected from this image.</Text>
              </View>
            ) : (
              scanResult.map((food) => (
                <ScanResultFoodCard
                  key={food.id}
                  food={food}
                  alreadyAdded={!!addedItems[food.id]}
                  mealLabel={selectedMeal}
                  onAdd={() => addToTray(food, 1)}
                />
              ))
            )}
          </ScrollView>

          {/* Action row */}
          <View style={ss.actionRow}>
            <TouchableOpacity style={ss.scanAgainBtn} onPress={resetScanState} activeOpacity={0.85}>
              <Text weight="700" style={ss.scanAgainTxt}>Scan Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              style={ss.saveContinueWrap}
              onPress={async () => { await addAllToTray(); navigation.goBack(); }}
            >
              <LinearGradient colors={GREEN_GRAD} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={ss.saveContinueBtn}>
                <Text weight="700" style={ss.saveContinueTxt}>Save & Continue</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

export default ScanRN;

// ── Styles ──────────────────────────────────────────
const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  // ── Permission screens ──
  centered: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#fff", paddingHorizontal: 28,
  },
  centeredDenied: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#fff", paddingHorizontal: 28,
  },
  permIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: PURPLE_LIGHT, alignItems: "center",
    justifyContent: "center", marginBottom: 20,
  },
  centeredTitle: { fontSize: 22, color: PURPLE, marginBottom: 8 },
  centeredSub:   { fontSize: 14, color: "#888", textAlign: "center", marginBottom: 28, lineHeight: 20 },
  permBtn:       { width: "100%", borderRadius: 14, overflow: "hidden" },
  permBtnInner:  { paddingVertical: 14, alignItems: "center" },
  permBtnTxt:    { color: "#fff", fontSize: 16 },

  // ── Header ──
  header: {
    backgroundColor: "#fff",
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : (StatusBar.currentHeight ?? 28) + 12,
    paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
    zIndex: 10,
  },
  backBtn:     { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, color: PURPLE },
  headerSub:   { fontSize: 12, color: PURPLE, marginTop: 2, opacity: 0.8 },

  // ── Camera ──
  camera: { flex: 1 },

  // ── Guide overlay ──
  guideOverlay: { ...StyleSheet.absoluteFillObject },
  maskTop:      { flex: 2, backgroundColor: "rgba(0,0,0,0.55)" },
  maskBottom:   { flex: 3, backgroundColor: "rgba(0,0,0,0.55)" },
  guideRow:     { flexDirection: "row" },
  maskSide:     { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },

  // ── Scan frame ──
  scanFrame: {
    borderRadius: 10, overflow: "hidden",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)", position: "relative",
  },
  corner: {
    position: "absolute",
    width: isSmall ? 22 : 28, height: isSmall ? 22 : 28,
    borderWidth: isSmall ? 3 : 4, borderColor: "#fff",
  },
  tl: { top: 0,    left: 0,  borderRightWidth: 0,  borderBottomWidth: 0, borderTopLeftRadius: 4     },
  tr: { top: 0,    right: 0, borderLeftWidth: 0,   borderBottomWidth: 0, borderTopRightRadius: 4    },
  bl: { bottom: 0, left: 0,  borderRightWidth: 0,  borderTopWidth: 0,    borderBottomLeftRadius: 4  },
  br: { bottom: 0, right: 0, borderLeftWidth: 0,   borderTopWidth: 0,    borderBottomRightRadius: 4 },
  scanLine: {
    position: "absolute", top: 4, left: 12, right: 12,
    height: 2, borderRadius: 1, backgroundColor: "#93D056",
    shadowColor: "#93D056", shadowOpacity: 0.9, shadowRadius: 4,
  },

  // ── Analyzing overlay ──
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  analyzingBox: {
    width: "78%", alignItems: "center", justifyContent: "center",
    paddingVertical: 28, borderRadius: 20, backgroundColor: "#fff", gap: 12,
  },
  analyzingPulse: {
    position: "absolute", width: 150, height: 150,
    borderRadius: 75, backgroundColor: PURPLE_LIGHT,
  },
  analyzingTxt: { color: "#333", fontSize: isSmall ? 13 : 15, textAlign: "center" },

  // ── Instructions ──
  instructWrap: {
    position: "absolute", bottom: isSmall ? 32 : 52,
    left: 0, right: 0, alignItems: "center", paddingHorizontal: 20,
  },
  instructTitle: { color: "#fff", fontSize: isSmall ? 16 : 18, marginBottom: 5, textAlign: "center" },
  instructSub:   { color: "rgba(255,255,255,0.75)", fontSize: isSmall ? 12 : 13, marginBottom: 18, textAlign: "center" },
  captureBtn: {
    borderRadius: 18, overflow: "hidden",
    shadowColor: "#35A329", shadowOpacity: 0.5, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  captureBtnInner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: isSmall ? 24 : 32, paddingVertical: isSmall ? 13 : 15,
  },
  captureBtnTxt: { color: "#fff", fontSize: isSmall ? 15 : 17 },
  inlineError: {
    marginTop: 14, backgroundColor: "rgba(220,38,38,0.25)",
    borderWidth: 1, borderColor: "rgba(248,113,113,0.6)",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, maxWidth: width * 0.84,
  },
  inlineErrorTxt: { color: "#fee2e2", fontSize: 12, textAlign: "center" },

  // ── Bottom sheet ──
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: isSmall ? 16 : 20, paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    maxHeight: height * 0.8,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 16,
  },
  sheetHandle: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: "#E5E7EB", alignSelf: "center", marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 12,
  },
  sheetTitle:    { fontSize: isSmall ? 18 : 21, color: "#111" },
  sheetSub:      { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  doneBadge:     { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#35A329", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  doneBadgeTxt:  { color: "#fff", fontSize: 12 },

  // ── Totals pills ──
  totalsRow:    { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 },
  totalPill:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  totalPillTxt: { fontSize: 12 },

  sheetError:    { backgroundColor: "#FEF2F2", borderRadius: 10, padding: 10, marginBottom: 10 },
  sheetErrorTxt: { color: "#B91C1C", fontSize: 12, textAlign: "center" },

  divider: { height: 1, backgroundColor: "#F0F0F0", marginBottom: 12 },

  // ── Meal tabs ──
  mealTabs:      { flexDirection: "row", gap: 8, marginBottom: 12 },
  mealTab:       { flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: "center", backgroundColor: "#F5F5F5" },
  mealTabActive: { backgroundColor: PURPLE },
  mealTabTxt:    { fontSize: 12, color: "#888" },
  mealTabTxtActive: { color: "#fff" },

  resultsScroll: { gap: 10, paddingBottom: 8 },

  // ── Food result card ──
  resultCard: {
    backgroundColor: "#fff", borderRadius: 16,
    padding: isSmall ? 12 : 14,
    borderWidth: 1, borderColor: "#F0F0F0",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  foodRow:    { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  foodIcon:   { width: 46, height: 46, borderRadius: 12, backgroundColor: PURPLE_LIGHT, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  foodMeta:   { flex: 1 },
  foodName:   { fontSize: isSmall ? 14 : 16, color: "#111", marginBottom: 4 },
  foodSubRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  foodServing:{ fontSize: 12, color: "#888" },
  confBadge:  { backgroundColor: "#F0FDF4", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#BBF7D0" },
  confTxt:    { color: "#166534", fontSize: 10 },

  // ── Calorie ring ──
  ringWrap:     { width: 72, height: 72, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  ringInner:    { position: "absolute", alignItems: "center", justifyContent: "center" },
  ringCal:      { fontSize: 16, color: "#111" },
  ringCalLabel: { fontSize: 10, color: "#888" },

  // ── Macro row ──
  macroRow:     { flexDirection: "row", alignItems: "center", backgroundColor: "#FAFAFA", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, marginBottom: 12 },
  macroCol:     { flex: 1, alignItems: "center" },
  macroVal:     { fontSize: 14 },
  macroLbl:     { fontSize: 11, marginTop: 2 },
  macroDivider: { width: 1, height: 26, backgroundColor: "#E5E7EB" },

  // ── Nutri-score ──
  nutriScaleWrap:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  nutriScaleLabel: { fontSize: 12, color: "#888" },
  nutriScaleRow:   { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 2 },
  nutriScaleItem:  { width: 18, height: 22, borderRadius: 4, alignItems: "center", justifyContent: "center" },

  // ── Add button ──
  addBtnWrap:  { borderRadius: 12, overflow: "hidden" },
  addBtn:      { paddingVertical: 11, alignItems: "center" },
  addBtnInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  addBtnTxt:   { color: "#fff", fontSize: 13 },

  noResults:    { alignItems: "center", paddingVertical: 28, gap: 10 },
  noResultsTxt: { fontSize: 13, color: "#9CA3AF", textAlign: "center" },

  // ── Action row ──
  actionRow:        { flexDirection: "row", gap: 10, marginTop: 10 },
  scanAgainBtn:     { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: PURPLE, paddingVertical: isSmall ? 13 : 15, alignItems: "center", justifyContent: "center" },
  scanAgainTxt:     { color: PURPLE, fontSize: isSmall ? 14 : 15 },
  saveContinueWrap: { flex: 1, borderRadius: 14, overflow: "hidden" },
  saveContinueBtn:  { paddingVertical: isSmall ? 13 : 15, alignItems: "center" },
  saveContinueTxt:  { color: "#fff", fontSize: isSmall ? 14 : 16 },

  // ── Nutrition grade bottom tray ──
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    width: "100%", maxHeight: "55%",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 }, elevation: 10,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#E0E0E0", alignSelf: "center", marginBottom: 16,
  },
  modalTitle:          { fontSize: 17, color: "#1A1A1A", marginBottom: 14 },
  modalGradeHighlight: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16 },
  modalGradeLetter:    { fontSize: 28, color: "#fff" },
  modalReasonCard:     { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, gap: 10, marginBottom: 8 },
  modalReasonRow:      { flexDirection: "row", alignItems: "center", gap: 10 },
  modalReasonIcon:     { fontSize: 16 },
  modalReasonTxt:      { fontSize: 13, color: "#333", flex: 1, lineHeight: 18 },
  modalCloseBtn:       { marginTop: 12, backgroundColor: PURPLE, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  modalCloseTxt:       { color: "#fff", fontSize: 14 },
});