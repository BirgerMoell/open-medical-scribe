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
  assert.equal(result.transcriptDocument.text, "Dictation content");
  assert.ok(Array.isArray(result.transcriptDocument.words));
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
  assert.equal(result.transcriptDocument.text, "Patient reports sore throat. Exam notable for erythema. Start amoxicillin.");
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

test("processEncounter carries structured transcript metadata into the response", async () => {
  const svc = createScribeService({
    config: { scribeMode: "hybrid", defaultNoteStyle: "soap", defaultSpecialty: "primary-care" },
    transcriptionProvider: {
      name: "mock",
      async transcribe() {
        return {
          text: "Patienten har ömhet i bröstet.",
          words: [
            { text: "Patienten", start: 0.0, end: 0.4 },
            { text: "har", start: 0.41, end: 0.6 },
            { text: "ömhet", start: 0.61, end: 1.0 },
          ],
          segments: [
            { text: "Patienten har ömhet i bröstet.", start: 0.0, end: 1.8 },
          ],
        };
      },
    },
    noteGenerator: {
      name: "mock-note",
      async generateNote({ transcript }) {
        return { noteText: transcript, sections: {} };
      },
    },
  });

  const result = await svc.processEncounter({
    audioBase64: "dGVzdA==",
    audioMimeType: "audio/wav",
    language: "sv",
  });

  assert.equal(result.transcriptDocument.language, "sv");
  assert.equal(result.transcriptDocument.meta.hasWordTimestamps, true);
  assert.equal(result.transcriptDocument.words[2].text, "ömhet");
  assert.equal(result.transcriptDocument.segments[0].startSec, 0);
});
