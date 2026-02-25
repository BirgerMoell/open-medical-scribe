import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Readable } from "node:stream";
import { createApp } from "../src/server/createApp.js";

// Load a real MP3 audio sample from the Swedish medical transcription benchmark.
const AUDIO_PATH = new URL("./fixtures/sample_swedish.mp3", import.meta.url);
const audioBytes = readFileSync(AUDIO_PATH);
const audioBase64 = audioBytes.toString("base64");

// ─── helpers ─────────────────────────────────────────────────────────────

function baseConfig(overrides = {}) {
  return {
    port: 0,
    scribeMode: "local",
    defaultNoteStyle: "soap",
    defaultSpecialty: "primary-care",
    defaultCountry: "SE",
    enableWebUi: false,
    privacy: { phiRedactionMode: "basic", redactBeforeApiCalls: false, auditLogFile: "" },
    transcriptionProvider: "mock",
    noteProvider: "mock",
    openai: { apiKey: "", baseUrl: "https://api.openai.com", transcribeModel: "whisper-1", noteModel: "gpt-4o" },
    anthropic: { apiKey: "", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-20250514" },
    gemini: { apiKey: "", model: "gemini-2.0-flash" },
    ollama: { baseUrl: "http://localhost:11434", model: "llama3.1:8b" },
    deepgram: { apiKey: "", model: "nova-3-medical" },
    google: { speechApiKey: "", speechModel: "latest_long" },
    berget: { apiKey: "", baseUrl: "https://api.berget.ai", transcribeModel: "KBLab/kb-whisper-large" },
    whisper: { localCommand: "", timeoutMs: 5000, expects: "stdin" },
    streaming: { transcriptionProvider: "mock-stream", diarizeSidecarUrl: "", diarizeOnEnd: false },
    ...overrides,
  };
}

async function invoke(app, { method, url, headers = {}, body }) {
  const req = Readable.from(body ? [Buffer.isBuffer(body) ? body : Buffer.from(body)] : []);
  req.method = method;
  req.url = url;
  req.headers = headers;

  let ended = false;
  let responseBody = Buffer.alloc(0);
  const responseHeaders = {};
  const res = {
    statusCode: 200,
    setHeader(name, value) { responseHeaders[String(name).toLowerCase()] = value; },
    end(payload = "") {
      ended = true;
      responseBody = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
    },
  };

  await app.handler(req, res);
  assert.equal(ended, true);

  const text = responseBody.toString("utf8");
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { statusCode: res.statusCode, headers: responseHeaders, text, json };
}

function buildMultipart(audioBuffer, filename, mimeType) {
  const boundary = "----TestBoundary123456";
  const header =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="audio"; filename="${filename}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  return {
    boundary,
    body: Buffer.concat([Buffer.from(header, "latin1"), audioBuffer, Buffer.from(footer, "latin1")]),
  };
}

// ─── Mock provider: returns placeholder for audio-base64 ─────────────────

test("mock transcription provider returns placeholder for audio-base64", async () => {
  const { createMockTranscriptionProvider } = await import(
    "../src/providers/transcription/mockProvider.js"
  );
  const provider = createMockTranscriptionProvider();

  assert.equal(provider.name, "mock");

  const result = await provider.transcribe({
    type: "audio-base64",
    content: audioBase64,
    mimeType: "audio/mpeg",
  });

  assert.match(result.text, /mock transcription/i);
});

test("mock transcription provider passes through text-simulated-audio", async () => {
  const { createMockTranscriptionProvider } = await import(
    "../src/providers/transcription/mockProvider.js"
  );
  const provider = createMockTranscriptionProvider();

  const result = await provider.transcribe({
    type: "text-simulated-audio",
    content: "Patienten har hosta sedan tre dagar.",
  });

  assert.equal(result.text, "Patienten har hosta sedan tre dagar.");
});

// ─── OpenAI provider: returns unconfigured when no API key ──────────────

test("openai transcription provider returns unconfigured when no API key", async () => {
  const { createOpenAiTranscriptionProvider } = await import(
    "../src/providers/transcription/openAiProvider.js"
  );
  const provider = createOpenAiTranscriptionProvider({
    openai: { apiKey: "", baseUrl: "https://api.openai.com", transcribeModel: "whisper-1" },
  });

  assert.equal(provider.name, "openai");

  const result = await provider.transcribe({
    type: "audio-base64",
    content: audioBase64,
    mimeType: "audio/mpeg",
  });

  assert.match(result.text, /not configured/i);
});

