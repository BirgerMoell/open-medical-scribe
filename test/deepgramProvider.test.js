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
});
