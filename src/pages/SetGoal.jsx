/**
 * SetGoal.jsx — Premium redesign
 * Dark hero, properly sized draggable clock, removed debug console.log,
 * clean modal, animated submit button. All logic preserved exactly.
 */

import React, { useState, useRef, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  Dimensions,
  Modal,
  TextInput,
  ScrollView,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import Svg, { Circle, Path, Line, Text as SvgText } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../components/TextWrapper";
import { C } from "../theme";

const { width } = Dimensions.get("window");

// SVG dial constants — size the SVG to match its container exactly
const DIAL_SIZE = Math.min(width * 0.78, 300);
const RADIUS = DIAL_SIZE * 0.4;
const CENTER = DIAL_SIZE / 2;
const MAX_CALORIE = 5500;

const CalorieGoalRN = () => {
  const navigation = useNavigation();

  const [endCalorie, setEndCalorie] = useState(2000);
  const [dragging, setDragging] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editValue, setEditValue] = useState("");

  const calorieRef = useRef(2000);
  const rafRef = useRef(null);
  const btnScale = useRef(new Animated.Value(1)).current;

  // ── Arc math (unchanged logic) ─────────────────
  const startCalorie = 0;
  const consumed = (endCalorie - startCalorie + MAX_CALORIE) % MAX_CALORIE;

  const calorieToRadians = useCallback(
    (cal) => ((cal % MAX_CALORIE) / MAX_CALORIE) * 2 * Math.PI - Math.PI / 2,
    [],
  );

  const startAngle = calorieToRadians(startCalorie);
  const endAngle = calorieToRadians(endCalorie);

  const startPos = {
    x: CENTER + Math.cos(startAngle) * RADIUS,
    y: CENTER + Math.sin(startAngle) * RADIUS,
  };
  const endPos = {
    x: CENTER + Math.cos(endAngle) * RADIUS,
    y: CENTER + Math.sin(endAngle) * RADIUS,
  };
  const largeArcFlag = consumed > MAX_CALORIE / 2 ? 1 : 0;
  const arcPath = `M ${startPos.x} ${startPos.y} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${endPos.x} ${endPos.y}`;

  // ── Drag handler with RAF throttle (logic unchanged) ──
  const handleDrag = useCallback(
    (evt) => {
      if (!dragging) return;
      const { locationX, locationY } = evt.nativeEvent;
      const dx = locationX - CENTER;
      const dy = locationY - CENTER;
      let angle = Math.atan2(dy, dx);
      angle = (angle + Math.PI * 2.5) % (Math.PI * 2);
      const cal = Math.round((angle / (Math.PI * 2)) * MAX_CALORIE);
      calorieRef.current = cal;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          setEndCalorie(calorieRef.current);
          rafRef.current = null;
        });
      }
    },
    [dragging],
  );

  // ── Submit (removed console.log) ──────────────
  const handleSubmit = async () => {
    Animated.sequence([
      Animated.spring(btnScale, {
        toValue: 0.96,
        useNativeDriver: true,
        speed: 40,
      }),
      Animated.spring(btnScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 40,
      }),
    ]).start();
    try {
      await AsyncStorage.setItem(
        "calorieGoalData",
        JSON.stringify({
          calorieGoal: endCalorie,
          protein_g: Math.round((endCalorie * 0.30) / 4),
          carbs_g: Math.round((endCalorie * 0.40) / 4),
          fat_g: Math.round((endCalorie * 0.30) / 9),
        }),
      );
      navigation.reset({ index: 0, routes: [{ name: "Nutrition" }] });
    } catch (e){
      console.warn("SetGoal save failed: " ,e);
    }
  };

  // ── Percent progress label ─────────────────────
  const pct = Math.round((endCalorie / MAX_CALORIE) * 100);

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
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* ══ HERO ════════════════════════════════ */}
        <LinearGradient
          colors={[C.primaryDark, C.primary, C.primaryMid]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 1 }}
          style={s.hero}
        >
          <View style={s.topBar}>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.75}
            >
              <Feather name="arrow-left" size={18} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text weight="800" style={s.heroTitle}>
                Set Calorie Goal
              </Text>
              <Text style={s.heroSub}>
                Drag the handle to adjust your daily target
              </Text>
            </View>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => {
                setEditValue(endCalorie.toString());
                setEditVisible(true);
              }}
              activeOpacity={0.75}
            >
              <Feather name="edit-2" size={17} color="#fff" />
            </TouchableOpacity>
          </View>
          {/* space for dial overlap */}
          <View style={{ height: DIAL_SIZE * 0.55 }} />
        </LinearGradient>

        {/* ══ DIAL CARD ════════════════════════════ */}
        <View style={s.dialCard}>
          <Svg
            width={DIAL_SIZE}
            height={DIAL_SIZE}
            onStartShouldSetResponder={() => true}
            onResponderMove={handleDrag}
            onResponderRelease={() => setDragging(false)}
          >
            {/* Track ring */}
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              stroke={C.border}
              strokeWidth={30}
              fill="none"
            />

            {/* Tick marks */}
            {Array.from({ length: 55 }).map((_, i) => {
              const a = (i / 55) * 2 * Math.PI;
              const x1 = CENTER + Math.cos(a - Math.PI / 2) * (RADIUS - 8);
              const y1 = CENTER + Math.sin(a - Math.PI / 2) * (RADIUS - 8);
              const x2 =
                CENTER +
                Math.cos(a - Math.PI / 2) * (RADIUS - (i % 5 === 0 ? 18 : 13));
              const y2 =
                CENTER +
                Math.sin(a - Math.PI / 2) * (RADIUS - (i % 5 === 0 ? 18 : 13));
              return (
                <Line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={i % 5 === 0 ? "#CBD5E1" : "#E2E8F0"}
                  strokeWidth={i % 5 === 0 ? 2.5 : 1.5}
                />
              );
            })}

            {/* Active arc */}
            <Path
              d={arcPath}
              stroke={C.primaryLight}
              strokeWidth={23}
              strokeLinecap="round"
              fill="none"
            />

            {/* Start dot */}
            <Circle
              cx={startPos.x}
              cy={startPos.y}
              r={12}
              fill={C.primaryDark}
              stroke="#fff"
              strokeWidth={4}
            />
            <SvgText
              x={startPos.x}
              y={startPos.y + 5}
              textAnchor="middle"
              fontSize={15}
            >
              🔥
            </SvgText>

            {/* Drag handle */}
            <Circle
              cx={endPos.x}
              cy={endPos.y}
              r={14}
              fill={C.primaryLight}
              stroke="#fff"
              strokeWidth={4}
              onPressIn={() => setDragging(true)}
            />
            <SvgText
              x={endPos.x}
              y={endPos.y + 5}
              textAnchor="middle"
              fontSize={13}
            >
              🍽
            </SvgText>
          </Svg>

          {/* Center info */}
          <View style={s.dialCenter}>
            <Text weight="800" style={s.dialKcal}>
              {consumed.toLocaleString()}
            </Text>
            <Text style={s.dialKcalUnit}>kcal</Text>
            <View style={s.dialGoalRow}>
              <Text style={s.dialGoalLabel}>Goal: </Text>
              <Text weight="700" style={s.dialGoalVal}>
                {endCalorie.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* ══ PRESET CHIPS ════════════════════════ */}
        <View style={s.presetsSection}>
          <Text weight="600" style={s.presetsLabel}>
            Quick Presets
          </Text>
          <View style={s.presetsRow}>
            {[1500, 2000, 2500, 3000].map((cal) => (
              <TouchableOpacity
                key={cal}
                style={[s.presetChip, endCalorie === cal && s.presetChipActive]}
                onPress={() => {
                  setEndCalorie(cal);
                  calorieRef.current = cal;
                }}
                activeOpacity={0.75}
              >
                <Text
                  weight="600"
                  style={[
                    s.presetChipTxt,
                    endCalorie === cal && s.presetChipTxtActive,
                  ]}
                >
                  {cal}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ══ INFO CARD ════════════════════════════ */}
        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <View
              style={[
                s.infoItem,
                { borderRightWidth: 1, borderRightColor: C.border },
              ]}
            >
              <Text weight="800" style={s.infoVal}>
                {endCalorie}
              </Text>
              <Text style={s.infoLabel}>Daily Target</Text>
            </View>
            <View style={s.infoItem}>
              <Text weight="800" style={s.infoVal}>
                {pct}%
              </Text>
              <Text style={s.infoLabel}>of Max ({MAX_CALORIE})</Text>
            </View>
          </View>
          <Text style={s.infoHint}>
            Average adult needs 1,600 – 3,000 kcal/day depending on activity
            level.
          </Text>
        </View>
      </ScrollView>

      {/* ══ SUBMIT BAR ═══════════════════════════ */}
      <View style={s.submitBar}>
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity onPress={handleSubmit} activeOpacity={0.9}>
            <LinearGradient
              colors={[C.primaryLight, C.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.submitBtn}
            >
              <Text weight="700" style={s.submitBtnTxt}>
                Set My Goal
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ══ EDIT MODAL ═══════════════════════════ */}
      <Modal
        visible={editVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text weight="700" style={s.modalTitle}>
              Enter Calorie Goal
            </Text>
            <TextInput
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="numeric"
              placeholder={`0 – ${MAX_CALORIE}`}
              placeholderTextColor={C.textMuted}
              style={s.modalInput}
              autoFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => setEditVisible(false)}
              >
                <Text weight="600" style={s.modalCancelTxt}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalSaveBtn}
                onPress={() => {
                  const val = parseInt(editValue, 10);
                  if (!isNaN(val) && val >= 0 && val <= MAX_CALORIE) {
                    setEndCalorie(val);
                    calorieRef.current = val;
                  }
                  setEditVisible(false);
                }}
              >
                <LinearGradient
                  colors={[C.primaryLight, C.primaryDark]}
                  style={s.modalSaveBtnInner}
                >
                  <Text weight="700" style={s.modalSaveTxt}>
                    Save
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default CalorieGoalRN;

// ── Styles ─────────────────────────────────────────
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 56 : 38,
    paddingBottom: 20,
  },
  topBar: { flexDirection: "row", alignItems: "flex-start" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: "#fff", fontSize: 22, marginBottom: 2 },
  heroSub: { color: "rgba(255,255,255,0.7)", fontSize: 13 },

  // Dial card
  dialCard: {
    alignSelf: "center",
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: (DIAL_SIZE + 40) / 2,
    backgroundColor: C.surface,
    marginTop: -(DIAL_SIZE * 0.55),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  dialCenter: { position: "absolute", alignItems: "center" },
  dialKcal: { fontSize: Math.min(DIAL_SIZE * 0.13, 36), color: C.primaryLight },
  dialKcalUnit: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  dialGoalRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  dialGoalLabel: { fontSize: 12, color: C.textMuted },
  dialGoalVal: { fontSize: 13, color: C.textSub },

  // Presets
  presetsSection: { paddingHorizontal: 20, marginTop: 24 },
  presetsLabel: { fontSize: 14, color: C.textSub, marginBottom: 10 },
  presetsRow: { flexDirection: "row", gap: 8 },
  presetChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.surface,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.border,
  },
  presetChipActive: {
    backgroundColor: C.primary + "15",
    borderColor: C.primary,
  },
  presetChipTxt: { fontSize: 14, color: C.textSub },
  presetChipTxtActive: { color: C.primary },

  // Info card
  infoCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: "hidden",
  },
  infoRow: { flexDirection: "row" },
  infoItem: { flex: 1, alignItems: "center", paddingVertical: 16 },
  infoVal: { fontSize: 22, color: C.text, marginBottom: 2 },
  infoLabel: { fontSize: 12, color: C.textMuted },
  infoHint: {
    fontSize: 12,
    color: C.textMuted,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    lineHeight: 18,
  },

  // Submit bar
  submitBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 30 : 18,
    borderTopWidth: 1,
    borderTopColor: C.border,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 6,
  },
  submitBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  submitBtnTxt: { color: "#fff", fontSize: 17 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 24,
    width: "84%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  modalTitle: { fontSize: 18, color: C.text, marginBottom: 14 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    color: C.text,
    marginBottom: 18,
    backgroundColor: C.bg,
  },
  modalActions: { flexDirection: "row", gap: 10 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.bg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  modalCancelTxt: { fontSize: 15, color: C.textSub },
  modalSaveBtn: { flex: 1, borderRadius: 12, overflow: "hidden" },
  modalSaveBtnInner: { paddingVertical: 12, alignItems: "center" },
  modalSaveTxt: { color: "#fff", fontSize: 15 },
});