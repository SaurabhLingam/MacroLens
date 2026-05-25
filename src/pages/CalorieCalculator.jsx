/**
 * CalorieCalculator.jsx — Pixel-matched to design reference
 * - Goal tabs show all 3 calorie outputs simultaneously after Calculate
 * - No goal selection, no result card at bottom
 * - White background, height section full-width white card
 * - Height label in bordered pill, ruler with leftward ticks
 * - Tombstone arch: full-bleed lavender container (semicircle top)
 * - Weight dial: pure tick/label arc, no needle, no fill, white pill value
 */

import React, { useRef, useState } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  Dimensions,
  PanResponder,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Svg, { Circle, Ellipse, Line, Path, Rect, G, Text as SvgText } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "../components/TextWrapper";

const { width } = Dimensions.get("window");
const STATUS_H = Platform.OS === "ios" ? 56 : (StatusBar.currentHeight ?? 28) + 8;

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
// SVG FIGURES
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
// WEIGHT DIAL
// ─────────────────────────────────────────────
const DIAL_W = width;
const DIAL_H = width * 0.48;

const WeightDial = ({ weightKg }) => {
  const cx = DIAL_W / 2;
  const cy = DIAL_H + 20;
  const r  = DIAL_H + 20;
  const MIN_ANG = Math.PI * 1.11;
  const MAX_ANG = Math.PI * 1.89;

  const pt = (angle, radius) => ({
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  });

  const ticks = [];
  for (let kg = MIN_KG; kg <= MAX_KG; kg += 2) {
    const pct = (kg - MIN_KG) / (MAX_KG - MIN_KG);
    const a = MIN_ANG + pct * (MAX_ANG - MIN_ANG);
    const isMajor = kg % 10 === 0;
    const isLabel = [35, 45, 55, 65, 75].includes(kg);
    const o = pt(a, r - 6);
    const i = pt(a, isMajor ? r - 22 : r - 14);
    const lp = pt(a, r - 34);
    ticks.push({ a, kg, o, i, isMajor, isLabel, lp });
  }

  const s = pt(MIN_ANG, r - 10);
  const e = pt(MAX_ANG, r - 10);

  return (
    <Svg width={DIAL_W} height={DIAL_H} style={{ overflow: "visible" }}>
      <Path
        d={`M ${s.x} ${s.y} A ${r-10} ${r-10} 0 0 1 ${e.x} ${e.y}`}
        stroke="#d8d0f0" strokeWidth={3} fill="none" strokeLinecap="round"
      />
      {ticks.map((t) => (
        <Line key={t.kg} x1={t.o.x} y1={t.o.y} x2={t.i.x} y2={t.i.y}
          stroke={t.isMajor ? PURPLE : PURPLE_LITE}
          strokeWidth={t.isMajor ? 2 : 1} strokeLinecap="round"
        />
      ))}
      {ticks.filter(t => t.isLabel).map((t) => (
        <SvgText key={`lbl-${t.kg}`} x={t.lp.x} y={t.lp.y}
          textAnchor="middle" alignmentBaseline="middle"
          fontSize={11} fill={PURPLE_MID} fontWeight="600"
        >
          {t.kg}
        </SvgText>
      ))}
    </Svg>
  );
};

