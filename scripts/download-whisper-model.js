#!/usr/bin/env node
/**
 * Pre-downloads the Whisper ONNX model into the build staging area
 * so it can be bundled with the "full" Electron build.
 *
 * Usage: node scripts/download-whisper-model.js
 */
import { pipeline } from "@huggingface/transformers";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const MODEL = process.env.STREAMING_WHISPER_MODEL || "onnx-community/kb-whisper-large-ONNX";
const STAGING_DIR = resolve("build/extraResources/models/whisper");

mkdirSync(STAGING_DIR, { recursive: true });

console.log(`Downloading ${MODEL} (q4) into ${STAGING_DIR} ...`);
console.log("This may take several minutes on first run.\n");

const transcriber = await pipeline("automatic-speech-recognition", MODEL, {
  dtype: "q4",
  cache_dir: STAGING_DIR,
});

// Quick sanity check — run on 1 second of silence
const silence = new Float32Array(16000);
const result = await transcriber(silence, { language: "sv", task: "transcribe" });
console.log(`\nSanity check (silence): "${result.text}"`);
console.log(`\nWhisper model downloaded to: ${STAGING_DIR}`);
