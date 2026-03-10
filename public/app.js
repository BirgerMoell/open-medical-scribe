const recordButton = document.getElementById("record-btn");
const copyButton = document.getElementById("copy-btn");
const statusLabel = document.getElementById("app-status-label");
const statusDetail = document.getElementById("app-status-detail");
const recordingPill = document.getElementById("recording-pill");
const timerPill = document.getElementById("timer-pill");
const transcriptOutput = document.getElementById("transcript-output");
const noteOutput = document.getElementById("note-output");
const noteEditedIndicator = document.getElementById("note-edited-indicator");
const warningOutput = document.getElementById("warning-output");
const providerPill = document.getElementById("provider-pill");
const quotaCard = document.getElementById("quota-card");
const quotaOutput = document.getElementById("quota-output");
const noteStyleInput = document.getElementById("note-style");
const languageInput = document.getElementById("language");
const localeInput = document.getElementById("locale");
const countryInput = document.getElementById("country");
const modeCloudButton = document.getElementById("mode-cloud");
const modeLocalButton = document.getElementById("mode-local");
const modeDetail = document.getElementById("mode-detail");
const runtimePill = document.getElementById("runtime-pill");
const capabilityPill = document.getElementById("capability-pill");
const modelSummary = document.getElementById("model-summary");
const localActivity = document.getElementById("local-activity");
const localProgressCard = document.getElementById("local-progress-card");
const localProgressTitle = document.getElementById("local-progress-title");
const localProgressBadge = document.getElementById("local-progress-badge");
const localProgressDetail = document.getElementById("local-progress-detail");
const openSettingsButton = document.getElementById("open-settings-btn");
const closeSettingsButton = document.getElementById("close-settings-btn");
const settingsBackdrop = document.getElementById("settings-backdrop");
const settingsSheet = document.getElementById("settings-sheet");
const saveModelSettingsButton = document.getElementById("save-model-settings-btn");
const resetModelSettingsButton = document.getElementById("reset-model-settings-btn");
const localNoteModelSelect = document.getElementById("local-note-model-select");
const customNoteModelField = document.getElementById("custom-note-model-field");
const customNoteModelInput = document.getElementById("custom-note-model-input");
const localWhisperModelSelect = document.getElementById("local-whisper-model-select");
const customWhisperModelField = document.getElementById("custom-whisper-model-field");
const customWhisperModelInput = document.getElementById("custom-whisper-model-input");
const settingsProfileOutput = document.getElementById("settings-profile-output");

const STORAGE_KEYS = {
  installId: "eirScribe.installId",
  clientToken: "eirScribe.clientToken",
  quota: "eirScribe.clientQuota",
  executionMode: "eirScribe.executionMode",
  localModelSettings: "eirScribe.localModelSettings",
};

const DEFAULTS = {
  mode: "cloud",
  localModelSettings: {
    noteModel: "auto",
    customNoteModel: "",
    whisperModel: "auto",
    customWhisperModel: "",
  },
};

let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];
let recordedBlob = null;
let recordingStartedAt = 0;
let timerId = null;
let isRecording = false;
let localWorker = null;
let workerRequestId = 0;
const pendingWorkerRequests = new Map();
let generatedNoteDraft = "";

const localCapability = {
  webgpu: typeof navigator !== "undefined" && !!navigator.gpu,
  mediaRecorder: typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined",
};

