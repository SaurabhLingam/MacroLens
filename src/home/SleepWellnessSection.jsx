import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Animated,
  Easing,
  Pressable,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "../components/TextWrapper";
import useParallaxHeader from "./useParallaxHeader";
import { useNavigation } from "@react-navigation/native";
import WellnessHeader from "./WellnessHeader";
import WellnessChipRow from "./WellnessChipRow";
import WellnessInsightsCard from "./WellnessInsightsCard";
import useWellnessAnimation from "./useWellnessAnimation";
import shared from "./wellnessStyles";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Tile width calculation ────────────────────────────────────────────────────
const SCREEN_WIDTH = Dimensions.get("window").width;
const TILE_WIDTH = (SCREEN_WIDTH - 36 - 16) / 3;

// ── Scene constants ───────────────────────────────────────────────────────────
const SLEEP_LAYER_TOP = "#E4CCF7";

const SLEEP_STARS = [
  { top: "8%", left: "6%", size: 2, opacity: 0.5 },
  { top: "13%", left: "19%", size: 3, opacity: 0.6 },
  { top: "6%", left: "32%", size: 2, opacity: 0.45 },
  { top: "17%", left: "47%", size: 2.5, opacity: 0.55 },
  { top: "9%", left: "60%", size: 3, opacity: 0.5 },
  { top: "5%", left: "73%", size: 2, opacity: 0.48 },
  { top: "19%", left: "86%", size: 2, opacity: 0.42 },
  { top: "25%", left: "12%", size: 2, opacity: 0.4 },
  { top: "30%", left: "26%", size: 3, opacity: 0.52 },
  { top: "22%", left: "40%", size: 2, opacity: 0.38 },
  { top: "32%", left: "54%", size: 2, opacity: 0.5 },
  { top: "28%", left: "67%", size: 3, opacity: 0.55 },
  { top: "24%", left: "80%", size: 2, opacity: 0.44 },
  { top: "38%", left: "9%", size: 2, opacity: 0.36 },
  { top: "42%", left: "23%", size: 2, opacity: 0.44 },
  { top: "35%", left: "37%", size: 3, opacity: 0.5 },
  { top: "43%", left: "51%", size: 2, opacity: 0.4 },
  { top: "39%", left: "64%", size: 2.5, opacity: 0.46 },
  { top: "44%", left: "76%", size: 3, opacity: 0.52 },
  { top: "40%", left: "89%", size: 2, opacity: 0.38 },
];

const SLEEP_TREES = [
  { left: "3%", scale: 1.3, opacity: 0.6 },
  { left: "9%", scale: 0.95, opacity: 0.55 },
  { left: "15%", scale: 1.15, opacity: 0.62 },
  { left: "22%", scale: 0.88, opacity: 0.5 },
  { left: "29%", scale: 1.05, opacity: 0.58 },
  { left: "37%", scale: 1.2, opacity: 0.63 },
  { left: "45%", scale: 0.92, opacity: 0.52 },
  { left: "53%", scale: 1.08, opacity: 0.6 },
  { left: "61%", scale: 0.85, opacity: 0.48 },
  { left: "69%", scale: 1.1, opacity: 0.58 },
  { left: "77%", scale: 0.9, opacity: 0.54 },
  { left: "84%", scale: 1.22, opacity: 0.64 },
  { left: "91%", scale: 0.8, opacity: 0.46 },
];

// ── Storage key (must match SetSleep.js) ─────────────────────────────────────
const STORAGE_KEY = "@sleep_schedule_v2";
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const toH24 = (h, m, ap) => (h % 12) + (ap === "PM" ? 12 : 0) + m / 60;
const durOf = (wH24, bH24) => {
  let diff = wH24 - bH24;
  if (diff < 0) diff += 24;
  return { h: Math.floor(diff), m: Math.round((diff - Math.floor(diff)) * 60) };
};

// ── Mock weekly trend data (simulated around stored duration) ─────────────────
const buildTrend = (dur) => {
  const base = dur.h + dur.m / 60;
  const offsets = [-1.2, 0.4, 0.8, -0.5, 1.1, 1.8, -0.3];
  return DAYS_SHORT.map((day, i) => ({
    day,
    hrs: Math.max(
      3.5,
      Math.min(9.5, parseFloat((base + offsets[i]).toFixed(1))),
    ),
  }));
};

