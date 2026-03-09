import { badRequest, jsonResponse, readJsonBody, readRawBody } from "../util/http.js";
import { createScribeService } from "../services/scribeService.js";
import { createNoteGenerator } from "../providers/note/index.js";
import { createTranscriptionProvider } from "../providers/transcription/index.js";
import { serveStaticFile } from "./static.js";
import { buildFhirDocumentReference } from "../services/fhirExport.js";
import { parseMultipartFormData } from "../util/multipart.js";
import { applySavedSettings, saveSettings, configToSettingsResponse } from "../services/settingsStore.js";
import { buildTranscriptDocument, searchTranscriptDocument } from "../services/transcriptArtifacts.js";
import { createClientAccessService } from "../services/clientAccessService.js";

export function createApp({ config }) {
  let transcriptionProvider = createTranscriptionProvider(config);
  let noteGenerator = createNoteGenerator(config);
  const clientAccess = createClientAccessService(config);
  let scribeService = createScribeService({
    config,
    transcriptionProvider,
    noteGenerator,
  });

  function rebuildProviders() {
    transcriptionProvider = createTranscriptionProvider(config);
    noteGenerator = createNoteGenerator(config);
    scribeService = createScribeService({ config, transcriptionProvider, noteGenerator });
  }

  return {
    async handler(req, res) {
      try {
        const isGetOrHead = req.method === "GET" || req.method === "HEAD";
        const staticOptions = { headOnly: req.method === "HEAD" };

        if (req.method === "GET" && req.url === "/health") {
          return jsonResponse(res, 200, {
            ok: true,
            service: "open-medical-scribe",
            mode: config.scribeMode,
            env: config.appEnv,
            webUi: config.enableWebUi,
            publicBaseUrl: config.publicBaseUrl,
          });
        }

        if (req.method === "GET" && req.url === "/config") {
          return jsonResponse(res, 200, {
            scribeMode: config.scribeMode,
            transcriptionProvider: config.transcriptionProvider,
            noteProvider: config.noteProvider,
            defaultNoteStyle: config.defaultNoteStyle,
          });
        }

        if (req.method === "GET" && req.url === "/v1/providers") {
          if (ensureAdminAuthorized(req, res, config)) return;
          return jsonResponse(res, 200, {
            runtime: {
              mode: config.scribeMode,
              transcriptionProvider: config.transcriptionProvider,
              noteProvider: config.noteProvider,
              webUi: config.enableWebUi,
            },
            supported: {
              transcription: [
                { id: "mock", name: "Mock (dev)", type: "mock", configured: true },
                { id: "openai", name: "OpenAI Whisper", type: "cloud", configured: !!config.openai.apiKey },
                { id: "deepgram", name: "Deepgram", type: "cloud", configured: !!config.deepgram.apiKey },
                { id: "google", name: "Google Cloud Speech", type: "cloud", configured: !!config.google.speechApiKey },
                { id: "berget", name: "Berget AI (EU)", type: "cloud", configured: !!config.berget.apiKey },
                { id: "whisper.cpp", name: "whisper.cpp", type: "local", configured: !!config.whisper.localCommand },
                { id: "faster-whisper", name: "faster-whisper", type: "local", configured: !!config.whisper.localCommand },
              ],
              note: [
                { id: "mock", name: "Mock (dev)", type: "mock", configured: true },
                { id: "openai", name: "OpenAI", type: "cloud", configured: !!config.openai.apiKey },
                { id: "berget", name: "Berget AI (EU)", type: "cloud", configured: !!config.berget.apiKey },
                { id: "anthropic", name: "Anthropic Claude", type: "cloud", configured: !!config.anthropic.apiKey },
                { id: "gemini", name: "Google Gemini", type: "cloud", configured: !!config.gemini.apiKey },
                { id: "ollama", name: "Ollama (local)", type: "local", configured: true },
              ],
            },
            noteStyles: ["soap", "hp", "progress", "dap", "procedure", "journal"],
          });
        }

        if (req.method === "GET" && req.url === "/v1/settings") {
          if (ensureAdminAuthorized(req, res, config)) return;
          return jsonResponse(res, 200, configToSettingsResponse(config));
        }

        if (req.method === "POST" && req.url === "/v1/settings") {
          if (ensureAdminAuthorized(req, res, config)) return;
          const patch = await readJsonBody(req, { maxBytes: config.http.maxRequestBytes });
          const merged = saveSettings(patch, config);
          applySavedSettings(config);
          rebuildProviders();
          console.log(`[settings] Providers rebuilt: tx=${config.transcriptionProvider}, note=${config.noteProvider}`);
          return jsonResponse(res, 200, configToSettingsResponse(config));
        }

        if (req.method === "POST" && req.url === "/v1/client/bootstrap") {
          const body = await readJsonBody(req, { maxBytes: config.http.maxRequestBytes });
          const bootstrap = clientAccess.issueBootstrapToken({
            installId: body.installId,
            ipAddress: getRequestIp(req),
            userAgent: req.headers?.["user-agent"] || "",
            platform: body.platform || "unknown",
            attestation: body.attestation || {},
          });
          return jsonResponse(res, 200, bootstrap);
        }

        if (req.method === "POST" && req.url === "/v1/encounters/scribe") {
          const auth = authorizeScribeRequest(req, res, config, clientAccess);
          if (!auth) return;
          if (auth.kind === "client") {
            clientAccess.assertCanUseClient(auth.clientId);
          }
          const body = await readJsonBody(req, { maxBytes: config.http.maxRequestBytes });
          const result = await scribeService.processEncounter(body);
          if (auth.kind === "client") {
            result.clientQuota = clientAccess.recordScribeUsage(auth.clientId, {
              input: body,
              result,
            });
          }
          return jsonResponse(res, 200, result);
        }

        if (req.method === "POST" && req.url === "/v1/transcribe") {
          if (ensureAdminAuthorized(req, res, config)) return;
          const body = await readJsonBody(req, { maxBytes: config.http.maxRequestBytes });
          const transcript = await scribeService.transcribeOnly(body);
          return jsonResponse(res, 200, transcript);
        }

        if (req.method === "POST" && req.url === "/v1/transcripts/search") {
          if (ensureAdminAuthorized(req, res, config)) return;
          const body = await readJsonBody(req, { maxBytes: config.http.maxRequestBytes });
          if (!body || typeof body.query !== "string" || !body.query.trim()) {
            return jsonResponse(res, 400, { error: "query is required" });
          }

          const transcriptDocument = body.transcriptDocument
            ? buildTranscriptDocument(body.transcriptDocument, body.transcriptDocument)
            : buildTranscriptDocument(
              { text: body.transcript || "" },
              {
                language: body.language,
                locale: body.locale,
                country: body.country,
              },
            );

          return jsonResponse(res, 200, {
            query: body.query,
            transcriptDocument,
            matches: searchTranscriptDocument(transcriptDocument, body.query, {
              limit: body.limit,
            }),
          });
        }

        if (req.method === "POST" && req.url === "/v1/transcribe/upload") {
          if (ensureAdminAuthorized(req, res, config)) return;
          const contentType = req.headers?.["content-type"] || "";
          if (!String(contentType).toLowerCase().includes("multipart/form-data")) {
            throw badRequest("Expected multipart/form-data");
          }

          const raw = await readRawBody(req, { maxBytes: config.http.maxRequestBytes });
          const form = parseMultipartFormData(raw, contentType);
          const audio = form.files.audio;
          if (!audio?.buffer?.length) {
            throw badRequest('Missing file field "audio"');
          }

          const transcript = await scribeService.transcribeOnly({
            audioBase64: audio.buffer.toString("base64"),
            audioMimeType: audio.contentType,
            language: req.headers?.["x-scribe-language"],
            locale: req.headers?.["x-scribe-locale"],
            country: req.headers?.["x-scribe-country"],
          });

          return jsonResponse(res, 200, {
            ...transcript,
            filename: audio.filename,
            bytes: audio.buffer.length,
          });
        }

        if (req.method === "POST" && req.url === "/v1/export/fhir-document-reference") {
          if (ensureAdminAuthorized(req, res, config)) return;
          const body = await readJsonBody(req, { maxBytes: config.http.maxRequestBytes });
          if (!body || typeof body.noteText !== "string" || !body.noteText.trim()) {
            return jsonResponse(res, 400, { error: "noteText is required" });
          }

          const resource = buildFhirDocumentReference({
            noteText: body.noteText,
            encounterId: body.encounterId,
            patient: body.patient || {},
            clinician: body.clinician || {},
            meta: body.meta || {},
          });
          return jsonResponse(res, 200, resource);
        }

        if (config.enableWebUi && isGetOrHead && req.url === "/") {
          if (serveStaticFile(res, "public/index.html", staticOptions)) return;
        }

        if (config.enableWebUi && isGetOrHead && req.url === "/app") {
          if (serveStaticFile(res, "public/app.html", staticOptions)) return;
        }

        if (config.enableWebUi && isGetOrHead && req.url === "/app.js") {
          if (serveStaticFile(res, "public/app.js", staticOptions)) return;
        }

        if (config.enableWebUi && isGetOrHead && req.url === "/local-model-worker.js") {
          if (serveStaticFile(res, "public/local-model-worker.js", staticOptions)) return;
        }

        if (config.enableWebUi && isGetOrHead && req.url === "/styles.css") {
          if (serveStaticFile(res, "public/styles.css", staticOptions)) return;
        }

        if (config.enableWebUi && isGetOrHead && req.url === "/site.css") {
          if (serveStaticFile(res, "public/site.css", staticOptions)) return;
        }

        if (config.enableWebUi && isGetOrHead && req.url === "/site.js") {
          if (serveStaticFile(res, "public/site.js", staticOptions)) return;
        }

        if (config.enableWebUi && isGetOrHead && req.url === "/stream.js") {
          if (serveStaticFile(res, "public/stream.js", staticOptions)) return;
        }

        if (config.enableWebUi && isGetOrHead && req.url.startsWith("/brand/")) {
          if (serveStaticFile(res, `public${req.url}`, staticOptions)) return;
        }

        if (config.enableWebUi && isGetOrHead && req.url === "/privacy-policy.html") {
          if (serveStaticFile(res, "docs/privacy-policy.html", staticOptions)) return;
        }

        if (config.enableWebUi && isGetOrHead && req.url === "/support.html") {
          if (serveStaticFile(res, "docs/support.html", staticOptions)) return;
        }

        if (config.enableWebUi && config.enableSettingsUi && isGetOrHead && req.url === "/settings") {
          if (serveStaticFile(res, "public/settings.html", staticOptions)) return;
        }

        if (config.enableWebUi && config.enableSettingsUi && isGetOrHead && req.url === "/settings.js") {
          if (serveStaticFile(res, "public/settings.js", staticOptions)) return;
        }

        return jsonResponse(res, 404, { error: "Not Found" });
      } catch (error) {
        const status = error.statusCode || 500;
        return jsonResponse(res, status, {
          error: error.message || "Internal Server Error",
          code: error.code,
          quota: error.quota,
        });
      }
    },
  };
}