const NOTE_MODEL_CATALOG = {
  "Qwen3-0.6B-q4f16_1-MLC": {
    id: "Qwen3-0.6B-q4f16_1-MLC",
    label: "Qwen 3 0.6B",
  },
  "Qwen3-1.7B-q4f16_1-MLC": {
    id: "Qwen3-1.7B-q4f16_1-MLC",
    label: "Qwen 3 1.7B",
  },
  "Qwen3-4B-q4f16_1-MLC": {
    id: "Qwen3-4B-q4f16_1-MLC",
    label: "Qwen 3 4B",
  },
  "Qwen3-8B-q4f16_1-MLC": {
    id: "Qwen3-8B-q4f16_1-MLC",
    label: "Qwen 3 8B",
  },
  "Qwen/Qwen3.5-9B": {
    id: "Qwen/Qwen3.5-9B",
    label: "Qwen 3.5 9B",
    requiresCustomBuild: true,
  },
  "Qwen/Qwen3.5-27B": {
    id: "Qwen/Qwen3.5-27B",
    label: "Qwen 3.5 27B",
    requiresCustomBuild: true,
  },
};

const WHISPER_MODEL_CATALOG = {
  "KBLab/kb-whisper-tiny": {
    id: "KBLab/kb-whisper-tiny",
    label: "KB Whisper Tiny",
    subfolder: "onnx",
  },
  "KBLab/kb-whisper-base": {
    id: "KBLab/kb-whisper-base",
    label: "KB Whisper Base",
    subfolder: "onnx",
  },
  "KBLab/kb-whisper-small": {
    id: "KBLab/kb-whisper-small",
    label: "KB Whisper Small",
    subfolder: "onnx",
  },
  "onnx-community/kb-whisper-large-ONNX": {
    id: "onnx-community/kb-whisper-large-ONNX",
    label: "KB Whisper Large ONNX",
    subfolder: "onnx",
  },
};

let detectedLocalModelPlan = {
  noteModel: NOTE_MODEL_CATALOG["Qwen3-0.6B-q4f16_1-MLC"],
  transcription: {
    webgpu: WHISPER_MODEL_CATALOG["KBLab/kb-whisper-base"],
    wasm: WHISPER_MODEL_CATALOG["KBLab/kb-whisper-tiny"],
  },
  profileLabel: "Default local profile",
};

let localModelSettings = {
  ...DEFAULTS.localModelSettings,
};

let currentLocalProgress = {
  title: "Preparing local models",
  detail: "The first local run downloads model files into the browser cache.",
  state: "idle",
};

