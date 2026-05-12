/**
 * utils.js — Shared constants and utility functions.
 * Import from here instead of redefining in each screen.
 */
import { Camera } from "expo-camera";
// ── AsyncStorage keys ─────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  RECENT_FOODS: "recentFoods",
  CALORIE_GOAL: "calorieGoalData",
  CURRENT_USER: "nutritionCurrentUser",
  ONBOARDING_DONE: "nutritionOnboardingComplete",
  BARCODE_CACHE: "barcodeProductCache",
};

// ── Meal config ───────────────────────────────────────────────────────────
export const MEAL_TYPES = ["Breakfast", "Lunch", "Snacks", "Dinner"];

export const DEFAULT_MEALS = {
  Breakfast: [],
  Lunch: [],
  Snacks: [],
  Dinner: [],
};

// ── Limits ────────────────────────────────────────────────────────────────
export const MAX_RECENT_FOODS = 20;
export const MAX_BARCODE_CACHE = 80;

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Returns the AsyncStorage key for today's nutrition log.
 * Format: nutritionLog_YYYY-MM-DD
 */
export const getTodayKey = () => {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `nutritionLog_${y}-${m}-${d}`;
};

/**
 * Converts a value to a finite number, returning `fallback` if it isn't one.
 */
export const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Safely parses a JSON string. Returns `fallback` on any error.
 */
export const parseJsonSafe = (raw, fallback) => {
  try {
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
};

/**
 * Validates a meal type string, defaulting to "Snacks" if unrecognised.
 */
export const normalizeMealType = (value) =>
  MEAL_TYPES.includes(value) ? value : "Snacks";

export const createEmptyLog = (key) => ({
  date: key.replace("nutritionLog_", ""),
  totalCalories: 0,
  totalProtein: 0,
  totalCarbs: 0,
  totalFat: 0,
  meals: { ...DEFAULT_MEALS },
});

export const ensureMealsShape = (log) => {
  if (!log.meals || typeof log.meals !== "object") {
    log.meals = { ...DEFAULT_MEALS };
    return;
  }
  const legacy = Array.isArray(log.meals.Meal) ? log.meals.Meal : [];
  MEAL_TYPES.forEach((m) => {
    if (!Array.isArray(log.meals[m])) log.meals[m] = [];
  });
  if (legacy.length > 0) {
    log.meals.Snacks = [...legacy, ...log.meals.Snacks];
    delete log.meals.Meal;
  }
};

export const recalculateLogTotals = (log) => {
  const all = Object.values(log.meals).flat();
  log.totalCalories = all.reduce((s, x) => s + (x.calories || 0) * (x.quantity || 1), 0);
  log.totalProtein = all.reduce((s, x) => s + (x.protein || 0) * (x.quantity || 1), 0);
  log.totalCarbs = all.reduce((s, x) => s + (x.carbs || 0) * (x.quantity || 1), 0);
  log.totalFat = all.reduce((s, x) => s + (x.fat || 0) * (x.quantity || 1), 0);
};

export const readCameraPermission = async () => {
  if (typeof Camera.requestCameraPermissionsAsync === "function")
    return Camera.requestCameraPermissionsAsync();
  if (typeof Camera?.Camera?.requestCameraPermissionsAsync === "function")
    return Camera.Camera.requestCameraPermissionsAsync();
};

export const requestCameraPermissionApi = async () => {
  if (typeof Camera.requestCameraPermissionsAsync === "function")
    return Camera.requestCameraPermissionsAsync();
  if (typeof Camera?.Camera?.requestCameraPermissionsAsync === "function")
    return Camera.Camera.requestCameraPermissionsAsync();
};