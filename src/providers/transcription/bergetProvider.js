import {
  extensionFromMime,
  mapSegmentList,
  mapWordList,
  safeJson,
  transcriptFromPlainText,
} from "./resultAdapter.js";
import {
  hasAzureTranscriptionFallback,
  transcribeWithAzureOpenAi,
} from "../shared/azureOpenAi.js";

export function createBergetTranscriptionProvider(config) {
  return {
    name: "berget",
    async transcribe(input) {
      if (input.type === "text-simulated-audio") {
        return transcriptFromPlainText(input.content, { language: input.language });
      }

      if (!config.berget.apiKey) {
        if (hasAzureTranscriptionFallback(config)) {
          return transcribeWithAzureOpenAi(config, input);
        }

        return transcriptFromPlainText(
          "[berget provider not configured] Set BERGET_API_KEY to enable Berget AI transcription.",
        );
      }

      if (input.type !== "audio-base64") {
        return transcriptFromPlainText("");
      }

      const bytes = Buffer.from(input.content, "base64");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);

      try {
        try {
          return await requestBergetTranscription(config, input, bytes, controller.signal, {
            verbose: true,
          });
        } catch (error) {
          if (hasAzureTranscriptionFallback(config) && shouldFallbackToAzure(error)) {
            return transcribeWithAzureOpenAi(config, input);
          }
          throw error;
        }
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

async function requestBergetTranscription(config, input, bytes, signal, { verbose }) {
  const ext = extensionFromMime(input.mimeType);
  const form = new FormData();
  form.append(
    "file",
    new Blob([bytes], { type: input.mimeType || "audio/wav" }),
    `audio.${ext}`,
  );
  form.append("model", config.berget.transcribeModel);
  if (input.language) {
    form.append("language", String(input.language));
  }
  if (verbose) {
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    form.append("timestamp_granularities[]", "word");
  }

  const baseUrl = config.berget.baseUrl.replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.berget.apiKey}`,
    },
    body: form,
    signal,
  });

  const text = await response.text();
  const maybeJson = safeJson(text);
  if (!response.ok) {
    if (verbose && shouldRetryWithoutVerbose(response.status, maybeJson, text)) {
      return requestBergetTranscription(config, input, bytes, signal, { verbose: false });
    }

    const error = new Error(
      `Berget AI transcription failed (${response.status}): ${text || response.statusText}`,
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

function shouldFallbackToAzure(error) {
  const status = Number(error?.statusCode || 0);
  const message = String(error?.message || "").toLowerCase();
  return (
    status >= 500
    || message.includes("timeout")
    || message.includes("model_overloaded")
    || message.includes("internal_error")
    || message.includes("server_error")
  );
}
