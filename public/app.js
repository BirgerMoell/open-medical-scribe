import { initStreaming } from "/stream.js";

const recordBtn = document.getElementById("record-btn");
const recDot = document.getElementById("rec-dot");
const recLabel = document.getElementById("rec-label");
const transcriptSection = document.getElementById("transcript-section");
const transcriptEl = document.getElementById("transcript");
const txModelEl = document.getElementById("tx-model");
const noteSection = document.getElementById("note-section");
const noteEl = document.getElementById("note");
const noteStatus = document.getElementById("note-status");
const noteModelEl = document.getElementById("note-model");
const copyBtn = document.getElementById("copy-btn");

const LOCAL_PROVIDERS = new Set([
  "ollama", "whisper.cpp", "faster-whisper", "mock", "whisper-stream", "whisper-onnx",
]);

let settings = {};
let mediaRecorder = null;
let recordingChunks = [];
let recordedBlob = null;
let recordedMimeType = "";
let recordingStartedAt = 0;
let timerInterval = null;
let speechRecognition = null;
let speechFinalTranscript = "";
let speechInterimTranscript = "";
let speechShouldRun = false;
let isRecording = false;

// Streaming state
let streamClient = null;
let streamFinalTranscript = "";
let streamInterimText = "";
let streamFallbackTimer = null;
let noteGenerationStarted = false;

boot();

async function boot() {
  await loadSettings();
  setupSpeech();
  recordBtn.addEventListener("click", toggle);
  copyBtn.addEventListener("click", copyNote);
}

async function loadSettings() {
  try {
    const res = await fetch("/v1/settings");
    settings = await res.json();
    settings.country = settings.defaultCountry || detectCountry();
  } catch {
    settings = {};
    settings.country = detectCountry();
  }
}

// True when real-time streaming should be used:
// either the streaming provider is explicitly set, or whisper-onnx is selected
function useStreamingTranscription() {
  const tx = settings.transcriptionProvider || "mock";
  if (tx === "whisper-onnx") return true;
  const p = settings.streaming?.transcriptionProvider || "mock-stream";
  return p !== "mock-stream";
}

// True when a batch server-side transcription provider is configured (not mock)
function useServerTranscription() {
  const p = settings.transcriptionProvider || "mock";
  return p !== "mock";
}

function modelLabel(provider, model) {
  const isLocal = LOCAL_PROVIDERS.has(provider);
  const tag = isLocal ? "local" : "cloud";
  return `${provider} / ${model || "default"} (${tag})`;
}

function txModelLabel() {
  const provider = settings.transcriptionProvider || "mock";
  if (provider === "whisper-onnx") {
    const m = settings.streaming?.whisperModel || "onnx-community/kb-whisper-large-ONNX";
    return modelLabel("whisper-onnx", m);
  }
  // If streaming is active via streaming settings, show that
  if (useStreamingTranscription()) {
    const p = settings.streaming?.transcriptionProvider || "mock-stream";
    const m = settings.streaming?.whisperModel || p;
    return modelLabel(p, m);
  }
  const modelMap = {
    openai: settings.openai?.transcribeModel,
    deepgram: settings.deepgram?.model,
    google: settings.google?.speechModel,
    berget: settings.berget?.transcribeModel,
    "whisper.cpp": "whisper.cpp",
    "faster-whisper": "faster-whisper",
    mock: "mock",
  };
  return modelLabel(provider, modelMap[provider] || provider);
}

function noteModelLabel() {
  const provider = settings.noteProvider || "mock";
  const modelMap = {
    openai: settings.openai?.noteModel,
    anthropic: settings.anthropic?.model,
    gemini: settings.gemini?.model,
    ollama: settings.ollama?.model,
    mock: "mock",
  };
  return modelLabel(provider, modelMap[provider] || provider);
}

function detectCountry() {
  const lang = navigator.language || "en-US";
  const parts = lang.split("-");
  const region = parts.length > 1 ? parts[1].toUpperCase() : "US";
  const supported = { SE: "SE", US: "US", GB: "GB", NO: "NO", DK: "DK", DE: "DE" };
  return supported[region] || "US";
}

function getLocale(country) {
  const map = {
    SE: { locale: "sv-SE", lang: "sv" },
    US: { locale: "en-US", lang: "en" },
    GB: { locale: "en-GB", lang: "en" },
    NO: { locale: "nb-NO", lang: "no" },
    DK: { locale: "da-DK", lang: "da" },
    DE: { locale: "de-DE", lang: "de" },
  };
  return map[country] || map.US;
}

