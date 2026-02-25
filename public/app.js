const form = document.getElementById("scribe-form");
const noteEl = document.getElementById("note");
const statusEl = document.getElementById("status");
const runtimeEl = document.getElementById("runtime");
const metaEl = document.getElementById("meta");
const sectionsEl = document.getElementById("sections");
const warningsEl = document.getElementById("warnings");
const fhirOutputEl = document.getElementById("fhir-output");
const recordToggleBtn = document.getElementById("record-toggle");
const recordStateEl = document.getElementById("record-state");
const recordDotEl = document.getElementById("record-dot");
const recordHelpEl = document.getElementById("record-help");
const recordTimerEl = document.getElementById("record-timer");
const recordingPreviewEl = document.getElementById("recording-preview");
const speechStateEl = document.getElementById("speech-state");
const speechTranscriptEl = document.getElementById("speech-transcript");
const audioFileInput = document.getElementById("audio-file");

let lastResult = null;
let mediaRecorder = null;
let recordingChunks = [];
let recordedBlob = null;
let recordedMimeType = "";
let recordingStartedAt = 0;
let timerInterval = null;
let speechRecognition = null;
let speechSupported = false;
let speechFinalTranscript = "";
let speechInterimTranscript = "";
let speechShouldRun = false;
let activeTranscriptSource = "none";

boot();

async function boot() {
  await loadRuntime();
  setupRecorderUi();

  audioFileInput.addEventListener("change", onFileSelected);
  form.country.addEventListener("change", onCountryChanged);
  form.addEventListener("submit", onSubmit);
  onCountryChanged();
}

async function loadRuntime() {
  try {
    const res = await fetch("/config");
    const cfg = await res.json();
    runtimeEl.textContent = `Mode: ${cfg.scribeMode} | Transcription: ${cfg.transcriptionProvider} | Note: ${cfg.noteProvider}`;
  } catch {
    runtimeEl.textContent = "Unable to load runtime config.";
  }
}

function onCountryChanged() {
  const locale = getCountrySettings(form.country.value).speechLocale;
  if (speechRecognition) {
    speechRecognition.lang = locale;
  }
  recordHelpEl.textContent = `Country set to ${countryLabel(form.country.value)}. Browser speech transcription locale: ${locale}.`;
}

function onFileSelected() {
  if (!audioFileInput.files?.[0]) return;
  clearBrowserTranscript({ keepAudioPreview: true });
  activeTranscriptSource = "server-pending";
  setSpeechState("Will use upload");
  speechTranscriptEl.textContent = `Selected file: ${audioFileInput.files[0].name}`;
}

