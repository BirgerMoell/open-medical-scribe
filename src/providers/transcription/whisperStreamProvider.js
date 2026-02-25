/**
 * Streaming transcription provider using @huggingface/transformers
 * with ONNX Whisper models (e.g. onnx-community/kb-whisper-large-ONNX).
 *
 * Buffers incoming PCM16 audio and periodically runs whisper inference
 * on the accumulated audio, sending interim results back to the client.
 */
import { pipeline } from "@huggingface/transformers";
import { existsSync } from "node:fs";

const DEFAULT_MODEL = "onnx-community/kb-whisper-large-ONNX";
const DEFAULT_INTERVAL_MS = 3000;
const MIN_SAMPLES = 8000; // 0.5s at 16kHz — skip transcription below this
const SILENCE_RMS_THRESHOLD = 0.01;
const SILENCE_DURATION_MS = 1500;

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
    console.log(`[whisper-stream] Using bundled model from: ${bundledDir}`);
  }

  console.log(`[whisper-stream] Loading model: ${model} ...`);
  pipelinePromise = pipeline("automatic-speech-recognition", model, opts);
  cachedPipeline = await pipelinePromise;
  pipelinePromise = null;
  console.log(`[whisper-stream] Model loaded.`);
  return cachedPipeline;
}

export function createWhisperStreamProvider(config) {
  const model = config.streaming.whisperModel || DEFAULT_MODEL;
  const language = config.streaming.whisperLanguage || "sv";
  const intervalMs = config.streaming.whisperIntervalMs || DEFAULT_INTERVAL_MS;

  return {
    name: "whisper-stream",

    createSession({
      language: sessionLang,
      onResult,
      onUtteranceEnd,
      onError,
      onClose,
    }) {
      const chunks = []; // Float32Array segments
      let totalSamples = 0;
      let transcribedUpTo = 0;
      let pendingText = "";
      let closed = false;
      let transcribing = false;
      let silentSince = null;
      let timer = null;

      // Start loading the model immediately
      const transcriberReady = getTranscriber(model).catch((err) => {
        onError(err);
      });

      function pcm16ToFloat32(pcm16Buf) {
        const int16 = new Int16Array(
          pcm16Buf.buffer,
          pcm16Buf.byteOffset,
          pcm16Buf.byteLength / 2,
        );
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768.0;
        }
        return float32;
      }

      function getAudioSegment(fromSample, toSample) {
        const length = toSample - fromSample;
        const result = new Float32Array(length);
        let offset = 0;
        let chunkStart = 0;

        for (const chunk of chunks) {
          const chunkEnd = chunkStart + chunk.length;
          if (chunkEnd <= fromSample) {
            chunkStart = chunkEnd;
            continue;
          }
          if (chunkStart >= toSample) break;

          const copyFrom = Math.max(0, fromSample - chunkStart);
          const copyTo = Math.min(chunk.length, toSample - chunkStart);
          const sub = chunk.subarray(copyFrom, copyTo);
          result.set(sub, offset);
          offset += sub.length;
          chunkStart = chunkEnd;
        }
        return result;
      }

      function computeRms(float32) {
        if (!float32.length) return 0;
        let sum = 0;
        for (let i = 0; i < float32.length; i++) {
          sum += float32[i] * float32[i];
        }
        return Math.sqrt(sum / float32.length);
      }

      async function transcribeSegment(fromSample, toSample, isFinal) {
        if (transcribing || closed) return;
        if (toSample - fromSample < MIN_SAMPLES) return;

        transcribing = true;
        try {
          const transcriber = await transcriberReady;
          if (!transcriber || closed) return;

          const audio = getAudioSegment(fromSample, toSample);

          // Skip transcription if audio is mostly silence (prevents hallucinations)
          const rms = computeRms(audio);
          if (rms < SILENCE_RMS_THRESHOLD && !isFinal) return;

          const lang = sessionLang || language;
          const result = await transcriber(audio, {
            language: lang,
            task: "transcribe",
          });

          if (closed) return;
          const text = (result.text || "").trim();
          if (!text && !isFinal) return;

          if (text !== pendingText || isFinal) {
            pendingText = isFinal ? "" : text;
            onResult({
              text,
              speaker: -1,
              isFinal,
              speechFinal: isFinal,
              words: [],
            });

            if (isFinal && text) {
              transcribedUpTo = toSample;
              onUtteranceEnd();
            }
          }
        } catch (err) {
          if (!closed) onError(err);
        } finally {
          transcribing = false;
        }
      }

      // Periodic transcription
      timer = setInterval(() => {
        if (closed || totalSamples - transcribedUpTo < MIN_SAMPLES) return;
        transcribeSegment(transcribedUpTo, totalSamples, false);
      }, intervalMs);

      return {
        sendAudio(pcm16Buffer) {
          if (closed) return;
          const float32 = pcm16ToFloat32(pcm16Buffer);
          chunks.push(float32);
          totalSamples += float32.length;

          // Simple silence detection
          const rms = computeRms(float32);
          if (rms < SILENCE_RMS_THRESHOLD) {
            if (!silentSince) silentSince = Date.now();
            else if (
              Date.now() - silentSince >= SILENCE_DURATION_MS &&
              pendingText
            ) {
              silentSince = null;
              transcribeSegment(transcribedUpTo, totalSamples, true);
            }
          } else {
            silentSince = null;
          }
        },

        async close() {
          if (closed) return;
          closed = true;
          if (timer) clearInterval(timer);

          // Final transcription of any remaining audio
          if (totalSamples > transcribedUpTo + MIN_SAMPLES) {
            // Wait for any in-flight transcription to finish
            while (transcribing) {
              await new Promise((r) => setTimeout(r, 100));
            }
            transcribing = true;
            try {
              const transcriber = await transcriberReady;
              if (transcriber) {
                const audio = getAudioSegment(transcribedUpTo, totalSamples);
                const lang = sessionLang || language;
                const result = await transcriber(audio, {
                  language: lang,
                  task: "transcribe",
                });
                const text = (result.text || "").trim();
                if (text) {
                  onResult({
                    text,
                    speaker: -1,
                    isFinal: true,
                    speechFinal: true,
                    words: [],
                  });
                  onUtteranceEnd();
                }
              }
            } catch {
              // Ignore errors during final cleanup
            }
            transcribing = false;
          }

          onClose();
        },
      };
    },
  };
}
