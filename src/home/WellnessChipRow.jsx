/**
 * WellnessChipRow — final version, driver-safe
 *
 * Driver split (the only rule React Native enforces strictly):
 *   Outer Animated.View → transform: [{ translateX: pillPos }]  useNativeDriver: true
 *   Inner Animated.View → width + backgroundColor               useNativeDriver: false
 *
 * A single Animated.View must NEVER mix native-driver and JS-driver props.
 * Splitting into outer/inner fully satisfies this constraint.
 *
 * Alignment guarantee:
 *   chipRowContainer  paddingHorizontal:10
 *   └─ chipRowInner   position:relative  ← pill AND FlatList share this origin
 *      ├─ pill        position:absolute, left:0, translateX = idx * CHIP_ITEM_WIDTH
 *      └─ FlatList    starts at x:0, items width=CHIP_WIDTH marginRight=CHIP_GAP
 *   idx * CHIP_ITEM_WIDTH  ≡  idx * (CHIP_WIDTH + CHIP_GAP)  → exact chip position
 */

import React, { useRef, useEffect, useCallback } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  ImageBackground,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "../components/TextWrapper";
import shared from "./wellnessStyles";
import {
  CATEGORIES,
  NAV_PROP_MAP,
  CHIP_ITEM_WIDTH,
  CHIP_WIDTH,
  CHIP_ACTIVE_COLORS,
} from "./wellnessConstants";

// ── Spring presets ─────────────────────────────────────────────────────────────
const SP_NAT = { tension: 82, friction: 13, useNativeDriver: true };
const SP_JS  = { tension: 82, friction: 13, useNativeDriver: false };

// ── Colour interpolation (stable module-level arrays) ─────────────────────────
const C_IN  = CATEGORIES.map((_, i) => i);
const C_OUT = CATEGORIES.map((c) => CHIP_ACTIVE_COLORS[c.label]?.bg ?? c.color);

// ── ActiveChip — transparent, pill provides colour ────────────────────────────
const ActiveChip = React.memo(({ label }) => (
  <View style={shared.activeChipContainer}>
    <Text
      weight="600"
      style={[
        shared.activeChipText,
        { color: CHIP_ACTIVE_COLORS[label]?.text ?? "#FFFFFF" },
      ]}
    >
      {label}
    </Text>
  </View>
));

// ── WellnessChipRow ────────────────────────────────────────────────────────────
export default function WellnessChipRow({ currentCategory, navProps }) {
  const listRef = useRef(null);
  const initIdx = Math.max(
    0,
    CATEGORIES.findIndex((c) => c.label === currentCategory),
  );

  const pillPos = useRef(new Animated.Value(initIdx * CHIP_ITEM_WIDTH)).current;
  const pillIdx = useRef(new Animated.Value(initIdx)).current;
  const pillW   = useRef(new Animated.Value(CHIP_WIDTH)).current;

  const pillColor = pillIdx.interpolate({
    inputRange:  C_IN,
    outputRange: C_OUT,
    extrapolate: "clamp",
  });

  const animateTo = useCallback((idx) => {
    Animated.parallel([
      Animated.spring(pillPos, { toValue: idx * CHIP_ITEM_WIDTH, ...SP_NAT }),
      Animated.spring(pillIdx, { toValue: idx, ...SP_JS }),
      Animated.spring(pillW,   { toValue: CHIP_WIDTH, ...SP_JS }),
    ]).start();
  }, []);

  useEffect(() => {
    const idx = Math.max(
      0,
      CATEGORIES.findIndex((c) => c.label === currentCategory),
    );
    animateTo(idx);
    listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
  }, [currentCategory]);

  const handlePress = useCallback(
    (label, index) => {
      if (label === currentCategory) return;
      animateTo(index);
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      const key = NAV_PROP_MAP[label];
      if (key && typeof navProps?.[key] === "function") navProps[key]();
    },
    [currentCategory, navProps, animateTo],
  );

  const renderItem = useCallback(
    ({ item: chip, index }) => {
      const isActive = currentCategory === chip.label;
      const isLast   = index === CATEGORIES.length - 1;
      return (
        <View style={[shared.chipTouch, isLast && { marginRight: 0 }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handlePress(chip.label, index)}
            style={{ width: "100%" }}
          >
            {isActive ? (
              <ActiveChip label={chip.label} />
            ) : (
              <View style={[shared.inactiveChip, { borderColor: chip.color }]}>
                <Text weight="500" style={[shared.inactiveChipText, { color: chip.color }]}>
                  {chip.label}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [currentCategory, handlePress],
  );

  const getItemLayout = useCallback(
    (_, index) => ({ length: CHIP_ITEM_WIDTH, offset: CHIP_ITEM_WIDTH * index, index }),
    [],
  );

  return (
    <View style={shared.chipRowContainer}>
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
          >
            {currentCategory === "Medicine" && (
              <ImageBackground
                source={require("../../assets/medicines.webp")}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                imageStyle={{ opacity: 0.25 }}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={["rgba(220,234,255,0.28)", "rgba(220,234,255,0.28)"]}
                  style={{ flex: 1 }}
                />
              </ImageBackground>
            )}
          </Animated.View>
        </Animated.View>

        <FlatList
          ref={listRef}
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item.label}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          showsHorizontalScrollIndicator={false}
          bounces={false}
          scrollEnabled={false}
          contentContainerStyle={shared.chipRow}
          style={{ flex: 1, zIndex: 10 }}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
            }, 120);
          }}
        />
      </View>
    </View>
  );
}