/**
 * Batch transcription provider using @huggingface/transformers
 * with ONNX Whisper models (e.g. onnx-community/kb-whisper-large-ONNX).
 *
 * Used for the /v1/transcribe/upload endpoint when transcriptionProvider is "whisper-onnx".
 * Real-time streaming is handled separately by whisperStreamProvider.js.
 */
import { pipeline } from "@huggingface/transformers";
import { transcriptFromPlainText } from "./resultAdapter.js";
import { decodeAudioToFloat32 } from "../../util/wav.js";

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
        return transcriptFromPlainText(content, { language: reqLang || language });
      }

      if (type !== "audio-base64" || !content) {
        return transcriptFromPlainText("[whisper-onnx] No audio data received.");
      }

      const transcriber = await getTranscriber(model);
      const audioBytes = Buffer.from(content, "base64");
      const lang = reqLang || language;
      const audio = await decodeAudioToFloat32(audioBytes, 16000);
      const result = await transcriber(audio, {
        language: lang,
        task: "transcribe",
      });
      return transcriptFromPlainText((result.text || "").trim(), {
        language: lang,
        durationSec: result.duration,
      });
    },
  };
}
