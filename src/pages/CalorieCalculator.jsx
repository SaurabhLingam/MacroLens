/**
 * CalorieCalculator.jsx — v4
 *
 * Changes from v3:
 *  1. Activity icons redesigned — cleaner, more recognizable pictograms at small size:
 *       Sedentary  → person in armchair (side profile, clear silhouette)
 *       Light      → person walking (clear stride, cane-free)
 *       Moderate   → person jogging (more forward lean than walking)
 *       Active     → person running (airborne stride, arms pumping)
 *       Very Active → person with barbell overhead (clean weightlifter)
 *  2. All inputs persisted to AsyncStorage on calculate:
 *       gender, weightKg, heightIn, ageVal, activity, calories
 *  3. All inputs restored from AsyncStorage on mount (with safe fallbacks)
 *  4. animatedKg seeded from restored weight so dial starts in correct position
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
  Polygon,
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
const PURPLE_DEEP = "#2a1f6e";

const ACTIVITY_MULT   = [1.2, 1.375, 1.55, 1.725, 1.9];
const ACTIVITY_LABELS = ["Sedentary", "Light", "Moderate", "Active", "Very\nActive"];

const MIN_KG = 30, MAX_KG = 150;
const MIN_IN = 48, MAX_IN = 84;

const STORAGE_KEY = "calorieCalcState";

const inchesToFt = (inches) => `${Math.floor(inches / 12)}'${inches % 12}"`;

const calcBMR = (gender, weightKg, heightIn, ageVal) => {
  const heightCm = heightIn * 2.54;
  return gender === "female"
    ? 10 * weightKg + 6.25 * heightCm - 5 * ageVal - 161
    : 10 * weightKg + 6.25 * heightCm - 5 * ageVal + 5;
};



// ─────────────────────────────────────────────
// ACTIVITY SELECTOR
// ─────────────────────────────────────────────
const ActivitySelector = ({ value, onChange }) => (
  <View style={act.row}>
    {ACTIVITY_LABELS.map((label, i) => {
      const isActive  = value === i;

      return (
        <TouchableOpacity
          key={i}
          style={[act.card, isActive && act.cardActive]}
          onPress={() => onChange(i)}
          activeOpacity={0.75}
        >
          <Text style={[act.label, isActive && act.labelActive]} numberOfLines={2}>
            {label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const act = StyleSheet.create({
  row:        { flexDirection: "row", gap: 7 },
  card:       {
    flex: 1,
    backgroundColor: PURPLE_SOFT,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 8,
    minHeight: 52,
    justifyContent: "center",
  },
  cardActive: { backgroundColor: PURPLE },
  label:      { fontSize: 9, fontWeight: "700", color: PURPLE_MID, textAlign: "center", lineHeight: 12 },
  labelActive:{ color: "#fff" },
});

// ─────────────────────────────────────────────
// SVG FIGURES
// ─────────────────────────────────────────────
const FemaleFigure = ({ heightPct }) => {
  const h = 90 + heightPct * 40;
  const s = h / 130;
  return (
    <Svg width={70} height={140} viewBox="0 0 60 160">
      <G transform={`translate(30,${140 - h})`}>
        <Ellipse cx={0} cy={-2 * s} rx={11 * s} ry={12 * s} fill="#5c3a1e" />
        <Circle  cx={0} cy={10 * s} r={9 * s} fill="#f4a57a" />
        <Path d={`M${-9*s},${22*s} L${-11*s},${50*s} L${11*s},${50*s} L${9*s},${22*s} Z`} fill="#d4b896" />
        <Path d={`M${-10*s},${48*s} L${-16*s},${72*s} L${16*s},${72*s} L${10*s},${48*s} Z`} fill="#c0392b" />
        <Path d={`M${-9*s},${26*s} Q${-18*s},${40*s} ${-15*s},${50*s}`} stroke="#f4a57a" strokeWidth={4*s} strokeLinecap="round" fill="none" />
        <Path d={`M${9*s},${26*s} Q${18*s},${40*s} ${15*s},${50*s}`}   stroke="#f4a57a" strokeWidth={4*s} strokeLinecap="round" fill="none" />
        <Rect x={-8*s} y={71*s} width={6*s} height={24*s} rx={2*s} fill="#f4a57a" />
        <Rect x={ 2*s} y={71*s} width={6*s} height={24*s} rx={2*s} fill="#f4a57a" />
        <Ellipse cx={-5*s} cy={96*s} rx={7*s} ry={4*s} fill="#c0392b" />
        <Ellipse cx={ 5*s} cy={96*s} rx={7*s} ry={4*s} fill="#c0392b" />
      </G>
    </Svg>
  );
};

const MaleFigure = ({ heightPct }) => {
  const h = 90 + heightPct * 40;
  const s = h / 130;
  return (
    <Svg width={70} height={140} viewBox="0 0 60 160">
      <G transform={`translate(30,${140 - h})`}>
        <Ellipse cx={0} cy={0}    rx={10*s} ry={7*s}  fill="#3d2000" />
        <Circle  cx={0} cy={10*s} r={9*s}              fill="#e8956a" />
        <Path d={`M${-10*s},${22*s} L${-12*s},${56*s} L${12*s},${56*s} L${10*s},${22*s} Z`} fill={PURPLE} />
        <Path d={`M${-10*s},${26*s} Q${-20*s},${42*s} ${-16*s},${54*s}`} stroke="#e8956a" strokeWidth={5*s} strokeLinecap="round" fill="none" />
        <Path d={`M${10*s},${26*s} Q${20*s},${40*s} ${16*s},${54*s}`}    stroke="#e8956a" strokeWidth={5*s} strokeLinecap="round" fill="none" />
        <Rect x={-10*s} y={55*s} width={8*s} height={36*s} rx={3*s} fill={PURPLE_DARK} />
        <Rect x={  2*s} y={55*s} width={8*s} height={36*s} rx={3*s} fill={PURPLE_DARK} />
        <Ellipse cx={-6*s} cy={92*s} rx={9*s} ry={4*s} fill="#222" />
        <Ellipse cx={ 6*s} cy={92*s} rx={9*s} ry={4*s} fill="#222" />
      </G>
    </Svg>
  );
};

// ─────────────────────────────────────────────
// WEIGHT DIAL
// ─────────────────────────────────────────────
const DIAL_W = width - 32;
const DIAL_H = (width - 32) * 0.42;

const WeightDial = ({ animatedKg }) => {
  const [displayKg, setDisplayKg] = useState(animatedKg.__getValue());

  useEffect(() => {
    const id = animatedKg.addListener(({ value }) => setDisplayKg(value));
    return () => animatedKg.removeListener(id);
  }, [animatedKg]);

  const cx = DIAL_W / 2;
  const cy = DIAL_H + 24;
  const r  = DIAL_H + 24;
  const CENTER_ANG   = Math.PI * 1.5;
  const SPAN         = Math.PI * 0.75;
  const ANGLE_PER_KG = SPAN / 60;

  const pt = (angle, radius) => ({
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  });

  const ticks = [];
  for (let kg = MIN_KG; kg <= MAX_KG; kg += 1) {
    const a = CENTER_ANG + (kg - displayKg) * ANGLE_PER_KG;
    if (a < CENTER_ANG - SPAN/2 - 0.05 || a > CENTER_ANG + SPAN/2 + 0.05) continue;
    const isMajor = kg % 10 === 0;
    const isMid   = kg % 5  === 0;
    const o  = pt(a, r - 4);
    const i  = pt(a, isMajor ? r - 22 : isMid ? r - 15 : r - 10);
    const lp = pt(a, r - 32);
    ticks.push({ kg, o, i, isMajor, isMid, lp });
  }

  const arcStart = pt(CENTER_ANG - SPAN/2, r - 8);
  const arcEnd   = pt(CENTER_ANG + SPAN/2, r - 8);

  return (
    <Svg width={DIAL_W} height={DIAL_H}>
      <Path
        d={`M ${arcStart.x} ${arcStart.y} A ${r-8} ${r-8} 0 0 1 ${arcEnd.x} ${arcEnd.y}`}
        stroke="rgba(255,255,255,0.15)" strokeWidth={2} fill="none" strokeLinecap="round"
      />
      {ticks.map((t) => (
        <Line key={t.kg}
          x1={t.o.x} y1={t.o.y} x2={t.i.x} y2={t.i.y}
          stroke={
            t.isMajor ? "rgba(255,255,255,0.9)"
            : t.isMid ? "rgba(255,255,255,0.5)"
            :            "rgba(255,255,255,0.2)"
          }
          strokeWidth={t.isMajor ? 2 : 1}
          strokeLinecap="round"
        />
      ))}
      {ticks.filter(t => t.isMajor).map((t) => (
        <SvgText key={`lbl-${t.kg}`}
          x={t.lp.x} y={t.lp.y}
          textAnchor="middle" alignmentBaseline="middle"
          fontSize={11} fill="rgba(255,255,255,0.75)" fontWeight="700"
        >
          {t.kg}
        </SvgText>
      ))}
      <Line x1={cx} y1={4} x2={cx} y2={18} stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
      <Circle cx={cx} cy={18} r={5}   fill="#fff" />
      <Circle cx={cx} cy={18} r={2.5} fill={PURPLE} />
    </Svg>
  );
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
const CalorieCalculator = () => {
  const navigation = useNavigation();

  // ── state (defaults used only if nothing is stored) ──
  const [gender,   setGender]        = useState("female");
  const [weightKg, setWeightKgState] = useState(55);
  const [heightIn, setHeightIn]      = useState(66);
  const [ageVal,   setAgeVal]        = useState(25);
  const [activity, setActivity]      = useState(2);
  const [calories, setCalories]      = useState({ lose: null, maintain: null, gain: null });
  const [loaded,   setLoaded]        = useState(false);

  const animatedKg = useRef(new Animated.Value(55)).current;

  // ── Restore all state on mount ──
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (saved.gender)   setGender(saved.gender);
          if (saved.weightKg) { setWeightKgState(saved.weightKg); animatedKg.setValue(saved.weightKg); }
          if (saved.heightIn) setHeightIn(saved.heightIn);
          if (saved.ageVal)   setAgeVal(saved.ageVal);
          if (typeof saved.activity === "number") setActivity(saved.activity);
          if (saved.calories) setCalories(saved.calories);
        } catch (_) { /* corrupt data — ignore, use defaults */ }
      }
      setLoaded(true);
    });
  }, []);

  // ── Persist everything ──
  const persistState = async (overrides = {}) => {
    const snapshot = {
      gender,
      weightKg,
      heightIn,
      ageVal,
      activity,
      calories,
      ...overrides,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  };

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

  const bmr = Math.round(calcBMR(gender, weightKg, heightIn, ageVal));

  // ── Weight pill edit ──
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
    if (!isNaN(parsed)) setWeightKg(Math.min(MAX_KG, Math.max(MIN_KG, parsed)));
    setWeightEditing(false);
    setWeightDraft("");
  };

  // ── Height edit ──
  const [heightEditing, setHeightEditing] = useState(false);
  const [heightDraft,   setHeightDraft]   = useState("");
  const heightInputRef = useRef(null);

  const openHeightInput = () => {
    setHeightDraft(inchesToFt(heightIn));
    setHeightEditing(true);
    setTimeout(() => heightInputRef.current?.focus(), 50);
  };
  const confirmHeightInput = () => {
    const raw = heightDraft.trim();
    let inches;
    if (raw.includes("'")) {
      const parts = raw.replace(/"/, "").split("'");
      inches = (parseInt(parts[0], 10) || 0) * 12 + (parseInt(parts[1], 10) || 0);
    } else {
      const parsed = parseInt(raw, 10);
      if (isNaN(parsed)) { setHeightEditing(false); setHeightDraft(""); return; }
      inches = parsed >= 100 ? Math.round(parsed / 2.54) : parsed;
    }
    setHeightIn(Math.min(MAX_IN, Math.max(MIN_IN, inches)));
    setHeightEditing(false);
    setHeightDraft("");
  };

  // ── Age edit ──
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
    if (!isNaN(parsed)) setAgeVal(Math.min(80, Math.max(10, parsed)));
    setAgeEditing(false);
    setAgeDraft("");
  };

  // ── Drag handlers ──
  const weightStartX   = useRef(0);
  const weightStartVal = useRef(weightKg);
  const heightStartY   = useRef(0);
  const heightStartVal = useRef(heightIn);

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
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder:  (_, gs) =>
      Math.abs(gs.dy) > 4,  
    onPanResponderGrant: (e) => {
      heightStartY.current   = e.nativeEvent.pageY;
      heightStartVal.current = heightIn;
    },
    onPanResponderMove: (e) => {
      const dy = heightStartY.current - e.nativeEvent.pageY;
      setHeightIn(Math.min(MAX_IN, Math.max(MIN_IN, Math.round(heightStartVal.current + dy * 0.3))));
    },
  })).current;

  // ── Calculate + persist ──
  const calculate = async () => {
    const tdee   = Math.round(bmr * ACTIVITY_MULT[activity]);
    const result = {
      lose:     Math.max(1200, tdee - 500),
      maintain: Math.max(1200, tdee),
      gain:     Math.max(1200, tdee + 300),
    };
    setCalories(result);
    await persistState({ calories: result });
    navigation.navigate("NutritionSetGoal", { calculatedCalories: result });
  };

  const heightPct = (heightIn - MIN_IN) / (MAX_IN - MIN_IN);
  const heightCm  = Math.round(heightIn * 2.54);

  // Don't render until AsyncStorage load is done to avoid flash of defaults
  if (!loaded) return <View style={s.page} />;

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
            <Text style={s.headerSub}>Set your details to estimate daily intake</Text>
          </View>
        </View>

        {/* ══ GENDER TOGGLE ══ */}
        <View style={s.genderWrap}>
          {[["female", "Female"], ["male", "Male"]].map(([g, label]) => {
            const isActive = gender === g;
            return (
              <TouchableOpacity
                key={g}
                style={[s.genderBtn, isActive && s.genderBtnActive]}
                onPress={() => setGender(g)}
                activeOpacity={0.8}
              >
                {isActive ? (
                  <LinearGradient
                    colors={[PURPLE_MID, PURPLE]}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    style={s.genderBtnGrad}
                  >
                    <Feather name="user" size={13} color="#fff" style={{ marginRight: 6 }} />
                    <Text weight="700" style={s.genderTxtActive}>{label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={s.genderBtnInner}>
                    <Feather name="user" size={13} color={PURPLE_MID} style={{ marginRight: 6 }} />
                    <Text weight="600" style={s.genderTxt}>{label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ══ HERO METRICS ROW ══ */}
        <View style={s.metricsRow}>

          {/* ── HEIGHT CARD ── */}
          <View style={s.heightCard} {...heightPan.panHandlers}>
            <View style={s.heightCardTop}>
              <Text style={s.metricCardLabel}>HEIGHT</Text>
              <TouchableOpacity onPress={openHeightInput} activeOpacity={0.75}>
                {heightEditing ? (
                  <View style={s.heightEditRow}>
                    <TextInput
                      ref={heightInputRef}
                      style={s.heightEditInput}
                      value={heightDraft}
                      onChangeText={setHeightDraft}
                      keyboardType="default"
                      returnKeyType="done"
                      maxLength={6}
                      selectTextOnFocus
                      onSubmitEditing={confirmHeightInput}
                    />
                    <TouchableOpacity onPress={confirmHeightInput} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
                      <Feather name="check" size={14} color={PURPLE} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.heightValueRow}>
                    <Text weight="800" style={s.heightFt}>{inchesToFt(heightIn)}</Text>
                    <Feather name="edit-2" size={10} color={PURPLE_MID} style={{ marginLeft: 4, marginTop: 4 }} />
                  </View>
                )}
                <Text style={s.heightCm}>{heightCm} cm</Text>
              </TouchableOpacity>
            </View>

            <View style={s.heightFigureWrap}>
              {gender === "female"
                ? <FemaleFigure heightPct={heightPct} />
                : <MaleFigure   heightPct={heightPct} />
              }
            </View>

            <View style={s.rulerStrip}>
              <Text style={s.rulerMark}>7'</Text>
              <View style={s.rulerTrack}>
                <View style={[s.rulerFill, { height: `${heightPct * 100}%` }]} />
              </View>
              <Text style={s.rulerMark}>4'</Text>
            </View>

            <View style={s.dragHintRow}>
              <Feather name="chevron-up"   size={10} color={PURPLE_LITE} />
              <Feather name="chevron-down" size={10} color={PURPLE_LITE} />
              <Text style={s.dragHintTxt}>drag</Text>
            </View>
          </View>

          {/* ── AGE + BMR COLUMN ── */}
          <View style={s.ageCol}>
            <TouchableOpacity style={s.ageCard} onPress={openAgeInput} activeOpacity={0.8}>
              <Text style={s.metricCardLabel}>AGE</Text>
              {ageEditing ? (
                <View style={s.ageEditRow}>
                  <TextInput
                    ref={ageInputRef}
                    style={s.ageEditInput}
                    value={ageDraft}
                    onChangeText={setAgeDraft}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    maxLength={2}
                    selectTextOnFocus
                    onSubmitEditing={confirmAgeInput}
                  />
                  <TouchableOpacity onPress={confirmAgeInput} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
                    <Feather name="check" size={14} color={PURPLE} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.ageValueRow}>
                  <Text weight="800" style={s.ageBigNum}>{ageVal}</Text>
                  <Feather name="edit-2" size={10} color={PURPLE_MID} style={{ marginLeft: 4, marginTop: 8 }} />
                </View>
              )}
              <Text style={s.ageUnit}>years old</Text>
            </TouchableOpacity>

            <View style={s.bmrCard}>
              <Text style={s.bmrLabel}>BMR</Text>
              <Text weight="800" style={s.bmrValue}>{bmr.toLocaleString()}</Text>
              <Text style={s.bmrUnit}>kcal base</Text>
            </View>
          </View>

        </View>

        {/* ══ WEIGHT DIAL CARD ══ */}
        <View style={s.dialCard}>
          <Text style={s.dialCardLabel}>WEIGHT — drag to adjust</Text>
          <View {...weightPan.panHandlers} style={s.dialSvgWrap}>
            <WeightDial animatedKg={animatedKg} />
          </View>
          <TouchableOpacity style={s.weightPill} onPress={openWeightInput} activeOpacity={0.8}>
            {weightEditing ? (
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
                <Text style={s.weightPillUnit}>kg</Text>
                <TouchableOpacity onPress={confirmWeightInput} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
                  <Feather name="check" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.weightPillRow}>
                <Text weight="800" style={s.weightPillNum}>{weightKg}</Text>
                <Text style={s.weightPillUnit}>kg</Text>
                <Feather name="edit-2" size={13} color="rgba(255,255,255,0.6)" style={{ marginLeft: 4, marginTop: 4 }} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ══ ARCH / BOTTOM SECTION ══ */}
        <View style={s.archSection}>

          {/* ── Goal card ── */}
          <View style={s.goalCard}>
            <Text weight="700" style={s.sectionTitle}>Estimated Daily Calories</Text>
            <View style={s.goalTabs}>
              {[
                { key: "lose",     label: "To Lose" },
                { key: "maintain", label: "Maintain", highlight: true },
                { key: "gain",     label: "To Gain" },
              ].map(({ key, label, highlight }) => (
                <View key={key} style={[s.goalTab, highlight && s.goalTabHighlight]}>
                  <Text style={[s.goalTabLabel, highlight && s.goalTabLabelHighlight]}>{label}</Text>
                  <Text weight="800" style={[s.goalTabValue, highlight && s.goalTabValueHighlight]}>
                    {calories[key] !== null ? calories[key] : "–"}
                  </Text>
                  <Text style={[s.goalTabUnit, highlight && s.goalTabUnitHighlight]}>kcal</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Activity selector ── */}
          <View style={s.activityCard}>
            <View style={s.activityHeader}>
              <Text weight="700" style={s.sectionLabel}>Activity Level</Text>
              <View style={s.sliderPill}>
                <Text weight="800" style={s.sliderPillVal}>
                  {ACTIVITY_LABELS[activity].replace("\n", " ")}
                </Text>
              </View>
            </View>
            <ActivitySelector value={activity} onChange={setActivity} />
          </View>

          <View style={s.divider} />

          <TouchableOpacity style={s.calcBtn} onPress={calculate} activeOpacity={0.88}>
            <Text weight="700" style={s.calcBtnTxt}>Calculate Calories</Text>
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
const CARD_RADIUS = 20;
const METRIC_W    = (width - 16 * 2 - 10) / 2;

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },

  header: {
    backgroundColor: "#fff",
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingTop: STATUS_H, paddingBottom: 16, paddingHorizontal: 16,
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

  genderWrap: {
    flexDirection: "row",
    margin: 16, marginBottom: 12,
    backgroundColor: PURPLE_SOFT,
    borderRadius: 14, padding: 4, gap: 4,
  },
  genderBtn:       { flex: 1, height: 40, borderRadius: 11, overflow: "hidden" },
  genderBtnActive: {},
  genderBtnGrad:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  genderBtnInner:  { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", height: 40 },
  genderTxt:       { fontSize: 14, color: PURPLE_MID },
  genderTxtActive: { fontSize: 14, color: "#fff" },

  metricsRow: {
    flexDirection: "row",
    marginHorizontal: 16, gap: 10, marginBottom: 12,
  },

  heightCard: {
    width: METRIC_W,
    backgroundColor: "#fff",
    borderRadius: CARD_RADIUS,
    borderWidth: 1.5,
    borderColor: "rgba(85,63,181,0.10)",
    padding: 14,
    overflow: "hidden",
    position: "relative",
    minHeight: 200,
  },
  heightCardTop:    { zIndex: 2 },
  metricCardLabel:  { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, color: PURPLE_MID, marginBottom: 6 },
  heightValueRow:   { flexDirection: "row", alignItems: "flex-end" },
  heightFt:         { fontSize: 26, color: PURPLE_DEEP },
  heightCm:         { fontSize: 11, color: PURPLE_MID, marginTop: 2, fontWeight: "600" },
  heightEditRow:    { flexDirection: "row", alignItems: "center", gap: 6 },
  heightEditInput:  { fontSize: 22, fontWeight: "700", color: PURPLE_DEEP, minWidth: 60, padding: 0 },
  heightFigureWrap: { position: "absolute", bottom: 0, left: 0, right: 32, alignItems: "center", zIndex: 1 },

  rulerStrip: {
    position: "absolute", right: 12, top: 10, bottom: 10,
    width: 20, alignItems: "center", justifyContent: "space-between",
  },
  rulerMark:  { fontSize: 8, fontWeight: "700", color: PURPLE_LITE },
  rulerTrack: { flex: 1, width: 8, backgroundColor: PURPLE_SOFT, borderRadius: 4, overflow: "hidden", justifyContent: "flex-end", marginVertical: 4 },
  rulerFill:  { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: PURPLE, borderRadius: 4 },

  dragHintRow: {
    position: "absolute", bottom: 10, left: 0, right: 32,
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 2, zIndex: 3,
  },
  dragHintTxt: { fontSize: 9, color: PURPLE_LITE, fontWeight: "600" },

  ageCol:  { flex: 1, gap: 10 },
  ageCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: CARD_RADIUS,
    borderWidth: 1.5,
    borderColor: "rgba(85,63,181,0.10)",
    padding: 14,
    justifyContent: "space-between",
  },
  ageValueRow:  { flexDirection: "row", alignItems: "flex-end" },
  ageBigNum:    { fontSize: 44, color: PURPLE_DEEP, lineHeight: 48 },
  ageUnit:      { fontSize: 11, color: PURPLE_MID, fontWeight: "600", marginTop: 2 },
  ageEditRow:   { flexDirection: "row", alignItems: "center", gap: 6 },
  ageEditInput: { fontSize: 38, fontWeight: "800", color: PURPLE_DEEP, minWidth: 60, padding: 0 },

  bmrCard: { backgroundColor: PURPLE_SOFT, borderRadius: 16, padding: 14 },
  bmrLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, color: PURPLE_MID, marginBottom: 4 },
  bmrValue: { fontSize: 22, color: PURPLE },
  bmrUnit:  { fontSize: 10, color: PURPLE_MID, fontWeight: "600", marginTop: 2 },

  dialCard: {
    backgroundColor: PURPLE,
    marginHorizontal: 16,
    borderRadius: CARD_RADIUS,
    paddingTop: 16,
    paddingBottom: 52,
    overflow: "hidden",
    position: "relative",
    marginBottom: 12,
  },
  dialCardLabel: {
    fontSize: 10, fontWeight: "700", letterSpacing: 0.8,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center", marginBottom: 6,
  },
  dialSvgWrap: { alignItems: "center" },
  weightPill: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    left: "50%",
    transform: [{ translateX: -70 }],
    width: 140,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 40,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  weightPillRow:   { flexDirection: "row", alignItems: "baseline", gap: 4 },
  weightPillNum:   { fontSize: 28, color: "#fff" },
  weightPillUnit:  { fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: "600" },
  weightPillInput: { fontSize: 28, fontWeight: "800", color: "#fff", minWidth: 60, textAlign: "center", padding: 0 },

  archSection: {
    backgroundColor: PURPLE_SOFT,
    borderRadius: 28,
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionTitle: { fontSize: 12, color: PURPLE_DEEP, letterSpacing: 0.3, marginBottom: 14 },
  sectionLabel: { fontSize: 12, color: PURPLE_DEEP, textTransform: "uppercase", letterSpacing: 0.6 },

  goalCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12 },
  goalTabs: { flexDirection: "row", gap: 8 },
  goalTab:  { flex: 1, backgroundColor: "#f7f5ff", borderRadius: 12, padding: 12, alignItems: "center" },
  goalTabHighlight:      { backgroundColor: PURPLE },
  goalTabLabel:          { fontSize: 10, color: PURPLE_MID, fontWeight: "600", marginBottom: 6 },
  goalTabLabelHighlight: { color: "rgba(255,255,255,0.65)" },
  goalTabValue:          { fontSize: 17, color: PURPLE, fontWeight: "800" },
  goalTabValueHighlight: { color: "#fff" },
  goalTabUnit:           { fontSize: 9, color: PURPLE_MID, fontWeight: "600", marginTop: 2 },
  goalTabUnitHighlight:  { color: "rgba(255,255,255,0.5)" },

  activityCard:   { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12 },
  activityHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sliderPill:     { backgroundColor: PURPLE_SOFT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  sliderPillVal:  { fontSize: 12, color: PURPLE },

  divider: {
    width: "100%", height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(85,63,181,0.15)", marginBottom: 16,
  },
  calcBtn: {
    width: "100%", backgroundColor: PURPLE,
    borderRadius: 16, paddingVertical: 18, alignItems: "center",
    shadowColor: PURPLE, shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 }, elevation: 6,
  },
  calcBtnTxt: { color: "#fff", fontSize: 17, letterSpacing: 0.3 },
});