import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createApp } from "../src/server/createApp.js";

function baseConfig(overrides = {}) {
  return {
    port: 8787,
    scribeMode: "hybrid",
    defaultNoteStyle: "soap",
    defaultSpecialty: "primary-care",
    enableWebUi: false,
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
    ollama: {
      baseUrl: "http://localhost:11434",
      model: "llama3.1:8b",
    },
    whisper: {
      localCommand: "",
      timeoutMs: 1000,
      expects: "stdin",
    },
    ...overrides,
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