// ─────────────────────────────────────────────
// AGE SLIDER
// ─────────────────────────────────────────────
const AgeSlider = ({ value, min, max, onChange }) => {
  const trackWidth = useRef(0);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => updateFromX(e.nativeEvent.locationX),
    onPanResponderMove: (e) => updateFromX(e.nativeEvent.locationX),
  })).current;
  const updateFromX = (x) => {
    const w = trackWidth.current;
    if (!w) return;
    onChange(Math.round(min + Math.min(Math.max(x / w, 0), 1) * (max - min)));
  };
  const fillPct = ((value - min) / (max - min)) * 100;
  return (
    <View style={ageSl.wrap} onLayout={e => { trackWidth.current = e.nativeEvent.layout.width; }} {...pan.panHandlers}>
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
// ACTIVITY SLIDER
// ─────────────────────────────────────────────
const ActivitySlider = ({ value, min, max, onChange }) => {
  const trackWidth = useRef(0);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => updateFromX(e.nativeEvent.locationX),
    onPanResponderMove: (e) => updateFromX(e.nativeEvent.locationX),
  })).current;
  const updateFromX = (x) => {
    const w = trackWidth.current;
    if (!w) return;
    onChange(Math.round(min + Math.min(Math.max(x / w, 0), 1) * (max - min)));
  };
  const fillPct = ((value - min) / (max - min)) * 100;
  const thumbColor = value <= 1 ? "#e53935" : value === 2 ? "#f9a825" : "#43a047";
  return (
    <View style={actSl.wrap} onLayout={e => { trackWidth.current = e.nativeEvent.layout.width; }} {...pan.panHandlers}>
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
  const [weightKg, setWeightKg] = useState(55);
  const [heightIn, setHeightIn] = useState(66);
  const [ageVal,   setAgeVal]   = useState(25);
  const [activity, setActivity] = useState(2);

  // All 3 calorie outputs — null until Calculate is pressed
  const [calories, setCalories] = useState({ lose: null, maintain: null, gain: null });

  const weightStartX   = useRef(0);
  const weightStartVal = useRef(55);
  const heightStartY   = useRef(0);
  const heightStartVal = useRef(66);

  const weightPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      weightStartX.current = e.nativeEvent.pageX;
      weightStartVal.current = weightKg;
    },
    onPanResponderMove: (e) => {
      const dx = e.nativeEvent.pageX - weightStartX.current;
      setWeightKg(Math.min(MAX_KG, Math.max(MIN_KG, Math.round(weightStartVal.current + dx * 0.6))));
    },
  })).current;

  const heightPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      heightStartY.current = e.nativeEvent.pageY;
      heightStartVal.current = heightIn;
    },
    onPanResponderMove: (e) => {
      const dy = heightStartY.current - e.nativeEvent.pageY;
      setHeightIn(Math.min(MAX_IN, Math.max(MIN_IN, Math.round(heightStartVal.current + dy * 0.3))));
    },
  })).current;

  const calculate = () => {
    const heightCm = heightIn * 2.54;
    const bmr = gender === "female"
      ? 10 * weightKg + 6.25 * heightCm - 5 * ageVal - 161
      : 10 * weightKg + 6.25 * heightCm - 5 * ageVal + 5;
    const tdee = Math.round(bmr * ACTIVITY_MULT[activity]);
    setCalories({
      lose:     Math.max(1200, tdee - 500),
      maintain: Math.max(1200, tdee),
      gain:     Math.max(1200, tdee + 300),
    });
  };

  const heightPct = (heightIn - MIN_IN) / (MAX_IN - MIN_IN);
  const HEIGHT_CARD_H = 260;
  const figureHeadFromBottom = 16 + heightPct * (HEIGHT_CARD_H - 80);

  const rulerMarks = [
    { label: "7'", pct: (84 - MIN_IN) / (MAX_IN - MIN_IN) },
    { label: "6'", pct: (72 - MIN_IN) / (MAX_IN - MIN_IN) },
    { label: "5'", pct: (60 - MIN_IN) / (MAX_IN - MIN_IN) },
    { label: "4'", pct: (48 - MIN_IN) / (MAX_IN - MIN_IN) },
  ];

  const goalTabs = [
    { key: "lose",     label: "To Lose Weight" },
    { key: "maintain", label: "To Maintain Weight" },
    { key: "gain",     label: "To Gain Weight" },
  ];

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
            <Text style={s.headerSub}>Choose the activity you performed.</Text>
          </View>
        </View>

        {/* ══ GOAL CARD — output only ══ */}
        <View style={s.goalCard}>
          <Text weight="700" style={s.goalCardTitle}>Estimated Daily Calorie</Text>
          <View style={s.goalRow}>
            {goalTabs.map(({ key, label }, idx) => (
              <View
                key={key}
                style={[
                  s.goalTab,
                  idx < goalTabs.length - 1 && s.goalTabBorder,
                ]}
              >
                <Text style={s.goalTabLabel} numberOfLines={2}>{label}</Text>
                <Text weight="700" style={s.goalTabValue}>
                  {calories[key] !== null ? calories[key] : "–"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ══ GENDER ══ */}
        <View style={s.genderWrap}>
          <View style={s.genderToggle}>
            {[["female","Female"],["male","Male"]].map(([g, label]) => (
              <TouchableOpacity
                key={g}
                style={[s.genderBtn, gender === g && s.genderBtnActive]}
                onPress={() => setGender(g)}
                activeOpacity={0.8}
              >
                <Feather name={g === "female" ? "circle" : "arrow-up-right"} size={13} color={gender === g ? "#fff" : PURPLE_MID} />
                <Text weight="600" style={[s.genderTxt, gender === g && { color: "#fff" }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ══ HEIGHT SECTION ══ */}
        <View style={[s.heightCard, { height: HEIGHT_CARD_H }]}>
          <View style={s.heightPill}>
            <Text weight="700" style={s.heightPillTxt}>{inchesToFt(heightIn)}</Text>
          </View>
          <View style={[s.dashedLine, { bottom: figureHeadFromBottom }]} />
          <View style={s.figureWrap}>
            {gender === "female"
              ? <FemaleFigure heightPct={heightPct} />
              : <MaleFigure heightPct={heightPct} />}
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

        {/* ══ TOMBSTONE ARCH CONTAINER ══ */}
        <View style={s.archContainer}>
          <View style={s.archTop} />

          {/* Weight dial */}
          <View style={s.dialWrap} {...weightPan.panHandlers}>
            <WeightDial weightKg={weightKg} />
            <View style={s.weightPill}>
              <Text weight="800" style={s.weightPillVal}>{weightKg}</Text>
            </View>
            <Text style={s.weightKgLabel}>Kg</Text>
          </View>

          {/* Age slider */}
          <View style={s.sliderBlock}>
            <View style={s.sliderRow}>
              <Text weight="700" style={s.sliderLabel}>Age</Text>
              <Text weight="800" style={s.sliderVal}>{ageVal}</Text>
            </View>
            <AgeSlider value={ageVal} min={10} max={80} onChange={setAgeVal} />
            <View style={s.ageLabels}>
              {[20,30,40,50,60].map(v => <Text key={v} style={s.ageLabelTxt}>{v}</Text>)}
            </View>
          </View>

          {/* Activity slider */}
          <View style={s.sliderBlock}>
            <Text weight="700" style={s.sliderLabel}>Activity Level</Text>
            <ActivitySlider value={activity} min={0} max={4} onChange={setActivity} />
            <View style={s.actLabels}>
              {["Sedentary","2","Moderate","4","Very Active"].map((l,i) => (
                <Text key={i} style={s.actLabelTxt}>{l}</Text>
              ))}
            </View>
          </View>

          {/* Calculate button */}
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
  },
  backBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, color: PURPLE },
  headerSub: { fontSize: 12, color: PURPLE_MID, marginTop: 1 },

  // Goal card — pure output display
  goalCard: {
    backgroundColor: PURPLE_SOFT,
    borderRadius: 16,
    marginHorizontal: 16, marginBottom: 14,
    padding: 16,
  },
  goalCardTitle: { fontSize: 14, color: PURPLE, marginBottom: 14 },
  goalRow: { flexDirection: "row" },
  goalTab: {
    flex: 1, paddingVertical: 4, paddingHorizontal: 4,
    alignItems: "center",
  },
  goalTabBorder: {
    borderRightWidth: 1, borderRightColor: "rgba(85,63,181,0.15)",
  },
  goalTabLabel: { fontSize: 11, color: PURPLE_MID, textAlign: "center", marginBottom: 6 },
  goalTabValue: { fontSize: 13, color: PURPLE, textAlign: "center" },

  // Gender
  genderWrap: { marginHorizontal: 16, marginBottom: 14 },
  genderToggle: { flexDirection: "row", backgroundColor: PURPLE_SOFT, borderRadius: 12, padding: 3, gap: 3 },
  genderBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  genderBtnActive: { backgroundColor: PURPLE, shadowColor: PURPLE, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  genderTxt: { fontSize: 13, color: PURPLE_MID },

  // Height card
  heightCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16, marginBottom: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    overflow: "hidden", position: "relative",
    shadowColor: PURPLE, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  heightPill: {
    position: "absolute", top: 16, left: 16, zIndex: 3,
    borderWidth: 1.5, borderColor: PURPLE_LITE,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: "#fff",
  },
  heightPillTxt: { fontSize: 16, color: "#222" },
  dashedLine: {
    position: "absolute", left: 16, right: 52,
    height: 0, borderTopWidth: 1.5,
    borderColor: PURPLE_MID, borderStyle: "dashed", zIndex: 2,
  },
  figureWrap: {
    position: "absolute", bottom: 0,
    left: 0, right: 52, alignItems: "center", zIndex: 1,
  },
  rulerOuter: {
    position: "absolute", right: 0, top: 0,
    width: 52, flexDirection: "row",
    alignItems: "stretch", paddingVertical: 10,
  },
  rulerTickCol: { width: 20, flex: 1, position: "relative" },
  rulerTick: { position: "absolute", right: 0, height: 1.5, borderRadius: 1 },
  rulerMinorTick: { width: 8, backgroundColor: PURPLE_LITE },
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

  // Arch container
  archContainer: {
    backgroundColor: PURPLE_SOFT,
    borderTopLeftRadius: width / 2,
    borderTopRightRadius: width / 2,
    marginTop: -10,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: "center",
  },
  archTop: { height: 10 },

  dialWrap: { width: width, alignItems: "center", marginBottom: 4, position: "relative" },
  weightPill: {
    position: "absolute", bottom: 18,
    backgroundColor: "#fff", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 6,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  weightPillVal: { fontSize: 28, color: "#1a1a2e" },
  weightKgLabel: { fontSize: 12, color: PURPLE_MID, marginBottom: 10 },

  sliderBlock: { width: "100%", marginBottom: 16 },
  sliderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  sliderLabel: { fontSize: 13, color: "#2a2060" },
  sliderVal: { fontSize: 15, color: PURPLE },
  ageLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  ageLabelTxt: { fontSize: 10, color: PURPLE_MID },
  actLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  actLabelTxt: { fontSize: 9, color: PURPLE_MID, textAlign: "center", flex: 1 },

  calcBtn: {
    width: "100%", backgroundColor: PURPLE,
    borderRadius: 16, paddingVertical: 17, alignItems: "center",
    marginTop: 8,
    shadowColor: PURPLE, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  calcBtnTxt: { color: "#fff", fontSize: 17 },
});