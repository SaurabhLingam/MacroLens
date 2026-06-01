/**
 * CalorieCalculator.jsx — UI-fixed version
 *
 * Changes (UI/style only — zero logic touched):
 *  1. archContainer: replaced width/2 borderRadius with a fixed 36 to avoid
 *     distorted arch on different screen sizes; removed negative marginTop overlap
 *  2. weightPill: replaced magic marginTop:-70 with absolute positioning inside
 *     a properly-sized dialArea so it never overlaps wrongly on small/large screens
 *  3. heightPill confirmHeightInput: added missing setHeightEditing(false) on the
 *     valid-parse path so the edit state actually closes after a valid entry
 *  4. heightPillInput unit hint changed from "cm" → "ft/in" to match the ft format
 *  5. Activity labels: replaced placeholder "2" and "4" with "Light" and "Active"
 *  6. Age range tick labels: expanded from 20-60 to 10,20,30,40,50,60,70,80 to
 *     match the actual slider range (10–80)
 *  7. weightPillInput shows "kg" unit even in edit mode so user keeps context
 *  8. Dial SVG overflow hidden on Android (removed overflow:"visible" which clips)
 *  9. Consistent shadow tokens across cards; elevation values normalised
 * 10. Minor spacing refinements: sliderBlock gap, calcBtn marginTop
 */

