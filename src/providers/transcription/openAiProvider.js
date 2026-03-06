import {
  extensionFromMime,
  mapSegmentList,
  mapWordList,
  safeJson,
  transcriptFromPlainText,
} from "./resultAdapter.js";

export function createOpenAiTranscriptionProvider(config) {
  return {
    name: "openai",
    async transcribe(input) {
      if (!config.openai.apiKey) {
        return transcriptFromPlainText(
          "[openai provider not configured] Set OPENAI_API_KEY to enable API transcription.",
        );
      }

      if (input.type === "text-simulated-audio") {
        return transcriptFromPlainText(input.content, { language: input.language });
      }

      if (input.type !== "audio-base64") {
        return transcriptFromPlainText("");
      }

      const bytes = Buffer.from(input.content, "base64");
      return await requestOpenAiTranscription(config, input, bytes, { verbose: true });
    },
  };
}

async function requestOpenAiTranscription(config, input, bytes, { verbose }) {
  const baseUrl = config.openai.baseUrl.replace(/\/+$/, "");
  const form = new FormData();
  const ext = extensionFromMime(input.mimeType);
  form.append(
    "file",
    new Blob([bytes], { type: input.mimeType || "audio/wav" }),
    `audio.${ext}`,
  );
  form.append("model", config.openai.transcribeModel);
  if (input.language) {
    form.append("language", String(input.language));
  }
  if (verbose) {
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    form.append("timestamp_granularities[]", "word");
  }

  const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
    },
    body: form,
  });

  const text = await response.text();
  const maybeJson = safeJson(text);
  if (!response.ok) {
    if (verbose && shouldRetryWithoutVerbose(response.status, maybeJson, text)) {
      return requestOpenAiTranscription(config, input, bytes, { verbose: false });
    }

    const error = new Error(
      `OpenAI transcription failed (${response.status}): ${text || response.statusText}`,
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
