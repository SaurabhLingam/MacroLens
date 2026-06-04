import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Animated,
  TouchableOpacity,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "../components/TextWrapper";
import useParallaxHeader from "./useParallaxHeader";

import WellnessHeader from "./WellnessHeader";
import WellnessChipRow from "./WellnessChipRow";
import WellnessInsightsCard from "./WellnessInsightsCard";
import useWellnessAnimation from "./useWellnessAnimation";
import shared from "./wellnessStyles";

// ── Action card variants ──────────────────────────────────────────────────────
const GRADIENT_MAP = {
  log: ["#FFFFFF", "#E6FFE5"],
  scanFood: ["#FFFFFF", "#FFE7F4"],
  barcode: ["#FFFFFF", "#FFFBE7"],
};

const NutritionAction = ({
  title,
  subtitle,
  color,
  icon,
  variant,
  containerStyle,
}) => {
  const gradColors = GRADIENT_MAP[variant];
  if (!gradColors) return null;

  const isWrap = variant === "log" || variant === "barcode";
  const Inner = (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.actionCard, styles.logActionCard]}
    >
      <LinearGradient
        colors={gradColors}
        locations={[0, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.logActionGradient}
      >
        <View style={styles.actionTopRow}>
          <View style={styles.actionIcon}>{icon}</View>
        </View>
        <Text weight="600" style={[styles.actionTitle, { color }]}>
          {title}
        </Text>
        <Text weight="400" style={[styles.actionSub, { color }]}>
          {subtitle}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (isWrap) {
    return (
      <View style={[styles.logActionWrap, containerStyle]}>
        <View style={styles.logActionShadowLayer}>{Inner}</View>
      </View>
    );
  }
  return <View style={[styles.actionItem, containerStyle]}>{Inner}</View>;
};

const ACTION_DATA = [
  {
    title: "Log Meal",
    subtitle: "Today: 2 meals logged",
    color: "#18933B",
    variant: "log",
    icon: (
      <MaterialCommunityIcons
        name="silverware-fork-knife"
        size={16}
        color="#18933B"
      />
    ),
    containerStyle: { marginRight: 8 },
  },
  {
    title: "Scan Food",
    subtitle: "Today: 3 scanned",
    color: "#D63DAA",
    variant: "scanFood",
    icon: (
      <MaterialCommunityIcons
        name="food-apple-outline"
        size={16}
        color="#D63DAA"
      />
    ),
    containerStyle: { marginRight: 8 },
  },
  {
    title: "Scan Barcode",
    subtitle: "Last: Protein Bar",
    color: "#C67A06",
    variant: "barcode",
    icon: (
      <MaterialCommunityIcons name="barcode-scan" size={16} color="#C67A06" />
    ),
  },
];

