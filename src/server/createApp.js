import { badRequest, jsonResponse, readJsonBody, readRawBody } from "../util/http.js";
import { createScribeService } from "../services/scribeService.js";
import { createNoteGenerator } from "../providers/note/index.js";
import { createTranscriptionProvider } from "../providers/transcription/index.js";
import { serveStaticFile } from "./static.js";
import { buildFhirDocumentReference } from "../services/fhirExport.js";
import { parseMultipartFormData } from "../util/multipart.js";
import { applySavedSettings, saveSettings, configToSettingsResponse } from "../services/settingsStore.js";

export function createApp({ config }) {
  let transcriptionProvider = createTranscriptionProvider(config);
  let noteGenerator = createNoteGenerator(config);
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
        if (req.method === "GET" && req.url === "/health") {
          return jsonResponse(res, 200, {
            ok: true,
            service: "open-medical-scribe",
            mode: config.scribeMode,
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
                { id: "anthropic", name: "Anthropic Claude", type: "cloud", configured: !!config.anthropic.apiKey },
                { id: "gemini", name: "Google Gemini", type: "cloud", configured: !!config.gemini.apiKey },
                { id: "ollama", name: "Ollama (local)", type: "local", configured: true },
              ],
            },
            noteStyles: ["soap", "hp", "progress", "dap", "procedure"],
          });
        }

        if (req.method === "GET" && req.url === "/v1/settings") {
          return jsonResponse(res, 200, configToSettingsResponse(config));
        }

        if (req.method === "POST" && req.url === "/v1/settings") {
          const patch = await readJsonBody(req);
          const merged = saveSettings(patch);
          applySavedSettings(config);
          rebuildProviders();
          console.log(`[settings] Providers rebuilt: tx=${config.transcriptionProvider}, note=${config.noteProvider}`);
          return jsonResponse(res, 200, configToSettingsResponse(config));
        }

        if (req.method === "POST" && req.url === "/v1/encounters/scribe") {
          const body = await readJsonBody(req);
          const result = await scribeService.processEncounter(body);
          return jsonResponse(res, 200, result);
        }

        if (req.method === "POST" && req.url === "/v1/transcribe") {
          const body = await readJsonBody(req);
          const transcript = await scribeService.transcribeOnly(body);
          return jsonResponse(res, 200, transcript);
        }

        if (req.method === "POST" && req.url === "/v1/transcribe/upload") {
          const contentType = req.headers?.["content-type"] || "";
          if (!String(contentType).toLowerCase().includes("multipart/form-data")) {
            throw badRequest("Expected multipart/form-data");
          }

          const raw = await readRawBody(req);
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
          const body = await readJsonBody(req);
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

        if (config.enableWebUi && req.method === "GET" && req.url === "/") {
          if (serveStaticFile(res, "public/index.html")) return;
        }

        if (config.enableWebUi && req.method === "GET" && req.url === "/app.js") {
          if (serveStaticFile(res, "public/app.js")) return;
        }

        if (config.enableWebUi && req.method === "GET" && req.url === "/styles.css") {
          if (serveStaticFile(res, "public/styles.css")) return;
        }

        if (config.enableWebUi && req.method === "GET" && req.url === "/stream.js") {
          if (serveStaticFile(res, "public/stream.js")) return;
        }

        if (config.enableWebUi && req.method === "GET" && req.url === "/settings") {
          if (serveStaticFile(res, "public/settings.html")) return;
        }

        if (config.enableWebUi && req.method === "GET" && req.url === "/settings.js") {
          if (serveStaticFile(res, "public/settings.js")) return;
        }

        return jsonResponse(res, 404, { error: "Not Found" });
      } catch (error) {
        const status = error.statusCode || 500;
        return jsonResponse(res, status, {
          error: error.message || "Internal Server Error",
        });
      }
    },
  };
}