function setupSpeech() {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return;

  speechRecognition = new Ctor();
  speechRecognition.continuous = true;
  speechRecognition.interimResults = true;
  speechRecognition.lang = getLocale(settings.country).locale;

  speechRecognition.addEventListener("result", (e) => {
    const finals = [];
    const interims = [];
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const text = e.results[i]?.[0]?.transcript || "";
      if (!text) continue;
      if (e.results[i].isFinal) finals.push(text);
      else interims.push(text);
    }
    if (finals.length) {
      speechFinalTranscript = [speechFinalTranscript, ...finals]
        .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    }
    speechInterimTranscript = interims.join(" ").replace(/\s+/g, " ").trim();
    renderTranscript();
  });

  speechRecognition.addEventListener("end", () => {
    if (speechShouldRun) {
      try { speechRecognition.start(); } catch { /* race */ }
    }
  });
}

// ─── Streaming callbacks ──────────────────────────────────────────────

function handleStreamTranscript(msg) {
  if (msg.isFinal) {
    streamFinalTranscript = [streamFinalTranscript, msg.text]
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    streamInterimText = "";
  } else {
    streamInterimText = msg.text || "";
  }
  renderStreamTranscript();
}

function handleStreamUtteranceEnd() {
  // Utterance boundary — no special action needed
}

function handleStreamSessionEnd(msg) {
  // Use the server-assembled full transcript if available
  const transcript = msg.fullTranscript || streamFinalTranscript;
  streamFinalTranscript = transcript;
  streamInterimText = "";
  renderStreamTranscript();
  // Guard against double note generation
  if (streamFallbackTimer) { clearTimeout(streamFallbackTimer); streamFallbackTimer = null; }
  noteGenerationStarted = true;
  generateNoteFromTranscript(transcript);
}

function handleStreamStateChange() {
  // Could update UI with streaming state
}

function handleStreamError(err) {
  console.error("[stream]", err);
}

function renderStreamTranscript() {
  const display = [streamFinalTranscript, streamInterimText]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  transcriptEl.textContent = display || "";
}

// ─── Recording ────────────────────────────────────────────────────────

async function toggle() {
  if (isRecording) stopRecording();
  else await startRecording();
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMime();
    recordingChunks = [];
    recordedBlob = null;
    recordedMimeType = mimeType || "";
    speechFinalTranscript = "";
    speechInterimTranscript = "";
    streamFinalTranscript = "";
    streamInterimText = "";
    noteGenerationStarted = false;
    if (streamFallbackTimer) { clearTimeout(streamFallbackTimer); streamFallbackTimer = null; }

    mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    mediaRecorder.addEventListener("dataavailable", (e) => {
      if (e.data?.size > 0) recordingChunks.push(e.data);
    });

    mediaRecorder.addEventListener("stop", () => {
      const type = mediaRecorder.mimeType || recordedMimeType || "audio/webm";
      recordedBlob = new Blob(recordingChunks, { type });
      recordedMimeType = type;
      for (const track of mediaRecorder.stream.getTracks()) track.stop();
    });

    mediaRecorder.start(250);

    // Choose transcription mode
    if (useStreamingTranscription()) {
      // Real-time streaming via WebSocket
      streamClient = initStreaming({
        onTranscript: handleStreamTranscript,
        onUtteranceEnd: handleStreamUtteranceEnd,
        onSessionEnd: handleStreamSessionEnd,
        onStateChange: handleStreamStateChange,
        onError: handleStreamError,
      });
      const locale = getLocale(settings.country);
      await streamClient.start({
        language: locale.lang,
        country: settings.country,
      });
    } else if (!useServerTranscription()) {
      // Browser SpeechRecognition for live preview (mock provider only)
      startSpeech();
    }

    isRecording = true;
    recordingStartedAt = Date.now();
    startTimer();

    recordBtn.classList.add("is-recording");
    recDot.classList.add("is-live");
    transcriptSection.hidden = false;
    transcriptEl.textContent = "";
    txModelEl.textContent = txModelLabel();
    noteSection.hidden = true;
  } catch {
    recLabel.textContent = "Microphone access denied";
  }
}