test("openai transcription provider returns unconfigured for text-simulated-audio when no key", async () => {
  const { createOpenAiTranscriptionProvider } = await import(
    "../src/providers/transcription/openAiProvider.js"
  );
  const provider = createOpenAiTranscriptionProvider({
    openai: { apiKey: "", baseUrl: "https://api.openai.com", transcribeModel: "whisper-1" },
  });

  const result = await provider.transcribe({
    type: "text-simulated-audio",
    content: "Hosta sedan tre dagar",
  });

  // Without an API key, even text-simulated-audio returns the unconfigured message
  assert.match(result.text, /not configured/i);
});

// ─── Deepgram provider: returns unconfigured when no API key ────────────

test("deepgram transcription provider returns unconfigured when no API key", async () => {
  const { createDeepgramTranscriptionProvider } = await import(
    "../src/providers/transcription/deepgramProvider.js"
  );
  const provider = createDeepgramTranscriptionProvider({
    deepgram: { apiKey: "", model: "nova-3-medical" },
  });

  assert.equal(provider.name, "deepgram");

  const result = await provider.transcribe({
    type: "audio-base64",
    content: audioBase64,
    mimeType: "audio/mpeg",
  });

  assert.match(result.text, /not configured/i);
});

// ─── Google Speech provider: returns unconfigured when no API key ───────

test("google speech provider returns unconfigured when no API key", async () => {
  const { createGoogleSpeechTranscriptionProvider } = await import(
    "../src/providers/transcription/googleSpeechProvider.js"
  );
  const provider = createGoogleSpeechTranscriptionProvider({
    google: { speechApiKey: "", speechModel: "latest_long" },
  });

  assert.equal(provider.name, "google");

  const result = await provider.transcribe({
    type: "audio-base64",
    content: audioBase64,
    mimeType: "audio/mpeg",
  });

  assert.match(result.text, /not configured/i);
});

// ─── Berget provider: returns unconfigured when no API key ──────────────

test("berget transcription provider returns unconfigured when no API key", async () => {
  const { createBergetTranscriptionProvider } = await import(
    "../src/providers/transcription/bergetProvider.js"
  );
  const provider = createBergetTranscriptionProvider({
    berget: { apiKey: "", baseUrl: "https://api.berget.ai", transcribeModel: "KBLab/kb-whisper-large" },
  });

  assert.equal(provider.name, "berget");

  const result = await provider.transcribe({
    type: "audio-base64",
    content: audioBase64,
    mimeType: "audio/mpeg",
  });

  assert.match(result.text, /not configured/i);
});

// ─── Whisper.cpp / faster-whisper: returns placeholder when no command ───

test("whisper.cpp provider returns placeholder when no local command configured", async () => {
  const { createWhisperCppTranscriptionProvider } = await import(
    "../src/providers/transcription/whisperCppProvider.js"
  );
  const provider = createWhisperCppTranscriptionProvider({
    transcriptionProvider: "faster-whisper",
    whisper: { localCommand: "", timeoutMs: 5000 },
  });

  assert.equal(provider.name, "faster-whisper");

  const result = await provider.transcribe({
    type: "audio-base64",
    content: audioBase64,
    mimeType: "audio/mpeg",
  });

  assert.match(result.text, /WHISPER_LOCAL_COMMAND/i);
});

test("whisper.cpp provider passes through text-simulated-audio", async () => {
  const { createWhisperCppTranscriptionProvider } = await import(
    "../src/providers/transcription/whisperCppProvider.js"
  );
  const provider = createWhisperCppTranscriptionProvider({
    transcriptionProvider: "whisper.cpp",
    whisper: { localCommand: "", timeoutMs: 5000 },
  });

  const result = await provider.transcribe({
    type: "text-simulated-audio",
    content: "Patienten mår bra.",
  });

  assert.equal(result.text, "Patienten mår bra.");
});

// ─── Provider factory creates all providers without error ───────────────

