// ========================================
// ACTIVE MODEL
// ========================================

export const ACTIVE_MODEL = "groq"; 

// ========================================
// VALIDATION FUNCTIONS
// ========================================

export function isValidApiKey(apiKey) {
  // Check if key exists and is not a placeholder
  if (!apiKey || typeof apiKey !== "string") {
    return false;
  }

  const placeholders = [
    "your-",
    "your_",
    "xxx",
    "xxxxxx",
    "your-api-key",
    "your-openai-api-key",
    "your-anthropic-key",
    "your-custom-api-key",
    "placeholder",
    "not-set",
  ];

  const lowerKey = apiKey.toLowerCase();
  return !placeholders.some((placeholder) => lowerKey.includes(placeholder));
}

export function getAvailableModels() {
  // Return only models with valid API keys
  const available = [];

  for (const [key, config] of Object.entries(MODELS)) {
    if (isValidApiKey(config.apiKey)) {
      available.push({
        id: key,
        name: config.name,
        model: config.model,
        format: config.format,
        hasValidKey: true,
      });
    }
  }

  return available;
}

export function getFirstValidModel() {
  // Get first model with valid API key
  for (const [key, config] of Object.entries(MODELS)) {
    if (isValidApiKey(config.apiKey)) {
      return {
        id: key,
        ...config,
      };
    }
  }

  return null;
}

export function getModelConfig(modelId) {
  const config = MODELS[modelId];

  if (!config) {
    throw new Error(`Model "${modelId}" not found in config`);
  }

  if (!isValidApiKey(config.apiKey)) {
    throw new Error(
      `API key for "${modelId}" is not configured. Please add a valid API key in config.js`,
    );
  }

  return config;
}

// ========================================
// MODEL CONFIGURATIONS
// ========================================

export const MODELS = {

  groq: {
    name: "Groq (Llama 4 Scout)",
    apiKey: process.env.EXPO_PUBLIC_GROQ_API_KEY,
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    format: "openai",
    maxTokens: 2048,
    temperature: 0.7,
  },
};

// ========================================
// PROMPT CONFIGURATION
// ========================================

export const ANALYSIS_PROMPT = `
You are a comprehensive medicine information expert. Analyze this medicine package/label image and provide complete, accurate medical information.

STEP 1 - EXTRACT FROM IMAGE:
Carefully read and extract ALL visible text from the medicine package:

**Medicine Name**: Brand name (largest text on package)
**Generic Name**: Active ingredient (e.g., "Rabeprazole", "Paracetamol")
**Strength**: Dosage strength (e.g., "20 mg", "500mg")
**Form**: Tablet, Capsule, Syrup, Injection, etc.
**Manufacturer**: Company name (look for "Mfd by:" or company logo)
**MRP**: Maximum Retail Price (look for "MRP", "M.R.P.", include ₹ symbol and quantity)
**Batch Number**: Look for "Batch No.", "B.No.", "Lot No." (EXACTLY as printed)
**Manufacturing Date**: Look for "Mfg Date", "MFG", "DOM" (EXACT format: "Apr-2023", "04/2023")
**Expiry Date**: Look for "Exp Date", "EXP", "Expiry" (EXACT format: "Mar-2027", "03/2027")

STEP 2 - PROVIDE COMPREHENSIVE MEDICAL INFORMATION:
Based on the medicine's active ingredient identified, provide detailed, accurate medical information from your knowledge:

**Uses & Indications**
**Benefits**
**How It Works**
**Dosage & Directions**
**Side Effects**
**Warnings & Precautions**
**Contraindications**
**Drug/Food Interactions**
**Storage Instructions**

Return ONLY valid JSON in this EXACT format:
{
  "name": "",
  "genericName": "",
  "strength": "",
  "form": "",
  "manufacturer": "",
  "mrp": "",
  "batchNo": "",
  "mfgDate": "",
  "expDate": "",
  "schedule": "N/A",
  "uses": [],
  "benefits": [],
  "howItWorks": "",
  "dosageInstructions": "",
  "howToTake": "",
  "sideEffects": [],
  "warnings": [],
  "contraindications": [],
  "interactions": [],
  "storage": "",
  "childSafety": "Keep out of reach of children",
  "disclaimer": "Consult your doctor before taking this medicine. This information is for reference only."
}

CRITICAL RULES:
1. Extract package data EXACTLY as printed
2. Provide accurate, evidence-based medical information
3. Use arrays for lists (minimum 3–5 items)
4. Be specific and detailed
5. Always include child safety and disclaimer
6. Return PURE JSON only (no markdown, no code blocks)
7. If medicine cannot be identified, extract visible text only
`;
