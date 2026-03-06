import { createServer } from "node:http";
import { createApp } from "../src/server/createApp.js";
import { attachStreamHandler } from "../src/server/streamHandler.js";
import { loadConfig } from "../src/config.js";
import { loadDotEnv } from "../src/util/env.js";

loadDotEnv();

process.env.SCRIBE_MODE = "api";
process.env.TRANSCRIPTION_PROVIDER = "berget";
process.env.NOTE_PROVIDER = "berget";
process.env.PORT = "8799";
process.env.BERGET_TRANSCRIBE_MODEL = "KBLab/kb-whisper-large";
process.env.BERGET_NOTE_MODEL = "openai/gpt-oss-120b";

const config = loadConfig(process.env);
const app = createApp({ config });

const server = createServer(app.handler);
attachStreamHandler(server, config);

server.listen(config.port, () => {
  console.log(
    `[open-medical-scribe] listening on http://localhost:${config.port} (mode=${config.scribeMode}, tx=${config.transcriptionProvider}, note=${config.noteProvider}, stream=${config.streaming.transcriptionProvider})`,
  );
});
