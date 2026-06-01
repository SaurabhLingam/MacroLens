/**
 * SetGoal.jsx — Circular dial with animated arc.
 * - Arc driven by Animated.Value via listener (same pattern as CalorieCalculator weight dial)
 * - Drag: animatedCalorie.setValue() — instant, keeps up with finger
 * - Text input in center: tap to open, confirm via Done / ✓ → Animated.spring() sweeps arc
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  StyleSheet,
  Animated,
  Platform,
  StatusBar,
  TextInput,
} from "react-native";
import Svg, { Circle, Path, Line, Text as SvgText } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../components/TextWrapper";
import { C } from "../theme";
import { LinearGradient } from "expo-linear-gradient";
import HeaderVeggies from "../../assets/Group 1000004769.svg";
import CalorieNeedsCard from "../../assets/Group 1000004802.svg";

const { width } = Dimensions.get("window");

const MIN_CALORIE = 500;
const MAX_CALORIE = 5500;

const DIAL_SIZE = Math.min(width * 0.78, 300);
const RADIUS    = DIAL_SIZE * 0.4;
const CENTER    = DIAL_SIZE / 2;

// ─────────────────────────────────────────────
// CalorieResultCard — unchanged
// ─────────────────────────────────────────────
const CalorieResultCard = ({ calories, onRecalculate }) => (
  <LinearGradient
    colors={["#EEF9FF", "#C3EAFF", "#DBF3FF"]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={{ borderRadius: 14, padding: 14 }}
  >
    <Text weight="600" style={{ fontSize: 13, color: "#1a4a6e", marginBottom: 12 }}>
      Your Daily Calorie Needs
    </Text>
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[
        { label: "To Lose",  value: calories.lose,     bg: "#F5FFF3" },
        { label: "Maintain", value: calories.maintain, bg: "#FFFFE4" },
        { label: "To Gain",  value: calories.gain,     bg: "#FFF1F1" },
      ].map(({ label, value, bg }) => (
        <View key={label} style={{
          flex: 1, backgroundColor: bg, borderRadius: 10,
          paddingVertical: 10, alignItems: "center",
        }}>
          <Text style={{ fontSize: 10, color: "#888", marginBottom: 4, textAlign: "center" }}>
            {label}
          </Text>
          <Text weight="700" style={{ fontSize: 18, color: "#111" }}>
            {value.toLocaleString()}
          </Text>
          <Text style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>kcal</Text>
        </View>
      ))}
    </View>
    <TouchableOpacity onPress={onRecalculate} activeOpacity={0.88} style={{ marginTop: 12 }}>
      <LinearGradient
        colors={["#B148FF", "#F6339B", "#9914F9"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
      >
        <Text weight="600" style={{ fontSize: 13, color: "#fff" }}>Recalculate</Text>
      </LinearGradient>
    </TouchableOpacity>
  </LinearGradient>
);

// ─────────────────────────────────────────────
// DialArc — reads displayCalorie to draw arc
// Separated so the SVG re-renders only on listener updates
// ─────────────────────────────────────────────
const DialArc = ({ animatedCalorie, onDragStart, onDrag, onDragEnd }) => {
  const [displayCalorie, setDisplayCalorie] = useState(
    animatedCalorie.__getValue()
  );

  useEffect(() => {
    const id = animatedCalorie.addListener(({ value }) =>
      setDisplayCalorie(Math.round(value))
    );
    return () => animatedCalorie.removeListener(id);
  }, [animatedCalorie]);

  const calorieToAngle = (cal) =>
    ((cal - MIN_CALORIE) / (MAX_CALORIE - MIN_CALORIE)) * 2 * Math.PI -
    Math.PI / 2;

  const startAngle = calorieToAngle(MIN_CALORIE);
  const endAngle   = calorieToAngle(displayCalorie);

  const pt = (angle) => ({
    x: CENTER + Math.cos(angle) * RADIUS,
    y: CENTER + Math.sin(angle) * RADIUS,
  });

  const startPos = pt(startAngle);
  const endPos   = pt(endAngle);

  const consumed     = displayCalorie - MIN_CALORIE;
  const largeArcFlag = consumed > (MAX_CALORIE - MIN_CALORIE) / 2 ? 1 : 0;
  const arcPath = `M ${startPos.x} ${startPos.y} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${endPos.x} ${endPos.y}`;

  return (
    <Svg
      width={DIAL_SIZE}
      height={DIAL_SIZE}
      onStartShouldSetResponder={() => true}
      onResponderGrant={(e) => onDragStart(e)}
      onResponderMove={(e) => onDrag(e)}
      onResponderRelease={onDragEnd}
    >
      {/* Track ring */}
      <Circle
        cx={CENTER} cy={CENTER} r={RADIUS}
        stroke="#E8F5E9" strokeWidth={30} fill="none"
      />

      {/* Tick marks */}
      {Array.from({ length: 55 }).map((_, i) => {
        const a  = (i / 55) * 2 * Math.PI;
        const x1 = CENTER + Math.cos(a - Math.PI / 2) * (RADIUS - 8);
        const y1 = CENTER + Math.sin(a - Math.PI / 2) * (RADIUS - 8);
        const x2 = CENTER + Math.cos(a - Math.PI / 2) * (RADIUS - (i % 5 === 0 ? 18 : 13));
        const y2 = CENTER + Math.sin(a - Math.PI / 2) * (RADIUS - (i % 5 === 0 ? 18 : 13));
        return (
          <Line
            key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={i % 5 === 0 ? "#CBD5E1" : "#E2E8F0"}
            strokeWidth={i % 5 === 0 ? 2.5 : 1.5}
          />
        );
      })}

      {/* Active arc */}
      <Path
        d={arcPath}
        stroke="#4CAF50" strokeWidth={23}
        strokeLinecap="round" fill="none"
      />

      {/* Start dot */}
      <Circle cx={startPos.x} cy={startPos.y} r={12} fill="#064D27" stroke="#fff" strokeWidth={4} />
      <SvgText x={startPos.x} y={startPos.y + 5} textAnchor="middle" fontSize={15}>🔥</SvgText>

      {/* Drag handle */}
      <Circle
        cx={endPos.x} cy={endPos.y} r={14}
        fill="#4CAF50" stroke="#fff" strokeWidth={4}
        onPressIn={onDragStart}
      />
      <SvgText x={endPos.x} y={endPos.y + 5} textAnchor="middle" fontSize={13}>🍽</SvgText>
    </Svg>
  );
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
const SetGoal = ({ route }) => {
  const navigation = useNavigation();
  const [calculatedCalories, setCalculatedCalories] = useState(null);

  // Animated value drives arc rendering — same pattern as CalorieCalculator weight dial
  const animatedCalorie = useRef(new Animated.Value(1800)).current;

  // Committed value used for submit; updated after drag end or text confirm
  const calorieRef  = useRef(1800);

  // Display value for center text (kept in sync via listener in DialArc,
  // but we also need it here for the TextInput default)
  const [displayCalorie, setDisplayCalorie] = useState(1800);

  const dragging    = useRef(false);
  const rafRef      = useRef(null);
  const btnScale    = useRef(new Animated.Value(1)).current;

  // ── Keep displayCalorie state in sync for center label ──
  useEffect(() => {
    const id = animatedCalorie.addListener(({ value }) => {
      const rounded = Math.round(value);
      setDisplayCalorie(rounded);
      calorieRef.current = rounded;
    });
    return () => animatedCalorie.removeListener(id);
  }, [animatedCalorie]);

  // ── Text input state ──
  const [editing,   setEditing]   = useState(false);
  const [draft,     setDraft]     = useState("");
  const inputRef    = useRef(null);

  const openInput = () => {
    setDraft(String(calorieRef.current));
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const confirmInput = () => {
    const parsed = parseInt(draft, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(MAX_CALORIE, Math.max(MIN_CALORIE, parsed));
      // Spring animation sweeps the arc to the typed value
      Animated.spring(animatedCalorie, {
        toValue: clamped,
        useNativeDriver: false,
        tension: 55,
        friction: 10,
      }).start();
    }
    setEditing(false);
    setDraft("");
  };

  const animateTo = (target) => {
    Animated.spring(animatedCalorie, {
      toValue: target,
      useNativeDriver: false,
      tension: 55,
      friction: 10,
    }).start();
  };

  // ── Load persisted data ──
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem("calculatedCaloriesData");
        if (stored) setCalculatedCalories(JSON.parse(stored));

        const goal = await AsyncStorage.getItem("calorieGoalData");
        if (goal) {
          const parsed = JSON.parse(goal);
          const val = parsed.calorieGoal;
          animatedCalorie.setValue(val);
          calorieRef.current = val;
          setDisplayCalorie(val);
        }
      } catch (e) {
        console.warn("SetGoal load failed:", e);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const incoming = route?.params?.calculatedCalories;
    if (incoming) setCalculatedCalories(incoming);
  }, [route?.params?.calculatedCalories]);

  // ── Drag handlers ──
  const handleDragStart = useCallback(() => {
    dragging.current = true;
  }, []);

  const handleDrag = useCallback((evt) => {
    if (!dragging.current) return;
    const { locationX, locationY } = evt.nativeEvent;
    const dx = locationX - CENTER;
    const dy = locationY - CENTER;
    let angle = Math.atan2(dy, dx);
    angle = (angle + Math.PI * 2.5) % (Math.PI * 2);
    const cal = Math.round(
      MIN_CALORIE + (angle / (Math.PI * 2)) * (MAX_CALORIE - MIN_CALORIE)
    );
    const clamped = Math.min(MAX_CALORIE, Math.max(MIN_CALORIE, cal));
    // Instant during drag — no spring so it tracks the finger
    animatedCalorie.setValue(clamped);
    calorieRef.current = clamped;
  }, [animatedCalorie]);

  const handleDragEnd = useCallback(() => {
    dragging.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // ── Submit ──
  const handleSubmit = async () => {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 40 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 40 }),
    ]).start();
    try {
      const goal = calorieRef.current;
      await AsyncStorage.setItem(
        "calorieGoalData",
        JSON.stringify({
          calorieGoal: goal,
          protein_g: Math.round((goal * 0.3) / 4),
          carbs_g:   Math.round((goal * 0.4) / 4),
          fat_g:     Math.round((goal * 0.3) / 9),
        })
      );
      navigation.navigate("Wellness", { initialTab: 2 });
    } catch (e) {
      console.warn("SetGoal save failed:", e);
    }
  };

  return (
    <View style={s.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* ══ HEADER ══ */}
        <View style={s.header}>
          <View style={s.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
              <Feather name="arrow-left" size={20} color="#553FB5" />
            </TouchableOpacity>
            <View>
              <Text weight="700" style={s.headerTitle}>Set Calorie Goal</Text>
              <Text style={s.headerSub}>Build healthy habits, one day at a time.</Text>
            </View>
          </View>
        </View>

        <HeaderVeggies width={width} height={90} preserveAspectRatio="xMidYMid slice" />

        {/* ══ CIRCULAR DIAL ══ */}
        <View style={s.dialCard}>
          <DialArc
            animatedCalorie={animatedCalorie}
            onDragStart={handleDragStart}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
          />

          {/* Center — tap to type */}
          <View style={s.dialCenter}>
            {editing ? (
              <View style={s.inputRow}>
                <TextInput
                  ref={inputRef}
                  style={s.dialInput}
                  value={draft}
                  onChangeText={setDraft}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  maxLength={4}
                  selectTextOnFocus
                  onSubmitEditing={confirmInput}
                />
                <TouchableOpacity
                  onPress={confirmInput}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Feather name="check" size={18} color="#4CAF50" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={openInput} activeOpacity={0.75} style={s.dialValueWrap}>
                <Text weight="800" style={s.dialKcal}>
                  {displayCalorie.toLocaleString()}
                </Text>
                <Feather name="edit-2" size={11} color="#aaa" style={{ marginTop: 2 }} />
              </TouchableOpacity>
            )}
            <Text style={s.dialKcalUnit}>kcal / day</Text>
          </View>
        </View>

        {/* ══ CALORIE NEEDS CARD ══ */}
        <View style={{ marginHorizontal: 16 }}>
          {calculatedCalories ? (
            <CalorieResultCard
              calories={calculatedCalories}
              onRecalculate={() => navigation.navigate("CalorieCalculator")}
            />
          ) : (
            <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate("CalorieCalculator")}>
              <CalorieNeedsCard width={width - 32} height={137} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* ══ SUBMIT BAR ══ */}
      <View style={s.submitBar}>
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity onPress={handleSubmit} activeOpacity={0.88} style={s.submitBtn}>
            <LinearGradient
              colors={["#93D056", "#35A329"]}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={s.submitBtnInner}
            >
              <Text weight="700" style={s.submitBtnTxt}>Set Goal</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

export default SetGoal;

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const STATUS_BAR_H =
  Platform.OS === "ios" ? 56 : (StatusBar.currentHeight ?? 38) + 8;

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },

  header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  headerContent: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, color: "#553FB5" },
  headerSub:   { fontSize: 12, color: "#553FB5", marginTop: 2 },

  dialCard: {
    alignSelf: "center",
    width: DIAL_SIZE, height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
    backgroundColor: "#fff",
    margin: 16,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },

  dialCenter: {
    position: "absolute",
    alignItems: "center",
  },
  dialValueWrap: {
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  dialKcal: {
    fontSize: Math.min(DIAL_SIZE * 0.13, 36),
    color: "#4CAF50",
  },
  dialKcalUnit: {
    fontSize: 13, color: C.textMuted, marginTop: 2,
  },

  // Text input in center
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  dialInput: {
    fontSize: Math.min(DIAL_SIZE * 0.13, 36),
    fontWeight: "800",
    color: "#4CAF50",
    minWidth: 80,
    textAlign: "center",
    padding: 0,
  },

  submitBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 20, paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 30 : 18,
    borderTopWidth: 1, borderTopColor: "#F0F0F0",
  },
  submitBtn:      { borderRadius: 14, overflow: "hidden" },
  submitBtnInner: { paddingVertical: 15, alignItems: "center", alignSelf: "stretch" },
  submitBtnTxt:   { color: "#fff", fontSize: 17 },
});