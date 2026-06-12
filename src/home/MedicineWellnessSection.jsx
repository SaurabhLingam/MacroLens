import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Pressable,
  Alert,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Text } from "../components/TextWrapper";
import { useFocusEffect } from "@react-navigation/native";
import WellnessHeader from "./WellnessHeader";
import WellnessChipRow from "./WellnessChipRow";
import WellnessInsightsCard from "./WellnessInsightsCard";
import useWellnessAnimation from "./useWellnessAnimation";
import shared from "./wellnessStyles";
import { ensureTodayHistory } from "../pages/MediLog/medicineHistoryUtils";



// ─── Design tokens (unchanged purple system) ──────────────────────────────────
const P = {
  primary:     "#553FB5",
  primaryDark: "#3D2D8F",
  primaryMid:  "#6B52C8",
  primarySoft: "#8B72E0",
  ghostLight:  "#F0ECFF",
  ghostMid:    "#DCECFF",
  ghostBorder: "#C8B8FF",
  teal:        "#22C5AC",
  amber:       "#F59E0B",
  red:         "#EF4444",
  green:       "#10B981",
  surface:     "#F7F5FF",
  white:       "#FFFFFF",
  text:        "#1A1235",
  textSub:     "#4A3F70",
  textMuted:   "#9488B8",
};

// ─── Time-of-day config ────────────────────────────────────────────────────────
const TOD_CONFIG = {
  morning:   { label: "Morning",   icon: "weather-sunset-up",      color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A" },
  afternoon: { label: "Afternoon", icon: "white-balance-sunny",    color: "#F97316", bg: "#FFF7ED", border: "#FED7AA" },
  evening:   { label: "Evening",   icon: "city-variant-outline",   color: P.primaryMid, bg: P.ghostLight, border: P.ghostBorder },
  night:     { label: "Night",     icon: "weather-night",          color: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE" },
};

const getTimeOfDay = (timeStr) => {
  if (!timeStr) return "morning";
  const upper = timeStr.toUpperCase();
  const isPM = upper.includes("PM");
  const isAM = upper.includes("AM");
  const h = parseInt((timeStr.split(" ")[0] || "").split(":")[0], 10);
  let hour = isNaN(h) ? 8 : h;
  if (isPM && h !== 12) hour = h + 12;
  if (isAM && h === 12) hour = 0;
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
};

// ─── Stagger animation helper ─────────────────────────────────────────────────
const StaggerItem = ({ delay = 0, children, style }) => {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 380, delay, useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0, speed: 16, bounciness: 3, delay, useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
};

// ─── Press-scale wrapper ──────────────────────────────────────────────────────
const PressScale = ({ onPress, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        activeOpacity={1}
        onPressIn={() => spring(0.96)}
        onPressOut={() => spring(1)}
        onPress={onPress}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

// ─── Adherence ring ───────────────────────────────────────────────────────────
const AdherenceRing = ({ pct = 0, size = 92, strokeW = 9 }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: pct, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [pct]);

  const color = pct >= 80 ? P.green : pct >= 50 ? P.amber : P.red;
  const label = pct >= 80 ? "Great" : pct >= 50 ? "Good" : "Low";
  const radius = (size - strokeW) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={strokeW}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeW}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={{ alignItems: "center" }}>
        <Text weight="800" style={{ fontSize: 22, color: "#fff", lineHeight: 26 }}>{pct}%</Text>
        <Text weight="500" style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", marginTop: 1 }}>{label}</Text>
      </View>
    </View>
  );
};

// ─── Section header (no action — no duplicate nav) ────────────────────────────
const SectionHead = ({ title, subtitle }) => (
  <View style={s.sectionRow}>
    <Text weight="700" style={s.sectionTitle}>{title}</Text>
    {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
  </View>
);

// ─── Quick action tile (taller, icon wrap) ────────────────────────────────────
const QuickTile = ({ iconName, title, subtitle, gradColors, titleColor, accentColor, onPress }) => (
  <PressScale onPress={onPress} style={{ flex: 1 }}>
    <View style={[s.quickTileShadow, { shadowColor: accentColor }]}>
      <TouchableOpacity activeOpacity={0.85} style={s.quickTileCard} onPress={onPress}>
        <LinearGradient
          colors={gradColors}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.quickTileGrad}
        >
          <View style={[s.quickTileIconWrap, { backgroundColor: accentColor + "1A" }]}>
            <MaterialCommunityIcons name={iconName} size={17} color={accentColor} />
          </View>
          <Text weight="700" style={[s.quickTileTitle, { color: titleColor }]}>{title}</Text>
          <Text style={s.quickTileSub}>{subtitle}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  </PressScale>
);

// ─── Stats pills row ──────────────────────────────────────────────────────────
const StatsPillRow = ({ streak, monthlyAdherence, totalMeds }) => (
  <View style={s.statsPillRow}>
    <View style={s.statsPill}>
      <MaterialCommunityIcons name="fire" size={13} color={P.amber} />
      <Text weight="700" style={[s.statsPillVal, { color: P.amber }]}>{streak}</Text>
      <Text style={s.statsPillLabel}>day streak</Text>
    </View>
    <View style={s.statsPill}>
      <MaterialCommunityIcons name="calendar-check" size={13} color={P.primary} />
      <Text weight="700" style={[s.statsPillVal, { color: P.primary }]}>{monthlyAdherence}%</Text>
      <Text style={s.statsPillLabel}>monthly</Text>
    </View>
    <View style={s.statsPill}>
      <MaterialCommunityIcons name="pill-multiple" size={13} color={P.primarySoft} />
      <Text weight="700" style={[s.statsPillVal, { color: P.primarySoft }]}>{totalMeds}</Text>
      <Text style={s.statsPillLabel}>medicines</Text>
    </View>
  </View>
);

// ─── Progress banner ──────────────────────────────────────────────────────────
const ProgressBanner = ({ taken, total }) => {
  const pct = total > 0 ? taken / total : 0;
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: pct, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [pct]);
  const color = pct >= 0.8 ? P.green : pct >= 0.5 ? P.amber : P.primary;
  const label =
    taken > 0 ? `${taken} of ${total} dose${total > 1 ? "s" : ""} taken` :
    total > 0 ? `${total} dose${total > 1 ? "s" : ""} scheduled today` :
    "All clear for today ✓";
  return (
    <View style={s.progressBanner}>
      <View style={s.progressBannerTop}>
        <Text weight="600" style={s.progressBannerText}>{label}</Text>
        <Text weight="800" style={[s.progressBannerPct, { color }]}>
          {total > 0 ? Math.round(pct * 100) : 100}%
        </Text>
      </View>
      <View style={s.progressTrack}>
        <Animated.View style={[s.progressFill, {
          backgroundColor: color,
          width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
        }]} />
      </View>
    </View>
  );
};

