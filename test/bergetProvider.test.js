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
});
