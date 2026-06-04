import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Dimensions,
  Image,
  Animated,
} from "react-native";
import {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
  Feather,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "../components/TextWrapper";
import Svg, {
  Circle,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Path,
} from "react-native-svg";
import useParallaxHeader from "./useParallaxHeader";
import shared, { getTopOffset } from "./wellnessStyles";
import {
  CATEGORIES,
  CHIP_WIDTH,
  CHIP_ITEM_WIDTH,
  CHIP_ACTIVE_COLORS,
} from "./wellnessConstants";
import WellnessInsightsCard from "./WellnessInsightsCard";

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STATE FLAG  →  true = filled / false = empty
// ─────────────────────────────────────────────────────────────────────────────
const HAS_DATA = true;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 56;

const SP_NAT = { tension: 82, friction: 13, useNativeDriver: true };
const SP_JS = { tension: 82, friction: 13, useNativeDriver: false };
const SP_CONTENT = { tension: 65, friction: 10, useNativeDriver: true };

const C_IN = CATEGORIES.map((_, i) => i);
const C_OUT = CATEGORIES.map((c) => CHIP_ACTIVE_COLORS[c.label]?.bg ?? c.color);

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────
const WELLNESS_CATEGORIES = [
  { icon: "🌙", name: "Sleep", value: 80, color: "#F59E0B" },
  { icon: "🥗", name: "Nutrition", value: 68, color: "#EF4444" },
  { icon: "🏃", name: "Fitness", value: 72, color: "#22C55E" },
  { icon: "💊", name: "Medicine", value: 100, color: "#A855F7" },
  {
    icon: "🌸",
    name: "Cycle",
    value: "Stable",
    color: "#F472B6",
    isText: true,
  },
];

const REMINDERS = [
  {
    id: "1",
    title: "HPV Vaccine",
    subtitle: "Dose 2 of 3",
    tag: "Due today",
    tagColor: "#F43F5E",
    tagBg: "#FFF1F3",
    btnLabel: "Book Now",
    btnGradient: ["#B148FF", "#F6339B", "#9914F9"],
    iconBg: "#FDF2FE",
    iconName: "needle",
    iconFamily: "MaterialCommunityIcons",
    iconColor: "#C026D3",
  },
  {
    id: "2",
    title: "FullBody Checkup Report",
    subtitle: "Results available",
    tag: "Ready to view",
    tagColor: "#059669",
    tagBg: "#ECFDF5",
    btnLabel: "View",
    btnGradient: ["#B148FF", "#F6339B", "#9914F9"],
    iconBg: "#EFF6FF",
    iconName: "user",
    iconFamily: "Feather",
    iconColor: "#2563EB",
  },
  {
    id: "3",
    title: "Medicine Reminder",
    subtitle: "After Dinner",
    tag: "8:00 pm",
    tagColor: "#6B7280",
    tagBg: "#F3F4F6",
    btnLabel: "Mark Taken",
    btnGradient: ["#B148FF", "#F6339B", "#9914F9"],
    iconBg: "#FFFBEB",
    iconName: "pills",
    iconFamily: "FontAwesome5",
    iconColor: "#D97706",
  },
];

const WELLNESS_ITEMS = [
  {
    id: "sleep",
    label: "Sleep",
    value: "6h 50m",
    unit: "sleep duration",
    iconName: "moon-outline",
    iconColor: "#6366F1",
    bg: "#EEF2FF",
    bar: "#818CF8",
    barFill: 0.7,
  },
  {
    id: "nutrition",
    label: "Nutrition",
    value: "1,920",
    unit: "kcal consumed",
    iconName: "restaurant-outline",
    iconColor: "#EA580C",
    bg: "#FFF7ED",
    bar: "#FB923C",
    barFill: 0.55,
  },
  {
    id: "fitness",
    label: "Fitness",
    value: "600",
    unit: "kcal burned",
    iconName: "flash-outline",
    iconColor: "#EA580C",
    bg: "#FFF4EE",
    bar: "#F97316",
    barFill: 0.4,
  },
  {
    id: "medicine",
    label: "Medicine",
    value: "2/2",
    unit: "doses taken",
    iconName: "medkit-outline",
    iconColor: "#059669",
    bg: "#F0FDF4",
    bar: "#34D399",
    barFill: 1.0,
  },
  {
    id: "cycle",
    label: "Cycle",
    value: "10",
    unit: "days left",
    iconName: "time-outline",
    iconColor: "#E11D48",
    bg: "#FFF1F2",
    bar: "#FB7185",
    barFill: 0.35,
  },
];

const SCORE_SEGMENTS = [
  { pct: 0.22, color: "#F59E0B" },
  { pct: 0.2, color: "#EF4444" },
  { pct: 0.2, color: "#22C55E" },
  { pct: 0.2, color: "#A855F7" },
  { pct: 0.18, color: "#F472B6" },
];
const SCORE_SEGMENTS_EMPTY = [
  { pct: 0.22, color: "#F3D89A" },
  { pct: 0.2, color: "#F9BABA" },
  { pct: 0.2, color: "#A8E6BB" },
  { pct: 0.2, color: "#D8B4FE" },
  { pct: 0.18, color: "#FBCFE8" },
];

const MACROS = [
  { label: "Protein", value: "30/50g", color: "#3B82F6", pct: 0.6 },
  { label: "Carbs", value: "30/50g", color: "#EF4444", pct: 0.6 },
  { label: "Fats", value: "30/50g", color: "#F59E0B", pct: 0.6 },
  { label: "Fibres", value: "30/50g", color: "#84CC16", pct: 0.6 },
];
const MACROS_EMPTY = [
  { label: "Protein", value: "—", color: "#3B82F6", pct: 0 },
  { label: "Carbs", value: "—", color: "#EF4444", pct: 0 },
  { label: "Fats", value: "—", color: "#F59E0B", pct: 0 },
  { label: "Fibres", value: "—", color: "#84CC16", pct: 0 },
];
const PLATE_SEGMENTS = [
  { pct: 0.28, color: "#3B82F6" },
  { pct: 0.25, color: "#EF4444" },
  { pct: 0.25, color: "#F59E0B" },
  { pct: 0.22, color: "#84CC16" },
];
const PLATE_SEGMENTS_EMPTY = [
  { pct: 0.28, color: "#BFDBFE" },
  { pct: 0.25, color: "#FCA5A5" },
  { pct: 0.25, color: "#FDE68A" },
  { pct: 0.22, color: "#D9F99D" },
];

// ─────────────────────────────────────────────────────────────────────────────
// OTHER TAB DATA (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────
const SLEEP_STAGES = [
  { label: "Deep", value: "1h 45m", pct: 0.25, color: "#4F46E5" },
  { label: "Light", value: "3h 10m", pct: 0.45, color: "#818CF8" },
  { label: "REM", value: "1h 25m", pct: 0.2, color: "#A5B4FC" },
  { label: "Awake", value: "40m", pct: 0.1, color: "#E0E7FF" },
];
const SLEEP_STAGES_EMPTY = [
  { label: "Deep", value: "—", pct: 0, color: "#C7D2FE" },
  { label: "Light", value: "—", pct: 0, color: "#C7D2FE" },
  { label: "REM", value: "—", pct: 0, color: "#C7D2FE" },
  { label: "Awake", value: "—", pct: 0, color: "#C7D2FE" },
];
const FITNESS_METRICS = [
  {
    icon: "🦶",
    label: "Steps",
    value: "8,420",
    target: "10,000",
    pct: 0.84,
    color: "#22C55E",
  },
  {
    icon: "🔥",
    label: "Active Cal",
    value: "342",
    target: "500",
    pct: 0.68,
    color: "#F97316",
  },
  {
    icon: "💧",
    label: "Hydration",
    value: "1.8L",
    target: "2.5L",
    pct: 0.72,
    color: "#3B82F6",
  },
  {
    icon: "⏱️",
    label: "Active Min",
    value: "38",
    target: "60",
    pct: 0.63,
    color: "#8B5CF6",
  },
];
const FITNESS_METRICS_EMPTY = [
  {
    icon: "🦶",
    label: "Steps",
    value: "—",
    target: "10,000",
    pct: 0,
    color: "#86EFAC",
  },
  {
    icon: "🔥",
    label: "Active Cal",
    value: "—",
    target: "500",
    pct: 0,
    color: "#FDBA74",
  },
  {
    icon: "💧",
    label: "Hydration",
    value: "—",
    target: "2.5L",
    pct: 0,
    color: "#93C5FD",
  },
  {
    icon: "⏱️",
    label: "Active Min",
    value: "—",
    target: "60",
    pct: 0,
    color: "#C4B5FD",
  },
];
const FITNESS_WEEKLY = [
  { day: "M", active: true, mins: 45 },
  { day: "T", active: true, mins: 30 },
  { day: "W", active: false, mins: 0 },
  { day: "T", active: true, mins: 60 },
  { day: "F", active: true, mins: 38 },
  { day: "S", active: false, mins: 0 },
  { day: "S", active: true, mins: 55 },
];
const MEDICINES = [
  {
    name: "Vitamin D3",
    dose: "1000 IU",
    time: "8:00 AM",
    taken: true,
    color: "#F59E0B",
    icon: "☀️",
  },
  {
    name: "Omega-3",
    dose: "1g",
    time: "8:00 AM",
    taken: true,
    color: "#3B82F6",
    icon: "🐟",
  },
  {
    name: "Iron Tablet",
    dose: "65mg",
    time: "1:00 PM",
    taken: false,
    color: "#EF4444",
    icon: "💊",
  },
  {
    name: "Magnesium",
    dose: "400mg",
    time: "9:00 PM",
    taken: false,
    color: "#8B5CF6",
    icon: "🌙",
  },
];
const MEDICINES_EMPTY = [
  {
    name: "No medicines added",
    dose: "",
    time: "",
    taken: false,
    color: "#D1D5DB",
    icon: "💊",
  },
];
const CYCLE_PHASES = [
  {
    label: "Menstrual",
    days: "Day 1–5",
    icon: "🔴",
    color: "#EF4444",
    pct: 0.17,
  },
  {
    label: "Follicular",
    days: "Day 6–13",
    icon: "🌱",
    color: "#22C55E",
    pct: 0.27,
  },
  {
    label: "Ovulation",
    days: "Day 14",
    icon: "✨",
    color: "#F59E0B",
    pct: 0.06,
  },
  {
    label: "Luteal",
    days: "Day 15–28",
    icon: "🌕",
    color: "#8B5CF6",
    pct: 0.5,
  },
];
const CYCLE_SEGMENTS = [
  { pct: 0.17, color: "#EF4444" },
  { pct: 0.27, color: "#22C55E" },
  { pct: 0.06, color: "#F59E0B" },
  { pct: 0.5, color: "#8B5CF6" },
];
const CYCLE_SEGMENTS_EMPTY = [
  { pct: 0.17, color: "#FECACA" },
  { pct: 0.27, color: "#BBF7D0" },
  { pct: 0.06, color: "#FDE68A" },
  { pct: 0.5, color: "#DDD6FE" },
];
const SYMPTOMS = [
  { label: "Cramps", active: true, color: "#EF4444" },
  { label: "Bloating", active: true, color: "#F97316" },
  { label: "Mood Swings", active: false, color: "#8B5CF6" },
  { label: "Headache", active: false, color: "#3B82F6" },
  { label: "Fatigue", active: true, color: "#F59E0B" },
  { label: "Acne", active: false, color: "#EC4899" },
];

const ReminderIcon = ({ item }) => {
  if (item.iconFamily === "MaterialCommunityIcons")
    return (
      <MaterialCommunityIcons
        name={item.iconName}
        size={22}
        color={item.iconColor}
      />
    );
  if (item.iconFamily === "FontAwesome5")
    return (
      <FontAwesome5 name={item.iconName} size={20} color={item.iconColor} />
    );
  return <Feather name={item.iconName} size={22} color={item.iconColor} />;
};

const RING_R = 42;
const PLATE_R = 46;

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM LINE CHART
// ─────────────────────────────────────────────────────────────────────────────
const CustomLineChart = ({
  data,
  width,
  height,
  isEmpty = false,
  maxOverride,
}) => {
  const pL = 34,
    pR = 10,
    pT = 14,
    pB = 26;
  const cW = width - pL - pR,
    cH = height - pT - pB;
  const maxVal =
    maxOverride ??
    (isEmpty ? 3000 : Math.max(...data.datasets.flatMap((d) => d.data), 1));
  const toX = (i) => pL + (i / (data.labels.length - 1)) * cW;
  const toY = (v) => pT + cH - (v / maxVal) * cH;
  const buildPath = (pts) => {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      d += ` C ${midX} ${pts[i].y}, ${midX} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
    }
    return d;
  };
  const buildArea = (pts) =>
    pts.length < 2
      ? ""
      : buildPath(pts) +
        ` L ${pts[pts.length - 1].x} ${pT + cH} L ${pts[0].x} ${pT + cH} Z`;
  const gridTicks = [1, 0.5, 0].map((t) => ({
    y: pT + cH * (1 - t),
    label: isEmpty ? "" : Math.round(maxVal * t).toLocaleString(),
  }));
  return (
    <Svg width={width} height={height}>
      <Defs>
        {data.datasets.map((ds) => (
          <SvgLinearGradient
            key={ds.gradientId}
            id={ds.gradientId}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <Stop
              offset="0%"
              stopColor={ds.color}
              stopOpacity={isEmpty ? 0.08 : 0.18}
            />
            <Stop offset="100%" stopColor={ds.color} stopOpacity={0} />
          </SvgLinearGradient>
        ))}
      </Defs>
      {gridTicks.map((g, i) => (
        <React.Fragment key={i}>
          <Line
            x1={pL}
            y1={g.y}
            x2={width - pR}
            y2={g.y}
            stroke={i === 2 ? "#e5e7eb" : "#f0f0f0"}
            strokeWidth={i === 2 ? 1 : 0.8}
            strokeDasharray={i === 2 ? undefined : "3,3"}
          />
          {g.label !== "" && (
            <SvgText
              x={pL - 5}
              y={g.y + 4}
              fontSize={7.5}
              fill="#c4c4cc"
              textAnchor="end"
            >
              {g.label}
            </SvgText>
          )}
        </React.Fragment>
      ))}
      {data.datasets.map((ds) => {
        const pts = ds.data.map((v, i) => ({ x: toX(i), y: toY(v) }));
        return (
          <React.Fragment key={ds.gradientId}>
            <Path d={buildArea(pts)} fill={`url(#${ds.gradientId})`} />
            <Path
              d={buildPath(pts)}
              fill="none"
              stroke={ds.color}
              strokeWidth={isEmpty ? 1.2 : 2}
              strokeLinecap="round"
              strokeDasharray={isEmpty ? "5,4" : undefined}
              opacity={isEmpty ? 0.45 : 1}
            />
            {!isEmpty &&
              pts.map((p, i) => (
                <Circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3}
                  fill="#fff"
                  stroke={ds.color}
                  strokeWidth={1.5}
                />
              ))}
          </React.Fragment>
        );
      })}
      {data.labels.map((lbl, i) => (
        <SvgText
          key={i}
          x={toX(i)}
          y={height - 7}
          fontSize={8.5}
          fill={isEmpty ? "#d1d5db" : "#9ca3af"}
          textAnchor="middle"
        >
          {lbl}
        </SvgText>
      ))}
      {isEmpty && (
        <SvgText
          x={pL + cW / 2}
          y={pT + cH / 2 + 4}
          fontSize={9}
          fill="#c084fc"
          textAnchor="middle"
          opacity={0.9}
        >
          Track activity to see trends
        </SvgText>
      )}
    </Svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SLEEP BAR CHART
