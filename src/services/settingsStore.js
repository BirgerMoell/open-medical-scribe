import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SETTINGS_FILE = "data/settings.json";

/**
 * Load saved settings from disk. Returns empty object if no file exists.
 */
export function loadSavedSettings() {
  try {
    const raw = readFileSync(SETTINGS_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Save settings overrides to disk. Merges with existing saved settings.
 */
export function saveSettings(patch) {
  const existing = loadSavedSettings();
  const merged = deepMerge(existing, patch);

  mkdirSync(dirname(SETTINGS_FILE), { recursive: true });
  writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2) + "\n");

  return merged;
}

/**
 * Apply saved settings on top of the loaded config object (mutates config).
 */
export function applySavedSettings(config) {
  const saved = loadSavedSettings();
  if (!saved || !Object.keys(saved).length) return;

  // Top-level simple values
  const topLevel = ["transcriptionProvider", "noteProvider", "defaultNoteStyle", "defaultSpecialty", "defaultCountry", "scribeMode"];
  for (const key of topLevel) {
    if (saved[key] !== undefined) config[key] = saved[key];
  }

  // Privacy
  if (saved.privacy) {
    if (saved.privacy.phiRedactionMode !== undefined) config.privacy.phiRedactionMode = saved.privacy.phiRedactionMode;
    if (typeof saved.privacy.redactBeforeApiCalls === "boolean") {
      config.privacy.redactBeforeApiCalls = saved.privacy.redactBeforeApiCalls;
    }
  }

  // Provider configs — apply all saved values including empty strings (to allow clearing)
  const providerSections = ["openai", "anthropic", "gemini", "ollama", "deepgram", "google", "berget", "whisper", "streaming"];
  for (const section of providerSections) {
    if (saved[section] && config[section]) {
      for (const [key, value] of Object.entries(saved[section])) {
        if (value !== undefined) {
          config[section][key] = value;
        }
      }
    }
  }

  // Auto-configure streaming provider when whisper-onnx is selected
  if (config.transcriptionProvider === "whisper-onnx") {
    config.streaming.transcriptionProvider = "whisper-stream";
  }
}

/**
 * Return a sanitized view of config for the settings API (masks API keys).
 */
export function configToSettingsResponse(config) {
  return {
    scribeMode: config.scribeMode,
    transcriptionProvider: config.transcriptionProvider,
    noteProvider: config.noteProvider,
    defaultNoteStyle: config.defaultNoteStyle,
    defaultSpecialty: config.defaultSpecialty,
    defaultCountry: config.defaultCountry,
    privacy: {
      phiRedactionMode: config.privacy.phiRedactionMode,
      redactBeforeApiCalls: config.privacy.redactBeforeApiCalls,
    },
    openai: {
      apiKey: maskKey(config.openai.apiKey),
      baseUrl: config.openai.baseUrl,
      transcribeModel: config.openai.transcribeModel,
      noteModel: config.openai.noteModel,
      hasKey: !!config.openai.apiKey,
    },
    anthropic: {
      apiKey: maskKey(config.anthropic.apiKey),
      baseUrl: config.anthropic.baseUrl,
      model: config.anthropic.model,
      hasKey: !!config.anthropic.apiKey,
    },
    gemini: {
      apiKey: maskKey(config.gemini.apiKey),
      model: config.gemini.model,
      hasKey: !!config.gemini.apiKey,
    },
    ollama: {
      baseUrl: config.ollama.baseUrl,
      model: config.ollama.model,
    },
    deepgram: {
      apiKey: maskKey(config.deepgram.apiKey),
      model: config.deepgram.model,
      hasKey: !!config.deepgram.apiKey,
    },
    google: {
      speechApiKey: maskKey(config.google.speechApiKey),
      speechModel: config.google.speechModel,
      hasKey: !!config.google.speechApiKey,
    },
    berget: {
      apiKey: maskKey(config.berget.apiKey),
      baseUrl: config.berget.baseUrl,
      transcribeModel: config.berget.transcribeModel,
      hasKey: !!config.berget.apiKey,
    },
    streaming: {
      transcriptionProvider: config.streaming.transcriptionProvider,
      diarizeSidecarUrl: config.streaming.diarizeSidecarUrl,
      diarizeOnEnd: config.streaming.diarizeOnEnd,
      whisperModel: config.streaming.whisperModel,
      whisperLanguage: config.streaming.whisperLanguage,
      whisperIntervalMs: config.streaming.whisperIntervalMs,
    },
  };
}

function maskKey(key) {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value) && typeof result[key] === "object") {
      result[key] = deepMerge(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
