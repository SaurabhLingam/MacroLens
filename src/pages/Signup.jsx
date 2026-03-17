// src/pages/Signup.jsx
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

  const onFocus = () =>
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  const onBlur = () =>
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();

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
          autoCapitalize={icon === "user" ? "words" : "none"}
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

const PasswordStrength = ({ password }) => {
  const getStrength = () => {
    if (!password) return { level: 0, label: "", color: "#e5e7eb" };
    if (password.length < 6)
      return { level: 1, label: "Weak", color: "#ef4444" };
    if (password.length < 10 || !/[0-9]/.test(password))
      return { level: 2, label: "Fair", color: "#f97316" };
    if (/[^a-zA-Z0-9]/.test(password))
      return { level: 4, label: "Strong", color: "#16aa16" };
    return { level: 3, label: "Good", color: "#22c55e" };
  };
  const { level, label, color } = getStrength();
  if (!password) return null;

  return (
    <View style={styles.strengthWrapper}>
      <View style={styles.strengthBars}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.strengthBar,
              { backgroundColor: i <= level ? color : "#e5e7eb" },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.strengthLabel, { color }]}>{label}</Text>
    </View>
  );
};

const Signup = () => {
  const navigation = useNavigation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
    if (!name.trim()) newErrors.name = "Name is required";
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email))
      newErrors.email = "Enter a valid email";
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    if (!confirmPassword)
      newErrors.confirmPassword = "Please confirm your password";
    else if (password !== confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem(AUTH_KEY);
      const users = raw ? JSON.parse(raw) : [];

      const exists = users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase(),
      );
      if (exists) {
        setErrors({ email: "An account with this email already exists" });
        setLoading(false);
        return;
      }

      const newUser = {
        id: Date.now().toString(),
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        createdAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify([...users, newUser]));
      await AsyncStorage.setItem("nutritionOnboardingComplete", "true");
      await AsyncStorage.setItem(
        "nutritionCurrentUser",
        JSON.stringify(newUser),
      );

      navigation.reset({ index: 0, routes: [{ name: "Nutrition" }] });
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
      <LinearGradient
        colors={["#004918", "#016b22", "#02a030"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative */}
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.brandSection}>
            <View style={styles.logoCircle}>
              <Ionicons name="leaf" size={32} color="#16aa16" />
            </View>
            <Text weight="800" style={styles.brandName}>
              Create Account
            </Text>
            <Text style={styles.brandTagline}>
              Start your nutrition journey today
            </Text>
          </View>

          <View style={styles.card}>
            {errors.general ? (
              <View style={styles.generalError}>
                <Feather name="alert-circle" size={14} color="#ef4444" />
                <Text style={styles.generalErrorText}>{errors.general}</Text>
              </View>
            ) : null}

            <InputField
              icon="user"
              placeholder="Full name"
              value={name}
              onChangeText={(t) => {
                setName(t);
                setErrors((e) => ({ ...e, name: "" }));
              }}
              error={errors.name}
            />

            <InputField
              icon="mail"
              placeholder="Email address"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setErrors((e) => ({ ...e, email: "" }));
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
                setErrors((e) => ({ ...e, password: "" }));
              }}
              secureTextEntry={!showPassword}
              error={errors.password}
              rightIcon={showPassword ? "eye-off" : "eye"}
              onRightIconPress={() => setShowPassword(!showPassword)}
            />
            <PasswordStrength password={password} />

            <InputField
              icon="shield"
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                setErrors((e) => ({ ...e, confirmPassword: "" }));
              }}
              secureTextEntry={!showConfirm}
              error={errors.confirmPassword}
              rightIcon={showConfirm ? "eye-off" : "eye"}
              onRightIconPress={() => setShowConfirm(!showConfirm)}
            />

            <Animated.View
              style={{ transform: [{ scale: buttonScale }], marginTop: 8 }}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPressIn={pressIn}
                onPressOut={pressOut}
                onPress={handleSignup}
                disabled={loading}
              >
                <LinearGradient
                  colors={["#16aa16", "#0d7d0d"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.signupBtn}
                >
                  {loading ? (
                    <Feather name="loader" size={20} color="#fff" />
                  ) : (
                    <Text weight="700" style={styles.signupBtnText}>
                      Create Account
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              style={styles.loginRow}
              onPress={() => navigation.navigate("NutritionLogin")}
              activeOpacity={0.7}
            >
              <Text style={styles.loginPrompt}>Already have an account? </Text>
              <Text weight="700" style={styles.loginLink}>
                Sign In
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.terms}>
            By creating an account, you agree to our Terms of Service and
            Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default Signup;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: Platform.OS === "ios" ? 50 : 30,
  },

  blob: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  blob1: { width: 200, height: 200, top: -60, right: -60 },
  blob2: { width: 140, height: 140, bottom: 80, left: -50 },

  header: { flexDirection: "row", marginBottom: 24 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  brandSection: { alignItems: "center", marginBottom: 28 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  brandName: {
    fontSize: isSmallScreen ? 24 : 28,
    color: "#fff",
    letterSpacing: 0.5,
  },
  brandTagline: { fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 4 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: isSmallScreen ? 20 : 28,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
    marginBottom: 16,
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
  generalErrorText: { fontSize: 13, color: "#ef4444", flex: 1 },

  fieldWrapper: { marginBottom: 12 },
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
  textInput: { flex: 1, fontSize: 15, color: "#111827" },
  rightIcon: { padding: 4 },
  errorText: { fontSize: 12, color: "#ef4444", marginTop: 4, marginLeft: 4 },

  strengthWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    marginTop: -4,
    paddingHorizontal: 4,
  },
  strengthBars: { flexDirection: "row", gap: 4, flex: 1 },
  strengthBar: { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: "600", minWidth: 42 },

  signupBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16aa16",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  signupBtnText: { color: "#fff", fontSize: 17 },

  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
  },
  loginPrompt: { fontSize: 14, color: "#6b7280" },
  loginLink: { fontSize: 14, color: "#16aa16" },

  terms: {
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
