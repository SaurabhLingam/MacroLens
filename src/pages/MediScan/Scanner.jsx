import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Animated,
  Easing,
  StatusBar,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "../../components/TextWrapper";

const { width, height } = Dimensions.get("window");

// ─── Design tokens (purple system) ───────────────────────────────────────────
const P = {
  primary:     "#553FB5",
  primaryDark: "#3D2D8F",
  primaryMid:  "#6B52C8",
  primarySoft: "#8B72E0",
  ghostLight:  "#F0ECFF",
  ghostBorder: "#C8B8FF",
  teal:        "#22C5AC",        // kept for scan-line — high contrast on camera
  tealGlow:    "#6EFCE8",
  amber:       "#F59E0B",
  coral:       "#FF6B6B",
  white:       "#FFFFFF",
  black:       "#000000",
  overlay:     "rgba(18,10,46,0.72)",   // purple-tinted dark
};

const FRAME_SIZE = width * 0.72;
const CORNER_LEN = 28;
const CORNER_W   = 3.5;
const SIDE_W     = (width - FRAME_SIZE) / 2;

// ─── Component ────────────────────────────────────────────────────────────────
const ScannerScreen = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [hasPermission, setHasPermission] = useState(null);
  const [flashMode, setFlashMode]   = useState("off");
  const [capturing, setCapturing]   = useState(false);
  const cameraRef = useRef(null);

  const scanLineAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim     = useRef(new Animated.Value(1)).current;
  const fadeAnim      = useRef(new Animated.Value(0)).current;
  const slideUpAnim   = useRef(new Animated.Value(40)).current;
  const captureScale  = useRef(new Animated.Value(1)).current;
  const cornerFlash   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      const { status } = await requestPermission();
      setHasPermission(status === "granted");
    })();
  }, []);

  useEffect(() => {
    if (!hasPermission) return;

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideUpAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: FRAME_SIZE - 4, duration: 2000,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0, duration: 2000,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(cornerFlash, {
          toValue: 0.35, duration: 1400,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(cornerFlash, {
          toValue: 1, duration: 1400,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.14, duration: 1400,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1, duration: 1400,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ])
    ).start();
  }, [hasPermission]);

  const takePicture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    Animated.sequence([
      Animated.timing(captureScale, { toValue: 0.88, duration: 100, useNativeDriver: true }),
      Animated.spring(captureScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, base64: false });
      navigation.navigate("MediTrackResult", { imageUri: photo.uri });
    } catch {
      Alert.alert("Error", "Failed to capture image. Please try again.");
    } finally {
      setCapturing(false);
    }
  };

  const toggleFlash = () => setFlashMode((p) => (p === "off" ? "on" : "off"));

  // ── Permission: loading ───────────────────────────────────────────────────
  if (hasPermission === null) {
    return (
      <View style={s.permissionScreen}>
        <MaterialCommunityIcons name="camera-outline" size={48} color={P.primarySoft} />
        <Text style={s.permissionTitle}>Setting up camera…</Text>
      </View>
    );
  }

  // ── Permission: denied ────────────────────────────────────────────────────
  if (hasPermission === false) {
    return (
      <View style={s.permissionScreen}>
        <View style={s.permissionIconWrap}>
          <MaterialCommunityIcons name="camera-off-outline" size={44} color={P.coral} />
        </View>
        <Text weight="700" style={s.permissionTitle}>Camera Access Needed</Text>
        <Text style={s.permissionSub}>
          Allow camera access to scan your medicine packets
        </Text>
        <TouchableOpacity style={s.permissionBtn} onPress={requestPermission} activeOpacity={0.85}>
          <MaterialCommunityIcons name="shield-check-outline" size={18} color={P.white} />
          <Text weight="700" style={s.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.permissionBack}>
          <Text style={s.permissionBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main Scanner ──────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={flashMode === "on"}
      >
        {/* Dark overlay panels */}
        <View style={s.overlayTop} />
        <View style={s.overlayMiddleRow}>
          <View style={s.overlaySide} />

          {/* Scan frame */}
          <View style={s.scanFrame}>
            {/* Corner brackets */}
            {[
              { top: 0, left: 0,  borderTopWidth: CORNER_W,    borderLeftWidth: CORNER_W,   borderBottomWidth: 0, borderRightWidth: 0,  borderTopLeftRadius: 10 },
              { top: 0, right: 0, borderTopWidth: CORNER_W,    borderRightWidth: CORNER_W,  borderBottomWidth: 0, borderLeftWidth: 0,   borderTopRightRadius: 10 },
              { bottom: 0, left: 0,  borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W,  borderTopWidth: 0,    borderRightWidth: 0,  borderBottomLeftRadius: 10 },
              { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W, borderTopWidth: 0,    borderLeftWidth: 0,   borderBottomRightRadius: 10 },
            ].map((cs, i) => (
              <Animated.View
                key={i}
                style={[s.corner, cs, { opacity: cornerFlash, borderColor: P.primarySoft }]}
              />
            ))}

            {/* Animated scan line */}
            <Animated.View style={[s.scanLine, { transform: [{ translateY: scanLineAnim }] }]} />

            {/* Centre crosshair */}
            <View style={s.crosshairDot} />
          </View>

          <View style={s.overlaySide} />
        </View>
        <View style={s.overlayBottom} />

        {/* ── Top controls ─────────────────────────────────────────────── */}
        <Animated.View
          style={[s.topControls, { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }]}
        >
          <TouchableOpacity
            style={s.ctrlBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            accessibilityLabel="Close scanner"
          >
            <MaterialCommunityIcons name="close" size={22} color={P.white} />
          </TouchableOpacity>

          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text weight="700" style={s.liveBadgeText}>LIVE SCAN</Text>
          </View>

          <TouchableOpacity
            style={[s.ctrlBtn, flashMode === "on" && s.ctrlBtnFlashActive]}
            onPress={toggleFlash}
            activeOpacity={0.8}
            accessibilityLabel="Toggle flash"
          >
            <MaterialCommunityIcons
              name={flashMode === "on" ? "flash" : "flash-off"}
              size={22}
              color={flashMode === "on" ? P.amber : P.white}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Frame label ───────────────────────────────────────────────── */}
        <View style={s.frameLabelRow}>
          <View style={s.frameLabel}>
            <MaterialCommunityIcons name="pill" size={12} color={P.ghostBorder} />
            <Text style={s.frameLabelText}>Medicine Label</Text>
          </View>
        </View>

        {/* ── Bottom section ────────────────────────────────────────────── */}
        <Animated.View
          style={[
            s.bottomSection,
            { opacity: fadeAnim, transform: [{ translateY: Animated.multiply(slideUpAnim, -1) }] },
          ]}
        >
          {/* Tip chips */}
          <View style={s.tipsRow}>
            {[
              { icon: "lightbulb-on-outline", label: "Good lighting" },
              { icon: "focus-field",           label: "Stay focused" },
              { icon: "text-recognition",      label: "Clear text" },
            ].map((tip, i) => (
              <View key={i} style={s.tipChip}>
                <MaterialCommunityIcons name={tip.icon} size={11} color={P.ghostBorder} />
                <Text style={s.tipChipText}>{tip.label}</Text>
              </View>
            ))}
          </View>

          <Text style={s.instructionText}>Align medicine packet inside the frame</Text>

          {/* Capture row */}
          <View style={s.captureRow}>
            <View style={s.captureRowSide} />

            <View style={s.captureWrapper}>
              <Animated.View style={[s.captureRing, { transform: [{ scale: pulseAnim }] }]} />
              <Animated.View style={{ transform: [{ scale: captureScale }] }}>
                <TouchableOpacity
                  style={[s.captureBtn, capturing && s.captureBtnActive]}
                  onPress={takePicture}
                  activeOpacity={0.85}
                  disabled={capturing}
                  accessibilityLabel="Take photo"
                >
                  <LinearGradient
                    colors={capturing
                      ? [P.primaryMid, P.primaryDark]
                      : [P.primarySoft, P.primary, P.primaryDark]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={s.captureBtnInner}
                  >
                    <MaterialCommunityIcons
                      name={capturing ? "timer-sand" : "camera"}
                      size={30}
                      color={P.white}
                    />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>

            <View style={s.captureRowSide} />
          </View>

          <Text style={s.captureHint}>Tap to capture</Text>
        </Animated.View>
      </CameraView>
    </View>
  );
};

export default ScannerScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: P.black,
  },

  // ── Permission screens
  permissionScreen: {
    flex: 1,
    backgroundColor: "#110A2E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  permissionIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: "rgba(255,107,107,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 22,
    color: P.white,
    marginTop: 16,
    marginBottom: 10,
    textAlign: "center",
  },
  permissionSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 32,
  },
  permissionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: P.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  permissionBtnText: {
    color: P.white,
    fontSize: 15,
  },
  permissionBack: {
    marginTop: 18,
  },
  permissionBackText: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 13,
  },

  // ── Overlay panels
  overlayTop: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: (height - FRAME_SIZE) / 2,
    backgroundColor: P.overlay,
  },
  overlayMiddleRow: {
    position: "absolute",
    top: (height - FRAME_SIZE) / 2,
    left: 0, right: 0,
    height: FRAME_SIZE,
    flexDirection: "row",
  },
  overlaySide: {
    width: SIDE_W,
    backgroundColor: P.overlay,
  },
  overlayBottom: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    top: (height - FRAME_SIZE) / 2 + FRAME_SIZE,
    backgroundColor: P.overlay,
  },

  // ── Scan frame
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  corner: {
    position: "absolute",
    width: CORNER_LEN,
    height: CORNER_LEN,
  },
  scanLine: {
    position: "absolute",
    top: 0,
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: P.teal,
    shadowColor: P.tealGlow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    borderRadius: 1,
  },
  crosshairDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: P.primarySoft,
    opacity: 0.85,
    shadowColor: P.ghostBorder,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },

  // ── Frame label
  frameLabelRow: {
    position: "absolute",
    top: (height - FRAME_SIZE) / 2 + FRAME_SIZE + 12,
    left: 0, right: 0,
    alignItems: "center",
  },
  frameLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(139,114,224,0.18)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(139,114,224,0.32)",
  },
  frameLabelText: {
    fontSize: 11,
    color: P.ghostBorder,
    fontWeight: "600",
    letterSpacing: 0.4,
  },

  // ── Top controls
  topControls: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 44,
    left: 0, right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  ctrlBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(30,16,72,0.55)",
    borderWidth: 1,
    borderColor: "rgba(200,184,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlBtnFlashActive: {
    backgroundColor: "rgba(245,158,11,0.18)",
    borderColor: "rgba(245,158,11,0.4)",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(30,16,72,0.55)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(200,184,255,0.16)",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: P.teal,
    shadowColor: P.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  liveBadgeText: {
    fontSize: 11,
    color: P.white,
    letterSpacing: 1.2,
  },

  // ── Bottom section
  bottomSection: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 44 : 28,
    paddingTop: 20,
    paddingHorizontal: 24,
    backgroundColor: "rgba(22,12,56,0.78)",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    borderColor: "rgba(200,184,255,0.12)",
  },
  tipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  tipChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(139,114,224,0.14)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(200,184,255,0.2)",
  },
  tipChipText: {
    fontSize: 10,
    color: P.ghostBorder,
    fontWeight: "600",
  },
  instructionText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    letterSpacing: 0.2,
    marginBottom: 22,
  },
  captureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 10,
  },
  captureRowSide: {
    flex: 1,
  },
  captureWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 84,
    height: 84,
  },
  captureRing: {
    position: "absolute",
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: "rgba(139,114,224,0.45)",
  },
  captureBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.2)",
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  captureBtnActive: {
    opacity: 0.72,
  },
  captureBtnInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  captureHint: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 0.5,
  },
});