async function onSubmit(event) {
  event.preventDefault();
  setStatus("Generating...");
  warningsEl.innerHTML = "";
  sectionsEl.innerHTML = "";
  metaEl.innerHTML = "";

  try {
    const country = form.country.value;
    const localeConfig = getCountrySettings(country);

    const noteStyle = form.noteStyle?.value || "soap";

    const payload = {
      noteStyle,
      specialty: "primary-care",
      country,
      locale: localeConfig.speechLocale,
      language: localeConfig.transcriptionLanguage,
    };

    const browserTranscript = normalizeWhitespace(
      [speechFinalTranscript, speechInterimTranscript].filter(Boolean).join(" "),
    );
    const uploadedFile = audioFileInput.files?.[0];
    const recordedFile = recordedBlob ? blobToFile(recordedBlob, recordedMimeType) : null;

    if (browserTranscript) {
      payload.transcript = browserTranscript;
      activeTranscriptSource = "browser";
      setSpeechState("Using browser transcript");
    } else if (recordedFile || uploadedFile) {
      const audioFile = recordedFile || uploadedFile;
      const txData = await uploadAndTranscribeAudio(audioFile, localeConfig);
      payload.transcript = txData.transcript || "";
      activeTranscriptSource = "server";
      speechTranscriptEl.textContent = payload.transcript || "No transcript returned.";
      setSpeechState("Server transcript");
    } else {
      throw new Error("Record audio or upload an audio file first.");
    }

    const res = await fetch("/v1/encounters/scribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    lastResult = data;
    noteEl.textContent = data.noteDraft || "";
    metaEl.innerHTML = [
      badge(`country ${countryLabel(country)}`),
      badge(`lang ${localeConfig.transcriptionLanguage}`),
      badge(`style ${noteStyle}`),
      badge(`source ${activeTranscriptSource}`),
      badge(`redaction ${data.meta?.redactionApplied ? "on" : "off"}`),
      badge(`${data.providers?.transcription || "?"} -> ${data.providers?.note || "?"}`),
    ].join("");

    renderSections(data.sections || {});
    renderWarnings(data.warnings || [], data.followUpQuestions || []);
    await autoExportFhir(data);
    setStatus("Done");
  } catch (error) {
    noteEl.textContent = String(error.message || error);
    setStatus("Error");
  }
}

async function uploadAndTranscribeAudio(file, localeConfig) {
  const upload = new FormData();
  upload.append("audio", file, file.name);
  const txRes = await fetch("/v1/transcribe/upload", {
    method: "POST",
    body: upload,
    headers: {
      "X-Scribe-Language": localeConfig.transcriptionLanguage,
      "X-Scribe-Locale": localeConfig.speechLocale,
      "X-Scribe-Country": localeConfig.country,
    },
  });
  const txData = await txRes.json();
  if (!txRes.ok) throw new Error(txData.error || `HTTP ${txRes.status}`);
  return txData;
}

async function autoExportFhir(result) {
  if (!result?.noteDraft) {
    fhirOutputEl.textContent = "No export generated yet.";
    return;
  }
  const res = await fetch("/v1/export/fhir-document-reference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      noteText: result.noteDraft,
      encounterId: result.id,
      meta: result.meta,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  fhirOutputEl.textContent = JSON.stringify(data, null, 2);
}

function setupRecorderUi() {
  const mediaSupported =
    typeof navigator !== "undefined" &&
    navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const SpeechRecognitionCtor =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  speechSupported = Boolean(SpeechRecognitionCtor);

  if (speechSupported) {
    speechRecognition = new SpeechRecognitionCtor();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = getCountrySettings(form.country.value).speechLocale;
    speechRecognition.addEventListener("result", onSpeechResult);
    speechRecognition.addEventListener("error", (event) =>
      setSpeechState(`Error: ${event.error || "unknown"}`),
    );
    speechRecognition.addEventListener("end", () => {
      if (!speechShouldRun) return;
      try {
        speechRecognition.start();
      } catch {
        // Browser timing race; ignore.
      }
    });
    setSpeechState("Ready");
  } else {
    setSpeechState("Unavailable");
  }

  if (!mediaSupported) {
    recordToggleBtn.disabled = true;
    setRecorderState("Unsupported", false);
    recordHelpEl.textContent =
      "This browser does not support recording here. Use audio upload instead.";
    return;
  }

  recordToggleBtn.addEventListener("click", onRecordToggle);
}

async function onRecordToggle() {
  if (mediaRecorder?.state === "recording") {
    stopRecording();
    return;
  }
  await startRecording();
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickRecordingMimeType();
    recordingChunks = [];
    recordedBlob = null;
    recordedMimeType = mimeType || "";
    audioFileInput.value = "";
    clearBrowserTranscript({ keepAudioPreview: false });
    activeTranscriptSource = "browser-pending";

    mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) recordingChunks.push(event.data);
    });
    mediaRecorder.addEventListener("stop", () => {
      const finalType = mediaRecorder.mimeType || recordedMimeType || "audio/webm";
      recordedBlob = new Blob(recordingChunks, { type: finalType });
      recordedMimeType = finalType;
      updateRecordingPreview();
      setRecorderState("Recorded", false);
      setRecordToggleButton("Start Recording");
      recordHelpEl.textContent = "Recording captured. Click Create Draft Note.";
      stopTimer();
      stopSpeechRecognition();
      for (const track of mediaRecorder.stream.getTracks()) track.stop();
    });

    mediaRecorder.start(250);
    startSpeechRecognition();
    recordingStartedAt = Date.now();
    startTimer();
    setRecorderState("Recording", true);
    setRecordToggleButton("Stop Recording");
    recordHelpEl.textContent = "Recording in progress...";
  } catch (error) {
    setRecorderState("Error", false);
    setRecordToggleButton("Start Recording");
    recordHelpEl.textContent = `Unable to start recording: ${String(error.message || error)}`;
    stopTimer();
  }
}

function stopRecording() {
  if (mediaRecorder?.state === "recording") {
    mediaRecorder.stop();
  }
}

function startSpeechRecognition() {
  if (!speechRecognition) return;
  speechShouldRun = true;
  setSpeechState("Listening");
  try {
    speechRecognition.start();
  } catch {
    // already started
  }
}

function stopSpeechRecognition() {
  speechShouldRun = false;
  if (!speechRecognition) return;
  try {
    speechRecognition.stop();
  } catch {
    // ignore
  }
  if (speechFinalTranscript || speechInterimTranscript) {
    setSpeechState("Captured");
  }
}

