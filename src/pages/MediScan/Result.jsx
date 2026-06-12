import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  Animated,
  Easing,
  StatusBar,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "../../components/TextWrapper";
import { analyzeImage } from "./ScanResult";

const { width } = Dimensions.get("window");

// ─── Design tokens (purple system) ───────────────────────────────────────────
const P = {
  primary:     "#553FB5",
  primaryDark: "#3D2D8F",
  primaryMid:  "#6B52C8",
  primarySoft: "#8B72E0",
  ghostLight:  "#F0ECFF",
  ghostMid:    "#DCECFF",
  ghostBorder: "#C8B8FF",
  teal:        "#22C5AC",   // kept for scan-line visibility
  tealGlow:    "#6EFCE8",
  amber:       "#F59E0B",
  coral:       "#FF6B6B",
  green:       "#10B981",
  blue:        "#4FC3F7",
  lavender:    "#A78BFA",
  gold:        "#FFD166",
  surface:     "#F7F5FF",
  white:       "#FFFFFF",
  text:        "#1A1235",
  textSub:     "#4A3F70",
  textMuted:   "#9488B8",
};

// ─── Section metadata ─────────────────────────────────────────────────────────
const SECTION_META = {
  Uses:             { icon: "pill",                  color: P.primary,   bg: P.ghostLight },
  Indications:      { icon: "pill",                  color: P.primary,   bg: P.ghostLight },
  Benefits:         { icon: "heart-pulse",            color: P.coral,     bg: "#FFF0F0" },
  "How It Works":   { icon: "cpu-64-bit",             color: P.blue,      bg: "#E8F7FF" },
  Dosage:           { icon: "clipboard-text-outline", color: P.amber,     bg: "#FFF8EC" },
  "Side Effects":   { icon: "alert-circle-outline",   color: "#EF5350",   bg: "#FFF0F0" },
  Warnings:         { icon: "alert-outline",          color: "#FF7043",   bg: "#FFF2EE" },
  Contraindications:{ icon: "close-circle-outline",   color: P.lavender,  bg: "#F5F0FF" },
  Interactions:     { icon: "swap-horizontal",        color: P.gold,      bg: "#FFFBEC" },
  Storage:          { icon: "archive-outline",        color: P.teal,      bg: "#E8FAFB" },
  Disclaimer:       { icon: "information-outline",    color: P.textMuted, bg: P.ghostLight },
};

const getSectionMeta = (title) => {
  for (const key of Object.keys(SECTION_META)) {
    if (title.includes(key)) return SECTION_META[key];
  }
  return { icon: "information-outline", color: P.primarySoft, bg: P.ghostLight };
};

// ─── Expiry normaliser ────────────────────────────────────────────────────────
const MONTH_NAMES = {
  jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06",
  jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12",
};

