import { StyleSheet, Platform, StatusBar } from "react-native";
import {
  HORIZONTAL_PADDING,
  CHIP_GAP,
  CHIP_WIDTH,
  CHIP_HEIGHT,
  SCREEN_BG,
} from "./wellnessConstants";

export const getTopOffset = () =>
  Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 10 : 18;

const ROW_H = CHIP_HEIGHT + 10; // pill height — hangs below chip into page

const shared = StyleSheet.create({
  // ── Screen ─────────────────────────────────────────────────────────────────
  screen: { flex: 1, backgroundColor: SCREEN_BG },
  scrollContent: { paddingBottom: 16 },

  // ── Header ─────────────────────────────────────────────────────────────────
  headerBlock: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    backgroundColor: SCREEN_BG,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  backBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  titleWrap: { flex: 1 },
  headerTitle: { fontSize: 19, lineHeight: 23, color: "#5C43BF" },
  headerSubtitle: {
    marginTop: 1,
    fontSize: 12,
    lineHeight: 15,
    color: "#1A1A1A",
  },

  // ── Chip row outer shell — only provides horizontal padding ────────────────
  chipRowContainer: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 2,
    backgroundColor: "transparent",
    zIndex: 12,
    overflow: "visible",
  },

  // ── chipRowInner — shared coordinate origin for pill AND FlatList ──────────
  // Both start at x=0 here, so index * CHIP_ITEM_WIDTH is exact.
  chipRowInner: {
    position: "relative",
    height: ROW_H,
  },

  // ── Pill OUTER — absolute position shell, native-driver safe ──────────────
  // Contains ONLY geometry + transform. No fill props here.
  // width/backgroundColor live on the INNER view (JS driver).
  slidingPillOuter: {
    position: "absolute",
    top: 0,
    left: 0,
    height: ROW_H,
    zIndex: 1,
    pointerEvents: "none",
  },

  // ── Pill INNER — JS-driver fill layer ─────────────────────────────────────
  // width + backgroundColor set dynamically via Animated.View style prop.
  slidingPillInner: {
    height: ROW_H,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },

  // ── FlatList content row ───────────────────────────────────────────────────
  chipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  // ── Each chip touchable slot ───────────────────────────────────────────────
  chipTouch: {
    width: CHIP_WIDTH,
    height: ROW_H,
    marginRight: CHIP_GAP,
    justifyContent: "flex-start",
    zIndex: 10,
  },

  // ── Active chip — transparent, label only ─────────────────────────────────
  activeChipContainer: {
    width: CHIP_WIDTH,
    height: ROW_H,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 10,
  },
  activeChipText: { fontSize: 11, textAlign: "center" },

  // ── Inactive chip ──────────────────────────────────────────────────────────
  inactiveChip: {
    width: "100%",
    height: CHIP_HEIGHT,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  inactiveChipText: { fontSize: 11, textAlign: "center" },

  // ── Insights card ──────────────────────────────────────────────────────────
  insightsCardWrap: {
    width: 323,
    height: 129,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 10,
    borderRadius: 10,
    shadowColor: "#BF7BB9",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  insightsCardShadowLayer: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    backgroundColor: "transparent",
    shadowColor: "#F3E6F2",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 1,
    overflow: "hidden",
  },
  insightsCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  insightsCardImage: { borderRadius: 10, opacity: 0.65 },
  insightsTitle: {
    fontSize: 18,
    lineHeight: 24,
    color: "#111111",
    textAlign: "center",
  },
  insightsSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  insightsBtnWrap: { marginTop: 10, borderRadius: 8, overflow: "hidden" },
  insightsBtn: {
    minHeight: 36,
    minWidth: 152,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  insightsBtnText: { fontSize: 13, color: "#FFFFFF", textAlign: "center" },
});

export default shared;
