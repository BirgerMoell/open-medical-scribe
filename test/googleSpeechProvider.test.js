import test from "node:test";
import assert from "node:assert/strict";
import { createGoogleSpeechTranscriptionProvider } from "../src/providers/transcription/googleSpeechProvider.js";

test("google speech provider preserves word timing metadata", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      results: [
        {
          alternatives: [{
            transcript: "Patienten har hosta.",
            words: [
              { word: "Patienten", startTime: "0.0s", endTime: "0.4s" },
              { word: "har", startTime: "0.41s", endTime: "0.6s" },
              { word: "hosta.", startTime: "0.61s", endTime: "1.1s" },
            ],
          }],
        },
      ],
    }),
  });

  try {
    const provider = createGoogleSpeechTranscriptionProvider({
      google: { speechApiKey: "test", speechModel: "latest_long" },
    });

    const result = await provider.transcribe({
      type: "audio-base64",
      content: "dGVzdA==",
      mimeType: "audio/wav",
      language: "sv-SE",
    });

    assert.equal(result.text, "Patienten har hosta.");
    assert.equal(result.words.length, 3);
    assert.equal(result.words[2].end, 1.1);
    assert.equal(result.segments[0].start, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
