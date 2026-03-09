const recordButton = document.getElementById("record-btn");
const copyButton = document.getElementById("copy-btn");
const statusLabel = document.getElementById("app-status-label");
const statusDetail = document.getElementById("app-status-detail");
const recordingPill = document.getElementById("recording-pill");
const timerPill = document.getElementById("timer-pill");
const transcriptOutput = document.getElementById("transcript-output");
const noteOutput = document.getElementById("note-output");
const warningOutput = document.getElementById("warning-output");
const providerPill = document.getElementById("provider-pill");
const quotaCard = document.getElementById("quota-card");
const quotaOutput = document.getElementById("quota-output");
const noteStyleInput = document.getElementById("note-style");
const languageInput = document.getElementById("language");
const localeInput = document.getElementById("locale");
const countryInput = document.getElementById("country");

const STORAGE_KEYS = {
  installId: "eirScribe.installId",
  clientToken: "eirScribe.clientToken",
  quota: "eirScribe.clientQuota",
};

let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];
let recordedBlob = null;
let recordingStartedAt = 0;
let timerId = null;
let isRecording = false;

recordButton.addEventListener("click", () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

copyButton.addEventListener("click", async () => {
  const text = noteOutput.textContent.trim();
  if (!text || text === "Your draft note will appear here.") {
    return;
  }

  await navigator.clipboard.writeText(text);
  copyButton.textContent = "Copied";
  window.setTimeout(() => {
    copyButton.textContent = "Copy";
  }, 1500);
});

boot();

function boot() {
  providerPill.textContent = "Eir cloud";
  hydrateQuota();
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
    statusDetail.textContent = "Capture the encounter, then stop when you are ready for the cloud draft.";
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
  statusLabel.textContent = "Preparing secure cloud access";
  statusDetail.textContent = "Eir provisions a per-install trial token the first time you transcribe.";
  mediaRecorder.stop();
}

async function processRecording() {
  if (!recordedBlob) {
    return;
  }

  try {
    updateStatus("Preparing secure cloud access", "Provisioning a per-install client token on Eir servers in Sweden.");
    const clientToken = await ensureClientToken();
    updateStatus("Uploading recording", "Sending the encounter to Eir Scribe in Stockholm.");
    const result = await requestScribe(clientToken);
    renderResult(result);
    updateStatus("Draft ready", "Review the note carefully before clinical use.");
  } catch (error) {
    warningOutput.hidden = false;
    warningOutput.textContent = error.message || "Cloud processing failed.";
    updateStatus("Cloud processing failed", "Check the message below and try again.");
    recordingPill.textContent = "Try again";
    providerPill.textContent = "Cloud error";
  }
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
  noteOutput.textContent = result.noteDraft || "No note draft returned.";
  copyButton.disabled = !result.noteDraft;
  copyButton.textContent = "Copy";
  providerPill.textContent = `${result.providers?.transcription || "cloud"} + ${result.providers?.note || "cloud"}`;

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