// ─── Next dose callout ────────────────────────────────────────────────────────
const NextDoseCallout = ({ dose }) => {
  if (!dose) return null;
  const tod = getTimeOfDay(dose.time);
  const cfg = TOD_CONFIG[tod];
  return (
    <View style={s.nextDoseCard}>
      <View style={[s.nextDoseAccentBar, { backgroundColor: cfg.color }]} />
      <View style={[s.nextDoseIcon, { backgroundColor: cfg.bg }]}>
        <MaterialCommunityIcons name="clock-fast" size={16} color={cfg.color} />
      </View>
      <View style={s.nextDoseInfo}>
        <Text weight="600" style={s.nextDoseLabel}>NEXT UP</Text>
        <Text weight="700" style={s.nextDoseName}>{dose.medicineName}</Text>
        <Text style={s.nextDoseTime}>{dose.time} · {dose.doseType}</Text>
      </View>
      <View style={[s.nextDosePill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
        <Text weight="600" style={[s.nextDosePillText, { color: cfg.color }]}>
          {cfg.label}
        </Text>
      </View>
    </View>
  );
};

// ─── Dose card ────────────────────────────────────────────────────────────────
const DoseCard = ({ dose, tod, isLast, onToggle }) => {
  const cfg = TOD_CONFIG[tod];
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handleToggle = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 50 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start(() => onToggle(dose));
  };
  const doneColor = dose.taken ? P.green : cfg.color;
  const doneBg   = dose.taken ? "#ECFDF5" : cfg.bg;
  const doneBorder = dose.taken ? "#A7F3D0" : cfg.border;
  return (
    <Animated.View
      style={[
        s.doseCard,
        !isLast && s.doseCardBorder,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <View style={[s.doseAccentBar, { backgroundColor: dose.taken ? P.green : cfg.color }]} />
      <View style={[s.doseIconCircle, { backgroundColor: doneBg }]}>
        <MaterialCommunityIcons name="pill" size={15} color={doneColor} />
      </View>
      <View style={s.doseInfo}>
        <Text weight="600" style={[s.doseName, dose.taken && s.doseNameDone]}>
          {dose.medicineName}
        </Text>
        <Text style={s.doseTime}>{dose.time} · {dose.doseType}</Text>
      </View>
      <PressScale onPress={handleToggle}>
        <View style={[s.doseBadge, { backgroundColor: doneBg, borderColor: doneBorder }]}>
          <MaterialCommunityIcons
            name={dose.taken ? "check-circle" : "circle-outline"}
            size={13}
            color={doneColor}
          />
          <Text weight="700" style={[s.doseBadgeText, { color: doneColor }]}>
            {dose.taken ? "Done" : "Mark"}
          </Text>
        </View>
      </PressScale>
    </Animated.View>
  );
};

// ─── Dose group (time-of-day section) ─────────────────────────────────────────
const DoseGroup = ({ tod, doses, onToggle }) => {
  const cfg = TOD_CONFIG[tod];
  const takenCount = doses.filter((d) => d.taken).length;
  const allDone = takenCount === doses.length;
  return (
    <View style={[s.doseGroup, allDone && s.doseGroupDone]}>
      <View style={s.doseGroupHeader}>
        <MaterialCommunityIcons name={cfg.icon} size={14} color={cfg.color} />
        <Text weight="600" style={[s.doseGroupLabel, { color: cfg.color }]}>{cfg.label}</Text>
        <View style={[s.doseGroupPill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <Text weight="700" style={[s.doseGroupCount, { color: allDone ? P.green : cfg.color }]}>
            {allDone ? "✓ All done" : `${takenCount}/${doses.length}`}
          </Text>
        </View>
      </View>
      {doses.map((dose, i) => (
        <DoseCard
          key={dose.id}
          dose={dose}
          tod={tod}
          isLast={i === doses.length - 1}
          onToggle={onToggle}
        />
      ))}
    </View>
  );
};

// ─── Low stock card (info-only — no Reorder button to avoid nav dup) ──────────
const LowStockCard = ({ meds }) => {
  if (!meds.length) return null;
  return (
    <View style={s.lowStockCard}>
      <View style={s.lowStockIconWrap}>
        <MaterialCommunityIcons name="alert-circle-outline" size={20} color={P.red} />
      </View>
      <View style={{ flex: 1 }}>
        <Text weight="700" style={s.lowStockTitle}>Low Stock Alert</Text>
        <Text style={s.lowStockSub}>
          {meds.slice(0, 2).map((m) => m.name).join(", ")}
          {meds.length > 2 ? ` +${meds.length - 2} more` : ""} · Restock via Medicine Box
        </Text>
      </View>
      <View style={s.lowStockBadge}>
        <Text weight="800" style={s.lowStockBadgeText}>{meds.length}</Text>
      </View>
    </View>
  );
};

// ─── 7-day adherence chart ────────────────────────────────────────────────────
const WeekStrip = ({ data }) => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const maxVal = Math.max(...data, 0.01);
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0
  return (
    <View style={s.weekStrip}>
      {days.map((d, i) => {
        const val = data[i] ?? 0;
        const color =
          val >= 0.8 ? P.green :
          val >= 0.5 ? P.amber :
          val > 0    ? P.primarySoft : "#E8E2FF";
        const isToday = i === todayIdx;
        return (
          <View key={i} style={s.weekCol}>
            {val > 0 && (
              <Text style={s.weekBarLabel}>{Math.round(val * 100)}%</Text>
            )}
            <View style={s.weekBarTrack}>
              <View style={[
                s.weekBar,
                {
                  height: Math.max(6, (val / maxVal) * 52),
                  backgroundColor: color,
                  opacity: isToday ? 1 : 0.72,
                },
                isToday && s.weekBarToday,
              ]} />
            </View>
            <Text
              weight={isToday ? "700" : "400"}
              style={[s.weekDay, isToday && { color: P.primary }]}
            >
              {d}
            </Text>
            {isToday && <View style={s.todayDot} />}
          </View>
        );
      })}
    </View>
  );
};

// ─── Scanner CTA card ─────────────────────────────────────────────────────────
const ScannerCard = ({ onScan, onUpload }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  return (
    <View style={s.scannerCard}>
      <LinearGradient
        colors={["#3D2D8F", "#553FB5", "#7B5FD4"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.scannerGradient}
      >
        <View style={[s.blob, { top: -30, right: -20, width: 120, height: 120, opacity: 0.15 }]} />
        <View style={[s.blob, { bottom: -20, left: -10, width: 80, height: 80, opacity: 0.1 }]} />
        <View style={s.scannerLeft}>
          <View style={s.scannerBadge}>
            <View style={s.aiBadgeDot} />
            <Text weight="700" style={s.aiBadgeText}>AI POWERED</Text>
          </View>
          <Text weight="800" style={s.scannerTitle}>Know Your{"\n"}Medicine</Text>
          <Text weight="400" style={s.scannerSub}>
            Scan or upload a photo{"\n"}for full drug details
          </Text>
          <View style={s.scannerActions}>
            <PressScale onPress={onScan}>
              <TouchableOpacity style={s.scanBtn} onPress={onScan} activeOpacity={0.85}>
                <MaterialCommunityIcons name="camera-outline" size={16} color={P.primary} />
                <Text weight="700" style={s.scanBtnText}>Scan</Text>
              </TouchableOpacity>
            </PressScale>
            <PressScale onPress={onUpload}>
              <TouchableOpacity style={s.uploadBtn} onPress={onUpload} activeOpacity={0.85}>
                <MaterialCommunityIcons name="image-plus" size={14} color="rgba(255,255,255,0.8)" />
                <Text weight="600" style={s.uploadBtnText}>Upload</Text>
              </TouchableOpacity>
            </PressScale>
          </View>
        </View>
        <View style={s.scannerRight}>
          <Animated.View style={[s.phoneMock, { transform: [{ scale: pulseAnim }] }]}>
            <View style={s.phoneSpeaker} />
            <View style={s.phoneScreen}>
              <View style={s.cornerTL} /><View style={s.cornerTR} />
              <View style={s.cornerBL} /><View style={s.cornerBR} />
              <MaterialCommunityIcons name="pill" size={28} color={P.teal} style={{ opacity: 0.9 }} />
            </View>
            <View style={s.phoneHome} />
          </Animated.View>
          <View style={s.trustRow}>
            {[["shield-check-outline", "Safe"], ["flash-outline", "Fast"], ["lock-outline", "Private"]].map(
              ([icon, lbl], i) => (
                <View key={i} style={s.trustItem}>
                  <MaterialCommunityIcons name={icon} size={11} color="rgba(255,255,255,0.6)" />
                  <Text style={s.trustLabel}>{lbl}</Text>
                </View>
              )
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

// ─── Tips card ────────────────────────────────────────────────────────────────
const TipsCard = () => (
  <View style={s.tipsCard}>
    <LinearGradient
      colors={[P.ghostLight, "#EDE8FF"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={s.tipsGradient}
    >
      <View style={s.tipsHeader}>
        <View style={s.tipsBadge}>
          <Ionicons name="bulb-outline" size={13} color={P.primary} />
        </View>
        <Text weight="700" style={s.tipsTitle}>Medicine Tip</Text>
      </View>
      <Text weight="400" style={s.tipsText}>
        Set dose reminders when adding medicines. The app tracks stock and alerts you before you
        run out, so you never miss a refill.
      </Text>
    </LinearGradient>
  </View>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function MedicineWellnessSection(props) {
  const { onBack, hideHeader = false, navigation } = props;
  const { animatedStyle } = useWellnessAnimation(["Medicine"]);

  const [todayDoses,       setTodayDoses]       = useState([]);
  const [takenCount,       setTakenCount]       = useState(0);
  const [pendingCount,     setPendingCount]     = useState(0);
  const [adherence,        setAdherence]        = useState(0);
  const [streak,           setStreak]           = useState(0);
  const [weeklyData,       setWeeklyData]       = useState(Array(7).fill(0));
  const [lowStockMeds,     setLowStockMeds]     = useState([]);
  const [totalMeds,        setTotalMeds]        = useState(0);
  const [monthlyAdherence, setMonthlyAdherence] = useState(0);
  const [nextDose,         setNextDose]         = useState(null);

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const userEmail = await AsyncStorage.getItem("currentUser");
      if (!userEmail) return;
      await ensureTodayHistory(userEmail);

      const medsRaw = await AsyncStorage.getItem(`medicines_${userEmail}`);
      const meds = medsRaw ? JSON.parse(medsRaw) : [];
      const activeMeds = meds.filter((m) => m.active !== false);
      setTotalMeds(activeMeds.length);
      setLowStockMeds(activeMeds.filter((m) => m.remainingQuantity <= (m.frequencyCount || 1) * 3));

      const histRaw = await AsyncStorage.getItem(`history_${userEmail}`);
      const history = histRaw ? JSON.parse(histRaw) : [];

      const today   = new Date().toDateString();
      const todayHist = history.filter((h) => new Date(h.scheduledTime).toDateString() === today);
      const taken   = todayHist.filter((h) => h.taken).length;
      const pending = todayHist.filter((h) => !h.taken).length;

      setTodayDoses(todayHist);
      setTakenCount(taken);
      setPendingCount(pending);
      setAdherence(taken + pending > 0 ? Math.round((taken / (taken + pending)) * 100) : 0);

      // Next pending dose (earliest time)
      const pendingDoses = todayHist.filter((h) => !h.taken);
      if (pendingDoses.length > 0) {
        const parseTime = (t = "") => {
          const up = t.toUpperCase();
          const [tp, period] = up.split(" ");
          const [hh, mm] = (tp || "").split(":").map(Number);
          let hr = isNaN(hh) ? 0 : hh;
          if (period === "PM" && hh !== 12) hr += 12;
          if (period === "AM" && hh === 12) hr = 0;
          return hr * 60 + (isNaN(mm) ? 0 : mm);
        };
        const sorted = [...pendingDoses].sort((a, b) => parseTime(a.time) - parseTime(b.time));
        setNextDose(sorted[0]);
      } else {
        setNextDose(null);
      }

      // 7-day adherence (Mon=index 0)
      const weekly = Array(7).fill(0);
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const ds = d.toDateString();
        const dayIdx = (d.getDay() + 6) % 7; // Mon=0, Sun=6
        const dayHist = history.filter((h) => new Date(h.scheduledTime).toDateString() === ds);
        if (dayHist.length > 0) {
          weekly[dayIdx] = dayHist.filter((h) => h.taken).length / dayHist.length;
        }
      }
      setWeeklyData(weekly);

      // Monthly adherence (last 30 days)
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthHist = history.filter((h) => new Date(h.scheduledTime) >= monthAgo);
      const mTaken = monthHist.filter((h) => h.taken).length;
      setMonthlyAdherence(monthHist.length > 0 ? Math.round((mTaken / monthHist.length) * 100) : 0);

      // Streak
      const takenDays = [
        ...new Set(
          history
            .filter((h) => h.taken)
            .map((h) => new Date(h.takenAt || h.scheduledTime).toDateString())
        ),
      ].sort((a, b) => new Date(b) - new Date(a));
      let s = 0;
      const check = new Date();
      for (const day of takenDays) {
        if (day === check.toDateString()) { s++; check.setDate(check.getDate() - 1); }
        else break;
      }
      setStreak(s);
    } catch (_) {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );


  // ── Toggle dose ───────────────────────────────────────────────────────────
  const toggleDose = useCallback(async (dose) => {
    try {
      const userEmail = await AsyncStorage.getItem("currentUser");
      if (!userEmail) return;
      const histRaw = await AsyncStorage.getItem(`history_${userEmail}`);
      const history = JSON.parse(histRaw || "[]");
      const idx = history.findIndex((h) => h.id === dose.id);
      if (idx === -1) return;
      const wasTaken = history[idx].taken;
      history[idx].taken  = !wasTaken;
      history[idx].takenAt = !wasTaken ? new Date().toISOString() : null;
      await AsyncStorage.setItem(`history_${userEmail}`, JSON.stringify(history));

      // update remainingQuantity
      const medsRaw2 = await AsyncStorage.getItem(`medicines_${userEmail}`);
      const meds2 = JSON.parse(medsRaw2 || "[]");
      const mIdx = meds2.findIndex((m) => m.id === history[idx].medicineId);
      if (mIdx !== -1) {
        meds2[mIdx].remainingQuantity = Math.max(
          0,
          (meds2[mIdx].remainingQuantity || 0) + (wasTaken ? 1 : -1)
        );
        await AsyncStorage.setItem(`medicines_${userEmail}`, JSON.stringify(meds2));
      }
      loadData();
    } catch (_) {}
  }, [loadData]);

  // ── Group doses by time-of-day ────────────────────────────────────────────
  const groupedDoses = useMemo(() => {
    const groups = { morning: [], afternoon: [], evening: [], night: [] };
    todayDoses.forEach((dose) => {
      const tod = getTimeOfDay(dose.time);
      groups[tod].push(dose);
    });
    return groups;
  }, [todayDoses]);

  const hasDoses = todayDoses.length > 0;
  const nav = useCallback((route) => navigation?.navigate?.(route), [navigation]);

  const handleUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission needed", "Camera roll access is required."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images", allowsEditing: true, aspect: [4, 3], quality: 0.3,
      });
      if (!result.canceled && result.assets?.length > 0) {
        navigation.navigate("MediTrackResult", { imageUri: result.assets[0].uri });
      }
    } catch (error) { Alert.alert("Error", "Failed to upload image: " + error.message); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={shared.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[shared.scrollContent, s.scrollInner]}
      >
        {!hideHeader && <WellnessHeader onBack={onBack} />}
        {!hideHeader && <WellnessChipRow currentCategory="Medicine" navProps={props} />}

        {/* ── Hero gradient band ──────────────────────────────────────────── */}
        <LinearGradient
          colors={["#DCECFF", "rgba(220,236,255,0.55)", "rgba(243,239,235,0)"]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={s.heroBand}
        >
          {/* Hero card */}
          <StaggerItem delay={0}>
            <View style={s.heroCard}>
              <LinearGradient
                colors={[P.primary, P.primaryDark]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.heroCardGradient}
              >
                <View style={[s.blob, { top: -24, right: -16, width: 100, height: 100, opacity: 0.18 }]} />
                <View style={[s.blob, { bottom: -20, left: -8, width: 72, height: 72, opacity: 0.12 }]} />

                <View style={s.heroLeft}>
                  <Text weight="700" style={s.heroGreeting}>Today's Medicines</Text>
                  <Text weight="400" style={s.heroDate}>
                    {new Date().toLocaleDateString("en-IN", {
                      weekday: "long", day: "numeric", month: "short",
                    })}
                  </Text>
                  <View style={s.heroStatsRow}>
                    <View style={s.heroStat}>
                      <Text weight="800" style={[s.heroStatNum, { color: P.green }]}>{takenCount}</Text>
                      <Text weight="500" style={s.heroStatLabel}>Taken</Text>
                    </View>
                    <View style={s.heroStatDivider} />
                    <View style={s.heroStat}>
                      <Text weight="800" style={[s.heroStatNum, { color: P.amber }]}>{pendingCount}</Text>
                      <Text weight="500" style={s.heroStatLabel}>Pending</Text>
                    </View>
                    <View style={s.heroStatDivider} />
                    <View style={s.heroStat}>
                      <Text weight="800" style={[s.heroStatNum, { color: "#C8B8FF" }]}>{totalMeds}</Text>
                      <Text weight="500" style={s.heroStatLabel}>Active</Text>
                    </View>
                  </View>
                  {streak > 0 && (
                    <View style={s.streakBadge}>
                      <MaterialCommunityIcons name="fire" size={13} color={P.amber} />
                      <Text weight="600" style={s.streakText}>{streak}-day streak</Text>
                    </View>
                  )}
                </View>

                <View style={s.heroRight}>
                  <AdherenceRing pct={adherence} size={88} strokeW={8} />
                  <Text weight="500" style={s.adherenceLabel}>Adherence</Text>
                </View>
              </LinearGradient>
            </View>
          </StaggerItem>

          {/* Stats pills */}
          <StaggerItem delay={60}>
            <StatsPillRow
              streak={streak}
              monthlyAdherence={monthlyAdherence}
              totalMeds={totalMeds}
            />
          </StaggerItem>

          {/* Quick tiles */}
          <StaggerItem delay={100}>
            <View style={s.quickRow}>
              <QuickTile
                iconName="plus-circle-outline"
                title="Add Medicine"
                subtitle="Log with reminders"
                gradColors={["#FFFFFF", "#F0ECFF"]}
                titleColor={P.primary}
                accentColor={P.primary}
                onPress={() => nav("LogNewMedicine")}
              />
              <QuickTile
                iconName="history"
                title="History"
                subtitle="Review intake log"
                gradColors={["#FFFFFF", "#F0F9FF"]}
                titleColor="#2563EB"
                accentColor="#2563EB"
                onPress={() => nav("MedHistory")}
              />
              <QuickTile
                iconName="pill-multiple"
                title="Medicine Box"
                subtitle="All medicines"
                gradColors={["#FFFFFF", "#FFF0F0"]}
                titleColor="#EF4444"
                accentColor="#EF4444"
                onPress={() => nav("MedicineBox")}
              />
            </View>
          </StaggerItem>
        </LinearGradient>

        {/* ── Low stock alert (info-only) ─────────────────────────────────── */}
        {lowStockMeds.length > 0 && (
          <StaggerItem delay={120}>
            <View style={s.section}>
              <LowStockCard meds={lowStockMeds} />
            </View>
          </StaggerItem>
        )}

        {/* ── Today's schedule ────────────────────────────────────────────── */}
        <StaggerItem delay={150}>
          <View style={s.section}>
            <SectionHead
              title="Today's Schedule"
              subtitle={hasDoses ? `${takenCount} of ${todayDoses.length} completed` : undefined}
            />

            {hasDoses ? (
              <>
                <ProgressBanner taken={takenCount} total={todayDoses.length} />
                {pendingCount > 0 && nextDose && <NextDoseCallout dose={nextDose} />}
                <View style={s.dosesContainer}>
                  {(["morning", "afternoon", "evening", "night"]).map((tod) =>
                    groupedDoses[tod].length > 0 ? (
                      <DoseGroup
                        key={tod}
                        tod={tod}
                        doses={groupedDoses[tod]}
                        onToggle={toggleDose}
                      />
                    ) : null
                  )}
                </View>
              </>
            ) : (
              <View style={s.emptyDoses}>
                <View style={s.emptyDosesIcon}>
                  <MaterialCommunityIcons name="pill" size={30} color={P.textMuted} />
                </View>
                <Text weight="600" style={s.emptyDosesTitle}>No doses today</Text>
                <Text style={s.emptyDosesText}>
                  Use "Add Medicine" above to start tracking your doses.
                </Text>
              </View>
            )}
          </View>
        </StaggerItem>

        {/* ── 7-day adherence ─────────────────────────────────────────────── */}
        <StaggerItem delay={200}>
          <View style={s.section}>
            <SectionHead title="7-Day Adherence" />
            <View style={s.weekCard}>
              <WeekStrip data={weeklyData} />
              <View style={s.weekLegend}>
                {[
                  [P.green,      "≥ 80%"],
                  [P.amber,      "50 – 79%"],
                  [P.primarySoft,"< 50%"],
                  ["#E8E2FF",    "None"],
                ].map(([color, label], i) => (
                  <View key={i} style={s.weekLegendItem}>
                    <View style={[s.weekLegendDot, { backgroundColor: color }]} />
                    <Text style={s.weekLegendTxt}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </StaggerItem>

        {/* ── AI Medicine Scanner ─────────────────────────────────────────── */}
        <StaggerItem delay={240}>
          <View style={s.section}>
            <SectionHead title="Medicine Scanner" />
            <ScannerCard
              onScan={() => nav("MediTrackScanner")}
              onUpload={handleUpload}
            />
          </View>
        </StaggerItem>

        {/* ── Medicine tip ────────────────────────────────────────────────── */}
        <StaggerItem delay={280}>
          <View style={s.section}>
            <TipsCard />
          </View>
        </StaggerItem>




        {/* ── Wellness Insights ───────────────────────────────────────────── */}
        <Animated.View style={animatedStyle}>
          <WellnessInsightsCard style={{ marginBottom: 24 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

export default React.memo(MedicineWellnessSection);

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scrollInner: { paddingBottom: 32 },

  // ── Hero band
  heroBand: {
    marginTop: -2,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },

  // ── Hero card
  heroCard: {
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  heroCardGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 22,
    minHeight: 152,
    overflow: "hidden",
  },
  blob: { position: "absolute", borderRadius: 999, backgroundColor: "#FFFFFF" },
  heroLeft: { flex: 1, paddingRight: 12 },
  heroGreeting: { fontSize: 16, color: "#fff", letterSpacing: 0.2 },
  heroDate: { fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 14, marginTop: 2 },
  heroStatsRow: { flexDirection: "row", alignItems: "center" },
  heroStat: { alignItems: "center", paddingHorizontal: 10 },
  heroStatNum: { fontSize: 24, lineHeight: 28 },
  heroStatLabel: { fontSize: 9.5, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  heroStatDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.18)" },
  streakBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginTop: 14, alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  streakFire: { fontSize: 13 },
  streakText: { fontSize: 11, color: "rgba(255,255,255,0.9)" },
  heroRight: { alignItems: "center", gap: 6 },
  adherenceLabel: { fontSize: 9.5, color: "rgba(255,255,255,0.55)", letterSpacing: 0.3 },

  // ── Stats pills
  statsPillRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  statsPill: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: P.white, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 9,
    borderWidth: 1, borderColor: P.ghostBorder,
    shadowColor: P.primary, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  statsPillVal: { fontSize: 14, lineHeight: 18 },
  statsPillLabel: { fontSize: 9, color: P.textMuted, flex: 1 },

  // ── Quick tiles
  quickRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  quickTileShadow: {
    flex: 1, borderRadius: 14,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14, shadowRadius: 8, elevation: 3,
  },
  quickTileCard: {
    flex: 1, height: 86, borderRadius: 14, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
  },
  quickTileGrad: {
    flex: 1, borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 10,
    justifyContent: "flex-start",
  },
  quickTileIconWrap: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: "center", justifyContent: "center", marginBottom: 7,
  },
  quickTileTitle: { fontSize: 11.5, lineHeight: 14 },
  quickTileSub: { fontSize: 9, color: P.textMuted, lineHeight: 12, marginTop: 2 },

  // ── Section
  section: { paddingHorizontal: 16, marginTop: 12 },
  sectionRow: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, color: P.text },
  sectionSubtitle: { fontSize: 11, color: P.textMuted, marginTop: 2 },

  // ── Low stock (info-only)
  lowStockCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFF5F5", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#FECACA",
    shadowColor: P.red, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
    gap: 12,
  },
  lowStockIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center",
  },
  lowStockTitle: { fontSize: 13, color: "#991B1B" },
  lowStockSub: { fontSize: 11, color: "#B91C1C", marginTop: 2 },
  lowStockBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: P.red,
    alignItems: "center", justifyContent: "center",
  },
  lowStockBadgeText: { fontSize: 12, color: "#fff" },

  // ── Progress banner
  progressBanner: {
    backgroundColor: P.white, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: "#EDE8FF",
    shadowColor: P.primary, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  progressBannerTop: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 10,
  },
  progressBannerText: { fontSize: 13, color: P.textSub },
  progressBannerPct: { fontSize: 15 },
  progressTrack: { height: 6, backgroundColor: P.ghostLight, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },

  // ── Next dose callout
  nextDoseCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: P.white, borderRadius: 14, padding: 12,
    marginBottom: 10, borderWidth: 1, borderColor: "#EDE8FF",
    overflow: "hidden",
    shadowColor: P.primary, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 1,
    gap: 10,
  },
  nextDoseAccentBar: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2,
  },
  nextDoseIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center", marginLeft: 6,
  },
  nextDoseInfo: { flex: 1 },
  nextDoseLabel: { fontSize: 9, color: P.textMuted, letterSpacing: 0.8 },
  nextDoseName: { fontSize: 14, color: P.text, marginTop: 1 },
  nextDoseTime: { fontSize: 11, color: P.textMuted, marginTop: 1 },
  nextDosePill: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1,
  },
  nextDosePillText: { fontSize: 11 },

  // ── Doses container
  dosesContainer: {
    backgroundColor: P.white, borderRadius: 18,
    borderWidth: 1, borderColor: "#EDE8FF", overflow: "hidden",
    shadowColor: P.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },

  // ── Dose group
  doseGroup: {},
  doseGroupDone: { opacity: 0.72 },
  doseGroupHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: "#FAFAF9",
    borderBottomWidth: 1, borderBottomColor: "#F0EAFF",
    gap: 6,
  },
  doseGroupEmoji: { fontSize: 14 },
  doseGroupLabel: { fontSize: 12, flex: 1 },
  doseGroupPill: {
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1,
  },
  doseGroupCount: { fontSize: 10 },

  // ── Dose card
  doseCard: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 13,
    gap: 10, overflow: "hidden",
  },
  doseCardBorder: { borderBottomWidth: 1, borderBottomColor: "#F5F0FF" },
  doseAccentBar: {
    position: "absolute", left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2,
  },
  doseIconCircle: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: "center", justifyContent: "center", marginLeft: 8,
  },
  doseInfo: { flex: 1 },
  doseName: { fontSize: 14, color: P.text },
  doseNameDone: { opacity: 0.45 },
  doseTime: { fontSize: 11, color: P.textMuted, marginTop: 2 },
  doseBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
  },
  doseBadgeText: { fontSize: 11 },

  // ── Empty state
  emptyDoses: {
    alignItems: "center", paddingVertical: 32, paddingHorizontal: 24,
    backgroundColor: P.white, borderRadius: 18,
    borderWidth: 1, borderColor: "#EDE8FF", gap: 6,
  },
  emptyDosesIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: P.ghostLight,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyDosesTitle: { fontSize: 15, color: P.text },
  emptyDosesText: {
    fontSize: 12, color: P.textMuted,
    textAlign: "center", lineHeight: 18, maxWidth: 220,
  },

  // ── Weekly chart
  weekCard: {
    backgroundColor: P.white, borderRadius: 18,
    padding: 16, paddingBottom: 14,
    borderWidth: 1, borderColor: "#EDE8FF",
    shadowColor: P.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  weekStrip: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-end", height: 80, paddingTop: 18,
  },
  weekCol: { alignItems: "center", gap: 4, flex: 1 },
  weekBarTrack: { height: 52, justifyContent: "flex-end", alignItems: "center" },
  weekBar: { width: 18, borderRadius: 5, minHeight: 6 },
  weekBarToday: { shadowColor: P.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  weekBarLabel: { fontSize: 7.5, color: P.textMuted, marginBottom: 2, textAlign: "center" },
  weekDay: { fontSize: 9, color: P.textMuted },
  todayDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: P.primary, marginTop: 2,
  },
  weekLegend: {
    flexDirection: "row", justifyContent: "center", gap: 10, flexWrap: "wrap",
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: "#F0EAFF",
  },
  weekLegendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  weekLegendDot: { width: 8, height: 8, borderRadius: 4 },
  weekLegendTxt: { fontSize: 10, color: P.textMuted },

  // ── Scanner card
  scannerCard: {
    borderRadius: 22, overflow: "hidden",
    shadowColor: P.primaryDark, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 18, elevation: 8,
  },
  scannerGradient: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 22, overflow: "hidden", minHeight: 170,
  },
  scannerLeft: { flex: 1, paddingRight: 12 },
  scannerBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 4,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    marginBottom: 10,
  },
  aiBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: P.teal },
  aiBadgeText: { fontSize: 9, color: "rgba(255,255,255,0.8)", letterSpacing: 1 },
  scannerTitle: { fontSize: 22, lineHeight: 28, color: "#fff", letterSpacing: -0.3, marginBottom: 6 },
  scannerSub: { fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 16, marginBottom: 16 },
  scannerActions: { flexDirection: "row", gap: 10 },
  scanBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
  },
  scanBtnText: { fontSize: 13, color: P.primary },
  uploadBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  uploadBtnText: { fontSize: 12, color: "rgba(255,255,255,0.8)" },
  scannerRight: { alignItems: "center", gap: 10 },
  phoneMock: {
    width: 70, height: 120, borderRadius: 14,
    backgroundColor: P.primaryDark,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
  },
  phoneSpeaker: {
    position: "absolute", top: 8, width: 22, height: 3.5, borderRadius: 2,
    backgroundColor: P.primaryMid,
  },
  phoneScreen: {
    width: 56, height: 88, backgroundColor: "#0D2B40", borderRadius: 8,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  phoneHome: {
    position: "absolute", bottom: 6, width: 22, height: 3, borderRadius: 2,
    backgroundColor: P.primaryMid,
  },
  cornerTL: { position: "absolute", top: 6, left: 6, width: 10, height: 10, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: P.teal, borderRadius: 1 },
  cornerTR: { position: "absolute", top: 6, right: 6, width: 10, height: 10, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: P.teal, borderRadius: 1 },
  cornerBL: { position: "absolute", bottom: 6, left: 6, width: 10, height: 10, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderColor: P.teal, borderRadius: 1 },
  cornerBR: { position: "absolute", bottom: 6, right: 6, width: 10, height: 10, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderColor: P.teal, borderRadius: 1 },
  trustRow: { flexDirection: "column", gap: 4, alignItems: "flex-start" },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  trustLabel: { fontSize: 9, color: "rgba(255,255,255,0.5)" },

  // ── Tips card
  tipsCard: {
    borderRadius: 16, overflow: "hidden",
    shadowColor: P.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  tipsGradient: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: P.ghostBorder },
  tipsHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6 },
  tipsBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "rgba(85,63,181,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  tipsTitle: { fontSize: 13, color: P.primary },
  tipsText: { fontSize: 11.5, lineHeight: 17, color: P.textSub },

  // ── CTA banner
  ctaBanner: {
    borderRadius: 18, padding: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: P.primary, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 5,
  },
  ctaLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  ctaIconWrap: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  ctaTitle: { fontSize: 16, color: "#fff" },
  ctaSub: { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  ctaArrow: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
});