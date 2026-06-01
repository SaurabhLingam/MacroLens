import React, { useRef, useState, useCallback, useEffect } from "react";
import { View, TouchableOpacity, ScrollView, StyleSheet, StatusBar, Dimensions, Animated } from "react-native";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../components/TextWrapper";
import { C } from "../theme";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import AllTab from "./tabs/AllTab";
import PhysicalActivityTab from "./tabs/PhysicalActivityTab";
import MedicineTab from "./tabs/MedicineTab";
import MenstrualTab from "./tabs/MenstrualTab";
import Nutrition from "../pages/Nutrition";

// ── Tab config with per-tab colors ────────────────────────────────────────────
const TABS = [
  { key: "all",              label: "All",       activeColor: "#AB7D00", borderColor: "#EEE340", bgColor: "#FFFDE7" },
  { key: "sleep",            label: "Sleep",     activeColor: "#553FB5", borderColor: "#7C1DC9", bgColor: "#EDE7F6" },
  { key: "nutrition",        label: "Nutrition", activeColor: "#087B08", borderColor: "#087B08", bgColor: "#9BE36F" },
  { key: "physicalActivity", label: "Fitness",   activeColor: "#D47709", borderColor: "#FDC78D", bgColor: "#FFF3E0" },
  { key: "medicine",         label: "Medicine",  activeColor: "#0172D0", borderColor: "#6DA3FF", bgColor: "#E3F2FD" },
  { key: "menstrual",        label: "Mentrual",  activeColor: "#E24294", borderColor: "#E74193", bgColor: "#FCE4EC" },
];
const SCREEN_W = Dimensions.get("window").width;
const CURVE_R = 10;

function ActiveTabConnector({ activeIndex, tabLayouts, bgColor }) {
  const active = tabLayouts[activeIndex];
  if (!active) return null;
  console.log("active tab layout:", active);
  const { x, width } = active;
  return (
    <View style={{ height: CURVE_R, overflow: "visible", marginTop: 0 }}>
      <Svg width={SCREEN_W} height={CURVE_R} style={{ position: "absolute", top: 0 }}>
        <Path
          d={`
            M 0 0
            L ${x} 0
            Q ${x} ${CURVE_R} ${x + CURVE_R} ${CURVE_R}
            L ${x + width - CURVE_R} ${CURVE_R}
            Q ${x + width} ${CURVE_R} ${x + width} 0
            L ${SCREEN_W} 0
            L ${SCREEN_W} ${CURVE_R}
            L 0 ${CURVE_R}
            Z
          `}
          fill="#FFFFFF"
        />
      </Svg>
    </View>
  );
}

