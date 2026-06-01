/**
 * History.jsx — Redesigned with richer Day / Week / Month views
 *
 * Day view:
 *  • Horizontal date scroller
 *  • Calorie hero card with macro progress bars (kcal, protein, carbs, fat)
 *  • Donut chart (react-native-svg) breaking down intake by meal
 *  • Logging-streak card
 *  • Per-meal sections (Breakfast / Lunch / Snacks / Dinner) with food items
 *  • Edit button
 *
 * Week view:
 *  • 4 stat summary cards (avg, total, goal-hit days, best day)
 *  • Bar chart with dashed goal line (intake bars coloured by under/over goal)
 *  • Stacked macro chart (protein / carbs / fat per day)
 *
 * Month view:
 *  • Month navigator (prev / next)
 *  • GitHub-style calorie heatmap grid (5 intensity levels)
 *  • 2 stat summary cards (monthly avg, consistency %)
 *  • Line chart for full-month trend with goal line
 *  • Top-5 days breakdown list
 *
 * All AsyncStorage logic preserved from the original.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Platform,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Line,
  Rect,
  Text as SvgText,
  G,
  ClipPath,
} from "react-native-svg";
import { Text } from "../components/TextWrapper";
import { C } from "../theme";
import { parseJsonSafe, normalizeMealType, ensureMealsShape } from "../utils";

const { width } = Dimensions.get("window");
const isSmall = width < 380;
const STATUS_BAR_H =
  Platform.OS === "ios" ? 56 : (StatusBar.currentHeight ?? 38) + 8;

const LOG_PREFIX = "nutritionLog_";
const PURPLE = "#553FB5";
const GREEN_DARK = "#35A329";
const GREEN_MID = "#4CAF50";
const GREEN_LIGHT = "#93D056";

const MACRO_BAR_COLORS = {
  protein: "#5ec9fb",
  carbs:   "#ffa361",
  fat:     "#c383ff",
};

const MEAL_TABS = ["Breakfast", "Lunch", "Snacks", "Dinner"];
const MEAL_COLORS = {
  Breakfast: "#D97706",
  Lunch: "#2563EB",
  Snacks: "#059669",
  Dinner: "#9333EA",
};
const MEAL_BG = {
  Breakfast: "#FEF3C7",
  Lunch: "#DBEAFE",
  Snacks: "#D1FAE5",
  Dinner: "#F3E8FF",
};
const MEAL_TEXT = {
  Breakfast: "#92400E",
  Lunch: "#1E3A8A",
  Snacks: "#065F46",
  Dinner: "#581C87",
};
const MEAL_ICONS = {
  Breakfast: "weather-sunset",
  Lunch: "food",
  Snacks: "apple",
  Dinner: "moon-waning-crescent",
};

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

// ── Helpers ────────────────────────────────────────────────────────────────
const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, "-");
};

const getDatesAround = (centerDate, count = 14) => {
  const dates = [];
  for (let i = -Math.floor(count / 2); i <= Math.floor(count / 2); i++) {
    const d = new Date(centerDate);
    d.setDate(centerDate.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const getDaysInMonth = (year, month) =>
  new Date(year, month + 1, 0).getDate();

// ── Donut chart (meal breakdown) ───────────────────────────────────────────
const DonutChart = ({ data, total, size = 160 }) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const stroke = size * 0.13;
  const circ = 2 * Math.PI * r;

  let cumPct = 0;
  const slices = data.map((d) => {
    const pct = total > 0 ? d.value / total : 0;
    const dashArray = `${pct * circ} ${circ}`;
    const offset = -cumPct * circ;
    cumPct += pct;
    return { ...d, dashArray, offset };
  });

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={cx} cy={cy} r={r}
        stroke="#F0F0F0" strokeWidth={stroke} fill="none"
      />
      {slices.map((s, i) => (
        <Circle
          key={i}
          cx={cx} cy={cy} r={r}
          stroke={s.color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={s.dashArray}
          strokeDashoffset={s.offset}
          transform={`rotate(-90, ${cx}, ${cy})`}
          strokeLinecap="round"
        />
      ))}
      {/* Centre label */}
      <SvgText
        x={cx} y={cy - 8}
        textAnchor="middle"
        fontSize={isSmall ? 18 : 22}
        fontWeight="700"
        fill="#1A1A1A"
      >
        {Math.round(total)}
      </SvgText>
      <SvgText
        x={cx} y={cy + 10}
        textAnchor="middle"
        fontSize={11}
        fill="#888"
      >
        kcal today
      </SvgText>
    </Svg>
  );
};

