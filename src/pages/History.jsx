/**
 * History.jsx — Premium redesign
 *
 * Key improvements:
 *  • Dark forest-green hero matching the rest of the design system
 *  • Hero shows count of days tracked in a subtitle
 *  • Loading state has an ActivityIndicator (not just text)
 *  • Empty state has an icon bubble + descriptive copy
 *  • History cards are rich: date + calorie badge, item count, macro row
 *  • Macro pills use proper View containers (not inline Text styles)
 *  • Per-card colored calorie badge (primary green)
 *  • Stagger-animated card list (slide up + fade)
 *  • "Today" card gets a visual accent border
 *  • All logic, navigation, and AsyncStorage calls preserved exactly
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
  ActivityIndicator,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Text } from "../components/TextWrapper";
import { C } from "../theme";
import { parseJsonSafe } from "../utils";

const { width } = Dimensions.get("window");
const isSmall = width < 380;

// ── Design tokens ──────────────────────────────
// ── Constants ─────────────────────────────────
const LOG_PREFIX = "nutritionLog_";

const formatDate = (value) => {
  if (!value) return "Unknown date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const isToday = (dateStr) => {
  const t = new Date();
  const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  return dateStr === key;
};

const mealCount = (meals) =>
  Object.values(meals || {}).reduce(
    (t, l) => t + (Array.isArray(l) ? l.length : 0),
    0,
  );

// ── Animated entry card ────────────────────────
const HistoryCard = ({ entry, index }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        speed: 16,
        bounciness: 3,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const today = isToday(entry.date);

  return (
    <Animated.View
      style={[
        h.card,
        today && h.cardToday,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      {/* Today tag */}
      {today && (
        <View style={h.todayTag}>
          <Text weight="700" style={h.todayTagTxt}>
            Today
          </Text>
        </View>
      )}

      {/* Top row: date + calorie badge */}
      <View style={h.cardTop}>
        <View style={{ flex: 1 }}>
          <Text weight="700" style={h.dateText}>
            {entry.label}
          </Text>
          <Text style={h.itemsText}>
            {entry.totalMeals} item{entry.totalMeals !== 1 ? "s" : ""} logged
          </Text>
        </View>
        <View style={h.calBadge}>
          <Text weight="800" style={h.calBadgeVal}>
            {Math.round(entry.totalCalories)}
          </Text>
          <Text style={h.calBadgeUnit}>kcal</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={h.divider} />

      {/* Macro pills */}
      <View style={h.macroRow}>
        <View style={[h.macroPill, { backgroundColor: C.blueLight }]}>
          <Text weight="700" style={[h.macroPillTxt, { color: C.blue }]}>
            P {entry.totalProtein.toFixed(1)}g
          </Text>
        </View>
        <View style={[h.macroPill, { backgroundColor: C.emeraldLight }]}>
          <Text weight="700" style={[h.macroPillTxt, { color: C.emerald }]}>
            C {entry.totalCarbs.toFixed(1)}g
          </Text>
        </View>
        <View style={[h.macroPill, { backgroundColor: C.orangeLight }]}>
          <Text weight="700" style={[h.macroPillTxt, { color: C.orange }]}>
            F {entry.totalFat.toFixed(1)}g
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────
const History = () => {
  const navigation = useNavigation();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(heroSlide, {
        toValue: 0,
        speed: 14,
        bounciness: 3,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadHistory = async () => {
        try {
          setLoading(true);
          const keys = await AsyncStorage.getAllKeys();
          const logKeys = keys
            .filter((key) => key.startsWith(LOG_PREFIX))
            .sort()
            .reverse();

          if (logKeys.length === 0) {
            if (mounted) {
              setHistory([]);
              setLoading(false);
            }
            return;
          }

          const pairs = await AsyncStorage.multiGet(logKeys);
          const formatted = pairs
            .map(([key, raw]) => {
              const parsed = parseJsonSafe(raw, {});
              const date = parsed?.date || key.replace(LOG_PREFIX, "");
              return {
                key,
                date,
                label: formatDate(date),
                totalCalories: Number(parsed?.totalCalories || 0),
                totalProtein: Number(parsed?.totalProtein || 0),
                totalCarbs: Number(parsed?.totalCarbs || 0),
                totalFat: Number(parsed?.totalFat || 0),
                totalMeals: mealCount(parsed?.meals || {}),
              };
            })
            .sort((a, b) => (a.date < b.date ? 1 : -1));

          if (mounted) setHistory(formatted);
        } finally {
          if (mounted) setLoading(false);
        }
      };

      loadHistory();
      return () => {
        mounted = false;
      };
    }, []),
  );

  // ── Stats aggregation ──────────────────────
  const totalDays = history.length;
  const avgCalories =
    totalDays > 0
      ? Math.round(history.reduce((s, e) => s + e.totalCalories, 0) / totalDays)
      : 0;

  // ─── RENDER ──────────────────────────────────
  return (
    <View style={h.page}>
      {/* ══ HERO ══════════════════════════════ */}
      <Animated.View
        style={{ opacity: heroFade, transform: [{ translateY: heroSlide }] }}
      >
        <LinearGradient
          colors={[C.primaryDark, C.primary, C.primaryMid]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={h.hero}
        >
          {/* Decorative bubble */}
          <View style={h.heroBubble} />

          <View style={h.topBar}>
            <TouchableOpacity
              style={h.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.75}
            >
              <Feather name="arrow-left" size={18} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={h.heroEyebrow}>Your Progress</Text>
              <Text weight="800" style={h.heroTitle}>
                Nutrition History
              </Text>
            </View>
          </View>

          {/* Aggregate stats strip */}
          {!loading && totalDays > 0 && (
            <View style={h.statsStrip}>
              <View style={h.statItem}>
                <Text weight="800" style={h.statVal}>
                  {totalDays}
                </Text>
                <Text style={h.statLabel}>Days tracked</Text>
              </View>
              <View style={h.statDivider} />
              <View style={h.statItem}>
                <Text weight="800" style={h.statVal}>
                  {avgCalories}
                </Text>
                <Text style={h.statLabel}>Avg kcal/day</Text>
              </View>
              <View style={h.statDivider} />
              <View style={h.statItem}>
                <Text weight="800" style={h.statVal}>
                  {Math.round(history.reduce((s, e) => s + e.totalMeals, 0))}
                </Text>
                <Text style={h.statLabel}>Total items</Text>
              </View>
            </View>
          )}
        </LinearGradient>
      </Animated.View>

      {/* ══ CONTENT ═══════════════════════════ */}
      <ScrollView
        style={h.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 28,
          paddingTop: 16,
          paddingHorizontal: 16,
        }}
      >
        {/* Loading */}
        {loading && (
          <View style={h.loadingState}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text weight="600" style={h.loadingTxt}>
              Loading your history...
            </Text>
          </View>
        )}

        {/* Empty */}
        {!loading && history.length === 0 && (
          <View style={h.emptyState}>
            <View style={h.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={32} color={C.textMuted} />
            </View>
            <Text weight="700" style={h.emptyTitle}>
              No history yet
            </Text>
            <Text style={h.emptySubtitle}>
              Start logging meals and your daily nutrition records will appear
              here.
            </Text>
          </View>
        )}

        {/* History cards */}
        {!loading &&
          history.map((entry, idx) => (
            <HistoryCard key={entry.key} entry={entry} index={idx} />
          ))}
      </ScrollView>
    </View>
  );
};

