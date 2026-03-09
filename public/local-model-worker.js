import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
import * as webllm from "https://esm.run/@mlc-ai/web-llm@0.2.81";

const TRANSCRIPTION_MODELS = {
  webgpu: "Xenova/whisper-small",
  wasm: "Xenova/whisper-tiny",
};

const NOTE_MODEL = "Qwen3-0.6B-q4f16_1-MLC";

const LANGUAGE_NAMES = {
  sv: "swedish",
  en: "english",
  no: "norwegian",
  nb: "norwegian",
  da: "danish",
  de: "german",
  fi: "finnish",
  fr: "french",
  es: "spanish",
  it: "italian",
  pt: "portuguese",
  nl: "dutch",
};

let transcriptionCache = {
  key: null,
  pipeline: null,
};

let llmEngine = null;
let llmModelId = null;

self.onmessage = async (event) => {
  const { id, type, payload } = event.data || {};

  try {
    switch (type) {
      case "transcribe": {
        const result = await transcribeLocally(payload);
        postMessage({ id, type: "result", payload: result });
        break;
      }
      case "draft-note": {
        const result = await draftNoteLocally(payload);
        postMessage({ id, type: "result", payload: result });
        break;
      }
      default:
        throw new Error(`Unsupported worker request: ${type}`);
    }
  } catch (error) {
    postMessage({
      id,
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

async function transcribeLocally({
  audioBuffer,
  supportsWebGPU,
  language,
}) {
  const pipelineKey = supportsWebGPU ? "webgpu" : "wasm";
  const transcriber = await getTranscriber(pipelineKey);
  const localizedLanguage = LANGUAGE_NAMES[String(language || "").toLowerCase()] || undefined;

  postProgress("local-transcription", "Transcribing locally", supportsWebGPU
    ? "Running Whisper in the browser with WebGPU."
    : "Running Whisper in the browser with WebAssembly.");

  const output = await transcriber(new Float32Array(audioBuffer), {
    return_timestamps: "word",
    chunk_length_s: 30,
    stride_length_s: 5,
    task: "transcribe",
    ...(localizedLanguage ? { language: localizedLanguage } : {}),
  });

  return {
    text: output.text || "",
    chunks: output.chunks || [],
    providerLabel: supportsWebGPU ? "Local Whisper (WebGPU)" : "Local Whisper (WASM)",
  };
}

async function draftNoteLocally({
  transcript,
  noteStyle,
  locale,
  language,
  supportsWebGPU,
}) {
  if (!supportsWebGPU) {
    return {
      noteDraft: buildTemplateNote(transcript, noteStyle, locale),
      providerLabel: "Local template",
      warning: "WebGPU was not available, so Eir used a deterministic local note template instead of a local LLM.",
    };
  }

  const engine = await getLlmEngine();
  postProgress("local-note", "Drafting locally", "Running Qwen in the browser on WebGPU.");

  const prompt = buildPrompt({ transcript, noteStyle, locale, language });
  const response = await engine.chat.completions.create({
    messages: prompt,
    temperature: 0.2,
    max_tokens: 420,
    response_format: { type: "json_object" },
    enable_thinking: false,
  });

  const content = response.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    parsed = { noteDraft: String(content || "").trim() };
  }

  const noteDraft = String(parsed.noteDraft || "").trim() || buildTemplateNote(transcript, noteStyle, locale);

  return {
    noteDraft,
    providerLabel: `Local ${NOTE_MODEL}`,
  };
}

async function getTranscriber(pipelineKey) {
  if (transcriptionCache.pipeline && transcriptionCache.key === pipelineKey) {
    return transcriptionCache.pipeline;
  }

  const model = TRANSCRIPTION_MODELS[pipelineKey];
  postProgress(
    "local-transcription",
    "Preparing local transcription",
    `Loading ${model} for browser transcription.`,
  );

  const transcriber = await pipeline("automatic-speech-recognition", model, {
    device: pipelineKey === "webgpu" ? "webgpu" : undefined,
    progress_callback: (progress) => {
      postModelProgress("local-transcription", progress);
    },
  });

  transcriptionCache = {
    key: pipelineKey,
    pipeline: transcriber,
  };
  return transcriber;
}

async function getLlmEngine() {
  if (llmEngine && llmModelId === NOTE_MODEL) {
    return llmEngine;
  }

  postProgress("local-note", "Preparing local note model", `Loading ${NOTE_MODEL}.`);
  llmEngine = await webllm.CreateMLCEngine(NOTE_MODEL, {
    initProgressCallback: (progress) => {
      const progressValue = typeof progress.progress === "number"
        ? Math.max(0, Math.min(1, progress.progress))
        : null;
      postMessage({
        type: "progress",
        payload: {
          stage: "local-note",
          title: progress.text || "Preparing local note model",
          detail: progressValue === null ? NOTE_MODEL : `${NOTE_MODEL} ${Math.round(progressValue * 100)}%`,
          progress: progressValue,
        },
      });
    },
  });
  llmModelId = NOTE_MODEL;
  return llmEngine;
}

function postModelProgress(stage, progress) {
  const progressValue = typeof progress.progress === "number"
    ? Math.max(0, Math.min(1, progress.progress))
    : null;

  let detail = progress.file || progress.name || progress.status || "Downloading model assets";
  if (progressValue !== null) {
    detail = `${detail} ${Math.round(progressValue * 100)}%`;
  }

  postMessage({
    type: "progress",
    payload: {
      stage,
      title: stage === "local-transcription" ? "Preparing local transcription" : "Preparing local model",
      detail,
      progress: progressValue,
    },
  });
}

function postProgress(stage, title, detail) {
  postMessage({
    type: "progress",
    payload: {
      stage,
      title,
      detail,
      progress: null,
    },
  });
}

function buildPrompt({ transcript, noteStyle, locale, language }) {
  const outputLanguage = String(language || "").toLowerCase() === "sv" ? "Swedish" : "the input language";
  return [
    {
      role: "system",
      content:
        "You are Eir Scribe, a careful medical scribe. Return strict JSON with exactly one key: noteDraft. " +
        "Do not include markdown. Do not invent facts. If details are uncertain, say so briefly in the note.",
    },
    {
      role: "user",
      content:
        `Write a concise ${noteStyle || "journal"} medical note in ${outputLanguage}. ` +
        `Locale: ${locale || "sv-SE"}. ` +
        "Keep it clinician-friendly and structured for review. Transcript:\n\n" +
        transcript,
    },
  ];
}

function buildTemplateNote(transcript, noteStyle, locale) {
  const firstSentence = transcript.split(/(?<=[.!?])\s+/).find(Boolean) || transcript;
  const style = String(noteStyle || "journal").toLowerCase();
  const isSwedish = String(locale || "").toLowerCase().startsWith("sv");

  if (style === "soap") {
    return isSwedish
      ? `Subjektivt\n${firstSentence}\n\nObjektivt\nUtkast från lokal webbläsarmall. Klinisk granskning krävs.\n\nBedömning\nSammanfattning kräver manuell granskning.\n\nPlan\nVerifiera innehållet och komplettera innan signering.`
      : `Subjective\n${firstSentence}\n\nObjective\nDraft created from the local browser template. Clinical review required.\n\nAssessment\nSummarize after reviewing the transcript.\n\nPlan\nVerify and complete before signing.`;
  }

  return isSwedish
    ? `Kontaktorsak\n${firstSentence}\n\nAnamnes\n${transcript}\n\nBedömning\nLokalt utkast från webbläsaren. Klinisk granskning krävs innan användning.\n\nPlan\nVerifiera fakta, komplettera status och signera först efter manuell kontroll.`
    : `Chief concern\n${firstSentence}\n\nHistory\n${transcript}\n\nAssessment\nLocal browser draft. Clinical review is required before use.\n\nPlan\nVerify facts, add exam details, and sign only after manual review.`;
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return "{}";
  }
  return text.slice(start, end + 1);
}
