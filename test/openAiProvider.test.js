import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAiTranscriptionProvider } from "../src/providers/transcription/openAiProvider.js";

test("openai transcription provider parses verbose word and segment timestamps", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      text: "Patienten har hosta.",
      language: "sv",
      duration: 1.4,
      words: [
        { word: "Patienten", start: 0.0, end: 0.4 },
        { word: "har", start: 0.41, end: 0.6 },
        { word: "hosta.", start: 0.61, end: 1.0 },
      ],
      segments: [
        { text: "Patienten har hosta.", start: 0.0, end: 1.0 },
      ],
    }),
  });

  try {
    const provider = createOpenAiTranscriptionProvider({
      openai: { apiKey: "test", baseUrl: "https://api.openai.com", transcribeModel: "gpt-4o-mini-transcribe" },
    });

    const result = await provider.transcribe({
      type: "audio-base64",
      content: "dGVzdA==",
      mimeType: "audio/wav",
      language: "sv",
    });

    assert.equal(result.language, "sv");
    assert.equal(result.durationSec, 1.4);
    assert.equal(result.words[1].text, "har");
    assert.equal(result.segments[0].end, 1.0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("openai transcription provider retries without verbose parameters for compatible endpoints", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => JSON.stringify({ error: { message: "timestamp_granularities is not supported" } }),
      };
    }

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ text: "Patienten mår bättre." }),
    };
  };

  try {
    const provider = createOpenAiTranscriptionProvider({
      openai: { apiKey: "test", baseUrl: "https://example.com", transcribeModel: "whisper-1" },
    });

    const result = await provider.transcribe({
      type: "audio-base64",
      content: "dGVzdA==",
      mimeType: "audio/wav",
      language: "sv",
    });

    assert.equal(callCount, 2);
    assert.equal(result.text, "Patienten mår bättre.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