recordButton.addEventListener("click", () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

copyButton.addEventListener("click", async () => {
  const text = getCurrentNoteText();
  if (!text) {
    return;
  }

  await navigator.clipboard.writeText(text);
  copyButton.textContent = "Copied";
  window.setTimeout(() => {
    copyButton.textContent = "Copy";
  }, 1500);
});

noteOutput.addEventListener("input", () => {
  syncEditedState();
  autosizeNoteEditor();
});

modeCloudButton.addEventListener("click", () => setExecutionMode("cloud"));
modeLocalButton.addEventListener("click", () => setExecutionMode("local"));
openSettingsButton.addEventListener("click", openSettingsSheet);
closeSettingsButton.addEventListener("click", closeSettingsSheet);
settingsBackdrop.addEventListener("click", closeSettingsSheet);
saveModelSettingsButton.addEventListener("click", saveLocalModelSettings);
resetModelSettingsButton.addEventListener("click", resetLocalModelSettings);
localNoteModelSelect.addEventListener("change", () => {
  customNoteModelField.hidden = localNoteModelSelect.value !== "custom";
});
localWhisperModelSelect.addEventListener("change", () => {
  customWhisperModelField.hidden = localWhisperModelSelect.value !== "custom";
});

void boot();

async function boot() {
  hydrateLocalModelSettings();
  populateLocalModelSettingsForm();
  hydrateQuota();
  if (localCapability.webgpu) {
    await detectLocalModelPlan();
  }
  renderLocalModelSummary();
  updateSettingsProfileOutput();
  setExecutionMode(localStorage.getItem(STORAGE_KEYS.executionMode) || DEFAULTS.mode, { persist: false });
  updateCapabilityPill();
}

function hydrateLocalModelSettings() {
  const raw = localStorage.getItem(STORAGE_KEYS.localModelSettings);
  if (!raw) {
    localModelSettings = { ...DEFAULTS.localModelSettings };
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    localModelSettings = {
      ...DEFAULTS.localModelSettings,
      ...parsed,
    };
  } catch {
    localModelSettings = { ...DEFAULTS.localModelSettings };
    localStorage.removeItem(STORAGE_KEYS.localModelSettings);
  }
}

function persistLocalModelSettings() {
  localStorage.setItem(STORAGE_KEYS.localModelSettings, JSON.stringify(localModelSettings));
}

function populateLocalModelSettingsForm() {
  localNoteModelSelect.value = localModelSettings.noteModel || "auto";
  customNoteModelInput.value = localModelSettings.customNoteModel || "";
  customNoteModelField.hidden = localNoteModelSelect.value !== "custom";
  localWhisperModelSelect.value = localModelSettings.whisperModel || "auto";
  customWhisperModelInput.value = localModelSettings.customWhisperModel || "";
  customWhisperModelField.hidden = localWhisperModelSelect.value !== "custom";
}

function openSettingsSheet() {
  populateLocalModelSettingsForm();
  updateSettingsProfileOutput();
  settingsBackdrop.hidden = false;
  settingsSheet.hidden = false;
}

function closeSettingsSheet() {
  settingsBackdrop.hidden = true;
  settingsSheet.hidden = true;
}

function saveLocalModelSettings() {
  localModelSettings = {
    noteModel: localNoteModelSelect.value || "auto",
    customNoteModel: customNoteModelInput.value.trim(),
    whisperModel: localWhisperModelSelect.value || "auto",
    customWhisperModel: customWhisperModelInput.value.trim(),
  };
  persistLocalModelSettings();
  renderLocalModelSummary();
  updateSettingsProfileOutput();
  setExecutionMode(getExecutionMode(), { persist: false });
  closeSettingsSheet();
}

function resetLocalModelSettings() {
  localModelSettings = { ...DEFAULTS.localModelSettings };
  persistLocalModelSettings();
  populateLocalModelSettingsForm();
  renderLocalModelSummary();
  updateSettingsProfileOutput();
  setExecutionMode(getExecutionMode(), { persist: false });
}

function setExecutionMode(mode, { persist = true } = {}) {
  const normalizedMode = mode === "local" ? "local" : "cloud";
  const effectivePlan = getEffectiveLocalModelPlan();
  if (persist) {
    localStorage.setItem(STORAGE_KEYS.executionMode, normalizedMode);
  }

  modeCloudButton.classList.toggle("is-active", normalizedMode === "cloud");
  modeCloudButton.setAttribute("aria-pressed", String(normalizedMode === "cloud"));
  modeLocalButton.classList.toggle("is-active", normalizedMode === "local");
  modeLocalButton.setAttribute("aria-pressed", String(normalizedMode === "local"));

  if (normalizedMode === "local") {
    runtimePill.textContent = localCapability.webgpu ? "Local WebGPU" : "Local WASM";
    if (localCapability.webgpu && effectivePlan.noteModel.requiresCustomBuild) {
      modeDetail.textContent =
        `${effectivePlan.noteModel.label} needs a custom WebLLM / MLC browser build. Choose a browser-ready Qwen preset or keep this selection only if you have that build.`;
    } else {
      modeDetail.textContent = localCapability.webgpu
        ? `Runs in your browser. First use downloads ${effectivePlan.transcription.webgpu.label} and ${effectivePlan.noteModel.label}, then reuses the browser cache.`
        : "Runs in your browser. Swedish Whisper stays local, but without WebGPU the note falls back to a deterministic local template.";
    }
    if (!isRecording) {
      statusLabel.textContent = "Ready";
      statusDetail.textContent = localCapability.webgpu
        ? effectivePlan.noteModel.requiresCustomBuild
          ? `This selection needs a custom browser build for ${effectivePlan.noteModel.label}.`
          : `Local mode downloads ${effectivePlan.transcription.webgpu.label} and ${effectivePlan.noteModel.label} on first use, then drafts in the browser.`
        : "Local mode transcribes with Swedish Whisper in the browser. Without WebGPU, note drafting uses a local template.";
    }
    showLocalProgress({
      title: "Local model path",
      detail: localCapability.webgpu
        ? `${effectivePlan.profileLabel}. The first run downloads ${effectivePlan.transcription.webgpu.label} and ${effectivePlan.noteModel.label}. Later runs reuse the browser cache.`
        : "The first run downloads KB Whisper into the browser cache. Note drafting falls back to a local template on this browser.",
      badge: localCapability.webgpu ? "Ready" : "Whisper only",
      state: "idle",
    });
  } else {
    runtimePill.textContent = "Cloud default";
    modeDetail.textContent =
      "Cloud is the default. Eir servers in Stockholm handle transcription and drafting with zero Eir retention and Berget AI inference.";
    if (!isRecording) {
      statusLabel.textContent = "Ready";
      statusDetail.textContent =
        "Cloud access is prepared automatically the first time you transcribe.";
    }
    hideLocalProgress();
  }

  renderLocalModelSummary();
}

function getExecutionMode() {
  return localStorage.getItem(STORAGE_KEYS.executionMode) || DEFAULTS.mode;
}

function getEffectiveLocalModelPlan() {
  const noteModel = resolveNoteModel();
  const whisperModel = resolveWhisperModel();
  return {
    noteModel,
    transcription: {
      webgpu: whisperModel,
      wasm: whisperModel.id === "onnx-community/kb-whisper-large-ONNX"
        ? WHISPER_MODEL_CATALOG["KBLab/kb-whisper-base"]
        : whisperModel.id === "KBLab/kb-whisper-small"
        ? WHISPER_MODEL_CATALOG["KBLab/kb-whisper-base"]
        : whisperModel,
    },
    profileLabel: localModelSettings.noteModel === "auto" && localModelSettings.whisperModel === "auto"
      ? detectedLocalModelPlan.profileLabel
      : "Manual local profile",
  };
}

function resolveNoteModel() {
  if (localModelSettings.noteModel === "custom" && localModelSettings.customNoteModel) {
    return {
      id: localModelSettings.customNoteModel,
      label: localModelSettings.customNoteModel,
      isCustom: true,
    };
  }

  if (localModelSettings.noteModel !== "auto" && NOTE_MODEL_CATALOG[localModelSettings.noteModel]) {
    return NOTE_MODEL_CATALOG[localModelSettings.noteModel];
  }

  return detectedLocalModelPlan.noteModel;
}

function resolveWhisperModel() {
  if (localModelSettings.whisperModel === "custom" && localModelSettings.customWhisperModel) {
    return {
      id: localModelSettings.customWhisperModel,
      label: localModelSettings.customWhisperModel,
      subfolder: "onnx",
      isCustom: true,
    };
  }

  if (localModelSettings.whisperModel !== "auto" && WHISPER_MODEL_CATALOG[localModelSettings.whisperModel]) {
    return WHISPER_MODEL_CATALOG[localModelSettings.whisperModel];
  }

  return detectedLocalModelPlan.transcription.webgpu;
}

function renderLocalModelSummary() {
  const effectivePlan = getEffectiveLocalModelPlan();
  modelSummary.textContent = `Local models: ${effectivePlan.noteModel.label} + ${effectivePlan.transcription.webgpu.label}`;
}

function updateSettingsProfileOutput() {
  const effectivePlan = getEffectiveLocalModelPlan();
  const capability = localCapability.webgpu ? "WebGPU available" : "WebGPU unavailable";
  const modeDetailText = localCapability.webgpu
    ? `${effectivePlan.profileLabel}. Browser-ready WebLLM presets currently cover Qwen 3 through 8B. Raw Qwen 3.5 checkpoints still need a compiled browser build.`
    : "This browser will use local Whisper and fall back to a deterministic note template because WebGPU is unavailable.";
  const customBuildHint = effectivePlan.noteModel.requiresCustomBuild
    ? ` ${effectivePlan.noteModel.label} is a raw Hugging Face release, so this selection needs a custom WebLLM / MLC browser build.`
    : "";
  settingsProfileOutput.textContent =
    `${capability}. ${modeDetailText} Current local choice: ${effectivePlan.noteModel.label} + ${effectivePlan.transcription.webgpu.label}.${customBuildHint}`;
}

function updateCapabilityPill() {
  if (localCapability.webgpu) {
    capabilityPill.textContent = "WebGPU ready";
    return;
  }

  capabilityPill.textContent = "WASM fallback";
}

async function startRecording() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = preferredMimeType();
    audioChunks = [];
    recordedBlob = null;
    mediaRecorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) {
        audioChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener("stop", async () => {
      recordedBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });
      stopMediaStream();
      await processRecording();
    }, { once: true });

    mediaRecorder.start(250);
    recordingStartedAt = Date.now();
    isRecording = true;
    startTimer();
    recordButton.classList.add("is-recording");
    recordingPill.textContent = "Recording";
    statusLabel.textContent = "Listening";
    statusDetail.textContent = "Capture the encounter, then stop when you are ready for transcription.";
    warningOutput.hidden = true;
  } catch (error) {
    statusLabel.textContent = "Microphone blocked";
    statusDetail.textContent = error?.message || "Allow microphone access to record the encounter.";
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state !== "recording") {
    return;
  }

  isRecording = false;
  stopTimer();
  recordButton.classList.remove("is-recording");
  recordingPill.textContent = "Processing";

  if (getExecutionMode() === "local") {
    updateStatus(
      "Preparing local models",
      localCapability.webgpu
        ? "Preparing local transcription and note drafting in this browser."
        : "Eir is preparing browser-local Whisper. Drafting will use a local template.",
    );
  } else {
    updateStatus(
      "Preparing secure cloud access",
      "Eir provisions a per-install trial token the first time you transcribe.",
    );
  }

  mediaRecorder.stop();
}

