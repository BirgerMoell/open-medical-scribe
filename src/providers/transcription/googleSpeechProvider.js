export function createGoogleSpeechTranscriptionProvider(config) {
  return {
    name: "google",
    async transcribe(input) {
      if (input.type === "text-simulated-audio") {
        return { text: input.content };
      }

      if (!config.google.speechApiKey) {
        return {
          text: "[google speech provider not configured] Set GOOGLE_SPEECH_API_KEY to enable Google Cloud Speech transcription.",
        };
      }

      if (input.type !== "audio-base64") {
        return { text: "" };
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
        const transcript = (json?.results || [])
          .map((r) => r.alternatives?.[0]?.transcript || "")
          .join(" ")
          .trim();

        return { text: transcript };
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

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
