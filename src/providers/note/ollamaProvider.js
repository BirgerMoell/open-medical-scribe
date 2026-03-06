import { buildNotePrompt } from "../../services/promptBuilder.js";
import { postJson } from "../shared/http.js";

export function createOllamaNoteGenerator(config) {
  return {
    name: "ollama",
    async generateNote({ transcript, noteStyle, specialty, patientContext, clinicianContext, customPrompt }) {
      const prompt = buildNotePrompt({
        transcript,
        noteStyle,
        specialty,
        patientContext,
        clinicianContext,
      });

      const systemPrompt = customPrompt || prompt.system;

      const { json } = await postJson(`${config.ollama.baseUrl.replace(/\/+$/, "")}/api/generate`, {
        timeoutMs: config.ollama.timeoutMs || 180000,
        body: {
          model: config.ollama.model,
          stream: false,
          think: false,
          prompt: `${systemPrompt}\n\nUser input:\n${prompt.user}`,
          format: "json",
          options: {
            temperature: 0.2,
          },
        },
      });

      const raw = extractOllamaJsonPayload(json);
      const parsed = safeParseJson(raw || "{}");
      const fallbackWarnings = [
        "Generated via local Ollama model.",
        ...(json?.thinking && !json?.response ? ["Model emitted reasoning output; parsed fallback payload."] : []),
      ];

      return {
        noteText: String(parsed.noteText || ""),
        sections: parsed.sections && typeof parsed.sections === "object" ? parsed.sections : {},
        codingHints: Array.isArray(parsed.codingHints) ? parsed.codingHints : [],
        followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions : [],
        warnings: Array.isArray(parsed.warnings) && parsed.warnings.length
          ? [...parsed.warnings, ...fallbackWarnings]
          : fallbackWarnings,
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

function extractOllamaJsonPayload(json) {
  if (typeof json?.response === "string" && json.response.trim()) {
    return json.response;
  }

  if (typeof json?.thinking === "string" && json.thinking.trim()) {
    return json.thinking;
  }

  return "";
}