async function processRecording() {
  if (!recordedBlob) {
    return;
  }

  try {
    if (getExecutionMode() === "local") {
      await processLocally();
    } else {
      await processInCloud();
    }
  } catch (error) {
    warningOutput.hidden = false;
    warningOutput.textContent = error.message || "Processing failed.";
    updateStatus("Processing failed", "Check the message below and try again.");
    recordingPill.textContent = "Try again";
    providerPill.textContent = "Error";
    if (getExecutionMode() === "local") {
      showLocalProgress({
        title: "Local processing failed",
        detail: error.message || "The local model path failed before the draft completed.",
        badge: "Error",
        state: "active",
      });
    }
  }
}

async function processLocally() {
  const effectivePlan = getEffectiveLocalModelPlan();
  const monoAudio = await decodeAudioBlobToMonoFloat32(recordedBlob, 16000);
  quotaCard.hidden = true;
  showLocalProgress({
    title: "Preparing local transcription",
    detail: "Preparing Swedish Whisper in this browser.",
    badge: "Starting",
    state: "active",
  });
  updateStatus("Preparing local transcription", "Loading Swedish Whisper in the browser.");

  const transcription = await sendWorkerRequest(
    "transcribe",
    {
      audioBuffer: monoAudio.buffer,
      supportsWebGPU: localCapability.webgpu,
      language: (languageInput.value || "sv").trim(),
      transcriptionModel: localCapability.webgpu
        ? effectivePlan.transcription.webgpu
        : effectivePlan.transcription.wasm,
    },
    [monoAudio.buffer],
  );

  transcriptOutput.textContent = transcription.text || "No transcript returned.";
  providerPill.textContent = transcription.providerLabel || "Local transcription";

  updateStatus(
    localCapability.webgpu ? "Preparing local note model" : "Preparing local note",
    localCapability.webgpu
      ? `Loading ${effectivePlan.noteModel.label} in the browser.`
      : "Using a deterministic local note template because WebGPU is not available.",
  );

  const noteResult = await sendWorkerRequest("draft-note", {
    transcript: transcription.text || "",
    noteStyle: noteStyleInput.value || "journal",
    locale: (localeInput.value || "sv-SE").trim(),
    language: (languageInput.value || "sv").trim(),
    supportsWebGPU: localCapability.webgpu,
    noteModel: effectivePlan.noteModel,
  });

  renderResult({
    transcript: transcription.text,
    noteDraft: noteResult.noteDraft,
    warnings: [transcription.warning, noteResult.warning].filter(Boolean),
    providers: {
      transcription: transcription.providerLabel,
      note: noteResult.providerLabel,
    },
  });

  updateStatus(
    "Local draft ready",
    localCapability.webgpu
      ? "Review the browser-local draft carefully before clinical use."
      : "Review the local template draft carefully before clinical use.",
  );
  showLocalProgress({
    title: "Local draft ready",
    detail: localCapability.webgpu
      ? "Swedish Whisper and Qwen are now cached in this browser for faster later runs."
      : "Swedish Whisper is cached in this browser. Note drafting used the local template fallback.",
    badge: "Ready",
    state: "complete",
  });
}

