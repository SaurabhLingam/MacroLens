import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text } from "../../components/TextWrapper";
import { isExpoGo, scheduleNotifications } from "./notificationService";

// ─── Design tokens (MacroLens purple system) ──────────────────────────────────
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
  surface:     "#F7F5FF",
  white:       "#FFFFFF",
  text:        "#1A1235",
  textSub:     "#4A3F70",
  textMuted:   "#9488B8",
};

// ─── Constants ────────────────────────────────────────────────────────────────
const DOSE_TYPES = [
  { label: "Tablet",    icon: "pill" },
  { label: "Capsule",   icon: "pill-multiple" },
  { label: "Syrup",     icon: "bottle-tonic-outline" },
  { label: "Injection", icon: "needle" },
  { label: "Drops",     icon: "water-outline" },
  { label: "Inhaler",   icon: "air-filter" },
  { label: "Patch",     icon: "bandage" },
  { label: "Cream",     icon: "lotion-outline" },
];

const DOSE_FREQUENCIES = [
  { label: "Once a day",    count: 1 },
  { label: "Twice a day",   count: 2 },
  { label: "3 times a day", count: 3 },
  { label: "4 times a day", count: 4 },
  { label: "Every 6 hours", count: 4 },
  { label: "Every 8 hours", count: 3 },
  { label: "As needed",     count: 0 },
];

const SCHEDULE_TYPES = [
  { key: "daily",     label: "Daily",      icon: "calendar-today" },
  { key: "alternate", label: "Alt. Days",  icon: "calendar-sync-outline" },
  { key: "weekly",    label: "Weekly",     icon: "calendar-week" },
  { key: "monthly",   label: "Monthly",    icon: "calendar-month" },
  { key: "custom",    label: "Custom",     icon: "calendar-edit" },
];

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_FULL   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOSES_PER_OCC  = [1, 2, 3, 4];

const DEFAULT_TIMES = {
  0: [],
  1: ["08:00 AM"],
  2: ["08:00 AM", "08:00 PM"],
  3: ["08:00 AM", "02:00 PM", "08:00 PM"],
  4: ["08:00 AM", "12:00 PM", "04:00 PM", "08:00 PM"],
};