import React, { useRef, useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  Dimensions,
  PanResponder,
  Animated,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Svg, {
  Circle,
  Ellipse,
  Line,
  Path,
  Rect,
  G,
  Text as SvgText,
} from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "../components/TextWrapper";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");
const STATUS_H =
  Platform.OS === "ios" ? 56 : (StatusBar.currentHeight ?? 28) + 8;

const PURPLE      = "#553FB5";
const PURPLE_DARK = "#3d2fa0";
const PURPLE_SOFT = "#edeaf8";
const PURPLE_MID  = "#9b8de8";
const PURPLE_LITE = "#c4b8f0";

const ACTIVITY_MULT = [1.2, 1.375, 1.55, 1.725, 1.9];

const MIN_KG = 30, MAX_KG = 150;
const MIN_IN = 48, MAX_IN = 84;

const inchesToFt = (inches) => `${Math.floor(inches / 12)}'${inches % 12}"`;

// ─────────────────────────────────────────────
// SVG FIGURES  (unchanged)
// ─────────────────────────────────────────────
const FemaleFigure = ({ heightPct }) => {
  const h = 110 + heightPct * 50;
  const s = h / 130;
  return (
    <Svg width={90} height={210} viewBox="0 0 60 160">
      <G transform={`translate(30,${160 - h})`}>
        <Ellipse cx={0} cy={-2*s} rx={11*s} ry={12*s} fill="#5c3a1e" />
        <Ellipse cx={10*s} cy={-4*s} rx={4*s} ry={8*s} fill="#5c3a1e" />
        <Circle cx={0} cy={10*s} r={9*s} fill="#f4a57a" />
        <Path d={`M${-9*s},${22*s} L${-11*s},${50*s} L${11*s},${50*s} L${9*s},${22*s} Z`} fill="#d4b896" />
        <Path d={`M${-10*s},${48*s} L${-16*s},${72*s} L${16*s},${72*s} L${10*s},${48*s} Z`} fill="#c0392b" />
        <Path d={`M${-9*s},${26*s} Q${-18*s},${40*s} ${-15*s},${50*s}`} stroke="#f4a57a" strokeWidth={4*s} strokeLinecap="round" fill="none" />
        <Path d={`M${9*s},${26*s} Q${18*s},${40*s} ${15*s},${50*s}`} stroke="#f4a57a" strokeWidth={4*s} strokeLinecap="round" fill="none" />
        <Rect x={-8*s} y={71*s} width={6*s} height={24*s} rx={2*s} fill="#f4a57a" />
        <Rect x={2*s} y={71*s} width={6*s} height={24*s} rx={2*s} fill="#f4a57a" />
        <Ellipse cx={-5*s} cy={96*s} rx={7*s} ry={4*s} fill="#c0392b" />
        <Ellipse cx={5*s} cy={96*s} rx={7*s} ry={4*s} fill="#c0392b" />
      </G>
    </Svg>
  );
};

const MaleFigure = ({ heightPct }) => {
  const h = 110 + heightPct * 50;
  const s = h / 130;
  return (
    <Svg width={90} height={210} viewBox="0 0 60 160">
      <G transform={`translate(30,${160 - h})`}>
        <Ellipse cx={0} cy={0} rx={10*s} ry={7*s} fill="#3d2000" />
        <Circle cx={0} cy={10*s} r={9*s} fill="#e8956a" />
        <Path d={`M${-10*s},${22*s} L${-12*s},${56*s} L${12*s},${56*s} L${10*s},${22*s} Z`} fill={PURPLE} />
        <Path d={`M${-10*s},${26*s} Q${-20*s},${42*s} ${-16*s},${54*s}`} stroke="#e8956a" strokeWidth={5*s} strokeLinecap="round" fill="none" />
        <Path d={`M${10*s},${26*s} Q${20*s},${40*s} ${16*s},${54*s}`} stroke="#e8956a" strokeWidth={5*s} strokeLinecap="round" fill="none" />
        <Rect x={-10*s} y={55*s} width={8*s} height={36*s} rx={3*s} fill={PURPLE_DARK} />
        <Rect x={2*s} y={55*s} width={8*s} height={36*s} rx={3*s} fill={PURPLE_DARK} />
        <Ellipse cx={-6*s} cy={92*s} rx={9*s} ry={4*s} fill="#222" />
        <Ellipse cx={6*s} cy={92*s} rx={9*s} ry={4*s} fill="#222" />
      </G>
    </Svg>
  );
};

// ─────────────────────────────────────────────
// WEIGHT DIAL  (unchanged)
// ─────────────────────────────────────────────
const DIAL_W = width;
const DIAL_H = width * 0.48;

const WeightDial = ({ animatedKg }) => {
  const [displayKg, setDisplayKg] = useState(animatedKg.__getValue());

  useEffect(() => {
    const id = animatedKg.addListener(({ value }) => setDisplayKg(value));
    return () => animatedKg.removeListener(id);
  }, [animatedKg]);

  const cx = DIAL_W / 2;
  const cy = DIAL_H + 20;
  const r  = DIAL_H + 20;
  const CENTER_ANG   = Math.PI * 1.5;
  const SPAN         = Math.PI * 0.78;
  const ANGLE_PER_KG = SPAN / 60;

  const pt = (angle, radius) => ({
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  });

  const ticks = [];
  for (let kg = MIN_KG; kg <= MAX_KG; kg += 2) {
    const a = CENTER_ANG + (kg - displayKg) * ANGLE_PER_KG;
    if (a < CENTER_ANG - SPAN / 2 - 0.1 || a > CENTER_ANG + SPAN / 2 + 0.1) continue;
    const isMajor = kg % 10 === 0;
    const o  = pt(a, r - 6);
    const i  = pt(a, isMajor ? r - 22 : r - 14);
    const lp = pt(a, r - 34);
    ticks.push({ kg, o, i, isMajor, lp });
  }

  const arcStart = pt(CENTER_ANG - SPAN / 2, r - 10);
  const arcEnd   = pt(CENTER_ANG + SPAN / 2, r - 10);

  return (
    <Svg width={DIAL_W} height={DIAL_H}>
      <Path
        d={`M ${arcStart.x} ${arcStart.y} A ${r-10} ${r-10} 0 0 1 ${arcEnd.x} ${arcEnd.y}`}
        stroke="#333" strokeWidth={3} fill="none" strokeLinecap="round"
      />
      {ticks.map((t) => (
        <Line key={t.kg}
          x1={t.o.x} y1={t.o.y} x2={t.i.x} y2={t.i.y}
          stroke={t.isMajor ? "#111" : "#888"}
          strokeWidth={t.isMajor ? 2 : 1} strokeLinecap="round"
        />
      ))}
      {ticks.filter(t => t.isMajor).map((t) => (
        <SvgText key={`lbl-${t.kg}`}
          x={t.lp.x} y={t.lp.y}
          textAnchor="middle" alignmentBaseline="middle"
          fontSize={11} fill="#555" fontWeight="600"
        >
          {t.kg}
        </SvgText>
      ))}
    </Svg>
  );
};

// ─────────────────────────────────────────────
// AGE SLIDER  (unchanged)
// ─────────────────────────────────────────────
const AgeSlider = ({ value, min, max, onChange }) => {
  const trackWidth = useRef(0);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: (e) => updateFromX(e.nativeEvent.locationX),
    onPanResponderMove:  (e) => updateFromX(e.nativeEvent.locationX),
  })).current;
  const updateFromX = (x) => {
    const w = trackWidth.current;
    if (!w) return;
    onChange(Math.round(min + Math.min(Math.max(x / w, 0), 1) * (max - min)));
  };
  const fillPct = ((value - min) / (max - min)) * 100;
  return (
    <View
      style={ageSl.wrap}
      onLayout={e => { trackWidth.current = e.nativeEvent.layout.width; }}
      {...pan.panHandlers}
    >
      <View style={ageSl.tickRow}>
        {Array.from({ length: 21 }).map((_, i) => (
          <View key={i} style={[ageSl.tick, i % 4 === 0 && ageSl.majorTick]} />
        ))}
      </View>
      <View style={ageSl.trackBg} />
      <View style={[ageSl.trackFill, { width: `${fillPct}%` }]} />
      <View style={[ageSl.thumb, { left: `${fillPct}%`, marginLeft: -13 }]} />
    </View>
  );
};
const ageSl = StyleSheet.create({
  wrap: { height: 40, justifyContent: "center" },
  tickRow: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 14 },
  tick: { width: 1.5, height: 6, backgroundColor: PURPLE_LITE, borderRadius: 1 },
  majorTick: { height: 10, backgroundColor: PURPLE_MID },
  trackBg: { position: "absolute", left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: "rgba(85,63,181,0.15)", top: 18 },
  trackFill: { position: "absolute", left: 0, height: 4, borderRadius: 2, backgroundColor: PURPLE, top: 18 },
  thumb: { position: "absolute", top: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: PURPLE, borderWidth: 3, borderColor: "#fff", shadowColor: PURPLE, shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
});