async function processInCloud() {
  updateStatus("Preparing secure cloud access", "Provisioning a per-install client token on Eir servers in Sweden.");
  const clientToken = await ensureClientToken();
  updateStatus("Uploading recording", "Sending the encounter to Eir Scribe in Stockholm.");
  const result = await requestScribe(clientToken);
  renderResult(result);
  updateStatus("Draft ready", "Review the note carefully before clinical use.");
}

async function ensureClientToken() {
  const existing = localStorage.getItem(STORAGE_KEYS.clientToken)?.trim();
  if (existing) {
    return existing;
  }

  const installId = getInstallId();
  const response = await fetch("/v1/client/bootstrap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      installId,
      platform: "web",
      attestation: {
        provider: "none",
        status: "web_unattested",
        isSupported: false,
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Secure cloud access setup failed.");
  }

  localStorage.setItem(STORAGE_KEYS.clientToken, payload.bearerToken);
  persistQuota(payload.quota);
  return payload.bearerToken;
}

async function requestScribe(clientToken) {
  const audioBase64 = await blobToBase64(recordedBlob);
  const body = {
    audioBase64,
    audioMimeType: recordedBlob.type || "audio/webm",
    noteStyle: noteStyleInput.value || "journal",
    specialty: "primary-care",
    language: (languageInput.value || "sv").trim(),
    locale: (localeInput.value || "sv-SE").trim(),
    country: (countryInput.value || "SE").trim(),
  };

  const response = await fetch("/v1/encounters/scribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(STORAGE_KEYS.clientToken);
    }
    if (payload.quota) {
      persistQuota(payload.quota);
    }
    throw new Error(payload.error || `Cloud request failed (${response.status})`);
  }

  if (payload.clientQuota) {
    persistQuota(payload.clientQuota);
  }

  return payload;
}

