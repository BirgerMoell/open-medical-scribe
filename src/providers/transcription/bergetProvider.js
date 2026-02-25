export function createBergetTranscriptionProvider(config) {
  return {
    name: "berget",
    async transcribe(input) {
      if (input.type === "text-simulated-audio") {
        return { text: input.content };
      }

      if (!config.berget.apiKey) {
        return {
          text: "[berget provider not configured] Set BERGET_API_KEY to enable Berget AI transcription.",
        };
      }

      if (input.type !== "audio-base64") {
        return { text: "" };
      }

      const bytes = Buffer.from(input.content, "base64");
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

      const baseUrl = config.berget.baseUrl.replace(/\/+$/, "");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);

      try {
        const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.berget.apiKey}`,
          },
          body: form,
          signal: controller.signal,
        });

        const text = await response.text();
        if (!response.ok) {
          const error = new Error(
            `Berget AI transcription failed (${response.status}): ${text || response.statusText}`,
          );
          error.statusCode = 502;
          throw error;
        }

        const maybeJson = safeJson(text);
        if (typeof maybeJson?.text === "string") {
          return { text: maybeJson.text };
        }
        return { text: text.trim() };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function extensionFromMime(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("webm")) return "webm";
  return "bin";
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
