import { spawn } from "node:child_process";

export function createWhisperCppTranscriptionProvider(config) {
  return {
    name: config.transcriptionProvider,
    async transcribe(input) {
      if (input.type === "text-simulated-audio") {
        return { text: input.content };
      }

      const command = config.whisper.localCommand;
      if (!command) {
        return {
          text: `[${config.transcriptionProvider} placeholder] Set WHISPER_LOCAL_COMMAND to enable local transcription execution.`,
        };
      }

      if (input.type !== "audio-base64") {
        return { text: "" };
      }

      const audioBytes = Buffer.from(input.content, "base64");
      const transcript = await runLocalTranscriptionCommand({
        command,
        audioBytes,
        mimeType: input.mimeType,
        timeoutMs: config.whisper.timeoutMs,
      });
      return { text: transcript };
    },
  };
}

async function runLocalTranscriptionCommand({ command, audioBytes, mimeType, timeoutMs }) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        AUDIO_MIME_TYPE: mimeType || "audio/wav",
      },
    });

    const stdout = [];
    const stderr = [];
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs || 120000);

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const out = Buffer.concat(stdout).toString("utf8").trim();
      const err = Buffer.concat(stderr).toString("utf8").trim();

      if (timedOut) {
        const e = new Error("Local transcription command timed out");
        e.statusCode = 504;
        return reject(e);
      }

      if (code !== 0) {
        const e = new Error(
          `Local transcription command failed (${code}): ${err || "no stderr"}`,
        );
        e.statusCode = 502;
        return reject(e);
      }

      resolve(out || "[local transcription command produced empty output]");
    });

    child.stdin.write(audioBytes);
    child.stdin.end();
  });
}
