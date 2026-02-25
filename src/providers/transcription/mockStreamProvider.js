/**
 * Mock streaming transcription provider for development.
 * Simulates live transcript results with alternating speaker labels.
 */
export function createMockStreamProvider() {
  return {
    name: "mock-stream",

    createSession({ language, onResult, onUtteranceEnd, onError, onClose }) {
      let frameCount = 0;
      let speaker = 0;
      let closed = false;

      const phrases = [
        "Patient reports headache for two days.",
        "Any associated symptoms like nausea or visual changes?",
        "No nausea. Some light sensitivity.",
        "Let me check your vitals. Blood pressure is 128 over 82.",
        "I have been taking ibuprofen but it is not helping.",
        "We will order some labs and consider imaging.",
      ];

      return {
        sendAudio(pcm16Buffer) {
          if (closed) return;
          frameCount += 1;

          // Emit a mock transcript every ~20 frames (~1.3s of audio at 16kHz/1024 samples)
          if (frameCount % 20 === 0) {
            const idx = Math.floor(frameCount / 20) - 1;
            const phrase = phrases[idx % phrases.length];
            speaker = idx % 2;

            onResult({
              text: phrase,
              speaker,
              isFinal: true,
              words: phrase.split(" ").map((w, i) => ({
                word: w,
                speaker,
                start: i * 0.3,
                end: i * 0.3 + 0.25,
              })),
            });

            onUtteranceEnd();
          }
        },

        close() {
          if (closed) return;
          closed = true;
          onClose();
        },
      };
    },
  };
}
