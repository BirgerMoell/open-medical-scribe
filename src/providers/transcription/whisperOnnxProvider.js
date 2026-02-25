/**
 * Batch transcription provider using @huggingface/transformers
 * with ONNX Whisper models (e.g. onnx-community/kb-whisper-large-ONNX).
 *
 * Used for the /v1/transcribe/upload endpoint when transcriptionProvider is "whisper-onnx".
 * Real-time streaming is handled separately by whisperStreamProvider.js.
 */
import { pipeline } from "@huggingface/transformers";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const DEFAULT_MODEL = "onnx-community/kb-whisper-large-ONNX";

let cachedPipeline = null;
let pipelinePromise = null;

async function getTranscriber(model) {
  if (cachedPipeline) return cachedPipeline;
  if (pipelinePromise) return pipelinePromise;

  const opts = { dtype: "q4" };
  const bundledDir = process.env.BUNDLED_WHISPER_CACHE_DIR;
  if (bundledDir && existsSync(bundledDir)) {
    opts.cache_dir = bundledDir;
    opts.local_files_only = true;
    console.log(`[whisper-onnx] Using bundled model from: ${bundledDir}`);
  }

  console.log(`[whisper-onnx] Loading model: ${model} ...`);
  pipelinePromise = pipeline("automatic-speech-recognition", model, opts);
  cachedPipeline = await pipelinePromise;
  pipelinePromise = null;
  console.log(`[whisper-onnx] Model loaded.`);
  return cachedPipeline;
}

export function createWhisperOnnxTranscriptionProvider(config) {
  const model = config.streaming?.whisperModel || DEFAULT_MODEL;
  const language = config.streaming?.whisperLanguage || "sv";

  return {
    name: "whisper-onnx",

    async transcribe({ type, content, mimeType, language: reqLang }) {
      // Pass through simulated text
      if (type === "text-simulated-audio") {
        return { text: content };
      }

      if (type !== "audio-base64" || !content) {
        return { text: "[whisper-onnx] No audio data received." };
      }

      const transcriber = await getTranscriber(model);

      // Decode base64 audio to a temp file — transformers.js can read audio files
      const audioBytes = Buffer.from(content, "base64");
      const ext = mimeToExt(mimeType);
      const tmpDir = join("data", "tmp");
      mkdirSync(tmpDir, { recursive: true });
      const tmpFile = join(tmpDir, `audio-${randomBytes(8).toString("hex")}.${ext}`);

      try {
        writeFileSync(tmpFile, audioBytes);
        const lang = reqLang || language;
        const result = await transcriber(tmpFile, {
          language: lang,
          task: "transcribe",
        });
        return { text: (result.text || "").trim() };
      } finally {
        try { unlinkSync(tmpFile); } catch { /* ignore */ }
      }
    },
  };
}

function mimeToExt(mime) {
  const s = String(mime || "").toLowerCase();
  if (s.includes("mp3") || s.includes("mpeg")) return "mp3";
  if (s.includes("mp4") || s.includes("m4a")) return "m4a";
  if (s.includes("ogg")) return "ogg";
  if (s.includes("flac")) return "flac";
  if (s.includes("webm")) return "webm";
  return "wav";
}
