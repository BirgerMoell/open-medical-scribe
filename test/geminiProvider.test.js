import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGeminiNoteGenerator } from "../src/providers/note/geminiProvider.js";

describe("geminiProvider", () => {
  it("returns unconfigured warning when API key is empty", async () => {
    const provider = createGeminiNoteGenerator({
      gemini: { apiKey: "", model: "gemini-2.0-flash" },
    });

    assert.equal(provider.name, "gemini");

    const result = await provider.generateNote({
      transcript: "Patient reports headache.",
      noteStyle: "soap",
      specialty: "primary-care",
    });

    assert.ok(result.warnings.length > 0);
    assert.ok(result.noteText.includes("not configured"));
  });
});
