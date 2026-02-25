import { buildNotePrompt } from "../../services/promptBuilder.js";
import { postJson } from "../shared/http.js";

export function createAnthropicNoteGenerator(config) {
  return {
    name: "anthropic",
    async generateNote({ transcript, noteStyle, specialty, patientContext, clinicianContext, customPrompt }) {
      if (!config.anthropic.apiKey) {
        return {
          noteText:
            "[anthropic note generator not configured] Set ANTHROPIC_API_KEY to enable Anthropic note drafting.",
          sections: {},
          codingHints: [],
          followUpQuestions: [],
          warnings: ["Anthropic provider selected but ANTHROPIC_API_KEY is empty."],
        };
      }

      const prompt = buildNotePrompt({
        transcript,
        noteStyle,
        specialty,
        patientContext,
        clinicianContext,
      });

      const baseUrl = config.anthropic.baseUrl.replace(/\/+$/, "");
      const { json } = await postJson(`${baseUrl}/v1/messages`, {
        headers: {
          "x-api-key": config.anthropic.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: {
          model: config.anthropic.model,
          max_tokens: 4096,
          temperature: 0.2,
          system: customPrompt || prompt.system,
          messages: [{ role: "user", content: prompt.user }],
        },
      });

      const textBlock = json?.content?.find((b) => b.type === "text");
      const raw = textBlock?.text || "{}";
      const parsed = safeParseJson(raw);

      return normalizeNoteResult(parsed, {
        fallbackWarnings: ["Generated via Anthropic Claude."],
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
      warnings: ["Anthropic returned non-JSON content; passed through raw text."],
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