export default History;

// ── Styles ─────────────────────────────────────────
const h = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 56 : 38,
    paddingBottom: 22,
    overflow: "hidden",
  },
  heroBubble: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.05)",
    top: -60,
    right: -50,
  },
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroEyebrow: {
    fontSize: 11,
    color: "rgba(255,255,255,0.62)",
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  heroTitle: { fontSize: isSmall ? 20 : 23, color: "#fff" },

  // Stats strip
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 8,
  },
  statItem: { flex: 1, alignItems: "center" },
  statVal: { fontSize: isSmall ? 17 : 19, color: "#fff" },
  statLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.62)",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: "rgba(255,255,255,0.15)",
  },

  // Loading
  loadingState: { alignItems: "center", paddingTop: 56, gap: 14 },
  loadingTxt: { fontSize: 14, color: C.textMuted },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 28,
    gap: 10,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 18, color: C.text, textAlign: "center" },
  emptySubtitle: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 19,
  },

  // History card
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: isSmall ? 14 : 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardToday: {
    borderColor: C.primary,
    borderWidth: 1.5,
  },
  todayTag: {
    alignSelf: "flex-start",
    backgroundColor: C.primaryGhost,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  todayTagTxt: { fontSize: 11, color: C.primary },

  cardTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  dateText: { fontSize: isSmall ? 14 : 15, color: C.text, marginBottom: 3 },
  itemsText: { fontSize: 12, color: C.textMuted },

  calBadge: {
    alignItems: "center",
    minWidth: 70,
    backgroundColor: C.primaryGhost,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginLeft: 8,
  },
  calBadgeVal: { fontSize: isSmall ? 17 : 19, color: C.primary },
  calBadgeUnit: { fontSize: 10, color: C.primary, opacity: 0.7, marginTop: 1 },

  divider: { height: 1, backgroundColor: C.border, marginBottom: 10 },

  macroRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  macroPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  macroPillTxt: { fontSize: 12 },
});