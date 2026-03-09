import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../src/server/createApp.js";

function baseConfig(overrides = {}) {
  const nonce = randomUUID();
  const defaults = {
    port: 8787,
    scribeMode: "hybrid",
    appEnv: "test",
    publicBaseUrl: "",
    auth: {
      bearerToken: "",
    },
    clientAccess: {
      stateFile: join(tmpdir(), `oms-client-access-${nonce}.json`),
      trialMaxRequests: 20,
      trialMaxAudioSeconds: 20 * 60,
      trialMaxEstimatedCostUsd: 2.5,
      bootstrapPerIpPerHour: 10,
      bootstrapPerInstallPerDay: 3,
      estimatedCostPerAudioMinuteUsd: 0.08,
      requireAttestation: false,
    },
    settings: {
      file: join(tmpdir(), `oms-settings-${nonce}.json`),
      writeEnabled: true,
    },
    http: {
      maxRequestBytes: 64 * 1024,
    },
    defaultNoteStyle: "soap",
    defaultSpecialty: "primary-care",
    enableWebUi: false,
    enableSettingsUi: false,
    privacy: {
      phiRedactionMode: "basic",
      redactBeforeApiCalls: true,
      auditLogFile: "",
    },
    transcriptionProvider: "mock",
    noteProvider: "mock",
    openai: {
      apiKey: "",
      baseUrl: "https://api.openai.com",
      transcribeModel: "gpt-4o-mini-transcribe",
      noteModel: "gpt-4.1-mini",
    },
    anthropic: {
      apiKey: "",
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-4-20250514",
    },
    gemini: {
      apiKey: "",
      model: "gemini-2.0-flash",
    },
    deepgram: {
      apiKey: "",
      model: "nova-3-medical",
    },
    google: {
      speechApiKey: "",
      speechModel: "latest_long",
    },
    berget: {
      apiKey: "",
      baseUrl: "https://api.berget.ai",
      transcribeModel: "KBLab/kb-whisper-large",
      noteModel: "openai/gpt-oss-120b",
    },
    ollama: {
      baseUrl: "http://localhost:11434",
      model: "llama3.1:8b",
    },
    whisper: {
      localCommand: "",
      timeoutMs: 1000,
      expects: "stdin",
    },
  };

  return {
    ...defaults,
    ...overrides,
    auth: {
      ...defaults.auth,
      ...overrides.auth,
    },
    clientAccess: {
      ...defaults.clientAccess,
      ...overrides.clientAccess,
    },
    settings: {
      ...defaults.settings,
      ...overrides.settings,
    },
  };
}

async function invoke(app, { method, url, headers = {}, body }) {
  const req = Readable.from(body ? [body] : []);
  req.method = method;
  req.url = url;
  req.headers = headers;

  let ended = false;
  let responseBody = Buffer.alloc(0);
  const responseHeaders = {};
  const res = {
    statusCode: 200,
    setHeader(name, value) {
      responseHeaders[String(name).toLowerCase()] = value;
    },
    end(payload = "") {
      ended = true;
      responseBody = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
    },
  };

  await app.handler(req, res);
  assert.equal(ended, true);

  const text = responseBody.toString("utf8");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    statusCode: res.statusCode,
    headers: responseHeaders,
    text,
    json,
  };
}

test("GET /health returns service status", async () => {
  const app = createApp({ config: baseConfig() });
  const res = await invoke(app, { method: "GET", url: "/health" });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json.ok, true);
  assert.equal(res.json.service, "open-medical-scribe");
  assert.equal(res.json.env, "test");
});

test("GET / serves the public landing page when web UI is enabled", async () => {
  const app = createApp({ config: baseConfig({ enableWebUi: true }) });
  const res = await invoke(app, { method: "GET", url: "/" });

  assert.equal(res.statusCode, 200);
  assert.match(res.text, /Eir Scribe/);
  assert.match(res.text, /Sweden-hosted cloud path/i);
});

test("GET /app serves the branded recorder web app", async () => {
  const app = createApp({ config: baseConfig({ enableWebUi: true }) });
  const res = await invoke(app, { method: "GET", url: "/app" });

  assert.equal(res.statusCode, 200);
  assert.match(res.text, /One recording\. One secure cloud draft\./);
  assert.match(res.text, /Cloud access is prepared automatically the first time you transcribe\./i);
  assert.match(res.text, /Local activity/i);
  assert.match(res.text, /Choose local browser models/i);
  assert.match(res.text, /Custom WebLLM \/ MLC model ID/i);
  assert.match(res.text, /Qwen 3\.5 9B \(custom WebLLM build\)/i);
  assert.match(res.text, /KB Whisper Large ONNX/i);
});