function renderResult(result) {
  transcriptOutput.textContent = result.transcript || "No transcript returned.";
  generatedNoteDraft = result.noteDraft || "";
  noteOutput.value = generatedNoteDraft;
  copyButton.disabled = !generatedNoteDraft;
  copyButton.textContent = "Copy";
  syncEditedState();
  autosizeNoteEditor();

  const txProvider = result.providers?.transcription || "cloud";
  const noteProvider = result.providers?.note || "cloud";
  providerPill.textContent = `${txProvider} + ${noteProvider}`;

  const warnings = Array.isArray(result.warnings) ? result.warnings.filter(Boolean) : [];
  if (warnings.length) {
    warningOutput.hidden = false;
    warningOutput.textContent = warnings[0];
  } else {
    warningOutput.hidden = true;
  }
}

function updateStatus(title, detail) {
  statusLabel.textContent = title;
  statusDetail.textContent = detail;
}

function getCurrentNoteText() {
  return noteOutput.value.trim();
}

function syncEditedState() {
  const current = getCurrentNoteText();
  const original = generatedNoteDraft.trim();
  const isEdited = Boolean(current) && current !== original;
  noteEditedIndicator.hidden = !isEdited;
  copyButton.disabled = !current;
}

function autosizeNoteEditor() {
  noteOutput.style.height = "auto";
  const nextHeight = Math.max(220, noteOutput.scrollHeight);
  noteOutput.style.height = `${nextHeight}px`;
}

