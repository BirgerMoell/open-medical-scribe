import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBergetTranscriptionProvider } from "../src/providers/transcription/bergetProvider.js";

describe("bergetProvider", () => {
  it("returns unconfigured warning when API key is empty", async () => {
    const provider = createBergetTranscriptionProvider({
      berget: { apiKey: "", baseUrl: "https://api.berget.ai", transcribeModel: "KBLab/kb-whisper-large" },
    });

    assert.equal(provider.name, "berget");

    const result = await provider.transcribe({
      type: "audio-base64",
      content: "dGVzdA==",
      mimeType: "audio/wav",
    });

    assert.ok(result.text.includes("not configured"));
  });

  it("passes through text-simulated-audio", async () => {
    const provider = createBergetTranscriptionProvider({
      berget: { apiKey: "", baseUrl: "https://api.berget.ai", transcribeModel: "KBLab/kb-whisper-large" },
    });

    const result = await provider.transcribe({
      type: "text-simulated-audio",
      content: "Patienten rapporterar huvudvärk.",
    });

    assert.equal(result.text, "Patienten rapporterar huvudvärk.");
  });

  it("parses verbose OpenAI-compatible payloads from Berget", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      text: async () => JSON.stringify({
        text: "Patienten har hosta.",
        language: "sv",
        duration: 1.8,
        words: [
          { word: "Patienten", start: 0.0, end: 0.4 },
          { word: "har", start: 0.41, end: 0.6 },
          { word: "hosta.", start: 0.61, end: 1.1 },
        ],
        segments: [
          { text: "Patienten har hosta.", start: 0.0, end: 1.1 },
        ],
      }),
    });

    try {
      const provider = createBergetTranscriptionProvider({
        berget: { apiKey: "test", baseUrl: "https://api.berget.ai", transcribeModel: "KBLab/kb-whisper-large" },
      });

      const result = await provider.transcribe({
        type: "audio-base64",
        content: "dGVzdA==",
        mimeType: "audio/wav",
        language: "sv",
      });

      assert.equal(result.language, "sv");
      assert.equal(result.durationSec, 1.8);
      assert.equal(result.words.length, 3);
      assert.equal(result.segments.length, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
