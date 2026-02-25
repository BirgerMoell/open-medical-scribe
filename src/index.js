import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { createApp } from "./server/createApp.js";
import { attachStreamHandler } from "./server/streamHandler.js";
import { applySavedSettings } from "./services/settingsStore.js";
import { loadDotEnv } from "./util/env.js";

loadDotEnv();
const config = loadConfig(process.env);
applySavedSettings(config);
const app = createApp({ config });

const server = createServer(app.handler);
attachStreamHandler(server, config);

server.listen(config.port, () => {
  console.log(
    `[open-medical-scribe] listening on http://localhost:${config.port} (mode=${config.scribeMode}, tx=${config.transcriptionProvider}, note=${config.noteProvider}, stream=${config.streaming.transcriptionProvider})`,
  );
});
