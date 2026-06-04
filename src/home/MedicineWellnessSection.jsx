import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  ImageBackground,
  TouchableOpacity,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "../components/TextWrapper";

import WellnessHeader from "./WellnessHeader";
import WellnessChipRow from "./WellnessChipRow";
import useWellnessAnimation from "./useWellnessAnimation";
import shared from "./wellnessStyles";

// ── Medicine-specific insights card (uses ImageBackground button) ─────────────
const MedicineInsightsCard = () => (
  <View style={styles.insightsCardWrap}>
    <View style={styles.insightsCardShadowLayer}>
      <ImageBackground
        source={require("../../assets/bg.webp")}
        style={styles.insightsCard}
        imageStyle={styles.insightsCardImage}
        resizeMode="cover"
      >
        <Text weight="700" style={shared.insightsTitle}>
          Helix Wellness Insights
        </Text>
        <Text weight="500" style={styles.insightsParagraph}>
          You are most active between 6 PM and 8 PM.{`\n`}
          Your longest workouts occur on weekends.{`\n`}
          Your current activity supports cardiovascular health.
        </Text>
        <TouchableOpacity activeOpacity={0.85} style={styles.insightsBtnWrap}>
          <ImageBackground
            source={require("../../assets/medicines.webp")}
            style={styles.insightsBtn}
            imageStyle={styles.insightsBtnImage}
            resizeMode="cover"
          >
            <LinearGradient
              colors={[
                "rgba(177,72,255,0.82)",
                "rgba(246,51,155,0.82)",
                "rgba(153,20,249,0.82)",
              ]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.insightsBtnOverlay}
            >
              <Text weight="600" style={styles.insightsBtnText}>
                View More
              </Text>
            </LinearGradient>
          </ImageBackground>
        </TouchableOpacity>
      </ImageBackground>
    </View>
  </View>
);

// ── Main component ────────────────────────────────────────────────────────────
function MedicineWellnessSection(props) {
  const { onBack, hideHeader = false } = props;
  const { animatedStyle } = useWellnessAnimation(["Medicine"], {
    startHidden: false,
  });

  return (
    <View style={shared.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 0 }}
      >
        {!hideHeader && <WellnessHeader onBack={onBack} />}
        {!hideHeader && <WellnessChipRow currentCategory="Medicine" navProps={props} />}

        <View style={styles.canvas}>
          <Image
            source={require("../../assets/medicines.webp")}
            style={styles.topFloatingImage}
            resizeMode="cover"
          />
          <MedicineInsightsCard />
          <Image
            source={require("../../assets/medicines2.webp")}
            style={styles.bottomFooterImage}
            resizeMode="cover"
          />
        </View>

        <Animated.View style={animatedStyle} />
      </ScrollView>
    </View>
  );
}

export default MedicineWellnessSection;

const styles = StyleSheet.create({
  canvas: {
    marginTop: -2,
    minHeight: 650,
    position: "relative",
    backgroundColor: "#F3EFEB",
    overflow: "hidden",
  },
  topFloatingImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    opacity: 0.5,
  },
  bottomFooterImage: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 105,
  },
  insightsCardWrap: {
    width: 323,
    minHeight: 129,
    alignSelf: "center",
    marginTop: 265,
    marginBottom: 10,
    borderRadius: 10,
    shadowColor: "#BF7BB9",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 2,
  },
  insightsCardShadowLayer: {
    width: "100%",
    minHeight: 129,
    borderRadius: 10,
    backgroundColor: "transparent",
    shadowColor: "#F3E6F2",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 1,
    overflow: "hidden",
  },
  insightsCard: {
    minHeight: 129,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  insightsCardImage: { borderRadius: 10, opacity: 0.65 },
  insightsParagraph: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  insightsBtnWrap: { marginTop: 10, borderRadius: 8, overflow: "hidden" },
  insightsBtn: {
    minHeight: 30,
    minWidth: 92,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  insightsBtnImage: { borderRadius: 8 },
  insightsBtnOverlay: {
    minHeight: 30,
    minWidth: 92,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  insightsBtnText: { fontSize: 12, color: "#FFFFFF", textAlign: "center" },
});
