import { buildSoapNoteFromTranscript } from "../../services/soapFormatter.js";

export function createMockNoteGenerator() {
  return {
    name: "mock",
    async generateNote({ transcript, noteStyle, specialty }) {
      const soap = buildSoapNoteFromTranscript(transcript);

      return {
        noteText: soap.noteText,
        sections: soap.sections,
        codingHints: [],
        followUpQuestions: [
          "Verify symptom onset and duration.",
          "Confirm medication allergies before finalizing plan.",
        ],
        warnings: [
          "Mock note generator used. Replace with API/local LLM provider for production use.",
          `Requested note style: ${noteStyle}`,
          `Specialty context: ${specialty || "primary-care"}`,
        ],
      };
    },
  };
}
