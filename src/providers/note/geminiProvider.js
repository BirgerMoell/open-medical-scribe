import { buildNotePrompt } from "../../services/promptBuilder.js";
import { postJson } from "../shared/http.js";

export function createGeminiNoteGenerator(config) {
  return {
    name: "gemini",
    async generateNote({ transcript, noteStyle, specialty, patientContext, clinicianContext, customPrompt }) {
      if (!config.gemini.apiKey) {
        return {
          noteText:
            "[gemini note generator not configured] Set GEMINI_API_KEY to enable Google Gemini note drafting.",
          sections: {},
          codingHints: [],
          followUpQuestions: [],
          warnings: ["Gemini provider selected but GEMINI_API_KEY is empty."],
        };
      }

      const prompt = buildNotePrompt({
        transcript,
        noteStyle,
        specialty,
        patientContext,
        clinicianContext,
      });

      const model = config.gemini.model;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.gemini.apiKey}`;

      const { json } = await postJson(url, {
        body: {
          contents: [
            {
              parts: [{ text: `${customPrompt || prompt.system}\n\nUser input:\n${prompt.user}` }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        },
      });

      const raw =
        json?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsed = safeParseJson(raw);

      return normalizeNoteResult(parsed, {
        fallbackWarnings: ["Generated via Google Gemini."],
      });
    },
  };
}

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return {
      noteText: String(raw || ""),
      sections: {},
      codingHints: [],
      followUpQuestions: [],
      warnings: ["Gemini returned non-JSON content; passed through raw text."],
    };
  }
}

function normalizeNoteResult(result, { fallbackWarnings = [] } = {}) {
  return {
    noteText: String(result?.noteText || ""),
    sections: isObject(result?.sections) ? result.sections : {},
    codingHints: Array.isArray(result?.codingHints) ? result.codingHints : [],
    followUpQuestions: Array.isArray(result?.followUpQuestions)
      ? result.followUpQuestions
      : [],
    warnings: Array.isArray(result?.warnings) ? result.warnings : fallbackWarnings,
  };
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