const normaliseExpiry = (raw) => {
  if (!raw || typeof raw !== "string") return "";
  const s = raw.trim();
  const slashMatch = s.match(/^(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const mm = slashMatch[1].padStart(2, "0");
    let yyyy = slashMatch[2];
    if (yyyy.length === 2) yyyy = "20" + yyyy;
    return `${mm}/${yyyy}`;
  }
  const dashMatch = s.match(/^(\d{2,4})-(\d{1,2})$|^(\d{1,2})-(\d{2,4})$/);
  if (dashMatch) {
    const a = dashMatch[1] || dashMatch[3];
    const b = dashMatch[2] || dashMatch[4];
    const [mm, yyyy] =
      a.length === 4
        ? [b.padStart(2, "0"), a]
        : [a.padStart(2, "0"), b.length === 2 ? "20" + b : b];
    return `${mm}/${yyyy}`;
  }
  const wordMatch = s.match(/^([a-zA-Z]+)[.\s,]+(\d{2,4})$/);
  if (wordMatch) {
    const abbr = wordMatch[1].toLowerCase().slice(0, 3);
    const mm = MONTH_NAMES[abbr];
    if (mm) {
      const yyyy = wordMatch[2].length === 2 ? "20" + wordMatch[2] : wordMatch[2];
      return `${mm}/${yyyy}`;
    }
  }
  return "";
};

// ─── Loading screen ───────────────────────────────────────────────────────────
const FRAME = width * 0.72;

const LoadingView = ({ imageUri }) => {
  const scanLine  = useRef(new Animated.Value(0)).current;
  const pulse     = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpac  = useRef(new Animated.Value(0.8)).current;
  const fadeIn    = useRef(new Animated.Value(0)).current;
  const dots = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ];

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.parallel([
        Animated.timing(ringScale, { toValue: 1.6, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(ringOpac,  { toValue: 0,   duration: 1600, useNativeDriver: true }),
      ])
    ).start();

    dots.forEach((d, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 220),
          Animated.timing(d, { toValue: 1,   duration: 400, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          Animated.delay((dots.length - i - 1) * 220),
        ])
      ).start();
    });
  }, []);

  const scanTranslate = scanLine.interpolate({
    inputRange: [0, 1],
    outputRange: [-FRAME / 2, FRAME / 2],
  });

  return (
    <View style={ls.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={ls.blobA} />
      <View style={ls.blobB} />

      <Animated.View style={[ls.content, { opacity: fadeIn }]}>
        {/* Scan frame */}
        <View style={ls.frameWrap}>
          <Animated.View style={[ls.ripple, { transform: [{ scale: ringScale }], opacity: ringOpac }]} />
          <View style={ls.frame}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={ls.frameImage} resizeMode="cover" />
            ) : (
              <View style={ls.framePlaceholder}>
                <MaterialCommunityIcons name="pill" size={52} color={P.primarySoft} />
              </View>
            )}
            <Animated.View style={[ls.scanLine, { transform: [{ translateY: scanTranslate }] }]} />
            {[
              { top:0,    left:0,   borderTopWidth:3,    borderLeftWidth:3,   borderBottomWidth:0, borderRightWidth:0,  borderTopLeftRadius:12 },
              { top:0,    right:0,  borderTopWidth:3,    borderRightWidth:3,  borderBottomWidth:0, borderLeftWidth:0,   borderTopRightRadius:12 },
              { bottom:0, left:0,   borderBottomWidth:3, borderLeftWidth:3,   borderTopWidth:0,    borderRightWidth:0,  borderBottomLeftRadius:12 },
              { bottom:0, right:0,  borderBottomWidth:3, borderRightWidth:3,  borderTopWidth:0,    borderLeftWidth:0,   borderBottomRightRadius:12 },
            ].map((cs, i) => (
              <View key={i} style={[ls.corner, cs, { borderColor: P.primarySoft }]} />
            ))}
          </View>
        </View>

        {/* Pulse icon */}
        <Animated.View style={[ls.iconWrap, { transform: [{ scale: pulse }] }]}>
          <MaterialCommunityIcons name="line-scan" size={32} color={P.primarySoft} />
        </Animated.View>

        <Text weight="700" style={ls.title}>Analysing Medicine</Text>
        <Text style={ls.subtitle}>AI is reading the packet details…</Text>

        {/* Dot loader */}
        <View style={ls.dotsRow}>
          {dots.map((d, i) => (
            <Animated.View key={i} style={[ls.dot, { opacity: d }]} />
          ))}
        </View>

        {/* Step chips */}
        <View style={ls.stepsRow}>
          {["Detecting text", "Parsing data", "Building report"].map((step, i) => (
            <View key={i} style={ls.stepChip}>
              <MaterialCommunityIcons name="check-circle-outline" size={12} color={P.ghostBorder} />
              <Text style={ls.stepChipText}>{step}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
};

// ─── Log CTA card ─────────────────────────────────────────────────────────────
const LogMedicineCTA = ({ onPress, medicineName }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const spring = (to) =>
    Animated.spring(scaleAnim, { toValue: to, useNativeDriver: true, speed: 50, bounciness: 4 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], marginBottom: 16 }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => spring(0.97)}
        onPressOut={() => spring(1)}
        activeOpacity={1}
        style={cta.card}
      >
        <View style={cta.accentStripe} />
        <LinearGradient
          colors={[P.primary, P.primaryMid]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={cta.iconWrap}
        >
          <MaterialCommunityIcons name="pill-multiple" size={24} color={P.white} />
        </LinearGradient>
        <View style={cta.textCol}>
          <Text weight="700" style={cta.title}>Log This Medicine</Text>
          <Text style={cta.subtitle} numberOfLines={1}>
            {medicineName ? `Add "${medicineName}" to your tracker` : "Add to your medicine tracker"}
          </Text>
        </View>
        <View style={cta.arrowWrap}>
          <View style={cta.arrowCircle}>
            <MaterialCommunityIcons name="arrow-right" size={16} color={P.primary} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const cta = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: P.white,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: P.ghostBorder,
  },
  accentStripe: {
    width: 5,
    alignSelf: "stretch",
    backgroundColor: P.primary,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 14,
    marginVertical: 16,
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  textCol: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  title: {
    fontSize: 15,
    color: P.text,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12,
    color: P.textMuted,
    lineHeight: 17,
  },
  arrowWrap: {
    paddingRight: 16,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: P.ghostLight,
    borderWidth: 1,
    borderColor: P.ghostBorder,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ─── Main result screen ───────────────────────────────────────────────────────
const ResultScreen = ({ navigation, route }) => {
  const { imageUri } = route.params || {};
  const [isLoading, setIsLoading] = useState(true);
  const [resultData, setResultData] = useState(null);

  const fadeIn  = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const data = await analyzeImage(imageUri);
      setResultData(data);
      setIsLoading(false);
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(slideUp, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]).start();
    })();
  }, [imageUri]);

  const handleLogMedicine = () => {
    navigation.navigate("LogNewMedicine", {
      prefillName:   resultData?.medicine?.name ?? "",
      prefillExpiry: normaliseExpiry(resultData?.medicine?.expDate ?? ""),
    });
  };

  if (isLoading) return <LoadingView imageUri={imageUri} />;

  const { medicine, info } = resultData;

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Decorative blobs */}
      <View style={s.blobTop} />
      <View style={s.blobBottom} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={P.primary} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <MaterialCommunityIcons name="pill" size={15} color={P.primarySoft} style={{ marginRight: 5 }} />
          <Text weight="700" style={s.headerTitle}>Medicine Details</Text>
        </View>
        <View style={s.aiBadge}>
          <View style={s.aiBadgeDot} />
          <Text weight="700" style={s.aiBadgeText}>AI</Text>
        </View>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Scanned image */}
        {imageUri && (
          <View style={s.imageWrap}>
            <Image source={{ uri: imageUri }} style={s.scannedImage} resizeMode="cover" />
            <View style={s.imageBadge}>
              <MaterialCommunityIcons name="check-circle" size={12} color={P.teal} />
              <Text style={s.imageBadgeText}>Scanned</Text>
            </View>
          </View>
        )}

        {/* Main info card */}
        <View style={s.mainCard}>
          {/* Name block — purple gradient header */}
          <LinearGradient
            colors={[P.primary, P.primaryDark]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.nameBlock}
          >
            <View style={[s.blob, { top: -18, right: -12, width: 80, height: 80, opacity: 0.14 }]} />
            <View style={[s.blob, { bottom: -16, left: -8, width: 56, height: 56, opacity: 0.1 }]} />
            <View style={s.nameIconWrap}>
              <MaterialCommunityIcons name="pill" size={24} color={P.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight="700" style={s.medicineName}>{medicine.displayName}</Text>
              <Text style={s.genericName}>{medicine.genericName}</Text>
            </View>
            <View style={s.confidencePill}>
              <MaterialCommunityIcons name="check-decagram" size={12} color={P.white} />
              <Text weight="700" style={s.confidenceText}>{medicine.confidence}</Text>
            </View>
          </LinearGradient>

          {/* Meta grid */}
          <View style={s.metaGrid}>
            {[
              { icon: "domain",         label: "Manufacturer", value: medicine.manufacturer, color: P.primary },
              { icon: "currency-inr",   label: "MRP",          value: medicine.mrp,          color: P.amber },
              { icon: "clipboard-list", label: "Schedule",     value: medicine.schedule,     color: P.lavender },
              { icon: "barcode-scan",   label: "Batch No.",    value: medicine.batchNo,      color: P.blue },
            ].map((item, i) => (
              <View key={i} style={s.metaCell}>
                <View style={[s.metaCellIcon, { backgroundColor: item.color + "18" }]}>
                  <MaterialCommunityIcons name={item.icon} size={15} color={item.color} />
                </View>
                <Text style={s.metaLabel}>{item.label}</Text>
                <Text weight="600" style={s.metaValue} numberOfLines={1}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* Dates strip */}
          <View style={s.datesStrip}>
            <View style={s.dateItem}>
              <MaterialCommunityIcons name="calendar-check-outline" size={14} color={P.teal} />
              <View style={{ marginLeft: 6 }}>
                <Text style={s.dateLabel}>Manufactured</Text>
                <Text weight="700" style={s.dateValue}>{medicine.mfgDate}</Text>
              </View>
            </View>
            <View style={s.dateSep} />
            <View style={s.dateItem}>
              <MaterialCommunityIcons name="calendar-remove-outline" size={14} color={P.coral} />
              <View style={{ marginLeft: 6 }}>
                <Text style={s.dateLabel}>Expires</Text>
                <Text weight="700" style={[s.dateValue, { color: P.coral }]}>{medicine.expDate}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Log CTA */}
        <LogMedicineCTA onPress={handleLogMedicine} medicineName={medicine.displayName} />

        {/* Section divider */}
        <View style={s.sectionDivider}>
          <View style={s.sectionDividerLine} />
          <View style={s.sectionDividerPill}>
            <Text style={s.sectionDividerText}>MEDICINE INFO</Text>
          </View>
          <View style={s.sectionDividerLine} />
        </View>

        {/* Info sections */}
        {info.map((section, index) => {
          const meta = getSectionMeta(section.title);
          return (
            <View key={index} style={[s.infoCard, { borderLeftColor: meta.color }]}>
              <View style={s.infoCardHeader}>
                <View style={[s.infoIconWrap, { backgroundColor: meta.bg }]}>
                  <MaterialCommunityIcons name={meta.icon} size={17} color={meta.color} />
                </View>
                <Text weight="700" style={[s.infoCardTitle, { color: meta.color }]}>
                  {section.title}
                </Text>
              </View>
              {section.content.map((item, i) => {
                if (!item || item.trim() === "") return null;
                const cleaned = item.replace(/^[•\-]\s*/, "");
                return (
                  <View key={i} style={s.contentRow}>
                    <View style={[s.bullet, { backgroundColor: meta.color }]} />
                    <Text style={s.contentText}>{cleaned}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}

        <View style={{ height: 32 }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

export default ResultScreen;

// ─── Loading styles ───────────────────────────────────────────────────────────
const ls = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0D0820",
    alignItems: "center",
    justifyContent: "center",
  },
  blobA: {
    position: "absolute",
    top: -80, right: -60,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: P.primaryMid + "18",
  },
  blobB: {
    position: "absolute",
    bottom: 40, left: -70,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: P.primarySoft + "12",
  },
  content: { alignItems: "center", paddingHorizontal: 28 },
  frameWrap: {
    width: FRAME + 40, height: FRAME + 40,
    alignItems: "center", justifyContent: "center",
    marginBottom: 30,
  },
  ripple: {
    position: "absolute",
    width: FRAME, height: FRAME, borderRadius: 20,
    borderWidth: 2, borderColor: P.primarySoft,
  },
  frame: {
    width: FRAME, height: FRAME, borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#1A0F3C",
    alignItems: "center", justifyContent: "center",
  },
  frameImage: { width: "100%", height: "100%" },
  framePlaceholder: { alignItems: "center", justifyContent: "center", flex: 1 },
  scanLine: {
    position: "absolute",
    width: "100%", height: 3,
    backgroundColor: P.teal,
    shadowColor: P.tealGlow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 10,
  },
  corner: { position: "absolute", width: 26, height: 26 },
  iconWrap: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: P.primarySoft + "18",
    borderWidth: 1, borderColor: P.primarySoft + "30",
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 22, color: P.white, marginBottom: 6, letterSpacing: 0.2 },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 22 },
  dotsRow: { flexDirection: "row", gap: 8, marginBottom: 28 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: P.primarySoft },
  stepsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  stepChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(139,114,224,0.14)",
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(200,184,255,0.22)",
  },
  stepChipText: { fontSize: 10, color: P.ghostBorder, fontWeight: "600" },
});

// ─── Main styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.surface },

  blobTop: {
    position: "absolute", top: -70, right: -50,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: P.primarySoft + "12",
  },
  blobBottom: {
    position: "absolute", bottom: 60, left: -60,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: P.ghostMid + "60",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: P.ghostLight,
    borderWidth: 1, borderColor: P.ghostBorder,
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 17, color: P.text, letterSpacing: 0.1 },
  aiBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: P.ghostLight,
    borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5,
    borderWidth: 1, borderColor: P.ghostBorder,
  },
  aiBadgeDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: P.teal,
    shadowColor: P.teal, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 4,
  },
  aiBadgeText: { fontSize: 10, color: P.primary, letterSpacing: 0.5 },

  scroll: { paddingHorizontal: 18, paddingBottom: 20, paddingTop: 8 },

  // Image
  imageWrap: {
    borderRadius: 20, overflow: "hidden", marginBottom: 18,
    shadowColor: P.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14, shadowRadius: 12, elevation: 6,
  },
  scannedImage: { width: "100%", height: 200 },
  imageBadge: {
    position: "absolute", bottom: 10, right: 12,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  imageBadgeText: { fontSize: 11, color: P.white, fontWeight: "600" },

  // Main card
  mainCard: {
    backgroundColor: P.white, borderRadius: 22,
    overflow: "hidden", marginBottom: 20,
    shadowColor: P.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 7,
  },
  blob: { position: "absolute", borderRadius: 999, backgroundColor: P.white },
  nameBlock: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 18, paddingVertical: 18, overflow: "hidden",
  },
  nameIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  medicineName: { fontSize: 17, color: P.white, letterSpacing: 0.1, marginBottom: 2 },
  genericName: { fontSize: 12, color: "rgba(255,255,255,0.5)", fontStyle: "italic" },
  confidencePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  confidenceText: { fontSize: 11, color: P.white },

  metaGrid: { flexDirection: "row", flexWrap: "wrap", padding: 14, gap: 10 },
  metaCell: {
    width: (width - 36 - 28 - 10) / 2,
    backgroundColor: P.ghostLight,
    borderRadius: 14, padding: 12,
  },
  metaCellIcon: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: "center", justifyContent: "center", marginBottom: 6,
  },
  metaLabel: { fontSize: 10, color: P.textMuted, marginBottom: 2 },
  metaValue: { fontSize: 13, color: P.text },

  datesStrip: {
    flexDirection: "row", alignItems: "center",
    borderTopWidth: 1, borderTopColor: P.ghostLight,
    paddingHorizontal: 18, paddingVertical: 14,
  },
  dateItem: { flex: 1, flexDirection: "row", alignItems: "center" },
  dateSep: {
    width: 1, height: 36,
    backgroundColor: P.ghostLight,
    marginHorizontal: 14,
  },
  dateLabel: { fontSize: 10, color: P.textMuted, marginBottom: 2 },
  dateValue: { fontSize: 14, color: P.text },

  // Section divider
  sectionDivider: {
    flexDirection: "row", alignItems: "center",
    marginBottom: 16, gap: 10,
  },
  sectionDividerLine: { flex: 1, height: 1, backgroundColor: P.ghostBorder + "60" },
  sectionDividerPill: {
    backgroundColor: P.ghostLight,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: P.ghostBorder,
  },
  sectionDividerText: {
    fontSize: 10, color: P.primary, fontWeight: "700", letterSpacing: 1.2,
  },

  // Info cards
  infoCard: {
    backgroundColor: P.white, borderRadius: 18,
    padding: 16, marginBottom: 12, borderLeftWidth: 4,
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  infoCardHeader: {
    flexDirection: "row", alignItems: "center",
    gap: 10, marginBottom: 12,
  },
  infoIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  infoCardTitle: { fontSize: 15, flex: 1 },
  contentRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  bullet: {
    width: 6, height: 6, borderRadius: 3,
    marginTop: 7, marginRight: 10, flexShrink: 0,
  },
  contentText: { fontSize: 13, color: P.textSub, lineHeight: 20, flex: 1 },
});