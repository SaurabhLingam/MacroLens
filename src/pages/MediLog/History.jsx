import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text } from "../../components/TextWrapper";
import { ensureTodayHistory } from "./medicineHistoryUtils";

// ─── Design tokens ────────────────────────────────────────────────────────────
const P = {
  primary:     "#553FB5",
  primaryDark: "#3D2D8F",
  primaryMid:  "#6B52C8",
  primarySoft: "#8B72E0",
  ghostLight:  "#F0ECFF",
  ghostMid:    "#DCECFF",
  ghostBorder: "#C8B8FF",
  amber:       "#F59E0B",
  red:         "#EF4444",
  green:       "#10B981",
  white:       "#FFFFFF",
  text:        "#1A1235",
  textSub:     "#4A3F70",
  textMuted:   "#9488B8",
  surface:     "#F7F5FF",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const groupByDate = (history) => {
  const groups = {};
  history.forEach((item) => {
    const key = new Date(item.scheduledTime).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return Object.entries(groups)
    .sort(([a], [b]) => new Date(b) - new Date(a))
    .map(([date, items]) => ({ date, items }));
};

const DOSE_TYPE_ICONS = {
  Tablet:    "pill",
  Capsule:   "pill-multiple",
  Syrup:     "bottle-tonic-outline",
  Injection: "needle",
  Drops:     "water-outline",
  Inhaler:   "air-filter",
  Patch:     "bandage",
  Cream:     "lotion-outline",
};

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── StatCard ─────────────────────────────────────────────────────────────────
const StatCard = ({ value, label, color, icon, bg }) => (
  <View style={statStyles.card}>
    <View style={[statStyles.iconBox, { backgroundColor: bg }]}>
      <MaterialCommunityIcons name={icon} size={18} color={color} />
    </View>
    <Text style={[statStyles.value, { color }]}>{value}</Text>
    <Text style={statStyles.label}>{label}</Text>
  </View>
);

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: P.white,
    borderRadius: 18,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EDE8FF",
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    gap: 4,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  value: {
    fontSize: 22,
    fontWeight: "800",
  },
  label: {
    fontSize: 10,
    color: P.textMuted,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 14,
  },
});

// ─── WeeklyHeatmap ────────────────────────────────────────────────────────────
const WeeklyHeatmap = ({ weekData }) => (
  <View style={hmStyles.wrap}>
    <Text style={hmStyles.title}>7-day overview</Text>
    <View style={hmStyles.row}>
      {weekData.map((day, i) => {
        const isToday = day.date.toDateString() === new Date().toDateString();
        const dotColor =
          day.status === "done"    ? P.green
          : day.status === "partial" ? P.amber
          : day.status === "missed"  ? P.red
          : "#EDE8FF";
        const dotBg =
          day.status === "done"    ? "#ECFDF5"
          : day.status === "partial" ? "#FFFBEB"
          : day.status === "missed"  ? "#FFF5F5"
          : P.ghostLight;
        const icon =
          day.status === "done"    ? "check"
          : day.status === "partial" ? "minus"
          : day.status === "missed"  ? "close"
          : null;

        return (
          <View key={i} style={hmStyles.col}>
            <Text style={[hmStyles.dayLabel, isToday && hmStyles.dayLabelToday]}>
              {DAY_ABBR[day.date.getDay()]}
            </Text>
            <View
              style={[
                hmStyles.dot,
                { backgroundColor: dotBg, borderColor: dotColor },
                isToday && hmStyles.dotToday,
              ]}
            >
              {icon && (
                <MaterialCommunityIcons name={icon} size={12} color={dotColor} />
              )}
            </View>
            <Text style={[hmStyles.dateNum, isToday && hmStyles.dateNumToday]}>
              {day.date.getDate()}
            </Text>
          </View>
        );
      })}
    </View>
  </View>
);

const hmStyles = StyleSheet.create({
  wrap: {
    backgroundColor: P.white,
    borderRadius: 18,
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EDE8FF",
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 11,
    fontWeight: "700",
    color: P.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  col: {
    alignItems: "center",
    gap: 4,
  },
  dayLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: P.textMuted,
  },
  dayLabelToday: {
    color: P.primary,
    fontWeight: "800",
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dotToday: {
    borderWidth: 2,
  },
  dateNum: {
    fontSize: 9,
    fontWeight: "600",
    color: P.textMuted,
  },
  dateNumToday: {
    color: P.primary,
    fontWeight: "800",
  },
});

// ─── InsightBanner ────────────────────────────────────────────────────────────
const InsightBanner = ({ adherenceRate, streak, missedCount }) => {
  let icon, bg, textColor, message;

  if (streak >= 7) {
    icon = "fire"; bg = "#FFFBEB"; textColor = "#92400E";
    message = `${streak}-day streak — you're on an incredible run. Don't break it!`;
  } else if (streak >= 3) {
    icon = "lightning-bolt"; bg = P.ghostLight; textColor = P.textSub;
    message = `${streak} days in a row! You're building a solid habit.`;
  } else if (adherenceRate >= 80) {
    icon = "star-circle"; bg = "#ECFDF5"; textColor = "#065F46";
    message = `Great week! ${adherenceRate}% adherence. Consistency is your superpower.`;
  } else if (missedCount > 3) {
    icon = "bell-alert-outline"; bg = "#FFFBEB"; textColor = "#92400E";
    message = `${missedCount} missed doses this week. Setting a reminder might help.`;
  } else if (adherenceRate < 40) {
    icon = "heart-pulse"; bg = "#FFF5F5"; textColor = "#991B1B";
    message = `Low adherence this week. Try taking just one dose on time today.`;
  } else {
    icon = "chart-line"; bg = P.ghostLight; textColor = P.textSub;
    message = `${adherenceRate}% this week — a bit more consistency and you'll hit 80%!`;
  }

  const iconColor =
    bg === "#FFFBEB" ? P.amber
    : bg === "#ECFDF5" ? P.green
    : bg === "#FFF5F5" ? P.red
    : P.primaryMid;

  return (
    <View style={[ibStyles.wrap, { backgroundColor: bg }]}>
      <View style={[ibStyles.iconWrap, { backgroundColor: bg }]}>
        <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[ibStyles.text, { color: textColor }]}>{message}</Text>
    </View>
  );
};

const ibStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
});