// ── Main component ────────────────────────────────────────────────────────────
function NutritionWellnessSection(props) {
  const { onBack, hideHeader = false } = props;
  const { scrollHandler, heroAnimatedStyle } = useParallaxHeader();
  const { animatedStyle } = useWellnessAnimation(["Nutrition"]);

  return (
    <View style={shared.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={shared.scrollContent}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {!hideHeader && <WellnessHeader onBack={onBack} />}
        {!hideHeader && <WellnessChipRow currentCategory="Nutrition" navProps={props} />}

        <View style={heroAnimatedStyle}>
          <LinearGradient
            colors={[
              "#98D96D",
              "rgba(186,233,160,0.65)",
              "rgba(222,243,210,0.15)",
              "rgba(243,239,235,0)",
            ]}
            locations={[0, 0.35, 0.72, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.topSection}
          >
            <Image
              source={require("../../assets/fruits.webp")}
              style={styles.fruitOverlay}
              resizeMode="contain"
            />
            <Animated.View style={animatedStyle}>
              <View style={styles.goalHero}>
                <Text weight="700" style={styles.goalTitle}>
                  Track your meals to maintain{`\n`}a balanced diet.
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.goalButtonWrap}
                >
                  <LinearGradient
                    colors={["#8BD25B", "#4DBA36", "#3AA72A"]}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.goalButton}
                  >
                    <Text weight="600" style={styles.goalButtonText}>
                      Set Goal
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </LinearGradient>
        </View>

        <Animated.View style={animatedStyle}>
          <View style={styles.actionsRow}>
            {ACTION_DATA.map((a) => (
              <NutritionAction key={a.title} {...a} />
            ))}
          </View>
        </Animated.View>

        <Animated.View style={animatedStyle}>
          <View style={styles.dailyBlock}>
            <Text weight="700" style={styles.dailyTitle}>
              Your Daily Calorie Target
            </Text>
            <LinearGradient
              colors={["#EEF9FF", "#C3EAFF", "#DBF3FF"]}
              locations={[0.0016, 0.5, 0.9984]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.dailyCard}
            >
              <View style={styles.dailyIconWrap}>
                <Image
                  source={require("../../assets/foodplate.webp")}
                  style={styles.dailyPlateImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.dailyContent}>
                <Text weight="700" style={styles.dailyCardTitle}>
                  Know your daily calorie needs
                </Text>
                <Text weight="400" style={styles.dailyCardSub}>
                  Get personalized calorie intake based on your body & lifestyle
                </Text>
                <View style={styles.chipHintRow}>
                  {["Maintain weight", "Lose fat", "Build muscle"].map((t) => (
                    <View key={t} style={styles.hintChip}>
                      <Text weight="500" style={styles.hintChipText}>
                        {t}
                      </Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.calcBtnWrap}
                >
                  <LinearGradient
                    colors={["#B148FF", "#F6339B", "#9914F9"]}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.calcBtn}
                  >
                    <Text weight="600" style={styles.calcBtnText}>
                      Calculate Now
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

export default React.memo(NutritionWellnessSection);

const styles = StyleSheet.create({
  topSection: {
    marginTop: -2,
    paddingTop: 10,
    paddingBottom: 12,
    position: "relative",
    overflow: "hidden",
  },
  fruitOverlay: {
    position: "absolute",
    left: -21,
    top: 0,
    width: 400,
    height: 215,
    opacity: 0.6,
    zIndex: 1,
  },
  goalHero: {
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 160,
    paddingHorizontal: 20,
    zIndex: 2,
  },
  goalTitle: {
    fontSize: 16,
    lineHeight: 22,
    color: "#1D8B31",
    textAlign: "center",
  },
  goalButtonWrap: { marginTop: 0, borderRadius: 8, overflow: "hidden" },
  goalButton: {
    minWidth: 88,
    minHeight: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  goalButtonText: { color: "#FFFFFF", fontSize: 13 },
  actionsRow: {
    marginTop: 6,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "stretch",
    zIndex: 2,
  },
  actionItem: { flex: 1 },
  actionCard: {
    flex: 1,
    minHeight: 66,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
  },
  logActionWrap: {
    flex: 1,
    borderRadius: 12,
    shadowColor: "#BF7BB9",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  logActionShadowLayer: {
    flex: 1,
    borderRadius: 12,
    shadowColor: "#F3E6F2",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 1,
  },
  logActionCard: {
    backgroundColor: "transparent",
    borderColor: "#FFFFFF",
    overflow: "hidden",
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  logActionGradient: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
  },
  actionTopRow: { flexDirection: "row", alignItems: "center" },
  actionIcon: { marginBottom: 2 },
  actionTitle: { marginTop: 2, fontSize: 14, lineHeight: 18 },
  actionSub: { marginTop: 2, fontSize: 10, lineHeight: 12 },
  dailyBlock: { marginTop: 18 },
  dailyTitle: {
    fontSize: 16,
    lineHeight: 22,
    color: "#111111",
    marginBottom: 12,
    textAlign: "center",
  },
  dailyCard: {
    width: 356,
    minHeight: 120,
    alignSelf: "center",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#C7E5FC",
    flexDirection: "row",
    overflow: "hidden",
  },
  dailyIconWrap: { width: 120, alignItems: "center", justifyContent: "center" },
  dailyPlateImage: { width: 112, height: 112 },
  dailyContent: { flex: 1, paddingTop: 2, paddingRight: 4 },
  dailyCardTitle: {
    fontSize: 11,
    lineHeight: 14,
    color: "#111827",
    marginBottom: 2,
  },
  dailyCardSub: {
    fontSize: 9,
    lineHeight: 12,
    color: "#4B5563",
    marginBottom: 5,
  },
  chipHintRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  hintChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hintChipText: { fontSize: 8, color: "#4B5563" },
  calcBtnWrap: { borderRadius: 4, alignSelf: "flex-start", overflow: "hidden" },
  calcBtn: {
    minWidth: 88,
    height: 24,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  calcBtnText: {
    fontSize: 10,
    lineHeight: 11,
    color: "#FFFFFF",
    textAlign: "center",
  },
});
