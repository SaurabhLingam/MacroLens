// src/home/tabs/AllTab.jsx
import React from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Text } from "../../components/TextWrapper";
import { C } from "../../theme";

const MODULES = [
  { key: "physicalActivity", label: "Physical Activity", icon: "🏃", desc: "Track your steps & workouts", color: C.blueLight,   accent: C.blue },
  { key: "nutrition",        label: "Nutrition",          icon: "🥗", desc: "Log meals & calories",       color: C.primaryGhost, accent: C.primaryLight },
  { key: "medicine",         label: "Medicine",           icon: "💊", desc: "Manage your medications",    color: C.amberLight,   accent: C.amber },
  { key: "menstrual",        label: "Menstrual",          icon: "🌸", desc: "Track your cycle",           color: C.purpleLight,  accent: C.purple },
];

export default function AllTab({ onTabPress }) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text weight="600" style={styles.heading}>Your Wellness Overview</Text>

      {MODULES.map((mod, index) => (
        <TouchableOpacity
          key={mod.key}
          activeOpacity={0.8}
          onPress={() => onTabPress?.(index + 1)}
          style={[styles.card, { backgroundColor: mod.color, borderColor: mod.accent }]}
        >
          <Text style={styles.icon}>{mod.icon}</Text>
          <View style={styles.cardText}>
            <Text weight="600" style={[styles.cardTitle, { color: mod.accent }]}>
              {mod.label}
            </Text>
            <Text style={styles.cardDesc}>{mod.desc}</Text>
          </View>
          <Text style={[styles.arrow, { color: mod.accent }]}>→</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  heading: {
    fontSize: 16,
    color: C.text,
    marginBottom: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
  },
  icon: {
    fontSize: 28,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 15,
  },
  cardDesc: {
    fontSize: 12,
    color: C.textMuted,
  },
  arrow: {
    fontSize: 18,
    fontWeight: "600",
  },
});
