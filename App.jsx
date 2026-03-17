// App.jsx  — updated with Login / Signup replacing Intro + PersonalDetails
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import DietDash from "./src/home/DietDash";
import AddDiet from "./src/pages/AddDiet";
import NutritionPlate from "./src/pages/Plate";
import Scan from "./src/pages/Scan";
import BarcodeScanner from "./src/pages/BarcodeScanner";
import Nutrition from "./src/pages/Nutrition";
import SetGoal from "./src/pages/SetGoal";
import History from "./src/pages/History";
import Login from "./src/pages/Login";
import Signup from "./src/pages/Signup";
import { Text } from "./src/components/TextWrapper";
import { useAppFonts } from "./src/components/TextWrapper";

const Stack = createNativeStackNavigator();
const AUTH_KEY = "nutritionOnboardingComplete";

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

// Slide transition config
const slideFromRight = {
  animation: "slide_from_right",
  animationDuration: 280,
};

export default function App() {
  const appReady = useAppFonts();
  const [initialRouteName, setInitialRouteName] = useState(null);

  useEffect(() => {
    let mounted = true;
    const resolveRoute = async () => {
      try {
        const done = await AsyncStorage.getItem(AUTH_KEY);
        if (!mounted) return;
        setInitialRouteName(done === "true" ? "Nutrition" : "NutritionLogin");
      } catch {
        if (!mounted) return;
        setInitialRouteName("NutritionLogin");
      }
    };
    resolveRoute();
    return () => {
      mounted = false;
    };
  }, []);

  if (!appReady || !initialRouteName) return null;

  return (
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
        {/* ── Auth ── */}
        <Stack.Screen
          name="NutritionLogin"
          component={Login}
          options={{ animation: "fade" }}
        />
        <Stack.Screen name="NutritionSignup" component={Signup} />

        {/* ── App ── */}
        <Stack.Screen
          name="Nutrition"
          component={Nutrition}
          options={{ animation: "fade" }}
        />
        <Stack.Screen name="NutritionDietDash" component={DietDash} />
        <Stack.Screen name="NutritionAddDiet" component={AddDiet} />
        <Stack.Screen name="NutritionPlate" component={NutritionPlate} />
        <Stack.Screen name="NutritionScan" component={Scan} />
        <Stack.Screen name="NutritionBarcode" component={BarcodeScanner} />
        <Stack.Screen name="NutritionSetGoal" component={SetGoal} />
        <Stack.Screen name="NutritionHistory" component={History} />
        <Stack.Screen name="Consultation" component={Consultation} />
      </Stack.Navigator>
    </NavigationContainer>
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
