import { transcriptFromPlainText } from "./resultAdapter.js";

export function createMockTranscriptionProvider() {
  return {
    name: "mock",
    async transcribe(input) {
      if (input.type === "text-simulated-audio") {
        return transcriptFromPlainText(input.content, { language: input.language });
      }

      if (input.type === "audio-base64") {
        return transcriptFromPlainText(
          "[mock transcription] Audio received. Replace mock provider with a real local/API transcription engine.",
        );
      }

      return transcriptFromPlainText("");
    },
  };
}
