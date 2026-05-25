/**
 * SetGoal.jsx — Redesigned to match screenshot
 * Horizontal slider, CalorieNeedsCard SVG, green submit button.
 * All save/navigation logic preserved.
 */

import React, { useState, useRef } from "react";
import {
  View,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  StyleSheet,
  Animated,
  Platform,
  PanResponder,
  StatusBar,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../components/TextWrapper";
import { C } from "../theme";
import { LinearGradient } from "expo-linear-gradient";
import HeaderVeggies from "../../assets/Group 1000004769.svg";
import CalorieNeedsCard from "../../assets/Group 1000004802.svg";
import SliderHandle from "../../assets/Swap me.svg";
import RestaurantIcon from "../../assets/restaurant 1.svg";

const { width } = Dimensions.get("window");

const MIN_CALORIE = 500;
const MAX_CALORIE = 5500;

const SetGoal = () => {
  const navigation = useNavigation();

  const [calorieGoal, setCalorieGoal] = useState(1800);

  const sliderWidth = useRef(0);
  const calorieRef = useRef(1800);
  const btnScale = useRef(new Animated.Value(1)).current;

  // ── Slider pan responder ──────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        updateFromX(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        updateFromX(evt.nativeEvent.locationX);
      },
    })
  ).current;

  const updateFromX = (x) => {
    const w = sliderWidth.current;
    if (!w) return;
    const ratio = Math.min(Math.max(x / w, 0), 1);
    const cal = Math.round(MIN_CALORIE + ratio * (MAX_CALORIE - MIN_CALORIE));
    calorieRef.current = cal;
    setCalorieGoal(cal);
  };

  const fillRatio = (calorieGoal - MIN_CALORIE) / (MAX_CALORIE - MIN_CALORIE);

  // ── Submit ────────────────────────────────────
  const handleSubmit = async () => {
    Animated.sequence([
      Animated.spring(btnScale, {
        toValue: 0.96,
        useNativeDriver: true,
        speed: 40,
      }),
      Animated.spring(btnScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 40,
      }),
    ]).start();
    try {
      await AsyncStorage.setItem(
        "calorieGoalData",
        JSON.stringify({
          calorieGoal,
          protein_g: Math.round((calorieGoal * 0.3) / 4),
          carbs_g: Math.round((calorieGoal * 0.4) / 4),
          fat_g: Math.round((calorieGoal * 0.3) / 9),
        })
      );
      navigation.reset({ index: 0, routes: [{ name: "Nutrition" }] });
    } catch (e) {
      console.warn("SetGoal save failed:", e);
    }
  };

  return (
    <View style={s.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* ══ HEADER ══════════════════════════════ */}
        <View style={s.header}>
          <View style={s.headerContent}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={s.backBtn}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={20} color="#553FB5" />
            </TouchableOpacity>
            <View>
              <Text weight="700" style={s.headerTitle}>
                Set Calorie Goal
              </Text>
              <Text style={s.headerSub}>
                Build healthy habits, one day at a time.
              </Text>
            </View>
          </View>
        </View>
        <HeaderVeggies
            width={width}
            height={90}
            preserveAspectRatio="xMidYMid slice"

          />
        {/* ══ MANUAL SLIDER CARD ══════════════════ */}
        <View style={s.sliderCard}>
          {/* Row: restaurant icon + label */}
          <View style={s.sliderCardTop}>
            <RestaurantIcon width={20} height={20} />
            <Text weight="600" style={s.sliderLabel}>
              Set Goal Manually
            </Text>
          </View>

          {/* Slider track */}
          <View
            style={s.trackWrapper}
            onLayout={(e) => {
              sliderWidth.current = e.nativeEvent.layout.width;
            }}
            {...panResponder.panHandlers}
          >
            {/* Background track */}
            <View style={s.trackBg} />
            {/* Filled track */}
            <View style={[s.trackFill, { width: `${fillRatio * 100}%` }]} />
            {/* Handle */}
            <View
              style={[
                s.handle,
                {
                  left: `${fillRatio * 100}%`,
                  marginLeft: -14,
                },
              ]}
            >
              <SliderHandle width={20} height={20} />
            </View>
          </View>

          {/* Calorie readout */}
          <View style={s.kcalRow}>
            <Text weight="800" style={s.kcalValue}>
              {calorieGoal.toLocaleString()} Kcal
            </Text>
            <Text style={s.kcalSub}>No. Of Calories per day</Text>
          </View>
        </View>

        {/* ══ CALORIE NEEDS CARD ══════════════════ */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate("CalorieCalculator")}
          style={{ marginHorizontal: 16 }}
        >
          <CalorieNeedsCard width={width - 32} height={137} />
        </TouchableOpacity>

      </ScrollView>

      {/* ══ SUBMIT BAR ══════════════════════════ */}
      <View style={s.submitBar}>
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            onPress={handleSubmit}
            activeOpacity={0.88}
            style={s.submitBtn}
          >
              <LinearGradient
                colors={["#93D056", "#35A329"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={s.submitBtnInner}
              >
            <Text weight="700" style={s.submitBtnTxt}>
              Set Goal
            </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

export default SetGoal;

// ── Styles ─────────────────────────────────────────
const STATUS_BAR_H = Platform.OS === "ios" ? 56 : (StatusBar.currentHeight ?? 38) + 8;

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#fff",
  },

  // ── Header ──
  header: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "transparent", // ← was C.primary + "18"
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    color: "#553FB5",
  },
  headerSub: {
    fontSize: 12,
    color: "#553FB5",
    marginTop: 2,
  },

  // ── Slider card ──
  sliderCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    margin: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  sliderCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 22,
  },
  sliderLabel: {
    fontSize: 14,
    color: C.text,
  },

  trackWrapper: {
    height: 28,
    justifyContent: "center",
    marginBottom: 16,
  },
  trackBg: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E8F5E9",
  },
  trackFill: {
    position: "absolute",
    left: 0,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
  },
  handle: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#4CAF50", 
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },

  kcalRow: {
    alignItems: "flex-end",
  },
  kcalValue: {
    fontSize: 18,
    color: C.text,
  },
  kcalSub: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 3,
  },

  // ── Submit bar ──
  submitBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 30 : 18,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  submitBtn: {
    borderRadius: 14,
    overflow: "hidden",  // keep this
    // remove paddingVertical and alignItems
  },
  submitBtnInner: {
  paddingVertical: 15,
  alignItems: "center",
  alignSelf: "stretch",  // ← this makes gradient fill full width
},
  submitBtnTxt: {
    color: "#fff",
    fontSize: 17,
  },
});