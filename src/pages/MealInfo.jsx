/**
 * MealInfo.jsx — Smooth open/close animation upgrade
 *
 * Animation improvements:
 *  • Modal stays mounted during close animation (visible state decoupled from isOpen)
 *  • Open: sheet springs up from below + backdrop fades in simultaneously
 *  • Close: sheet eases down + backdrop fades out, Modal unmounts only after both finish
 *  • Backdrop opacity is animated (0 → 0.52 on open, reverse on close)
 *  • Sheet uses a tuned spring (tension/friction) for a natural, bouncy feel on open
 *  • Close uses a smooth ease-out cubic (Easing.out(Easing.cubic)) — no abrupt cut
 *  • Content fades + slides up slightly on open for a layered depth effect
 *  • All props, logic, state, and onMealAdded callback preserved exactly
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Pressable,
  Modal,
  Platform,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "../components/TextWrapper";

const { width, height } = Dimensions.get("window");
const isSmall = width < 380;

// ── Animation constants ────────────────────────
const OPEN_DURATION = 420; // ms — spring settle time (approximate)
const CLOSE_DURATION = 300; // ms — ease-out slide down
const SHEET_OVERSHOOT = height; // start position (off-screen bottom)

// ── Design tokens ──────────────────────────────
const C = {
  bg: "#F2F6F3",
  surface: "#FFFFFF",
  border: "#E4EDE7",
  primary: "#0A7A3E",
  primaryMid: "#14A855",
  primaryLight: "#1DB954",
  primaryDark: "#064D27",
  primaryGhost: "#E8F5EE",
  text: "#0D1F16",
  textSub: "#3D5C47",
  textMuted: "#7EA98A",
  blue: "#2563EB",
  blueLight: "#EFF6FF",
  orange: "#EA580C",
  orangeLight: "#FFF4EE",
  emerald: "#059669",
  emeraldLight: "#ECFDF5",
};

// ── Portion configuration ──────────────────────
const PORTION_MAP = { small: 0.75, medium: 1, large: 1.25 };
const PORTION_META = {
  small: { label: "Small", sub: "×0.75" },
  medium: { label: "Medium", sub: "×1.0" },
  large: { label: "Large", sub: "×1.25" },
};

// ── Press-scale wrapper ────────────────────────
const PressScale = ({ onPress, style, children, disabled }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        disabled={disabled}
        activeOpacity={1}
        onPressIn={() => spring(0.96)}
        onPressOut={() => spring(1)}
        onPress={onPress}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Macro chip ─────────────────────────────────
const MacroChip = ({ label, value, color, bg }) => (
  <View style={[m.macroChip, { backgroundColor: bg }]}>
    <Text weight="800" style={[m.macroChipVal, { color }]}>
      {value}g
    </Text>
    <Text style={[m.macroChipLabel, { color }]}>{label}</Text>
  </View>
);

// ─────────────────────────────────────────────────────
const MealInfoRN = ({
  isOpen,
  onClose,
  name,
  protein = 0,
  carbs = 0,
  fat = 0,
  calories = 0,
  onMealAdded,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [portion, setPortion] = useState("medium");

  // modalVisible keeps the Modal in the tree during the close animation
  const [modalVisible, setModalVisible] = useState(false);

  // ── Animated values ────────────────────────
  const slideAnim = useRef(new Animated.Value(SHEET_OVERSHOOT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current; // 0=hidden, 1=shown

  // ── Open animation ─────────────────────────
  const animateOpen = useCallback(() => {
    // Reset all to starting positions
    slideAnim.setValue(SHEET_OVERSHOOT);
    backdropAnim.setValue(0);
    contentAnim.setValue(0);

    Animated.parallel([
      // Backdrop: fade in
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: OPEN_DURATION * 0.6,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // Sheet: spring up from bottom — bouncy, natural feel
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65, // controls speed
        friction: 11, // controls bounce (lower = more bounce)
        useNativeDriver: true,
      }),
      // Content: slight fade + upward nudge, delayed so it trails the sheet
      Animated.sequence([
        Animated.delay(120),
        Animated.parallel([
          Animated.timing(contentAnim, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, []);

  // ── Close animation ────────────────────────
  const animateClose = useCallback(() => {
    Animated.parallel([
      // Backdrop: fade out
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: CLOSE_DURATION,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      // Sheet: ease-out slide down — smooth, not abrupt
      Animated.timing(slideAnim, {
        toValue: SHEET_OVERSHOOT,
        duration: CLOSE_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Content: fade out quickly
      Animated.timing(contentAnim, {
        toValue: 0,
        duration: CLOSE_DURATION * 0.6,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Only unmount Modal after animations fully complete
      setModalVisible(false);
    });
  }, []);

  // ── React to isOpen changes ─────────────────
  useEffect(() => {
    if (isOpen) {
      // Reset form state on each open
      setQuantity(1);
      setPortion("medium");
      // Mount Modal first, then run open animation on next frame
      setModalVisible(true);
      requestAnimationFrame(() => {
        animateOpen();
      });
    } else {
      // Run close animation; Modal unmounts in the callback
      animateClose();
    }
  }, [isOpen]);

  // ── Derived macros ──────────────────────────
  const multiplier = PORTION_MAP[portion];
  const derivedMacros = useMemo(
    () => ({
      protein: +(protein * multiplier).toFixed(1),
      carbs: +(carbs * multiplier).toFixed(1),
      fat: +(fat * multiplier).toFixed(1),
      calories: Math.round(calories * multiplier),
    }),
    [protein, carbs, fat, calories, portion],
  );

  const totalCalories = derivedMacros.calories * quantity;

  // ── Add meal ────────────────────────────────
  const handleAdd = () => {
    onMealAdded?.({
      name,
      portion,
      quantity,
      protein: derivedMacros.protein * quantity,
      carbs: derivedMacros.carbs * quantity,
      fat: derivedMacros.fat * quantity,
      calories: totalCalories,
      addedAt: new Date().toISOString(),
    });
    onClose();
  };

  // ── Derived animated styles ─────────────────
  const backdropOpacity = backdropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.52],
  });

  const contentOpacity = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const contentTranslateY = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  if (!modalVisible) return null;

  return (
    <Modal
      transparent
      visible={modalVisible}
      animationType="none"
      statusBarTranslucent
    >
      {/* ── Animated backdrop ─────────────── */}
      <Animated.View
        style={[m.backdrop, { opacity: backdropOpacity }]}
        pointerEvents="auto"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* ── Animated sheet ────────────────── */}
      <Animated.View
        style={[m.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        {/* Drag handle */}
        <View style={m.handleWrap}>
          <View style={m.handle} />
        </View>

        {/* ── Animated content ────────────── */}
        <Animated.View
          style={[
            m.content,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }],
            },
          ]}
        >
          {/* HEADER */}
          <View style={m.header}>
            <View style={m.foodIconBubble}>
              <Ionicons name="restaurant-outline" size={26} color={C.primary} />
            </View>
            <View style={m.headerText}>
              <Text weight="800" style={m.mealName} numberOfLines={2}>
                {name}
              </Text>
              <Text style={m.servingHint}>
                Adjust portion and quantity below
              </Text>
            </View>
            <View style={m.qtyControl}>
              <Text style={m.qtyControlLabel}>Qty</Text>
              <View style={m.qtyRow}>
                <TouchableOpacity
                  style={m.qtyBtn}
                  onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text weight="700" style={m.qtyBtnTxt}>
                    −
                  </Text>
                </TouchableOpacity>
                <Text weight="800" style={m.qtyVal}>
                  {quantity}
                </Text>
                <TouchableOpacity
                  style={m.qtyBtn}
                  onPress={() => setQuantity((q) => q + 1)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text weight="700" style={m.qtyBtnTxt}>
                    +
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* PORTION SELECTOR */}
          <View style={m.portionRow}>
            {Object.entries(PORTION_META).map(([key, meta]) => {
              const active = portion === key;
              return (
                <PressScale
                  key={key}
                  style={{ flex: 1, marginHorizontal: 3 }}
                  onPress={() => setPortion(key)}
                >
                  <View style={[m.portionChip, active && m.portionChipActive]}>
                    <Text
                      weight="700"
                      style={[
                        m.portionChipLabel,
                        active && m.portionChipLabelActive,
                      ]}
                    >
                      {meta.label}
                    </Text>
                    <Text
                      style={[
                        m.portionChipSub,
                        active && m.portionChipSubActive,
                      ]}
                    >
                      {meta.sub}
                    </Text>
                  </View>
                </PressScale>
              );
            })}
          </View>

          {/* MACRO + CALORIE STRIP */}
          <View style={m.macroStrip}>
            <View style={m.macroChips}>
              <MacroChip
                label="Protein"
                value={derivedMacros.protein}
                color={C.blue}
                bg={C.blueLight}
              />
              <MacroChip
                label="Carbs"
                value={derivedMacros.carbs}
                color={C.emerald}
                bg={C.emeraldLight}
              />
              <MacroChip
                label="Fats"
                value={derivedMacros.fat}
                color={C.orange}
                bg={C.orangeLight}
              />
            </View>
            <View style={m.calRing}>
              <Text weight="800" style={m.calRingVal}>
                {totalCalories}
              </Text>
              <Text style={m.calRingUnit}>Cal</Text>
            </View>
          </View>

          {/* PER-SERVING NOTE */}
          <Text style={m.perServingNote}>
            {derivedMacros.calories} kcal × {quantity} serving
            {quantity > 1 ? "s" : ""} = {totalCalories} kcal
          </Text>

          {/* ADD BUTTON */}
          <PressScale onPress={handleAdd}>
            <LinearGradient
              colors={[C.primaryLight, C.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={m.addBtn}
            >
              <Feather name="plus" size={18} color="#fff" />
              <Text weight="700" style={m.addBtnTxt}>
                Add to Meal
              </Text>
            </LinearGradient>
          </PressScale>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default MealInfoRN;

// ── Styles ─────────────────────────────────────────
const m = StyleSheet.create({
  // Backdrop — full screen, animated opacity applied in JSX
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
  },

  // Sheet
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },

  // Handle
  handleWrap: { alignItems: "center", marginBottom: 6 },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#C8D8CC",
  },

  // Close button
  closeBtn: { position: "absolute", top: 14, right: 16, zIndex: 10 },
  closeBtnInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },

  // Content area (animated)
  content: {
    paddingHorizontal: isSmall ? 16 : 20,
    paddingBottom: Platform.OS === "ios" ? 38 : isSmall ? 24 : 30,
  },

  // Header row
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: isSmall ? 10 : 12,
    marginBottom: isSmall ? 14 : 18,
  },
  foodIconBubble: {
    width: isSmall ? 48 : 56,
    height: isSmall ? 48 : 56,
    borderRadius: isSmall ? 14 : 16,
    backgroundColor: C.primaryGhost,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerText: { flex: 1 },
  mealName: { fontSize: isSmall ? 17 : 20, color: C.text, marginBottom: 3 },
  servingHint: { fontSize: 12, color: C.textMuted },

  // Quantity control
  qtyControl: { alignItems: "center", flexShrink: 0 },
  qtyControlLabel: {
    fontSize: 11,
    color: C.textMuted,
    marginBottom: 5,
    letterSpacing: 0.3,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 4,
  },
  qtyBtn: {
    width: isSmall ? 32 : 36,
    height: isSmall ? 32 : 36,
    borderRadius: isSmall ? 9 : 10,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnTxt: {
    color: "#fff",
    fontSize: isSmall ? 18 : 20,
    lineHeight: isSmall ? 22 : 24,
  },
  qtyVal: {
    minWidth: isSmall ? 26 : 30,
    textAlign: "center",
    fontSize: isSmall ? 16 : 18,
    color: C.text,
  },

  // Portion chips
  portionRow: { flexDirection: "row", marginBottom: isSmall ? 14 : 18 },
  portionChip: {
    borderRadius: 14,
    paddingVertical: isSmall ? 9 : 11,
    backgroundColor: C.bg,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.border,
  },
  portionChipActive: {
    backgroundColor: C.primaryGhost,
    borderColor: C.primary,
  },
  portionChipLabel: { fontSize: isSmall ? 13 : 14, color: C.textSub },
  portionChipLabelActive: { color: C.primary },
  portionChipSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  portionChipSubActive: { color: C.primaryMid },

  // Macro strip
  macroStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    paddingVertical: isSmall ? 12 : 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  macroChips: { flex: 1, flexDirection: "row", gap: 6 },
  macroChip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: isSmall ? 8 : 10,
    alignItems: "center",
  },
  macroChipVal: { fontSize: isSmall ? 14 : 16, marginBottom: 2 },
  macroChipLabel: { fontSize: 10, opacity: 0.85 },

  // Calorie ring
  calRing: {
    width: isSmall ? 64 : 72,
    height: isSmall ? 64 : 72,
    borderRadius: isSmall ? 32 : 36,
    borderWidth: 3,
    borderColor: C.primary,
    backgroundColor: C.primaryGhost,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  calRingVal: { fontSize: isSmall ? 17 : 20, color: C.primary },
  calRingUnit: { fontSize: 10, color: C.primaryMid, marginTop: 1 },

  // Per-serving note
  perServingNote: {
    fontSize: 12,
    color: C.textMuted,
    textAlign: "center",
    marginBottom: isSmall ? 14 : 18,
  },

  // Add button
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: isSmall ? 13 : 15,
  },
  addBtnTxt: { color: "#fff", fontSize: isSmall ? 15 : 17 },
});
