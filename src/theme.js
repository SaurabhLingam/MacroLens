/**
 * theme.js — Single source of truth for design tokens.
 * Import `C` in any screen instead of defining a local copy.
 *
 * Color decisions:
 *  - bg / border / textSub: reconciled to the Nutrition.jsx values
 *    (#F2F6F3, #E4EDE7, #3D5C47) which are used across the most screens.
 *  - primaryLight: #1DB954 (Nutrition/Plate/History) wins over #16aa16
 *    (AddDiet/DietDash/Scan/SetGoal) — the former is more consistent.
 *  - All accent + semantic colours unified from the superset across all files.
 */
export const C = {
  // Backgrounds
  bg: "#F2F6F3",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FBF9",

  // Borders
  border: "#E4EDE7",

  // Primary (green)
  primary: "#0A7A3E",
  primaryMid: "#14A855",
  primaryLight: "#1DB954",
  primaryDark: "#064D27",
  primaryGhost: "#E8F5EE",

  // Text
  text: "#0D1F16",
  textSub: "#3D5C47",
  textMuted: "#7EA98A",

  // Accent — blue
  blue: "#2563EB",
  blueLight: "#EFF6FF",

  // Accent — orange
  orange: "#EA580C",
  orangeLight: "#FFF4EE",

  // Accent — emerald
  emerald: "#059669",
  emeraldLight: "#ECFDF5",

  // Accent — amber
  amber: "#D97706",
  amberLight: "#FFFBEB",

  // Accent — purple
  purple: "#9333EA",
  purpleLight: "#FAF5FF",

  // Semantic — danger
  danger: "#DC2626",
  dangerLight: "#FEF2F2",
};