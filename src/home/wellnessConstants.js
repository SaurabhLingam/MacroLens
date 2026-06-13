import { Dimensions } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ── Layout tokens ──────────────────────────────────────────────────────────────
export const HORIZONTAL_PADDING = 10;
export const CHIP_GAP = 6;
export const CHIP_HEIGHT = 36;

// 6 chips, 5 gaps between them
const TOTAL_GAPS = CHIP_GAP * (6 - 1);
const USABLE_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - TOTAL_GAPS;
export const CHIP_WIDTH = Math.floor(USABLE_WIDTH / 6);
export const CHIP_ITEM_WIDTH = CHIP_WIDTH + CHIP_GAP; // stride between chip origins

export const SCREEN_BG = "#F3EFEB";

// ── Category definitions ───────────────────────────────────────────────────────
export const CATEGORIES = [
  { label: "All", color: "#CD8CFF" },
  { label: "Sleep", color: "#5B3DBA" },
  { label: "Nutrition", color: "#16A34A" },
  { label: "Fitness", color: "#EA580C" },
  { label: "Medicine", color: "#0D7A6F" },
  { label: "Mentrual", color: "#DB2777" },
];

// Active pill bg + label text colour per category
export const CHIP_ACTIVE_COLORS = {
  All: { bg: "#CD8CFF", text: "#FFFFFF" },
  Sleep: { bg: "#E4CCF7", text: "#4F3AAC" },
  Nutrition: { bg: "#97D96D", text: "#197C2E" },
  Fitness: { bg: "#FFD890", text: "#D87E18" },
  Medicine: { bg: "#D0EEEC", text: "#085C53" },
  Mentrual: { bg: "#F8D4EA", text: "#D63A9A" },
};

// Navigation prop name used by each sub-screen
export const NAV_PROP_MAP = {
  All: "onNavigateAll",
  Sleep: "onNavigateSleep",
  Nutrition: "onNavigateNutrition",
  Fitness: "onNavigateFitness",
  Medicine: "onNavigateMedicine",
  Mentrual: "onNavigateMentrual",
};