function hydrateQuota() {
  const raw = localStorage.getItem(STORAGE_KEYS.quota);
  if (!raw) {
    return;
  }

  try {
    renderQuota(JSON.parse(raw));
  } catch {
    localStorage.removeItem(STORAGE_KEYS.quota);
  }
}

function persistQuota(quota) {
  if (!quota) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.quota, JSON.stringify(quota));
  renderQuota(quota);
}

function renderQuota(quota) {
  if (getExecutionMode() === "local") {
    quotaCard.hidden = true;
    return;
  }

  quotaCard.hidden = false;
  const remainingMinutes = Math.max(0, Math.floor((quota.remaining?.audioSeconds || 0) / 60));
  const remainingRequests = quota.remaining?.requests ?? 0;
  quotaOutput.textContent =
    `${remainingRequests} trial requests and about ${remainingMinutes} minutes of cloud audio remaining on this browser.`;
}

function getInstallId() {
  let installId = localStorage.getItem(STORAGE_KEYS.installId)?.trim();
  if (installId) {
    return installId;
  }

  installId = `web-${crypto.randomUUID()}`;
  localStorage.setItem(STORAGE_KEYS.installId, installId);
  return installId;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read recording."));
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

function preferredMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported?.(candidate)) || "";
}

function startTimer() {
  stopTimer();
  timerPill.textContent = "00:00";
  timerId = window.setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - recordingStartedAt) / 1000);
    const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
    const seconds = String(elapsedSeconds % 60).padStart(2, "0");
    timerPill.textContent = `${minutes}:${seconds}`;
  }, 250);
}

function stopTimer() {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function stopMediaStream() {
  if (!mediaStream) {
    return;
  }

  for (const track of mediaStream.getTracks()) {
    track.stop();
  }
  mediaStream = null;
}

async function decodeAudioBlobToMonoFloat32(blob, targetSampleRate) {
  const buffer = await blob.arrayBuffer();
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("This browser cannot decode recorded audio for local transcription.");
  }

  const audioContext = new AudioContextCtor();
  const decoded = await audioContext.decodeAudioData(buffer.slice(0));
  const offlineContext = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil(decoded.duration * targetSampleRate)),
    targetSampleRate,
  );
  const source = offlineContext.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineContext.destination);
  source.start(0);
  const rendered = await offlineContext.startRendering();
  await audioContext.close();
  return new Float32Array(rendered.getChannelData(0));
}

function ensureWorker() {
  if (localWorker) {
    return localWorker;
  }

  localWorker = new Worker("/local-model-worker.js", { type: "module" });
  localWorker.addEventListener("message", handleWorkerMessage);
  return localWorker;
}

function handleWorkerMessage(event) {
  const message = event.data || {};

  if (message.type === "progress") {
    const payload = message.payload || {};
    updateStatus(payload.title || "Preparing local models", payload.detail || "");
    providerPill.textContent = payload.stage === "local-note"
      ? "Local note model"
      : "Local transcription";
    const badge = formatLocalProgressBadge(payload);
    recordingPill.textContent = badge;
    showLocalProgress({
      title: payload.title || "Preparing local models",
      detail: decorateLocalProgressDetail(payload),
      badge,
      state: payload.state || "active",
    });
    return;
  }

  const pending = pendingWorkerRequests.get(message.id);
  if (!pending) {
    return;
  }

  pendingWorkerRequests.delete(message.id);

  if (message.type === "result") {
    pending.resolve(message.payload);
    return;
  }

  pending.reject(new Error(message.error || "Local worker failed."));
}

