import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  ImageBackground,
  Animated,
  TouchableOpacity,
} from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "../components/TextWrapper";
import useParallaxHeader from "./useParallaxHeader";

import WellnessHeader from "./WellnessHeader";
import WellnessChipRow from "./WellnessChipRow";
import WellnessInsightsCard from "./WellnessInsightsCard";
import useWellnessAnimation from "./useWellnessAnimation";
import shared from "./wellnessStyles";

const SUN_RAY_COUNT = 30;
const FITNESS_LAYER_TOP = "#FFD890";

// ── Action card ───────────────────────────────────────────────────────────────
const GRADIENT_VARIANT_MAP = {
  log: ["#FFFFFF", "#FDEEE2"],
  start: ["#FFFFFF", "#FDE7F1"],
  devices: ["#F8F4FF", "#E7EDFC"],
};

const FitnessAction = ({
  icon,
  title,
  subtitle,
  titleColor,
  variant,
  containerStyle,
}) => {
  const gradColors = GRADIENT_VARIANT_MAP[variant];
  return (
    <View style={[styles.logActionWrap, containerStyle]}>
      <View style={styles.logActionShadowLayer}>
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
            <View style={styles.actionIcon}>{icon}</View>
            <Text
              weight="600"
              style={[styles.actionTitle, { color: titleColor }]}
            >
              {title}
            </Text>
            <Text weight="400" style={styles.actionSub}>
              {subtitle}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ACTION_DATA = [
  {
    icon: <MaterialCommunityIcons name="run" size={14} color="#E67E22" />,
    title: "Log Activity",
    subtitle: "Last :45min walk",
    titleColor: "#E67E22",
    variant: "log",
    containerStyle: { marginRight: 8 },
  },
  {
    icon: (
      <MaterialCommunityIcons name="timer-refresh" size={14} color="#EF4444" />
    ),
    title: "Start Activity",
    subtitle: "Last :45min walk",
    titleColor: "#EF4444",
    variant: "start",
    containerStyle: { marginRight: 8 },
  },
  {
    icon: <Feather name="link" size={14} color="#2563EB" />,
    title: "Devices",
    subtitle: "1 Connected",
    titleColor: "#2563EB",
    variant: "devices",
  },
];

// ── Main component ────────────────────────────────────────────────────────────
function FitnessWellnessSection(props) {
  const { onBack, hideHeader = false } = props;
  const { scrollHandler } = useParallaxHeader();
  const { animatedStyle } = useWellnessAnimation(["Fitness"]);

  return (
    <View style={shared.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={shared.scrollContent}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {!hideHeader && <WellnessHeader onBack={onBack} />}
        {!hideHeader && <WellnessChipRow currentCategory="Fitness" navProps={props} />}

        <View style={styles.topSection}>
          <LinearGradient
            colors={[FITNESS_LAYER_TOP, "#FFF5FF"]}
            locations={[0.0207, 0.9793]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Hero card */}
          <View style={styles.heroWrap}>
            <Animated.View style={animatedStyle}>
              <LinearGradient
                colors={["#E48A22", "#F6AF55", "#FFE0BA"]}
                locations={[0, 0.6, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroContentLeft}>
                  <Text weight="700" style={styles.heroTitle}>
                    Hi, Sakshi!
                  </Text>
                  <Text weight="500" style={styles.heroSub}>
                    Set your Fitness Goal
                  </Text>
                  <View style={styles.heroBtnShadowOuter}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.heroBtnWrap}
                    >
                      <LinearGradient
                        colors={["#E99331", "#FFAF59", "#D47709"]}
                        locations={[0.0003, 0.5, 0.9997]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.heroBtn}
                      >
                        <Text weight="600" style={styles.heroBtnText}>
                          Set Goal
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.runnerIconWrap}>
                  <Image
                    source={require("../../assets/running.webp")}
                    style={styles.runnerCharacter}
                    resizeMode="contain"
                  />
                </View>

                {/* Sun burst */}
                <View style={styles.sunTrackClip}>
                  <View style={styles.sunBurstWrap}>
                    {Array.from({ length: SUN_RAY_COUNT }).map((_, idx) => {
                      const angle = -90 + (idx * 180) / (SUN_RAY_COUNT - 1);
                      return (
                        <View
                          key={`ray-${idx}`}
                          style={[
                            styles.sunRay,
                            {
                              transform: [
                                { rotate: `${angle}deg` },
                                { translateY: -56 },
                              ],
                            },
                          ]}
                        />
                      );
                    })}
                    <View style={styles.sunBurstOuter} />
                    <View style={styles.sunBurstInner} />
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
          </View>

          <Animated.View style={animatedStyle}>
            <View style={styles.actionsRow}>
              {ACTION_DATA.map((a) => (
                <FitnessAction key={a.title} {...a} />
              ))}
            </View>
          </Animated.View>
        </View>

        <Animated.View style={animatedStyle}>
          {/* Today's Activities */}
          <View style={styles.activitySection}>
            <Text weight="700" style={styles.activityTitle}>
              Today's Activities
            </Text>
            <Text weight="500" style={styles.activityEmpty}>
              No Activity Logged
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.logBtnWrap, styles.activityLogBtnWrap]}
            >
              <LinearGradient
                colors={["#F3BA64", "#D87E18"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.logBtn}
              >
                <Text weight="600" style={styles.logBtnText}>
                  Log Activity
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Connect Device */}
          <View style={styles.deviceCardWrap}>
            <LinearGradient
              colors={["#EBF2FF", "#9CBBF2"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.deviceCard}
            >
              <View style={styles.deviceTextWrap}>
                <Text weight="700" style={styles.deviceTitle}>
                  Connect Device
                </Text>
                <Text weight="400" style={styles.deviceSub}>
                  Log activities through devices
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.logBtnWrap}
                >
                  <LinearGradient
                    colors={["#F3BA64", "#D87E18"]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.logBtn}
                  >
                    <Text weight="600" style={styles.logBtnText}>
                      Log Activity
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              <View style={styles.watchWrap}>
                <Image
                  source={require("../../assets/watch.webp")}
                  style={styles.watchImage}
                  resizeMode="contain"
                />
              </View>
            </LinearGradient>
          </View>

          <WellnessInsightsCard style={{ marginTop: 12, marginBottom: 10 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

export default React.memo(FitnessWellnessSection);

const styles = StyleSheet.create({
  topSection: {
    marginTop: -2,
    paddingBottom: 12,
    backgroundColor: "transparent",
    position: "relative",
    overflow: "hidden",
  },
  heroWrap: { marginTop: 0, paddingHorizontal: 20, paddingTop: 28 },
  heroCard: {
    borderRadius: 24,
    minHeight: 188,
    paddingHorizontal: 18,
    paddingVertical: 16,
    overflow: "hidden",
    position: "relative",
  },
  heroContentLeft: { width: "56%" },
  heroTitle: { fontSize: 20, lineHeight: 26, color: "#141414" },
  heroSub: { marginTop: 4, fontSize: 18, lineHeight: 22, color: "#141414" },
  heroBtnShadowOuter: {
    marginTop: 28,
    alignSelf: "flex-start",
    borderRadius: 12,
    shadowColor: "#BF7BB9",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  heroBtnWrap: { borderRadius: 12, overflow: "hidden" },
  heroBtn: {
    minWidth: 136,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  heroBtnText: { fontSize: 14, lineHeight: 16, color: "#FFFFFF" },
  runnerIconWrap: { position: "absolute", top: 10, right: 34 },
  runnerCharacter: { width: 86, height: 114 },
  sunTrackClip: {
    position: "absolute",
    right: -11,
    bottom: -10,
    width: 208,
    height: 96,
    overflow: "hidden",
  },
  sunBurstWrap: {
    position: "absolute",
    left: 0,
    bottom: -104,
    width: 208,
    height: 208,
    alignItems: "center",
    justifyContent: "center",
  },
  sunRay: {
    position: "absolute",
    width: 4,
    height: 36,
    borderRadius: 2,
    backgroundColor: "#F9E3BA",
    top: "50%",
    left: "50%",
    marginLeft: -2,
    marginTop: -18,
  },
  sunBurstOuter: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 3,
    borderColor: "#F9E3BA",
    backgroundColor: "#F8AF41",
  },
  sunBurstInner: {
    position: "absolute",
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2,
    borderColor: "#F9E3BA",
    borderStyle: "dashed",
  },
  actionsRow: {
    marginTop: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "stretch",
  },
  logActionWrap: {
    flex: 1,
    borderRadius: 10,
    shadowColor: "#BF7BB9",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  logActionShadowLayer: {
    flex: 1,
    borderRadius: 10,
    shadowColor: "#F3E6F2",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 1,
  },
  actionCard: {
    flex: 1,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#F3F2FB",
    borderWidth: 1,
    borderColor: "#E6E7F0",
    paddingHorizontal: 8,
    paddingVertical: 6,
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
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionIcon: { marginBottom: 2 },
  actionTitle: { fontSize: 13, lineHeight: 17 },
  actionSub: { fontSize: 9, lineHeight: 12, color: "#6B7280" },
  activitySection: {
    marginTop: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  activityTitle: {
    width: "100%",
    textAlign: "left",
    fontSize: 19,
    lineHeight: 22,
    color: "#1F2937",
  },
  activityEmpty: { marginTop: 14, fontSize: 13, color: "#1F2937" },
  logBtnWrap: {
    marginTop: 8,
    borderRadius: 6,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  activityLogBtnWrap: { alignSelf: "center" },
  logBtn: {
    minWidth: 86,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  logBtnText: { fontSize: 10, color: "#FFFFFF" },
  deviceCardWrap: { marginTop: 16, paddingHorizontal: 16 },
  deviceCard: {
    width: 323,
    height: 105,
    alignSelf: "center",
    position: "relative",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    overflow: "hidden",
  },
  deviceTextWrap: { flex: 1, justifyContent: "center", paddingRight: 84 },
  deviceTitle: { fontSize: 23, lineHeight: 20, color: "#111827" },
  deviceSub: { marginTop: 3, fontSize: 11, lineHeight: 14, color: "#111827" },
  watchWrap: {
    position: "absolute",
    left: 259,
    top: -1,
    width: 61,
    height: 108,
    alignItems: "center",
    justifyContent: "center",
  },
  watchImage: { width: 61, height: 108 },
});
