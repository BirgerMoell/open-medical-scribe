import { mapSegmentList, mapWordList, safeJson, transcriptFromPlainText } from "./resultAdapter.js";

export function createGoogleSpeechTranscriptionProvider(config) {
  return {
    name: "google",
    async transcribe(input) {
      if (input.type === "text-simulated-audio") {
        return transcriptFromPlainText(input.content, { language: input.language });
      }

      if (!config.google.speechApiKey) {
        return transcriptFromPlainText(
          "[google speech provider not configured] Set GOOGLE_SPEECH_API_KEY to enable Google Cloud Speech transcription.",
        );
      }

      if (input.type !== "audio-base64") {
        return transcriptFromPlainText("");
      }

      const mimeType = input.mimeType || "audio/wav";
      const encoding = encodingFromMime(mimeType);
      const language = input.language || "en-US";

      const url = `https://speech.googleapis.com/v1/speech:recognize?key=${config.google.speechApiKey}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config: {
              encoding,
              languageCode: language,
              model: config.google.speechModel,
              enableAutomaticPunctuation: true,
              enableWordTimeOffsets: true,
            },
            audio: {
              content: input.content,
            },
          }),
          signal: controller.signal,
        });

        const text = await response.text();
        if (!response.ok) {
          const error = new Error(
            `Google Speech transcription failed (${response.status}): ${text || response.statusText}`,
          );
          error.statusCode = 502;
          throw error;
        }

        const json = safeJson(text);
        const results = json?.results || [];
        const transcript = results
          .map((result) => result.alternatives?.[0]?.transcript || "")
          .join(" ")
          .trim();

        return transcriptFromPlainText(transcript, {
          language: input.language,
          words: mapWordList(results.flatMap((result) => result.alternatives?.[0]?.words || []), (word) => ({
            text: word?.word,
            start: word?.startTime,
            end: word?.endTime,
            confidence: word?.confidence,
          })),
          segments: mapSegmentList(results, (result) => {
            const alternative = result?.alternatives?.[0];
            const wordList = alternative?.words || [];
            return {
              text: alternative?.transcript,
              start: wordList[0]?.startTime,
              end: wordList[wordList.length - 1]?.endTime,
            };
          }),
        });
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function encodingFromMime(mimeType) {
  const mime = String(mimeType).toLowerCase();
  if (mime.includes("wav")) return "LINEAR16";
  if (mime.includes("flac")) return "FLAC";
  if (mime.includes("ogg")) return "OGG_OPUS";
  if (mime.includes("webm")) return "WEBM_OPUS";
  if (mime.includes("mp3") || mime.includes("mpeg")) return "MP3";
  return "ENCODING_UNSPECIFIED";
}
