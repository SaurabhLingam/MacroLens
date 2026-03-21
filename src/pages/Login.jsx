// src/pages/Login.jsx
import React, { useState, useRef } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../components/TextWrapper";

const { width, height } = Dimensions.get("window");
const isSmallScreen = width < 380;

const AUTH_KEY = "nutritionAuthUser";

// Floating leaf decoration
const Leaf = ({ style }) => <View style={[styles.leaf, style]} />;

const InputField = ({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  error,
  rightIcon,
  onRightIconPress,
}) => {
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };
  const onBlur = () => {
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? "#ef4444" : "#e2e8f0", "#16aa16"],
  });

  return (
    <View style={styles.fieldWrapper}>
      <Animated.View style={[styles.inputContainer, { borderColor }]}>
        <Feather
          name={icon}
          size={18}
          color="#94a3b8"
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.textInput}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType || "default"}
          autoCapitalize="none"
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon}>
            <Feather name={rightIcon} size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </Animated.View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const Login = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const buttonScale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(buttonScale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  const pressOut = () =>
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();

  const validate = () => {
    const newErrors = {};
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email))
      newErrors.email = "Enter a valid email";
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // Check if user exists in storage
      const raw = await AsyncStorage.getItem(AUTH_KEY);
      if (raw) {
        const users = JSON.parse(raw);
        const found = users.find(
          (u) =>
            u.email.toLowerCase() === email.toLowerCase() &&
            u.password === password,
        );
        if (found) {
          await AsyncStorage.setItem("nutritionOnboardingComplete", "true");
          await AsyncStorage.setItem(
            "nutritionCurrentUser",
            JSON.stringify(found),
          );
          navigation.reset({ index: 0, routes: [{ name: "Nutrition" }] });
        } else {
          setErrors({ general: "Invalid email or password" });
        }
      } else {
        setErrors({ general: "No account found. Please sign up first." });
      }
    } catch (e) {
      setErrors({ general: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Background */}
      <LinearGradient
        colors={["#004918", "#016b22", "#02a030"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative leaves */}
      <Leaf style={styles.leaf1} />
      <Leaf style={styles.leaf2} />
      <Leaf style={styles.leaf3} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Brand */}
          <View style={styles.brandSection}>
            <View style={styles.logoCircle}>
              <Ionicons name="nutrition" size={36} color="#16aa16" />
            </View>
            <Text weight="800" style={styles.brandName}>
              MacroLense
            </Text>
            <Text style={styles.brandTagline}>
              Your personal nutrition companion
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text weight="800" style={styles.cardTitle}>
              Welcome back
            </Text>
            <Text style={styles.cardSubtitle}>
              Sign in to continue your journey
            </Text>

            {errors.general ? (
              <View style={styles.generalError}>
                <Feather name="alert-circle" size={14} color="#ef4444" />
                <Text style={styles.generalErrorText}>{errors.general}</Text>
              </View>
            ) : null}

            <InputField
              icon="mail"
              placeholder="Email address"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setErrors((e) => ({ ...e, email: "", general: "" }));
              }}
              keyboardType="email-address"
              error={errors.email}
            />

            <InputField
              icon="lock"
              placeholder="Password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setErrors((e) => ({ ...e, password: "", general: "" }));
              }}
              secureTextEntry={!showPassword}
              error={errors.password}
              rightIcon={showPassword ? "eye-off" : "eye"}
              onRightIconPress={() => setShowPassword(!showPassword)}
            />

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                activeOpacity={1}
                onPressIn={pressIn}
                onPressOut={pressOut}
                onPress={handleLogin}
                disabled={loading}
              >
                <LinearGradient
                  colors={["#16aa16", "#0d7d0d"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loginBtn}
                >
                  {loading ? (
                    <Feather name="loader" size={20} color="#fff" />
                  ) : (
                    <Text weight="700" style={styles.loginBtnText}>
                      Sign In
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.signupRow}
              onPress={() => navigation.navigate("NutritionSignup")}
              activeOpacity={0.7}
            >
              <Text style={styles.signupPrompt}>Don't have an account? </Text>
              <Text weight="700" style={styles.signupLink}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default Login;

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },

  leaf: {
    position: "absolute",
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.06)",
    transform: [{ rotate: "45deg" }],
  },
  leaf1: { width: 180, height: 180, top: -40, right: -50 },
  leaf2: { width: 120, height: 120, bottom: 100, left: -30 },
  leaf3: { width: 80, height: 80, top: height * 0.3, right: 20 },

  brandSection: {
    alignItems: "center",
    marginBottom: 36,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  brandName: {
    fontSize: isSmallScreen ? 28 : 32,
    color: "#fff",
    letterSpacing: 1,
  },
  brandTagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: isSmallScreen ? 20 : 28,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  cardTitle: {
    fontSize: isSmallScreen ? 22 : 26,
    color: "#111827",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 24,
  },

  generalError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    gap: 6,
  },
  generalErrorText: {
    fontSize: 13,
    color: "#ef4444",
    flex: 1,
  },

  fieldWrapper: { marginBottom: 14 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
  },
  rightIcon: { padding: 4 },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
    marginLeft: 4,
  },

  loginBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#16aa16",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  loginBtnText: {
    color: "#fff",
    fontSize: 17,
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
  dividerText: { fontSize: 13, color: "#9ca3af" },

  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signupPrompt: { fontSize: 14, color: "#6b7280" },
  signupLink: { fontSize: 14, color: "#16aa16" },
});