const HOURS      = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES    = ["00","05","10","15","20","25","30","35","40","45","50","55"];
const PERIODS    = ["AM", "PM"];
const ITEM_HEIGHT = 48;
const STEP_LABELS = ["Details", "Dose", "Schedule"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const parseTime = (timeStr) => {
  try {
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (modifier === "PM" && hours !== 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;
    return { hours, minutes };
  } catch {
    return { hours: 8, minutes: 0 };
  }
};

const formatExpiryInput = (raw) => {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const validateExpiry = (value) => {
  const regex = /^(0[1-9]|1[0-2])\/(\d{4})$/;
  if (!regex.test(value)) return false;
  const [mm, yyyy] = value.split("/");
  const now = new Date();
  const expiryDate   = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return expiryDate >= currentMonth;
};

// ─── AppModal ─────────────────────────────────────────────────────────────────
const AppModal = ({ visible, icon, iconColor, iconBg, title, message, buttons = [], onDismiss }) => {
  const scaleAnim   = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[mStyles.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[mStyles.box, { transform: [{ scale: scaleAnim }] }]}>
          {icon && (
            <View style={[mStyles.iconWrap, { backgroundColor: iconBg || P.ghostLight }]}>
              <MaterialCommunityIcons name={icon} size={32} color={iconColor || P.primary} />
            </View>
          )}
          <Text style={mStyles.title}>{title}</Text>
          {!!message && <Text style={mStyles.message}>{message}</Text>}
          <View style={[mStyles.btnRow, buttons.length === 1 && { justifyContent: "center" }]}>
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[mStyles.btn, btn.primary ? mStyles.btnPrimary : mStyles.btnSecondary]}
                onPress={btn.onPress}
                activeOpacity={0.85}
              >
                {btn.icon && (
                  <MaterialCommunityIcons name={btn.icon} size={16} color={btn.primary ? "#fff" : P.textSub} />
                )}
                <Text style={[mStyles.btnText, btn.primary ? mStyles.btnTextPrimary : mStyles.btnTextSecondary]}>
                  {btn.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const mStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(26,18,53,0.55)",
    justifyContent: "center", alignItems: "center", paddingHorizontal: 32,
  },
  box: {
    backgroundColor: P.white, borderRadius: 28, padding: 28, width: "100%", alignItems: "center",
    shadowColor: P.primaryDark, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 32, elevation: 16,
  },
  iconWrap:         { width: 68, height: 68, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 18 },
  title:            { fontSize: 18, fontWeight: "800", color: P.text, textAlign: "center", marginBottom: 8 },
  message:          { fontSize: 14, color: P.textMuted, textAlign: "center", lineHeight: 21, marginBottom: 24 },
  btnRow:           { flexDirection: "row", gap: 10, width: "100%" },
  btn:              { flex: 1, height: 50, borderRadius: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  btnPrimary:       { backgroundColor: P.primary, shadowColor: P.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  btnSecondary:     { backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.ghostBorder },
  btnText:          { fontSize: 14, fontWeight: "700" },
  btnTextPrimary:   { color: "#fff" },
  btnTextSecondary: { color: P.textSub },
});

// ─── TimePicker Bottom Sheet ──────────────────────────────────────────────────
const TimePicker = ({ visible, initialTime, onConfirm, onClose }) => {
  const slideAnim = useRef(new Animated.Value(360)).current;

  const parseInitial = (t) => {
    if (!t) return { hour: "08", minute: "00", period: "AM" };
    try {
      const [time, period] = t.split(" ");
      const [h, m] = time.split(":");
      return { hour: h.padStart(2, "0"), minute: m || "00", period: period || "AM" };
    } catch {
      return { hour: "08", minute: "00", period: "AM" };
    }
  };

  const [selectedHour,   setSelectedHour]   = useState("08");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [selectedPeriod, setSelectedPeriod] = useState("AM");

  const hourScrollRef   = useRef(null);
  const minuteScrollRef = useRef(null);
  const periodScrollRef = useRef(null);

  const scrollToIndex = (ref, index) => {
    ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
  };

  useEffect(() => {
    if (visible) {
      const parsed = parseInitial(initialTime);
      setSelectedHour(parsed.hour);
      setSelectedMinute(parsed.minute);
      setSelectedPeriod(parsed.period);

      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true, tension: 80, friction: 12,
      }).start();

      const t1 = setTimeout(() => {
        scrollToIndex(hourScrollRef,   HOURS.indexOf(parsed.hour));
        scrollToIndex(minuteScrollRef, MINUTES.indexOf(parsed.minute));
        scrollToIndex(periodScrollRef, PERIODS.indexOf(parsed.period));
      }, 80);
      const t2 = setTimeout(() => {
        scrollToIndex(hourScrollRef,   HOURS.indexOf(parsed.hour));
        scrollToIndex(minuteScrollRef, MINUTES.indexOf(parsed.minute));
        scrollToIndex(periodScrollRef, PERIODS.indexOf(parsed.period));
      }, 250);

      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else {
      Animated.timing(slideAnim, { toValue: 360, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  const handleConfirm = () => onConfirm(`${selectedHour}:${selectedMinute} ${selectedPeriod}`);

  const renderColumn = (data, selected, onSelect, scrollRef) => (
    <View style={tpStyles.column}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
          const clamped = Math.max(0, Math.min(idx, data.length - 1));
          onSelect(data[clamped]);
        }}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        style={{ width: "100%" }}
      >
        {data.map((item, index) => (
          <TouchableOpacity
            key={item}
            style={tpStyles.item}
            onPress={() => {
              onSelect(item);
              scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
            }}
            activeOpacity={0.7}
          >
            <Text style={[tpStyles.itemText, item === selected && tpStyles.itemTextSelected]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View pointerEvents="none" style={tpStyles.selectionOverlay}>
        <View style={tpStyles.selectionBar} />
      </View>
    </View>
  );

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={tpStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[tpStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={tpStyles.handle} />
        <View style={tpStyles.header}>
          <TouchableOpacity onPress={onClose} style={tpStyles.headerSideBtn}>
            <Text style={tpStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={tpStyles.headerTitle}>Select Time</Text>
          <TouchableOpacity onPress={handleConfirm} style={tpStyles.headerSideBtn}>
            <Text style={tpStyles.confirmHeaderText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={tpStyles.preview}>
          <MaterialCommunityIcons name="clock-outline" size={18} color={P.primary} />
          <Text style={tpStyles.previewText}> {selectedHour}:{selectedMinute} {selectedPeriod}</Text>
        </View>

        <View style={tpStyles.columnsRow}>
          <View style={tpStyles.columnWrap}>
            <Text style={tpStyles.columnLabel}>Hour</Text>
            {renderColumn(HOURS, selectedHour, setSelectedHour, hourScrollRef)}
          </View>
          <Text style={tpStyles.colonSep}>:</Text>
          <View style={tpStyles.columnWrap}>
            <Text style={tpStyles.columnLabel}>Minute</Text>
            {renderColumn(MINUTES, selectedMinute, setSelectedMinute, minuteScrollRef)}
          </View>
          <View style={tpStyles.columnWrap}>
            <Text style={tpStyles.columnLabel}>Period</Text>
            {renderColumn(PERIODS, selectedPeriod, setSelectedPeriod, periodScrollRef)}
          </View>
        </View>

        <TouchableOpacity style={tpStyles.confirmFullBtn} onPress={handleConfirm} activeOpacity={0.85}>
          <LinearGradient
            colors={[P.primary, P.primaryDark]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={tpStyles.confirmGradient}
          >
            <MaterialCommunityIcons name="check" size={18} color="#fff" />
            <Text style={tpStyles.confirmFullText}> Set Time</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const tpStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(26,18,53,0.45)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: P.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 36,
    shadowColor: P.primaryDark, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.14, shadowRadius: 20, elevation: 20,
  },
  handle:            { width: 40, height: 4, borderRadius: 2, backgroundColor: P.ghostBorder, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  header:            { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: P.ghostLight },
  headerSideBtn:     { minWidth: 64, paddingVertical: 4 },
  headerTitle:       { fontSize: 16, fontWeight: "800", color: P.text },
  cancelText:        { fontSize: 15, color: P.textMuted, fontWeight: "600" },
  confirmHeaderText: { fontSize: 15, color: P.primary, fontWeight: "700", textAlign: "right" },
  preview: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: P.ghostLight, marginHorizontal: 20, marginTop: 14, marginBottom: 4,
    paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: P.ghostBorder,
  },
  previewText:      { fontSize: 20, fontWeight: "800", color: P.primary },
  columnsRow:       { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingHorizontal: 20, marginTop: 8, gap: 4 },
  columnWrap:       { flex: 1, alignItems: "center" },
  columnLabel:      { fontSize: 10, fontWeight: "700", color: P.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  column:           { height: ITEM_HEIGHT * 3, overflow: "hidden", width: "100%" },
  item:             { height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" },
  itemText:         { fontSize: 22, fontWeight: "600", color: P.ghostBorder },
  itemTextSelected: { color: P.primary, fontWeight: "800", fontSize: 24 },
  selectionOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center" },
  selectionBar:     { height: ITEM_HEIGHT, backgroundColor: "rgba(240, 236, 255, 0.45)", borderRadius: 12, borderWidth: 1.5, borderColor: P.ghostBorder, marginHorizontal: 4 },
  colonSep:         { fontSize: 24, fontWeight: "800", color: P.ghostBorder, marginBottom: 24, marginHorizontal: 2 },
  confirmFullBtn:   { marginHorizontal: 20, marginTop: 16, borderRadius: 16, overflow: "hidden" },
  confirmGradient:  {
    flexDirection: "row", alignItems: "center", justifyContent: "center", height: 54, borderRadius: 16,
    shadowColor: P.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  confirmFullText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

// ─── StepHeader ───────────────────────────────────────────────────────────────
const StepHeader = ({ title, subtitle }) => (
  <View style={stepStyles.container}>
    <Text style={stepStyles.title}>{title}</Text>
    {subtitle ? <Text style={stepStyles.subtitle}>{subtitle}</Text> : null}
  </View>
);

const stepStyles = StyleSheet.create({
  container: { marginBottom: 20 },
  title:     { fontSize: 18, fontWeight: "800", color: P.text, marginBottom: 4 },
  subtitle:  { fontSize: 13, color: P.textMuted, lineHeight: 19 },
});

// ─── PreFill Banner ───────────────────────────────────────────────────────────
const PreFillBanner = () => (
  <View style={pfStyles.banner}>
    <View style={pfStyles.iconWrap}>
      <MaterialCommunityIcons name="auto-fix" size={18} color={P.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={pfStyles.title}>Auto-filled from scan</Text>
      <Text style={pfStyles.subtitle}>Fields are pre-filled from the scanned packet. Review and edit as needed.</Text>
    </View>
  </View>
);

const pfStyles = StyleSheet.create({
  banner: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: P.ghostLight, borderRadius: 14, padding: 14, marginBottom: 20,
    borderWidth: 1.5, borderColor: P.ghostBorder, gap: 12,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: P.white,
    justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: P.ghostBorder,
    flexShrink: 0, marginTop: 1,
  },
  title:    { fontSize: 13, fontWeight: "800", color: P.primary, marginBottom: 2 },
  subtitle: { fontSize: 12, color: P.textSub, lineHeight: 17 },
});

// ─── Main Component ───────────────────────────────────────────────────────────
const LogNewMedicine = ({ navigation, route }) => {
  const prefillName   = route?.params?.prefillName   ?? "";
  const prefillExpiry = route?.params?.prefillExpiry ?? "";
  const hasPrefill    = !!(prefillName || prefillExpiry);

  // ── Step 1 state ──
  const [name,         setName]         = useState(prefillName);
  const [expiry,       setExpiry]       = useState(prefillExpiry);
  const [expiryError,  setExpiryError]  = useState("");
  const [quantity,     setQuantity]     = useState("");
  const [dosage,       setDosage]       = useState("");
  const [notes,        setNotes]        = useState("");
  const [focusedField, setFocusedField] = useState(null);

  // ── Step 2 state ──
  const [selectedDoseType,  setSelectedDoseType]  = useState(null);
  const [selectedFrequency, setSelectedFrequency] = useState(null);
  // Schedule type: 'daily' | 'alternate' | 'weekly' | 'monthly' | 'custom'
  const [scheduleType,       setScheduleType]       = useState("daily");
  const [weekdays,           setWeekdays]           = useState([]);       // [0..6]
  const [monthDays,          setMonthDays]          = useState([]);       // [1..31]
  const [intervalDays,       setIntervalDays]       = useState("2");      // custom interval
  const [dosesPerOccurrence, setDosesPerOccurrence] = useState(1);        // for non-daily types

  // ── Step 3 state ──
  const [times,             setTimes]             = useState([]);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [editingTimeIndex,  setEditingTimeIndex]  = useState(null);

  // ── UI state ──
  const [loading, setLoading] = useState(false);
  const [step,    setStep]    = useState(1);
  const [modal,   setModal]   = useState({
    visible: false, icon: null, iconColor: P.primary, iconBg: P.ghostLight, title: "", message: "", buttons: [],
  });

  useEffect(() => {
    if (prefillName)   setName(prefillName);
    if (prefillExpiry) setExpiry(prefillExpiry);
  }, [prefillName, prefillExpiry]);

  const showModal = (config) => setModal({ ...config, visible: true });
  const hideModal = () => setModal((m) => ({ ...m, visible: false }));

  // ─── Step 1 helpers ──────────────────────────────────────────────────────────
  const handleExpiryChange = (raw) => {
    setExpiry(formatExpiryInput(raw));
    if (expiryError) setExpiryError("");
  };

  const checkExpiry = () => {
    if (!expiry.trim()) { setExpiryError("Expiry date is required."); return false; }
    if (!validateExpiry(expiry)) { setExpiryError("Please enter a valid expiry date."); return false; }
    setExpiryError("");
    return true;
  };

  // ─── Step 2 helpers ──────────────────────────────────────────────────────────
  const handleFrequencySelect = (freq) => {
    setSelectedFrequency(freq);
    setTimes(DEFAULT_TIMES[freq.count] || []);
  };

  const handleScheduleTypeChange = (type) => {
    setScheduleType(type);
    if (type !== "daily") {
      setSelectedFrequency(null);
      setTimes(DEFAULT_TIMES[dosesPerOccurrence] || DEFAULT_TIMES[1]);
    } else {
      // Reset non-daily fields when switching back to daily
      setWeekdays([]);
      setMonthDays([]);
      setIntervalDays("2");
      setDosesPerOccurrence(1);
      setTimes([]);
    }
  };

  const handleDosesPerOccChange = (count) => {
    setDosesPerOccurrence(count);
    setTimes(DEFAULT_TIMES[count] || DEFAULT_TIMES[1]);
  };

  const toggleWeekday = (day) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const toggleMonthDay = (day) => {
    setMonthDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // ─── Step 3 helpers ──────────────────────────────────────────────────────────
  const openTimePicker    = (index) => { setEditingTimeIndex(index); setTimePickerVisible(true); };
  const handleTimeConfirm = (timeStr) => {
    setTimePickerVisible(false);
    if (editingTimeIndex === null) return;
    const updated = [...times];
    updated[editingTimeIndex] = timeStr;
    setTimes(updated);
    setEditingTimeIndex(null);
  };

  // ─── Schedule label helper ───────────────────────────────────────────────────
  const getScheduleLabel = () => {
    switch (scheduleType) {
      case "daily":
        return selectedFrequency?.label ?? "Daily";
      case "alternate":
        return "Every other day";
      case "weekly":
        return weekdays.length
          ? `Weekly — ${weekdays.sort((a,b)=>a-b).map((d) => WEEKDAY_FULL[d]).join(", ")}`
          : "Weekly";
      case "monthly":
        return monthDays.length
          ? `Monthly — days ${monthDays.sort((a,b)=>a-b).join(", ")}`
          : "Monthly";
      case "custom":
        return `Every ${intervalDays || "?"} days`;
      default:
        return "Daily";
    }
  };

  const getStep3Subtitle = () => {
    switch (scheduleType) {
      case "daily":     return "Tap each dose to pick a time. Reminders fire daily at these times.";
      case "alternate": return "Reminders fire every other day at these times.";
      case "weekly":    return `Reminders fire on ${weekdays.sort((a,b)=>a-b).map((d) => WEEKDAY_FULL[d]).join(", ")} at these times.`;
      case "monthly":   return `Reminders fire on day${monthDays.length !== 1 ? "s" : ""} ${monthDays.sort((a,b)=>a-b).join(", ")} of each month.`;
      case "custom":    return `Reminders fire every ${intervalDays || "?"} days at these times.`;
      default:          return "Tap each dose to pick a time.";
    }
  };

  // ─── seedTodayHistory (schedule-aware) ──────────────────────────────────────
  const seedTodayHistory = async (userEmail, medicine) => {
    if (!medicine.times.length) return;

    const today     = new Date();
    const todayDay  = today.getDay();   // 0 = Sun
    const todayDate = today.getDate();  // 1–31

    let shouldSeed = false;
    switch (medicine.scheduleType) {
      case "daily":
        shouldSeed = true;
        break;
      case "alternate":
        // Always seed on start date; the daily cron handles alternation thereafter
        shouldSeed = true;
        break;
      case "weekly":
        shouldSeed = (medicine.weekdays ?? []).includes(todayDay);
        break;
      case "monthly":
        shouldSeed = (medicine.monthDays ?? []).includes(todayDate);
        break;
      case "custom":
        // Seed on start day; interval logic handled separately
        shouldSeed = true;
        break;
      default:
        shouldSeed = true;
    }

    if (!shouldSeed) return;

    const historyRaw = await AsyncStorage.getItem(`history_${userEmail}`);
    const history = historyRaw ? JSON.parse(historyRaw) : [];

    for (const time of medicine.times) {
      const { hours, minutes } = parseTime(time);
      const scheduled = new Date(today);
      scheduled.setHours(hours, minutes, 0, 0);
      history.push({
        id: `${medicine.id}_${time}_${today.toDateString()}`,
        medicineId:   medicine.id,
        medicineName: medicine.name,
        doseType:     medicine.doseType,
        time,
        scheduledTime: scheduled.toISOString(),
        taken:  false,
        takenAt: null,
      });
    }
    await AsyncStorage.setItem(`history_${userEmail}`, JSON.stringify(history));
  };

  // ─── Navigation ──────────────────────────────────────────────────────────────
  const handleNext = () => {
    if (step === 1) {
      if (!name.trim()) {
        showModal({ visible: true, icon: "alert-circle-outline", iconColor: P.amber, iconBg: "#FFFBEB", title: "Medicine Name Required", message: "Please enter the name of the medicine before continuing.", buttons: [{ label: "Got it", primary: true, icon: "check", onPress: hideModal }] });
        return;
      }
      if (!checkExpiry()) {
        showModal({ visible: true, icon: "calendar-alert", iconColor: P.red, iconBg: "#FFF5F5", title: "Invalid Expiry Date", message: "Please enter a valid date in MM/YYYY format that is not in the past.", buttons: [{ label: "Fix it", primary: true, icon: "pencil-outline", onPress: hideModal }] });
        return;
      }
      if (!dosage.trim()) {
        showModal({ visible: true, icon: "pill", iconColor: P.amber, iconBg: "#FFFBEB", title: "Dosage Required", message: "Please enter the dosage strength, e.g. 500mg or 10ml.", buttons: [{ label: "Got it", primary: true, icon: "check", onPress: hideModal }] });
        return;
      }
      if (!quantity.trim()) {
        showModal({ visible: true, icon: "counter", iconColor: P.amber, iconBg: "#FFFBEB", title: "Quantity Required", message: "Please enter the quantity of medicine you currently have in stock.", buttons: [{ label: "Got it", primary: true, icon: "check", onPress: hideModal }] });
        return;
      }
    }

    if (step === 2) {
      if (!selectedDoseType) {
        showModal({ visible: true, icon: "pill", iconColor: P.amber, iconBg: "#FFFBEB", title: "Dose Type Required", message: "Please select a dose type for this medicine.", buttons: [{ label: "Got it", primary: true, icon: "check", onPress: hideModal }] });
        return;
      }
      if (scheduleType === "daily" && !selectedFrequency) {
        showModal({ visible: true, icon: "clock-outline", iconColor: P.amber, iconBg: "#FFFBEB", title: "Frequency Required", message: "Please select how often this medicine should be taken.", buttons: [{ label: "Got it", primary: true, icon: "check", onPress: hideModal }] });
        return;
      }
      if (scheduleType === "weekly" && weekdays.length === 0) {
        showModal({ visible: true, icon: "calendar-week", iconColor: P.amber, iconBg: "#FFFBEB", title: "Select Days", message: "Please select at least one day of the week for this medicine.", buttons: [{ label: "Got it", primary: true, icon: "check", onPress: hideModal }] });
        return;
      }
      if (scheduleType === "monthly" && monthDays.length === 0) {
        showModal({ visible: true, icon: "calendar-month", iconColor: P.amber, iconBg: "#FFFBEB", title: "Select Dates", message: "Please select at least one date of the month for this medicine.", buttons: [{ label: "Got it", primary: true, icon: "check", onPress: hideModal }] });
        return;
      }
      if (scheduleType === "custom") {
        const n = parseInt(intervalDays);
        if (!n || n < 2) {
          showModal({ visible: true, icon: "calendar-edit", iconColor: P.amber, iconBg: "#FFFBEB", title: "Invalid Interval", message: "Custom interval must be at least 2 days.", buttons: [{ label: "Got it", primary: true, icon: "check", onPress: hideModal }] });
          return;
        }
      }
    }

    setStep(step + 1);
  };

  // ─── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setLoading(true);
    try {
      const userEmail = await AsyncStorage.getItem("currentUser");
      if (!userEmail) {
        showModal({ visible: true, icon: "account-alert-outline", iconColor: P.red, iconBg: "#FFF5F5", title: "Session Expired", message: "Your session has ended. Please log in again.", buttons: [{ label: "Log In", primary: true, icon: "login", onPress: () => { hideModal(); navigation.replace("Wellness"); } }] });
        return;
      }

      const medsRaw = await AsyncStorage.getItem(`medicines_${userEmail}`);
      const meds    = medsRaw ? JSON.parse(medsRaw) : [];

      const newMed = {
        id: Date.now().toString(),
        name:          name.trim(),
        dosage:        dosage.trim(),
        expiry:        expiry.trim(),
        dosageHistory: [{ dose: dosage.trim(), changedAt: new Date().toISOString(), note: "Initial" }],
        doseType:      selectedDoseType.label,
        doseTypeIcon:  selectedDoseType.icon,
        // Schedule fields
        scheduleType,
        frequency:      getScheduleLabel(),
        frequencyCount: scheduleType === "daily"
          ? (selectedFrequency?.count ?? 1)
          : dosesPerOccurrence,
        weekdays:    scheduleType === "weekly"  ? weekdays  : [],
        monthDays:   scheduleType === "monthly" ? monthDays : [],
        intervalDays: scheduleType === "custom" ? parseInt(intervalDays) || 2 : null,
        times,
        quantity:          parseInt(quantity) || 0,
        remainingQuantity: parseInt(quantity) || 0,
        notes:       notes.trim(),
        active:      true,
        startDate:   new Date().toISOString(),
        notificationIds: [],
      };

      newMed.notificationIds = await scheduleNotifications(newMed);
      meds.push(newMed);
      await AsyncStorage.setItem(`medicines_${userEmail}`, JSON.stringify(meds));
      await seedTodayHistory(userEmail, newMed);

      const scheduleDesc = scheduleType !== "daily"
        ? getScheduleLabel()
        : `${times.length} time${times.length !== 1 ? "s" : ""} daily`;

      const reminderNote = isExpoGo
        ? "Reminders need a development build to activate. Timings are saved and ready."
        : `Reminders scheduled — ${scheduleDesc}.`;

      showModal({
        visible: true, icon: "check-circle-outline", iconColor: P.green, iconBg: "#ECFDF5",
        title: `${name} Added!`,
        message: reminderNote,
        buttons: [{ label: "Done", primary: true, icon: "arrow-right", onPress: () => { hideModal(); navigation.goBack(); } }],
      });
    } catch (e) {
      console.error(e);
      showModal({ visible: true, icon: "alert-circle-outline", iconColor: P.red, iconBg: "#FFF5F5", title: "Save Failed", message: "Something went wrong. Please try again.", buttons: [{ label: "Retry", primary: true, icon: "refresh", onPress: () => { hideModal(); handleSave(); } }] });
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 1 ───────────────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <>
      <StepHeader title="Basic Information" subtitle="Enter the medicine details and stock information." />
      {hasPrefill && <PreFillBanner />}

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Medicine Name</Text>
        <View style={[styles.inputContainer, focusedField === "name" && styles.inputFocused, hasPrefill && name === prefillName && styles.inputPrefilled]}>
          <MaterialCommunityIcons name="pill" size={18} color={focusedField === "name" ? P.primary : P.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="e.g. Paracetamol 500mg"
            placeholderTextColor={P.ghostBorder}
            value={name}
            onChangeText={setName}
            onFocus={() => setFocusedField("name")}
            onBlur={() => setFocusedField(null)}
          />
          {hasPrefill && name === prefillName && name !== "" && (
            <View style={styles.autoChip}>
              <MaterialCommunityIcons name="auto-fix" size={10} color={P.primary} />
              <Text style={styles.autoChipText}>auto</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Dosage Strength</Text>
        <View style={[styles.inputContainer, focusedField === "dosage" && styles.inputFocused]}>
          <MaterialCommunityIcons name="pill" size={18} color={focusedField === "dosage" ? P.primary : P.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="e.g. 500mg, 10ml, 5mcg"
            placeholderTextColor={P.ghostBorder}
            value={dosage}
            onChangeText={setDosage}
            onFocus={() => setFocusedField("dosage")}
            onBlur={() => setFocusedField(null)}
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Expiry Date</Text>
        <View style={[styles.inputContainer, focusedField === "expiry" && styles.inputFocused, !!expiryError && styles.inputError, hasPrefill && expiry === prefillExpiry && prefillExpiry !== "" && styles.inputPrefilled]}>
          <MaterialCommunityIcons name="calendar-remove-outline" size={18} color={expiryError ? P.red : focusedField === "expiry" ? P.primary : P.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="MM/YYYY"
            placeholderTextColor={P.ghostBorder}
            value={expiry}
            onChangeText={handleExpiryChange}
            keyboardType="numeric"
            maxLength={7}
            onFocus={() => setFocusedField("expiry")}
            onBlur={() => { setFocusedField(null); if (expiry) checkExpiry(); }}
          />
          {expiry.length === 7 && (
            <MaterialCommunityIcons
              name={validateExpiry(expiry) ? "check-circle" : "close-circle"}
              size={18}
              color={validateExpiry(expiry) ? P.green : P.red}
            />
          )}
          {hasPrefill && expiry === prefillExpiry && prefillExpiry !== "" && expiry.length !== 7 && (
            <View style={styles.autoChip}>
              <MaterialCommunityIcons name="auto-fix" size={10} color={P.primary} />
              <Text style={styles.autoChipText}>auto</Text>
            </View>
          )}
        </View>
        {!!expiryError && (
          <View style={styles.errorRow}>
            <MaterialCommunityIcons name="alert-circle-outline" size={13} color={P.red} />
            <Text style={styles.errorText}> {expiryError}</Text>
          </View>
        )}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Quantity in Stock</Text>
        <View style={[styles.inputContainer, focusedField === "qty" && styles.inputFocused]}>
          <MaterialCommunityIcons name="counter" size={18} color={focusedField === "qty" ? P.primary : P.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="e.g. 30 tablets"
            placeholderTextColor={P.ghostBorder}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            onFocus={() => setFocusedField("qty")}
            onBlur={() => setFocusedField(null)}
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <View style={[styles.inputContainer, styles.textArea, focusedField === "notes" && styles.inputFocused]}>
          <TextInput
            style={[styles.input, { textAlignVertical: "top", marginLeft: 0 }]}
            placeholder="e.g. Take after food, with a full glass of water"
            placeholderTextColor={P.ghostBorder}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            onFocus={() => setFocusedField("notes")}
            onBlur={() => setFocusedField(null)}
          />
        </View>
      </View>
    </>
  );

  // ─── Step 2 ───────────────────────────────────────────────────────────────────
  const renderStep2 = () => (
    <>
      <StepHeader title="Dose Type & Schedule" subtitle="Choose the form, how often, and which days to take this medicine." />

      {/* ── Schedule Type ── */}
      <Text style={styles.subSectionLabel}>Schedule Type</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scheduleTypeRow}
        style={{ marginBottom: 20 }}
      >
        {SCHEDULE_TYPES.map((st) => {
          const isActive = scheduleType === st.key;
          return (
            <TouchableOpacity
              key={st.key}
              style={[styles.scheduleTypeChip, isActive && styles.scheduleTypeChipActive]}
              onPress={() => handleScheduleTypeChange(st.key)}
              activeOpacity={0.8}
            >
              {isActive && (
                <LinearGradient
                  colors={[P.primary, P.primaryDark]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <MaterialCommunityIcons
                name={st.icon}
                size={15}
                color={isActive ? "#fff" : P.textMuted}
              />
              <Text style={[styles.scheduleTypeChipText, isActive && styles.scheduleTypeChipTextActive]}>
                {st.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Daily: frequency list ── */}
      {scheduleType === "daily" && (
        <>
          <Text style={styles.subSectionLabel}>Frequency</Text>
          {DOSE_FREQUENCIES.map((freq) => {
            const isActive = selectedFrequency?.label === freq.label;
            return (
              <TouchableOpacity
                key={freq.label}
                style={[styles.freqBtn, isActive && styles.freqBtnActive]}
                onPress={() => handleFrequencySelect(freq)}
                activeOpacity={0.8}
              >
                {isActive && (
                  <LinearGradient
                    colors={[P.ghostLight, P.ghostMid]}
                    style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  />
                )}
                <View style={styles.freqLeft}>
                  <View style={[styles.freqDot, { backgroundColor: isActive ? P.primary : P.ghostBorder }]} />
                  <Text style={[styles.freqLabel, isActive && styles.freqLabelActive]}>{freq.label}</Text>
                </View>
                {isActive && <MaterialCommunityIcons name="check-circle" size={20} color={P.primary} />}
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {/* ── Alternate Days: info card ── */}
      {scheduleType === "alternate" && (
        <View style={styles.scheduleInfoCard}>
          <View style={styles.scheduleInfoIcon}>
            <MaterialCommunityIcons name="calendar-sync-outline" size={22} color={P.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scheduleInfoTitle}>Every Other Day</Text>
            <Text style={styles.scheduleInfoText}>
              Medicine starts today and repeats every 2 days. Pick how many doses per day below.
            </Text>
          </View>
        </View>
      )}

      {/* ── Weekly: day-of-week picker ── */}
      {scheduleType === "weekly" && (
        <>
          <Text style={styles.subSectionLabel}>Days of Week</Text>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, i) => {
              const isSelected = weekdays.includes(i);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.weekdayBtn, isSelected && styles.weekdayBtnActive]}
                  onPress={() => toggleWeekday(i)}
                  activeOpacity={0.8}
                >
                  {isSelected && (
                    <LinearGradient
                      colors={[P.primary, P.primaryDark]}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <Text style={[styles.weekdayText, isSelected && styles.weekdayTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {weekdays.length > 0 && (
            <View style={styles.selectionSummary}>
              <MaterialCommunityIcons name="check-circle-outline" size={13} color={P.green} />
              <Text style={styles.selectionSummaryText}>
                {" "}{weekdays.sort((a,b)=>a-b).map((d) => WEEKDAY_FULL[d]).join(" · ")}
              </Text>
            </View>
          )}
        </>
      )}

      {/* ── Monthly: day-of-month grid ── */}
      {scheduleType === "monthly" && (
        <>
          <Text style={styles.subSectionLabel}>Days of Month</Text>
          <View style={styles.monthDayGrid}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
              const isSelected = monthDays.includes(day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.monthDayBtn, isSelected && styles.monthDayBtnActive]}
                  onPress={() => toggleMonthDay(day)}
                  activeOpacity={0.8}
                >
                  {isSelected && (
                    <LinearGradient
                      colors={[P.primary, P.primaryDark]}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <Text style={[styles.monthDayText, isSelected && styles.monthDayTextActive]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {monthDays.length > 0 && (
            <View style={styles.selectionSummary}>
              <MaterialCommunityIcons name="check-circle-outline" size={13} color={P.green} />
              <Text style={styles.selectionSummaryText}>
                {" "}Day{monthDays.length > 1 ? "s" : ""} {monthDays.sort((a,b)=>a-b).join(", ")} of each month
              </Text>
            </View>
          )}
        </>
      )}

      {/* ── Custom: interval input ── */}
      {scheduleType === "custom" && (
        <>
          <Text style={styles.subSectionLabel}>Repeat Interval</Text>
          <View style={styles.customIntervalCard}>
            <View style={styles.scheduleInfoIcon}>
              <MaterialCommunityIcons name="calendar-edit" size={22} color={P.primary} />
            </View>
            <Text style={styles.customIntervalEvery}>Every</Text>
            <View style={[styles.inputContainer, styles.customIntervalInput, focusedField === "interval" && styles.inputFocused]}>
              <TextInput
                style={[styles.input, { textAlign: "center", marginLeft: 0, fontWeight: "800", fontSize: 20, color: P.primary }]}
                value={intervalDays}
                onChangeText={(v) => setIntervalDays(v.replace(/\D/g, ""))}
                keyboardType="numeric"
                maxLength={3}
                onFocus={() => setFocusedField("interval")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            <Text style={styles.customIntervalEvery}>days</Text>
          </View>
          {parseInt(intervalDays) >= 2 && (
            <View style={styles.selectionSummary}>
              <MaterialCommunityIcons name="check-circle-outline" size={13} color={P.green} />
              <Text style={styles.selectionSummaryText}>
                {" "}Starts today, repeats every {intervalDays} days
              </Text>
            </View>
          )}
        </>
      )}

      {/* ── Doses per occurrence (non-daily) ── */}
      {scheduleType !== "daily" && (
        <>
          <Text style={[styles.subSectionLabel, { marginTop: 22 }]}>Doses Per Day</Text>
          <View style={styles.dosesPerOccRow}>
            {DOSES_PER_OCC.map((count) => {
              const isActive = dosesPerOccurrence === count;
              return (
                <TouchableOpacity
                  key={count}
                  style={[styles.dosesPerOccBtn, isActive && styles.dosesPerOccBtnActive]}
                  onPress={() => handleDosesPerOccChange(count)}
                  activeOpacity={0.8}
                >
                  {isActive && (
                    <LinearGradient
                      colors={[P.primary, P.primaryDark]}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <Text style={[styles.dosesPerOccText, isActive && styles.dosesPerOccTextActive]}>
                    {count}×
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* ── Dose Type grid ── */}
      <Text style={[styles.subSectionLabel, { marginTop: 24 }]}>Dose Type</Text>
      <View style={styles.doseTypeGrid}>
        {DOSE_TYPES.map((dt) => {
          const isActive = selectedDoseType?.label === dt.label;
          return (
            <TouchableOpacity
              key={dt.label}
              style={[styles.doseTypeBtn, isActive && styles.doseTypeBtnActive]}
              onPress={() => setSelectedDoseType(dt)}
              activeOpacity={0.8}
            >
              {isActive ? (
                <LinearGradient
                  colors={[P.ghostLight, P.ghostMid]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                />
              ) : null}
              <MaterialCommunityIcons name={dt.icon} size={24} color={isActive ? P.primary : P.textMuted} />
              <Text style={[styles.doseTypeLbl, isActive && styles.doseTypeLblActive]}>{dt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  // ─── Step 3 ───────────────────────────────────────────────────────────────────
  const renderStep3 = () => (
    <>
      <StepHeader title="Dose Timings" subtitle={getStep3Subtitle()} />

      {isExpoGo && (
        <View style={styles.infoBanner}>
          <MaterialCommunityIcons name="information-outline" size={16} color={P.primary} />
          <Text style={styles.infoBannerText}>
            {"  "}Push reminders require a <Text style={{ fontWeight: "800" }}>development build</Text>. Timings are saved and will activate once you switch.
          </Text>
        </View>
      )}

      {/* Schedule summary pill */}
      <View style={styles.scheduleSummaryPill}>
        <MaterialCommunityIcons
          name={SCHEDULE_TYPES.find((s) => s.key === scheduleType)?.icon ?? "calendar"}
          size={14}
          color={P.primary}
        />
        <Text style={styles.scheduleSummaryText}>{getScheduleLabel()}</Text>
      </View>

      {times.length === 0 ? (
        <View style={styles.emptyTimings}>
          <View style={styles.emptyTimingsIcon}>
            <MaterialCommunityIcons name="clock-outline" size={36} color={P.textMuted} />
          </View>
          <Text style={styles.emptyTimingsTitle}>No Fixed Schedule</Text>
          <Text style={styles.emptyTimingsText}>This medicine will be taken as needed.</Text>
        </View>
      ) : (
        <View style={styles.timingsCard}>
          {times.map((time, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.timingRow, i < times.length - 1 && styles.timingRowBorder]}
              onPress={() => openTimePicker(i)}
              activeOpacity={0.75}
            >
              <LinearGradient colors={[P.primary, P.primaryDark]} style={styles.timingIndex}>
                <Text style={styles.timingIndexText}>{i + 1}</Text>
              </LinearGradient>
              <View style={styles.timingLabelWrap}>
                <Text style={styles.timingDoseLabel}>Dose {i + 1}</Text>
                <Text style={styles.timingDoseSub}>Tap to change time</Text>
              </View>
              <View style={styles.timingDisplayChip}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={P.primary} />
                <Text style={styles.timingDisplayText}>{time}</Text>
                <MaterialCommunityIcons name="chevron-down" size={14} color={P.textMuted} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!isExpoGo && times.length > 0 && (
        <View style={styles.notifNote}>
          <MaterialCommunityIcons name="bell-ring-outline" size={16} color={P.amber} />
          <Text style={styles.notifNoteText}>
            {"  "}Notifications include <Text style={{ fontWeight: "800" }}>Mark as Taken</Text> and Ignore actions.
          </Text>
        </View>
      )}
    </>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={P.surface} />

      <LinearGradient
        colors={[P.ghostMid, P.ghostLight, P.surface]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={styles.headerBand}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={P.textSub} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Log New Medicine</Text>
            <Text style={styles.headerSub}>Step {step} of 3 — {STEP_LABELS[step - 1]}</Text>
          </View>
          <View style={styles.stepPill}>
            <Text style={styles.stepPillText}>{step}/3</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, step > s && styles.stepDotDone, step === s && styles.stepDotActive]}>
                  {step > s ? (
                    <MaterialCommunityIcons name="check" size={14} color="#fff" />
                  ) : (
                    <Text style={[styles.stepNum, step >= s && styles.stepNumActive]}>{s}</Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, step === s && styles.stepLabelActive]}>{STEP_LABELS[s - 1]}</Text>
              </View>
              {s < 3 && <View style={[styles.progressLine, step > s && styles.progressLineActive]} />}
            </React.Fragment>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        {step > 1 && (
          <TouchableOpacity style={styles.prevBtn} onPress={() => setStep(step - 1)} activeOpacity={0.8}>
            <MaterialCommunityIcons name="arrow-left" size={18} color={P.textSub} />
            <Text style={styles.prevBtnText}> Back</Text>
          </TouchableOpacity>
        )}
        {step < 3 ? (
          <TouchableOpacity style={[styles.nextBtn, step === 1 && { flex: 1 }]} onPress={handleNext} activeOpacity={0.85}>
            <LinearGradient colors={[P.primary, P.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextBtnGradient}>
              <Text style={styles.nextBtnText}>Continue</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.nextBtn, { flex: 1 }]} onPress={handleSave} disabled={loading} activeOpacity={0.85}>
            <LinearGradient colors={[P.primary, P.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextBtnGradient}>
              <MaterialCommunityIcons name={loading ? "loading" : "check"} size={18} color="#fff" />
              <Text style={styles.nextBtnText}>{loading ? "Saving..." : "Save Medicine"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      <TimePicker
        visible={timePickerVisible}
        initialTime={editingTimeIndex !== null ? times[editingTimeIndex] : "08:00 AM"}
        onConfirm={handleTimeConfirm}
        onClose={() => { setTimePickerVisible(false); setEditingTimeIndex(null); }}
      />
      <AppModal
        visible={modal.visible}
        icon={modal.icon}
        iconColor={modal.iconColor}
        iconBg={modal.iconBg}
        title={modal.title}
        message={modal.message}
        buttons={modal.buttons}
        onDismiss={hideModal}
      />
    </SafeAreaView>
  );
};

export default LogNewMedicine;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.surface },

  // Header band
  headerBand:   { paddingBottom: 8 },
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 14 },
  backBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: P.white, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: P.ghostBorder,
    shadowColor: P.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  headerTitle:  { fontSize: 20, fontWeight: "800", color: P.text },
  headerSub:    { fontSize: 12, color: P.textMuted, marginTop: 1 },
  stepPill:     { backgroundColor: P.white, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1.5, borderColor: P.ghostBorder },
  stepPillText: { fontSize: 12, fontWeight: "700", color: P.primary },

  // Progress
  progressContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingVertical: 14 },
  stepItem:          { alignItems: "center", gap: 6 },
  stepDot: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: P.white, justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: P.ghostBorder,
  },
  stepDotActive: {
    borderColor: P.primary, backgroundColor: P.primary,
    shadowColor: P.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  stepDotDone:       { borderColor: P.primaryMid, backgroundColor: P.primaryMid },
  stepNum:           { fontSize: 13, fontWeight: "700", color: P.textMuted },
  stepNumActive:     { color: "#fff" },
  stepLabel:         { fontSize: 10, fontWeight: "700", color: P.ghostBorder, letterSpacing: 0.5 },
  stepLabelActive:   { color: P.primary },
  progressLine:       { flex: 1, height: 2, backgroundColor: P.ghostLight, marginHorizontal: 6, marginBottom: 20 },
  progressLineActive: { backgroundColor: P.primary },

  // Scroll + card
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 110 },
  card: {
    backgroundColor: P.white, borderRadius: 24, padding: 22,
    borderWidth: 1, borderColor: P.ghostLight,
    shadowColor: P.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 4,
  },

  // Fields
  fieldGroup:      { marginBottom: 4 },
  fieldLabel:      { fontSize: 11, fontWeight: "700", color: P.textSub, letterSpacing: 0.8, marginBottom: 8, textTransform: "uppercase" },
  subSectionLabel: { fontSize: 11, fontWeight: "700", color: P.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 },
  inputContainer: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: P.surface, borderRadius: 14, paddingHorizontal: 14, marginBottom: 18, height: 52,
    borderWidth: 1.5, borderColor: P.ghostLight,
  },
  textArea:       { height: 88, paddingTop: 14, alignItems: "flex-start" },
  inputFocused:   { borderColor: P.primary, backgroundColor: P.ghostLight },
  inputError:     { borderColor: P.red, backgroundColor: "#FFF5F5" },
  inputPrefilled: { borderColor: P.ghostBorder, backgroundColor: P.ghostLight },
  input:          { flex: 1, marginLeft: 10, fontSize: 15, color: P.text },
  autoChip:       { flexDirection: "row", alignItems: "center", backgroundColor: P.ghostMid, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, gap: 3, marginLeft: 6 },
  autoChipText:   { fontSize: 10, fontWeight: "700", color: P.primary, letterSpacing: 0.3 },
  errorRow:       { flexDirection: "row", alignItems: "center", marginTop: -12, marginBottom: 14, paddingHorizontal: 4 },
  errorText:      { fontSize: 12, color: P.red, fontWeight: "500" },

  // ── Schedule Type chips ──
  scheduleTypeRow:          { flexDirection: "row", gap: 8, paddingHorizontal: 2, paddingVertical: 2 },
  scheduleTypeChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, height: 38, borderRadius: 20,
    backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.ghostLight,
    overflow: "hidden",
  },
  scheduleTypeChipActive:   { borderColor: P.primary },
  scheduleTypeChipText:     { fontSize: 13, fontWeight: "600", color: P.textMuted },
  scheduleTypeChipTextActive: { color: "#fff", fontWeight: "700" },

  // ── Alternate / Custom info cards ──
  scheduleInfoCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: P.ghostLight, borderRadius: 16, padding: 16, marginBottom: 4,
    borderWidth: 1.5, borderColor: P.ghostBorder,
  },
  scheduleInfoIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: P.white, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: P.ghostBorder, flexShrink: 0,
  },
  scheduleInfoTitle: { fontSize: 14, fontWeight: "800", color: P.text, marginBottom: 4 },
  scheduleInfoText:  { fontSize: 13, color: P.textSub, lineHeight: 18, flex: 1 },

  // ── Weekday picker ──
  weekdayRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  weekdayBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center",
    backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.ghostLight, overflow: "hidden",
  },
  weekdayBtnActive: { borderColor: P.primary },
  weekdayText:      { fontSize: 14, fontWeight: "700", color: P.textMuted },
  weekdayTextActive:{ color: "#fff" },

  // ── Month day grid ──
  monthDayGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10,
  },
  monthDayBtn: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
    backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.ghostLight, overflow: "hidden",
  },
  monthDayBtnActive: { borderColor: P.primary },
  monthDayText:      { fontSize: 12, fontWeight: "700", color: P.textMuted },
  monthDayTextActive:{ color: "#fff" },

  // ── Custom interval ──
  customIntervalCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: P.ghostLight, borderRadius: 16, padding: 16, marginBottom: 4,
    borderWidth: 1.5, borderColor: P.ghostBorder,
  },
  customIntervalEvery: { fontSize: 15, fontWeight: "700", color: P.textSub },
  customIntervalInput: {
    width: 72, height: 48, marginBottom: 0, paddingHorizontal: 8,
    justifyContent: "center",
  },

  // ── Selection summary ──
  selectionSummary: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#ECFDF5", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
    marginBottom: 4, borderWidth: 1, borderColor: "#A7F3D0",
  },
  selectionSummaryText: { fontSize: 12, fontWeight: "600", color: "#065F46" },

  // ── Doses per occurrence ──
  dosesPerOccRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  dosesPerOccBtn: {
    flex: 1, height: 48, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
    backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.ghostLight, overflow: "hidden",
  },
  dosesPerOccBtnActive:{ borderColor: P.primary },
  dosesPerOccText:     { fontSize: 16, fontWeight: "700", color: P.textMuted },
  dosesPerOccTextActive:{ color: "#fff" },

  // Dose type grid
  doseTypeGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  doseTypeBtn: {
    width: "22%", aspectRatio: 1, backgroundColor: P.surface, borderRadius: 16,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: P.ghostLight, gap: 6, overflow: "hidden",
  },
  doseTypeBtnActive: { borderColor: P.primary },
  doseTypeLbl:       { fontSize: 10, color: P.textMuted, textAlign: "center", fontWeight: "600" },
  doseTypeLblActive: { color: P.primary, fontWeight: "700" },

  // Frequency
  freqBtn: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: P.surface, borderRadius: 14, paddingHorizontal: 16, height: 52, marginBottom: 10,
    borderWidth: 1.5, borderColor: P.ghostLight, overflow: "hidden",
  },
  freqBtnActive:  { borderColor: P.primary },
  freqLeft:       { flexDirection: "row", alignItems: "center", gap: 12 },
  freqDot:        { width: 8, height: 8, borderRadius: 4 },
  freqLabel:      { fontSize: 14, color: P.textMuted, fontWeight: "500" },
  freqLabelActive:{ color: P.text, fontWeight: "700" },

  // Banners
  infoBanner:     { flexDirection: "row", alignItems: "flex-start", backgroundColor: P.ghostLight, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: P.ghostBorder },
  infoBannerText: { fontSize: 13, color: P.primary, flex: 1, lineHeight: 19 },
  notifNote:      { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FFFBEB", borderRadius: 14, padding: 14, marginTop: 16, borderWidth: 1, borderColor: "#FDE68A" },
  notifNoteText:  { fontSize: 13, color: "#92400E", flex: 1, lineHeight: 19 },

  // Schedule summary pill (Step 3)
  scheduleSummaryPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start",
    backgroundColor: P.ghostLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1.5, borderColor: P.ghostBorder, marginBottom: 18,
  },
  scheduleSummaryText: { fontSize: 13, fontWeight: "700", color: P.primary },

  // Empty timings
  emptyTimings:      { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyTimingsIcon:  { width: 72, height: 72, borderRadius: 24, backgroundColor: P.ghostLight, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: P.ghostBorder },
  emptyTimingsTitle: { fontSize: 16, fontWeight: "700", color: P.textSub },
  emptyTimingsText:  { fontSize: 13, color: P.textMuted, textAlign: "center" },

  // Timings card
  timingsCard:       { backgroundColor: P.surface, borderRadius: 16, borderWidth: 1, borderColor: P.ghostLight, overflow: "hidden" },
  timingRow:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  timingRowBorder:   { borderBottomWidth: 1, borderBottomColor: P.ghostLight },
  timingIndex:       { width: 30, height: 30, borderRadius: 10, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  timingIndexText:   { color: "#fff", fontSize: 13, fontWeight: "700" },
  timingLabelWrap:   { flex: 1 },
  timingDoseLabel:   { fontSize: 14, color: P.text, fontWeight: "700" },
  timingDoseSub:     { fontSize: 11, color: P.textMuted, marginTop: 2 },
  timingDisplayChip: {
    flexDirection: "row", alignItems: "center", backgroundColor: P.white,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1.5, borderColor: P.ghostBorder, gap: 6,
  },
  timingDisplayText: { fontSize: 14, color: P.primary, fontWeight: "700" },

  // Bottom nav
  bottomNav: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", gap: 12, padding: 20,
    backgroundColor: P.surface, borderTopWidth: 1, borderTopColor: P.ghostLight,
  },
  prevBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: P.white, borderRadius: 16, paddingHorizontal: 20, height: 54,
    borderWidth: 1.5, borderColor: P.ghostBorder, gap: 4,
  },
  prevBtnText:     { color: P.textSub, fontWeight: "600", fontSize: 15 },
  nextBtn:         { flex: 1, borderRadius: 16, overflow: "hidden" },
  nextBtnGradient: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", height: 54, gap: 8,
    shadowColor: P.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  nextBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
}); 