const SIMPLE_FIELDS = [
  "scribeMode",
  "transcriptionProvider",
  "noteProvider",
  "defaultNoteStyle",
  "defaultSpecialty",
  "defaultCountry",
];

const CHECKBOX_FIELDS = [
  "privacy-redactBeforeApiCalls",
  "streaming-diarizeOnEnd",
];

const NESTED_FIELDS = [
  "privacy-phiRedactionMode",
  "openai-apiKey", "openai-baseUrl", "openai-transcribeModel", "openai-noteModel",
  "anthropic-apiKey", "anthropic-baseUrl", "anthropic-model",
  "gemini-apiKey", "gemini-model",
  "deepgram-apiKey", "deepgram-model",
  "google-speechApiKey", "google-speechModel",
  "berget-apiKey", "berget-baseUrl", "berget-transcribeModel",
  "ollama-baseUrl", "ollama-model",
  "streaming-transcriptionProvider", "streaming-diarizeSidecarUrl",
];

async function loadSettings() {
  const res = await fetch("/v1/settings");
  if (!res.ok) throw new Error("Failed to load settings");
  return res.json();
}

function populateForm(settings) {
  for (const id of SIMPLE_FIELDS) {
    const el = document.getElementById(id);
    if (el && settings[id] !== undefined) el.value = settings[id];
  }

  for (const id of CHECKBOX_FIELDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const [section, key] = id.split("-");
    if (settings[section] && settings[section][key] !== undefined) {
      el.checked = settings[section][key];
    }
  }

  for (const id of NESTED_FIELDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const [section, ...rest] = id.split("-");
    const key = rest.join("-");  // handle keys like speechApiKey
    if (settings[section] && settings[section][key] !== undefined) {
      // Don't fill in masked API keys
      const val = settings[section][key];
      if (typeof val === "string" && val.includes("****")) continue;
      el.value = val;
    }
  }

  // Show which providers have keys configured
  updateKeyStatus(settings);
}

function updateKeyStatus(settings) {
  const providers = [
    { section: "openai", label: "OpenAI" },
    { section: "anthropic", label: "Anthropic" },
    { section: "gemini", label: "Gemini" },
    { section: "deepgram", label: "Deepgram" },
    { section: "google", label: "Google Speech" },
    { section: "berget", label: "Berget AI" },
  ];

  for (const { section } of providers) {
    if (!settings[section]) continue;
    const keyInput = document.getElementById(`${section}-apiKey`) ||
                     document.getElementById(`${section}-speechApiKey`);
    if (!keyInput) continue;

    const hasKey = settings[section].hasKey;
    const wrapper = keyInput.closest("label");
    if (!wrapper) continue;

    let badge = wrapper.querySelector(".key-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "key-badge";
      wrapper.appendChild(badge);
    }
    badge.textContent = hasKey ? "Configured" : "Not set";
    badge.classList.toggle("configured", hasKey);
  }
}

function gatherPatch() {
  const patch = {};

  for (const id of SIMPLE_FIELDS) {
    const el = document.getElementById(id);
    if (el) patch[id] = el.value;
  }

  for (const id of CHECKBOX_FIELDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const [section, key] = id.split("-");
    if (!patch[section]) patch[section] = {};
    patch[section][key] = el.checked;
  }

  for (const id of NESTED_FIELDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const [section, ...rest] = id.split("-");
    const key = rest.join("-");
    const val = el.value.trim();

    // Skip empty password fields (don't overwrite existing keys)
    if (el.type === "password" && !val) continue;

    if (!patch[section]) patch[section] = {};
    patch[section][key] = val;
  }

  return patch;
}

function showBanner(msg, isError) {
  const banner = document.getElementById("save-banner");
  const msgEl = document.getElementById("save-msg");
  msgEl.textContent = msg;
  banner.hidden = false;
  banner.classList.toggle("error", isError);
  banner.classList.toggle("success", !isError);
  setTimeout(() => { banner.hidden = true; }, 3000);
}

async function saveSettingsToServer() {
  const btn = document.getElementById("save-btn");
  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    const patch = gatherPatch();
    const res = await fetch("/v1/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (!res.ok) throw new Error(`Save failed: ${res.status}`);

    const updated = await res.json();
    populateForm(updated);
    showBanner("Settings saved successfully!", false);
  } catch (err) {
    showBanner(`Error: ${err.message}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Settings";
  }
}

async function init() {
  try {
    const settings = await loadSettings();
    populateForm(settings);
  } catch (err) {
    showBanner("Failed to load settings from server", true);
  }

  document.getElementById("save-btn").addEventListener("click", saveSettingsToServer);
}

init();
