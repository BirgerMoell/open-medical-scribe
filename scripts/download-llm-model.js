#!/usr/bin/env node
/**
 * Downloads llama-server binary and a GGUF model for the "full" Electron build.
 *
 * Usage: node scripts/download-llm-model.js
 *
 * Downloads:
 *  1. llama-server from llama.cpp GitHub releases (platform-specific)
 *  2. Meta-Llama-3.1-8B-Instruct Q4_K_M GGUF from HuggingFace
 */
import { mkdirSync, existsSync, createWriteStream, chmodSync, readdirSync, renameSync, unlinkSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { execSync } from "node:child_process";
import { pipeline as streamPipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";

const BIN_DIR = resolve("build/extraResources/bin");
const MODEL_DIR = resolve("build/extraResources/models/llm");

// llama.cpp release tag — update as needed
const LLAMA_CPP_TAG = "b5060";
const GGUF_REPO = "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF";
const GGUF_FILE = "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf";

function getPlatformInfo() {
  const platform = process.env.TARGET_PLATFORM || process.platform;
  const arch = process.env.TARGET_ARCH || process.arch;

  const map = {
    "darwin-arm64": { asset: `llama-${LLAMA_CPP_TAG}-bin-macos-arm64.zip`, binary: "llama-server" },
    "darwin-x64": { asset: `llama-${LLAMA_CPP_TAG}-bin-macos-x64.zip`, binary: "llama-server" },
    "win32-x64": { asset: `llama-${LLAMA_CPP_TAG}-bin-win-avx2-x64.zip`, binary: "llama-server.exe" },
    "linux-x64": { asset: `llama-${LLAMA_CPP_TAG}-bin-ubuntu-x64.zip`, binary: "llama-server" },
  };

  const key = `${platform}-${arch}`;
  const info = map[key];
  if (!info) {
    throw new Error(`Unsupported platform: ${key}. Supported: ${Object.keys(map).join(", ")}`);
  }
  return { ...info, platform, arch };
}

async function downloadFile(url, destPath) {
  console.log(`  Downloading: ${url}`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const fileStream = createWriteStream(destPath);
  await streamPipeline(res.body, fileStream);
}

async function downloadLlamaServer() {
  const info = getPlatformInfo();
  const zipUrl = `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_TAG}/${info.asset}`;

  mkdirSync(BIN_DIR, { recursive: true });
  const zipPath = join(BIN_DIR, info.asset);

  if (existsSync(join(BIN_DIR, info.binary))) {
    console.log(`llama-server already exists at ${BIN_DIR}, skipping download.`);
    return;
  }

  console.log(`\n[1/2] Downloading llama-server for ${info.platform}-${info.arch}...`);
  await downloadFile(zipUrl, zipPath);

  // Extract the zip
  console.log("  Extracting...");
  const tmpExtract = join(BIN_DIR, "_extract");
  mkdirSync(tmpExtract, { recursive: true });
  execSync(`unzip -o -q "${zipPath}" -d "${tmpExtract}"`);

  // Find llama-server binary inside extracted tree
  const binaryName = info.binary;
  let found = null;
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === binaryName) { found = full; return; }
    }
  }
  walk(tmpExtract);

  if (!found) throw new Error(`Could not find ${binaryName} in extracted archive`);

  renameSync(found, join(BIN_DIR, binaryName));
  if (info.platform !== "win32") chmodSync(join(BIN_DIR, binaryName), 0o755);

  // Cleanup
  execSync(`rm -rf "${tmpExtract}" "${zipPath}"`);
  console.log(`  llama-server extracted to ${BIN_DIR}/${binaryName}`);
}

async function downloadGgufModel() {
  mkdirSync(MODEL_DIR, { recursive: true });
  const destPath = join(MODEL_DIR, GGUF_FILE);

  if (existsSync(destPath)) {
    console.log(`\nGGUF model already exists at ${destPath}, skipping download.`);
    return;
  }

  const url = `https://huggingface.co/${GGUF_REPO}/resolve/main/${GGUF_FILE}`;
  console.log(`\n[2/2] Downloading GGUF model (~4.7 GB)...`);
  console.log("  This will take a while.\n");
  await downloadFile(url, destPath);
  console.log(`  Model saved to ${destPath}`);
}

try {
  await downloadLlamaServer();
  await downloadGgufModel();
  console.log("\nAll models downloaded successfully.");
} catch (err) {
  console.error("\nDownload failed:", err.message);
  process.exit(1);
}
