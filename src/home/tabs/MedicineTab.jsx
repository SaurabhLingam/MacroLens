// src/home/tabs/MedicineTab.jsx
import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Text } from "../../components/TextWrapper";
import { C } from "../../theme";

export default function MedicineTab() {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <Text style={styles.emoji}>💊</Text>
        <Text weight="700" style={styles.title}>Medicine</Text>
        <Text style={styles.sub}>Coming soon</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
    gap: 10,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  emoji: { fontSize: 48 },
  title: { fontSize: 20, color: C.text },
  sub: { fontSize: 14, color: C.textMuted },
});