// ── Timeline labels ───────────────────────────────────────────────────────────
const TIMELINE_LABELS = ["12PM", "6PM", "12AM", "6AM", "12PM"];

// ── SleepRoutineCard ──────────────────────────────────────────────────────────
// FIX 1: Accept `onViewStats` as a prop and use `useNavigation` for navigation
function SleepRoutineCard({ scheduleData, onViewStats }) {
  const navigation = useNavigation(); // FIX 1: get navigation inside the component
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const { time, enabledDays } = scheduleData;

  // Derived values
  const wakeH = HOURS[time.hIdx];
  const wakeM = MINUTES[time.mIdx];
  const wakeAmpm = time.ampm;
  const bedH = HOURS[time.bHIdx];
  const bedM = MINUTES[time.bMIdx];
  const bedAmpm = time.bAmpm;

  const wakeH24 = toH24(wakeH, wakeM, wakeAmpm);
  const bedH24 = toH24(bedH, bedM, bedAmpm);
  const dur = durOf(wakeH24, bedH24);

  const trendData = buildTrend(dur);
  const maxHrs = Math.max(...trendData.map((d) => d.hrs));
  const minHrs = Math.min(...trendData.map((d) => d.hrs));

  // Timeline position helper (12PM = 0, cycles 24h)
  const toPos = (h) => ((h - 12 + 24) % 24) / 24;
  const bedPos = toPos(bedH24);
  const wakePos = toPos(wakeH24);
  const wraps = wakePos < bedPos;

  // Chart dimensions
  const CHART_H = 80;
  const CHART_W = SCREEN_WIDTH - 36 - 32; // card padding
  const BAR_COUNT = trendData.length;
  const BAR_SPACING = CHART_W / BAR_COUNT;
  const RANGE = maxHrs - minHrs || 1;

  // SVG-style polyline points
  const pts = trendData.map((d, i) => {
    const x = BAR_SPACING * i + BAR_SPACING / 2;
    const y = CHART_H - ((d.hrs - minHrs) / RANGE) * (CHART_H - 12) - 4;
    return { x, y, d };
  });

  return (
    <Animated.View
      style={[
        routineStyles.card,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* ── Header ── */}
      <View style={routineStyles.cardHeader}>
        <View style={routineStyles.headerLeft}>
          <View style={routineStyles.headerIconWrap}>
            <Ionicons name="moon" size={14} color="#7C3AED" />
          </View>
          <Text weight="700" style={routineStyles.cardTitle}>
            Sleep Routine
          </Text>
        </View>
        <View style={routineStyles.durationBadge}>
          <Text weight="900" style={routineStyles.durationText}>
            {pad(dur.h)}h {pad(dur.m)}m
          </Text>
        </View>
      </View>

      {/* ── Timeline bar ── */}
      <View style={routineStyles.timelineWrap}>
        <View style={routineStyles.timelineTrack}>
          {wraps ? (
            <>
              <LinearGradient
                colors={["#6B64D0", "#C178E0"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  routineStyles.timelineSeg,
                  { left: `${bedPos * 100}%`, right: "0%" },
                ]}
              />
              <LinearGradient
                colors={["#C178E0", "#E8A56B"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  routineStyles.timelineSeg,
                  { left: "0%", right: `${(1 - wakePos) * 100}%` },
                ]}
              />
            </>
          ) : (
            <LinearGradient
              colors={["#6B64D0", "#C178E0", "#E8A56B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                routineStyles.timelineSeg,
                {
                  left: `${bedPos * 100}%`,
                  right: `${(1 - wakePos) * 100}%`,
                },
              ]}
            />
          )}
          <View
            style={[
              routineStyles.timelineDot,
              {
                left: `${bedPos * 100}%`,
                backgroundColor: "#6B64D0",
                marginLeft: -6,
              },
            ]}
          />
          <View
            style={[
              routineStyles.timelineDot,
              {
                left: `${wakePos * 100}%`,
                backgroundColor: "#E8A56B",
                marginLeft: -6,
              },
            ]}
          />
        </View>
        <View style={routineStyles.timelineLabels}>
          {TIMELINE_LABELS.map((l, i) => (
            <Text key={i} weight="500" style={routineStyles.timelineLabel}>
              {l}
            </Text>
          ))}
        </View>
      </View>

      {/* ── In-bed / Wake-up pills ── */}
      <View style={routineStyles.timePills}>
        <View style={routineStyles.timePill}>
          <View style={routineStyles.timePillIconWrap}>
            <Ionicons name="bed-outline" size={13} color="#7C3AED" />
          </View>
          <View>
            <Text weight="500" style={routineStyles.timePillLabel}>
              In-bed
            </Text>
            <Text weight="900" style={routineStyles.timePillValue}>
              {pad(bedH)}:{pad(bedM)}
              <Text weight="400" style={routineStyles.timePillAmpm}>
                {" "}
                {bedAmpm}
              </Text>
            </Text>
          </View>
        </View>

        <View style={routineStyles.timePillDivider} />

        <View style={routineStyles.timePill}>
          <View
            style={[
              routineStyles.timePillIconWrap,
              { backgroundColor: "rgba(232,165,107,0.12)" },
            ]}
          >
            <Ionicons name="sunny-outline" size={13} color="#E8A56B" />
          </View>
          <View>
            <Text weight="500" style={routineStyles.timePillLabel}>
              Wake-up
            </Text>
            <Text
              weight="900"
              style={[routineStyles.timePillValue, { color: "#1A1340" }]}
            >
              {pad(wakeH)}:{pad(wakeM)}
              <Text weight="400" style={routineStyles.timePillAmpm}>
                {" "}
                {wakeAmpm}
              </Text>
            </Text>
          </View>
        </View>
      </View>

      {/* ── Sleep Trend chart ── */}
      <View style={routineStyles.trendSection}>
        <View style={routineStyles.trendHeader}>
          <Text weight="700" style={routineStyles.trendTitle}>
            Sleep Trend
          </Text>
          {/* FIX 2: Use onPress instead of onViewStats, and navigate correctly */}
          <TouchableOpacity
            onPress={() => navigation.navigate("SleepStats")}
            activeOpacity={0.7}
          >
            <Text weight="700" style={routineStyles.viewStats}>
              View Stats
            </Text>
          </TouchableOpacity>
        </View>

        {/* Chart */}
        <View style={[routineStyles.chartArea, { height: CHART_H + 24 }]}>
          {/* Horizontal guide lines */}
          {[0, 0.33, 0.66, 1].map((frac, i) => (
            <View
              key={i}
              style={[
                routineStyles.guideLine,
                { top: (1 - frac) * CHART_H + 4 },
              ]}
            />
          ))}

          {/* Y-axis labels */}
          {[maxHrs, Math.round((maxHrs + minHrs) / 2), minHrs].map((v, i) => (
            <Text
              key={i}
              weight="400"
              style={[
                routineStyles.yLabel,
                { top: i === 0 ? 0 : i === 1 ? CHART_H / 2 - 6 : CHART_H - 8 },
              ]}
            >
              {Math.floor(v)}h
            </Text>
          ))}

          {/* Area fill (simulated with View) */}
          <View
            style={[
              routineStyles.chartCanvas,
              { height: CHART_H, marginLeft: 28 },
            ]}
          >
            {/* Connecting lines between points */}
            {pts.map((pt, i) => {
              if (i === 0) return null;
              const prev = pts[i - 1];
              const dx = pt.x - prev.x;
              const dy = pt.y - prev.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

              // FIX: React Native rotates from center, so shift left/top
              // so the center of the line lands exactly at the midpoint
              // between prev and current point
              const midX = (prev.x + pt.x) / 2;
              const midY = (prev.y + pt.y) / 2;

              return (
                <View
                  key={`line-${i}`}
                  style={{
                    position: "absolute",
                    left: midX - len / 2, // center the line horizontally on midpoint
                    top: midY - 1, // center the 2px height vertically on midpoint
                    width: len,
                    height: 2,
                    backgroundColor: "rgba(107,100,208,0.55)",
                    borderRadius: 1,
                    transform: [{ rotate: `${angle}deg` }],
                  }}
                />
              );
            })}

            {/* Dots + day labels */}
            {pts.map((pt, i) => (
              <View key={`pt-${i}`}>
                {/* Glow behind dot */}
                <View
                  style={[
                    routineStyles.dotGlow,
                    { left: pt.x - 9, top: pt.y - 9 },
                  ]}
                />
                {/* Dot */}
                <View
                  style={[
                    routineStyles.dot,
                    { left: pt.x - 4.5, top: pt.y - 4.5 },
                  ]}
                />
                {/* Day label */}
                <Text
                  weight="500"
                  style={[
                    routineStyles.dayLabel,
                    { left: pt.x - 12, top: CHART_H + 4 },
                  ]}
                >
                  {pt.d.day}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ── Active days ── */}
      <View style={routineStyles.activeDaysRow}>
        {DAYS_SHORT.map((d) => {
          const active = enabledDays?.[d] ?? false;
          return (
            <View
              key={d}
              style={[
                routineStyles.dayPill,
                active && routineStyles.dayPillActive,
              ]}
            >
              <Text
                weight={active ? "700" : "400"}
                style={[
                  routineStyles.dayPillTxt,
                  active && routineStyles.dayPillTxtActive,
                ]}
              >
                {d.slice(0, 2)}
              </Text>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

// ── Moon Glow (pulsing) ───────────────────────────────────────────────────────
function MoonGlow() {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.6,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[styles.moonContainer, { transform: [{ scale: pulseAnim }] }]}
    >
      <Animated.View style={[styles.moonOuterGlow, { opacity: glowAnim }]} />
      <View style={styles.moonBody}>
        <View style={[styles.moonCrater, styles.craterA]} />
        <View style={[styles.moonCrater, styles.craterB]} />
        <View style={[styles.moonCrater, styles.craterC]} />
        <View style={styles.moonCrescent} />
      </View>
    </Animated.View>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        delay: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        delay: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    shimmerLoop.start();
    return () => shimmerLoop.stop();
  }, []);

  const btnOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1],
  });

  const onPressIn = () =>
    Animated.spring(scaleAnim, {
      toValue: 0.94,
      speed: 50,
      useNativeDriver: true,
    }).start();

  const onPressOut = () =>
    Animated.spring(scaleAnim, {
      toValue: 1,
      speed: 30,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View
      style={[
        styles.emptyStateWrap,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text weight="700" style={styles.heroTitle}>
        Your Sleep Score
      </Text>
      <Text weight="700" style={styles.heroTitleAccent}>
        will appear here
      </Text>
      <Text weight="400" style={styles.heroSubtitle}>
        Start logging your sleep to track{"\n"}patterns, recovery & energy.
      </Text>

      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.logBtnWrap}
      >
        <Animated.View
          style={{ opacity: btnOpacity, transform: [{ scale: scaleAnim }] }}
        >
          <LinearGradient
            colors={["#B148FF", "#F6339B", "#9914F9"]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.logBtn}
          >
            <Ionicons
              name="moon"
              size={12}
              color="#fff"
              style={{ marginRight: 5 }}
            />
            <Text weight="700" style={styles.logBtnText}>
              Log Sleep
            </Text>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ── Action Tiles ──────────────────────────────────────────────────────────────
const ACTION_TILES = [
  {
    title: "Set Sleep",
    subtitle: "Goal",
    color: "#7C3AED",
    gradientColors: ["#F5F0FF", "#EAD9FF"],
    borderColor: "rgba(124,58,237,0.18)",
    iconBg: "rgba(124,58,237,0.1)",
    icon: (
      <MaterialCommunityIcons
        name="moon-waning-crescent"
        size={17}
        color="#7C3AED"
      />
    ),
  },
  {
    title: "Reminders",
    subtitle: "Alerts",
    color: "#C2185B",
    gradientColors: ["#FFF0F4", "#FFD6E3"],
    borderColor: "rgba(194,24,91,0.18)",
    iconBg: "rgba(194,24,91,0.1)",
    icon: <Ionicons name="alarm-outline" size={17} color="#C2185B" />,
  },
  {
    title: "Devices",
    subtitle: "Sync",
    color: "#1565C0",
    gradientColors: ["#F0F4FF", "#D6E4FF"],
    borderColor: "rgba(21,101,192,0.18)",
    iconBg: "rgba(21,101,192,0.1)",
    icon: <Feather name="link-2" size={15} color="#1565C0" />,
  },
];

// ── ActionTile ────────────────────────────────────────────────────────────────
function ActionTile({
  icon,
  title,
  subtitle,
  color,
  gradientColors,
  borderColor,
  iconBg,
  onPress,
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scaleAnim, {
      toValue: 0.94,
      speed: 50,
      useNativeDriver: true,
    }).start();

  const onPressOut = () =>
    Animated.spring(scaleAnim, {
      toValue: 1,
      speed: 30,
      useNativeDriver: true,
    }).start();

  return (
    <Pressable
      onPressIn={onPressIn}
      onPress={onPress}
      onPressOut={onPressOut}
      style={{ width: TILE_WIDTH }}
    >
      <Animated.View
        style={{ width: TILE_WIDTH, transform: [{ scale: scaleAnim }] }}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.actionTile, { borderColor }]}
        >
          <View style={[styles.actionIconBg, { backgroundColor: iconBg }]}>
            {icon}
          </View>
          <Text
            weight="700"
            style={[styles.actionTitle, { color }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text weight="400" style={styles.actionSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

// ── Tips Strip ────────────────────────────────────────────────────────────────
function TipsStrip() {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      delay: 900,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.tipsCard, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={["#F7F3FF", "#EEE4FF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tipsGradient}
      >
        <View style={styles.tipsHeader}>
          <View style={styles.tipsBadge}>
            <Ionicons name="bulb-outline" size={12} color="#7C3AED" />
          </View>
          <Text weight="700" style={styles.tipsTitle}>
            Sleep Tip
          </Text>
        </View>
        <Text weight="400" style={styles.tipsText}>
          A consistent bedtime — even on weekends — helps regulate your
          circadian rhythm and improves sleep quality over time.
        </Text>
      </LinearGradient>
    </Animated.View>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function SleepWellnessSection(props) {
  const { onBack, hideHeader = false } = props;
  const navigation = useNavigation();
  const { scrollHandler, heroAnimatedStyle } = useParallaxHeader();
  const { animatedStyle: heroAnim } = useWellnessAnimation(["Sleep"]);
  const { animatedStyle: actionAnim } = useWellnessAnimation(["Sleep"]);

  // ── Sleep schedule state ──────────────────────────────────────────────────
  const [scheduleData, setScheduleData] = useState(null);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setScheduleData(parsed);
        }
      } catch (_) {
        // silently ignore
      } finally {
        setScheduleLoaded(true);
      }
    })();
  }, []);

  return (
    <View style={shared.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[shared.scrollContent, styles.scrollInner]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {!hideHeader && <WellnessHeader onBack={onBack} />}
        {!hideHeader && <WellnessChipRow currentCategory="Sleep" navProps={props} />}

        {/* ── Hero Card ────────────────────────────────────────────────────── */}
        <View style={heroAnimatedStyle}>
          <LinearGradient
            colors={[
              SLEEP_LAYER_TOP,
              "rgba(207,225,255,0.85)",
              "rgba(207,225,255,0.42)",
              "rgba(207,225,255,0)",
            ]}
            locations={[0, 0.34, 0.7, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.topSection}
          >
            <Animated.View style={[styles.heroWrap, heroAnim]}>
              <View style={styles.heroShadowA}>
                <View style={styles.heroShadowB}>
                  <LinearGradient
                    colors={["#1C0F40", "#2E1872", "#3B2090"]}
                    start={{ x: 0.3, y: 0 }}
                    end={{ x: 0.7, y: 1 }}
                    style={styles.heroCard}
                  >
                    <View style={styles.heroScene} pointerEvents="none">
                      {SLEEP_STARS.map((s, i) => (
                        <View
                          key={`star-${i}`}
                          style={[
                            styles.heroStar,
                            {
                              top: s.top,
                              left: s.left,
                              width: s.size,
                              height: s.size,
                              opacity: s.opacity,
                            },
                          ]}
                        />
                      ))}
                      <MoonGlow />
                      <LinearGradient
                        colors={["rgba(30,15,75,0.9)", "rgba(20,10,55,1)"]}
                        style={styles.hillBack}
                      />
                      <LinearGradient
                        colors={["rgba(22,10,60,0.95)", "rgba(16,8,48,1)"]}
                        style={styles.hillMid}
                      />
                      <View style={styles.treeLayer}>
                        {SLEEP_TREES.map((t, i) => (
                          <View
                            key={`tree-${i}`}
                            style={[
                              styles.tree,
                              {
                                left: t.left,
                                opacity: t.opacity,
                                transform: [{ scale: t.scale }],
                              },
                            ]}
                          >
                            <View style={styles.treeCanopy} />
                            <View style={styles.treeTrunk} />
                          </View>
                        ))}
                      </View>
                      <LinearGradient
                        colors={["rgba(14,6,38,1)", "rgba(10,4,28,1)"]}
                        style={styles.hillFront}
                      />
                      <Image
                        source={require("../../assets/birds.webp")}
                        style={styles.heroBirds}
                        resizeMode="contain"
                        resizeMethod="resize"
                        fadeDuration={0}
                      />
                    </View>

                    <View style={styles.heroContent}>
                      <EmptyState />
                    </View>
                  </LinearGradient>
                </View>
              </View>
            </Animated.View>
          </LinearGradient>
        </View>

        {/* ── Action Tiles ─────────────────────────────────────────────────── */}
        <Animated.View style={[styles.actionsRow, actionAnim]}>
          {ACTION_TILES.map((tile) => (
            <ActionTile
              key={tile.title}
              {...tile}
              onPress={
                tile.title === "Set Sleep"
                  ? () => navigation.navigate("SetSleep")
                  : undefined
              }
            />
          ))}
        </Animated.View>

        {/* ── Sleep Routine Card (filled state) ────────────────────────────── */}
        {scheduleLoaded && scheduleData && (
          <View style={styles.routineWrap}>
            <SleepRoutineCard
              scheduleData={scheduleData}
              onViewStats={() => navigation.navigate("SleepStats")}
            />
          </View>
        )}

        {/* ── Sleep Tip ────────────────────────────────────────────────────── */}
        <View style={styles.tipsWrap}>
          <TipsStrip />
        </View>

        {/* ── Wellness Insights Banner ──────────────────────────────────────── */}
        <Animated.View style={[styles.insightsWrap, actionAnim]}>
          <WellnessInsightsCard />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

export default React.memo(SleepWellnessSection);
// ── SleepRoutineCard StyleSheet ───────────────────────────────────────────────
const routineStyles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(180,140,255,0.14)",
  },

  // Header
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "rgba(124,58,237,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 15, color: "#1A1340" },
  durationBadge: {
    backgroundColor: "#F0EDFF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.15)",
  },
  durationText: { fontSize: 14, color: "#5B21B6" },

  // Timeline
  timelineWrap: { marginBottom: 14 },
  timelineTrack: {
    height: 7,
    backgroundColor: "#F0EDFF",
    borderRadius: 7,
    overflow: "visible",
    position: "relative",
  },
  timelineSeg: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 7,
  },
  timelineDot: {
    position: "absolute",
    top: -4.5,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  timelineLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  timelineLabel: { fontSize: 9.5, color: "#A099C8" },

  // Time pills
  timePills: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F6FF",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(180,140,255,0.12)",
  },
  timePill: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  timePillIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(124,58,237,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  timePillLabel: { fontSize: 10, color: "#A099C8", marginBottom: 2 },
  timePillValue: { fontSize: 18, color: "#7C3AED", lineHeight: 22 },
  timePillAmpm: { fontSize: 11, color: "#A099C8" },
  timePillDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(180,140,255,0.2)",
    marginHorizontal: 8,
  },

  // Trend chart
  trendSection: {},
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  trendTitle: { fontSize: 13, color: "#1A1340" },
  viewStats: { fontSize: 12, color: "#7C3AED" },

  chartArea: { position: "relative", marginBottom: 8 },
  guideLine: {
    position: "absolute",
    left: 28,
    right: 0,
    height: 1,
    backgroundColor: "rgba(180,140,255,0.12)",
  },
  yLabel: {
    position: "absolute",
    left: 0,
    fontSize: 9,
    color: "#B0A8D0",
    width: 24,
    textAlign: "right",
  },
  chartCanvas: { position: "relative" },
  dotGlow: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(107,100,208,0.12)",
  },
  dot: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#6B64D0",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#6B64D0",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
  },
  dayLabel: {
    position: "absolute",
    fontSize: 9.5,
    color: "#A099C8",
    width: 24,
    textAlign: "center",
  },

  // Active days
  activeDaysRow: {
    flexDirection: "row",
    gap: 5,
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(180,140,255,0.1)",
  },
  dayPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(180,140,255,0.2)",
    alignItems: "center",
  },
  dayPillActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  dayPillTxt: { fontSize: 9.5, color: "#B0A8D0" },
  dayPillTxtActive: { color: "#FFFFFF" },
});

// ── Main StyleSheet ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scrollInner: { paddingBottom: 36 },

  topSection: { marginTop: -2, paddingTop: 0, paddingBottom: 14 },
  heroWrap: { paddingTop: 20, paddingHorizontal: 18 },

  heroShadowA: {
    borderRadius: 22,
    shadowColor: "#3B1A8A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 12,
  },
  heroShadowB: {
    borderRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },

  heroCard: {
    borderRadius: 22,
    minHeight: 162,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(155,95,255,0.22)",
  },

  heroScene: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },

  heroStar: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: "#FFFFFF",
  },

  moonContainer: {
    position: "absolute",
    top: 14,
    right: 18,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  moonOuterGlow: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(230,220,255,0.1)",
    shadowColor: "#D8C8FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  moonBody: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#E8E0FA",
    shadowColor: "#C8A8FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 7,
    overflow: "hidden",
  },
  moonCrescent: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: "rgba(22,12,60,0.58)",
  },
  moonCrater: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: "rgba(190,175,230,0.5)",
  },
  craterA: { width: 5, height: 5, top: 7, left: 5 },
  craterB: { width: 3.5, height: 3.5, top: 14, left: 12 },
  craterC: { width: 3, height: 3, top: 5, left: 15 },

  hillBack: {
    position: "absolute",
    bottom: 0,
    left: "-10%",
    width: "76%",
    height: 52,
    borderTopRightRadius: 120,
    borderTopLeftRadius: 90,
  },
  hillMid: {
    position: "absolute",
    bottom: 0,
    right: "-14%",
    width: "82%",
    height: 62,
    borderTopLeftRadius: 140,
    borderTopRightRadius: 85,
  },
  treeLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 25,
    height: 34,
  },
  tree: {
    position: "absolute",
    bottom: 0,
    width: 9,
    height: 24,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  treeCanopy: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 14,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#0D0620",
    marginBottom: -1,
  },
  treeTrunk: { width: 2, height: 6, backgroundColor: "#080415" },
  hillFront: {
    position: "absolute",
    bottom: -2,
    left: "-4%",
    width: "112%",
    height: 42,
    borderTopLeftRadius: 170,
    borderTopRightRadius: 170,
  },

  heroBirds: {
    position: "absolute",
    right: 0,
    bottom: 36,
    width: 100,
    height: 70,
    zIndex: 5,
  },

  heroContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    maxWidth: "62%",
  },

  emptyStateWrap: {},

  heroTitle: { fontSize: 18, lineHeight: 22, color: "#FFFFFF" },
  heroTitleAccent: {
    fontSize: 18,
    lineHeight: 22,
    color: "rgba(200,170,255,0.9)",
    marginBottom: 7,
  },
  heroSubtitle: {
    fontSize: 10,
    lineHeight: 14,
    color: "rgba(210,195,240,0.72)",
    marginBottom: 13,
  },

  logBtnWrap: { alignSelf: "flex-start", borderRadius: 9, overflow: "hidden" },
  logBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 9,
  },
  logBtnText: { color: "#FFFFFF", fontSize: 11, lineHeight: 13 },

  // Routine card wrapper
  routineWrap: {
    marginTop: 12,
    paddingHorizontal: 18,
  },

  // Action Tiles
  actionsRow: {
    marginTop: 12,
    paddingHorizontal: 18,
    flexDirection: "row",
    gap: 8,
  },
  actionTile: {
    width: TILE_WIDTH,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingTop: 13,
    paddingBottom: 13,
    alignItems: "flex-start",
    gap: 5,
    shadowColor: "#C0A8E0",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  actionIconBg: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: { fontSize: 11, lineHeight: 14, flexShrink: 1 },
  actionSubtitle: { fontSize: 9, color: "#A090C0", lineHeight: 11 },

  // Tips
  tipsWrap: { marginTop: 12, paddingHorizontal: 18 },
  tipsCard: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#C0A0E0",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 2,
  },
  tipsGradient: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(180,140,255,0.18)",
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  tipsBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(124,58,237,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  tipsTitle: { fontSize: 12, color: "#5B21B6", lineHeight: 15 },
  tipsText: { fontSize: 11.5, lineHeight: 16, color: "#6D5A8A" },

  // Wellness Insights Banner
  insightsWrap: { marginTop: 12, },
});