function onSpeechResult(event) {
  const finalParts = [];
  const interimParts = [];

  for (let i = event.resultIndex; i < event.results.length; i += 1) {
    const result = event.results[i];
    const text = result?.[0]?.transcript || "";
    if (!text) continue;
    if (result.isFinal) finalParts.push(text);
    else interimParts.push(text);
  }

  if (finalParts.length) {
    speechFinalTranscript = normalizeWhitespace(
      [speechFinalTranscript, ...finalParts].filter(Boolean).join(" "),
    );
  }
  speechInterimTranscript = normalizeWhitespace(interimParts.join(" "));
  renderSpeechTranscript();
}

function clearBrowserTranscript({ keepAudioPreview }) {
  speechFinalTranscript = "";
  speechInterimTranscript = "";
  renderSpeechTranscript();
  if (!keepAudioPreview) {
    recordedBlob = null;
    recordedMimeType = "";
    if (recordingPreviewEl.dataset.objectUrl) {
      URL.revokeObjectURL(recordingPreviewEl.dataset.objectUrl);
      delete recordingPreviewEl.dataset.objectUrl;
    }
    recordingPreviewEl.hidden = true;
    recordingPreviewEl.removeAttribute("src");
  }
}

function renderSpeechTranscript() {
  const text = normalizeWhitespace(
    [speechFinalTranscript, speechInterimTranscript].filter(Boolean).join(" "),
  );
  speechTranscriptEl.textContent = text || "No transcript captured yet.";
}

function setSpeechState(text) {
  speechStateEl.textContent = text;
}

function setRecorderState(text, isLive) {
  recordStateEl.textContent = text;
  recordDotEl.classList.toggle("is-live", Boolean(isLive));
}

function setRecordToggleButton(text) {
  recordToggleBtn.textContent = text;
}

function updateRecordingPreview() {
  if (recordingPreviewEl.dataset.objectUrl) {
    URL.revokeObjectURL(recordingPreviewEl.dataset.objectUrl);
  }
  const objectUrl = URL.createObjectURL(recordedBlob);
  recordingPreviewEl.src = objectUrl;
  recordingPreviewEl.dataset.objectUrl = objectUrl;
  recordingPreviewEl.hidden = false;
}

function pickRecordingMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return "";
}

function blobToFile(blob, mimeType) {
  return new File([blob], `recording-${Date.now()}.${mimeTypeToExt(mimeType)}`, {
    type: mimeType || "application/octet-stream",
  });
}

function mimeTypeToExt(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  return "bin";
}

function startTimer() {
  stopTimer();
  setTimerValue(0);
  timerInterval = setInterval(() => {
    const elapsed = Math.max(0, Math.floor((Date.now() - recordingStartedAt) / 1000));
    setTimerValue(elapsed);
  }, 250);
}

function stopTimer() {
  if (!timerInterval) return;
  clearInterval(timerInterval);
  timerInterval = null;
}

function setTimerValue(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  recordTimerEl.textContent = `${mm}:${ss}`;
}

function renderSections(sections) {
  const entries = Object.entries(sections).filter(([, v]) => v);
  if (!entries.length) {
    sectionsEl.innerHTML = '<p class="empty">No structured sections returned.</p>';
    return;
  }
  sectionsEl.innerHTML = entries
    .map(
      ([key, value]) => `
      <article class="section-card">
        <h3>${escapeHtml(startCase(key))}</h3>
        <p>${escapeHtml(String(value))}</p>
      </article>
    `,
    )
    .join("");
}

function renderWarnings(warnings, followUps) {
  const items = [];
  for (const w of warnings) items.push(`<li>${escapeHtml(String(w))}</li>`);
  for (const q of followUps) items.push(`<li><strong>Follow-up:</strong> ${escapeHtml(String(q))}</li>`);
  warningsEl.innerHTML = items.length
    ? `<h3>Warnings / Follow-up</h3><ul>${items.join("")}</ul>`
    : "";
}

function setStatus(text) {
  statusEl.textContent = text;
}

function badge(text) {
  return `<span class="badge">${escapeHtml(text)}</span>`;
}

function startCase(value) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getCountrySettings(country) {
  const map = {
    SE: { country: "SE", speechLocale: "sv-SE", transcriptionLanguage: "sv" },
    US: { country: "US", speechLocale: "en-US", transcriptionLanguage: "en" },
    GB: { country: "GB", speechLocale: "en-GB", transcriptionLanguage: "en" },
    NO: { country: "NO", speechLocale: "nb-NO", transcriptionLanguage: "no" },
    DK: { country: "DK", speechLocale: "da-DK", transcriptionLanguage: "da" },
    DE: { country: "DE", speechLocale: "de-DE", transcriptionLanguage: "de" },
  };
  return map[country] || map.SE;
}

function countryLabel(code) {
  const labels = {
    SE: "Sweden",
    US: "United States",
    GB: "United Kingdom",
    NO: "Norway",
    DK: "Denmark",
    DE: "Germany",
  };
  return labels[code] || code;
}

