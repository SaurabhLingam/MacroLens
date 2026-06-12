import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Easing,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text } from "../../components/TextWrapper";

// ─── Design tokens (purple system) ───────────────────────────────────────────
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

// ─── Press-scale wrapper ──────────────────────────────────────────────────────
const PressScale = ({ onPress, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to) =>
    Animated.spring(scale, {
      toValue: to, useNativeDriver: true, speed: 40, bounciness: 4,
    }).start();
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

// ─── Stagger entrance animation ───────────────────────────────────────────────
const StaggerItem = ({ delay = 0, children, style }) => {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
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

// ─── Animated adherence ring ──────────────────────────────────────────────────
const AdherenceRing = ({ pct = 0, size = 88, strokeW = 8 }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: pct, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [pct]);
  const color = pct >= 80 ? P.green : pct >= 50 ? P.amber : P.red;
  const label = pct >= 80 ? "Great" : pct >= 50 ? "Good" : pct > 0 ? "Low" : "—";
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{
        position: "absolute", width: size, height: size,
        borderRadius: size / 2, borderWidth: strokeW,
        borderColor: "rgba(255,255,255,0.15)",
      }} />
      <View style={{
        position: "absolute", width: size, height: size,
        borderRadius: size / 2, borderWidth: strokeW,
        borderColor: "transparent",
        borderTopColor:    pct > 0  ? color : "transparent",
        borderRightColor:  pct > 25 ? color : "transparent",
        borderBottomColor: pct > 50 ? color : "transparent",
        borderLeftColor:   pct > 75 ? color : "transparent",
        transform: [{ rotate: "-90deg" }],
      }} />
      <View style={{ alignItems: "center" }}>
        <Text weight="800" style={{ fontSize: 20, color: "#fff", lineHeight: 24 }}>{pct}%</Text>
        <Text weight="500" style={{ fontSize: 8.5, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>
          {label}
        </Text>
      </View>
    </View>
  );
};

// ─── Animated progress bar ────────────────────────────────────────────────────
const ProgressBar = ({ pct = 0 }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [pct]);
  const color = pct >= 80 ? P.green : pct >= 50 ? P.amber : P.primary;
  return (
    <View style={s.progressTrack}>
      <Animated.View
        style={[s.progressFill, {
          backgroundColor: color,
          width: anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
        }]}
      />
    </View>
  );
};

// ─── Quick action tile ────────────────────────────────────────────────────────
const QuickTile = ({ iconName, label, desc, gradColors, iconColor, accentColor, onPress }) => (
  <PressScale onPress={onPress} style={{ flex: 1 }}>
    <View style={[s.tileShadow, { shadowColor: accentColor }]}>
      <View style={s.tileCard}>
        <LinearGradient
          colors={gradColors}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.tileGrad}
        >
          <View style={[s.tileIconWrap, { backgroundColor: accentColor + "18" }]}>
            <MaterialCommunityIcons name={iconName} size={18} color={iconColor} />
          </View>
          <Text weight="700" style={[s.tileLabel, { color: accentColor }]}>{label}</Text>
          <Text style={s.tileDesc}>{desc}</Text>
        </LinearGradient>
      </View>
    </View>
  </PressScale>
);

