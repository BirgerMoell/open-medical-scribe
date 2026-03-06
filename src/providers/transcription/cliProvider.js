import { runCliCommand } from "../shared/cli.js";
import { transcriptFromPlainText } from "./resultAdapter.js";

export function createCliTranscriptionProvider(config) {
  return {
    name: "cli",
    async transcribe(input) {
      if (input.type === "text-simulated-audio") {
        return transcriptFromPlainText(input.content, { language: input.language });
      }

      const command = config.cli?.transcribeCommand;
      if (!command) {
        return transcriptFromPlainText(
          "[cli transcription provider not configured] Set CLI_TRANSCRIBE_COMMAND to enable CLI-based transcription.",
        );
      }

      if (input.type !== "audio-base64") {
        return transcriptFromPlainText("");
      }

      const audioBytes = Buffer.from(input.content, "base64");
      const args = [];
      if (input.language) args.push("--language", input.language);
      if (input.country) args.push("--country", input.country);
      if (input.locale) args.push("--locale", input.locale);
      if (input.mimeType) args.push("--mime-type", input.mimeType);

      const text = await runCliCommand({
        command,
        args,
        stdin: audioBytes,
        timeoutMs: config.cli?.timeoutMs || 120000,
      });

      return transcriptFromPlainText(text, { language: input.language });
    },
  };
}
