// App.jsx
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet, View, DeviceEventEmitter } from "react-native"; // ← added DeviceEventEmitter
import AsyncStorage from "@react-native-async-storage/async-storage";

import WellnessScreen from "./src/home/WellnessScreen";
import DietDash from "./src/home/DietDash";
import AddDiet from "./src/pages/AddDiet";
import NutritionPlate from "./src/pages/Plate";
import Scan from "./src/pages/Scan";
import BarcodeScanner from "./src/pages/BarcodeScanner";
import Nutrition from "./src/pages/Nutrition";
import SetGoal from "./src/pages/SetGoal";
import History from "./src/pages/History";
import MediLogDash      from "./src/pages/MediLog/MediLogDash";
import LogNewMedicine   from "./src/pages/MediLog/LogNewMedicine";
import MedHistory       from "./src/pages/MediLog/History";
import MedicineBox      from "./src/pages/MediLog/MedicineBox";
import MediTrack        from "./src/pages/MediScan/MedicineScanDash";
import MediTrackScanner from "./src/pages/MediScan/Scanner";
import MediTrackResult  from "./src/pages/MediScan/Result";
import CalorieCalculator from "./src/pages/CalorieCalculator";
import AddCustomFoodScreen from "./src/pages/AddCustomFood";
import { Text } from "./src/components/TextWrapper";
import { useAppFonts } from "./src/components/TextWrapper";
import NotificationSliderAlert from "./src/pages/MediLog/NotificationSliderAlert"; // ← added

const Stack = createNativeStackNavigator();
const GOAL_KEY = "calorieGoalData";

const Consultation = () => (
  <View style={styles.consultationContainer}>
    <Text weight="700" style={styles.consultationTitle}>
      Consultation
    </Text>
    <Text style={styles.consultationSubtitle}>
      Dietitian consultation screen coming soon.
    </Text>
  </View>
);

export default function App() {
  const appReady = useAppFonts();
  const [initialRouteName, setInitialRouteName] = useState(null);

  // ── In-app notification banner state ────────────────────────────────────────
  const [reminder, setReminder] = useState({ visible: false, title: "", message: "" }); // ← added

  useEffect(() => {
    const seedUser = async () => {
      await AsyncStorage.setItem("currentUser", "user@macrolens.app");
      const existing = await AsyncStorage.getItem("nutritionCurrentUser");
      if (!existing) {
        await AsyncStorage.setItem(
          "nutritionCurrentUser",
          JSON.stringify({ name: "User", email: "user@macrolens.app" })
        );
      }
    };
    seedUser();
  }, []);

  useEffect(() => {
    let mounted = true;
    const resolveRoute = async () => {
      try {
        const goalSet = await AsyncStorage.getItem(GOAL_KEY);
        if (!mounted) return;
        setInitialRouteName("Wellness");
      } catch {
        if (!mounted) return;
        setInitialRouteName("NutritionSetGoal");
      }
    };
    resolveRoute();
    return () => { mounted = false; };
  }, []);

  // ── Listen for in-app reminders emitted by notificationService ──────────────
  useEffect(() => {                                                               // ← added
    const sub = DeviceEventEmitter.addListener(
      "medtrack-in-app-reminder",
      ({ title, message }) => {
        setReminder({ visible: true, title, message });
      }
    );
    return () => sub.remove();
  }, []);

  if (!appReady || !initialRouteName) return null;

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator
          key={initialRouteName}
          initialRouteName={initialRouteName}
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 300,
          }}
        >
          <Stack.Screen
            name="Wellness"
            component={WellnessScreen}
            options={{ animation: "fade" }}
          />
          <Stack.Screen
            name="NutritionSetGoal"
            component={SetGoal}
            options={{ animation: "fade" }}
          />
          <Stack.Screen
            name="Nutrition"
            component={Nutrition}
            options={{ animation: "fade" }}
          />
          <Stack.Screen name="NutritionDietDash"  component={DietDash} />
          <Stack.Screen name="NutritionAddDiet"   component={AddDiet} />
          <Stack.Screen name="NutritionPlate"     component={NutritionPlate} />
          <Stack.Screen name="NutritionScan"      component={Scan} />
          <Stack.Screen name="NutritionBarcode"   component={BarcodeScanner} />
          <Stack.Screen name="NutritionHistory"   component={History} />
          <Stack.Screen name="Consultation"       component={Consultation} />
          <Stack.Screen name="CalorieCalculator"  component={CalorieCalculator} />
          <Stack.Screen name="AddCustomFood"      component={AddCustomFoodScreen} />
          <Stack.Screen name="MediLogDash"        component={MediLogDash} />
          <Stack.Screen name="LogNewMedicine"     component={LogNewMedicine} />
          <Stack.Screen name="MedHistory"         component={MedHistory} />
          <Stack.Screen name="MedicineBox"        component={MedicineBox} />
          <Stack.Screen name="MediTrack"          component={MediTrack} />
          <Stack.Screen name="MediTrackScanner"   component={MediTrackScanner} />
          <Stack.Screen name="MediTrackResult"    component={MediTrackResult} />
        </Stack.Navigator>
      </NavigationContainer>

      {/* ── In-app reminder banner — rendered above the navigator so it's always visible ── */}
      <NotificationSliderAlert                                                    // ← added
        visible={reminder.visible}
        title={reminder.title}
        message={reminder.message}
        onClose={() => setReminder((r) => ({ ...r, visible: false }))}
      />
    </>
  );
}

const styles = StyleSheet.create({
  consultationContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 24,
  },
  consultationTitle: {
    fontSize: 22,
    color: "#111827",
  },
  consultationSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
});