// ─── Main Component ───────────────────────────────────────────────────────────
const History = ({ navigation }) => {
  const [grouped, setGrouped]           = useState([]);
  const [refreshing, setRefreshing]     = useState(false);
  const [adherenceRate, setAdherenceRate] = useState(0);
  const [streak, setStreak]             = useState(0);
  const [missedCount, setMissedCount]   = useState(0);
  const [weekData, setWeekData]         = useState([]);
  const [filter, setFilter]             = useState("all");
  const [daysShown, setDaysShown]       = useState(14);
  const [sideEffectModal, setSideEffectModal] = useState({ visible: false, dose: null });
  const [selectedTags, setSelectedTags]       = useState([]);
  const [severity, setSeverity]               = useState(null);
  const [seNote, setSeNote]                   = useState("");

  useEffect(() => {
    loadHistory();
    const unsubscribe = navigation.addListener("focus", loadHistory);
    return unsubscribe;
  }, [navigation, daysShown]);
  const SE_TAGS = ["Nausea", "Dizziness", "Headache", "Fatigue", "Drowsiness", "Rash", "Stomach upset", "Other"];
  const SE_SEVERITY = ["Mild", "Moderate", "Severe"];

  const openSideEffectModal = (dose) => {
    setSelectedTags([]);
    setSeverity(null);
    setSeNote("");
    setSideEffectModal({ visible: true, dose });
  };

  const saveSideEffect = async () => {
    if (!selectedTags.length && !seNote.trim()) return;
    try {
      const userEmail = await AsyncStorage.getItem("currentUser");
      const raw = await AsyncStorage.getItem(`sideeffects_${userEmail}`);
      const existing = raw ? JSON.parse(raw) : [];
      existing.push({
        id: Date.now().toString(),
        medicineId:   sideEffectModal.dose.medicineId,
        medicineName: sideEffectModal.dose.medicineName,
        doseId:       sideEffectModal.dose.id,
        tags:         selectedTags,
        severity,
        note:         seNote.trim(),
        loggedAt:     new Date().toISOString(),
      });
      await AsyncStorage.setItem(`sideeffects_${userEmail}`, JSON.stringify(existing));
      setSideEffectModal({ visible: false, dose: null });
    } catch (_) {}
  };
  const loadHistory = async () => {
    try {
      const userEmail = await AsyncStorage.getItem("currentUser");
      if (!userEmail) return;

      // Seed today's doses (new version)
      await ensureTodayHistory(userEmail);

      const historyRaw = await AsyncStorage.getItem(`history_${userEmail}`);
      let history = historyRaw ? JSON.parse(historyRaw) : [];

      // Belt-and-suspenders inline missed marking (old version)
      const now = new Date();
      let updated = false;
      history = history.map((h) => {
        if (!h.taken && new Date(h.scheduledTime) < now && !h.markedMissed) {
          updated = true;
          return { ...h, markedMissed: true };
        }
        return h;
      });
      if (updated) {
        await AsyncStorage.setItem(`history_${userEmail}`, JSON.stringify(history));
      }

      // ── Stats: 7-day adherence + missed count ──────────────────────────────
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recent = history.filter(
        (h) => new Date(h.scheduledTime) > sevenDaysAgo,
      );
      const takenRecent = recent.filter((h) => h.taken).length;
      const missed7     = recent.filter((h) => !h.taken && h.markedMissed).length;
      setAdherenceRate(
        recent.length > 0 ? Math.round((takenRecent / recent.length) * 100) : 0,
      );
      setMissedCount(missed7);

      // ── Stats: streak ──────────────────────────────────────────────────────
      const days = [
        ...new Set(
          history
            .filter((h) => h.taken)
            .map((h) => new Date(h.takenAt || h.scheduledTime).toDateString()),
        ),
      ].sort((a, b) => new Date(b) - new Date(a));

      let streakCount = 0;
      let checkDate   = new Date();
      for (const day of days) {
        if (day === checkDate.toDateString()) {
          streakCount++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else break;
      }
      setStreak(streakCount);

      // ── Weekly heatmap data ────────────────────────────────────────────────
      const wd = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr   = d.toDateString();
        const dayItems = history.filter(
          (h) => new Date(h.scheduledTime).toDateString() === dayStr,
        );
        let status = "none";
        if (dayItems.length > 0) {
          const tc = dayItems.filter((h) => h.taken).length;
          status = tc === dayItems.length ? "done" : tc > 0 ? "partial" : "missed";
        }
        wd.push({ date: d, status });
      }
      setWeekData(wd);

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysShown);
      const paged = history.filter(h => new Date(h.scheduledTime) >= cutoff);
      setGrouped(groupByDate(paged));
    } catch (_) {}
  };

  // ── Toggle taken — with quantity restore on unmark (from old version) ────
  const toggleTaken = async (item) => {
    try {
      const userEmail  = await AsyncStorage.getItem("currentUser");
      const historyRaw = await AsyncStorage.getItem(`history_${userEmail}`);
      const history    = JSON.parse(historyRaw || "[]");

      const idx = history.findIndex((h) => h.id === item.id);
      if (idx === -1) return;

      history[idx].taken = !history[idx].taken;
      history[idx].takenAt = history[idx].taken ? new Date().toISOString() : null;
      // Clear markedMissed when manually marking as taken
      if (history[idx].taken) history[idx].markedMissed = false;

      const medsRaw = await AsyncStorage.getItem(`medicines_${userEmail}`);
      const meds    = medsRaw ? JSON.parse(medsRaw) : [];
      const medIdx  = meds.findIndex((m) => m.id === item.medicineId);
      if (medIdx !== -1) {
        if (history[idx].taken && meds[medIdx].remainingQuantity > 0) {
          meds[medIdx].remainingQuantity -= 1;       // decrement on mark taken
        } else if (!history[idx].taken) {
          meds[medIdx].remainingQuantity += 1;       // restore on unmark (old version fix)
        }
        await AsyncStorage.setItem(`medicines_${userEmail}`, JSON.stringify(meds));
      }

      await AsyncStorage.setItem(`history_${userEmail}`, JSON.stringify(history));
      loadHistory();
    } catch (_) {}
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, []);

  const getFilteredItems = (items) => {
    if (filter === "taken")  return items.filter((i) => i.taken);
    if (filter === "missed") return items.filter((i) => !i.taken && i.markedMissed);
    return items;
  };

  const isToday = (dateStr) =>
    new Date(dateStr).toDateString() === new Date().toDateString();

  const isYesterday = (dateStr) => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return new Date(dateStr).toDateString() === d.toDateString();
  };

  const renderDateLabel = (dateStr) => {
    if (isToday(dateStr))     return "Today";
    if (isYesterday(dateStr)) return "Yesterday";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "short",
    });
  };

  const FILTERS = [
    { key: "all",    label: "All",    icon: "format-list-bulleted" },
    { key: "taken",  label: "Taken",  icon: "check-circle-outline" },
    { key: "missed", label: "Missed", icon: "close-circle-outline" },
  ];

  // ─── List header (scrolls with list) ────────────────────────────────────
  const ListHeader = () => (
    <>
      {/* 3 Stat cards */}
      <View style={styles.statsRow}>
        <StatCard
          value={`${adherenceRate}%`}
          label={"7-Day\nAdherence"}
          color={adherenceRate >= 80 ? P.green : adherenceRate >= 50 ? P.amber : P.red}
          icon="chart-donut"
          bg={adherenceRate >= 80 ? "#ECFDF5" : adherenceRate >= 50 ? "#FFFBEB" : "#FFF5F5"}
        />
        <StatCard
          value={`${streak}`}
          label={"Day\nStreak"}
          color={P.primaryMid}
          icon="lightning-bolt"
          bg={P.ghostLight}
        />
        <StatCard
          value={`${missedCount}`}
          label={"Missed\nThis Week"}
          color={missedCount === 0 ? P.green : missedCount <= 2 ? P.amber : P.red}
          icon="close-circle-outline"
          bg={missedCount === 0 ? "#ECFDF5" : missedCount <= 2 ? "#FFFBEB" : "#FFF5F5"}
        />
      </View>

      {/* Weekly heatmap */}
      {weekData.length > 0 && <WeeklyHeatmap weekData={weekData} />}

      {/* Insight banner */}
      <InsightBanner
        adherenceRate={adherenceRate}
        streak={streak}
        missedCount={missedCount}
      />

      {/* Filter pills */}
      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const isActive = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={f.icon}
                size={14}
                color={isActive ? "#fff" : P.textMuted}
              />
              <Text
                style={[styles.filterText, isActive && styles.filterTextActive]}
              >
                {" "}{f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>History</Text>
    </>
  );

  // ─── Dose group row ───────────────────────────────────────────────────────
  const renderItem = ({ item: group }) => {
    const filtered   = getFilteredItems(group.items);
    if (!filtered.length) return null;

    const allTaken   = group.items.every((i) => i.taken);
    const someTaken  = group.items.some((i) => i.taken);
    const takenCount = group.items.filter((i) => i.taken).length;
    const totalCount = group.items.length;
    const pct        = Math.round((takenCount / totalCount) * 100);

    const dayStatus = allTaken ? "done" : someTaken ? "partial" : "missed";
    const dayColor  = dayStatus === "done" ? P.green : dayStatus === "partial" ? P.amber : P.red;
    const dayBg     = dayStatus === "done" ? "#ECFDF5" : dayStatus === "partial" ? "#FFFBEB" : "#FFF5F5";
    const dayIcon   = dayStatus === "done" ? "check-circle" : dayStatus === "partial" ? "circle-half-full" : "close-circle";
    const dayLabel  = dayStatus === "done" ? "All done" : dayStatus === "partial" ? "Partial" : "Missed";

    return (
      <View style={styles.group}>
        {/* Date header */}
        <View style={styles.dateHeader}>
          <View style={styles.dateHeaderLeft}>
            <View style={[styles.dateAccentBar, { backgroundColor: dayColor }]} />
            <View>
              <Text style={styles.dateLabel}>{renderDateLabel(group.date)}</Text>
              <Text style={styles.dateSub}>
                {takenCount} of {totalCount} doses · {pct}%
              </Text>
            </View>
          </View>
          <View style={[styles.dayBadge, { backgroundColor: dayBg }]}>
            <MaterialCommunityIcons name={dayIcon} size={13} color={dayColor} />
            <Text style={[styles.dayBadgeText, { color: dayColor }]}>
              {" "}{dayLabel}
            </Text>
          </View>
        </View>

        {/* Dose rows */}
        <View style={styles.dosesCard}>
          {filtered.map((dose, index) => {
            const isTaken = dose.taken;
            return (
              <View key={dose.id}>
                <TouchableOpacity
                  style={[
                    styles.doseRow,
                    isTaken && styles.doseRowTaken,
                    !isTaken && dose.markedMissed && styles.doseRowMissed,
                    index < filtered.length - 1 && styles.doseRowBorder,
                  ]}
                  onPress={() => toggleTaken(dose)}
                  activeOpacity={0.8}
                >
                  {/* State stripe */}
                  <View
                    style={[
                      styles.doseStripe,
                      {
                        backgroundColor: isTaken
                          ? P.green
                          : dose.markedMissed ? P.red : "#EDE8FF",
                      },
                    ]}
                  />

                  {/* Icon */}
                  <View
                    style={[
                      styles.doseIconWrap,
                      {
                        backgroundColor: isTaken
                          ? "#ECFDF5"
                          : dose.markedMissed ? "#FFF5F5" : P.ghostLight,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={DOSE_TYPE_ICONS[dose.doseType] || "pill"}
                      size={20}
                      color={isTaken ? P.green : dose.markedMissed ? P.red : P.textMuted}
                    />
                  </View>

                  {/* Info */}
                  <View style={styles.doseInfo}>
                    <Text style={styles.doseName}>{dose.medicineName}</Text>
                    <View style={styles.doseMetaRow}>
                      <Text style={styles.doseMeta}>{dose.doseType}</Text>
                      <View style={styles.dotSep} />
                      <Text style={styles.doseMeta}>{dose.time}</Text>
                    </View>

                    {isTaken && dose.takenAt && (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        <View style={styles.takenChip}>
                          <MaterialCommunityIcons
                            name="clock-check-outline"
                            size={11}
                            color={P.green}
                          />
                          <Text style={styles.takenChipText}>
                            {" "}Taken at{" "}
                            {new Date(dose.takenAt).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.reactionChip}
                          onPress={() => openSideEffectModal(dose)}
                          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        >
                          <MaterialCommunityIcons name="alert-circle-outline" size={11} color={P.amber} />
                          <Text style={styles.reactionChipText}> Note reaction</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {!isTaken && dose.markedMissed && (
                      <View style={styles.missedChip}>
                        <MaterialCommunityIcons
                          name="alert-circle-outline"
                          size={11}
                          color={P.red}
                        />
                        <Text style={styles.missedChipText}>{" "}Missed</Text>
                      </View>
                    )}
                  </View>

                  {/* Action button */}
                  {(() => {
                    const hoursSince = (new Date() - new Date(dose.scheduledTime)) / (1000 * 60 * 60);
                    const locked = !isTaken && hoursSince > 12;
                    if (locked) return null;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.actionChip,
                          isTaken ? styles.actionChipTaken : styles.actionChipPending,
                        ]}
                        onPress={() => toggleTaken(dose)}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      >
                        <MaterialCommunityIcons
                          name={isTaken ? "check" : "plus"}
                          size={13}
                          color={isTaken ? P.green : "#FFFFFF"}
                        />
                        <Text
                          style={[
                            styles.actionChipText,
                            isTaken
                              ? styles.actionChipTextTaken
                              : styles.actionChipTextPending,
                          ]}
                        >
                          {isTaken ? "Done" : "Mark"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={P.surface} />

      {/* Fixed header band */}
      <LinearGradient
        colors={[P.ghostMid, "rgba(220,236,255,0.4)", P.surface]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.headerBand}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={P.textSub} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Dose History</Text>
            <Text style={styles.subtitle}>Track your intake regularity</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Scrollable list with header component */}
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.date}
        renderItem={renderItem}
        ListHeaderComponent={<ListHeader />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={P.primary}
          />
        }
        ListFooterComponent={
          grouped.length > 0 ? (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => setDaysShown(d => d + 14)}
              activeOpacity={0.8}
            >
              <Text style={styles.loadMoreText}>Load more (14 days)</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons
                name="history"
                size={44}
                color={P.ghostBorder}
              />
            </View>
            <Text style={styles.emptyTitle}>No History Yet</Text>
            <Text style={styles.emptyText}>
              Log a medicine to start tracking your doses here.
            </Text>
          </View>
        }
      />
      <Modal
        visible={sideEffectModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setSideEffectModal({ visible: false, dose: null })}
      >
        <TouchableOpacity
          style={styles.seOverlay}
          activeOpacity={1}
          onPress={() => setSideEffectModal({ visible: false, dose: null })}
        />
        <View style={styles.seSheet}>
          <View style={styles.seHandle} />
          <Text style={styles.seTitle}>Log Side Effect</Text>
          <Text style={styles.seMedName}>{sideEffectModal.dose?.medicineName}</Text>

          <Text style={styles.seSection}>What did you experience?</Text>
          <View style={styles.seTagsRow}>
            {SE_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.seTag, active && styles.seTagActive]}
                  onPress={() =>
                    setSelectedTags((prev) =>
                      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                    )
                  }
                  activeOpacity={0.8}
                >
                  <Text style={[styles.seTagText, active && styles.seTagTextActive]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.seSection}>Severity</Text>
          <View style={styles.seSeverityRow}>
            {SE_SEVERITY.map((s) => {
              const active = severity === s;
              const color = s === "Mild" ? P.green : s === "Moderate" ? P.amber : P.red;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.seSeverityBtn, active && { backgroundColor: color + "20", borderColor: color }]}
                  onPress={() => setSeverity(s)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.seSeverityText, active && { color, fontWeight: "700" }]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.seSection}>Additional note (optional)</Text>
          <TextInput
            style={styles.seInput}
            placeholder="e.g. Felt dizzy 30 mins after taking"
            placeholderTextColor={P.ghostBorder}
            value={seNote}
            onChangeText={setSeNote}
            multiline
            numberOfLines={2}
          />

          <View style={styles.seActions}>
            <TouchableOpacity
              style={styles.seCancelBtn}
              onPress={() => setSideEffectModal({ visible: false, dose: null })}
            >
              <Text style={styles.seCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.seSaveBtn} onPress={saveSideEffect}>
              <Text style={styles.seSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default History;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: P.surface,
  },

  // ─── Header band ───────────────────────────────────────────────────────────
  headerBand: {
    paddingBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 16,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: P.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EDE8FF",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: P.text,
  },
  subtitle: {
    fontSize: 13,
    color: P.textMuted,
    marginTop: 1,
  },

  // ─── Stats row ─────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
    marginBottom: 12,
  },

  // ─── Filters ───────────────────────────────────────────────────────────────
  filters: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 6,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 24,
    backgroundColor: P.white,
    borderWidth: 1.5,
    borderColor: "#EDE8FF",
  },
  filterPillActive: {
    backgroundColor: P.primary,
    borderColor: P.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
    color: P.textMuted,
  },
  filterTextActive: {
    color: "#fff",
  },

  // ─── Section label ─────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: P.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 8,
  },

  // ─── List ──────────────────────────────────────────────────────────────────
  listContent: {
    paddingBottom: 48,
    paddingTop: 16,
  },

  // ─── Group ─────────────────────────────────────────────────────────────────
  group: {
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  dateHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dateAccentBar: {
    width: 4,
    height: 36,
    borderRadius: 2,
  },
  dateLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: P.text,
  },
  dateSub: {
    fontSize: 12,
    color: P.textMuted,
    fontWeight: "500",
    marginTop: 1,
  },
  dayBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  dayBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // ─── Doses card ────────────────────────────────────────────────────────────
  dosesCard: {
    backgroundColor: P.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EDE8FF",
    overflow: "hidden",
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  doseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingRight: 16,
    backgroundColor: P.white,
  },
  doseRowTaken:  { backgroundColor: "#F8FFFE" },
  doseRowMissed: { backgroundColor: "#FFFAFA" },
  doseRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0EAFF",
  },
  doseStripe: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 2,
    marginLeft: 12,
    marginRight: 12,
    minHeight: 48,
  },
  doseIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  doseInfo: {
    flex: 1,
  },
  doseName: {
    fontSize: 15,
    fontWeight: "700",
    color: P.text,
    marginBottom: 3,
  },
  doseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  doseMeta: {
    fontSize: 12,
    color: P.textMuted,
    fontWeight: "500",
  },
  dotSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#C8B8FF",
  },
  takenChip: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  takenChipText: {
    fontSize: 11,
    color: P.green,
    fontWeight: "600",
  },
  missedChip: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    backgroundColor: "#FFF5F5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  missedChipText: {
    fontSize: 11,
    color: P.red,
    fontWeight: "600",
  },

  // ─── Action chip ───────────────────────────────────────────────────────────
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 4,
    flexShrink: 0,
  },
  actionChipTaken: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  actionChipPending: {
    backgroundColor: P.primary,
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionChipTextTaken:   { color: P.green },
  actionChipTextPending: { color: "#FFFFFF" },

  // ─── Empty state ───────────────────────────────────────────────────────────
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: P.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EDE8FF",
    marginBottom: 4,
  },
  loadMoreBtn: {
    alignSelf: "center",
    marginTop: 4,
    marginBottom: 16,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 20,
    backgroundColor: P.white,
    borderWidth: 1.5,
    borderColor: P.ghostBorder,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: "700",
    color: P.primary,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: P.textSub,
  },
  emptyText: {
    fontSize: 14,
    color: P.textMuted,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 16,
  },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  reactionChipText: {
    fontSize: 11,
    color: P.amber,
    fontWeight: "600",
  },
  seOverlay: {
    flex: 1,
    backgroundColor: "rgba(26,18,53,0.45)",
  },
  seSheet: {
    backgroundColor: P.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    borderWidth: 1,
    borderColor: P.ghostBorder,
  },
  seHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: P.ghostBorder,
    alignSelf: "center",
    marginBottom: 18,
  },
  seTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: P.text,
    marginBottom: 4,
  },
  seMedName: {
    fontSize: 14,
    fontWeight: "700",
    color: P.primary,
    marginBottom: 18,
  },
  seSection: {
    fontSize: 11,
    fontWeight: "700",
    color: P.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  seTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  seTag: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: P.surface,
    borderWidth: 1.5,
    borderColor: P.ghostBorder,
  },
  seTagActive: {
    backgroundColor: P.ghostLight,
    borderColor: P.primary,
  },
  seTagText: {
    fontSize: 13,
    color: P.textMuted,
    fontWeight: "600",
  },
  seTagTextActive: {
    color: P.primary,
    fontWeight: "700",
  },
  seSeverityRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  seSeverityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: P.surface,
    borderWidth: 1.5,
    borderColor: P.ghostBorder,
    alignItems: "center",
  },
  seSeverityText: {
    fontSize: 13,
    color: P.textMuted,
    fontWeight: "600",
  },
  seInput: {
    borderWidth: 1.5,
    borderColor: P.ghostBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: P.text,
    backgroundColor: P.surface,
    textAlignVertical: "top",
    marginBottom: 24,
  },
  seActions: {
    flexDirection: "row",
    gap: 10,
  },
  seCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: P.ghostLight,
    alignItems: "center",
  },
  seCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: P.primary,
  },
  seSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: P.primary,
    alignItems: "center",
  },
  seSaveText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});