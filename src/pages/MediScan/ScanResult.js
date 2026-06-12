import * as FileSystem from "expo-file-system/legacy";
import {
  ACTIVE_MODEL,
  MODELS,
  ANALYSIS_PROMPT,
  isValidApiKey,
  getAvailableModels,
  getFirstValidModel,
  getModelConfig,
} from "./config";

// ========================================
// API CALLER (via fetch) - Supports OpenAI-compatible APIs
// ========================================

async function callAPI(base64Image, modelConfig) {
  try {
    console.log("=== API Call ===");
    console.log(`Model: ${modelConfig.model}`);
    console.log(`Endpoint: ${modelConfig.baseUrl}`);
    console.log(`Provider: ${modelConfig.name}`);
    console.log(`Image size: ${base64Image.length} characters`);

    const messageContent = [
      {
        type: "text",
        text: ANALYSIS_PROMPT,
      },
      {
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${base64Image}`,
        },
      },
    ];

    const requestBody = {
      model: modelConfig.model,
      messages: [
        {
          role: "user",
          content: messageContent,
        },
      ],
      max_tokens: modelConfig.maxTokens || 1000,
      temperature: modelConfig.temperature || 0.3,
    };

    if (modelConfig.topP) requestBody.top_p = modelConfig.topP;

    console.log(
      "Request body (first 200 chars):",
      JSON.stringify(requestBody).substring(0, 200) + "...",
    );

    const response = await fetch(modelConfig.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${modelConfig.apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("HTTP status:", response.status);

    if (!response.ok) {
      let errorData = {};
      try {
        const text = await response.text();
        console.log("Error response body:", text);
        errorData = JSON.parse(text);
      } catch (e) {
        console.log("Could not parse error response");
      }
      const errorMessage =
        errorData.error?.message ||
        errorData.message ||
        `HTTP ${response.status}`;
      throw new Error(`API error: ${errorMessage}`);
    }

    const data = await response.json();
    console.log("API response received");
    console.log("Full response:", JSON.stringify(data).substring(0, 500));

    if (!data.choices || data.choices.length === 0) {
      throw new Error("API returned no response");
    }

    const rawText = data.choices[0]?.message?.content;
    if (!rawText) {
      throw new Error("API returned no data");
    }

    console.log("Raw AI response:", rawText);
    return rawText;
  } catch (error) {
    // Rethrow with clearer message for network failures
    if (
      error.message === "Network request failed" ||
      error.message?.includes("Network")
    ) {
      throw new Error(
        "Network request failed — check internet connection or API endpoint URL.",
      );
    }
    throw new Error(`API Error: ${error.message || "Unknown error"}`);
  }
}

// ========================================
// CONVERT LOCAL URI → BASE64
// Uses expo-file-system (works in React Native / Expo Go)
// ========================================

async function uriToBase64(imageUri) {
  console.log("Converting image to base64 via expo-file-system...");

  // expo-file-system can only read from local filesystem paths.
  // Camera / ImagePicker both return file:// URIs, so this works directly.
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: "base64",
  });

  console.log("Image converted, length:", base64.length);
  return base64;
}

// ========================================
// MAIN ANALYSIS FUNCTION
// ========================================

async function analyzeImage(imageUri) {
  try {
    // ── Step 1: Validate API configuration ────────────────────────────────
    console.log("=================================");
    console.log("Checking available models...");

    const availableModels = getAvailableModels();
    console.log(
      "Available models:",
      availableModels.map((m) => m.name),
    );

    if (availableModels.length === 0) {
      throw new Error(
        "No models with valid API keys found. Please configure at least one API key in config.js",
      );
    }

    // ── Step 2: Build model priority list ─────────────────────────────────
    const modelsToTry = [];

    try {
      const activeConfig = getModelConfig(ACTIVE_MODEL);
      modelsToTry.push({
        id: ACTIVE_MODEL,
        config: activeConfig,
        isPrimary: true,
      });
      console.log(`✅ Primary model: ${activeConfig.name}`);
    } catch (error) {
      console.warn(`⚠️ ${error.message}`);
    }

    for (const model of availableModels) {
      if (model.id !== ACTIVE_MODEL) {
        modelsToTry.push({
          id: model.id,
          config: MODELS[model.id],
          isPrimary: false,
        });
      }
    }

    console.log(`Total models to try: ${modelsToTry.length}`);
    console.log("=================================");

    // ── Step 3: Convert image once ────────────────────────────────────────
    const base64 = await uriToBase64(imageUri);

    // ── Step 4: Try each model ────────────────────────────────────────────
    const errors = [];

    for (let i = 0; i < modelsToTry.length; i++) {
      const { id, config, isPrimary } = modelsToTry[i];

      try {
        console.log("=================================");
        console.log(`Attempting model ${i + 1}/${modelsToTry.length}:`);
        console.log("Model ID:", id);
        console.log("Model Name:", config.name);
        console.log("Provider:", config.format);
        console.log("Type:", isPrimary ? "PRIMARY" : "FALLBACK");
        console.log("=================================");
        const startTime = Date.now();
        const rawText = await callAPI(base64, config);
        const elapsed = Date.now() - startTime; 
        console.log(`⏱️ Response time: ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s)`);
        console.log(`✅ Success with ${config.name}!`);
        console.log("Raw response length:", rawText.length);

        // ── Clean & parse JSON ──────────────────────────────────────────
        let cleanedText = rawText.trim();

        if (cleanedText.startsWith("```json")) {
          cleanedText = cleanedText
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "");
        } else if (cleanedText.startsWith("```")) {
          cleanedText = cleanedText.replace(/```\n?/g, "");
        }

        const jsonStart = cleanedText.indexOf("{");
        const jsonEnd = cleanedText.lastIndexOf("}");

        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error("No valid JSON found in response");
        }

        cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1);
        console.log("Cleaned JSON:", cleanedText);

        const parsed = JSON.parse(cleanedText);

        // ── Confidence score ────────────────────────────────────────────
        const extractedFields = [
          parsed.name,
          parsed.genericName,
          parsed.manufacturer,
          parsed.mrp,
          parsed.batchNo,
          parsed.mfgDate,
          parsed.expDate,
          parsed.strength,
          parsed.form,
        ];

        const filledFields = extractedFields.filter(
          (field) => field && field.trim() !== "",
        ).length;
        const confidencePercent = Math.round(
          (filledFields / extractedFields.length) * 100,
        );

        console.log(
          `📊 Confidence: ${confidencePercent}% (${filledFields}/${extractedFields.length} fields extracted)`,
        );

        const hasData =
          parsed.name ||
          parsed.genericName ||
          parsed.manufacturer ||
          parsed.mrp ||
          parsed.batchNo ||
          parsed.mfgDate ||
          parsed.expDate;

        if (!hasData) {
          console.warn(
            "⚠️ No data extracted from image — AI may not have seen the image properly",
          );
        }

        const displayName = [
          parsed.name,
          parsed.genericName ? `${parsed.genericName}` : "",
          parsed.strength ? `${parsed.strength}` : "",
          parsed.form ? `${parsed.form}` : "",
        ]
          .filter(Boolean)
          .join(" • ");

        // ── Return structured result ────────────────────────────────────
        return {
          medicine: {
            name: parsed.name || "",
            displayName: displayName || parsed.name || "",
            genericName: parsed.genericName || "",
            manufacturer: parsed.manufacturer || "",
            mrp: parsed.mrp || "",
            batchNo: parsed.batchNo || "",
            mfgDate: parsed.mfgDate || "",
            expDate: parsed.expDate || "",
            schedule: parsed.schedule || "N/A",
            confidence: `${confidencePercent}%`,
          },
          info: [
            {
              title: "Uses | Indications",
              content:
                parsed.uses && parsed.uses.length > 0
                  ? parsed.uses.map((use) => `• ${use}`)
                  : ["Consult package insert for usage information"],
            },
            {
              title: "Benefits",
              content:
                parsed.benefits && parsed.benefits.length > 0
                  ? parsed.benefits.map((benefit) => `• ${benefit}`)
                  : ["Consult your doctor for benefit information"],
            },
            {
              title: "How It Works",
              content: parsed.howItWorks
                ? [`• ${parsed.howItWorks}`]
                : ["Consult package insert for mechanism of action"],
            },
            {
              title: "Dosage & Directions",
              content: [
                parsed.dosageInstructions
                  ? `Dosage: ${parsed.dosageInstructions}`
                  : "Dosage: As prescribed by physician",
                parsed.howToTake
                  ? `How to take: ${parsed.howToTake}`
                  : "How to take: Follow doctor's instructions",
                "Duration: As directed by your doctor",
              ],
            },
            {
              title: "Side Effects",
              content:
                parsed.sideEffects && parsed.sideEffects.length > 0
                  ? parsed.sideEffects.map((effect) => `• ${effect}`)
                  : [
                      "• Consult package insert for side effects",
                      "• Report any unusual symptoms to your doctor",
                    ],
            },
            {
              title: "Warnings & Precautions",
              content:
                parsed.warnings && parsed.warnings.length > 0
                  ? parsed.warnings.map((warning) => `• ${warning}`)
                  : [
                      "• Consult your doctor before use",
                      "• Inform doctor of any existing medical conditions",
                    ],
            },
            {
              title: "Contraindications",
              content:
                parsed.contraindications && parsed.contraindications.length > 0
                  ? parsed.contraindications.map((contra) => `• ${contra}`)
                  : [
                      "• Do not use if allergic to any ingredient",
                      "• Consult package insert",
                    ],
            },
            {
              title: "Drug | Food Interactions",
              content:
                parsed.interactions && parsed.interactions.length > 0
                  ? parsed.interactions.map((interaction) => `• ${interaction}`)
                  : [
                      "• Inform doctor of all medications you are taking",
                      "• Avoid alcohol unless approved by doctor",
                    ],
            },
            {
              title: "Storage & Safety",
              content: [
                parsed.storage ||
                  "• Store at room temperature, away from light and moisture",
                parsed.childSafety || "• Keep out of reach of children",
                "• Do not use after expiry date",
                "• Store in original packaging",
              ],
            },
            {
              title: "⚠️ Important Medical Disclaimer",
              content: [
                "🔴 CONSULT YOUR DOCTOR BEFORE TAKING THIS MEDICINE",
                "• This information is for reference only",
                "• Always follow your doctor's prescription",
                "• Do not self-medicate",
                "• Report any adverse effects to your doctor immediately",
                "• Keep this medicine out of reach of children",
                parsed.disclaimer ||
                  "For any questions or concerns, consult your healthcare provider",
              ],
            },
          ],
        };
      } catch (error) {
        console.error(`❌ Failed with ${config.name}:`, error.message);
        errors.push({
          model: config.name,
          modelId: id,
          error: error.message,
        });

        if (i < modelsToTry.length - 1) {
          console.log(`Trying next model...`);
          continue;
        }
      }
    }

    throw new Error(
      `All ${modelsToTry.length} models failed. Errors: ${errors
        .map((e) => `${e.model}: ${e.error}`)
        .join(" | ")}`,
    );
  } catch (error) {
    console.error("Analysis error:", error);

    const availableModels = getAvailableModels();
    const errorDetails = [];

    if (
      error.message.includes("All") &&
      error.message.includes("models failed")
    ) {
      errorDetails.push(`Tried ${availableModels.length} model(s):`);
      availableModels.forEach((model, idx) => {
        errorDetails.push(`${idx + 1}. ${model.name} - Failed`);
      });
    } else {
      errorDetails.push(error.message || "Failed to analyze image");
    }

    const troubleshootSteps = [
      `Provider: ${availableModels[0]?.name || "Unknown"}`,
      `Available models: ${
        availableModels.map((m) => m.name).join(", ") || "None"
      }`,
      "Common issues:",
      "1. API key not configured — check config.js",
      "2. Invalid API key — verify your API key",
      "3. Rate limited — wait a few minutes and retry",
      "4. Network issue — check internet connection",
      "",
      "Solution: Check your API configuration in config.js!",
    ];

    return {
      medicine: {
        name: "",
        genericName: "",
        manufacturer: "",
        mrp: "",
        batchNo: "",
        mfgDate: "",
        expDate: "",
        confidence: "0%",
        schedule: "",
      },
      info: [
        {
          title: "❌ Analysis Failed",
          content: errorDetails,
        },
        {
          title: "💡 How to Fix",
          content: troubleshootSteps,
        },
      ],
    };
  }
}

export { analyzeImage };
