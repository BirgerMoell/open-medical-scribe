import { mapSegmentList, mapWordList, safeJson, transcriptFromPlainText } from "./resultAdapter.js";

export function createDeepgramTranscriptionProvider(config) {
  return {
    name: "deepgram",
    async transcribe(input) {
      if (input.type === "text-simulated-audio") {
        return transcriptFromPlainText(input.content, { language: input.language });
      }

      if (!config.deepgram.apiKey) {
        return transcriptFromPlainText(
          "[deepgram provider not configured] Set DEEPGRAM_API_KEY to enable Deepgram transcription.",
        );
      }

      if (input.type !== "audio-base64") {
        return transcriptFromPlainText("");
      }

      const audioBytes = Buffer.from(input.content, "base64");
      const mimeType = input.mimeType || "audio/wav";

      const params = new URLSearchParams({
        model: config.deepgram.model,
        smart_format: "true",
        punctuate: "true",
        diarize: "true",
        utterances: "true",
      });

      if (input.language) {
        params.set("language", String(input.language));
      }

      const url = `https://api.deepgram.com/v1/listen?${params}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Token ${config.deepgram.apiKey}`,
            "Content-Type": mimeType,
          },
          body: audioBytes,
          signal: controller.signal,
        });

        const text = await response.text();
        if (!response.ok) {
          const error = new Error(
            `Deepgram transcription failed (${response.status}): ${text || response.statusText}`,
          );
          error.statusCode = 502;
          throw error;
        }

        const json = safeJson(text);
        const alternative = json?.results?.channels?.[0]?.alternatives?.[0];
        return transcriptFromPlainText(alternative?.transcript || "", {
          language: json?.results?.channels?.[0]?.detected_language || input.language,
          durationSec: json?.metadata?.duration,
          words: mapWordList(alternative?.words, (word) => ({
            text: word?.punctuated_word ?? word?.word,
            start: word?.start,
            end: word?.end,
            speaker: word?.speaker,
            confidence: word?.confidence,
          })),
          segments: mapSegmentList(json?.results?.utterances, (segment) => ({
            text: segment?.transcript,
            start: segment?.start,
            end: segment?.end,
            speaker: segment?.speaker,
          })),
        });
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