// ─── Dose row ─────────────────────────────────────────────────────────────────
const DoseRow = ({ dose, isLast }) => {
  const taken = dose.taken;
  const color  = taken ? P.green : P.amber;
  const bg     = taken ? "#ECFDF5" : "#FFFBEB";
  const border = taken ? "#A7F3D0" : "#FDE68A";
  return (
    <View style={[s.doseRow, !isLast && s.doseRowBorder]}>
      <View style={[s.doseAccent, { backgroundColor: color }]} />
      <View style={[s.doseIconBox, { backgroundColor: bg }]}>
        <MaterialCommunityIcons
          name={taken ? "check-circle" : "clock-outline"}
          size={15}
          color={color}
        />
      </View>
      <View style={s.doseInfo}>
        <Text weight="600" style={[s.doseName, taken && { opacity: 0.45 }]}>
          {dose.medicineName}
        </Text>
        <Text style={s.doseTime}>{dose.time}</Text>
      </View>
      <View style={[s.doseBadge, { backgroundColor: bg, borderColor: border }]}>
        <Text weight="700" style={[s.doseBadgeText, { color }]}>
          {taken ? "Taken" : "Pending"}
        </Text>
      </View>
    </View>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const MediLogDash = ({ navigation }) => {
  const [todayDoses,  setTodayDoses]  = useState([]);
  const [takenCount,  setTakenCount]  = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalMeds,   setTotalMeds]   = useState(0);

  useEffect(() => {
    loadTodaySummary();
    const unsubscribe = navigation.addListener("focus", loadTodaySummary);
    return unsubscribe;
  }, [navigation]);

  const loadTodaySummary = async () => {
    try {
      const userEmail = await AsyncStorage.getItem("currentUser");
      if (!userEmail) return;

      const medsRaw = await AsyncStorage.getItem(`medicines_${userEmail}`);
      const meds    = medsRaw ? JSON.parse(medsRaw) : [];
      const active  = meds.filter((m) => m.active !== false);
      setTotalMeds(active.length);

      const historyRaw = await AsyncStorage.getItem(`history_${userEmail}`);
      const history    = historyRaw ? JSON.parse(historyRaw) : [];
      const today      = new Date().toDateString();
      const todayHist  = history.filter(
        (h) => new Date(h.scheduledTime).toDateString() === today
      );

      const taken   = todayHist.filter((h) => h.taken).length;
      const pending = todayHist.filter((h) => !h.taken).length;

      setTodayDoses(todayHist.slice(0, 4));
      setTakenCount(taken);
      setPendingCount(pending);
    } catch (_) {}
  };

  const adherence =
    takenCount + pendingCount > 0
      ? Math.round((takenCount / (takenCount + pendingCount)) * 100)
      : 0;

  const TILES = [
    {
      iconName: "plus-circle-outline",
      label:    "Add",
      desc:     "Log medicine",
      route:    "LogNewMedicine",
      gradColors: ["#FFFFFF", P.ghostLight],
      iconColor:  P.primary,
      accentColor: P.primary,
    },
    {
      iconName: "clipboard-text-clock-outline",
      label:    "History",
      desc:     "Intake log",
      route:    "History",
      gradColors: ["#FFFFFF", "#EFF6FF"],
      iconColor:  "#2563EB",
      accentColor: "#2563EB",
    },
    {
      iconName: "pill-multiple",
      label:    "Box",
      desc:     "All medicines",
      route:    "MedicineBox",
      gradColors: ["#FFFFFF", "#FFF5F5"],
      iconColor:  P.red,
      accentColor: P.red,
    },
  ];

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={P.surface} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <StaggerItem delay={0}>
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Ionicons name="arrow-back" size={18} color={P.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text weight="800" style={s.headerTitle}>Medicine Log</Text>
              <Text style={s.headerSub}>Your daily health regime</Text>
            </View>
            <View style={s.headerBadge}>
              <MaterialCommunityIcons name="pill" size={16} color={P.primarySoft} />
            </View>
          </View>
        </StaggerItem>

        {/* ── Hero card ─────────────────────────────────────────────────── */}
        <StaggerItem delay={40}>
          <View style={s.heroCard}>
            <LinearGradient
              colors={[P.primary, P.primaryDark, "#2D1F6E"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.heroGradient}
            >
              {/* Decorative blobs */}
              <View style={[s.blob, { top: -30, right: -20, width: 110, height: 110, opacity: 0.14 }]} />
              <View style={[s.blob, { bottom: -24, left: -10, width: 80, height: 80, opacity: 0.1 }]} />
              <View style={[s.blob, { top: 30, right: 60, width: 50, height: 50, opacity: 0.08 }]} />

              <View style={s.heroLeft}>
                {/* Date badge */}
                <View style={s.dateBadge}>
                  <MaterialCommunityIcons name="calendar-today" size={11} color={P.ghostBorder} />
                  <Text weight="500" style={s.dateBadgeText}>
                    {new Date().toLocaleDateString("en-IN", {
                      weekday: "short", day: "numeric", month: "short",
                    })}
                  </Text>
                </View>

                <Text weight="800" style={s.heroTitle}>Today's Overview</Text>

                {/* Stats row */}
                <View style={s.heroStatsRow}>
                  <View style={s.heroStat}>
                    <Text weight="800" style={[s.heroStatNum, { color: P.green }]}>
                      {takenCount}
                    </Text>
                    <Text weight="500" style={s.heroStatLabel}>Taken</Text>
                  </View>
                  <View style={s.heroStatDivider} />
                  <View style={s.heroStat}>
                    <Text weight="800" style={[s.heroStatNum, { color: P.amber }]}>
                      {pendingCount}
                    </Text>
                    <Text weight="500" style={s.heroStatLabel}>Pending</Text>
                  </View>
                  <View style={s.heroStatDivider} />
                  <View style={s.heroStat}>
                    <Text weight="800" style={[s.heroStatNum, { color: "#C8B8FF" }]}>
                      {totalMeds}
                    </Text>
                    <Text weight="500" style={s.heroStatLabel}>Active</Text>
                  </View>
                </View>

                {/* Progress bar */}
                {takenCount + pendingCount > 0 && (
                  <View style={{ marginTop: 14 }}>
                    <View style={s.progressLabelRow}>
                      <Text weight="500" style={s.progressLabel}>
                        {takenCount} of {takenCount + pendingCount} doses taken
                      </Text>
                      <Text weight="700" style={[
                        s.progressPct,
                        {
                          color: adherence >= 80 ? P.green
                               : adherence >= 50 ? P.amber
                               : "#FF8A8A"
                        }
                      ]}>
                        {adherence}%
                      </Text>
                    </View>
                    <ProgressBar pct={adherence} />
                  </View>
                )}
              </View>

              {/* Adherence ring */}
              <View style={s.heroRight}>
                <AdherenceRing pct={adherence} size={86} strokeW={8} />
                <Text weight="500" style={s.adherenceLabel}>Adherence</Text>
              </View>
            </LinearGradient>
          </View>
        </StaggerItem>

        {/* ── Quick action tiles ─────────────────────────────────────────── */}
        <StaggerItem delay={100}>
          <Text weight="700" style={s.sectionLabel}>QUICK ACTIONS</Text>
          <View style={s.tilesRow}>
            {TILES.map((t) => (
              <QuickTile
                key={t.route}
                iconName={t.iconName}
                label={t.label}
                desc={t.desc}
                gradColors={t.gradColors}
                iconColor={t.iconColor}
                accentColor={t.accentColor}
                onPress={() => navigation.navigate(t.route)}
              />
            ))}
          </View>
        </StaggerItem>

        {/* ── Upcoming doses ─────────────────────────────────────────────── */}
        {todayDoses.length > 0 && (
          <StaggerItem delay={160}>
            <View style={s.sectionHeader}>
              <Text weight="700" style={s.sectionLabel}>UPCOMING DOSES</Text>
              <View style={s.sectionCount}>
                <Text weight="700" style={s.sectionCountText}>
                  {todayDoses.length}
                </Text>
              </View>
            </View>
            <View style={s.dosesCard}>
              {todayDoses.map((dose, i) => (
                <DoseRow key={i} dose={dose} isLast={i === todayDoses.length - 1} />
              ))}
            </View>
          </StaggerItem>
        )}

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {todayDoses.length === 0 && (
          <StaggerItem delay={160}>
            <View style={s.emptyCard}>
              <View style={s.emptyIconWrap}>
                <MaterialCommunityIcons name="pill" size={28} color={P.textMuted} />
              </View>
              <Text weight="600" style={s.emptyTitle}>No doses scheduled today</Text>
              <Text style={s.emptyText}>
                Tap "Add" above to start tracking your medicines.
              </Text>
            </View>
          </StaggerItem>
        )}

        {/* ── Tip banner ──────────────────────────────────────────────────── */}
        <StaggerItem delay={220}>
          <View style={s.tipCard}>
            <LinearGradient
              colors={[P.ghostLight, "#EDE8FF"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.tipGradient}
            >
              <View style={s.tipIconWrap}>
                <Ionicons name="bulb-outline" size={14} color={P.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text weight="700" style={s.tipTitle}>Pro Tip</Text>
                <Text style={s.tipText}>
                  Set up dose reminders when logging a medicine — the app will alert you before each scheduled time.
                </Text>
              </View>
            </LinearGradient>
          </View>
        </StaggerItem>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MediLogDash;

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: P.surface,
  },

  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },

  // ── Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 18,
    marginBottom: 20,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: P.ghostLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: P.ghostBorder,
  },
  headerTitle: {
    fontSize: 22,
    color: P.text,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: P.textMuted,
    marginTop: 1,
  },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: P.ghostLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: P.ghostBorder,
  },

  // ── Hero card
  heroCard: {
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: P.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
  },
  heroGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 22,
    minHeight: 160,
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: P.white,
  },
  heroLeft: {
    flex: 1,
    paddingRight: 16,
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    marginBottom: 10,
  },
  dateBadgeText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.72)",
  },
  heroTitle: {
    fontSize: 17,
    color: P.white,
    letterSpacing: 0.1,
    marginBottom: 14,
  },
  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroStat: {
    alignItems: "center",
    paddingHorizontal: 10,
  },
  heroStatNum: {
    fontSize: 26,
    lineHeight: 30,
  },
  heroStatLabel: {
    fontSize: 9.5,
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },
  progressLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.55)",
  },
  progressPct: {
    fontSize: 11,
  },
  progressTrack: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 5,
    borderRadius: 3,
  },
  heroRight: {
    alignItems: "center",
    gap: 6,
  },
  adherenceLabel: {
    fontSize: 9,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.3,
  },

  // ── Section labels
  sectionLabel: {
    fontSize: 11,
    color: P.textMuted,
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionCount: {
    minWidth: 22,
    height: 18,
    borderRadius: 9,
    backgroundColor: P.ghostLight,
    borderWidth: 1,
    borderColor: P.ghostBorder,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginBottom: 1,
  },
  sectionCountText: {
    fontSize: 10,
    color: P.primary,
  },

  // ── Quick action tiles
  tilesRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  tileShadow: {
    flex: 1,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  tileCard: {
    flex: 1,
    height: 96,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
  },
  tileGrad: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 11,
    justifyContent: "flex-start",
  },
  tileIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  tileLabel: {
    fontSize: 12.5,
    lineHeight: 15,
  },
  tileDesc: {
    fontSize: 9,
    color: P.textMuted,
    lineHeight: 12,
    marginTop: 2,
  },

  // ── Doses card
  dosesCard: {
    backgroundColor: P.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EDE8FF",
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  doseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 11,
    overflow: "hidden",
  },
  doseRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0EAFF",
  },
  doseAccent: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
  },
  doseIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  doseInfo: {
    flex: 1,
  },
  doseName: {
    fontSize: 14,
    color: P.text,
  },
  doseTime: {
    fontSize: 11,
    color: P.textMuted,
    marginTop: 2,
  },
  doseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  doseBadgeText: {
    fontSize: 11,
  },

  // ── Empty state
  emptyCard: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: P.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EDE8FF",
    gap: 6,
    marginBottom: 20,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: P.ghostLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    color: P.text,
  },
  emptyText: {
    fontSize: 12,
    color: P.textMuted,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 220,
  },

  // ── Tip banner
  tipCard: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  tipGradient: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.ghostBorder,
  },
  tipIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(85,63,181,0.1)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  tipTitle: {
    fontSize: 13,
    color: P.primary,
    marginBottom: 3,
  },
  tipText: {
    fontSize: 11.5,
    lineHeight: 17,
    color: P.textSub,
  },
});