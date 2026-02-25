import { buildNotePrompt } from "../../services/promptBuilder.js";
import { postJson } from "../shared/http.js";

export function createOpenAiNoteGenerator(config) {
  return {
    name: "openai",
    async generateNote({ transcript, noteStyle, specialty, patientContext, clinicianContext }) {
      if (!config.openai.apiKey) {
        return {
          noteText:
            "[openai note generator not configured] Set OPENAI_API_KEY to enable hosted note drafting.",
          sections: {},
          codingHints: [],
          followUpQuestions: [],
          warnings: ["OpenAI provider selected but OPENAI_API_KEY is empty."],
        };
      }

      const prompt = buildNotePrompt({
        transcript,
        noteStyle,
        specialty,
        patientContext,
        clinicianContext,
      });

      const baseUrl = config.openai.baseUrl.replace(/\/+$/, "");
      const { json } = await postJson(`${baseUrl}/v1/chat/completions`, {
        headers: {
          Authorization: `Bearer ${config.openai.apiKey}`,
        },
        body: {
          model: config.openai.noteModel,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        },
      });

      const content = json?.choices?.[0]?.message?.content || "{}";
      const parsed = safeParseJson(content);

      return normalizeNoteResult(parsed, {
        fallbackWarnings: ["Generated via OpenAI chat completion."],
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
      warnings: ["OpenAI returned non-JSON content; passed through raw text."],
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
