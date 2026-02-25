import { runCliCommand } from "../shared/cli.js";

export function createCliNoteGenerator(config) {
  return {
    name: "cli",
    async generateNote({ transcript, noteStyle, specialty, customPrompt }) {
      const command = config.cli?.noteCommand;
      if (!command) {
        return {
          noteText: "[cli note provider not configured] Set CLI_NOTE_COMMAND to enable CLI-based note generation.",
          sections: {},
          codingHints: [],
          followUpQuestions: [],
          warnings: ["CLI note provider not configured."],
        };
      }

      const args = [];
      if (noteStyle) args.push("--note-style", noteStyle);
      if (specialty) args.push("--specialty", specialty);
      if (customPrompt) args.push("--custom-prompt", customPrompt);

      const output = await runCliCommand({
        command,
        args,
        stdin: Buffer.from(transcript, "utf8"),
        timeoutMs: config.cli?.timeoutMs || 120000,
      });

      const parsed = safeParseJson(output);
      return {
        noteText: String(parsed.noteText || ""),
        sections: isObject(parsed.sections) ? parsed.sections : {},
        codingHints: Array.isArray(parsed.codingHints) ? parsed.codingHints : [],
        followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions : [],
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      };
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
      warnings: ["CLI returned non-JSON content; passed through raw text."],
    };
  }
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
