import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
import * as webllm from "https://esm.run/@mlc-ai/web-llm@0.2.81";

const TRANSCRIPTION_MODELS = {
  webgpu: {
    id: "KBLab/kb-whisper-base",
    label: "KB Whisper Base",
    subfolder: "onnx",
  },
  wasm: {
    id: "KBLab/kb-whisper-tiny",
    label: "KB Whisper Tiny",
    subfolder: "onnx",
  },
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
  const transcriptionModel = TRANSCRIPTION_MODELS[pipelineKey];

  postProgress({
    stage: "local-transcription",
    stepId: "transcription-run",
    state: "active",
    title: "Transcribing locally",
    detail: supportsWebGPU
      ? `Running ${transcriptionModel.label} on WebGPU.`
      : `Running ${transcriptionModel.label} with WebAssembly.`,
  });

  let output;
  let warning = null;
  try {
    output = await transcriber(new Float32Array(audioBuffer), {
      return_timestamps: "word",
      chunk_length_s: 30,
      stride_length_s: 5,
      task: "transcribe",
      ...(localizedLanguage ? { language: localizedLanguage } : {}),
    });
  } catch (error) {
    if (!requiresAttentionFallback(error)) {
      throw error;
    }

    warning =
      `${transcriptionModel.label} cannot extract word timestamps in this browser export, so Eir fell back to plain transcription text.`;
    postProgress({
      stage: "local-transcription",
      stepId: "transcription-run",
      state: "active",
      title: "Transcribing locally",
      detail: "The browser model does not expose word timestamps. Falling back to plain text transcription.",
    });

    output = await transcriber(new Float32Array(audioBuffer), {
      return_timestamps: false,
      chunk_length_s: 30,
      stride_length_s: 5,
      task: "transcribe",
      ...(localizedLanguage ? { language: localizedLanguage } : {}),
    });
  }

  postProgress({
    stage: "local-transcription",
    stepId: "transcription-run",
    state: "complete",
    title: "Transcription complete",
    detail: `${transcriptionModel.label} finished transcription.`,
    progress: 1,
  });

  return {
    text: output.text || "",
    chunks: output.chunks || [],
    warning,
    providerLabel: supportsWebGPU
      ? `${transcriptionModel.label} (WebGPU)`
      : `${transcriptionModel.label} (WASM)`,
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
  postProgress({
    stage: "local-note",
    stepId: "note-run",
    state: "active",
    title: "Drafting locally",
    detail: "Running Qwen in the browser on WebGPU. Waiting for the first tokens.",
  });

  const prompt = buildPrompt({ transcript, noteStyle, locale, language });
  const stream = await engine.chat.completions.create({
    messages: prompt,
    temperature: 0.2,
    max_tokens: 260,
    stream: true,
    enable_thinking: false,
  });

  let noteDraft = "";
  let receivedAnyToken = false;
  let lastUpdateLength = 0;

  for await (const chunk of stream) {
    const token = chunk.choices?.[0]?.delta?.content || "";
    if (!token) {
      continue;
    }
    noteDraft += token;

    if (!receivedAnyToken) {
      receivedAnyToken = true;
      postProgress({
        stage: "local-note",
        stepId: "note-run",
        state: "active",
        title: "Drafting locally",
        detail: "Qwen started generating tokens on WebGPU.",
      });
    }

    if (noteDraft.length - lastUpdateLength >= 80) {
      lastUpdateLength = noteDraft.length;
      postProgress({
        stage: "local-note",
        stepId: "note-run",
        state: "active",
        title: "Drafting locally",
        detail: `Generated about ${noteDraft.length} characters locally.`,
      });
    }
  }

  noteDraft = sanitizeLocalNoteOutput(noteDraft);
  if (!noteDraft) {
    noteDraft = buildTemplateNote(transcript, noteStyle, locale);
  }

  postProgress({
    stage: "local-note",
    stepId: "note-run",
    state: "complete",
    title: "Draft ready",
    detail: "Qwen finished drafting the note locally.",
    progress: 1,
  });

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
  postProgress({
    stage: "local-transcription",
    stepId: "transcription-download",
    state: "active",
    title: "Downloading Swedish Whisper",
    detail: `Preparing ${model.label} for browser-local transcription.`,
  });

  const transcriber = await pipeline("automatic-speech-recognition", model.id, {
    device: pipelineKey === "webgpu" ? "webgpu" : undefined,
    subfolder: model.subfolder,
    progress_callback: (progress) => {
      postTranscriptionProgress(model, progress);
    },
  });

  postProgress({
    stage: "local-transcription",
    stepId: "transcription-load",
    state: "complete",
    title: "Whisper ready",
    detail: `${model.label} is loaded and warm in the browser cache.`,
    progress: 1,
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

  postProgress({
    stage: "local-note",
    stepId: "note-download",
    state: "active",
    title: "Downloading local Qwen",
    detail: "Preparing the local note model for browser inference.",
  });

  llmEngine = await webllm.CreateMLCEngine(NOTE_MODEL, {
    initProgressCallback: (progress) => {
      postNoteProgress(progress);
    },
  });
  llmModelId = NOTE_MODEL;
  postProgress({
    stage: "local-note",
    stepId: "note-load",
    state: "complete",
    title: "Qwen ready",
    detail: "The local note model is loaded on WebGPU and ready to draft.",
    progress: 1,
  });
  return llmEngine;
}

function postTranscriptionProgress(model, progress) {
  const progressValue = typeof progress.progress === "number"
    ? Math.max(0, Math.min(1, progress.progress))
    : null;

  const statusText = String(progress.status || "").toLowerCase();
  const isReady = statusText === "ready";
  const stepId = isReady
    ? "transcription-load"
    : "transcription-download";
  const title = isReady
    ? "Loading Whisper runtime"
    : "Downloading Swedish Whisper";
  let detail = progress.file || progress.name || progress.status || `Preparing ${model.label}`;
  if (progressValue !== null) {
    detail = `${detail} ${Math.round(progressValue * 100)}%`;
  }

  postProgress({
    stage: "local-transcription",
    stepId,
    state: isReady ? "complete" : "active",
    title,
    detail,
    progress: progressValue,
  });
}

function postNoteProgress(progress) {
  const progressValue = typeof progress.progress === "number"
    ? Math.max(0, Math.min(1, progress.progress))
    : null;
  const text = String(progress.text || "");
  const lowerText = text.toLowerCase();
  const isDownload = lowerText.includes("download") || lowerText.includes("fetch");
  const stepId = isDownload ? "note-download" : "note-load";
  const title = isDownload ? "Downloading local Qwen" : "Loading Qwen on WebGPU";
  const detail = progressValue === null
    ? (text || NOTE_MODEL)
    : `${text || NOTE_MODEL} ${Math.round(progressValue * 100)}%`;

  postProgress({
    stage: "local-note",
    stepId,
    state: progressValue === 1 ? "complete" : "active",
    title,
    detail,
    progress: progressValue,
  });
}

function postProgress({
  stage,
  stepId,
  state,
  title,
  detail,
  progress = null,
}) {
  postMessage({
    type: "progress",
    payload: {
      stage,
      stepId,
      state,
      title,
      detail,
      progress,
    },
  });
}

function buildPrompt({ transcript, noteStyle, locale, language }) {
  const outputLanguage = String(language || "").toLowerCase() === "sv" ? "Swedish" : "the input language";
  return [
    {
      role: "system",
      content:
        "You are Eir Scribe, a careful medical scribe. Return only the note text, with no JSON, no markdown fence, and no commentary before or after the note. " +
        "Do not invent facts. If details are uncertain, say so briefly in the note.",
    },
    {
      role: "user",
      content:
        `Write a concise ${noteStyle || "journal"} medical note in ${outputLanguage}. ` +
        `Locale: ${locale || "sv-SE"}. ` +
        "Keep it clinician-friendly and structured for review. Transcript:\n\n" +
        transcript +
        "\n\nReturn only the final note text.",
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

function sanitizeLocalNoteOutput(text) {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function requiresAttentionFallback(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("cross attentions") || message.includes("output_attentions");
}