function stopRecording() {
  isRecording = false;
  stopSpeech();
  stopTimer();

  recordBtn.classList.remove("is-recording");
  recDot.classList.remove("is-live");
  recLabel.textContent = "Processing...";

  if (streamClient?.isStreaming) {
    // Stop streaming — the session_end callback will trigger note generation
    streamClient.stop();
    // Also stop MediaRecorder
    if (mediaRecorder?.state === "recording") mediaRecorder.stop();
    // Fallback: if session_end doesn't arrive in 30s, use what we have
    streamFallbackTimer = setTimeout(() => {
      if (!noteGenerationStarted) {
        const transcript = streamFinalTranscript || "";
        generateNoteFromTranscript(transcript);
      }
    }, 30000);
  } else if (mediaRecorder?.state === "recording") {
    // Batch mode — wait for blob then generate note
    mediaRecorder.addEventListener("stop", () => generateNote(), { once: true });
    mediaRecorder.stop();
  } else {
    generateNote();
  }
}

function startSpeech() {
  if (!speechRecognition) return;
  speechShouldRun = true;
  try { speechRecognition.start(); } catch { /* */ }
}

function stopSpeech() {
  speechShouldRun = false;
  if (!speechRecognition) return;
  try { speechRecognition.stop(); } catch { /* */ }
}

function startTimer() {
  stopTimer();
  setTimer(0);
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - recordingStartedAt) / 1000);
    setTimer(s);
  }, 250);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function setTimer(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  recLabel.textContent = `${mm}:${ss}`;
}

function renderTranscript() {
  const text = [speechFinalTranscript, speechInterimTranscript]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  transcriptEl.textContent = text || "";
}

// ─── Transcription & Note Generation ──────────────────────────────────

async function uploadForTranscription() {
  if (!recordedBlob) return null;
  const locale = getLocale(settings.country);
  const ext = mimeExt(recordedMimeType);
  const file = new File([recordedBlob], `recording.${ext}`, { type: recordedMimeType });
  const form = new FormData();
  form.append("audio", file, file.name);
  const res = await fetch("/v1/transcribe/upload", {
    method: "POST",
    body: form,
    headers: {
      "X-Scribe-Language": locale.lang,
      "X-Scribe-Locale": locale.locale,
      "X-Scribe-Country": settings.country,
    },
  });
  const data = await res.json();
  if (res.ok && data.transcript) return data.transcript;
  return null;
}

async function generateNote() {
  let transcript = "";

  if (useServerTranscription()) {
    recLabel.textContent = "Transcribing...";
    try {
      transcript = await uploadForTranscription() || "";
    } catch { /* */ }
  } else {
    transcript = [speechFinalTranscript, speechInterimTranscript]
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }

  if (transcript) {
    transcriptEl.textContent = transcript;
  }

  await generateNoteFromTranscript(transcript);
}

async function generateNoteFromTranscript(transcript) {
  if (!transcript) {
    recLabel.textContent = "Tap to record";
    noteSection.hidden = false;
    noteStatus.textContent = "";
    noteEl.textContent = "No speech detected. Try again.";
    noteModelEl.textContent = "";
    return;
  }

  noteSection.hidden = false;
  noteSection.classList.remove("fade-in");
  noteStatus.textContent = "Generating note...";
  noteEl.textContent = "";
  noteModelEl.textContent = noteModelLabel();

  const locale = getLocale(settings.country);
  const noteStyle = settings.defaultNoteStyle || "soap";
  const specialty = settings.defaultSpecialty || "primary-care";

  try {
    const res = await fetch("/v1/encounters/scribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript,
        country: settings.country,
        noteStyle,
        specialty,
        locale: locale.locale,
        language: locale.lang,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    noteStatus.textContent = "";
    noteEl.textContent = data.noteDraft || "No note generated.";
    noteSection.classList.add("fade-in");
    recLabel.textContent = "Tap to record";
  } catch (err) {
    noteStatus.textContent = "";
    noteEl.textContent = `Error: ${err.message}`;
    recLabel.textContent = "Tap to record";
  }
}

// ─── Utilities ────────────────────────────────────────────────────────

async function copyNote() {
  const text = noteEl.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "Copied";
    setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
  } catch {
    const range = document.createRange();
    range.selectNodeContents(noteEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("copy");
  }
}

function pickMime() {
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return "";
}

function mimeExt(mime) {
  const s = String(mime || "").toLowerCase();
  if (s.includes("webm")) return "webm";
  if (s.includes("ogg")) return "ogg";
  if (s.includes("mp4") || s.includes("m4a")) return "m4a";
  return "bin";
}
