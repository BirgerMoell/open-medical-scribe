import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDeepgramTranscriptionProvider } from "../src/providers/transcription/deepgramProvider.js";

describe("deepgramProvider", () => {
  it("returns unconfigured warning when API key is empty", async () => {
    const provider = createDeepgramTranscriptionProvider({
      deepgram: { apiKey: "", model: "nova-3-medical" },
    });

    assert.equal(provider.name, "deepgram");

    const result = await provider.transcribe({
      type: "audio-base64",
      content: "dGVzdA==",
      mimeType: "audio/wav",
    });

    assert.ok(result.text.includes("not configured"));
  });

  it("passes through text-simulated-audio", async () => {
    const provider = createDeepgramTranscriptionProvider({
      deepgram: { apiKey: "", model: "nova-3-medical" },
    });

    const result = await provider.transcribe({
      type: "text-simulated-audio",
      content: "Patient says hello.",
    });

    assert.equal(result.text, "Patient says hello.");
  });

  it("preserves words and utterance timing metadata from Deepgram responses", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      text: async () => JSON.stringify({
        metadata: { duration: 2.6 },
        results: {
          channels: [{
            detected_language: "sv",
            alternatives: [{
              transcript: "Patienten har hosta.",
              words: [
                { word: "Patienten", punctuated_word: "Patienten", start: 0.0, end: 0.5, speaker: 0 },
                { word: "har", punctuated_word: "har", start: 0.51, end: 0.7, speaker: 0 },
                { word: "hosta", punctuated_word: "hosta.", start: 0.71, end: 1.2, speaker: 0 },
              ],
            }],
          }],
          utterances: [
            { transcript: "Patienten har hosta.", start: 0.0, end: 1.2, speaker: 0 },
          ],
        },
      }),
    });

    try {
      const provider = createDeepgramTranscriptionProvider({
        deepgram: { apiKey: "test", model: "nova-3-medical" },
      });

      const result = await provider.transcribe({
        type: "audio-base64",
        content: "dGVzdA==",
        mimeType: "audio/wav",
        language: "sv",
      });

      assert.equal(result.language, "sv");
      assert.equal(result.durationSec, 2.6);
      assert.equal(result.words.length, 3);
      assert.equal(result.words[2].text, "hosta.");
      assert.equal(result.segments[0].speaker, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
