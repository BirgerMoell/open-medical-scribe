/**
 * Manages a bundled llama-server (llama.cpp) child process for the full build.
 * Provides an OpenAI-compatible API at http://127.0.0.1:{port}/v1 so the
 * existing openAiProvider.js can be used for note generation without Ollama.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import http from "node:http";

/**
 * Check whether the full build includes an LLM (llama-server + GGUF model).
 */
export function hasBundledLlm(resourcesPath) {
  if (!resourcesPath) return false;
  const binaryName = process.platform === "win32" ? "llama-server.exe" : "llama-server";
  const binPath = join(resourcesPath, "bin", binaryName);
  const modelDir = join(resourcesPath, "models", "llm");
  if (!existsSync(binPath) || !existsSync(modelDir)) return false;
  return readdirSync(modelDir).some((f) => f.endsWith(".gguf"));
}

/**
 * Check whether the full build includes the Whisper ONNX model.
 */
export function hasBundledWhisper(resourcesPath) {
  if (!resourcesPath) return false;
  const whisperDir = join(resourcesPath, "models", "whisper");
  return existsSync(whisperDir);
}

/**
 * Find a free TCP port.
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
 * Poll until llama-server's /health endpoint responds 200.
 */
function waitForHealth(port, timeoutMs = 120_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function attempt() {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`llama-server did not become ready within ${timeoutMs}ms`));
      }
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        setTimeout(attempt, 500);
      });
      req.on("error", () => setTimeout(attempt, 500));
      req.setTimeout(2000, () => { req.destroy(); setTimeout(attempt, 500); });
    }
    attempt();
  });
}

/**
 * Start the bundled llama-server.
 * Returns { process, port, baseUrl } on success.
 */
export async function startLlamaServer(resourcesPath) {
  const binaryName = process.platform === "win32" ? "llama-server.exe" : "llama-server";
  const binPath = join(resourcesPath, "bin", binaryName);
  const modelDir = join(resourcesPath, "models", "llm");
  const ggufFile = readdirSync(modelDir).find((f) => f.endsWith(".gguf"));
  if (!ggufFile) throw new Error("No .gguf model found in bundled models/llm/");

  const modelPath = join(modelDir, ggufFile);
  const port = await findFreePort();

  console.log(`[llama-server] Starting on port ${port} with model ${ggufFile}...`);

  const proc = spawn(binPath, [
    "--model", modelPath,
    "--port", String(port),
    "--host", "127.0.0.1",
    "--ctx-size", "4096",
    "--n-gpu-layers", "999",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  proc.stdout?.on("data", (d) => console.log(`[llama-server] ${d.toString().trimEnd()}`));
  proc.stderr?.on("data", (d) => console.error(`[llama-server] ${d.toString().trimEnd()}`));
  proc.on("exit", (code) => console.log(`[llama-server] Exited with code ${code}`));

  await waitForHealth(port);
  console.log(`[llama-server] Ready at http://127.0.0.1:${port}`);

  return { process: proc, port, baseUrl: `http://127.0.0.1:${port}` };
}

/**
 * Gracefully stop the llama-server process.
 */
export function stopLlamaServer(proc) {
  if (!proc) return;
  console.log("[llama-server] Shutting down...");
  proc.kill("SIGTERM");
  setTimeout(() => {
    try { proc.kill("SIGKILL"); } catch { /* already dead */ }
  }, 3000);
}
