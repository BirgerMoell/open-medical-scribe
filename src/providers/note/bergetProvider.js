import { buildNotePrompt } from "../../services/promptBuilder.js";
import { postJson } from "../shared/http.js";

export function createBergetNoteGenerator(config) {
  return {
    name: "berget",
    async generateNote({ transcript, noteStyle, specialty, patientContext, clinicianContext, customPrompt }) {
      if (!config.berget.apiKey) {
        return {
          noteText:
            "[berget note generator not configured] Set BERGET_API_KEY to enable Berget AI note drafting.",
          sections: {},
          codingHints: [],
          followUpQuestions: [],
          warnings: ["Berget note provider selected but BERGET_API_KEY is empty."],
        };
      }

      const prompt = buildNotePrompt({
        transcript,
        noteStyle,
        specialty,
        patientContext,
        clinicianContext,
      });

      const baseUrl = config.berget.baseUrl.replace(/\/+$/, "");
      const { json } = await postJson(`${baseUrl}/v1/chat/completions`, {
        headers: {
          Authorization: `Bearer ${config.berget.apiKey}`,
        },
        body: {
          model: config.berget.noteModel,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: customPrompt || prompt.system },
            { role: "user", content: prompt.user },
          ],
        },
        timeoutMs: 180000,
      });

      const content = json?.choices?.[0]?.message?.content || "{}";
      const parsed = safeParseJson(content);

      return normalizeNoteResult(parsed, {
        fallbackWarnings: [`Generated via Berget AI (${config.berget.noteModel}).`],
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
      warnings: ["Berget returned non-JSON content; passed through raw text."],
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
