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

const LOCAL_PROVIDERS = new Set(["ollama", "whisper.cpp", "faster-whisper", "mock"]);

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

// True when the user has configured an actual server-side transcription provider
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

    // Only use browser SpeechRecognition for live preview if no server provider is configured
    if (!useServerTranscription()) {
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
  if (mediaRecorder?.state === "recording") mediaRecorder.stop();
  stopSpeech();
  stopTimer();

  recordBtn.classList.remove("is-recording");
  recDot.classList.remove("is-live");
  recLabel.textContent = "Processing...";

  generateNote();
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
    // Always use the configured server provider
    recLabel.textContent = "Transcribing...";
    try {
      transcript = await uploadForTranscription() || "";
    } catch { /* */ }
  } else {
    // Use browser SpeechRecognition result
    transcript = [speechFinalTranscript, speechInterimTranscript]
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }

  if (transcript) {
    transcriptEl.textContent = transcript;
  }

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
