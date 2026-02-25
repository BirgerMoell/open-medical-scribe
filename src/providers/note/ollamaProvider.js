import { buildNotePrompt } from "../../services/promptBuilder.js";
import { postJson } from "../shared/http.js";

export function createOllamaNoteGenerator(config) {
  return {
    name: "ollama",
    async generateNote({ transcript, noteStyle, specialty, patientContext, clinicianContext }) {
      const prompt = buildNotePrompt({
        transcript,
        noteStyle,
        specialty,
        patientContext,
        clinicianContext,
      });

      const { json } = await postJson(`${config.ollama.baseUrl.replace(/\/+$/, "")}/api/generate`, {
        body: {
          model: config.ollama.model,
          stream: false,
          prompt: `${prompt.system}\n\nUser input:\n${prompt.user}`,
          format: "json",
          options: {
            temperature: 0.2,
          },
        },
      });

      const parsed = safeParseJson(json?.response || "{}");
      return {
        noteText: String(parsed.noteText || ""),
        sections: parsed.sections && typeof parsed.sections === "object" ? parsed.sections : {},
        codingHints: Array.isArray(parsed.codingHints) ? parsed.codingHints : [],
        followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions : [],
        warnings: Array.isArray(parsed.warnings)
          ? parsed.warnings
          : ["Generated via local Ollama model."],
      };
    },
  };
}

function safeParseJson(raw) {
  try {
    return JSON.parse(String(raw || "{}"));
  } catch {
    return {
      noteText: String(raw || ""),
      sections: {},
      codingHints: [],
      followUpQuestions: [],
      warnings: ["Ollama returned non-JSON content; passed through raw text."],
    };
  }
}
