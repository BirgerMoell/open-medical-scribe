import { buildNotePrompt } from "../../services/promptBuilder.js";
import {
  extensionFromMime,
  mapSegmentList,
  mapWordList,
  safeJson,
  transcriptFromPlainText,
} from "../transcription/resultAdapter.js";

const DEFAULT_API_VERSION = "2024-10-21";

export function hasAzureChatFallback(config) {
  return Boolean(
    config?.azure?.openaiApiKey
      && config?.azure?.openaiEndpoint
      && config?.azure?.openaiDeploymentName,
  );
}

export function hasAzureTranscriptionFallback(config) {
  return Boolean(
    config?.azure?.openaiApiKey
      && config?.azure?.openaiEndpoint
      && config?.azure?.transcriptionDeploymentName,
  );
}

export async function requestAzureChatCompletion(config, body, { timeoutMs = 60000 } = {}) {
  if (!hasAzureChatFallback(config)) {
    const error = new Error("Azure OpenAI chat fallback is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(getAzureChatCompletionUrl(config), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": config.azure.openaiApiKey,
      },
      body: JSON.stringify(normalizeAzureChatBody(body)),
      signal: controller.signal,
    });

    const text = await response.text();
    const json = safeJson(text) || {};
    if (!response.ok) {
      const error = new Error(
        `Azure OpenAI chat failed (${response.status}): ${json?.error?.message || text || response.statusText}`,
      );
      error.statusCode = 502;
      error.upstreamStatus = response.status;
      error.upstreamPayload = json;
      throw error;
    }

    if (json?.error) {
      const error = new Error(
        `Azure OpenAI chat failed: ${json.error.message || text || "Unknown upstream error."}`,
      );
      error.statusCode = 502;
      error.upstreamStatus = response.status;
      error.upstreamPayload = json;
      throw error;
    }

    return { response, text, json };
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateNoteWithAzureOpenAi(
  config,
  { transcript, noteStyle, specialty, patientContext, clinicianContext, customPrompt },
) {
  const prompt = buildNotePrompt({
    transcript,
    noteStyle,
    specialty,
    patientContext,
    clinicianContext,
  });

  const { json } = await requestAzureChatCompletion(
    config,
    {
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: customPrompt || prompt.system },
        { role: "user", content: prompt.user },
      ],
    },
    { timeoutMs: 180000 },
  );

  const content = json?.choices?.[0]?.message?.content || "{}";
  return normalizeNoteResult(safeParseJson(content), {
    fallbackWarnings: [
      `Primary Berget provider unavailable. Generated via Azure OpenAI (${config.azure.openaiDeploymentName}).`,
    ],
  });
}

export async function transcribeWithAzureOpenAi(config, input) {
  if (input.type === "text-simulated-audio") {
    return transcriptFromPlainText(input.content, { language: input.language });
  }

  if (!hasAzureTranscriptionFallback(config)) {
    const error = new Error("Azure OpenAI transcription fallback is not configured.");
    error.statusCode = 503;
    throw error;
  }

  if (input.type !== "audio-base64") {
    return transcriptFromPlainText("");
  }

  const bytes = Buffer.from(input.content, "base64");
  return requestAzureTranscription(config, input, bytes, { verbose: true });
}

function normalizeAzureChatBody(body) {
  const payload = body && typeof body === "object" ? { ...body } : {};
  delete payload.model;
  delete payload.stream;
  if (!Array.isArray(payload.messages)) {
    payload.messages = [];
  }
  return payload;
}

function getAzureChatCompletionUrl(config) {
  const endpoint = String(config.azure.openaiEndpoint || "").replace(/\/+$/, "");
  const deployment = encodeURIComponent(config.azure.openaiDeploymentName);
  const apiVersion = encodeURIComponent(config.azure.openaiApiVersion || DEFAULT_API_VERSION);
  return `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
}

async function requestAzureTranscription(config, input, bytes, { verbose }) {
  const form = new FormData();
  const ext = extensionFromMime(input.mimeType);
  form.append(
    "file",
    new Blob([bytes], { type: input.mimeType || "audio/wav" }),
    `audio.${ext}`,
  );
  if (input.language) {
    form.append("language", String(input.language));
  }
  if (verbose) {
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    form.append("timestamp_granularities[]", "word");
  }

  const response = await fetch(getAzureTranscriptionUrl(config), {
    method: "POST",
    headers: {
      "api-key": config.azure.openaiApiKey,
    },
    body: form,
  });

  const text = await response.text();
  const maybeJson = safeJson(text);
  if (!response.ok) {
    if (verbose && shouldRetryWithoutVerbose(response.status, maybeJson, text)) {
      return requestAzureTranscription(config, input, bytes, { verbose: false });
    }

    const error = new Error(
      `Azure OpenAI transcription failed (${response.status}): ${text || response.statusText}`,
    );
    error.statusCode = 502;
    throw error;
  }

  if (typeof maybeJson?.text === "string") {
    return transcriptFromPlainText(maybeJson.text, {
      language: maybeJson.language || input.language,
      durationSec: maybeJson.duration,
      words: mapWordList(maybeJson.words, (word) => ({
        text: word?.word ?? word?.text,
        start: word?.start,
        end: word?.end,
      })),
      segments: mapSegmentList(maybeJson.segments, (segment) => ({
        text: segment?.text,
        start: segment?.start,
        end: segment?.end,
      })),
    });
  }

  return transcriptFromPlainText(text.trim(), { language: input.language });
}

function getAzureTranscriptionUrl(config) {
  const endpoint = String(config.azure.openaiEndpoint || "").replace(/\/+$/, "");
  const deployment = encodeURIComponent(config.azure.transcriptionDeploymentName);
  const apiVersion = encodeURIComponent(config.azure.openaiApiVersion || DEFAULT_API_VERSION);
  return `${endpoint}/openai/deployments/${deployment}/audio/transcriptions?api-version=${apiVersion}`;
}

function shouldRetryWithoutVerbose(status, json, text) {
  if (![400, 404, 415, 422].includes(status)) return false;
  const haystack = `${json?.error?.message || ""} ${text || ""}`.toLowerCase();
  return (
    haystack.includes("response_format")
    || haystack.includes("timestamp")
    || haystack.includes("verbose_json")
    || haystack.includes("granularit")
  );
}

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return {
      noteText: String(raw || ""),
      sections: {},
      codingHints: [],
      followUpQuestions: [],
      warnings: ["Azure OpenAI returned non-JSON content; passed through raw text."],
    };
  }
}

function normalizeNoteResult(result, { fallbackWarnings = [] } = {}) {
  return {
    noteText: String(result?.noteText || ""),
    sections: isObject(result?.sections) ? result.sections : {},
    codingHints: Array.isArray(result?.codingHints) ? result.codingHints : [],
    followUpQuestions: Array.isArray(result?.followUpQuestions)
      ? result.followUpQuestions
      : [],
    warnings: Array.isArray(result?.warnings) ? result.warnings : fallbackWarnings,
  };
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
