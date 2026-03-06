import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBergetNoteGenerator } from "../src/providers/note/bergetProvider.js";

describe("bergetNoteProvider", () => {
  it("returns an unconfigured warning when API key is missing", async () => {
    const provider = createBergetNoteGenerator({
      berget: {
        apiKey: "",
        baseUrl: "https://api.berget.ai",
        noteModel: "openai/gpt-oss-120b",
      },
    });

    const result = await provider.generateNote({
      transcript: "Patienten har hosta.",
      noteStyle: "journal",
      specialty: "primary-care",
    });

    assert.match(result.noteText, /not configured/i);
    assert.match(result.warnings.join(" "), /BERGET_API_KEY/i);
  });

  it("parses JSON note output from the OpenAI-compatible Berget endpoint", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      text: async () => JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                noteText: "Aktuellt: Hosta sedan tre dagar.",
                sections: {
                  aktuellt: "Hosta sedan tre dagar.",
                },
                codingHints: [],
                followUpQuestions: [],
                warnings: ["Requires clinician review."],
              }),
            },
          },
        ],
      }),
    });

    try {
      const provider = createBergetNoteGenerator({
        berget: {
          apiKey: "test",
          baseUrl: "https://api.berget.ai",
          noteModel: "openai/gpt-oss-120b",
        },
      });

      const result = await provider.generateNote({
        transcript: "Patienten har hosta.",
        noteStyle: "journal",
        specialty: "primary-care",
      });

      assert.equal(result.noteText, "Aktuellt: Hosta sedan tre dagar.");
      assert.deepEqual(result.sections, { aktuellt: "Hosta sedan tre dagar." });
      assert.deepEqual(result.warnings, ["Requires clinician review."]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