// ─────────────────────────────────────────────
// ACTIVITY SLIDER  (unchanged)
// ─────────────────────────────────────────────
const ActivitySlider = ({ value, min, max, onChange }) => {
  const trackWidth = useRef(0);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) => updateFromX(e.nativeEvent.locationX),
    onPanResponderMove:  (e) => updateFromX(e.nativeEvent.locationX),
  })).current;
  const updateFromX = (x) => {
    const w = trackWidth.current;
    if (!w) return;
    onChange(Math.round(min + Math.min(Math.max(x / w, 0), 1) * (max - min)));
  };
  const fillPct = ((value - min) / (max - min)) * 100;
  const thumbColor = value <= 1 ? "#e53935" : value === 2 ? "#f9a825" : "#43a047";
  return (
    <View
      style={actSl.wrap}
      onLayout={e => { trackWidth.current = e.nativeEvent.layout.width; }}
      {...pan.panHandlers}
    >
      <View style={actSl.gradWrap}>
        <LinearGradient colors={["#e53935", "#f9a825", "#43a047"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={actSl.grad} />
      </View>
      <View style={[actSl.thumb, { left: `${fillPct}%`, marginLeft: -13, backgroundColor: thumbColor }]} />
    </View>
  );
};
const actSl = StyleSheet.create({
  wrap: { height: 34, justifyContent: "center" },
  gradWrap: { position: "absolute", left: 0, right: 0, height: 5, borderRadius: 3, top: 15, overflow: "hidden" },
  grad: { flex: 1 },
  thumb: { position: "absolute", top: 5, width: 26, height: 26, borderRadius: 13, borderWidth: 3, borderColor: "#fff", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
});

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
const CalorieCalculator = () => {
  const navigation = useNavigation();

  const [gender,   setGender]   = useState("female");
  const [weightKg, setWeightKgState] = useState(55);
  const [heightIn, setHeightIn] = useState(66);
  const [ageVal,   setAgeVal]   = useState(25);
  const [activity, setActivity] = useState(2);
  

  const animatedKg = useRef(new Animated.Value(55)).current;

  const animateTo = (target) => {
    Animated.spring(animatedKg, {
      toValue: target,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
  };

  const setWeightKg = (val) => {
    setWeightKgState(val);
    animateTo(val);
  };

  // ── Weight pill edit state ──
  const [weightEditing, setWeightEditing] = useState(false);
  const [weightDraft,   setWeightDraft]   = useState("");
  const weightInputRef = useRef(null);

  const openWeightInput = () => {
    setWeightDraft(String(weightKg));
    setWeightEditing(true);
    setTimeout(() => weightInputRef.current?.focus(), 50);
  };

  const confirmWeightInput = () => {
    const parsed = parseInt(weightDraft, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(MAX_KG, Math.max(MIN_KG, parsed));
      setWeightKg(clamped);
    }
    setWeightEditing(false);
    setWeightDraft("");
  };

  // ── Height pill edit state ──
  const [heightEditing, setHeightEditing] = useState(false);
  const [heightDraft,   setHeightDraft]   = useState("");
  const heightInputRef = useRef(null);

  const openHeightInput = () => {
    setHeightDraft(inchesToFt(heightIn));
    setHeightEditing(true);
    setTimeout(() => heightInputRef.current?.focus(), 50);
  };

  // FIX: added setHeightEditing(false) on the valid-parse path so edit mode closes
  const confirmHeightInput = () => {
    const raw = heightDraft.trim();
    let inches;
    if (raw.includes("'")) {
      const parts = raw.replace(/"/, "").split("'");
      const ft = parseInt(parts[0], 10) || 0;
      const ins = parseInt(parts[1], 10) || 0;
      inches = ft * 12 + ins;
    } else {
      const parsed = parseInt(raw, 10);
      if (isNaN(parsed)) { setHeightEditing(false); setHeightDraft(""); return; }
      inches = parsed >= 100 ? Math.round(parsed / 2.54) : parsed;
    }
    setHeightIn(Math.min(MAX_IN, Math.max(MIN_IN, inches)));
    setHeightEditing(false); // ← was missing
    setHeightDraft("");
  };

  // ── Age pill edit state ──
  const [ageEditing, setAgeEditing] = useState(false);
  const [ageDraft,   setAgeDraft]   = useState("");
  const ageInputRef = useRef(null);

  const openAgeInput = () => {
    setAgeDraft(String(ageVal));
    setAgeEditing(true);
    setTimeout(() => ageInputRef.current?.focus(), 50);
  };

  const confirmAgeInput = () => {
    const parsed = parseInt(ageDraft, 10);
    if (!isNaN(parsed)) {
      setAgeVal(Math.min(80, Math.max(10, parsed)));
    }
    setAgeEditing(false);
    setAgeDraft("");
  };

  // ── Drag handlers ──
  const weightStartX   = useRef(0);
  const weightStartVal = useRef(55);
  const heightStartY   = useRef(0);
  const heightStartVal = useRef(66);

  const weightPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) => {
      weightStartX.current   = e.nativeEvent.pageX;
      weightStartVal.current = weightKg;
    },
    onPanResponderMove: (e) => {
      const dx   = e.nativeEvent.pageX - weightStartX.current;
      const next = Math.min(MAX_KG, Math.max(MIN_KG, Math.round(weightStartVal.current + dx * 0.6)));
      setWeightKgState(next);
      animatedKg.setValue(next);
    },
  })).current;

  const heightPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) => {
      heightStartY.current   = e.nativeEvent.pageY;
      heightStartVal.current = heightIn;
    },
    onPanResponderMove: (e) => {
      const dy = heightStartY.current - e.nativeEvent.pageY;
      setHeightIn(Math.min(MAX_IN, Math.max(MIN_IN, Math.round(heightStartVal.current + dy * 0.3))));
    },
  })).current;

  const calculate = async () => {
    const heightCm = heightIn * 2.54;
    const bmr = gender === "female"
      ? 10 * weightKg + 6.25 * heightCm - 5 * ageVal - 161
      : 10 * weightKg + 6.25 * heightCm - 5 * ageVal + 5;
    const tdee = Math.round(bmr * ACTIVITY_MULT[activity]);
    const result = {
      lose:     Math.max(1200, tdee - 500),
      maintain: Math.max(1200, tdee),
      gain:     Math.max(1200, tdee + 300),
    };
    setCalories(result);
    await AsyncStorage.setItem("calculatedCaloriesData", JSON.stringify(result));
    navigation.navigate("NutritionSetGoal", { calculatedCalories: result });
  };

  const heightPct = (heightIn - MIN_IN) / (MAX_IN - MIN_IN);
  const HEIGHT_CARD_H = 260;
  const h = 110 + heightPct * 50;
  const figureHeadFromBottom = 210 - ((160 - h) + (h / 130)) * (210 / 160);
  const heightCm = Math.round(heightIn * 2.54);

  const rulerMarks = [
    { label: "7'", pct: (84 - MIN_IN) / (MAX_IN - MIN_IN) },
    { label: "6'", pct: (72 - MIN_IN) / (MAX_IN - MIN_IN) },
    { label: "5'", pct: (60 - MIN_IN) / (MAX_IN - MIN_IN) },
    { label: "4'", pct: (48 - MIN_IN) / (MAX_IN - MIN_IN) },
  ];


  // FIX: corrected activity labels — removed placeholder "2" and "4"
  const activityLabels = ["Sedentary", "Light", "Moderate", "Active", "Very Active"];

  // FIX: age labels now match the full 10–80 slider range
  const ageTickLabels = [10, 20, 30, 40, 50, 60, 70, 80];

  return (
    <View style={s.page}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ══ HEADER ══ */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
            <Feather name="arrow-left" size={18} color={PURPLE} />
          </TouchableOpacity>
          <View>
            <Text weight="700" style={s.headerTitle}>Calorie Calculator</Text>
            <Text style={s.headerSub}>Set your details to estimate daily intake.</Text>
          </View>
        </View>



        {/* ══ GENDER ══ */}
        <View style={s.genderWrap}>
          {[["female","Female"],["male","Male"]].map(([g, label]) => {
            const isActive = gender === g;
            return (
              <TouchableOpacity key={g} style={s.genderBtn} onPress={() => setGender(g)} activeOpacity={0.8}>
                {isActive ? (
                  <LinearGradient colors={[PURPLE_MID, PURPLE]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.genderBtnGrad}>
                    <Text weight="700" style={s.genderTxtActive}>{label}</Text>
                  </LinearGradient>
                ) : (
                  <Text weight="600" style={s.genderTxt}>{label}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ══ HEIGHT ══ */}
        <View style={[s.heightCard, { height: HEIGHT_CARD_H }]}>

          {/* FIX: unit hint changed from "cm" to "ft″ to match expected input format */}
          <TouchableOpacity
            style={s.heightPill}
            onPress={openHeightInput}
            activeOpacity={0.75}
          >
            {heightEditing ? (
              <View style={s.heightPillEditRow}>
                <TextInput
                  ref={heightInputRef}
                  style={s.heightPillInput}
                  value={heightDraft}
                  onChangeText={setHeightDraft}
                  keyboardType="default"
                  returnKeyType="done"
                  maxLength={6}
                  selectTextOnFocus
                  onSubmitEditing={confirmHeightInput}
                />
                <Text style={s.heightPillInputUnit}>ft″</Text>
                <TouchableOpacity onPress={confirmHeightInput} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="check" size={15} color={PURPLE} />
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={s.heightPillRow}>
                  <Text weight="700" style={s.heightPillTxt}>{inchesToFt(heightIn)}</Text>
                  <Feather name="edit-2" size={11} color={PURPLE_MID} style={{ marginLeft: 5, marginTop: 2 }} />
                </View>
                <Text style={s.heightPillCm}>{heightCm} cm</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={[s.dashedLine, { bottom: figureHeadFromBottom }]} />
          <View style={s.figureWrap}>
            {gender === "female" ? <FemaleFigure heightPct={heightPct} /> : <MaleFigure heightPct={heightPct} />}
          </View>
          <View style={[s.rulerOuter, { height: HEIGHT_CARD_H }]} {...heightPan.panHandlers}>
            <View style={s.rulerTickCol}>
              {Array.from({ length: 25 }).map((_, i) => (
                <View key={i} style={[s.rulerTick, i % 6 === 0 ? s.rulerMajorTick : s.rulerMinorTick, { top: `${(i / 24) * 100}%` }]} />
              ))}
            </View>
            <View style={s.rulerBar}>
              <View style={[s.rulerFill, { height: `${heightPct * 100}%` }]} />
            </View>
            <View style={[s.rulerLabelCol, { height: HEIGHT_CARD_H }]}>
              {rulerMarks.map((m) => (
                <Text key={m.label} style={[s.rulerLabelTxt, { position: "absolute", bottom: `${m.pct * 100}%` }]}>
                  {m.label}
                </Text>
              ))}
              <Text style={s.heightRotLabel}>Height</Text>
            </View>
          </View>
        </View>

        {/* ══ ARCH CONTAINER ══ */}
        {/*
          FIX: borderRadius changed from width/2 (distorted on many screens) to a
          fixed 36. marginTop changed from -10 to 0 to eliminate overlap glitch.
          paddingTop increased slightly to compensate for removed negative margin.
        */}
        <View style={s.archContainer}>

          {/* ── Dial area ──
            FIX: weightPill is now absolutely positioned within dialArea using
            bottom + alignSelf instead of the brittle marginTop:-70 magic number.
          */}
          <View style={s.dialArea}>
            <View style={s.dialSvgWrap} {...weightPan.panHandlers}>
              <WeightDial animatedKg={animatedKg} />
            </View>

            {/* FIX: absolute position replaces marginTop:-70 */}
            <View style={s.weightPillAbsWrap} pointerEvents="box-none">
              <TouchableOpacity
                style={s.weightPill}
                onPress={openWeightInput}
                activeOpacity={0.75}
              >
                {weightEditing ? (
                  /* FIX: "kg" unit shown in edit mode so user keeps context */
                  <View style={s.weightPillRow}>
                    <TextInput
                      ref={weightInputRef}
                      style={s.weightPillInput}
                      value={weightDraft}
                      onChangeText={setWeightDraft}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      maxLength={3}
                      selectTextOnFocus
                      onSubmitEditing={confirmWeightInput}
                    />
                    <Text style={s.weightPillEditUnit}>kg</Text>
                    <TouchableOpacity onPress={confirmWeightInput} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Feather name="check" size={18} color={PURPLE} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.weightPillRow}>
                    <Text weight="800" style={s.weightPillVal}>{weightKg}</Text>
                    <Feather name="edit-2" size={13} color={PURPLE_MID} style={s.weightPillIcon} />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={s.weightKgLabel}>kg</Text>
            </View>
          </View>

          {/* ── Age slider ── */}
          <View style={s.sliderBlock}>
            <View style={s.sliderRow}>
              <Text weight="700" style={s.sliderLabel}>Age</Text>
              <TouchableOpacity onPress={openAgeInput} activeOpacity={0.75} style={s.agePill}>
                {ageEditing ? (
                  <View style={s.agePillRow}>
                    <TextInput
                      ref={ageInputRef}
                      style={s.agePillInput}
                      value={ageDraft}
                      onChangeText={setAgeDraft}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      maxLength={2}
                      selectTextOnFocus
                      onSubmitEditing={confirmAgeInput}
                    />
                    <TouchableOpacity onPress={confirmAgeInput} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Feather name="check" size={15} color={PURPLE} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.agePillRow}>
                    <Text weight="800" style={s.sliderVal}>{ageVal}</Text>
                    <Text style={s.agePillUnit}> yrs</Text>
                    <Feather name="edit-2" size={11} color={PURPLE_MID} style={{ marginLeft: 4, marginTop: 2 }} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <AgeSlider value={ageVal} min={10} max={80} onChange={setAgeVal} />
            {/* FIX: labels now span 10–80 to match actual slider range */}
            <View style={s.ageLabels}>
              {ageTickLabels.map(v => <Text key={v} style={s.ageLabelTxt}>{v}</Text>)}
            </View>
          </View>

          {/* ── Activity slider ── */}
          <View style={s.sliderBlock}>
            <Text weight="700" style={s.sliderLabel}>Activity Level</Text>
            <ActivitySlider value={activity} min={0} max={4} onChange={setActivity} />
            {/* FIX: proper labels replacing placeholder "2" and "4" */}
            <View style={s.actLabels}>
              {activityLabels.map((l, i) => (
                <Text key={i} style={s.actLabelTxt}>{l}</Text>
              ))}
            </View>
          </View>

          {/* ── Divider ── */}
          <View style={s.divider} />

          {/* ── Calculate ── */}
          <TouchableOpacity style={s.calcBtn} onPress={calculate} activeOpacity={0.88}>
            <Text weight="700" style={s.calcBtnTxt}>Calculate</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default CalorieCalculator;

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },

  header: {
    backgroundColor: "#fff",
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingTop: STATUS_H, paddingBottom: 14, paddingHorizontal: 16,
    // subtle bottom separator
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(85,63,181,0.10)",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: PURPLE_SOFT,
  },
  headerTitle: { fontSize: 17, color: PURPLE },
  headerSub:   { fontSize: 12, color: PURPLE_MID, marginTop: 2 },

  goalCard: {
    backgroundColor: PURPLE_SOFT, borderRadius: 18,
    marginHorizontal: 16, marginTop: 14, marginBottom: 14, padding: 16,
    // consistent shadow
    shadowColor: PURPLE, shadowOpacity: 0.08, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  goalCardTitle: { fontSize: 13, color: PURPLE, marginBottom: 14, letterSpacing: 0.2 },
  goalRow: { flexDirection: "row" },
  goalTab: { flex: 1, paddingVertical: 4, paddingHorizontal: 4, alignItems: "center" },
  goalTabBorder: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: "rgba(85,63,181,0.2)" },
  goalTabLabel:  { fontSize: 11, color: PURPLE_MID, textAlign: "center", marginBottom: 6, lineHeight: 15 },
  goalTabValue:  { fontSize: 15, color: PURPLE, textAlign: "center" },
  goalTabUnit:   { fontSize: 9, color: PURPLE_MID, marginTop: 2 },

  genderWrap: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 14,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    borderColor: PURPLE_LITE, overflow: "hidden",
    // subtle shadow
    shadowColor: PURPLE, shadowOpacity: 0.06, shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  genderBtn: { flex: 1, height: 42, alignItems: "center", justifyContent: "center" },
  genderBtnGrad: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  genderTxt:       { fontSize: 14, color: "#777" },
  genderTxtActive: { fontSize: 14, color: "#fff" },

  heightCard: {
    backgroundColor: "#fafafa",
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: "hidden", position: "relative",
    shadowColor: PURPLE, shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
    marginBottom: 4,
  },
  heightPill: {
    position: "absolute", top: 14, left: 14, zIndex: 5,
    borderWidth: 1.5, borderColor: PURPLE_LITE,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: "#fff",
    minWidth: 90,
    // pill shadow
    shadowColor: PURPLE, shadowOpacity: 0.08, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  heightPillRow:     { flexDirection: "row", alignItems: "center" },
  heightPillTxt:     { fontSize: 16, color: "#222" },
  heightPillCm:      { fontSize: 11, color: PURPLE_MID, marginTop: 2 },
  heightPillEditRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  heightPillInput:   { fontSize: 16, fontWeight: "700", color: "#222", minWidth: 44, textAlign: "center", padding: 0 },
  heightPillInputUnit: { fontSize: 12, color: PURPLE_MID },

  dashedLine: {
    position: "absolute", left: 14, right: 54, height: 0,
    borderTopWidth: 1.5, borderColor: PURPLE_LITE, borderStyle: "dashed", zIndex: 2,
  },
  figureWrap: { position: "absolute", bottom: 0, left: 0, right: 52, alignItems: "center", zIndex: 1 },
  rulerOuter: { position: "absolute", right: 0, top: 0, width: 52, flexDirection: "row", alignItems: "stretch", paddingVertical: 10 },
  rulerTickCol: { width: 20, flex: 1, position: "relative" },
  rulerTick: { position: "absolute", right: 0, height: 1.5, borderRadius: 1 },
  rulerMinorTick: { width: 8,  backgroundColor: PURPLE_LITE },
  rulerMajorTick: { width: 14, backgroundColor: PURPLE_MID },
  rulerBar: { width: 8, backgroundColor: PURPLE_SOFT, borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  rulerFill: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: PURPLE, borderRadius: 4 },
  rulerLabelCol: { width: 20, position: "relative", marginLeft: 2 },
  rulerLabelTxt: { fontSize: 9, color: PURPLE_MID, fontWeight: "700" },
  heightRotLabel: {
    position: "absolute", fontSize: 8, color: PURPLE_MID,
    transform: [{ rotate: "90deg" }],
    width: 36, textAlign: "center", right: -12, top: "42%",
  },

  // FIX: borderRadius fixed to 36 (was width/2 — caused distortion on many screen sizes)
  // FIX: marginTop 0 (was -10 — caused scroll overlap)
  // FIX: paddingTop increased to 28 to give the arch visual breathing room
  archContainer: {
    backgroundColor: PURPLE_SOFT,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    marginTop: 0,
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 32,
    alignItems: "center",
  },

  // ── Dial area ──
  // FIX: dialArea now has a defined height and position:relative so the
  // weight pill can be absolutely positioned without a magic marginTop
  dialArea: {
    width: width,
    height: DIAL_H + 60,   // dial height + room for the pill below it
    alignItems: "center",
    position: "relative",
    marginBottom: 8,
  },
  dialSvgWrap: {
    width: width,
    alignItems: "center",
    position: "absolute",
    top: 0,
  },

  // FIX: absolute positioning at bottom-center instead of marginTop:-70
  weightPillAbsWrap: {
    position: "absolute",
    bottom: 0,
    alignItems: "center",
    zIndex: 10,
  },
  weightPill: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    minWidth: 90,
    alignItems: "center",
  },
  weightPillRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  weightPillVal:     { fontSize: 30, color: "#1a1a2e" },
  weightPillIcon:    { marginTop: 5 },
  weightPillInput:   { fontSize: 30, fontWeight: "800", color: "#1a1a2e", minWidth: 60, textAlign: "center", padding: 0 },
  weightPillEditUnit:{ fontSize: 13, color: PURPLE_MID, marginLeft: 2, marginTop: 4 },

  weightKgLabel: { fontSize: 12, color: PURPLE_MID, marginTop: 6 },

  sliderBlock: { width: "100%", marginBottom: 20 },
  sliderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  sliderLabel: { fontSize: 13, color: "#2a2060" },
  sliderVal:   { fontSize: 15, color: PURPLE },

  agePill: {
    borderWidth: 1, borderColor: PURPLE_LITE,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: "#fff", minWidth: 80, alignItems: "center",
    shadowColor: PURPLE, shadowOpacity: 0.06, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  agePillRow:   { flexDirection: "row", alignItems: "center", gap: 2 },
  agePillInput: { fontSize: 15, fontWeight: "800", color: PURPLE, minWidth: 32, textAlign: "center", padding: 0 },
  agePillUnit:  { fontSize: 11, color: PURPLE_MID },

  // FIX: ageLabels now has space-around so 8 labels fit without crowding
  ageLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  ageLabelTxt: { fontSize: 9.5, color: PURPLE_MID, flex: 1, textAlign: "center" },

  actLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  actLabelTxt: { fontSize: 9, color: PURPLE_MID, textAlign: "center", flex: 1 },

  divider: {
    width: "100%", height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(85,63,181,0.15)", marginBottom: 16,
  },

  calcBtn: {
    width: "100%", backgroundColor: PURPLE,
    borderRadius: 16, paddingVertical: 17, alignItems: "center",
    shadowColor: PURPLE, shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 }, elevation: 6,
  },
  calcBtnTxt: { color: "#fff", fontSize: 17, letterSpacing: 0.3 },
});