function ensureAdminAuthorized(req, res, config) {
  if (isAdminAuthorized(req, config)) {
    return false;
  }

  if (!config?.auth?.bearerToken) {
    return false;
  }

  res.setHeader("WWW-Authenticate", 'Bearer realm="open-medical-scribe"');
  jsonResponse(res, 401, { error: "Unauthorized" });
  return true;
}

function isAdminAuthorized(req, config) {
  const expected = config?.auth?.bearerToken || "";
  if (!expected) {
    return true;
  }

  const header = req.headers?.authorization || req.headers?.Authorization || "";
  return header === `Bearer ${expected}`;
}

function authorizeScribeRequest(req, res, config, clientAccess) {
  if (isAdminAuthorized(req, config)) {
    return { kind: "admin" };
  }

  const token = extractBearerToken(req);
  const client = clientAccess.authenticateClientToken(token);
  if (client) {
    return { kind: "client", clientId: client.clientId };
  }

  if (!config?.auth?.bearerToken && !token) {
    return { kind: "anonymous" };
  }

  res.setHeader("WWW-Authenticate", 'Bearer realm="open-medical-scribe"');
  jsonResponse(res, 401, { error: "Unauthorized" });
  return null;
}

function extractBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  if (!header.startsWith("Bearer ")) {
    return "";
  }

  return header.slice("Bearer ".length).trim();
}

function getRequestIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || "";
}
