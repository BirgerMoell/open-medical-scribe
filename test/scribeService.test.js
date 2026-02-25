import test from "node:test";
import assert from "node:assert/strict";
import { createScribeService } from "../src/services/scribeService.js";

test("processEncounter uses provided transcript and returns draft note", async () => {
  const svc = createScribeService({
    config: { scribeMode: "hybrid", defaultNoteStyle: "soap" },
    transcriptionProvider: {
      name: "mock",
      async transcribe() {
        return { text: "unused" };
      },
    },
    noteGenerator: {
      name: "mock-note",
      async generateNote({ transcript }) {
        return {
          noteText: `NOTE: ${transcript}`,
          sections: { subjective: "Patient reports cough." },
        };
      },
    },
  });

  const result = await svc.processEncounter({
    transcript: "Patient reports cough for two days.",
  });

  assert.equal(result.providers.transcription, "mock");
  assert.equal(result.providers.note, "mock-note");
  assert.match(result.noteDraft, /Patient reports cough/);
});

test("transcribeOnly accepts simulated audio text", async () => {
  const svc = createScribeService({
    config: { scribeMode: "local", defaultNoteStyle: "soap" },
    transcriptionProvider: {
      name: "mock",
      async transcribe(input) {
        return { text: input.content };
      },
    },
    noteGenerator: {
      name: "noop",
      async generateNote() {
        return { noteText: "" };
      },
    },
  });

  const result = await svc.transcribeOnly({
    audioText: "Dictation content",
  });

  assert.equal(result.transcript, "Dictation content");
});

test("processEncounter falls back to SOAP formatter text when provider note is empty", async () => {
  const svc = createScribeService({
    config: { scribeMode: "hybrid", defaultNoteStyle: "soap" },
    transcriptionProvider: {
      name: "mock",
      async transcribe() {
        return { text: "unused" };
      },
    },
    noteGenerator: {
      name: "empty-note",
      async generateNote() {
        return { noteText: "", sections: null };
      },
    },
  });

  const result = await svc.processEncounter({
    transcript: "Patient reports sore throat. Exam notable for erythema. Start amoxicillin.",
  });

  assert.equal(typeof result.noteDraft, "string");
  assert.match(result.noteDraft, /^S:/);
});

test("processEncounter forwards transcription language and country hints", async () => {
  let seenInput = null;
  const svc = createScribeService({
    config: { scribeMode: "hybrid", defaultNoteStyle: "soap", defaultSpecialty: "primary-care" },
    transcriptionProvider: {
      name: "mock",
      async transcribe(input) {
        seenInput = input;
        return { text: "Patient reports halsont och feber." };
      },
    },
    noteGenerator: {
      name: "mock-note",
      async generateNote({ transcript }) {
        return { noteText: transcript, sections: {} };
      },
    },
  });

  await svc.processEncounter({
    audioText: "simulated audio",
    language: "sv",
    country: "SE",
    locale: "sv-SE",
  });

  assert.equal(seenInput.language, "sv");
  assert.equal(seenInput.country, "SE");
  assert.equal(seenInput.locale, "sv-SE");
});