// ── Macro progress bar ─────────────────────────────────────────────────────
const MacroBar = ({ label, value, goal, color, unit = "g" }) => {
  const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
  return (
    <View style={mb.wrap}>
      <View style={mb.row}>
        <Text style={mb.label}>{label}</Text>
        <Text style={mb.val}>
          {Math.round(value)}{unit}
          <Text style={mb.goal}> / {goal}{unit}</Text>
        </Text>
      </View>
      <View style={mb.track}>
        <View style={[mb.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};
const mb = StyleSheet.create({
  wrap: { marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  label: { fontSize: 12, color: "#555" },
  val: { fontSize: 12, color: "#1A1A1A", fontWeight: "600" },
  goal: { fontWeight: "400", color: "#999" },
  track: { height: 6, borderRadius: 3, backgroundColor: "#F0F0F0", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
});

// ── Stat card ──────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, subColor = GREEN_DARK }) => (
  <View style={sc.card}>
    <Text style={sc.label}>{label}</Text>
    <Text weight="700" style={sc.value}>{value}</Text>
    {sub ? <Text style={[sc.sub, { color: subColor }]}>{sub}</Text> : null}
  </View>
);
const sc = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#F7F9FB",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },
  label: { fontSize: 11, color: "#888", marginBottom: 4 },
  value: { fontSize: 20, color: "#1A1A1A" },
  sub: { fontSize: 11, marginTop: 3 },
});

// ── Week bar + goal-line chart ─────────────────────────────────────────────
const WeekBarChart = ({ weekData, selectedDay, onSelectDay, goalCalories }) => {
  const W = width - 32;
  const H = 200;
  const PAD_L = 28;
  const PAD_B = 28;
  const PAD_T = 48;
  const chartW = W - PAD_L - 8;
  const chartH = H - PAD_B - PAD_T;
  const maxCal = Math.max(goalCalories * 1.2, ...weekData.map((d) => d.calories), 500);
  const barW = (chartW / weekData.length) * 0.5;

  const yToScreen = (v) => PAD_T + chartH - (v / maxCal) * chartH;
  const xCenter = (i) => PAD_L + (i + 0.5) * (chartW / weekData.length);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(maxCal * p));

  return (
    <Svg width={W} height={H}>
      <Defs>
        <ClipPath id="weekChartClip">
          <Rect x={PAD_L} y={PAD_T} width={chartW} height={chartH} />
        </ClipPath>
      </Defs>

      {/* Y-axis labels — outside clip */}
      {yTicks.map((v, i) => (
        <SvgText
          key={i}
          x={PAD_L - 4} y={yToScreen(v) + 4}
          textAnchor="end" fontSize={9} fill="#BBB"
        >
          {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
        </SvgText>
      ))}

      {/* Clipped chart area: grid, goal line, bars */}
      <G clipPath="url(#weekChartClip)">
        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <Line
            key={i}
            x1={PAD_L} y1={yToScreen(v)}
            x2={W - 24} y2={yToScreen(v)}
            stroke="#F0F0F0" strokeWidth={1}
          />
        ))}

        {/* Goal dashed line */}
        <Line
          x1={PAD_L} y1={yToScreen(goalCalories)}
          x2={W - 24} y2={yToScreen(goalCalories)}
          stroke="#E57373" strokeWidth={1.5}
          strokeDasharray="5,3"
        />

        {/* Bars + selection highlight */}
        {weekData.map((d, i) => {
          const bH = Math.max((d.calories / maxCal) * chartH, 2);
          const x = xCenter(i) - barW / 2;
          const y = yToScreen(d.calories);
          const isOver = d.calories >= goalCalories;
          const isSel = i === selectedDay;
          const fill = isSel ? GREEN_DARK : isOver ? GREEN_MID : GREEN_LIGHT;
          return (
            <G key={i} onPress={() => onSelectDay(i)}>
              {isSel && (
                <Rect
                  x={x - 4} y={PAD_T}
                  width={barW + 8} height={chartH}
                  rx={6} fill={GREEN_DARK} opacity={0.06}
                />
              )}
              <Rect
                x={x} y={y} width={barW} height={bH}
                rx={4} fill={fill}
                opacity={d.calories === 0 ? 0.25 : 1}
              />
            </G>
          );
        })}
      </G>

      {/* Goal label — outside clip so it's always readable */}
      <SvgText
        x={W - 26}  y={yToScreen(goalCalories) - 4}
        textAnchor="end" fontSize={9} fill="#E57373"
      >
        goal
      </SvgText>

      {/* Tooltips + day labels — outside clip */}
      {weekData.map((d, i) => {
        const y = yToScreen(d.calories);
        const isSel = i === selectedDay;
        return (
          <G key={i} onPress={() => onSelectDay(i)}>
            {isSel && d.calories > 0 && (
              <G>
                <Rect
                  x={xCenter(i) - 34} y={PAD_T - 30}
                  width={68} height={24}
                  rx={6} fill="#1A1A1A"
                />
                <SvgText
                  x={xCenter(i)} y={PAD_T - 12}
                  textAnchor="middle" fontSize={10}
                  fontWeight="700" fill="#fff"
                >
                  {Math.round(d.calories)} kcal
                </SvgText>
              </G>
            )}
            <SvgText
              x={xCenter(i)} y={H - 8}
              textAnchor="middle" fontSize={10}
              fontWeight={isSel ? "700" : "400"}
              fill={isSel ? GREEN_DARK : "#AAA"}
            >
              {WEEK_DAYS[i]}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
};

// ── Stacked macro chart (week) ─────────────────────────────────────────────
const StackedMacroChart = ({ macroData }) => {
  const W = width - 32;
  const H = 180;
  const PAD_L = 28;
  const PAD_B = 28;
  const PAD_T = 16;
  const chartW = W - PAD_L - 8;
  const chartH = H - PAD_B - PAD_T;
  const maxTotal = Math.max(...macroData.map((d) => d.protein + d.carbs + d.fat), 100);
  const barW = (chartW / macroData.length) * 0.5;
  const xCenter = (i) => PAD_L + (i + 0.5) * (chartW / macroData.length);

  return (
    <Svg width={W} height={H}>
      <Defs>
        <ClipPath id="macroChartClip">
          <Rect x={PAD_L} y={PAD_T} width={chartW} height={chartH} />
        </ClipPath>
      </Defs>

      {/* Y-axis labels — outside clip */}
      {[0, 0.5, 1].map((p, i) => {
        const y = PAD_T + chartH - p * chartH;
        return (
          <SvgText key={i} x={PAD_L - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#BBB">
            {Math.round(maxTotal * p)}
          </SvgText>
        );
      })}

      {/* Clipped area: grid lines + bars */}
      <G clipPath="url(#macroChartClip)">
        {[0, 0.5, 1].map((p, i) => {
          const y = PAD_T + chartH - p * chartH;
          return (
            <Line key={i} x1={PAD_L} y1={y} x2={W - 24} y2={y} stroke="#F0F0F0" strokeWidth={1} />
          );
        })}
        {macroData.map((d, i) => {
          const ph = (d.protein / maxTotal) * chartH;
          const ch = (d.carbs / maxTotal) * chartH;
          const fh = (d.fat / maxTotal) * chartH;
          const x = xCenter(i) - barW / 2;
          const baseY = PAD_T + chartH;
          return (
            <G key={i}>
              <Rect x={x} y={baseY - fh} width={barW} height={fh} fill="#9333EA" rx={0} />
              <Rect x={x} y={baseY - fh - ch} width={barW} height={ch} fill="#D97706" />
              <Rect x={x} y={baseY - fh - ch - ph} width={barW} height={ph} rx={3} fill="#2563EB" />
            </G>
          );
        })}
      </G>

      {/* Day labels — outside clip */}
      {macroData.map((d, i) => (
        <SvgText
          key={i}
          x={xCenter(i)} y={H - 8}
          textAnchor="middle" fontSize={10} fill="#AAA"
        >
          {WEEK_DAYS[i]}
        </SvgText>
      ))}
    </Svg>
  );
};

// ── Heatmap grid (month view) ──────────────────────────────────────────────
const heatColor = (kcal, goal) => {
  if (!kcal || kcal === 0) return { bg: "#F5F5F5", text: "#CCC" };
  const pct = kcal / goal;
  if (pct < 0.6)  return { bg: "#C8E6C9", text: "#2E7D32" };
  if (pct < 0.8)  return { bg: "#81C784", text: "#1B5E20" };
  if (pct < 1.0)  return { bg: "#4CAF50", text: "#fff" };
  if (pct < 1.15) return { bg: GREEN_DARK, text: "#fff" };
  return { bg: "#1B5E20", text: "#fff" };
};

const CalHeatmap = ({ year, month, dailyData, goalCalories }) => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = getDaysInMonth(year, month);
  const today = new Date();
  const todayKey = toDateKey(today);
  const cellSize = Math.floor((width - 32 - 28 - 6 * 4) / 7);

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const cells = [
    ...Array(firstDay).fill(null),
    ...days,
  ];

  return (
    <View>
      {/* Day-of-week headers */}
      <View style={hm.headerRow}>
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <View key={i} style={[hm.headerCell, { width: cellSize }]}>
            <Text style={hm.headerTxt}>{d}</Text>
          </View>
        ))}
      </View>
      {/* Grid */}
      <View style={hm.grid}>
        {cells.map((day, i) => {
          if (!day) {
            return <View key={`e${i}`} style={[hm.cell, { width: cellSize, height: cellSize }]} />;
          }
          const d = new Date(year, month, day);
          const key = toDateKey(d);
          const kcal = dailyData[day] || 0;
          const { bg, text } = heatColor(kcal, goalCalories);
          const isToday = key === todayKey;
          return (
            <View
              key={day}
              style={[
                hm.cell,
                { width: cellSize, height: cellSize, backgroundColor: bg },
                isToday && hm.todayBorder,
              ]}
            >
              <Text style={[hm.cellTxt, { color: text }]}>{day}</Text>
            </View>
          );
        })}
      </View>
      {/* Legend */}
      <View style={hm.legend}>
        <Text style={hm.legendTxt}>Less</Text>
        {["#F5F5F5","#C8E6C9","#81C784","#4CAF50","#35A329","#1B5E20"].map((c, i) => (
          <View key={i} style={[hm.legendDot, { backgroundColor: c }]} />
        ))}
        <Text style={hm.legendTxt}>More</Text>
      </View>
    </View>
  );
};
const hm = StyleSheet.create({
  headerRow: { flexDirection: "row", marginBottom: 4, gap: 4 },
  headerCell: { alignItems: "center" },
  headerTxt: { fontSize: 10, color: "#AAA" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  cell: { borderRadius: 5, alignItems: "center", justifyContent: "center" },
  todayBorder: { borderWidth: 2, borderColor: GREEN_DARK },
  cellTxt: { fontSize: 10, fontWeight: "500" },
  legend: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 10 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendTxt: { fontSize: 10, color: "#AAA" },
});

// ── Month line chart ───────────────────────────────────────────────────────
const MonthLineChart = ({ dailyData, goalCalories, daysInMonth }) => {
  const W = width - 32;
  const H = 180;
  const PAD_L = 28;
  const PAD_B = 28;
  const PAD_T = 16;
  const chartW = W - PAD_L - 24;
  const chartH = H - PAD_B - PAD_T;

  const values = Array.from({ length: daysInMonth }, (_, i) => dailyData[i + 1] || 0);
  const maxVal = Math.max(goalCalories * 1.2, ...values, 500);

  const xOf = (i) => PAD_L + (i / (daysInMonth - 1)) * chartW;
  const yOf = (v) => PAD_T + chartH - (v / maxVal) * chartH;

  // Build smooth polyline points (only non-zero)
  const pts = values
    .map((v, i) => (v > 0 ? `${xOf(i)},${yOf(v)}` : null))
    .filter(Boolean)
    .join(" ");

  // Area fill path (approximate, connect first and last non-zero)
  const nonZeroIdxs = values
    .map((v, i) => (v > 0 ? i : null))
    .filter((x) => x !== null);

  let areaPath = "";
  if (nonZeroIdxs.length > 1) {
    const first = nonZeroIdxs[0];
    const last = nonZeroIdxs[nonZeroIdxs.length - 1];
    const linePoints = nonZeroIdxs
      .map((i) => `${xOf(i)},${yOf(values[i])}`)
      .join(" L ");
    areaPath = `M ${xOf(first)},${yOf(0)} L ${linePoints} L ${xOf(last)},${yOf(0)} Z`;
  }

  const goalY = yOf(goalCalories);
  const xTicks = [1, 7, 14, 21, daysInMonth];

  return (
    <Svg width={W} height={H}>
      <Defs>
        <SvgLinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={GREEN_DARK} stopOpacity={0.25} />
          <Stop offset="1" stopColor={GREEN_DARK} stopOpacity={0} />
        </SvgLinearGradient>
        <ClipPath id="monthChartClip">
          <Rect x={PAD_L} y={PAD_T} width={chartW} height={chartH} />
        </ClipPath>
      </Defs>

      {/* Y-axis labels — outside clip */}
      {[0, 0.5, 1].map((p, i) => {
        const y = PAD_T + chartH - p * chartH;
        return (
          <SvgText key={i} x={PAD_L - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#BBB">
            {Math.round(maxVal * p) >= 1000
              ? `${(Math.round(maxVal * p) / 1000).toFixed(1)}k`
              : Math.round(maxVal * p)}
          </SvgText>
        );
      })}

      {/* Clipped chart area: grid, goal line, area fill, line */}
      <G clipPath="url(#monthChartClip)">
        {[0, 0.5, 1].map((p, i) => {
          const y = PAD_T + chartH - p * chartH;
          return (
            <Line key={i} x1={PAD_L} y1={y} x2={W - 24} y2={y} stroke="#F0F0F0" strokeWidth={1} />
          );
        })}

        {/* Goal line */}
        <Line
          x1={PAD_L} y1={goalY} x2={W - 24} y2={goalY}
          stroke="#E57373" strokeWidth={1.5} strokeDasharray="5,3"
        />

        {/* Area fill */}
        {areaPath ? <Path d={areaPath} fill="url(#areaGrad)" /> : null}

        {/* Line */}
        {nonZeroIdxs.length > 1 && (
          <Path
            d={`M ${nonZeroIdxs.map((i) => `${xOf(i)},${yOf(values[i])}`).join(" L ")}`}
            fill="none"
            stroke={GREEN_DARK}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </G>

      {/* X-axis ticks — outside clip */}
      {xTicks.map((day) => (
        <SvgText
          key={day}
          x={xOf(day - 1)} y={H - 6}
          textAnchor={day === daysInMonth ? "end" : "middle"} fontSize={9} fill="#BBB"
        >
          {day}
        </SvgText>
      ))}
    </Svg>
  );
};

// ── Top-N days breakdown ───────────────────────────────────────────────────
const TopDays = ({ dailyData, year, month, goalCalories }) => {
  const entries = Object.entries(dailyData)
    .map(([day, cal]) => ({ day: parseInt(day), cal }))
    .filter((e) => e.cal > 0)
    .sort((a, b) => Math.abs(a.cal - goalCalories) - Math.abs(b.cal - goalCalories))
    .slice(0, 5);

  if (entries.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 16 }}>
        <Text style={{ color: "#AAA", fontSize: 13 }}>No data yet</Text>
      </View>
    );
  }
  const maxCal = entries[0].cal;
  return (
    <View style={{ gap: 10 }}>
      {entries.map(({ day, cal }) => (
        <View key={day} style={td.row}>
          <Text style={td.day}>
            {MONTHS[month]} {day}
          </Text>
          <View style={td.barWrap}>
            <View style={[td.bar, { width: `${(cal / maxCal) * 100}%` }]} />
          </View>
          <Text weight="600" style={td.kcal}>
            {cal.toLocaleString()}
          </Text>
        </View>
      ))}
    </View>
  );
};
const td = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  day: { fontSize: 12, color: "#888", width: 50, flexShrink: 0 },
  barWrap: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "#F0F0F0", overflow: "hidden" },
  bar: { height: "100%", borderRadius: 4, backgroundColor: GREEN_DARK },
  kcal: { fontSize: 12, color: "#1A1A1A", width: 58, textAlign: "right", flexShrink: 0 },
});

