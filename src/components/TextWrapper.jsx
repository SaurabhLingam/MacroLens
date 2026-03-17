import React, { useEffect } from "react";
import { Text as RNText, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Outfit_100Thin,
  Outfit_200ExtraLight,
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  Outfit_900Black,
} from "@expo-google-fonts/outfit";

const fontMap = {
  100: "Outfit_100Thin",
  200: "Outfit_200ExtraLight",
  300: "Outfit_300Light",
  400: "Outfit_400Regular",
  500: "Outfit_500Medium",
  600: "Outfit_600SemiBold",
  700: "Outfit_700Bold",
  800: "Outfit_800ExtraBold",
  900: "Outfit_900Black",
};

// Keep splash screen visible while fonts load
try {
  SplashScreen.preventAutoHideAsync();
} catch (e) {
  // SplashScreen may already be hidden
}

export const useAppFonts = () => {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_100Thin,
    Outfit_200ExtraLight,
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
  });

  const [splashHidden, setSplashHidden] = React.useState(false); // Track if SplashScreen.hideAsync has been called

  useEffect(() => {
    if ((fontsLoaded || fontError) && !splashHidden) {
      setTimeout(async () => {
        try {
          await SplashScreen.hideAsync();
        } catch (error) {
          console.warn("Error hiding splash screen:", error);
        }
        setSplashHidden(true);
      }, 0);
    }
  }, [fontsLoaded, fontError, splashHidden]);

  return fontsLoaded || !!fontError;
};

const Text = ({
  style,
  weight,
  size,
  children,
  heading = false,
  color,
  ...props
}) => {
  // Extract fontSize from style to determine if it's a heading
  const flatStyle = Array.isArray(style)
    ? Object.assign({}, ...style)
    : style || {};

  // Restore permissive heading behavior: allow inline overrides while keeping sensible defaults
  const fontSize = size || flatStyle.fontSize || 14;

  // Auto-detect headings based on fontSize or explicit heading prop
  const isHeading = heading || fontSize >= 18;

  // Default weight logic: headings should be bold (700), others medium (500)
  const defaultWeight = isHeading ? 700 : weight !== undefined ? weight : 400;
  const finalWeight = weight !== undefined ? weight : defaultWeight;
  const fontFamily = fontMap[finalWeight] || fontMap[400];

  // Prefer explicit color props/style; otherwise use sensible default for headings
  const textColor =
    color || flatStyle.color || (isHeading ? "#1E293B" : "#111827");
  const textLineHeight = flatStyle.lineHeight || Math.round(fontSize * 1.25);

  // No console logs in production or dev to avoid noisy output

  return (
    <RNText
      style={[
        style,
        { fontFamily, fontSize, color: textColor, lineHeight: textLineHeight },
      ]}
      allowFontScaling={true}
      {...props}
    >
      {children}
    </RNText>
  );
};

// Gradient Button Component
const GradientButton = ({
  children,
  onPress,
  style,
  contentStyle,
  textStyle,
  textWeight = 700,
  textSize = 16,
  textColor = "#FFF",
  activeOpacity = 0.8,
  gradientColors = ["#B148FF", "#F6339B", "#9914F9"],
  paddingVertical,
  paddingHorizontal,
  ...props
}) => {
  const small = textSize <= 13;
  const finalPaddingVertical =
    paddingVertical !== undefined ? paddingVertical : small ? 8 : 20;
  const finalPaddingHorizontal =
    paddingHorizontal !== undefined ? paddingHorizontal : small ? 12 : 30;

  const renderLabel = React.isValidElement(children) ? (
    children
  ) : (
    <Text
      weight={textWeight}
      size={textSize}
      color={textColor}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {children}
    </Text>
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={activeOpacity}
      style={style}
      {...props}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          {
            paddingVertical: finalPaddingVertical,
            paddingHorizontal: finalPaddingHorizontal,
            borderRadius: 14,
            justifyContent: "center",
            alignItems: "center",
          },
          textStyle,
          contentStyle,
        ]}
      >
        {renderLabel}
      </LinearGradient>
    </TouchableOpacity>
  );
};

export { Text, GradientButton };
