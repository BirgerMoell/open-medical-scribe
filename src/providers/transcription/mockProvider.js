export function createMockTranscriptionProvider() {
  return {
    name: "mock",
    async transcribe(input) {
      if (input.type === "text-simulated-audio") {
        return { text: input.content };
      }

      if (input.type === "audio-base64") {
        return {
          text: "[mock transcription] Audio received. Replace mock provider with a real local/API transcription engine.",
        };
      }

      return { text: "" };
    },
  };
}