// ─────────────────────────────────────────────────────────────────────────────
const SleepBarChart = ({ data, width, height, isEmpty }) => {
  const pL = 28,
    pR = 8,
    pT = 10,
    pB = 22;
  const cW = width - pL - pR,
    cH = height - pT - pB;
  const maxVal = 12,
    barW = Math.max(8, (cW / data.labels.length) * 0.5);
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient id="sleep_bar_g" x1="0" y1="0" x2="0" y2="1">
          <Stop
            offset="0%"
            stopColor={isEmpty ? "#C7D2FE" : "#6366F1"}
            stopOpacity={0.9}
          />
          <Stop
            offset="100%"
            stopColor={isEmpty ? "#E0E7FF" : "#A5B4FC"}
            stopOpacity={0.5}
          />
        </SvgLinearGradient>
      </Defs>
      {[0, 4, 8, 12].map((tick, i) => {
        const y = pT + cH - (tick / maxVal) * cH;
        return (
          <React.Fragment key={i}>
            <Line
              x1={pL}
              y1={y}
              x2={width - pR}
              y2={y}
              stroke="#f0f0f0"
              strokeWidth={0.8}
              strokeDasharray="3,3"
            />
            <SvgText
              x={pL - 4}
              y={y + 3}
              fontSize={7}
              fill="#c4c4cc"
              textAnchor="end"
            >
              {tick}h
            </SvgText>
          </React.Fragment>
        );
      })}
      {data.labels.map((lbl, i) => {
        const x = pL + (i / (data.labels.length - 1)) * cW;
        const val = isEmpty ? 0 : data.values[i];
        const barH = (val / maxVal) * cH;
        const y = pT + cH - barH;
        return (
          <React.Fragment key={i}>
            <Path
              d={`M ${x - barW / 2 + 3} ${y} Q ${x - barW / 2} ${y} ${x - barW / 2} ${y + 3} L ${x - barW / 2} ${pT + cH} L ${x + barW / 2} ${pT + cH} L ${x + barW / 2} ${y + 3} Q ${x + barW / 2} ${y} ${x + barW / 2 - 3} ${y} Z`}
              fill="url(#sleep_bar_g)"
              opacity={isEmpty ? 0.3 : 1}
            />
            <SvgText
              x={x}
              y={pT + cH + 13}
              fontSize={8}
              fill={isEmpty ? "#d1d5db" : "#9ca3af"}
              textAnchor="middle"
            >
              {lbl}
            </SvgText>
          </React.Fragment>
        );
      })}
      {isEmpty && (
        <SvgText
          x={pL + cW / 2}
          y={pT + cH / 2 + 4}
          fontSize={9}
          fill="#818CF8"
          textAnchor="middle"
          opacity={0.9}
        >
          Log sleep to see your pattern
        </SvgText>
      )}
    </Svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ARC RING
// ─────────────────────────────────────────────────────────────────────────────
const ArcRing = ({
  size = 100,
  r = 42,
  strokeW = 10,
  segments,
  bg = "#F3F4F6",
  children,
}) => {
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        style={{ transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={bg}
          strokeWidth={strokeW}
        />
        {segments.map((s, i) => {
          const dash = circ * s.pct - 3;
          const dashOff = -(circ * offset);
          offset += s.pct;
          return (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeW}
              strokeDasharray={`${dash} ${circ}`}
              strokeDashoffset={dashOff}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
      <View
        style={[
          StyleSheet.absoluteFill,
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CHIP ROW
// ─────────────────────────────────────────────────────────────────────────────
const AllChipRow = ({ active, onChipPress }) => {
  const listRef = useRef(null);
  const initIdx = Math.max(
    0,
    CATEGORIES.findIndex((c) => c.label === active),
  );
  const pillPos = useRef(new Animated.Value(initIdx * CHIP_ITEM_WIDTH)).current;
  const pillIdx = useRef(new Animated.Value(initIdx)).current;
  const pillW = useRef(new Animated.Value(CHIP_WIDTH)).current;
  const pillColor = pillIdx.interpolate({
    inputRange: C_IN,
    outputRange: C_OUT,
    extrapolate: "clamp",
  });

  const animateTo = useCallback((idx) => {
    Animated.parallel([
      Animated.spring(pillPos, { toValue: idx * CHIP_ITEM_WIDTH, ...SP_NAT }),
      Animated.spring(pillIdx, { toValue: idx, ...SP_JS }),
      Animated.spring(pillW, { toValue: CHIP_WIDTH, ...SP_JS }),
    ]).start();
  }, []);

  useEffect(() => {
    const idx = Math.max(
      0,
      CATEGORIES.findIndex((c) => c.label === active),
    );
    animateTo(idx);
    listRef.current?.scrollToIndex({
      index: idx,
      animated: true,
      viewPosition: 0.5,
    });
  }, [active]);

  const handlePress = useCallback(
    (label, index) => {
      animateTo(index);
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
      onChipPress(label);
    },
    [onChipPress, animateTo],
  );

  const renderChip = useCallback(
    ({ item: chip, index }) => {
      const isActive = active === chip.label;
      const isLast = index === CATEGORIES.length - 1;
      return (
        <View style={[shared.chipTouch, isLast && { marginRight: 0 }]}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => handlePress(chip.label, index)}
            style={{ width: "100%" }}
          >
            {isActive ? (
              <View style={shared.activeChipContainer}>
                <Text
                  weight="600"
                  style={[
                    shared.activeChipText,
                    { color: CHIP_ACTIVE_COLORS[chip.label]?.text ?? "#FFF" },
                  ]}
                >
                  {chip.label}
                </Text>
              </View>
            ) : (
              <View style={[shared.inactiveChip, { borderColor: chip.color }]}>
                <Text
                  weight="500"
                  style={[shared.inactiveChipText, { color: chip.color }]}
                >
                  {chip.label}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [active, handlePress],
  );

  const getItemLayout = useCallback(
    (_, index) => ({
      length: CHIP_ITEM_WIDTH,
      offset: CHIP_ITEM_WIDTH * index,
      index,
    }),
    [],
  );

  return (
    <View style={[shared.chipRowContainer, styles.chipBarBg]}>
      <View style={shared.chipRowInner}>
        <Animated.View
          pointerEvents="none"
          style={[
            shared.slidingPillOuter,
            { transform: [{ translateX: pillPos }] },
          ]}
        >
          <Animated.View
            style={[
              shared.slidingPillInner,
              { width: pillW, backgroundColor: pillColor },
            ]}
          />
        </Animated.View>
        <FlatList
          ref={listRef}
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item.label}
          renderItem={renderChip}
          getItemLayout={getItemLayout}
          showsHorizontalScrollIndicator={false}
          bounces={false}
          scrollEnabled={false}
          contentContainerStyle={shared.chipRow}
          style={{ flex: 1, zIndex: 10 }}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(
              () =>
                listRef.current?.scrollToIndex({
                  index,
                  animated: true,
                  viewPosition: 0.5,
                }),
              120,
            );
          }}
        />
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
const CategoryRow = ({ c, isEmpty }) => (
  <View style={styles.catRow}>
    <Text style={styles.catIcon}>{c.icon}</Text>
    <Text weight="400" style={styles.catName}>
      {c.name}
    </Text>
    {isEmpty ? (
      <View style={styles.catBarGhost} />
    ) : (
      <Text weight="700" style={styles.catVal}>
        {c.isText ? c.value : `${c.value}%`}
      </Text>
    )}
  </View>
);

const StatBox = ({ icon, label, value, isEmpty }) => (
  <View style={styles.statBox}>
    <Text style={styles.statIcon}>{icon}</Text>
    <View>
      <Text weight="400" style={styles.statLbl}>
        {label}
      </Text>
      <Text
        weight="800"
        style={[styles.statNum, isEmpty && { color: "#d1d5db" }]}
      >
        {isEmpty ? "—" : value}
      </Text>
    </View>
  </View>
);

const MacroBarRow = ({ m }) => (
  <View style={styles.macroBarItem}>
    <View style={styles.macroBarTop}>
      <Text weight="600" style={styles.macroName}>
        {m.label}
      </Text>
      <Text
        weight="400"
        style={[styles.macroAmt, m.pct === 0 && { color: "#d1d5db" }]}
      >
        {m.value}
      </Text>
    </View>
    <View style={styles.macroTrack}>
      {m.pct > 0 && (
        <View
          style={[
            styles.macroFill,
            { width: `${m.pct * 100}%`, backgroundColor: m.color },
          ]}
        />
      )}
    </View>
  </View>
);

const ActionButtons = ({ emptyLabels }) => (
  <View style={styles.actionRow}>
    {[
      {
        label: emptyLabels ? "+ Add Meal" : "Add Meal",
        colors: ["#A2DF71", "#F2FFEC", "#A2DF71"],
        textColor: "#3a7d0a",
      },
      {
        label: emptyLabels ? "+ Add Activity" : "Add Activity",
        colors: ["#FFB348", "#FFF0D5", "#FFB348"],
        textColor: "#92400e",
      },
    ].map((b) => (
      <TouchableOpacity
        key={b.label}
        activeOpacity={0.82}
        style={styles.actionBtnWrap}
      >
        <LinearGradient
          colors={b.colors}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.actionBtn}
        >
          <Text
            weight="700"
            style={[styles.actionBtnText, { color: b.textColor }]}
          >
            {b.label}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    ))}
  </View>
);

const WeeklyTrend = ({ isEmpty }) => (
  <View style={styles.trendSection}>
    <Text weight="700" style={styles.trendTitle}>
      Weekly Energy Trend
    </Text>
    <View style={[styles.trendCard, isEmpty && styles.trendCardEmpty]}>
      <View style={styles.trendLegend}>
        {[
          {
            label: "Calories Consumed",
            color: isEmpty ? "#DDD6FE" : "#7C3AED",
          },
          { label: "Calories Burned", color: isEmpty ? "#FBCFE8" : "#F472B6" },
        ].map((l) => (
          <View key={l.label} style={styles.legItem}>
            <View style={[styles.legDot, { backgroundColor: l.color }]} />
            <Text
              weight="400"
              style={[styles.legText, isEmpty && { color: "#d1d5db" }]}
            >
              {l.label}
            </Text>
          </View>
        ))}
      </View>
      <CustomLineChart
        data={
          isEmpty
            ? {
                labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                datasets: [
                  {
                    data: [0, 0, 0, 0, 0, 0],
                    color: "#DDD6FE",
                    gradientId: "wt_e1",
                  },
                  {
                    data: [0, 0, 0, 0, 0, 0],
                    color: "#FBCFE8",
                    gradientId: "wt_e2",
                  },
                ],
              }
            : {
                labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                datasets: [
                  {
                    data: [2000, 1600, 1800, 1500, 2100, 1900],
                    color: "#7C3AED",
                    gradientId: "wt_g1",
                  },
                  {
                    data: [900, 1000, 800, 950, 850, 1100],
                    color: "#F472B6",
                    gradientId: "wt_g2",
                  },
                ],
              }
        }
        width={CHART_WIDTH}
        height={130}
        isEmpty={isEmpty}
      />
    </View>
  </View>
);

const SectionHeader = ({ title, subtitle }) => (
  <View style={styles.sectionHead}>
    <Text weight="700" style={styles.sectionHeadTitle}>
      {title}
    </Text>
    <Text weight="400" style={styles.sectionHeadSub}>
      {subtitle}
    </Text>
  </View>
);

const EmptyStateCTA = ({ icon, message, color = "#7C3AED" }) => (
  <View style={[styles.emptyHintRow, { borderColor: color + "33" }]}>
    <Ionicons name={icon} size={13} color={color} />
    <Text weight="400" style={[styles.emptyHintText, { color }]}>
      {message}
    </Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// SCORE CARDS
// ─────────────────────────────────────────────────────────────────────────────
const ScoreCardFilled = () => (
  <View style={styles.scoreCard}>
    <View style={styles.scoreInner}>
      <View style={styles.scoreLeft}>
        <Text weight="700" style={styles.scoreCardTitle}>
          Your Wellness Score
        </Text>
        {WELLNESS_CATEGORIES.map((c) => (
          <CategoryRow key={c.name} c={c} isEmpty={false} />
        ))}
      </View>
      <ArcRing
        size={104}
        r={RING_R}
        strokeW={10}
        segments={SCORE_SEGMENTS}
        bg="#F3F4F6"
      >
        <Text weight="800" style={styles.ringPct}>
          76%
        </Text>
        <Text weight="400" style={styles.ringLbl}>
          Wellness
        </Text>
      </ArcRing>
    </View>
  </View>
);

const ScoreCardEmpty = () => (
  <View style={styles.scoreCard}>
    <View style={styles.scoreInner}>
      <View style={styles.scoreLeft}>
        <Text weight="700" style={styles.scoreCardTitle}>
          Your Wellness Score
        </Text>
        {WELLNESS_CATEGORIES.map((c) => (
          <CategoryRow key={c.name} c={c} isEmpty={true} />
        ))}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.trackBtnWrap,
            { marginTop: 10, alignSelf: "flex-start" },
          ]}
        >
          <LinearGradient
            colors={["#B148FF", "#F6339B", "#9914F9"]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[
              styles.trackBtn,
              { paddingHorizontal: 16, paddingVertical: 7 },
            ]}
          >
            <Text weight="600" style={[styles.trackBtnText, { fontSize: 10 }]}>
              Start Tracking
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      <ArcRing
        size={104}
        r={RING_R}
        strokeW={10}
        segments={SCORE_SEGMENTS_EMPTY}
        bg="#F3F4F6"
      >
        <Text weight="800" style={[styles.ringPct, { color: "#D8B4FE" }]}>
          0%
        </Text>
        <Text weight="400" style={styles.ringLbl}>
          Wellness
        </Text>
      </ArcRing>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// ENERGY CARDS
// ─────────────────────────────────────────────────────────────────────────────
const EnergyCardFilled = () => (
  <View style={styles.energyCard}>
    <View style={styles.energyTopRow}>
      <View style={styles.plateWrap}>
        <ArcRing
          size={114}
          r={PLATE_R}
          strokeW={11}
          segments={PLATE_SEGMENTS}
          bg="#F3F4F6"
        >
          <Image
            source={require("../../assets/food.webp")}
            style={styles.plateImg}
            resizeMode="contain"
          />
        </ArcRing>
        <View style={styles.kcalBadge}>
          <Text weight="700" style={styles.kcalBadgeText}>
            2000 kcal
          </Text>
        </View>
      </View>
      <View style={styles.energyRight}>
        <View style={styles.consumedRow}>
          <StatBox icon="🍽️" label="Consumed" value="989" isEmpty={false} />
          <StatBox icon="🔥" label="Burned" value="215" isEmpty={false} />
        </View>
        <View style={styles.macroGrid}>
          {MACROS.map((m) => (
            <MacroBarRow key={m.label} m={m} />
          ))}
        </View>
      </View>
    </View>
    <View style={styles.cardDivider} />
    <ActionButtons emptyLabels={false} />
    <WeeklyTrend isEmpty={false} />
  </View>
);

const EnergyCardEmpty = () => (
  <View style={styles.energyCard}>
    <View style={styles.energyTopRow}>
      <View style={styles.plateWrap}>
        <ArcRing
          size={114}
          r={PLATE_R}
          strokeW={11}
          segments={PLATE_SEGMENTS_EMPTY}
          bg="#F3F4F6"
        >
          <Image
            source={require("../../assets/food.webp")}
            style={[styles.plateImg, { opacity: 0.3 }]}
            resizeMode="contain"
          />
        </ArcRing>
        <View
          style={[
            styles.kcalBadge,
            { borderColor: "#E9D5FF", backgroundColor: "#FAF5FF" },
          ]}
        >
          <Text
            weight="700"
            style={[styles.kcalBadgeText, { color: "#C4B5FD" }]}
          >
            — kcal
          </Text>
        </View>
      </View>
      <View style={styles.energyRight}>
        <View style={styles.consumedRow}>
          <StatBox icon="🍽️" label="Consumed" value="—" isEmpty={true} />
          <StatBox icon="🔥" label="Burned" value="—" isEmpty={true} />
        </View>
        <View style={styles.macroGrid}>
          {MACROS_EMPTY.map((m) => (
            <MacroBarRow key={m.label} m={m} />
          ))}
        </View>
      </View>
    </View>
    <EmptyStateCTA
      icon="restaurant-outline"
      message="Add your first meal to start tracking your daily calories"
      color="#C084FC"
    />
    <View style={styles.cardDivider} />
    <ActionButtons emptyLabels={true} />
    <WeeklyTrend isEmpty={true} />
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// DAILY CALORIE BLOCK
// ─────────────────────────────────────────────────────────────────────────────
const DailyCalorieBlock = () => (
  <View style={styles.dailyBlock}>
    <View style={styles.dailyCard}>
      <LinearGradient
        colors={["#EAF4FB", "#EEF0FD", "#F5EEFF"]}
        locations={[0, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.dailyCardTop}
      >
        <View style={styles.dailyImgCol}>
          <View style={styles.dailyIconWrap}>
            <Image
              source={require("../../assets/foodplate.webp")}
              style={styles.dailyPlate}
              resizeMode="contain"
            />
          </View>
        </View>
        <View style={styles.dailyContent}>
          <Text weight="700" style={styles.dailyCardTitle}>
            Know your daily calorie needs
          </Text>
          <Text weight="400" style={styles.dailyCardSub}>
            Get a personalised intake plan based on your body type, age &
            lifestyle goals.
          </Text>
          <View style={styles.hintRow}>
            {[
              { label: "Maintain weight", color: "#A78BFA" },
              { label: "Lose fat", color: "#F87171" },
              { label: "Build muscle", color: "#34D399" },
            ].map((t) => (
              <View key={t.label} style={styles.hintChip}>
                <View style={[styles.hintDot, { backgroundColor: t.color }]} />
                <Text weight="600" style={styles.hintChipText}>
                  {t.label}
                </Text>
              </View>
            ))}
          </View>
          <TouchableOpacity activeOpacity={0.85} style={styles.calcBtnWrap}>
            <LinearGradient
              colors={["#B148FF", "#F6339B", "#9914F9"]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.calcBtn}
            >
              <Text weight="700" style={styles.calcBtnText} numberOfLines={1}>
                Calculate Now →
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
      <View style={styles.dailyStatsRow}>
        {[
          { key: "BMR", label: "Base Rate", color: "#A78BFA", bar: "#EDE9FE" },
          {
            key: "TDEE",
            label: "Total Burn",
            color: "#F472B6",
            bar: "#FCE7F3",
          },
          { key: "Macro", label: "Split", color: "#34D399", bar: "#D1FAE5" },
          { key: "Goal", label: "Timeline", color: "#FB923C", bar: "#FEE2B0" },
        ].map((s, i, arr) => (
          <View
            key={s.key}
            style={[
              styles.dailyStat,
              i < arr.length - 1 && styles.dailyStatBorder,
            ]}
          >
            <Text
              weight="800"
              style={[styles.dailyStatNum, { color: s.color }]}
            >
              {s.key}
            </Text>
            <Text weight="500" style={styles.dailyStatLbl}>
              {s.label}
            </Text>
            <View style={[styles.dailyStatBar, { backgroundColor: s.bar }]} />
          </View>
        ))}
      </View>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// REMINDERS BLOCK
// ─────────────────────────────────────────────────────────────────────────────
const RemindersBlock = () => (
  <View style={styles.remindersSection}>
    {/* Header */}
    <View style={styles.reminderHeader}>
      <View>
        <Text style={styles.reminderHeaderTitle} weight="800">
          Upcoming
        </Text>
        <Text style={styles.reminderHeaderSub}>
          {REMINDERS.length} reminders today
        </Text>
      </View>
      <TouchableOpacity style={styles.seeAllBtn}>
        <Text style={styles.seeAll}>See All</Text>
        <Ionicons name="chevron-forward" size={12} color="#9333EA" />
      </TouchableOpacity>
    </View>

    {/* Cards */}
    {REMINDERS.map((item, index) => (
      <View
        key={item.id}
        style={[styles.reminderItem, index === 0 && styles.reminderItemFirst]}
      >
        {/* Left accent bar */}
        <View
          style={[styles.accentBar, { backgroundColor: item.accentColor }]}
        />

        {/* Icon */}
        <View
          style={[styles.reminderIconWrap, { backgroundColor: item.iconBg }]}
        >
          <ReminderIcon item={item} />
          {item.urgent && <View style={styles.urgentDot} />}
        </View>

        {/* Content */}
        <View style={styles.reminderLeft}>
          <Text style={styles.reminderTitle} weight="700">
            {item.title}
          </Text>
          <View style={styles.reminderMeta}>
            <Ionicons name="time-outline" size={10} color="#9CA3AF" />
            <Text style={styles.reminderSubtitle}>{item.subtitle}</Text>
          </View>
        </View>

        {/* Right */}
        <View style={styles.reminderRight}>
          <View
            style={[styles.reminderTagPill, { backgroundColor: item.tagBg }]}
          >
            <View style={[styles.tagDot, { backgroundColor: item.tagColor }]} />
            <Text style={[styles.reminderTag, { color: item.tagColor }]}>
              {item.tag}
            </Text>
          </View>
          <TouchableOpacity activeOpacity={0.85}>
            <LinearGradient
              colors={item.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.reminderBtn}
            >
              <Text style={styles.reminderBtnText} weight="700">
                {item.btnLabel}
              </Text>
              <Ionicons name="arrow-forward" size={11} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    ))}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// OTHER TABS (Sleep, Nutrition, Fitness, Medicine, Menstrual) — UNCHANGED
// ─────────────────────────────────────────────────────────────────────────────
const SleepStageBar = ({ stage, isEmpty }) => (
  <View style={styles.sleepStageRow}>
    <View
      style={[
        styles.sleepStageDot,
        { backgroundColor: isEmpty ? "#E0E7FF" : stage.color },
      ]}
    />
    <Text weight="500" style={styles.sleepStageName}>
      {stage.label}
    </Text>
    <View style={styles.sleepStageTrack}>
      {stage.pct > 0 && (
        <View
          style={[
            styles.sleepStageFill,
            { width: `${stage.pct * 100}%`, backgroundColor: stage.color },
          ]}
        />
      )}
    </View>
    <Text
      weight="600"
      style={[styles.sleepStageVal, isEmpty && { color: "#d1d5db" }]}
    >
      {stage.value}
    </Text>
  </View>
);

const SleepCardFilled = () => (
  <View style={styles.sleepCard}>
    <View style={styles.sleepTopRow}>
      <ArcRing
        size={110}
        r={44}
        strokeW={10}
        segments={[
          { pct: 0.25, color: "#4F46E5" },
          { pct: 0.45, color: "#818CF8" },
          { pct: 0.2, color: "#A5B4FC" },
          { pct: 0.1, color: "#E0E7FF" },
        ]}
        bg="#F3F4F6"
      >
        <Text
          weight="800"
          style={[styles.ringPct, { fontSize: 18, color: "#4F46E5" }]}
        >
          7h 0m
        </Text>
        <Text weight="400" style={styles.ringLbl}>
          Total Sleep
        </Text>
      </ArcRing>
      <View style={{ flex: 1 }}>
        <View style={styles.sleepStatRow}>
          <View style={styles.sleepStatItem}>
            <Text style={{ fontSize: 16 }}>😴</Text>
            <Text weight="400" style={styles.statLbl}>
              Bedtime
            </Text>
            <Text weight="700" style={styles.sleepStatVal}>
              11:00 PM
            </Text>
          </View>
          <View style={styles.sleepStatItem}>
            <Text style={{ fontSize: 16 }}>⏰</Text>
            <Text weight="400" style={styles.statLbl}>
              Wake Up
            </Text>
            <Text weight="700" style={styles.sleepStatVal}>
              6:00 AM
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.sleepQualityBadge,
            { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" },
          ]}
        >
          <Text
            weight="700"
            style={[styles.sleepQualityText, { color: "#4F46E5" }]}
          >
            ⭐ Good Sleep Quality
          </Text>
        </View>
      </View>
    </View>
    <View style={styles.cardDivider} />
    <Text weight="700" style={styles.subSectionTitle}>
      Sleep Stages
    </Text>
    {SLEEP_STAGES.map((s) => (
      <SleepStageBar key={s.label} stage={s} isEmpty={false} />
    ))}
    <View style={styles.cardDivider} />
    <Text weight="700" style={styles.subSectionTitle}>
      Weekly Sleep Pattern
    </Text>
    <SleepBarChart
      data={{
        labels: ["M", "T", "W", "T", "F", "S", "S"],
        values: [7.5, 6.0, 8.0, 7.0, 6.5, 9.0, 7.5],
      }}
      width={CHART_WIDTH}
      height={110}
      isEmpty={false}
    />
  </View>
);

const SleepCardEmpty = () => (
  <View style={styles.sleepCard}>
    <View style={styles.sleepTopRow}>
      <ArcRing
        size={110}
        r={44}
        strokeW={10}
        segments={[
          { pct: 0.25, color: "#C7D2FE" },
          { pct: 0.45, color: "#DDE3FE" },
          { pct: 0.2, color: "#E0E7FF" },
          { pct: 0.1, color: "#EEF2FF" },
        ]}
        bg="#F3F4F6"
      >
        <Text
          weight="800"
          style={[styles.ringPct, { fontSize: 18, color: "#C7D2FE" }]}
        >
          —
        </Text>
        <Text weight="400" style={styles.ringLbl}>
          Total Sleep
        </Text>
      </ArcRing>
      <View style={{ flex: 1 }}>
        <View style={styles.sleepStatRow}>
          <View style={styles.sleepStatItem}>
            <Text style={{ fontSize: 16 }}>😴</Text>
            <Text weight="400" style={styles.statLbl}>
              Bedtime
            </Text>
            <Text
              weight="700"
              style={[styles.sleepStatVal, { color: "#d1d5db" }]}
            >
              —
            </Text>
          </View>
          <View style={styles.sleepStatItem}>
            <Text style={{ fontSize: 16 }}>⏰</Text>
            <Text weight="400" style={styles.statLbl}>
              Wake Up
            </Text>
            <Text
              weight="700"
              style={[styles.sleepStatVal, { color: "#d1d5db" }]}
            >
              —
            </Text>
          </View>
        </View>
        <EmptyStateCTA
          icon="moon-outline"
          message="Log your sleep to track quality and patterns"
          color="#818CF8"
        />
      </View>
    </View>
    <View style={styles.cardDivider} />
    <Text weight="700" style={styles.subSectionTitle}>
      Sleep Stages
    </Text>
    {SLEEP_STAGES_EMPTY.map((s) => (
      <SleepStageBar key={s.label} stage={s} isEmpty={true} />
    ))}
    <View style={styles.cardDivider} />
    <Text weight="700" style={styles.subSectionTitle}>
      Weekly Sleep Pattern
    </Text>
    <SleepBarChart
      data={{
        labels: ["M", "T", "W", "T", "F", "S", "S"],
        values: [0, 0, 0, 0, 0, 0, 0],
      }}
      width={CHART_WIDTH}
      height={110}
      isEmpty={true}
    />
  </View>
);

const SleepTipsBlock = () => (
  <View style={styles.tipsBlock}>
    <Text weight="700" style={styles.tipsTitle}>
      💡 Sleep Tips
    </Text>
    {[
      {
        tip: "Maintain a consistent sleep schedule, even on weekends.",
        icon: "🕙",
      },
      {
        tip: "Avoid screens 1 hour before bedtime to improve melatonin.",
        icon: "📵",
      },
      { tip: "Keep your bedroom cool (18–20°C) for deeper sleep.", icon: "❄️" },
    ].map((t, i) => (
      <View key={i} style={styles.tipRow}>
        <Text style={{ fontSize: 14 }}>{t.icon}</Text>
        <Text weight="400" style={styles.tipText}>
          {t.tip}
        </Text>
      </View>
    ))}
  </View>
);

const FitnessMetricCard = ({ m, isEmpty }) => (
  <View style={styles.fitnessMetricCard}>
    <Text style={{ fontSize: 20 }}>{m.icon}</Text>
    <Text weight="400" style={styles.fitnessMetricLabel}>
      {m.label}
    </Text>
    <Text
      weight="800"
      style={[styles.fitnessMetricVal, isEmpty && { color: "#d1d5db" }]}
    >
      {m.value}
    </Text>
    <Text weight="400" style={styles.fitnessMetricTarget}>
      / {m.target}
    </Text>
    <View style={styles.fitnessMetricTrack}>
      {m.pct > 0 && (
        <View
          style={[
            styles.fitnessMetricFill,
            { width: `${m.pct * 100}%`, backgroundColor: m.color },
          ]}
        />
      )}
    </View>
  </View>
);
const FitnessWeekStreak = ({ isEmpty }) => (
  <View style={styles.streakRow}>
    {FITNESS_WEEKLY.map((d, i) => (
      <View key={i} style={styles.streakDay}>
        <View
          style={[
            styles.streakCircle,
            isEmpty
              ? { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" }
              : d.active
                ? { backgroundColor: "#22C55E", borderColor: "#16A34A" }
                : { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" },
          ]}
        >
          {!isEmpty && d.active && (
            <Ionicons name="checkmark" size={10} color="#fff" />
          )}
        </View>
        <Text
          weight="500"
          style={[styles.streakDayLabel, isEmpty && { color: "#d1d5db" }]}
        >
          {d.day}
        </Text>
        {!isEmpty && d.active && (
          <Text weight="400" style={styles.streakMins}>
            {d.mins}m
          </Text>
        )}
      </View>
    ))}
  </View>
);

const WorkoutCard = ({ isEmpty }) => (
  <View style={styles.workoutCard}>
    <View style={styles.workoutCardHeader}>
      <Text weight="700" style={styles.subSectionTitle}>
        Last Workout
      </Text>
      {!isEmpty && (
        <View
          style={[
            styles.sleepQualityBadge,
            { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" },
          ]}
        >
          <Text
            weight="600"
            style={[styles.sleepQualityText, { color: "#16A34A" }]}
          >
            Yesterday
          </Text>
        </View>
      )}
    </View>
    {isEmpty ? (
      <EmptyStateCTA
        icon="barbell-outline"
        message="Log a workout to see your activity history"
        color="#86EFAC"
      />
    ) : (
      <View style={styles.workoutDetails}>
        {[
          { icon: "🏃", label: "Running", sub: "5.2 km · 32 min" },
          { icon: "🔥", label: "342 kcal burned", sub: "" },
          { icon: "💓", label: "Avg HR: 148 bpm", sub: "" },
        ].map((w, i) => (
          <View key={i} style={styles.workoutRow}>
            <Text style={{ fontSize: 14 }}>{w.icon}</Text>
            <View>
              <Text weight="600" style={styles.workoutLabel}>
                {w.label}
              </Text>
              {w.sub !== "" && (
                <Text weight="400" style={styles.workoutSub}>
                  {w.sub}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    )}
  </View>
);

const MedicineRow = ({ med, isEmpty }) => (
  <View style={[styles.medicineRow, isEmpty && { opacity: 0.4 }]}>
    <View
      style={[styles.medicineIconWrap, { backgroundColor: med.color + "20" }]}
    >
      <Text style={{ fontSize: 16 }}>{med.icon}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text weight="700" style={styles.medicineName}>
        {med.name}
      </Text>
      <Text weight="400" style={styles.medicineMeta}>
        {med.dose}
        {med.time ? ` · ${med.time}` : ""}
      </Text>
    </View>
    {!isEmpty && (
      <View
        style={[
          styles.medicineTakenBadge,
          {
            backgroundColor: med.taken ? "#DCFCE7" : "#FEF3C7",
            borderColor: med.taken ? "#86EFAC" : "#FDE68A",
          },
        ]}
      >
        <Text
          weight="600"
          style={[
            styles.medicineTakenText,
            { color: med.taken ? "#16A34A" : "#D97706" },
          ]}
        >
          {med.taken ? "✓ Taken" : "Pending"}
        </Text>
      </View>
    )}
  </View>
);

const MedicineCard = ({ hasData }) => (
  <View style={styles.medicineCard}>
    <View style={styles.medicineCardHeader}>
      <Text weight="700" style={styles.subSectionTitle}>
        Today's Medicines
      </Text>
      {hasData && (
        <Text weight="600" style={styles.medicineProg}>
          2/4 taken
        </Text>
      )}
    </View>
    {hasData ? (
      MEDICINES.map((m) => <MedicineRow key={m.name} med={m} isEmpty={false} />)
    ) : (
      <EmptyStateCTA
        icon="medical-outline"
        message="Add your medicines to get daily reminders and track adherence"
        color="#A855F7"
      />
    )}
    <View style={styles.cardDivider} />
    <TouchableOpacity activeOpacity={0.85} style={styles.actionBtnWrap}>
      <LinearGradient
        colors={["#DDD6FE", "#F5F3FF", "#DDD6FE"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.actionBtn}
      >
        <Text weight="700" style={[styles.actionBtnText, { color: "#7C3AED" }]}>
          + Add Medicine
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  </View>
);

const AdherenceBlock = ({ hasData }) => (
  <View style={styles.adherenceBlock}>
    <Text weight="700" style={styles.subSectionTitle}>
      Weekly Adherence
    </Text>
    <View style={styles.adherenceRow}>
      {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => {
        const pct = hasData ? [1, 0.75, 1, 0.5, 0, 0, 0][i] : 0;
        const color = pct >= 1 ? "#A855F7" : pct > 0 ? "#DDD6FE" : "#F3F4F6";
        return (
          <View key={i} style={styles.adherenceDay}>
            <View
              style={[
                styles.adherenceBar,
                {
                  height: hasData ? Math.max(8, pct * 36) : 8,
                  backgroundColor: color,
                },
              ]}
            />
            <Text
              weight="400"
              style={[styles.streakDayLabel, !hasData && { color: "#d1d5db" }]}
            >
              {day}
            </Text>
          </View>
        );
      })}
    </View>
    {!hasData && (
      <Text
        weight="400"
        style={[styles.sectionHeadSub, { textAlign: "center", marginTop: 6 }]}
      >
        Add medicines to track weekly adherence
      </Text>
    )}
  </View>
);

const CyclePhaseRow = ({ phase, isEmpty }) => (
  <View style={styles.cyclePhaseRow}>
    <Text style={{ fontSize: 14 }}>{phase.icon}</Text>
    <View style={{ flex: 1 }}>
      <Text weight="600" style={styles.cyclePhaseName}>
        {phase.label}
      </Text>
      <Text weight="400" style={styles.cyclePhaseDays}>
        {phase.days}
      </Text>
    </View>
    <View style={styles.cyclePhaseTrack}>
      {!isEmpty && (
        <View
          style={[
            styles.cyclePhaseFill,
            { width: `${phase.pct * 100}%`, backgroundColor: phase.color },
          ]}
        />
      )}
    </View>
    <Text
      weight="600"
      style={[styles.cyclePhaseLen, isEmpty && { color: "#d1d5db" }]}
    >
      {isEmpty ? "—" : `${Math.round(phase.pct * 28)}d`}
    </Text>
  </View>
);

const CycleCard = ({ hasData }) => (
  <View style={styles.cycleCard}>
    <View style={styles.cycleTopRow}>
      <ArcRing
        size={114}
        r={PLATE_R}
        strokeW={11}
        segments={hasData ? CYCLE_SEGMENTS : CYCLE_SEGMENTS_EMPTY}
        bg="#F3F4F6"
      >
        <Text style={{ fontSize: 24 }}>🌸</Text>
        <Text
          weight="700"
          style={[styles.ringLbl, { fontSize: 9, marginTop: 2 }]}
        >
          Day 8
        </Text>
      </ArcRing>
      <View style={{ flex: 1 }}>
        {hasData ? (
          <>
            <View
              style={[
                styles.sleepQualityBadge,
                {
                  backgroundColor: "#FEF3C7",
                  borderColor: "#FDE68A",
                  marginBottom: 8,
                },
              ]}
            >
              <Text
                weight="700"
                style={[styles.sleepQualityText, { color: "#D97706" }]}
              >
                🌱 Follicular Phase
              </Text>
            </View>
            <View style={styles.cycleStatGrid}>
              {[
                { label: "Cycle Day", value: "8", icon: "📅" },
                { label: "Next Period", value: "20 days", icon: "🔮" },
                { label: "Cycle Length", value: "28 days", icon: "🔄" },
                { label: "Period Length", value: "5 days", icon: "📊" },
              ].map((s) => (
                <View key={s.label} style={styles.cycleStatItem}>
                  <Text style={{ fontSize: 13 }}>{s.icon}</Text>
                  <Text weight="700" style={styles.cycleStatVal}>
                    {s.value}
                  </Text>
                  <Text weight="400" style={styles.cycleStatLbl}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <View
              style={[
                styles.sleepQualityBadge,
                {
                  backgroundColor: "#FDF2F8",
                  borderColor: "#FBCFE8",
                  marginBottom: 8,
                },
              ]}
            >
              <Text
                weight="700"
                style={[styles.sleepQualityText, { color: "#DB2777" }]}
              >
                🌸 Start Tracking
              </Text>
            </View>
            <EmptyStateCTA
              icon="calendar-outline"
              message="Log your period to predict your next cycle and fertile window"
              color="#F472B6"
            />
          </>
        )}
      </View>
    </View>
    <View style={styles.cardDivider} />
    <Text weight="700" style={styles.subSectionTitle}>
      Cycle Phases
    </Text>
    {CYCLE_PHASES.map((p) => (
      <CyclePhaseRow key={p.label} phase={p} isEmpty={!hasData} />
    ))}
  </View>
);

const SymptomsBlock = ({ hasData }) => (
  <View style={styles.symptomsBlock}>
    <View style={styles.medicineCardHeader}>
      <Text weight="700" style={styles.subSectionTitle}>
        Today's Symptoms
      </Text>
      <TouchableOpacity activeOpacity={0.7}>
        <Text weight="600" style={styles.manageText}>
          + Log
        </Text>
      </TouchableOpacity>
    </View>
    <View style={styles.symptomsGrid}>
      {SYMPTOMS.map((s) => (
        <View
          key={s.label}
          style={[
            styles.symptomChip,
            {
              backgroundColor: hasData && s.active ? s.color + "20" : "#F9FAFB",
              borderColor: hasData && s.active ? s.color + "60" : "#E5E7EB",
            },
          ]}
        >
          <View
            style={[
              styles.symptomDot,
              { backgroundColor: hasData && s.active ? s.color : "#D1D5DB" },
            ]}
          />
          <Text
            weight={hasData && s.active ? "700" : "400"}
            style={[
              styles.symptomLabel,
              { color: hasData && s.active ? s.color : "#9CA3AF" },
            ]}
          >
            {s.label}
          </Text>
        </View>
      ))}
    </View>
    {!hasData && (
      <Text
        weight="400"
        style={[styles.sectionHeadSub, { textAlign: "center", marginTop: 8 }]}
      >
        Log symptoms to track patterns across your cycle
      </Text>
    )}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// ALL TAB — MINI DASHBOARD CARDS
// ─────────────────────────────────────────────────────────────────────────────
const SleepMiniCard = ({ hasData, onPress }) => {
  const stages = [
    { pct: 0.25, color: "#4F46E5" },
    { pct: 0.45, color: "#818CF8" },
    { pct: 0.2, color: "#A5B4FC" },
    { pct: 0.1, color: "#E0E7FF" },
  ];
  const emptyStages = [
    { pct: 0.25, color: "#C7D2FE" },
    { pct: 0.45, color: "#DDE3FE" },
    { pct: 0.2, color: "#E0E7FF" },
    { pct: 0.1, color: "#EEF2FF" },
  ];
  const r = 28,
    sz = 64,
    strokeW = 7,
    circ = 2 * Math.PI * r;
  const segs = hasData ? stages : emptyStages;
  let offset = 0;
  return (
    <TouchableOpacity activeOpacity={0.85} style={d.miniCard} onPress={onPress}>
      <View style={d.mcHeader}>
        <Text weight="600" style={d.mcLabel}>
          Sleep
        </Text>
        <Text style={d.mcEmoji}>🌙</Text>
      </View>
      <View style={d.mcCenter}>
        <View style={{ width: sz, height: sz }}>
          <Svg
            width={sz}
            height={sz}
            style={{ transform: [{ rotate: "-90deg" }] }}
          >
            <Circle
              cx={sz / 2}
              cy={sz / 2}
              r={r}
              fill="none"
              stroke="#F3F4F6"
              strokeWidth={strokeW}
            />
            {segs.map((sg, i) => {
              const dash = circ * sg.pct - 2,
                dashOff = -(circ * offset);
              offset += sg.pct;
              return (
                <Circle
                  key={i}
                  cx={sz / 2}
                  cy={sz / 2}
                  r={r}
                  fill="none"
                  stroke={sg.color}
                  strokeWidth={strokeW}
                  strokeDasharray={`${dash} ${circ}`}
                  strokeDashoffset={dashOff}
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>
          <View
            style={[
              StyleSheet.absoluteFill,
              { alignItems: "center", justifyContent: "center" },
            ]}
          >
            <Text
              weight="700"
              style={[d.ringVal, { color: hasData ? "#4F46E5" : "#C7D2FE" }]}
            >
              {hasData ? "7h" : "—"}
            </Text>
          </View>
        </View>
      </View>
      <View style={d.mcFooter}>
        {hasData ? (
          <View style={[d.badge, { backgroundColor: "#EEF2FF" }]}>
            <Text weight="600" style={[d.badgeText, { color: "#4F46E5" }]}>
              Good Sleep
            </Text>
          </View>
        ) : (
          <Text weight="400" style={d.emptyTxt}>
            Not logged
          </Text>
        )}
      </View>
      <View style={d.stageRow}>
        {(hasData
          ? [
              { label: "Deep", val: "1h45m", color: "#4F46E5" },
              { label: "REM", val: "1h25m", color: "#A5B4FC" },
            ]
          : [
              { label: "Deep", val: "—", color: "#C7D2FE" },
              { label: "REM", val: "—", color: "#C7D2FE" },
            ]
        ).map((sg) => (
          <View key={sg.label} style={d.stageCol}>
            <View style={[d.dot, { backgroundColor: sg.color }]} />
            <Text weight="400" style={d.stageLbl}>
              {sg.label}
            </Text>
            <Text weight="700" style={[d.stageVal, { color: sg.color }]}>
              {sg.val}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
};

const FitnessMiniCard = ({ hasData, onPress }) => {
  const metrics = hasData
    ? [
        { label: "Steps", val: "8,420", pct: 0.84, color: "#22C55E" },
        { label: "Cal", val: "342", pct: 0.68, color: "#F97316" },
        { label: "Water", val: "1.8L", pct: 0.72, color: "#3B82F6" },
        { label: "Mins", val: "38m", pct: 0.63, color: "#8B5CF6" },
      ]
    : [
        { label: "Steps", val: "—", pct: 0, color: "#86EFAC" },
        { label: "Cal", val: "—", pct: 0, color: "#FDBA74" },
        { label: "Water", val: "—", pct: 0, color: "#93C5FD" },
        { label: "Mins", val: "—", pct: 0, color: "#C4B5FD" },
      ];
  const weekly = [true, true, false, true, true, false, true];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <TouchableOpacity activeOpacity={0.85} style={d.miniCard} onPress={onPress}>
      <View style={d.mcHeader}>
        <Text weight="600" style={d.mcLabel}>
          Fitness
        </Text>
        <Text style={d.mcEmoji}>🏃</Text>
      </View>
      <View style={d.fitMetricsCol}>
        {metrics.map((m) => (
          <View key={m.label} style={d.fitRow}>
            <Text weight="400" style={d.fitLbl}>
              {m.label}
            </Text>
            <View style={d.fitTrack}>
              {m.pct > 0 && (
                <View
                  style={[
                    d.fitFill,
                    { width: `${m.pct * 100}%`, backgroundColor: m.color },
                  ]}
                />
              )}
            </View>
            <Text
              weight="700"
              style={[d.fitVal, { color: m.pct > 0 ? m.color : "#d1d5db" }]}
            >
              {m.val}
            </Text>
          </View>
        ))}
      </View>
      <View style={d.weekRow}>
        {days.map((dy, i) => (
          <View
            key={i}
            style={[
              d.weekDot,
              {
                backgroundColor: hasData && weekly[i] ? "#22C55E" : "#F3F4F6",
                borderColor: hasData && weekly[i] ? "#16A34A" : "#E5E7EB",
              },
            ]}
          >
            <Text
              weight="500"
              style={[
                d.weekLbl,
                { color: hasData && weekly[i] ? "#fff" : "#9ca3af" },
              ]}
            >
              {dy}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
};

const MedicineMiniCard = ({ hasData, onPress }) => {
  const meds = [
    { name: "Vitamin D3", taken: true, color: "#F59E0B" },
    { name: "Omega-3", taken: true, color: "#3B82F6" },
    { name: "Iron Tablet", taken: false, color: "#EF4444" },
    { name: "Magnesium", taken: false, color: "#8B5CF6" },
  ];
  const r = 24,
    sz = 56,
    strokeW = 7,
    circ = 2 * Math.PI * r,
    pct = hasData ? 0.5 : 0;
  return (
    <TouchableOpacity activeOpacity={0.85} style={d.miniCard} onPress={onPress}>
      <View style={d.mcHeader}>
        <Text weight="600" style={d.mcLabel}>
          Medicine
        </Text>
        <Text style={d.mcEmoji}>💊</Text>
      </View>
      <View style={d.medLayout}>
        <View style={{ width: sz, height: sz, flexShrink: 0 }}>
          <Svg
            width={sz}
            height={sz}
            style={{ transform: [{ rotate: "-90deg" }] }}
          >
            <Circle
              cx={sz / 2}
              cy={sz / 2}
              r={r}
              fill="none"
              stroke="#F3E8FF"
              strokeWidth={strokeW}
            />
            {pct > 0 && (
              <Circle
                cx={sz / 2}
                cy={sz / 2}
                r={r}
                fill="none"
                stroke="#A855F7"
                strokeWidth={strokeW}
                strokeDasharray={`${circ * pct - 2} ${circ}`}
                strokeDashoffset={0}
                strokeLinecap="round"
              />
            )}
          </Svg>
          <View
            style={[
              StyleSheet.absoluteFill,
              { alignItems: "center", justifyContent: "center" },
            ]}
          >
            <Text
              weight="700"
              style={[
                d.ringVal,
                { color: hasData ? "#A855F7" : "#DDD6FE", fontSize: 12 },
              ]}
            >
              {hasData ? "2/4" : "—"}
            </Text>
          </View>
        </View>
        <View style={d.medList}>
          {hasData ? (
            meds.map((m) => (
              <View key={m.name} style={d.medRow}>
                <View
                  style={[
                    d.dot,
                    { backgroundColor: m.taken ? m.color : "#E5E7EB" },
                  ]}
                />
                <Text
                  weight={m.taken ? "600" : "400"}
                  style={[
                    d.medName,
                    { color: m.taken ? "#1a1a2e" : "#9ca3af" },
                  ]}
                >
                  {m.name}
                </Text>
                {m.taken && (
                  <Ionicons name="checkmark-circle" size={10} color={m.color} />
                )}
              </View>
            ))
          ) : (
            <Text weight="400" style={d.emptyTxt}>
              No medicines added
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const CycleMiniCard = ({ hasData, onPress }) => {
  const cycleSegs = [
    { pct: 0.17, color: "#EF4444" },
    { pct: 0.27, color: "#22C55E" },
    { pct: 0.06, color: "#F59E0B" },
    { pct: 0.5, color: "#8B5CF6" },
  ];
  const emptySegs = [
    { pct: 0.17, color: "#FECACA" },
    { pct: 0.27, color: "#BBF7D0" },
    { pct: 0.06, color: "#FDE68A" },
    { pct: 0.5, color: "#DDD6FE" },
  ];
  const r = 28,
    sz = 64,
    strokeW = 7,
    circ = 2 * Math.PI * r;
  const segs = hasData ? cycleSegs : emptySegs;
  let offset = 0;
  const symptoms = [
    { label: "Cramps", color: "#EF4444" },
    { label: "Bloating", color: "#F97316" },
    { label: "Fatigue", color: "#F59E0B" },
  ];
  return (
    <TouchableOpacity activeOpacity={0.85} style={d.miniCard} onPress={onPress}>
      <View style={d.mcHeader}>
        <Text weight="600" style={d.mcLabel}>
          Cycle
        </Text>
        <Text style={d.mcEmoji}>🌸</Text>
      </View>
      <View style={d.mcCenter}>
        <View style={{ width: sz, height: sz }}>
          <Svg
            width={sz}
            height={sz}
            style={{ transform: [{ rotate: "-90deg" }] }}
          >
            <Circle
              cx={sz / 2}
              cy={sz / 2}
              r={r}
              fill="none"
              stroke="#F3F4F6"
              strokeWidth={strokeW}
            />
            {segs.map((sg, i) => {
              const dash = circ * sg.pct - 2,
                dashOff = -(circ * offset);
              offset += sg.pct;
              return (
                <Circle
                  key={i}
                  cx={sz / 2}
                  cy={sz / 2}
                  r={r}
                  fill="none"
                  stroke={sg.color}
                  strokeWidth={strokeW}
                  strokeDasharray={`${dash} ${circ}`}
                  strokeDashoffset={dashOff}
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>
          <View
            style={[
              StyleSheet.absoluteFill,
              { alignItems: "center", justifyContent: "center" },
            ]}
          >
            <Text style={{ fontSize: 18 }}>🌸</Text>
          </View>
        </View>
      </View>
      {hasData ? (
        <>
          <View
            style={[
              d.badge,
              { backgroundColor: "#FEF3C7", alignSelf: "center", marginTop: 4 },
            ]}
          >
            <Text weight="600" style={[d.badgeText, { color: "#D97706" }]}>
              Follicular · Day 8
            </Text>
          </View>
          <View style={d.sympChips}>
            {symptoms.map((sy) => (
              <View
                key={sy.label}
                style={[
                  d.sympChip,
                  {
                    backgroundColor: sy.color + "20",
                    borderColor: sy.color + "60",
                  },
                ]}
              >
                <Text weight="600" style={[d.sympText, { color: sy.color }]}>
                  {sy.label}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text
          weight="400"
          style={[d.emptyTxt, { textAlign: "center", marginTop: 6 }]}
        >
          Log period to start tracking
        </Text>
      )}
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ALL TAB
// ─────────────────────────────────────────────────────────────────────────────
const AllTab = ({
  hasData,
  onNavigateSleep,
  onNavigateFitness,
  onNavigateMedicine,
  onNavigateMenstrual,
  filledCards, // ← add
  toggleCard, // ← add
}) => (
  <>
    {/* ─── SECTION 4: Health Wellness ─── */}
    <View style={styles.wellnessSection}>
      <Text style={styles.wellnessTitle} weight="700">
        Health Wellness
      </Text>
      <ScrollView
        horizontal
        nestedScrollEnabled={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.wellnessScroll}
      >
        {WELLNESS_ITEMS.map((item) => {
          const isFilled = filledCards.has(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.8}
              onPress={() => toggleCard(item.id)}
              style={[styles.wellnessCard, { backgroundColor: item.bg }]}
            >
              <View style={styles.wellnessIconRow}>
                <Ionicons
                  name={item.iconName}
                  size={15}
                  color={item.iconColor}
                />
                <Text style={styles.wellnessLabel}>{item.label}</Text>
                {isFilled && (
                  <View
                    style={[styles.checkBadge, { backgroundColor: item.bar }]}
                  >
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                )}
              </View>

              <Text
                style={[
                  styles.wellnessValue,
                  !isFilled && styles.wellnessValueEmpty,
                ]}
                weight="700"
              >
                {isFilled ? item.value : "--"}
              </Text>

              <Text style={styles.wellnessUnit}>
                {isFilled ? item.unit : ""}
              </Text>

              {!isFilled && <Text style={styles.tapHint}>tap to track</Text>}

              <View style={styles.wellnessBarBg}>
                <View
                  style={[
                    styles.wellnessBarFill,
                    {
                      backgroundColor: item.bar,
                      width: isFilled
                        ? `${Math.round(item.barFill * 100)}%`
                        : "0%",
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
    <View style={d.container}>
      <View style={d.sectionHead}>
        <Text weight="700" style={d.sectionTitle}>
          Today's Energy Status
        </Text>
        <Text weight="400" style={d.sectionSub}>
          Track meals & activity to see your calorie balance.
        </Text>
      </View>
      {hasData ? <EnergyCardFilled /> : <EnergyCardEmpty />}

      <View style={[d.sectionHead, { marginTop: 22 }]}>
        <Text weight="700" style={d.sectionTitle}>
          Health Dashboard
        </Text>
        <Text weight="400" style={d.sectionSub}>
          Your key vitals at a glance.
        </Text>
      </View>
      <View style={d.dashGrid}>
        <SleepMiniCard hasData={hasData} onPress={onNavigateSleep} />
        <FitnessMiniCard hasData={hasData} onPress={onNavigateFitness} />
      </View>
      <View style={[d.dashGrid, { marginTop: 10 }]}>
        <MedicineMiniCard hasData={hasData} onPress={onNavigateMedicine} />
        <CycleMiniCard hasData={hasData} onPress={onNavigateMenstrual} />
      </View>
      <RemindersBlock />
      <DailyCalorieBlock />
    </View>
    <WellnessInsightsCard />
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function WellnessHeaderSection({
  onNavigateSleep,
  onNavigateNutrition,
  onNavigateFitness,
  onNavigateMedicine,
  onNavigateMentrual,
  hideHeader = false,
}) {
  const topOffset = getTopOffset();
  const [active, setActive] = useState("All");
  const [filledCards, setFilledCards] = useState(new Set());
  const toggleCard = useCallback((id) => {
    setFilledCards((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const { scrollHandler, heroAnimatedStyle } = useParallaxHeader();

  const scoreOp = useRef(new Animated.Value(0)).current;
  const scoreY = useRef(new Animated.Value(24)).current;
  const bodyOp = useRef(new Animated.Value(0)).current;
  const bodyY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    scoreOp.setValue(0);
    scoreY.setValue(24);
    bodyOp.setValue(0);
    bodyY.setValue(24);
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.spring(scoreOp, { toValue: 1, ...SP_CONTENT }),
        Animated.spring(scoreY, { toValue: 0, ...SP_CONTENT }),
        Animated.spring(bodyOp, { toValue: 1, ...SP_CONTENT }),
        Animated.spring(bodyY, { toValue: 0, ...SP_CONTENT }),
      ]).start();
    }, 400);
    return () => clearTimeout(t);
  }, [active]);

  const handleChipPress = useCallback(
    (label) => {
      // Only update active state for "All" tab
      if (label === "All") {
        setActive("All");
      } else {
        // Navigate to respective pages for other tabs
        switch (label) {
          case "Sleep":
            onNavigateSleep?.();
            break;
          case "Nutrition":
            onNavigateNutrition?.();
            break;
          case "Fitness":
            onNavigateFitness?.();
            break;
          case "Medicine":
            onNavigateMedicine?.();
            break;
          case "Mentrual":
            onNavigateMentrual?.();
            break;
          default:
            break;
        }
      }
    },
    [
      onNavigateSleep,
      onNavigateNutrition,
      onNavigateFitness,
      onNavigateMedicine,
      onNavigateMentrual,
    ],
  );

  const renderActiveTab = () => {
    // Only render content for "All" tab
    // Other tabs will navigate away, so we don't need to render anything else
    return (
      <AllTab
        hasData={HAS_DATA}
        filledCards={filledCards} // ← add
        toggleCard={toggleCard}
        onNavigateSleep={() => handleChipPress("Sleep")}
        onNavigateFitness={() => handleChipPress("Fitness")}
        onNavigateMedicine={() => handleChipPress("Medicine")}
        onNavigateMenstrual={() => handleChipPress("Mentrual")}
      />
    );
  };

  const gradientMap = {
    All: ["#CD8CFF", "#E5A8D0", "#F5CBA4", "#F3EFEB"],
    Sleep: ["#6366F1", "#818CF8", "#C7D2FE", "#EEF2FF"],
    Nutrition: ["#EF4444", "#F97316", "#FBBF24", "#FEF3C7"],
    Fitness: ["#22C55E", "#4ADE80", "#A7F3D0", "#F0FDF4"],
    Medicine: ["#A855F7", "#C084FC", "#DDD6FE", "#F5F3FF"],
    Mentrual: ["#F472B6", "#F9A8D4", "#FBCFE8", "#FDF2F8"],
  };
  const gradColors = gradientMap[active] || gradientMap["All"];

  return (
    <View style={shared.screen}>
      {/* ── HEADER ── */}
      {!hideHeader && (
        <View style={[shared.headerBlock, { paddingTop: topOffset }]}>
          <View style={shared.headerRow}>
            <TouchableOpacity activeOpacity={0.8} style={shared.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#7C3AED" />
            </TouchableOpacity>
            <View style={shared.titleWrap}>
              <Text weight="700" style={shared.headerTitle}>
                Health Wellness
              </Text>
              <Text weight="400" style={shared.headerSubtitle}>
                Build healthy habits, one day at a time.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── CHIP BAR ── */}
      {!hideHeader && <AllChipRow active={active} onChipPress={handleChipPress} />}

      {/* ── SCROLL BODY ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={shared.scrollContent}
        onScroll={scrollHandler}
        nestedScrollEnabled={true}
        scrollEventThrottle={16}
      >
        <View style={styles.mainSection}>
          <View style={heroAnimatedStyle}>
            {/* Diagonal gradient hero */}
            <LinearGradient
              colors={gradColors}
              locations={[0, 0.35, 0.7, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.diagGradient}
            />

            {/* Score card */}
            <Animated.View
              style={[
                styles.scoreAnimWrap,
                { opacity: scoreOp, transform: [{ translateY: scoreY }] },
              ]}
            >
              <View style={styles.scoreCardOuter}>
                {HAS_DATA ? <ScoreCardFilled /> : <ScoreCardEmpty />}
              </View>
            </Animated.View>

            {/* Tab body - only shows for "All" tab */}
            <Animated.View
              style={[
                styles.body,
                { opacity: bodyOp, transform: [{ translateY: bodyY }] },
              ]}
            >
              {renderActiveTab()}
            </Animated.View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
export default React.memo(WellnessHeaderSection);

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  chipBarBg: { marginTop: -2, backgroundColor: "#F3EFEB", zIndex: 20 },
  mainSection: { position: "relative", marginTop: -2 },
  diagGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    zIndex: 0,
  },

  scoreAnimWrap: { zIndex: 4 },
  scoreCardOuter: {
    padding: 20,
    zIndex: 4,
  },
  scoreCard: {
    borderRadius: 20,
    backgroundColor: "#fff",
    width: "100%",
    alignSelf: "center",
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
  scoreInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  scoreLeft: { flex: 1 },
  scoreCardTitle: { fontSize: 15, color: "#1a1a2e", marginBottom: 10 },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  catIcon: { fontSize: 13 },
  catName: { width: 68, fontSize: 11, color: "#6b7280" },
  catVal: { fontSize: 12, color: "#1a1a2e" },
  catBarGhost: {
    flex: 1,
    height: 7,
    borderRadius: 99,
    backgroundColor: "#F3F4F6",
    maxWidth: 56,
  },
  ringPct: { fontSize: 22, color: "#1a1a2e", letterSpacing: -0.5 },
  ringLbl: { fontSize: 9, color: "#9ca3af", marginTop: 1 },
  trackBtnWrap: { borderRadius: 30, overflow: "hidden" },
  trackBtn: {
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  trackBtnText: { color: "#fff", fontSize: 12, letterSpacing: 0.2 },

  body: { flex: 1 },
  plain: { backgroundColor: "#F3EFEB", paddingHorizontal: 14 },
  sectionHead: { marginTop: 18, marginBottom: 10 },
  sectionHeadTitle: { fontSize: 15, color: "#1a1a2e" },
  sectionHeadSub: {
    marginTop: 2,
    fontSize: 11,
    color: "#6b7280",
    lineHeight: 16,
  },
  subSectionTitle: { fontSize: 13, color: "#1a1a2e", marginBottom: 8 },

  // Energy card
  energyCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0EAFB",
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardDivider: { height: 1, backgroundColor: "#F5F0FF", marginVertical: 12 },
  energyTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  plateWrap: { flexShrink: 0, alignItems: "center" },
  plateImg: { width: 72, height: 72, borderRadius: 36 },
  kcalBadge: {
    marginTop: 5,
    backgroundColor: "#F5F0FF",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  kcalBadgeText: { fontSize: 9.5, fontWeight: "700", color: "#7C3AED" },
  energyRight: { flex: 1 },
  consumedRow: { flexDirection: "row", gap: 16, marginBottom: 10 },
  statBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  statIcon: { fontSize: 18 },
  statLbl: { fontSize: 9.5, color: "#9ca3af" },
  statNum: { fontSize: 18, color: "#1a1a2e", lineHeight: 22 },
  macroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  macroBarItem: { width: "46%" },
  macroBarTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  macroName: { fontSize: 9.5, color: "#374151" },
  macroAmt: { fontSize: 9.5, color: "#9ca3af" },
  macroTrack: {
    height: 5,
    borderRadius: 99,
    backgroundColor: "#F0F0F0",
    overflow: "hidden",
  },
  macroFill: { height: "100%", borderRadius: 99 },
  emptyHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FAF5FF",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginTop: 10,
    borderWidth: 1,
  },
  emptyHintText: { fontSize: 10.5, flex: 1 },
  actionRow: { flexDirection: "row", gap: 8 },
  actionBtnWrap: { flex: 1, borderRadius: 12, overflow: "hidden" },
  actionBtn: { paddingVertical: 10, alignItems: "center", borderRadius: 12 },
  actionBtnText: { fontSize: 11, letterSpacing: 0.1 },

  // Trend
  trendSection: { marginTop: 16 },
  trendTitle: { fontSize: 15, color: "#1a1a2e", marginBottom: 10 },
  trendCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    overflow: "hidden",
    borderColor: "#ededf5",
  },
  trendCardEmpty: { borderColor: "#F3E8FF", backgroundColor: "#FDFAFF" },
  trendLegend: {
    flexDirection: "row",
    gap: 14,
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  legItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legDot: { width: 8, height: 8, borderRadius: 4 },
  legText: { fontSize: 9.5, color: "#6b7280" },

  remindersSection: {
    marginBottom: 10,
    marginTop: 10,
  },

  // ── Header ──
  reminderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  reminderHeaderTitle: {
    fontSize: 22,
    color: "#0F0F1A",
    letterSpacing: -0.5,
  },
  reminderHeaderSub: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 1,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#F5F0FF",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  seeAll: {
    fontSize: 12,
    color: "#9333EA",
    fontWeight: "600",
  },

  // ── Card ──
  reminderItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 15,
    paddingRight: 14,
    paddingLeft: 0,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F3F0FF",
  },
  reminderItemFirst: {
    shadowOpacity: 0.14,
    borderColor: "#E9D5FF",
  },

  // Left accent bar
  accentBar: {
    width: 4,
    height: "70%",
    borderRadius: 4,
    marginLeft: 0,
    flexShrink: 0,
  },

  // Icon
  reminderIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  urgentDot: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F43F5E",
    borderWidth: 1.5,
    borderColor: "#fff",
  },

  // Text
  reminderLeft: { flex: 1, minWidth: 0 },
  reminderTitle: { fontSize: 14, color: "#111827", marginBottom: 4 },
  reminderMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  reminderSubtitle: { fontSize: 11, color: "#9CA3AF" },

  // Right
  reminderRight: { alignItems: "flex-end", gap: 8, flexShrink: 0 },
  reminderTagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  tagDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  reminderTag: { fontSize: 10.5, fontWeight: "600" },
  reminderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 10,
  },
  reminderBtnText: { color: "#fff", fontSize: 11 },

  // Daily calorie
  dailyBlock: { marginTop: 20, marginBottom: 8 },
  dailyTitle: {
    fontSize: 15,
    color: "#1a1a2e",
    textAlign: "center",
    marginBottom: 12,
  },
  dailyCard: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#C7E2F8",
    backgroundColor: "#fff",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 5,
  },
  dailyCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 15,
    gap: 13,
  },
  dailyImgCol: { alignItems: "center", flexShrink: 0 },
  dailyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,.75)",
    borderWidth: 1,
    borderColor: "rgba(200,220,248,.6)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  dailyPlate: { width: 76, height: 76 },
  dailyContent: { flex: 1, paddingTop: 1 },
  dailyCardTitle: {
    fontSize: 12.5,
    color: "#111827",
    lineHeight: 18,
    marginBottom: 4,
  },
  dailyCardSub: {
    fontSize: 10,
    color: "#4B5563",
    lineHeight: 15,
    marginBottom: 8,
  },
  hintRow: { flexDirection: "row", gap: 5, flexWrap: "wrap", marginBottom: 10 },
  hintChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,.85)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  hintDot: { width: 5, height: 5, borderRadius: 3 },
  hintChipText: { fontSize: 9, color: "#4B5563" },
  calcBtnWrap: {
    borderRadius: 10,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  calcBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  calcBtnText: { fontSize: 10.5, color: "#fff", letterSpacing: 0.3 },
  dailyStatsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#EEF2FF",
  },
  dailyStat: { flex: 1, alignItems: "center", paddingVertical: 11, gap: 2 },
  dailyStatBorder: { borderRightWidth: 1, borderRightColor: "#E5E7EB" },
  dailyStatNum: { fontSize: 12.5, lineHeight: 16 },
  dailyStatLbl: { fontSize: 8.5, color: "#9ca3af" },
  dailyStatBar: { width: 26, height: 3, borderRadius: 99, marginTop: 4 },

  // Sleep tab
  sleepCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E0E7FF",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
  },
  sleepTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  sleepStatRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  sleepStatItem: { alignItems: "center", gap: 2 },
  sleepStatVal: { fontSize: 13, color: "#1a1a2e" },
  sleepQualityBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  sleepQualityText: { fontSize: 10, fontWeight: "700" },
  sleepStageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  sleepStageDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  sleepStageName: { width: 52, fontSize: 10.5, color: "#374151" },
  sleepStageTrack: {
    flex: 1,
    height: 6,
    borderRadius: 99,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  sleepStageFill: { height: "100%", borderRadius: 99 },
  sleepStageVal: {
    width: 40,
    fontSize: 10.5,
    color: "#1a1a2e",
    textAlign: "right",
  },
  tipsBlock: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0F0F5",
    marginBottom: 16,
  },
  tipsTitle: { fontSize: 13, color: "#1a1a2e", marginBottom: 10 },
  tipRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  tipText: { fontSize: 11, color: "#4B5563", flex: 1, lineHeight: 16 },

  // Fitness tab
  fitnessMetricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  fitnessMetricCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F0F0F5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  fitnessMetricLabel: { fontSize: 10, color: "#6b7280", marginTop: 4 },
  fitnessMetricVal: { fontSize: 20, color: "#1a1a2e", lineHeight: 26 },
  fitnessMetricTarget: { fontSize: 9, color: "#9ca3af", marginBottom: 6 },
  fitnessMetricTrack: {
    height: 5,
    borderRadius: 99,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  fitnessMetricFill: { height: "100%", borderRadius: 99 },
  streakBlock: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0F0F5",
    marginBottom: 16,
  },
  streakRow: { flexDirection: "row", justifyContent: "space-between" },
  streakDay: { alignItems: "center", gap: 4 },
  streakCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  streakDayLabel: { fontSize: 9.5, color: "#6b7280" },
  streakMins: { fontSize: 8, color: "#9ca3af" },
  workoutCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0F0F5",
    marginBottom: 16,
  },
  workoutCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  workoutDetails: { gap: 8 },
  workoutRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  workoutLabel: { fontSize: 11.5, color: "#1a1a2e" },
  workoutSub: { fontSize: 10, color: "#6b7280" },

  // Medicine tab
  medicineCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
  },
  medicineCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  medicineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  medicineIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  medicineName: { fontSize: 12, color: "#1a1a2e" },
  medicineMeta: { fontSize: 10, color: "#9ca3af" },
  medicineTakenBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  medicineTakenText: { fontSize: 9.5 },
  medicineProg: { fontSize: 11, color: "#A855F7" },
  adherenceBlock: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0F0F5",
    marginBottom: 16,
  },
  adherenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 50,
    marginBottom: 8,
  },
  adherenceDay: { alignItems: "center", gap: 4, flex: 1 },
  adherenceBar: { width: 16, borderRadius: 4 },

  // Cycle tab
  cycleCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FBCFE8",
    shadowColor: "#F472B6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
  },
  cycleTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cycleStatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cycleStatItem: { width: "44%", alignItems: "flex-start", gap: 2 },
  cycleStatVal: { fontSize: 14, color: "#1a1a2e" },
  cycleStatLbl: { fontSize: 9.5, color: "#9ca3af" },
  cyclePhaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  cyclePhaseName: { fontSize: 11, color: "#1a1a2e", width: 62 },
  cyclePhaseDays: { fontSize: 9, color: "#9ca3af", width: 62 },
  cyclePhaseTrack: {
    flex: 1,
    height: 6,
    borderRadius: 99,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  cyclePhaseFill: { height: "100%", borderRadius: 99 },
  cyclePhaseLen: {
    width: 20,
    fontSize: 10,
    color: "#1a1a2e",
    textAlign: "right",
  },
  symptomsBlock: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FDF2F8",
    marginBottom: 16,
  },
  symptomsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  symptomChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  symptomDot: { width: 6, height: 6, borderRadius: 3 },
  symptomLabel: { fontSize: 10.5 },

  wellnessSection: { marginBottom: 28 },
  wellnessTitle: {
    fontSize: 20,
    color: "#111",
    marginHorizontal: 16,
    marginBottom: 14,
  },
  wellnessScroll: { paddingHorizontal: 16, gap: 10 },
  wellnessCard: { width: 118, borderRadius: 18, padding: 13 },
  wellnessIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  wellnessLabel: { fontSize: 13, color: "#374151" },
  wellnessValue: { fontSize: 20, color: "#111", marginBottom: 2 },
  wellnessUnit: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 10,
    lineHeight: 14,
  },
  wellnessBarBg: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: 2,
    overflow: "hidden",
  },
  wellnessBarFill: { height: 4, borderRadius: 2 },
  wellnessValueEmpty: { color: "#9CA3AF" },
  tapHint: {
    fontSize: 9,
    color: "#9CA3AF",
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  checkBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  checkMark: { fontSize: 8, color: "#fff" },
  content: {
    paddingHorizontal: 15,
    maxWidth: "100%",
    width: "100%",
    alignSelf: "center",
    gap: 14,
    marginTop: 14,
    marginBottom: 32,
  }, // add to styles:
  manageText: { fontSize: 11, color: "#7C3AED", fontWeight: "600" },
});

// Dashboard mini-card styles
const d = StyleSheet.create({
  container: { backgroundColor: "#F3EFEB", paddingHorizontal: 14 },
  sectionHead: { marginTop: 18, marginBottom: 10 },
  sectionTitle: { fontSize: 15, color: "#1a1a2e" },
  sectionSub: { marginTop: 2, fontSize: 11, color: "#6b7280", lineHeight: 16 },
  dashGrid: { flexDirection: "row", gap: 10 },
  miniCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: "#F0EAFB",
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    minHeight: 190,
  },
  mcHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  mcLabel: { fontSize: 12, color: "#374151", fontWeight: "600" },
  mcEmoji: { fontSize: 14 },
  mcCenter: { alignItems: "center", justifyContent: "center", marginBottom: 6 },
  mcFooter: { alignItems: "center", marginBottom: 8 },
  ringVal: { fontSize: 15, color: "#1a1a2e" },
  badge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: 9.5 },
  emptyTxt: { fontSize: 9.5, color: "#9ca3af", textAlign: "center" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  stageRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 4,
  },
  stageCol: { alignItems: "center", gap: 2 },
  stageLbl: { fontSize: 8.5, color: "#6b7280" },
  stageVal: { fontSize: 10 },
  fitMetricsCol: { gap: 6, marginBottom: 8 },
  fitRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  fitLbl: { width: 34, fontSize: 8.5, color: "#6b7280" },
  fitTrack: {
    flex: 1,
    height: 5,
    borderRadius: 99,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  fitFill: { height: "100%", borderRadius: 99 },
  fitVal: { width: 34, fontSize: 9.5, textAlign: "right" },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  weekDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  weekLbl: { fontSize: 7.5 },
  medLayout: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  medList: { flex: 1, gap: 5, paddingTop: 2 },
  medRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  medName: { fontSize: 9.5, flex: 1 },
  sympChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
    justifyContent: "center",
  },
  sympChip: {
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
  },
  sympText: { fontSize: 8.5 },
});