export default function WellnessScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const initialTab = route?.params?.initialTab ?? 0;
  const [activeIndex, setActiveIndex] = useState(initialTab);
  const [tabLayouts, setTabLayouts] = useState({});
  const pagerRef = useRef(null);
  const tabScrollRef = useRef(null);
  const tabWidths = useRef([]);
  const tabOffsets = useRef([]);
  const animatedX = useRef(new Animated.Value(0)).current;
  const animatedW = useRef(new Animated.Value(50)).current;
  const animatedBg = useRef(new Animated.Value(activeIndex)).current;
  const prevIndexRef = useRef(0);
    const activeBg = TABS[activeIndex]?.bgColor || "#F8FFFC";
    const handleTabPress = useCallback((index) => {
    setActiveIndex(index);
    pagerRef.current?.setPage(index);
    scrollTabIntoView(index);
    }, []);
    useEffect(() => {
    const layout = tabLayouts[activeIndex];
    if (!layout) return;

    const prev = prevIndexRef.current;
    const steps = [];
    const direction = activeIndex > prev ? 1 : -1;

    for (let i = prev + direction; i !== activeIndex + direction; i += direction) {
        const stepLayout = tabLayouts[i];
        if (!stepLayout) continue;
        steps.push(
        Animated.parallel([
            Animated.timing(animatedX, { toValue: stepLayout.x, useNativeDriver: false, duration: 60 }),
            Animated.timing(animatedW, { toValue: stepLayout.width, useNativeDriver: false, duration: 60 }),
        ])
        );
    }

    Animated.sequence(steps).start();
    prevIndexRef.current = activeIndex;
    }, [activeIndex, tabLayouts]);
  const scrollTabIntoView = (index) => {
    const offset = tabOffsets.current[index];
    const width = tabWidths.current[index];
    if (offset !== undefined && width !== undefined) {
      tabScrollRef.current?.scrollTo({
        x: offset - 390 / 2 + width / 2,
        animated: true,
      });
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: activeBg }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FFFC" />

      {/* ── Header ── */}
        <View style={[styles.header, { top: insets.top }]}>
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

      {/* ── Tab bar ── */}
      <View style={[styles.tabBarWrapper, { top: insets.top + 56 }]} onLayout={(e) => console.log("tabBarWrapper height:", e.nativeEvent.layout.height)}> 
        <Animated.View style={{
            position: "absolute",
            left: animatedX,
            top: 6,
            width: animatedW,
            height: 34,
            backgroundColor: TABS[activeIndex]?.bgColor || "#F8FFFC",
            borderRadius: 6,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            zIndex: 5,
        }} />  
        <ScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tabBarContent, { minWidth: "100%", justifyContent: "center" }]}    
          style={{ overflow: "visible" }}
          bounces={false}
        >
          {TABS.map((tab, index) => {
            const isActive = activeIndex === index;
            // Nutrition tab (index 2) has no bg when active per Figma — just no border bg
            const isNutritionActive = isActive && index === 2;
            return (
                <TouchableOpacity
                key={tab.key}
                activeOpacity={0.75}
                onPress={() => handleTabPress(index)}
                onLayout={(e) => {
                    const { x, width } = e.nativeEvent.layout;
                    tabWidths.current[index] = width;
                    tabOffsets.current[index] = x;
                    setTabLayouts(prev => ({ ...prev, [index]: { x, width } }));
                }}
                style={[
                    styles.tabPill,
                    {
                    backgroundColor: "transparent",
                    borderColor: isActive ? "transparent" : tab.borderColor,
                    borderWidth: 0.5,
                    borderBottomWidth: isActive ? 0 : 0.5,
                    borderBottomLeftRadius: isActive ? 0 : 6,
                    borderBottomRightRadius: isActive ? 0 : 6,
                    zIndex: isActive ? 10 : 1,
                    },
                ]}
                >
                <Text overlock weight={isActive ? 900 : 700} size={10} color={tab.activeColor}>
                    {tab.label}
                </Text>
                </TouchableOpacity>
            );
          })}
        </ScrollView>
        <ActiveTabConnector
            activeIndex={activeIndex}
            tabLayouts={tabLayouts}
            bgColor={activeBg}
            debug
        />
      </View>
      
      {/* ── Pages ── */}
      <PagerView
        ref={pagerRef}
        style={{ flex: 1}}
        initialPage={initialTab}
        onPageSelected={(e) => {
          const index = e.nativeEvent.position;
          setActiveIndex(index);
          scrollTabIntoView(index);
        }}
      >
        <View key="0"><AllTab navigation={navigation} /></View>
        <View key="1"><AllTab navigation={navigation} /></View>
        <View key="2"><Nutrition navigation={navigation} /></View>
        <View key="3"><MedicineTab navigation={navigation} /></View>
        <View key="4"><MenstrualTab navigation={navigation} /></View>
        <View key="5"><MenstrualTab navigation={navigation} /></View>
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
    position: "absolute",
    top: 0,       
    left: 0,    
    right: 0,     
    zIndex: 10,   
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 12,
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
    tabBarWrapper: {
        position: "absolute",
        top: 50,
        left: 0,
        right: 0,
        zIndex: 10,
        backgroundColor: "#FFFFFF",
    },
    tabBarContent: {
        paddingHorizontal: 8,
        paddingTop: 6,
        paddingBottom: 0,
        flexDirection: "row",
        gap: 6,
    },
  tabPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 50,
    backgroundColor: "#FFFFFF",
  },
  tabPillNutritionActive: {
    // Nutrition active has no background fill per Figma
    backgroundColor: "transparent",
  },
});