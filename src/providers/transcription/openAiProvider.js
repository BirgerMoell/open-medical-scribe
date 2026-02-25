export function createOpenAiTranscriptionProvider(config) {
  return {
    name: "openai",
    async transcribe(input) {
      if (!config.openai.apiKey) {
        return {
          text: "[openai provider not configured] Set OPENAI_API_KEY to enable API transcription.",
        };
      }

      if (input.type === "text-simulated-audio") {
        return { text: input.content };
      }

      if (input.type !== "audio-base64") {
        return { text: "" };
      }

      const baseUrl = config.openai.baseUrl.replace(/\/+$/, "");
      const bytes = Buffer.from(input.content, "base64");
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

      const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.openai.apiKey}`,
        },
        body: form,
      });

      const text = await response.text();
      if (!response.ok) {
        const error = new Error(
          `OpenAI transcription failed (${response.status}): ${text || response.statusText}`,
        );
        error.statusCode = 502;
        throw error;
      }

      const maybeJson = safeJson(text);
      if (typeof maybeJson?.text === "string") {
        return { text: maybeJson.text };
      }
      return { text: text.trim() };
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