test("GET /local-model-worker.js serves the browser local-model worker", async () => {
  const app = createApp({ config: baseConfig({ enableWebUi: true }) });
  const res = await invoke(app, { method: "GET", url: "/local-model-worker.js" });

  assert.equal(res.statusCode, 200);
  assert.match(res.text, /CreateMLCEngine/);
  assert.match(res.text, /automatic-speech-recognition/);
});

test("HEAD /site.css returns the branded stylesheet headers", async () => {
  const app = createApp({ config: baseConfig({ enableWebUi: true }) });
  const res = await invoke(app, { method: "HEAD", url: "/site.css" });

  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers["content-type"]), /text\/css/);
});

test("GET /privacy-policy.html serves the privacy page when web UI is enabled", async () => {
  const app = createApp({ config: baseConfig({ enableWebUi: true }) });
  const res = await invoke(app, { method: "GET", url: "/privacy-policy.html" });

  assert.equal(res.statusCode, 200);
  assert.match(res.text, /Privacy Policy/);
});

test("GET /support.html serves the support page when web UI is enabled", async () => {
  const app = createApp({ config: baseConfig({ enableWebUi: true }) });
  const res = await invoke(app, { method: "GET", url: "/support.html" });

  assert.equal(res.statusCode, 200);
  assert.match(res.text, /Support/);
});

test("GET /settings is hidden when settings UI is disabled", async () => {
  const app = createApp({ config: baseConfig({ enableWebUi: true, enableSettingsUi: false }) });
  const res = await invoke(app, { method: "GET", url: "/settings" });

  assert.equal(res.statusCode, 404);
});

test("POST /v1/settings can be disabled in production", async () => {
  const app = createApp({
    config: baseConfig({
      settings: {
        file: "data/test-settings.json",
        writeEnabled: false,
      },
    }),
  });
  const res = await invoke(app, {
    method: "POST",
    url: "/v1/settings",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ noteProvider: "berget" }),
  });

  assert.equal(res.statusCode, 403);
  assert.match(res.json.error, /disabled/i);
});

test("POST /v1/encounters/scribe requires bearer auth when configured", async () => {
  const app = createApp({ config: baseConfig({ auth: { bearerToken: "secret-token" } }) });
  const res = await invoke(app, {
    method: "POST",
    url: "/v1/encounters/scribe",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcript: "Patienten har hosta." }),
  });

  assert.equal(res.statusCode, 401);
  assert.match(res.json.error, /unauthorized/i);
});

test("POST /v1/encounters/scribe accepts bearer auth when configured", async () => {
  const app = createApp({ config: baseConfig({ auth: { bearerToken: "secret-token" } }) });
  const res = await invoke(app, {
    method: "POST",
    url: "/v1/encounters/scribe",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer secret-token",
    },
    body: JSON.stringify({ transcript: "Patienten har hosta." }),
  });

  assert.equal(res.statusCode, 200);
  assert.ok(typeof res.json.noteDraft === "string" && res.json.noteDraft.length > 0);
});

test("POST /v1/client/bootstrap issues a trial client token", async () => {
  const app = createApp({ config: baseConfig({ auth: { bearerToken: "secret-token" } }) });
  const res = await invoke(app, {
    method: "POST",
    url: "/v1/client/bootstrap",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
      "user-agent": "EirScribeTests/1.0",
    },
    body: JSON.stringify({
      installId: "install-123456789012",
      platform: "ios",
      attestation: {
        provider: "app_attest",
        status: "supported_key_ready",
        isSupported: true,
      },
    }),
  });

  assert.equal(res.statusCode, 200);
  assert.match(res.json.clientId, /^cli_/);
  assert.match(res.json.bearerToken, /^oms_/);
  assert.equal(res.json.quota.remaining.requests, 20);
});