// ══════════════════════════════════════════════════════════════════════════
//  Main component
// ══════════════════════════════════════════════════════════════════════════
const History = () => {
  const navigation = useNavigation();

  // ── Tab state ────────────────────────────────
  const [activeTab, setActiveTab] = useState("Day");

  // ── Day state ────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateList, setDateList] = useState(getDatesAround(new Date(), 14));
  const [dayLog, setDayLog] = useState(null);
  const [activeMealTab, setActiveMealTab] = useState("Breakfast");
  const [loading, setLoading] = useState(false);

  // ── Week state ───────────────────────────────
  const [weekData, setWeekData] = useState(
    WEEK_DAYS.map(() => ({ calories: 0, dateLabel: "" }))
  );
  const [weekMacroData, setWeekMacroData] = useState(
    WEEK_DAYS.map(() => ({ protein: 0, carbs: 0, fat: 0 }))
  );
  const [selectedWeekDay, setSelectedWeekDay] = useState(new Date().getDay());
  const [weekStats, setWeekStats] = useState({
    avg: 0, total: 0, goalHit: 0, bestDay: "—",
  });

  // ── Month state ──────────────────────────────
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [dailyData, setDailyData] = useState({});
  const [monthStats, setMonthStats] = useState({ avg: 0, logged: 0, total: 0 });
  const [monthLoading, setMonthLoading] = useState(false);

  // ── Goal ─────────────────────────────────────
  const [goalCalories, setGoalCalories] = useState(null);
  const [goalMacros, setGoalMacros] = useState(null);

  const dateScrollRef = useRef(null);

  // ── Load goal ──────────────────────────────
  useEffect(() => {
    const loadGoal = async () => {
      const raw = await AsyncStorage.getItem("calorieGoalData");
      if (raw) {
        const g = parseJsonSafe(raw, {});
        setGoalCalories(g.calorieGoal || 2000);
        setGoalMacros({
          protein: g.protein_g,
          carbs: g.carbs_g,
          fat: g.fat_g,
        });
      }
    };
    loadGoal();
  }, []);

  // ── Load day ───────────────────────────────
  const loadDayData = useCallback(async (date) => {
    setLoading(true);
    try {
      const key = `${LOG_PREFIX}${toDateKey(date)}`;
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const parsed = parseJsonSafe(raw, {});
        ensureMealsShape(parsed);
        setDayLog(parsed);
      } else {
        setDayLog(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load week ──────────────────────────────
  const loadWeekData = useCallback(async () => {
    const today = new Date();
    const results = await Promise.all(
      WEEK_DAYS.map(async (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + (i - today.getDay()));
        const key = `${LOG_PREFIX}${toDateKey(d)}`;
        const raw = await AsyncStorage.getItem(key);
        const dateLabel = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        if (raw) {
          const p = parseJsonSafe(raw, {});
          return {
            calories: p.totalCalories || 0,
            protein: p.totalProtein || 0,
            carbs: p.totalCarbs || 0,
            fat: p.totalFat || 0,
            dateLabel,
          };
        }
        return { calories: 0, protein: 0, carbs: 0, fat: 0, dateLabel };
      })
    );

    setWeekData(results.map(({ calories, dateLabel }) => ({ calories, dateLabel })));
    setWeekMacroData(results.map(({ protein, carbs, fat }) => ({ protein, carbs, fat })));

    // Compute stats
    const nonZero = results.filter((r) => r.calories > 0);
    const total = results.reduce((s, r) => s + r.calories, 0);
    const avg = nonZero.length > 0 ? Math.round(total / nonZero.length) : 0;
    const goalHit = results.filter((r) => r.calories >= goalCalories).length;
    const best = results.reduce(
      (best, r, i) => (r.calories > best.cal ? { cal: r.calories, day: WEEK_DAYS[i] } : best),
      { cal: 0, day: "—" }
    );
    setWeekStats({ avg, total: Math.round(total), goalHit, bestDay: best.day });
  }, [goalCalories]);

  // ── Load month ─────────────────────────────
  const loadMonthData = useCallback(async (year, month) => {
    setMonthLoading(true);
    try {
      const daysInMonth = getDaysInMonth(year, month);
      const data = {};
      await Promise.all(
        Array.from({ length: daysInMonth }, async (_, idx) => {
          const d = new Date(year, month, idx + 1);
          const key = `${LOG_PREFIX}${toDateKey(d)}`;
          const raw = await AsyncStorage.getItem(key);
          if (raw) {
            const p = parseJsonSafe(raw, {});
            data[idx + 1] = p.totalCalories || 0;
          }
        })
      );
      setDailyData(data);

      const vals = Object.values(data).filter((v) => v > 0);
      const total = vals.reduce((s, v) => s + v, 0);
      setMonthStats({
        avg: vals.length > 0 ? Math.round(total / vals.length) : 0,
        logged: vals.length,
        total,
      });
    } finally {
      setMonthLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === "Day") loadDayData(selectedDate);
      if (activeTab === "Week") loadWeekData();
      if (activeTab === "Month") loadMonthData(viewYear, viewMonth);
    }, [activeTab, selectedDate, viewYear, viewMonth])
  );

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    loadDayData(date);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "Week") loadWeekData();
    if (tab === "Month") loadMonthData(viewYear, viewMonth);
  };

  const handlePrevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    loadMonthData(d.getFullYear(), d.getMonth());
  };

  const handleNextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    loadMonthData(d.getFullYear(), d.getMonth());
  };

  const isToday = (date) => toDateKey(date) === toDateKey(new Date());
  const isSelected = (date) => toDateKey(date) === toDateKey(selectedDate);

  const totalCalories = dayLog?.totalCalories || 0;
  const totalProtein = dayLog?.totalProtein || 0;
  const totalCarbs = dayLog?.totalCarbs || 0;
  const totalFat = dayLog?.totalFat || 0;

  const donutData = MEAL_TABS.map((tab) => ({
    label: tab,
    value: dayLog?.meals?.[tab]?.reduce(
      (s, item) => s + (item.calories || 0) * (item.quantity || 1),
      0
    ) || 0,
    color: MEAL_COLORS[tab],
  }));

  // ── Streak (simple: count consecutive days ending today with a log) ──
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    const calcStreak = async () => {
      let count = 0;
      const d = new Date();
      for (let i = 0; i < 60; i++) {
        const key = `${LOG_PREFIX}${toDateKey(d)}`;
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          count++;
          d.setDate(d.getDate() - 1);
        } else break;
      }
      setStreak(count);
    };
    calcStreak();
  }, [dayLog]);

  // ─── RENDER ────────────────────────────────────────────────────────────
  return (
    <View style={s.page}>
      {/* ══ HEADER ══════════════════════════════════════════════════════ */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
        >
          <Feather name="arrow-left" size={20} color={PURPLE} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text weight="700" style={s.headerTitle}>Nutrition History</Text>
          <Text style={s.headerSub}>Track your daily intake</Text>
        </View>
      </View>

      {/* ══ DAY / WEEK / MONTH TOGGLE ═══════════════════════════════════ */}
      <View style={s.toggleWrap}>
        {["Day", "Week", "Month"].map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[s.toggleTab, isActive && s.toggleTabActive]}
              onPress={() => handleTabChange(tab)}
              activeOpacity={0.8}
            >
              {isActive ? (
                <LinearGradient
                  colors={[GREEN_LIGHT, GREEN_DARK]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={s.toggleTabGrad}
                >
                  <Text weight="700" style={s.toggleTabTxtActive}>{tab}</Text>
                </LinearGradient>
              ) : (
                <Text weight="600" style={s.toggleTabTxt}>{tab}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingBottom: 36 }}
      >
        {/* ══════════════════════════════════════════════════════════════
            DAY VIEW
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === "Day" && (
          <>
            {/* Date scroller */}
            <ScrollView
              ref={dateScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.dateScroller}
            >
              {dateList.map((date, i) => {
                const sel = isSelected(date);
                const tod = isToday(date);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.datePill, sel && s.datePillActive]}
                    onPress={() => handleDateSelect(date)}
                    activeOpacity={0.8}
                  >
                    {sel ? (
                      <LinearGradient
                        colors={[GREEN_LIGHT, GREEN_DARK]}
                        style={s.datePillGrad}
                      >
                        <Text weight="700" style={s.datePillMonthActive}>
                          {MONTHS[date.getMonth()]}
                        </Text>
                        <Text weight="800" style={s.datePillNumActive}>
                          {date.getDate()}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <>
                        <Text style={s.datePillMonth}>{MONTHS[date.getMonth()]}</Text>
                        <Text
                          weight={tod ? "700" : "400"}
                          style={[s.datePillNum, tod && { color: GREEN_DARK }]}
                        >
                          {date.getDate()}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {loading ? (
              <View style={s.centeredLoader}>
                <ActivityIndicator size="small" color={GREEN_DARK} />
              </View>
            ) : !dayLog ? (
              <View style={s.emptyDay}>
                <Ionicons name="calendar-outline" size={36} color="#DDD" />
                <Text style={s.emptyDayTxt}>No data for this day</Text>
              </View>
            ) : (
              <>
                {/* ── Calorie hero card ──────────────────────────── */}
                <View style={[s.card, { marginHorizontal: 16, marginBottom: 12 }]}>
                  <View style={s.heroTop}>
                    <View>
                      <Text style={s.heroSubLabel}>
                        {formatDisplayDate(toDateKey(selectedDate))}
                      </Text>
                      <View style={s.heroKcalRow}>
                        <Text weight="800" style={s.heroKcal}>
                          {Math.round(totalCalories).toLocaleString()}
                        </Text>
                        <Text style={s.heroKcalUnit}> kcal</Text>
                      </View>
                    </View>
                    {/* Donut */}
                    <DonutChart
                      data={donutData}
                      total={totalCalories}
                      size={isSmall ? 130 : 150}
                    />
                  </View>

                  {/* Donut legend */}
                  <View style={s.donutLegend}>
                    {donutData.map((d) => (
                      <View key={d.label} style={s.donutLegendItem}>
                        <View style={[s.donutDot, { backgroundColor: d.color }]} />
                        <Text style={s.donutLegendTxt}>
                          {d.label} {Math.round(d.value)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Goal chip */}
                  {goalCalories > 0 && (
                    <View style={s.goalChipRow}>
                      <View
                        style={[
                          s.goalChip,
                          totalCalories > goalCalories && { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" },
                        ]}
                      >
                        <Ionicons
                          name={totalCalories > goalCalories ? "warning-outline" : "checkmark-circle-outline"}
                          size={14}
                          color={totalCalories > goalCalories ? "#DC2626" : GREEN_DARK}
                        />
                        <Text
                          style={[
                            s.goalChipTxt,
                            totalCalories > goalCalories && { color: "#DC2626" },
                          ]}
                        >
                          {totalCalories > goalCalories
                            ? `${Math.round(totalCalories - goalCalories)} kcal over goal`
                            : `${Math.round(goalCalories - totalCalories)} kcal under goal`}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Macro bars */}
                  <View style={{ marginTop: 14 }}>
                    <MacroBar
                      label="Calories"
                      value={totalCalories}
                      goal={goalCalories}
                      color={GREEN_DARK}
                      unit=" kcal"
                    />
                    <MacroBar
                      label="Protein"
                      value={totalProtein}
                      goal={goalMacros?.protein}
                      color={MACRO_BAR_COLORS.protein}
                    />
                    <MacroBar
                      label="Carbs"
                      value={totalCarbs}
                      goal={goalMacros?.carbs}
                      color={MACRO_BAR_COLORS.carbs}
                    />
                    <MacroBar
                      label="Fat"
                      value={totalFat}
                      goal={goalMacros?.fat}
                      color={MACRO_BAR_COLORS.fat}
                    />
                  </View>
                </View>

                {/* ── Streak card ────────────────────────────────── */}
                {streak > 0 && (
                  <View style={[s.card, s.streakCard]}>
                    <Text style={s.streakFire}>🔥</Text>
                    <View style={{ flex: 1 }}>
                      <Text weight="700" style={s.streakTitle}>
                        {streak}-day logging streak
                      </Text>
                      <Text style={s.streakSub}>Keep it up, you're on a roll!</Text>
                    </View>
                    <Text weight="800" style={s.streakNum}>{streak}</Text>
                  </View>
                )}

                {/* ── Meal sections ──────────────────────────────── */}
                {MEAL_TABS.map((mealTab) => {
                  const items = dayLog?.meals?.[mealTab] || [];
                  const mealKcal = items.reduce(
                    (s, item) => s + (item.calories || 0) * (item.quantity || 1),
                    0
                  );
                  return (
                    <View
                      key={mealTab}
                      style={[s.card, { marginHorizontal: 16, marginBottom: 10 }]}
                    >
                      {/* Meal header */}
                      <View style={s.mealHead}>
                        <View style={s.mealHeadLeft}>
                          <MaterialCommunityIcons
                            name={MEAL_ICONS[mealTab]}
                            size={18}
                            color={MEAL_COLORS[mealTab]}
                          />
                          <View
                            style={[
                              s.mealBadge,
                              {
                                backgroundColor: MEAL_BG[mealTab],
                                borderColor: MEAL_COLORS[mealTab] + "44",
                              },
                            ]}
                          >
                            <Text
                              weight="700"
                              style={[s.mealBadgeTxt, { color: MEAL_TEXT[mealTab] }]}
                            >
                              {mealTab}
                            </Text>
                          </View>
                        </View>
                        <Text style={s.mealKcal}>{Math.round(mealKcal)} kcal</Text>
                      </View>

                      {items.length === 0 ? (
                        <View style={s.mealEmpty}>
                          <Text style={s.mealEmptyTxt}>Nothing logged for {mealTab}</Text>
                        </View>
                      ) : (
                        items.map((item, i) => (
                          <View key={i} style={s.foodItem}>
                            <View style={s.foodIconWrap}>
                              <Ionicons name="restaurant-outline" size={20} color="#CCC" />
                            </View>
                            <View style={s.foodMid}>
                              <Text weight="600" style={s.foodName}>{item.name}</Text>
                              <View style={s.foodMeta}>
                                <Text style={s.foodMetaTxt}>
                                  Qty {item.quantity || 1}
                                </Text>
                                {item.protein > 0 && (
                                  <Text style={[s.foodMetaTxt, { color: "#2563EB" }]}>
                                    · P {Math.round(item.protein * (item.quantity || 1))}g
                                  </Text>
                                )}
                                {item.carbs > 0 && (
                                  <Text style={[s.foodMetaTxt, { color: "#D97706" }]}>
                                    · C {Math.round(item.carbs * (item.quantity || 1))}g
                                  </Text>
                                )}
                              </View>
                            </View>
                            <TouchableOpacity
                              style={s.editItemBtn}
                              onPress={() =>
                                navigation.navigate("NutritionAddDiet", { mealType: mealTab })
                              }
                              activeOpacity={0.7}
                            >
                              <Feather name="edit-2" size={14} color={PURPLE} />
                            </TouchableOpacity>
                            <View style={s.calBadge}>
                              <Text weight="700" style={s.calBadgeTxt}>
                                {Math.round((item.calories || 0) * (item.quantity || 1))}
                              </Text>
                              <Text style={s.calBadgeUnit}>cal</Text>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  );
                })}

                {/* ── Edit button ────────────────────────────────── */}
                <TouchableOpacity
                  style={s.editBarBtn}
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.navigate("NutritionAddDiet", { mealType: activeMealTab })
                  }
                >
                  <LinearGradient
                    colors={[GREEN_LIGHT, GREEN_DARK]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={s.editBarBtnInner}
                  >
                    <Feather name="edit-2" size={15} color="#fff" />
                    <Text weight="700" style={s.editBarBtnTxt}>Edit</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
            WEEK VIEW
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === "Week" && (
          <View style={s.sectionWrap}>
            {/* Summary stats */}
            <View style={s.statsRow}>
              <StatCard
                label="Avg daily"
                value={weekStats.avg.toLocaleString()}
                sub="kcal / day"
              />
              <StatCard
                label="Weekly total"
                value={weekStats.total.toLocaleString()}
                sub="kcal"
              />
            </View>
            <View style={[s.statsRow, { marginTop: 8 }]}>
              <StatCard
                label="Goal hit"
                value={`${weekStats.goalHit} / 7`}
                sub={weekStats.goalHit >= 5 ? "Great week! 🎉" : "Keep going!"}
                subColor={weekStats.goalHit >= 5 ? GREEN_DARK : "#D97706"}
              />
              <StatCard
                label="Best day"
                value={weekStats.bestDay}
                sub={
                  weekData[WEEK_DAYS.indexOf(weekStats.bestDay)]?.calories > 0
                    ? `${Math.round(weekData[WEEK_DAYS.indexOf(weekStats.bestDay)]?.calories).toLocaleString()} kcal`
                    : "—"
                }
              />
            </View>

            {/* Bar + goal line chart */}
            <View style={[s.card, { marginTop: 14 }]}>
              <Text weight="700" style={s.chartTitle}>Calories vs goal</Text>
              <View style={s.chartLegend}>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: GREEN_LIGHT }]} />
                  <Text style={s.legendTxt}>Under goal</Text>
                </View>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: GREEN_DARK }]} />
                  <Text style={s.legendTxt}>At/over goal</Text>
                </View>
                <View style={s.legendItem}>
                  <View style={[s.legendDash, { borderColor: "#E57373" }]} />
                  <Text style={s.legendTxt}>Goal</Text>
                </View>
              </View>
              <WeekBarChart
                weekData={weekData}
                selectedDay={selectedWeekDay}
                onSelectDay={setSelectedWeekDay}
                goalCalories={goalCalories}
              />
            </View>

            {/* Stacked macro chart */}
            <View style={[s.card, { marginTop: 12 }]}>
              <Text weight="700" style={s.chartTitle}>Macro split</Text>
              <View style={s.chartLegend}>
                {[
                  { color: "#2563EB", label: "Protein" },
                  { color: "#D97706", label: "Carbs" },
                  { color: "#9333EA", label: "Fat" },
                ].map((l) => (
                  <View key={l.label} style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: l.color }]} />
                    <Text style={s.legendTxt}>{l.label}</Text>
                  </View>
                ))}
              </View>
              <StackedMacroChart macroData={weekMacroData} />
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════
            MONTH VIEW
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === "Month" && (
          <View style={s.sectionWrap}>
            {/* Month navigator */}
            <View style={s.monthNav}>
              <TouchableOpacity
                style={s.monthNavBtn}
                onPress={handlePrevMonth}
                activeOpacity={0.8}
              >
                <Feather name="chevron-left" size={18} color="#555" />
              </TouchableOpacity>
              <Text weight="700" style={s.monthNavLabel}>
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity
                style={s.monthNavBtn}
                onPress={handleNextMonth}
                activeOpacity={0.8}
              >
                <Feather name="chevron-right" size={18} color="#555" />
              </TouchableOpacity>
            </View>

            {monthLoading ? (
              <View style={s.centeredLoader}>
                <ActivityIndicator size="small" color={GREEN_DARK} />
              </View>
            ) : (
              <>
                {/* Heatmap */}
                <View style={s.card}>
                  <Text weight="700" style={s.chartTitle}>Calorie heatmap</Text>
                  <CalHeatmap
                    year={viewYear}
                    month={viewMonth}
                    dailyData={dailyData}
                    goalCalories={goalCalories}
                  />
                </View>

                {/* Stats */}
                <View style={[s.statsRow, { marginTop: 12 }]}>
                  <StatCard
                    label="Monthly avg"
                    value={monthStats.avg.toLocaleString()}
                    sub="kcal / day"
                  />
                  <StatCard
                    label="Days logged"
                    value={`${monthStats.logged} / ${getDaysInMonth(viewYear, viewMonth)}`}
                    sub={`${Math.round((monthStats.logged / getDaysInMonth(viewYear, viewMonth)) * 100)}% consistency`}
                  />
                </View>

                {/* Line chart */}
                <View style={[s.card, { marginTop: 12 }]}>
                  <Text weight="700" style={s.chartTitle}>Daily calorie trend</Text>
                  <View style={s.chartLegend}>
                    <View style={s.legendItem}>
                      <View style={[s.legendDot, { backgroundColor: GREEN_DARK }]} />
                      <Text style={s.legendTxt}>Intake</Text>
                    </View>
                    <View style={s.legendItem}>
                      <View style={[s.legendDash, { borderColor: "#E57373" }]} />
                      <Text style={s.legendTxt}>Goal</Text>
                    </View>
                  </View>
                  <MonthLineChart
                    dailyData={dailyData}
                    goalCalories={goalCalories}
                    daysInMonth={getDaysInMonth(viewYear, viewMonth)}
                  />
                </View>

                {/* Top 5 days */}
                <View style={[s.card, { marginTop: 12 }]}>
                  <Text weight="700" style={s.chartTitle}>Best 5 days</Text>
                  <TopDays
                    dailyData={dailyData}
                    year={viewYear}
                    month={viewMonth}
                    goalCalories={goalCalories}
                  />
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default History;

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: STATUS_BAR_H,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, color: PURPLE },
  headerSub: { fontSize: 12, color: "#333", marginTop: 2 },

  // Toggle
  toggleWrap: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    overflow: "hidden",
  },
  toggleTab: {
    flex: 1, height: 40,
    alignItems: "center", justifyContent: "center",
  },
  toggleTabActive: {},
  toggleTabGrad: {
    width: "100%", height: "100%",
    alignItems: "center", justifyContent: "center",
  },
  toggleTabTxt: { fontSize: 14, color: "#555" },
  toggleTabTxtActive: { fontSize: 14, color: "#fff" },

  // Date scroller
  dateScroller: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  datePill: {
    width: 46, height: 58,
    borderRadius: 10,
    borderWidth: 1, borderColor: "#E8EBF0",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#fff", overflow: "hidden",
  },
  datePillActive: { borderColor: "transparent" },
  datePillGrad: {
    width: "100%", height: "100%",
    alignItems: "center", justifyContent: "center", gap: 2,
  },
  datePillMonth: { fontSize: 10, color: "#999" },
  datePillNum: { fontSize: 16, color: "#333" },
  datePillMonthActive: { fontSize: 10, color: "#fff" },
  datePillNumActive: { fontSize: 16, color: "#fff" },

  // Generic card
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // Hero
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  heroSubLabel: { fontSize: 11, color: "#999", marginBottom: 4 },
  heroKcalRow: { flexDirection: "row", alignItems: "flex-end" },
  heroKcal: { fontSize: isSmall ? 30 : 36, color: "#1A1A1A" },
  heroKcalUnit: { fontSize: 14, color: "#888", marginBottom: 6 },

  donutLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  donutLegendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  donutDot: { width: 9, height: 9, borderRadius: 2 },
  donutLegendTxt: { fontSize: 11, color: "#666" },

  goalChipRow: { marginBottom: 12 },
  goalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  goalChipTxt: { fontSize: 12, color: GREEN_DARK, fontWeight: "600" },

  // Streak
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  streakFire: { fontSize: 26 },
  streakTitle: { fontSize: 14, color: "#1A1A1A" },
  streakSub: { fontSize: 12, color: "#888", marginTop: 2 },
  streakNum: { fontSize: 28, color: GREEN_DARK, marginLeft: "auto" },

  // Meal sections
  mealHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  mealHeadLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  mealBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  mealBadgeTxt: { fontSize: 12 },
  mealKcal: { fontSize: 13, color: "#888" },
  mealEmpty: { alignItems: "center", paddingVertical: 16 },
  mealEmptyTxt: { fontSize: 13, color: "#CCC" },

  // Food items
  foodItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
    gap: 10,
  },
  foodIconWrap: {
    width: isSmall ? 42 : 48,
    height: isSmall ? 42 : 48,
    borderRadius: isSmall ? 21 : 24,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  foodMid: { flex: 1 },
  foodName: { fontSize: 13, color: "#1A1A1A", marginBottom: 3 },
  foodMeta: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  foodMetaTxt: { fontSize: 11, color: "#888" },
  editItemBtn: { padding: 6 },
  calBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#BBF7D0",
    alignItems: "center",
    justifyContent: "center",
  },
  calBadgeTxt: { fontSize: 14, color: GREEN_DARK },
  calBadgeUnit: { fontSize: 9, color: "#888" },

  // Edit bar button
  editBarBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  editBarBtnInner: {
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  editBarBtnTxt: { color: "#fff", fontSize: 15 },

  // Empty / loader
  centeredLoader: { alignItems: "center", paddingVertical: 48 },
  emptyDay: { alignItems: "center", paddingVertical: 56, gap: 10 },
  emptyDayTxt: { fontSize: 14, color: "#AAA" },

  // Section wrapper (week / month)
  sectionWrap: { paddingHorizontal: 16, paddingTop: 4 },
  statsRow: { flexDirection: "row", gap: 10 },

  // Charts
  chartTitle: { fontSize: 14, color: "#1A1A1A", marginBottom: 10 },
  chartLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendDash: {
    width: 14, height: 0,
    borderTopWidth: 2,
    borderStyle: "dashed",
  },
  legendTxt: { fontSize: 11, color: "#666" },

  // Month navigator
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  monthNavBtn: {
    width: 32, height: 32,
    borderRadius: 8,
    borderWidth: 1, borderColor: "#E0E0E0",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#F9F9F9",
  },
  monthNavLabel: { fontSize: 16, color: "#1A1A1A" },
});