import { app, BrowserWindow } from "electron";
import { fork } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";
import http from "node:http";
import { hasBundledLlm, hasBundledWhisper, startLlamaServer, stopLlamaServer } from "./llamaServer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverProcess = null;
let llamaProcess = null;
let mainWindow = null;

/**
 * Find a free TCP port by briefly binding to port 0.
 */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

/**
 * Poll the server's /health endpoint until it responds with 200.
 */
function waitForServer(port, timeoutMs = 30_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function attempt() {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Server did not become ready within ${timeoutMs}ms`));
      }

      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          res.resume();
          return resolve();
        }
        res.resume();
        setTimeout(attempt, 200);
      });

      req.on("error", () => {
        setTimeout(attempt, 200);
      });

      req.setTimeout(2000, () => {
        req.destroy();
        setTimeout(attempt, 200);
      });
    }

    attempt();
  });
}

/**
 * Start the Node.js server (src/index.js) as a forked child process.
 */
function startServer(port, extraEnv = {}) {
  // Resolve the path to src/index.js relative to the project root.
  // In development: project root is one level up from electron/
  // In packaged app (asar): project root is the asar base
  const projectRoot = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar")
    : path.resolve(__dirname, "..");

  const serverEntry = path.join(projectRoot, "src", "index.js");

  serverProcess = fork(serverEntry, [], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      ...extraEnv,
    },
    stdio: ["pipe", "pipe", "pipe", "ipc"],
  });

  serverProcess.stdout?.on("data", (data) => {
    console.log(`[server] ${data.toString().trimEnd()}`);
  });

  serverProcess.stderr?.on("data", (data) => {
    console.error(`[server] ${data.toString().trimEnd()}`);
  });

  serverProcess.on("exit", (code) => {
    console.log(`[server] Process exited with code ${code}`);
    serverProcess = null;
  });
}

/**
 * Create the main BrowserWindow.
 */
function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Open Medical Scribe",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  // Prevent the title from being overwritten by the page <title>
  mainWindow.on("page-title-updated", (event) => {
    event.preventDefault();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * Shut down the forked server process.
 */
function killServer() {
  if (serverProcess) {
    console.log("[electron] Shutting down server process...");
    serverProcess.kill("SIGTERM");
    // Force-kill after a short grace period
    setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill("SIGKILL");
      }
    }, 3000);
  }
}

// ── App lifecycle ──────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    const port = await findFreePort();
    console.log(`[electron] Starting server on port ${port}...`);

    const extraEnv = {};
    const resources = process.resourcesPath;

    // Detect bundled Whisper ONNX model
    if (hasBundledWhisper(resources)) {
      const whisperDir = path.join(resources, "models", "whisper");
      extraEnv.BUNDLED_WHISPER_CACHE_DIR = whisperDir;
      console.log(`[electron] Bundled Whisper model found at ${whisperDir}`);
    }

    // Detect and start bundled LLM (llama-server)
    if (hasBundledLlm(resources)) {
      console.log("[electron] Bundled LLM found, starting llama-server...");
      const llama = await startLlamaServer(resources);
      llamaProcess = llama.process;
      extraEnv.NOTE_PROVIDER = "openai";
      extraEnv.OPENAI_BASE_URL = llama.baseUrl;
      extraEnv.OPENAI_API_KEY = "not-needed";
      extraEnv.OPENAI_NOTE_MODEL = "local";
      console.log(`[electron] llama-server ready at ${llama.baseUrl}`);
    }

    startServer(port, extraEnv);
    await waitForServer(port);

    console.log(`[electron] Server is ready at http://127.0.0.1:${port}`);
    createWindow(port);
  } catch (err) {
    console.error("[electron] Failed to start:", err);
    stopLlamaServer(llamaProcess);
    killServer();
    app.quit();
  }
});

app.on("window-all-closed", () => {
  stopLlamaServer(llamaProcess);
  killServer();
  app.quit();
});

app.on("before-quit", () => {
  stopLlamaServer(llamaProcess);
  killServer();
});

// macOS: re-create window when dock icon is clicked and no windows are open
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverProcess) {
    // We'd need the port again; simplest approach is to quit & relaunch
    // For now, this case is unlikely because we quit on window-all-closed
  }
});