test("POST /v1/encounters/scribe accepts a bootstrap client token", async () => {
  const app = createApp({ config: baseConfig({ auth: { bearerToken: "secret-token" } }) });
  const bootstrap = await invoke(app, {
    method: "POST",
    url: "/v1/client/bootstrap",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify({
      installId: "install-abcdefghijkl",
      platform: "ios",
      attestation: {
        provider: "app_attest",
        status: "supported_key_ready",
        isSupported: true,
      },
    }),
  });

  const res = await invoke(app, {
    method: "POST",
    url: "/v1/encounters/scribe",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${bootstrap.json.bearerToken}`,
    },
    body: JSON.stringify({ transcript: "Patienten har hosta." }),
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json.clientQuota.used.requests, 1);
});

test("POST /v1/encounters/scribe enforces client trial request caps", async () => {
  const app = createApp({
    config: baseConfig({
      auth: { bearerToken: "secret-token" },
      clientAccess: {
        trialMaxRequests: 1,
        trialMaxAudioSeconds: 20 * 60,
        trialMaxEstimatedCostUsd: 2.5,
        bootstrapPerIpPerHour: 10,
        bootstrapPerInstallPerDay: 3,
        estimatedCostPerAudioMinuteUsd: 0.08,
        requireAttestation: false,
      },
    }),
  });
  const bootstrap = await invoke(app, {
    method: "POST",
    url: "/v1/client/bootstrap",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify({
      installId: "install-request-limit",
      platform: "ios",
      attestation: {
        provider: "app_attest",
        status: "supported_key_ready",
        isSupported: true,
      },
    }),
  });

  await invoke(app, {
    method: "POST",
    url: "/v1/encounters/scribe",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${bootstrap.json.bearerToken}`,
    },
    body: JSON.stringify({ transcript: "Första anteckningen." }),
  });

  const second = await invoke(app, {
    method: "POST",
    url: "/v1/encounters/scribe",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${bootstrap.json.bearerToken}`,
    },
    body: JSON.stringify({ transcript: "Andra anteckningen." }),
  });

  assert.equal(second.statusCode, 429);
  assert.equal(second.json.code, "trial_request_limit_reached");
});

test("POST /v1/export/fhir-document-reference validates noteText", async () => {
  const app = createApp({ config: baseConfig() });
  const res = await invoke(app, {
    method: "POST",
    url: "/v1/export/fhir-document-reference",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ noteText: "   " }),
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.json.error, /noteText is required/i);
});

test("POST /v1/export/fhir-document-reference returns DocumentReference", async () => {
  const app = createApp({ config: baseConfig() });
  const res = await invoke(app, {
    method: "POST",
    url: "/v1/export/fhir-document-reference",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      noteText: "S: cough\nO: lungs clear",
      encounterId: "enc_1",
      meta: { noteStyle: "soap", specialty: "primary-care" },
    }),
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json.resourceType, "DocumentReference");
  assert.equal(res.json.id, "enc_1");
});

test("POST /v1/transcribe/upload handles multipart audio file", async () => {
  const app = createApp({ config: baseConfig() });
  const boundary = "xYz123";
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="audio"; filename="sample.wav"\r\n` +
    `Content-Type: audio/wav\r\n\r\n` +
    `fakeaudio\r\n` +
    `--${boundary}--\r\n`;

  const res = await invoke(app, {
    method: "POST",
    url: "/v1/transcribe/upload",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body: Buffer.from(body, "latin1"),
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json.filename, "sample.wav");
  assert.equal(res.json.bytes, 9);
  assert.match(res.json.transcript, /mock transcription/i);
  assert.equal(res.json.transcriptDocument.text, res.json.transcript);
});

test("POST /v1/transcribe/upload rejects non-multipart content", async () => {
  const app = createApp({ config: baseConfig() });
  const res = await invoke(app, {
    method: "POST",
    url: "/v1/transcribe/upload",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.json.error, /multipart\/form-data/i);
});

test("POST /v1/transcribe/upload rejects multipart without audio file", async () => {
  const app = createApp({ config: baseConfig() });
  const boundary = "missingAudioBoundary";
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="noteStyle"\r\n\r\n` +
    `soap\r\n` +
    `--${boundary}--\r\n`;

  const res = await invoke(app, {
    method: "POST",
    url: "/v1/transcribe/upload",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body: Buffer.from(body, "latin1"),
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.json.error, /Missing file field "audio"/);
});

test("POST /v1/transcripts/search returns accent-insensitive matches", async () => {
  const app = createApp({ config: baseConfig() });
  const res = await invoke(app, {
    method: "POST",
    url: "/v1/transcripts/search",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      transcript: "Patienten har ömhet i bröstet och ny hosta sedan igår.",
      query: "omhet",
    }),
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json.transcriptDocument.text, "Patienten har ömhet i bröstet och ny hosta sedan igår.");
  assert.equal(res.json.matches.length, 1);
  assert.match(res.json.matches[0].excerpt, /ömhet/i);
});

test("POST /v1/transcripts/search validates query", async () => {
  const app = createApp({ config: baseConfig() });
  const res = await invoke(app, {
    method: "POST",
    url: "/v1/transcripts/search",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcript: "Patienten mår bra." }),
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.json.error, /query is required/i);
});

test("GET /v1/providers includes Berget note support", async () => {
  const app = createApp({ config: baseConfig() });
  const res = await invoke(app, { method: "GET", url: "/v1/providers" });

  assert.equal(res.statusCode, 200);
  assert.ok(res.json.supported.note.some((provider) => provider.id === "berget"));
});
