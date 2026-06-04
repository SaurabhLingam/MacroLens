import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../components/TextWrapper";
import shared, { getTopOffset } from "./wellnessStyles";

export default function WellnessHeader({ onBack, style }) {
  const topOffset = getTopOffset();
  return (
    <View style={[shared.headerBlock, { paddingTop: topOffset }, style]}>
      <View style={shared.headerRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={shared.backBtn}
          onPress={onBack}
        >
          <Ionicons name="arrow-back" size={25} color="#5A3FB8" />
        </TouchableOpacity>
        <View style={shared.titleWrap}>
          <Text weight="700" style={shared.headerTitle}>
            Health Wellness
          </Text>
          <Text weight="400" style={shared.headerSubtitle}>
            Build healthy habits, one day at a time.
          </Text>
        </View>
      </View>
    </View>
  );
}
