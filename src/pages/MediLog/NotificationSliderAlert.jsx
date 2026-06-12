import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// ─── NotificationSliderAlert ──────────────────────────────────────────────────
// In-app banner that slides down from the top when a medicine reminder fires.
// Used as a fallback in Expo Go where system notifications are limited.

const NotificationSliderAlert = ({
  visible,
  title,
  message,
  onClose,
  durationMs = 4500,
}) => {
  const translateY = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef(null);

  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (!visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -140,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 16,
        mass: 0.9,
        stiffness: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    hideTimerRef.current = setTimeout(() => {
      onClose?.();
    }, durationMs);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [visible, durationMs]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.card}>
        {/* Left accent bar */}
        <View style={styles.accentBar} />

        {/* Icon */}
        <View style={styles.iconBubble}>
          <MaterialCommunityIcons name="pill" size={20} color="#0EA5B0" />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Animated.Text style={styles.title} numberOfLines={1}>
            {title || "Medicine Reminder"}
          </Animated.Text>
          <Animated.Text style={styles.message} numberOfLines={2}>
            {message || "Time to take your medicine."}
          </Animated.Text>
        </View>

        {/* Dismiss */}
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="close" size={18} color="#A0AEC0" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 52,
    left: 14,
    right: 14,
    zIndex: 9999,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0EA5B0",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: "#BAE6EA",
    overflow: "hidden",
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "#0EA5B0",
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#F0FAFB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "#BAE6EA",
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: "#1A2235",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 3,
  },
  message: {
    color: "#718096",
    fontSize: 12,
    lineHeight: 17,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#F7F9FC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
});

export default NotificationSliderAlert;