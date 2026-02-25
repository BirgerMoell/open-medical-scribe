import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createAnthropicNoteGenerator } from "../src/providers/note/anthropicProvider.js";

describe("anthropicProvider", () => {
  it("returns unconfigured warning when API key is empty", async () => {
    const provider = createAnthropicNoteGenerator({
      anthropic: { apiKey: "", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-20250514" },
    });

    assert.equal(provider.name, "anthropic");

    const result = await provider.generateNote({
      transcript: "Patient reports headache.",
      noteStyle: "soap",
      specialty: "primary-care",
    });

    assert.ok(result.warnings.length > 0);
    assert.ok(result.noteText.includes("not configured"));
  });
});
