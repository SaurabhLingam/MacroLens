/**
 * AddCustomFood.jsx
 * - Groq API (llama-3.3-70b) estimates macros from food name + ingredients
 * - Portion multipliers applied (Small 0.75×, Medium 1×, Large 1.4×)
 * - Saves to AsyncStorage under today's mealType log (same shape as AddDiet)
 * - Green LinearGradient buttons matching SetGoal
 */

import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import Svg, { Circle, G } from "react-native-svg";
import { Text } from "../components/TextWrapper";
import { C } from "../theme";
import {
  getTodayKey,
  createEmptyLog,
  ensureMealsShape,
  parseJsonSafe,
  normalizeMealType,
} from "../utils";

const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const STATUS_BAR_H = Platform.OS === "ios" ? 56 : (StatusBar.currentHeight ?? 38) + 8;
const PURPLE = "#553FB5";

const PORTION_MULTIPLIER = { Small: 0.75, Medium: 1.0, Large: 1.4 };
const MEAL_TYPES = ["Breakfast", "Lunch", "Snacks", "Dinner"];
const PORTIONS   = ["Small", "Medium", "Large"];

// ── Groq estimation ───────────────────────────────────────────────────────────
async function estimateMacros(foodName, ingredients) {
  const prompt = `You are a professional nutritionist. Estimate the macronutrients for ONE standard serving of the following dish.

Dish: ${foodName}
Ingredients: ${ingredients.join(", ")}

Reply ONLY with a valid JSON object, no markdown, no explanation:
{"calories": <number>, "protein": <number>, "carbs": <number>, "fats": <number>}

All values are in grams except calories. Be realistic for Indian/common dishes.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 120,
    }),
  });

  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  const clean = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);
  return {
    calories: Math.round(Number(parsed.calories)),
    protein:  Math.round(Number(parsed.protein)),
    carbs:    Math.round(Number(parsed.carbs)),
    fats:     Math.round(Number(parsed.fats)),
  };
}

// ── Save to AsyncStorage ──────────────────────────────────────────────────────
async function saveToLog(mealType, item) {
  const key = getTodayKey();
  const raw = await AsyncStorage.getItem(key);
  const log = raw ? parseJsonSafe(raw, createEmptyLog(key)) : createEmptyLog(key);
  ensureMealsShape(log);

  log.meals[mealType] = [...(log.meals[mealType] || []), item];

  const all = Object.values(log.meals).flat();
  log.totalCalories = all.reduce((s, x) => s + (x.calories || 0) * (x.quantity || 1), 0);
  log.totalProtein  = all.reduce((s, x) => s + (x.protein  || 0) * (x.quantity || 1), 0);
  log.totalCarbs    = all.reduce((s, x) => s + (x.carbs    || 0) * (x.quantity || 1), 0);
  log.totalFat      = all.reduce((s, x) => s + (x.fat      || 0) * (x.quantity || 1), 0);

  await AsyncStorage.setItem(key, JSON.stringify(log));
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
const DonutChart = ({ protein, carbs, fats, calories }) => {
  const size = 72, sw = 8;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const total = protein + carbs + fats || 1;
  const pDash = (protein / total) * circ;
  const cDash = (carbs   / total) * circ;
  const fDash = (fats    / total) * circ;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#4A90E2" strokeWidth={sw}
            strokeDasharray={`${pDash} ${circ - pDash}`} strokeDashoffset={0} />
          <Circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F5A623" strokeWidth={sw}
            strokeDasharray={`${cDash} ${circ - cDash}`} strokeDashoffset={-pDash} />
          <Circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E05A5A" strokeWidth={sw}
            strokeDasharray={`${fDash} ${circ - fDash}`} strokeDashoffset={-(pDash + cDash)} />
        </G>
      </Svg>
      <View style={{ alignItems: "center" }}>
        <Text weight="800" style={s.donutNum}>{calories}</Text>
        <Text style={s.donutLabel}>Cal</Text>
      </View>
    </View>
  );
};

// ── Tag Input ─────────────────────────────────────────────────────────────────
const TagInput = ({ tags, onAddTag, onRemoveTag }) => {
  const [val, setVal] = useState("");
  const submit = () => {
    const t = val.trim();
    if (t && !tags.includes(t)) { onAddTag(t); setVal(""); }
  };
  return (
    <View style={s.tagBox}>
      <View style={s.tagsRow}>
        {tags.map((tag, i) => (
          <TouchableOpacity key={i} style={s.tag} onPress={() => onRemoveTag(tag)}>
            <Text style={s.tagTxt}>{tag}</Text>
            <Text style={s.tagX}>  ×</Text>
          </TouchableOpacity>
        ))}
        <TextInput
          style={s.tagInput}
          value={val}
          onChangeText={setVal}
          onSubmitEditing={submit}
          placeholder={tags.length === 0 ? "Type and press return…" : ""}
          placeholderTextColor="#BDBDBD"
          returnKeyType="done"
          blurOnSubmit={false}
        />
      </View>
      <Text style={s.helixLink}>Add HELIX Recommendations</Text>
    </View>
  );
};

// ── Results Sheet ─────────────────────────────────────────────────────────────
const ResultsSheet = ({ visible, onClose, foodName, macros, routeMealType, onAdd }) => {
  const [quantity,  setQuantity]  = useState(1);
  const [portion,   setPortion]   = useState("Medium");
  const [mealType,  setMealType]  = useState(routeMealType || "Breakfast");
  const [saving,    setSaving]    = useState(false);

  const mult = PORTION_MULTIPLIER[portion];
  const cal  = Math.round(macros.calories * mult * quantity);
  const pro  = Math.round(macros.protein  * mult * quantity);
  const carb = Math.round(macros.carbs    * mult * quantity);
  const fat  = Math.round(macros.fats     * mult * quantity);

  const handleAdd = async () => {
    setSaving(true);
    try {
      await saveToLog(mealType, {
        id:       `custom_${Date.now()}`,
        name:     foodName,
        calories: Math.round(macros.calories * mult),
        protein:  Math.round(macros.protein  * mult),
        carbs:    Math.round(macros.carbs    * mult),
        fat:      Math.round(macros.fats     * mult),
        quantity,
      });
      onAdd();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.sheetHandle} />

        {/* Title + qty */}
        <View style={s.sheetTitleRow}>
          <View style={{ flex: 1 }}>
            <Text weight="700" style={s.sheetTitle}>{foodName}</Text>
            <Text style={s.sheetSub}>Estimated nutrition · tap portion to adjust</Text>
          </View>
          <View style={s.qtyRow}>
            <TouchableOpacity style={s.qtyBtn} onPress={() => setQuantity(q => Math.max(1, q - 1))}>
              <Text style={s.qtyBtnTxt}>−</Text>
            </TouchableOpacity>
            <Text weight="700" style={s.qtyNum}>{quantity}</Text>
            <TouchableOpacity style={s.qtyBtn} onPress={() => setQuantity(q => q + 1)}>
              <Text style={s.qtyBtnTxt}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Portion */}
        <View style={s.portionRow}>
          {PORTIONS.map(p => (
            <TouchableOpacity
              key={p}
              style={[s.portionBtn, portion === p && s.portionBtnOn]}
              onPress={() => setPortion(p)}
            >
              <Text style={[s.portionTxt, portion === p && s.portionTxtOn]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Macros */}
        <Text weight="700" style={s.macroTitle}>Macronutrients</Text>
        <View style={s.macroRow}>
          <View style={s.macroItems}>
            {[["Protein", pro, "#4A90E2"], ["Carbs", carb, "#F5A623"], ["Fats", fat, "#E05A5A"]].map(
              ([lbl, val, col]) => (
                <View key={lbl} style={s.macroItem}>
                  <Text weight="600" style={[s.macroLbl, { color: col }]}>{lbl}</Text>
                  <Text style={s.macroVal}>{val}g</Text>
                </View>
              )
            )}
          </View>
          <DonutChart protein={pro} carbs={carb} fats={fat} calories={cal} />
        </View>

        {/* Meal type */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {MEAL_TYPES.map(m => (
            <TouchableOpacity
              key={m}
              style={[s.mealBtn, mealType === m && s.mealBtnOn]}
              onPress={() => setMealType(m)}
            >
              <Text style={[s.mealTxt, mealType === m && s.mealTxtOn]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Add button — green gradient matching SetGoal */}
        <TouchableOpacity
          style={s.addBtn}
          onPress={handleAdd}
          disabled={saving}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={["#93D056", "#35A329"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={s.addBtnInner}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text weight="700" style={s.addBtnTxt}>+ Add to {mealType}</Text>
            }
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AddCustomFoodScreen() {
  const navigation  = useNavigation();
  const route       = useRoute();
  const mealType    = normalizeMealType(route.params?.mealType);

  const [foodName,     setFoodName]     = useState("");
  const [ingredients,  setIngredients]  = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [macros,       setMacros]       = useState(null);
  const [showSheet,    setShowSheet]    = useState(false);

  const canCalculate = foodName.trim().length > 0 && ingredients.length > 0;

  const handleCalculate = async () => {
    if (!canCalculate) return;
    setLoading(true);
    setError("");
    try {
      const result = await estimateMacros(foodName, ingredients);
      setMacros(result);
      setShowSheet(true);
    } catch (e) {
      console.error(e);
      setError("Couldn't estimate nutrition. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Feather name="arrow-left" size={18} color={PURPLE} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text weight="800" style={s.headerTitle}>Add Custom Food</Text>
              <Text style={s.headerSub}>
                Enter details of your meal and ingredients to estimate nutrition.
              </Text>
            </View>
          </View>

          {/* Food Name */}
          <Text weight="600" style={s.label}>Food Name</Text>
          <TextInput
            style={s.textInput}
            value={foodName}
            onChangeText={setFoodName}
            placeholder="Eg: Vegetable Poha"
            placeholderTextColor="#BDBDBD"
          />

          {/* Ingredients */}
          <Text weight="600" style={[s.label, { marginTop: 20 }]}>Add Ingredients</Text>
          <TagInput
            tags={ingredients}
            onAddTag={t  => setIngredients(prev => [...prev, t])}
            onRemoveTag={t => setIngredients(prev => prev.filter(i => i !== t))}
          />

          {/* Error */}
          {error ? <Text style={s.errorTxt}>{error}</Text> : null}

          {/* Calculate button — green gradient */}
          <TouchableOpacity
            style={[s.calcBtn, !canCalculate && { opacity: 0.45 }]}
            onPress={handleCalculate}
            disabled={!canCalculate || loading}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={["#93D056", "#35A329"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={s.calcBtnInner}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text weight="700" style={s.calcBtnTxt}>Calculate Calories</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {macros && (
        <ResultsSheet
          visible={showSheet}
          onClose={() => setShowSheet(false)}
          foodName={foodName}
          macros={macros}
          routeMealType={mealType}
          onAdd={() => {
            setShowSheet(false);
            navigation.goBack();
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: "#fff" },
  container: { paddingHorizontal: 20, paddingBottom: 60 },

  // Header
  header:      { flexDirection: "row", alignItems: "flex-start", paddingTop: STATUS_BAR_H - 20, paddingBottom: 24 },
  backBtn:     { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 2 },
  headerTitle: { fontSize: 18, color: PURPLE },
  headerSub:   { fontSize: 12, color: "#888", marginTop: 2 },

  // Form
  label:     { fontSize: 13, color: "#333", marginBottom: 8 },
  textInput: { borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: "#222", backgroundColor: "#FAFAFA" },

  // Tags
  tagBox:   { borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 8, padding: 10, backgroundColor: "#FAFAFA", minHeight: 90, justifyContent: "space-between" },
  tagsRow:  { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 },
  tag:      { flexDirection: "row", alignItems: "center", backgroundColor: "#EDE9FF", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tagTxt:   { color: PURPLE, fontSize: 12 },
  tagX:     { color: PURPLE, fontSize: 13, fontWeight: "700" },
  tagInput: { fontSize: 13, color: "#222", minWidth: 80, padding: 0, paddingVertical: 4 },
  helixLink:{ textAlign: "center", color: PURPLE, fontSize: 12, marginTop: 8 },

  // Error
  errorTxt: { color: "#E05A5A", fontSize: 12, marginTop: 12, textAlign: "center" },

  // Calculate button
  calcBtn:      { borderRadius: 14, overflow: "hidden", marginTop: 32 },
  calcBtnInner: { paddingVertical: 15, alignItems: "center" },
  calcBtnTxt:   { color: "#fff", fontSize: 15 },

  // Sheet
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet:      { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", padding: 24, paddingBottom: 36 },
  sheetHandle:{ width: 40, height: 4, backgroundColor: "#E0E0E0", borderRadius: 2, alignSelf: "center", marginBottom: 20 },

  sheetTitleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  sheetTitle:    { fontSize: 17, color: "#1A1A1A" },
  sheetSub:      { fontSize: 12, color: "#888", marginTop: 2, maxWidth: 200 },

  // Qty
  qtyRow:    { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  qtyBtn:    { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: "#DDD", alignItems: "center", justifyContent: "center" },
  qtyBtnTxt: { fontSize: 16, color: "#333", lineHeight: 20 },
  qtyNum:    { fontSize: 15, color: "#222", minWidth: 16, textAlign: "center" },

  // Portion
  portionRow:  { flexDirection: "row", gap: 8, marginBottom: 20 },
  portionBtn:  { flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: "center", backgroundColor: "#F5F5F5" },
  portionBtnOn:{ backgroundColor: "#D6EFFF" },
  portionTxt:  { fontSize: 13, color: "#777" },
  portionTxtOn:{ color: "#2A7FD4", fontWeight: "700" },

  // Macros
  macroTitle: { fontSize: 13, color: "#333", marginBottom: 12 },
  macroRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  macroItems: { flexDirection: "row", gap: 20 },
  macroItem:  { alignItems: "flex-start" },
  macroLbl:   { fontSize: 13 },
  macroVal:   { fontSize: 13, color: "#333", marginTop: 2 },
  donutNum:   { fontSize: 16, color: "#222", lineHeight: 18 },
  donutLabel: { fontSize: 10, color: "#888", lineHeight: 12 },

  // Meal type
  mealBtn:  { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#E0E0E0", marginRight: 8, backgroundColor: "#FFF" },
  mealBtnOn:{ backgroundColor: "#EDE9FF", borderColor: PURPLE },
  mealTxt:  { fontSize: 13, color: "#777" },
  mealTxtOn:{ color: PURPLE, fontWeight: "600" },

  // Add button
  addBtn:      { borderRadius: 14, overflow: "hidden" },
  addBtnInner: { paddingVertical: 15, alignItems: "center" },
  addBtnTxt:   { color: "#fff", fontSize: 15 },
});