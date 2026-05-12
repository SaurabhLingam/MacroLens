

import AsyncStorage from "@react-native-async-storage/async-storage";
import { FOOD_DATA, MEAL_TO_CATEGORY, getFoodsByCategory } from "./foodData";
import INDIAN_FOODS_RAW from "./indian_foods.json";

// ─── Config ───────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_KEY_PREFIX = "fsc_";

// ─── Normalise indian_foods once at module load ───────────────────────────────

function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

const INDIAN_FOODS = INDIAN_FOODS_RAW.map((item, i) => ({
  id: `ind_${i}`,
  name: item.name,
  calories: round1(item.calories),
  protein: round1(item.protein),
  carbs: round1(item.carbs),
  fats: round1(item.fats),
  serving: "100g",
  category: null,
  fibre: item.fibre ?? null,
  sodium: item.sodium ?? null,
  _source: "indian",
}));

// ─── Local search ─────────────────────────────────────────────────────────────

function localSearch(query) {
  const q = query.toLowerCase();
  const fromFoodData = FOOD_DATA
    .filter((f) => f.name.toLowerCase().includes(q))
    .map((f) => ({ ...f, _source: "local" }));
  const fromIndian = INDIAN_FOODS.filter((f) =>
    f.name.toLowerCase().includes(q),
  );
  return [...fromFoodData, ...fromIndian];
}

function dedup(results) {
  const seen = new Set();
  return results.filter((f) => {
    const key = f.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const memCache = new Map();

async function getCached(key) {
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.ts < CACHE_TTL_MS) return mem.data;
  if (mem) memCache.delete(key);

  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY_PREFIX + key);
    if (raw) {
      const entry = JSON.parse(raw);
      if (Date.now() - entry.ts < CACHE_TTL_MS) {
        memCache.set(key, entry);
        return entry.data;
      }
    }
  } catch (_) {}
  return null;
}

async function setCache(key, data) {
  const entry = { data, ts: Date.now() };
  memCache.set(key, entry);
  try {
    await AsyncStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(entry));
  } catch (_) {}
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function searchFoodsAsync(query) {
  const q = query?.trim() ?? "";
  if (!q) return [];

  const cacheKey = q.toLowerCase();
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const results = dedup(localSearch(q));
  await setCache(cacheKey, results);
  return results;
}

export { FOOD_DATA, MEAL_TO_CATEGORY, getFoodsByCategory };