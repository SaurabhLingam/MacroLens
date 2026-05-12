import { toNumber } from "../utils";
const GROQ_API_URL =
  process.env.EXPO_PUBLIC_GROQ_API_URL ||
  process.env.EXPO_PUBLIC_GROK_API_URL ||
  "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_MODEL =
  process.env.EXPO_PUBLIC_GROQ_MODEL ||
  process.env.EXPO_PUBLIC_GROK_MODEL ||
  DEFAULT_GROQ_VISION_MODEL;
const GROQ_API_KEY =
  process.env.EXPO_PUBLIC_GROQ_API_KEY ||
  process.env.EXPO_PUBLIC_GROK_API_KEY;

const SCAN_SYSTEM_PROMPT =
  "You are a nutrition assistant. Return only valid JSON. " +
  "Analyze the meal image and estimate nutrition per visible item.";

const SCAN_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    mealName: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          serving: { type: "string" },
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          confidence: { type: "number" },
        },
        required: ["name", "serving", "calories", "protein", "carbs", "fat"],
      },
    },
    totals: {
      type: "object",
      additionalProperties: false,
      properties: {
        calories: { type: "number" },
        protein: { type: "number" },
        carbs: { type: "number" },
        fat: { type: "number" },
      },
      required: ["calories", "protein", "carbs", "fat"],
    },
  },
  required: ["items", "totals"],
};



const normalizeItem = (item, index) => ({
  id: item?.id || `scan_item_${Date.now()}_${index}`,
  name: String(item?.name || "Unknown item"),
  serving: String(item?.serving || "1 serving"),
  calories: toNumber(item?.calories),
  protein: toNumber(item?.protein),
  carbs: toNumber(item?.carbs),
  fat: toNumber(item?.fat),
  confidence: toNumber(item?.confidence, 0.65),
});

const calculateTotals = (items) => ({
  calories: Number(
    items.reduce((sum, item) => sum + toNumber(item.calories), 0).toFixed(1),
  ),
  protein: Number(
    items.reduce((sum, item) => sum + toNumber(item.protein), 0).toFixed(1),
  ),
  carbs: Number(
    items.reduce((sum, item) => sum + toNumber(item.carbs), 0).toFixed(1),
  ),
  fat: Number(items.reduce((sum, item) => sum + toNumber(item.fat), 0).toFixed(1)),
});

const normalizePayload = (payload) => {
  const items = Array.isArray(payload?.items)
    ? payload.items.map(normalizeItem).filter((item) => item.name.trim().length > 0)
    : [];

  const derivedTotals = calculateTotals(items);
  const totals = payload?.totals
    ? {
        calories: toNumber(payload.totals.calories, derivedTotals.calories),
        protein: toNumber(payload.totals.protein, derivedTotals.protein),
        carbs: toNumber(payload.totals.carbs, derivedTotals.carbs),
        fat: toNumber(payload.totals.fat, derivedTotals.fat),
      }
    : derivedTotals;

  return {
    mealName: String(payload?.mealName || "Detected meal"),
    items,
    totals,
  };
};

const extractContentText = (content) => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .join("\n");
  }

  return "";
};

const stripCodeFence = (value) =>
  String(value || "")
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

const parseJsonFromText = (value) => {
  if (value && typeof value === "object") {
    return value;
  }

  const text = stripCodeFence(value);
  try {
    return JSON.parse(text);
  } catch (parseError) {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch (innerParseError) {
      return null;
    }
  }
};

const formatApiError = (status, payload) => {
  const apiMessage =
    payload?.error?.message ||
    payload?.error ||
    payload?.message ||
    `Groq request failed with status ${status}`;
  return String(apiMessage);
};

const shouldRetryWithoutSchema = (message, status) => {
  if (status !== 400) return false;
  const lowered = String(message || "").toLowerCase();
  return (
    lowered.includes("response_format") ||
    lowered.includes("json_schema") ||
    lowered.includes("unsupported")
  );
};

const shouldRetryWithVisionModel = (message, status, model) => {
  if (status !== 400) return false;
  if (!model || model === DEFAULT_GROQ_VISION_MODEL) return false;

  const lowered = String(message || "").toLowerCase();
  return (
    lowered.includes("message should be string") ||
    lowered.includes("content should be string") ||
    lowered.includes("content must be a string") ||
    lowered.includes("messages") ||
    lowered.includes("image_url")
  );
};

const postToGroq = async (requestBody) => {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  const rawResponseText = await response.text();

  let parsedBody = {};
  if (rawResponseText) {
    try {
      parsedBody = JSON.parse(rawResponseText);
    } catch (error) {
      const parsingError = new Error(
        `Groq returned invalid JSON (${response.status}).`,
      );
      parsingError.status = response.status;
      throw parsingError;
    }
  }

  if (!response.ok) {
    const apiError = new Error(formatApiError(response.status, parsedBody));
    apiError.status = response.status;
    throw apiError;
  }

  return parsedBody;
};

const buildRequestBody = ({ model, base64Image, mimeType, includeSchema }) => {
  const body = {
    model,
    temperature: 0.1,
    max_completion_tokens: 1200,
    messages: [
      {
        role: "system",
        content: SCAN_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Return this exact JSON shape: " +
              "{mealName, items:[{name, serving, calories, protein, carbs, fat, confidence}], totals:{calories, protein, carbs, fat}}.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
  };

  if (!includeSchema) {
    return body;
  }

  return {
    ...body,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "meal_scan_result",
        strict: true,
        schema: SCAN_OUTPUT_SCHEMA,
      },
    },
  };
};

const requestWithSchemaFallback = async ({ model, base64Image, mimeType }) => {
  const schemaBody = buildRequestBody({
    model,
    base64Image,
    mimeType,
    includeSchema: true,
  });

  try {
    return await postToGroq(schemaBody);
  } catch (error) {
    if (!shouldRetryWithoutSchema(error?.message, error?.status)) {
      throw error;
    }

    const noSchemaBody = buildRequestBody({
      model,
      base64Image,
      mimeType,
      includeSchema: false,
    });
    return postToGroq(noSchemaBody);
  }
};

export const analyzeMealImageWithGroq = async ({
  base64Image,
  mimeType = "image/jpeg",
}) => {
  if (!GROQ_API_KEY) {
    throw new Error(
      "Missing EXPO_PUBLIC_GROQ_API_KEY. Add it in your Expo environment.",
    );
  }

  if (!base64Image) {
    throw new Error("No image payload was provided for LLM analysis.");
  }

  let parsedBody;
  try {
    parsedBody = await requestWithSchemaFallback({
      model: GROQ_MODEL,
      base64Image,
      mimeType,
    });
  } catch (error) {
    if (
      !shouldRetryWithVisionModel(error?.message, error?.status, GROQ_MODEL)
    ) {
      throw error;
    }

    parsedBody = await requestWithSchemaFallback({
      model: DEFAULT_GROQ_VISION_MODEL,
      base64Image,
      mimeType,
    });
  }

  const rawContent = parsedBody?.choices?.[0]?.message?.content;
  const contentText = extractContentText(rawContent);
  const parsedContent = parseJsonFromText(contentText);

  if (!parsedContent) {
    throw new Error("Could not parse LLM JSON output from Groq.");
  }

  return normalizePayload(parsedContent);
};