test("transcription provider factory creates all supported providers", async () => {
  const { createTranscriptionProvider } = await import(
    "../src/providers/transcription/index.js"
  );

  const configs = [
    { provider: "mock", expected: "mock" },
    { provider: "openai", expected: "openai" },
    { provider: "whisper.cpp", expected: "whisper.cpp" },
    { provider: "faster-whisper", expected: "faster-whisper" },
    { provider: "deepgram", expected: "deepgram" },
    { provider: "google", expected: "google" },
    { provider: "berget", expected: "berget" },
  ];

  for (const { provider, expected } of configs) {
    const p = createTranscriptionProvider({
      transcriptionProvider: provider,
      openai: { apiKey: "", baseUrl: "https://api.openai.com", transcribeModel: "whisper-1" },
      deepgram: { apiKey: "", model: "nova-3-medical" },
      google: { speechApiKey: "", speechModel: "latest_long" },
      berget: { apiKey: "", baseUrl: "https://api.berget.ai", transcribeModel: "KBLab/kb-whisper-large" },
      whisper: { localCommand: "", timeoutMs: 5000 },
    });
    assert.equal(p.name, expected, `provider ${provider} should have name ${expected}`);
  }
});

test("transcription provider factory throws for unsupported provider", async () => {
  const { createTranscriptionProvider } = await import(
    "../src/providers/transcription/index.js"
  );

  assert.throws(() => {
    createTranscriptionProvider({ transcriptionProvider: "nonexistent" });
  }, /unsupported/i);
});

// ─── Upload endpoint with real audio bytes ──────────────────────────────

test("upload endpoint accepts real MP3 audio and returns mock transcript", async () => {
  const app = createApp({ config: baseConfig() });
  const { boundary, body } = buildMultipart(audioBytes, "sample_swedish.mp3", "audio/mpeg");

  const res = await invoke(app, {
    method: "POST",
    url: "/v1/transcribe/upload",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "x-scribe-language": "sv",
      "x-scribe-locale": "sv-SE",
      "x-scribe-country": "SE",
    },
    body,
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json.filename, "sample_swedish.mp3");
  assert.equal(res.json.bytes, audioBytes.length);
  assert.equal(res.json.provider, "mock");
  assert.equal(typeof res.json.transcript, "string");
  assert.ok(res.json.transcript.length > 0, "transcript should be non-empty");
});

// ─── Full scribe flow: transcript ➜ note (mock providers) ──────────────

test("full scribe flow with mock providers produces note from transcript", async () => {
  const app = createApp({ config: baseConfig() });

  const res = await invoke(app, {
    method: "POST",
    url: "/v1/encounters/scribe",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      transcript: "Patienten är en 52-årig kvinna med trötthet sedan tre veckor. Blodtryck 120/80.",
      country: "SE",
      noteStyle: "soap",
      specialty: "primary-care",
      locale: "sv-SE",
      language: "sv",
    }),
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json.providers.transcription, "mock");
  assert.equal(res.json.providers.note, "mock");
  assert.equal(typeof res.json.noteDraft, "string");
  assert.equal(typeof res.json.transcript, "string");
  assert.match(res.json.transcript, /52-årig/);
  assert.ok(res.json.prompt, "response should include prompt");
  assert.ok(res.json.prompt.system, "prompt should have system field");
  assert.ok(res.json.prompt.user, "prompt should have user field");
});

// ─── Settings endpoint returns provider and model info ──────────────────

test("settings endpoint returns provider and model info for UI display", async () => {
  const app = createApp({
    config: baseConfig({
      transcriptionProvider: "faster-whisper",
      noteProvider: "ollama",
    }),
  });

  const res = await invoke(app, { method: "GET", url: "/v1/settings" });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json.transcriptionProvider, "faster-whisper");
  assert.equal(res.json.noteProvider, "ollama");
  assert.equal(res.json.ollama.model, "llama3.1:8b");
  assert.equal(typeof res.json.ollama.baseUrl, "string");
});

// ─── Provider switching via settings POST ───────────────────────────────

test("settings POST switches providers and rebuilds", async () => {
  const app = createApp({
    config: baseConfig({
      transcriptionProvider: "mock",
      noteProvider: "mock",
    }),
  });

  // Verify starting with mock
  const before = await invoke(app, { method: "GET", url: "/v1/settings" });
  assert.equal(before.json.transcriptionProvider, "mock");

  // Switch to faster-whisper (no localCommand, so it will return placeholder)
  const patchRes = await invoke(app, {
    method: "POST",
    url: "/v1/settings",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcriptionProvider: "faster-whisper" }),
  });

  assert.equal(patchRes.statusCode, 200);
  assert.equal(patchRes.json.transcriptionProvider, "faster-whisper");

  // Verify the provider was rebuilt by using scribe with text transcript
  const txRes = await invoke(app, {
    method: "POST",
    url: "/v1/encounters/scribe",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcript: "Patienten har ont i ryggen." }),
  });

  assert.equal(txRes.statusCode, 200);
  assert.equal(txRes.json.providers.transcription, "faster-whisper");
});