function sendWorkerRequest(type, payload, transfer = []) {
  return new Promise((resolve, reject) => {
    const worker = ensureWorker();
    const id = ++workerRequestId;
    pendingWorkerRequests.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload }, transfer);
  });
}

function showLocalProgress({
  title,
  detail,
  badge,
  state,
}) {
  localActivity.hidden = false;
  localProgressCard.hidden = false;
  currentLocalProgress = {
    title,
    detail,
    state,
  };
  localProgressTitle.textContent = title;
  localProgressBadge.textContent = badge;
  localProgressDetail.textContent = detail;
}

function hideLocalProgress() {
  localActivity.hidden = true;
  localActivity.open = false;
  localProgressCard.hidden = true;
}

function formatLocalProgressBadge(payload) {
  if (payload.state === "complete") {
    return "Ready";
  }
  return "Loading";
}

function decorateLocalProgressDetail(payload) {
  const base = payload.detail || "";
  if (payload.state !== "complete") {
    return `${base} First local run may take a few minutes.`;
  }
  return base;
}

async function detectLocalModelPlan() {
  try {
    const adapter = await navigator.gpu.requestAdapter();
    const maxBuffer = Number(adapter?.limits?.maxStorageBufferBindingSize || 0);
    const deviceMemory = Number(navigator.deviceMemory || 8);
    const cores = Number(navigator.hardwareConcurrency || 4);
    const isMobile = /iphone|ipad|android|mobile/i.test(navigator.userAgent || "");

    if (!isMobile && deviceMemory >= 32 && maxBuffer >= 1_500_000_000) {
      detectedLocalModelPlan = {
        noteModel: NOTE_MODEL_CATALOG["Qwen3-8B-q4f16_1-MLC"],
        transcription: {
          webgpu: WHISPER_MODEL_CATALOG["onnx-community/kb-whisper-large-ONNX"],
          wasm: WHISPER_MODEL_CATALOG["KBLab/kb-whisper-base"],
        },
        profileLabel: "High-memory desktop profile",
      };
      return;
    }

    if (!isMobile && deviceMemory >= 24 && maxBuffer >= 1_250_000_000) {
      detectedLocalModelPlan = {
        noteModel: NOTE_MODEL_CATALOG["Qwen3-4B-q4f16_1-MLC"],
        transcription: {
          webgpu: WHISPER_MODEL_CATALOG["KBLab/kb-whisper-small"],
          wasm: WHISPER_MODEL_CATALOG["KBLab/kb-whisper-base"],
        },
        profileLabel: "High-memory desktop profile",
      };
      return;
    }

    if (deviceMemory >= 12 && cores >= 8 && maxBuffer >= 750_000_000) {
      detectedLocalModelPlan = {
        noteModel: NOTE_MODEL_CATALOG["Qwen3-1.7B-q4f16_1-MLC"],
        transcription: {
          webgpu: WHISPER_MODEL_CATALOG["KBLab/kb-whisper-base"],
          wasm: WHISPER_MODEL_CATALOG["KBLab/kb-whisper-base"],
        },
        profileLabel: "Balanced WebGPU profile",
      };
      return;
    }

    detectedLocalModelPlan = {
      noteModel: NOTE_MODEL_CATALOG["Qwen3-0.6B-q4f16_1-MLC"],
      transcription: {
        webgpu: WHISPER_MODEL_CATALOG["KBLab/kb-whisper-base"],
        wasm: WHISPER_MODEL_CATALOG["KBLab/kb-whisper-tiny"],
      },
      profileLabel: "Lightweight WebGPU profile",
    };
  } catch {
    detectedLocalModelPlan.profileLabel = "Default local profile";
  }
}
