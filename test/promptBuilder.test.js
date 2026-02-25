import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildNotePrompt } from "../src/services/promptBuilder.js";

describe("buildNotePrompt", () => {
  it("includes JSON return contract and style/specialty", () => {
    const prompt = buildNotePrompt({
      transcript: "Patient reports cough.",
      noteStyle: "soap",
      specialty: "primary-care",
      patientContext: { age: 44 },
    });

    assert.match(prompt.system, /strict JSON/i);
    assert.match(prompt.system, /SOAP/i);
    assert.match(prompt.system, /primary-care/i);
    assert.match(prompt.user, /Patient reports cough/);
    assert.match(prompt.user, /"age": 44/);
  });

  it("generates H&P style instructions", () => {
    const prompt = buildNotePrompt({
      transcript: "Patient presents for annual exam.",
      noteStyle: "hp",
    });

    assert.match(prompt.system, /History & Physical/i);
    assert.match(prompt.system, /Chief Complaint/i);
    assert.match(prompt.system, /Physical Examination/i);
  });

  it("generates Progress Note style instructions", () => {
    const prompt = buildNotePrompt({
      transcript: "Follow-up for diabetes.",
      noteStyle: "progress",
    });

    assert.match(prompt.system, /Progress Note/i);
    assert.match(prompt.system, /Interval History/i);
  });

  it("generates DAP style instructions", () => {
    const prompt = buildNotePrompt({
      transcript: "Therapy session discussing anxiety.",
      noteStyle: "dap",
    });

    assert.match(prompt.system, /DAP/i);
    assert.match(prompt.system, /behavioral health/i);
  });

  it("generates Procedure Note style instructions", () => {
    const prompt = buildNotePrompt({
      transcript: "Colonoscopy performed.",
      noteStyle: "procedure",
    });

    assert.match(prompt.system, /Procedure Note/i);
    assert.match(prompt.system, /Indication/i);
    assert.match(prompt.system, /Complications/i);
  });

  it("falls back gracefully for unknown styles", () => {
    const prompt = buildNotePrompt({
      transcript: "Test.",
      noteStyle: "custom-format",
    });

    assert.match(prompt.system, /custom-format/);
  });
});
