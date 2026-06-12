import React, { useRef, useState, useCallback } from "react";
import { View, TouchableOpacity, StyleSheet, StatusBar } from "react-native";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../components/TextWrapper";
import Nutrition from "../pages/Nutrition";
import WellnessChipRow from "./WellnessChipRow";
import WellnessAllSection from "./WellnessAllSection";
import SleepWellnessSection from "./SleepWellnessSection";
import NutritionWellnessSection from "./NutritionWellnessSection";
import FitnessWellnessSection from "./FitnessWellnessSection";
import MedicineWellnessSection from "./MedicineWellnessSection";
import MenstrualWellnessSection from "./MenstrualWellnessSection";

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  { key: "all",              label: "All"       },
  { key: "sleep",            label: "Sleep"     },
  { key: "nutrition",        label: "Nutrition" },
  { key: "physicalActivity", label: "Fitness"   },
  { key: "medicine",         label: "Medicine"  },
  { key: "menstrual",        label: "Mentrual"  },
];

export default function WellnessScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const initialTab = route?.params?.initialTab ?? 0;
  const [activeIndex, setActiveIndex] = useState(initialTab);
  const pagerRef = useRef(null);

  const handleTabPress = useCallback((index) => {
    setActiveIndex(index);
    pagerRef.current?.setPage(index);
  }, []);
  const navProps = {
    onNavigateAll:       () => handleTabPress(0),
    onNavigateSleep:     () => handleTabPress(1),
    onNavigateNutrition: () => handleTabPress(2),
    onNavigateFitness:   () => handleTabPress(3),
    onNavigateMedicine:  () => handleTabPress(4),
    onNavigateMentrual:  () => handleTabPress(5),
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FFFC" />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color="#553FB5" />
        </TouchableOpacity>
        <View>
          <Text overlock weight={900} size={17} color="#553FB5">
            Health Wellness
          </Text>
          <Text overlock size={12} color="#000000" style={{ letterSpacing: -0.03 * 12 }}>
            Build healthy habits, one day at a time.
          </Text>
        </View>
      </View>

      {/* ── Chip tab bar ── */}
      <WellnessChipRow
        currentCategory={TABS[activeIndex].label}
        navProps={{
          onNavigateAll:       () => handleTabPress(0),
          onNavigateSleep:     () => handleTabPress(1),
          onNavigateNutrition: () => handleTabPress(2),
          onNavigateFitness:   () => handleTabPress(3),
          onNavigateMedicine:  () => handleTabPress(4),
          onNavigateMentrual:  () => handleTabPress(5),
        }}
      />

      {/* ── Pages ── */}
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={initialTab}
        onPageSelected={(e) => setActiveIndex(e.nativeEvent.position)}
      >
        <View key="0"><WellnessAllSection hideHeader={true} navigation={navigation} {...navProps} /></View>
        <View key="1"><SleepWellnessSection hideHeader={true} navigation={navigation} {...navProps} /></View>
        <View key="2"><NutritionWellnessSection hideHeader={true} navigation={navigation} {...navProps} /></View>
        <View key="3"><FitnessWellnessSection hideHeader={true} navigation={navigation} {...navProps} /></View>
        <View key="4"><MedicineWellnessSection hideHeader={true} navigation={navigation} {...navProps} /></View>
        <View key="5"><MenstrualWellnessSection hideHeader={true} navigation={navigation} {...navProps} /></View>
      </PagerView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FFFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 10,
    backgroundColor: "#F8FFFC",
    gap: 10,
  },
  backBtn: {
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
  },
});