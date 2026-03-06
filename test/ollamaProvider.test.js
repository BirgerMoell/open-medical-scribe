import test from "node:test";
import assert from "node:assert/strict";
import { createOllamaNoteGenerator } from "../src/providers/note/ollamaProvider.js";

test("ollama provider parses direct JSON response payload", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      response: JSON.stringify({
        noteText: "Aktuellt:\nHosta sedan tre dagar.",
        sections: { aktuellt: "Hosta sedan tre dagar." },
        codingHints: [],
        followUpQuestions: [],
        warnings: [],
      }),
    }),
  });

  try {
    const provider = createOllamaNoteGenerator({
      ollama: { baseUrl: "http://localhost:11434", model: "qwen3.5:4b" },
    });

    const result = await provider.generateNote({
      transcript: "Patienten har hosta sedan tre dagar.",
      noteStyle: "journal",
      specialty: "primary-care",
      patientContext: {},
      clinicianContext: {},
    });

    assert.match(result.noteText, /Aktuellt/);
    assert.equal(result.sections.aktuellt, "Hosta sedan tre dagar.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ollama provider falls back to reasoning payload when response is empty", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      response: "",
      thinking: JSON.stringify({
        noteText: "S:\nHalsont sedan tre dagar.\n\nP:\nEgenvård.",
        sections: { subjective: "Halsont sedan tre dagar.", plan: "Egenvård." },
        codingHints: [],
        followUpQuestions: [],
        warnings: [],
      }),
    }),
  });

  try {
    const provider = createOllamaNoteGenerator({
      ollama: { baseUrl: "http://localhost:11434", model: "qwen3.5:4b" },
    });

    const result = await provider.generateNote({
      transcript: "Patienten har halsont sedan tre dagar.",
      noteStyle: "soap",
      specialty: "primary-care",
      patientContext: {},
      clinicianContext: {},
    });

    assert.match(result.noteText, /^S:/);
    assert.ok(result.warnings.some((warning) => /reasoning output/i.test(warning)));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
