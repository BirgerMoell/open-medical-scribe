# Open Medical Scribe

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 22](https://img.shields.io/badge/Node.js-%3E%3D22-brightgreen.svg)](https://nodejs.org/)

An open-source, privacy-first medical scribe that transcribes clinical encounters and generates structured clinical notes. Runs fully local, fully cloud, or hybrid.

**[Documentation](https://birgermoell.github.io/open-medical-scribe/)** | **[GitHub](https://github.com/BirgerMoell/open-medical-scribe)**

---

## Overview

Open Medical Scribe is a modular backend and desktop application for clinical documentation. It listens to doctor-patient conversations (via microphone or audio file), transcribes them using a pluggable speech-to-text provider, and generates structured clinical notes using a pluggable LLM provider. Every component is swappable: you can run the entire pipeline on your own hardware with no data leaving the building, use cloud APIs for maximum quality, or mix and match.

The project was born out of the need for a medical scribe that can operate under strict European healthcare privacy regulations while still being useful internationally. It ships with first-class support for Swedish clinical documentation (journalanteckningar) including Swedish-language prompts and the KB-Whisper model optimized for Swedish medical speech, but works equally well for English-language SOAP notes, H&P notes, behavioral health DAP notes, and more. Country auto-detection adapts the UI and transcription language automatically.

Open Medical Scribe is designed for clinicians, healthtech developers, researchers, and healthcare organizations who want full control over their clinical AI tooling -- from model selection to data residency. It is an assistive documentation tool, not a diagnostic system. All generated notes require clinician review and sign-off before use.

## Key Features

- **Fully local operation** -- Run transcription (Whisper ONNX / whisper.cpp / faster-whisper) and note generation (Ollama) entirely on your own hardware. No data leaves your machine.
- **Cloud provider support** -- Use OpenAI, Anthropic Claude, Google Gemini, Deepgram, Google Cloud Speech, or Berget AI for higher quality when privacy constraints allow.
- **Hybrid mode** -- Mix local and cloud providers freely (e.g., local transcription with cloud LLM).
- **Real-time streaming transcription** -- Live audio capture via WebSocket with AudioWorklet-based PCM streaming and interim results displayed in real time.
- **Six clinical note formats** -- SOAP, History & Physical, Progress Note, DAP (behavioral health), Procedure Note, and Swedish Journalanteckning.
- **Swedish medical focus** -- Native Swedish prompts, KB-Whisper ONNX model for Swedish medical speech, Swedish journal format with standard headings (Aktuellt, Anamnes, Status, Bedomning, Planering).
- **International support** -- Country auto-detection (SE, US, GB, NO, DK, DE) with locale-appropriate transcription and note language.
- **PHI redaction** -- Regex-based redaction of SSNs, phone numbers, emails, dates of birth, and medical record numbers before data is sent to cloud providers.
- **FHIR export** -- Generate FHIR R4 DocumentReference resources from clinical notes for EHR integration.
- **Desktop app (Electron)** -- One-click desktop application with optional bundled Whisper ONNX model and llama.cpp server for a fully self-contained experience.
- **CLI tools** -- Standalone `scribe-transcribe` and `scribe-note` binaries for scripting and pipeline use.
- **Web UI** -- Clean browser-based interface for recording, transcription review, note generation, and settings management.
- **Settings UI** -- In-browser configuration of providers, models, privacy settings, and streaming options without editing environment files.
- **Speaker diarization** -- Optional pyannote-based speaker diarization sidecar for multi-speaker encounters.
- **Audit logging** -- Configurable audit log for all transcription and note generation events.
- **OpenAI-compatible endpoint support** -- The OpenAI provider works with any service implementing the OpenAI API format (vLLM, llama.cpp server, LiteLLM, Together AI, Groq).
- **Zero dependencies beyond Node.js** -- The core server uses only `ws` (WebSocket) and `@huggingface/transformers` as runtime dependencies.

## Screenshots / Demo

> Screenshots and a demo video are coming soon. To see the application in action, follow the Quick Start instructions below.

## Quick Start

**Prerequisites:** [Node.js 22](https://nodejs.org/) or later.

```bash
# Clone the repository
git clone https://github.com/BirgerMoell/open-medical-scribe.git
cd open-medical-scribe

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env to set your providers and API keys (or leave defaults for mock mode)

# Start the server
npm start
```

The server starts at **http://localhost:8787**. Open it in a browser to access the recording UI. Click the microphone button to record, then stop to transcribe and generate a clinical note.

For development with auto-reload:

```bash
npm run dev
```

### Trying it without any API keys

Out of the box, the project starts in mock mode (no real transcription or note generation). To get real output with no API keys:

1. **Local transcription:** Set `TRANSCRIPTION_PROVIDER=whisper-onnx` in `.env`. The Whisper ONNX model will be downloaded automatically on first use.
2. **Local note generation:** Install [Ollama](https://ollama.ai/), pull a model (`ollama pull llama3.1:8b`), and set `NOTE_PROVIDER=ollama` in `.env`.

## Desktop App

Open Medical Scribe can run as a standalone Electron desktop application.

### Development mode

```bash
npm run electron:dev
```

This launches Electron, which starts the Node.js backend server on a random free port and opens the UI in a native window.

### Building for distribution

**Light build** (no bundled models -- uses system Ollama / cloud APIs):

```bash
# macOS
npm run electron:build:light:mac

# Windows
npm run electron:build:light:win
```

**Full build** (bundles Whisper ONNX model and a GGUF LLM with llama-server for fully offline operation):

```bash
# First, download models into build/extraResources/
npm run models:download:whisper
npm run models:download:llm

# Then build
# macOS
npm run electron:build:full:mac

# Windows
npm run electron:build:full:win
```

The full build bundles a `llama-server` binary and a `.gguf` model file. At launch, Electron starts llama-server automatically and routes note generation through it via the OpenAI-compatible API.

## CLI Tools

Two standalone CLI binaries can be compiled with [Bun](https://bun.sh/) for use in shell scripts and pipelines.

### Building

```bash
# Build both binaries
npm run build:cli

# Or build individually
npm run build:cli:transcribe
npm run build:cli:note
```

Binaries are written to `dist/scribe-transcribe` and `dist/scribe-note`.

### Usage

**Transcribe an audio file:**

```bash
./dist/scribe-transcribe --provider openai --language sv recording.wav
```

**Transcribe from stdin:**

```bash
cat recording.wav | ./dist/scribe-transcribe --provider whisper-onnx --language en
```

**Generate a note from a transcript:**

```bash
./dist/scribe-note --provider openai --note-style soap --transcript "Patient reports headache for 3 days..."
```

**Generate a note from a file:**

```bash
./dist/scribe-note --provider anthropic --note-style journal --transcript-file transcript.txt
```

**Full pipeline -- transcribe then generate a note:**

```bash
./dist/scribe-transcribe --provider openai recording.wav \
  | ./dist/scribe-note --provider anthropic --note-style soap
```

**Pipeline with local providers:**

```bash
./dist/scribe-transcribe --provider whisper-onnx --language sv recording.wav \
  | ./dist/scribe-note --provider ollama --note-style journal
```

Both tools read environment variables from `.env` and support `--help` for full option documentation.

## Configuration

All configuration is done through environment variables. Copy `.env.example` to `.env` and edit as needed. Settings can also be changed at runtime through the web UI at `/settings`.

### General

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `8787` |
| `SCRIBE_MODE` | Operating mode: `api`, `local`, or `hybrid` | `hybrid` |
| `DEFAULT_NOTE_STYLE` | Default note format: `soap`, `hp`, `progress`, `dap`, `procedure`, `journal` | `journal` |
| `DEFAULT_SPECIALTY` | Default medical specialty | `primary-care` |
| `DEFAULT_COUNTRY` | Default country code (e.g., `SE`, `US`). Empty = auto-detect. | `""` |
| `ENABLE_WEB_UI` | Serve the browser UI | `true` |

### Provider Selection

| Variable | Description | Default |
|----------|-------------|---------|
| `TRANSCRIPTION_PROVIDER` | Active transcription provider (see Providers section) | Depends on `SCRIBE_MODE` |
| `NOTE_PROVIDER` | Active note generation provider (see Providers section) | Depends on `SCRIBE_MODE` |

When `SCRIBE_MODE` is `api`, defaults are `openai` / `openai`. When `local`, defaults are `whisper.cpp` / `ollama`. When `hybrid`, defaults are `mock` / `mock`.

### Privacy

| Variable | Description | Default |
|----------|-------------|---------|
| `PHI_REDACTION_MODE` | PHI redaction strategy: `basic` (regex patterns) or `off` | `basic` |
| `REDACT_BEFORE_API_CALLS` | Redact PHI before sending transcripts to cloud note providers | `true` |
| `AUDIT_LOG_FILE` | Path to audit log file. Empty = no file logging. | `""` |

### OpenAI

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | `""` |
| `OPENAI_BASE_URL` | Base URL (change for OpenAI-compatible services) | `https://api.openai.com` |
| `OPENAI_TRANSCRIBE_MODEL` | Transcription model | `gpt-4o-mini-transcribe` |
| `OPENAI_NOTE_MODEL` | Note generation model | `gpt-4.1-mini` |

Compatible services via `OPENAI_BASE_URL`: vLLM (`http://localhost:8000`), llama.cpp (`http://localhost:8080`), LiteLLM (`http://localhost:4000`), Together AI (`https://api.together.xyz`), Groq (`https://api.groq.com/openai`).

### Anthropic

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key | `""` |
| `ANTHROPIC_BASE_URL` | Base URL | `https://api.anthropic.com` |
| `ANTHROPIC_MODEL` | Claude model | `claude-sonnet-4-20250514` |

### Google Gemini

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Gemini API key | `""` |
| `GEMINI_MODEL` | Gemini model | `gemini-2.0-flash` |

### Ollama (Local LLM)

| Variable | Description | Default |
|----------|-------------|---------|
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | Model name | `llama3.1:8b` |

### Deepgram

| Variable | Description | Default |
|----------|-------------|---------|
| `DEEPGRAM_API_KEY` | Deepgram API key | `""` |
| `DEEPGRAM_MODEL` | Deepgram model | `nova-3-medical` |

### Google Cloud Speech

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_SPEECH_API_KEY` | Google Cloud Speech API key | `""` |
| `GOOGLE_SPEECH_MODEL` | Speech model | `latest_long` |

### Berget AI (EU Sovereign)

| Variable | Description | Default |
|----------|-------------|---------|
| `BERGET_API_KEY` | Berget API key | `""` |
| `BERGET_BASE_URL` | Berget base URL | `https://api.berget.ai` |
| `BERGET_TRANSCRIBE_MODEL` | Transcription model | `KBLab/kb-whisper-large` |

### Local Whisper (whisper.cpp / faster-whisper)

| Variable | Description | Default |
|----------|-------------|---------|
| `WHISPER_LOCAL_COMMAND` | Shell command to run for local transcription | `""` |
| `LOCAL_TRANSCRIBE_TIMEOUT_MS` | Timeout for local transcription in milliseconds | `120000` |
| `LOCAL_TRANSCRIBE_EXPECTS` | Input method: `stdin` or `file` | `stdin` |

### Streaming (Real-time Audio)

| Variable | Description | Default |
|----------|-------------|---------|
| `STREAMING_TRANSCRIPTION_PROVIDER` | Streaming provider: `mock-stream`, `deepgram-stream`, `whisper-stream` | Auto from `TRANSCRIPTION_PROVIDER` |
| `STREAMING_WHISPER_MODEL` | Whisper ONNX model for streaming | `onnx-community/kb-whisper-large-ONNX` |
| `STREAMING_WHISPER_LANGUAGE` | Language for streaming Whisper | `sv` |
| `STREAMING_WHISPER_INTERVAL_MS` | Transcription interval for streaming chunks | `5000` |

### Speaker Diarization

| Variable | Description | Default |
|----------|-------------|---------|
| `DIARIZE_SIDECAR_URL` | URL of the pyannote diarization sidecar service | `http://localhost:8786` |
| `DIARIZE_ON_END` | Run diarization when a streaming session ends | `false` |

### CLI Provider

| Variable | Description | Default |
|----------|-------------|---------|
| `CLI_TRANSCRIBE_COMMAND` | Custom CLI command for transcription | `""` |
| `CLI_NOTE_COMMAND` | Custom CLI command for note generation | `""` |
| `CLI_TIMEOUT_MS` | Timeout for CLI commands | `120000` |

## Architecture

Open Medical Scribe follows a modular, provider-based architecture. The core application logic is independent of any specific transcription or LLM service.

```
open-medical-scribe/
├── src/
│   ├── index.js                  # Entry point — starts HTTP + WebSocket server
│   ├── config.js                 # Environment-based configuration loader
│   ├── providers/
│   │   ├── transcription/
│   │   │   ├── index.js          # Provider factory (batch transcription)
│   │   │   ├── streamIndex.js    # Provider factory (streaming transcription)
│   │   │   ├── openAiProvider.js
│   │   │   ├── deepgramProvider.js
│   │   │   ├── deepgramStreamProvider.js
│   │   │   ├── googleSpeechProvider.js
│   │   │   ├── bergetProvider.js
│   │   │   ├── whisperCppProvider.js
│   │   │   ├── whisperOnnxProvider.js
│   │   │   ├── whisperStreamProvider.js
│   │   │   ├── cliProvider.js
│   │   │   └── mockProvider.js
│   │   ├── note/
│   │   │   ├── index.js          # Provider factory (note generation)
│   │   │   ├── openAiProvider.js
│   │   │   ├── anthropicProvider.js
│   │   │   ├── geminiProvider.js
│   │   │   ├── ollamaProvider.js
│   │   │   ├── cliProvider.js
│   │   │   └── mockProvider.js
│   │   └── shared/               # Shared HTTP and CLI utilities
│   ├── server/
│   │   ├── createApp.js          # HTTP route handler and API endpoints
│   │   ├── streamHandler.js      # WebSocket server for streaming audio
│   │   └── static.js             # Static file serving for web UI
│   ├── services/
│   │   ├── scribeService.js      # Core orchestration: transcribe -> redact -> generate note
│   │   ├── promptBuilder.js      # Note style prompt templates (SOAP, H&P, DAP, etc.)
│   │   ├── privacy.js            # PHI redaction engine
│   │   ├── fhirExport.js         # FHIR R4 DocumentReference builder
│   │   ├── auditLogger.js        # Audit event logger
│   │   ├── diarizeClient.js      # Speaker diarization sidecar client
│   │   ├── settingsStore.js      # Runtime settings persistence
│   │   └── soapFormatter.js      # Fallback SOAP note formatter
│   └── util/                     # Low-level utilities (HTTP, multipart, WAV, env)
├── public/
│   ├── index.html                # Main recording UI
│   ├── app.js                    # UI application logic
│   ├── stream.js                 # WebSocket streaming client with AudioWorklet
│   ├── settings.html             # Settings configuration UI
│   ├── settings.js               # Settings UI logic
│   └── styles.css                # Stylesheet
├── electron/
│   ├── main.js                   # Electron main process
│   ├── llamaServer.js            # Bundled llama-server management
│   └── preload.js                # Electron preload script
├── cli/
│   ├── transcribe.js             # CLI transcription tool
│   ├── note.js                   # CLI note generation tool
│   └── lib/                      # CLI utilities
├── test/                         # Test suite (node --test)
├── scripts/                      # Model download scripts
├── diarize/                      # Pyannote diarization sidecar
└── dist/                         # Compiled CLI binaries
```

### Request flow

1. **Audio in** -- The browser captures audio via `MediaRecorder` (batch) or `AudioWorklet` + WebSocket (streaming).
2. **Transcription** -- Audio is sent to the configured transcription provider, which returns text.
3. **PHI redaction** -- If a cloud note provider is configured and redaction is enabled, sensitive patterns (SSN, phone, email, DOB, MRN) are replaced with tokens before the transcript reaches the LLM.
4. **Prompt building** -- The `promptBuilder` assembles a system prompt based on the selected note style, specialty, and language.
5. **Note generation** -- The transcript and prompt are sent to the configured LLM provider, which returns structured JSON with note text, sections, coding hints, follow-up questions, and warnings.
6. **Response** -- The API returns the complete encounter result including the original transcript, generated note, and metadata.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/config` | Current configuration summary |
| `GET` | `/v1/providers` | List supported and configured providers |
| `GET` | `/v1/settings` | Current settings (for UI) |
| `POST` | `/v1/settings` | Update settings at runtime |
| `POST` | `/v1/encounters/scribe` | Full pipeline: transcript/audio in, clinical note out |
| `POST` | `/v1/transcribe` | Transcription only (JSON body with base64 audio) |
| `POST` | `/v1/transcribe/upload` | Transcription only (multipart file upload) |
| `POST` | `/v1/export/fhir-document-reference` | Export a note as FHIR R4 DocumentReference |
| `WS` | `/v1/stream` | WebSocket endpoint for real-time streaming audio |

## Providers

### Transcription Providers

| Provider | Env Value | Type | Required Config | Notes |
|----------|-----------|------|-----------------|-------|
| Whisper ONNX | `whisper-onnx` | Local | None (auto-downloads model) | Uses `@huggingface/transformers` with ONNX runtime. Default model: `onnx-community/kb-whisper-large-ONNX`. |
| whisper.cpp | `whisper.cpp` | Local | `WHISPER_LOCAL_COMMAND` | Pipes audio to any CLI command that accepts audio on stdin and outputs text. |
| faster-whisper | `faster-whisper` | Local | `WHISPER_LOCAL_COMMAND` | Same adapter as whisper.cpp. |
| OpenAI Whisper | `openai` | Cloud | `OPENAI_API_KEY` | Also works with OpenAI-compatible services via `OPENAI_BASE_URL`. |
| Deepgram | `deepgram` | Cloud | `DEEPGRAM_API_KEY` | Nova-3 Medical model with smart formatting. |
| Google Cloud Speech | `google` | Cloud | `GOOGLE_SPEECH_API_KEY` | Speech-to-Text v1. |
| Berget AI | `berget` | Cloud | `BERGET_API_KEY` | EU sovereign infrastructure. Default model: `KBLab/kb-whisper-large`. |
| CLI | `cli` | Custom | `CLI_TRANSCRIBE_COMMAND` | Run any external command for transcription. |
| Mock | `mock` | Dev | None | Returns placeholder text for development. |

### Note Generation Providers

| Provider | Env Value | Type | Required Config | Notes |
|----------|-----------|------|-----------------|-------|
| OpenAI | `openai` | Cloud | `OPENAI_API_KEY` | GPT-4.1, GPT-4o, etc. Works with any OpenAI-compatible API via `OPENAI_BASE_URL`. |
| Anthropic Claude | `anthropic` | Cloud | `ANTHROPIC_API_KEY` | Claude Sonnet, Opus via the Messages API. |
| Google Gemini | `gemini` | Cloud | `GEMINI_API_KEY` | Gemini 2.0 Flash default. |
| Ollama | `ollama` | Local | `OLLAMA_BASE_URL` | Any Ollama-hosted model (Llama 3.1, Mistral, MedLlama2, BioMistral, etc.). |
| CLI | `cli` | Custom | `CLI_NOTE_COMMAND` | Run any external command for note generation. |
| Mock | `mock` | Dev | None | Returns placeholder note for development. |

### Streaming Transcription Providers

| Provider | Env Value | Type | Required Config | Notes |
|----------|-----------|------|-----------------|-------|
| Whisper Stream | `whisper-stream` | Local | None | Server-side Whisper ONNX processing of streamed audio chunks. |
| Deepgram Stream | `deepgram-stream` | Cloud | `DEEPGRAM_API_KEY` | Real-time Deepgram streaming with interim results. |
| Mock Stream | `mock-stream` | Dev | None | Returns placeholder transcripts for development. |

## Note Formats

| Style | Env/API Value | Language | Description |
|-------|---------------|----------|-------------|
| **SOAP** | `soap` | English | Subjective, Objective, Assessment, Plan. The most common outpatient note format. |
| **History & Physical** | `hp` | English | Comprehensive initial encounter note with Chief Complaint, HPI, PMH, Medications, Allergies, Family/Social History, ROS, Physical Exam, Assessment, and Plan. |
| **Progress Note** | `progress` | English | Follow-up visit note with Interval History, Current Medications, Examination Findings, Assessment, and Plan. |
| **DAP** | `dap` | English | Behavioral health note: Data (session observations), Assessment (clinical interpretation), Plan (next steps). |
| **Procedure Note** | `procedure` | English | Procedure Name, Indication, Pre-procedure Diagnosis, Anesthesia, Description, Findings, Specimens, Complications, Post-procedure Condition, and Plan. |
| **Swedish Journal** | `journal` | Swedish | Journalanteckning following Swedish clinical documentation standards: Aktuellt, Anamnes, Status, Bedomning, Planering. Uses standard Swedish medical abbreviations (AT, BT, Cor, Pulm, Buk). Includes ICD-10 coding hints where applicable. |

## Streaming Transcription

Open Medical Scribe supports real-time streaming transcription over WebSocket for live clinical encounters.

### How it works

1. **Browser audio capture** -- The `stream.js` client creates an `AudioContext` at 16 kHz and connects an `AudioWorkletNode` (`pcm-processor`) that extracts raw Float32 audio samples and converts them to PCM16 (signed 16-bit little-endian).

2. **WebSocket connection** -- The client connects to `ws://host/v1/stream` and sends a JSON configuration message with `language`, `country`, and `diarize` fields.

3. **Audio streaming** -- PCM16 audio frames are sent as binary WebSocket messages in real time.

4. **Server-side transcription** -- The `streamHandler` passes audio chunks to the configured streaming provider. For `whisper-stream`, audio is buffered and transcribed at a configurable interval (`STREAMING_WHISPER_INTERVAL_MS`, default 5 seconds) using the Whisper ONNX model.

5. **Result messages** -- The server sends JSON messages back to the client:
   - `{ type: "ready", provider }` -- Session started.
   - `{ type: "transcript", text, speaker, isFinal, words }` -- Interim or final transcript segment.
   - `{ type: "utterance_end" }` -- Speaker utterance boundary.
   - `{ type: "session_end", fullTranscript, speakers, diarization }` -- Session complete with assembled transcript.
   - `{ type: "error", message }` -- Error during processing.

6. **Session end** -- The client sends `{ type: "stop" }` or closes the connection. The server assembles the full transcript from all utterances with speaker labels and optionally runs post-session diarization via the pyannote sidecar.

### Optional speaker diarization

For multi-speaker encounters, an optional Python sidecar using pyannote.audio can run speaker diarization on the complete audio when the session ends. Set `DIARIZE_ON_END=true` and run the sidecar:

```bash
cd diarize
pip install -r requirements.txt
uvicorn server:app --port 8786
```

## Privacy and Security

Open Medical Scribe is designed for environments where patient data confidentiality is paramount.

### Local-only mode

When configured with local providers (`SCRIBE_MODE=local` or by selecting local providers individually), all processing happens on the machine running the server:

- **Audio** stays in memory during transcription and is never written to disk (unless audit logging is enabled).
- **Transcripts** are processed by a local Whisper model (ONNX or whisper.cpp) -- no network calls.
- **Note generation** runs through a local Ollama instance -- no network calls.
- **No telemetry** is collected or sent anywhere.

### PHI redaction

When cloud providers are used, the privacy module can automatically redact Protected Health Information before transcripts are sent to external APIs:

- Social Security Numbers (XXX-XX-XXXX pattern)
- Phone numbers
- Email addresses
- Dates of birth
- Medical Record Numbers

Redaction is enabled by default (`REDACT_BEFORE_API_CALLS=true`) and applies to cloud note providers (OpenAI, Anthropic, Gemini). It does not apply to local providers since data never leaves the machine.

### What stays local vs. goes to cloud

| Data | Local Providers | Cloud Providers |
|------|-----------------|-----------------|
| Raw audio | Local only | Sent to transcription API (e.g., OpenAI Whisper, Deepgram) |
| Transcript text | Local only | Sent to note LLM API (redacted if enabled) |
| Generated note | Local only | Returned from LLM API, then local only |
| Settings/config | Always local | Always local |
| Audit logs | Always local | Always local |

### Audit logging

Set `AUDIT_LOG_FILE` to a path to log all transcription and note generation events with timestamps, provider names, and data size metrics (no actual transcript content is logged).

## Contributing

Contributions are welcome. Whether it is a bug fix, a new provider, improved documentation, or a feature request, we appreciate your help.

### Getting started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/open-medical-scribe.git
   cd open-medical-scribe
   npm install
   ```
3. **Create a branch** for your change:
   ```bash
   git checkout -b my-feature
   ```
4. **Make your changes.** Follow the existing code patterns and style.
5. **Run the tests:**
   ```bash
   node --test
   ```
6. **Commit** with a clear message describing what and why.
7. **Push** your branch and **open a Pull Request** on GitHub.

### Guidelines

- There is no formal linter configured yet. Please follow the existing code style: ES modules, 2-space indentation, no semicolons where the codebase omits them.
- Write tests for new functionality. Tests live in the `test/` directory and use Node.js built-in test runner (`node --test`).
- Keep provider implementations self-contained. Each provider is a single file that exports a factory function.
- If adding a new provider, register it in the appropriate `index.js` factory file and add the configuration to `config.js`.

First-time contributors are welcome. If you are unsure where to start, look for issues labeled "good first issue" or open a discussion.

## Development

### Setting up the development environment

```bash
git clone https://github.com/BirgerMoell/open-medical-scribe.git
cd open-medical-scribe
npm install
cp .env.example .env
```

### Running the server in development

```bash
npm run dev    # Starts with --watch for auto-reload on file changes
```

### Running tests

```bash
node --test
```

Tests use the Node.js built-in test runner. No additional test framework is required.

### Adding a new transcription provider

1. Create `src/providers/transcription/myProvider.js`:
   ```js
   export function createMyTranscriptionProvider(config) {
     return {
       name: "my-provider",
       async transcribe({ type, content, mimeType, language, country, locale }) {
         // type is "audio-base64" or "text-simulated-audio"
         // content is base64-encoded audio or text
         // Return { text: "transcribed text" }
         const text = await callMyService(content, mimeType, language);
         return { text };
       },
     };
   }
   ```
2. Register it in `src/providers/transcription/index.js`:
   ```js
   import { createMyTranscriptionProvider } from "./myProvider.js";
   // In createTranscriptionProvider():
   if (provider === "my-provider") return createMyTranscriptionProvider(config);
   ```
3. Add any new config keys to `src/config.js` and `.env.example`.
4. Write tests in `test/myProvider.test.js`.

Adding a new note provider follows the same pattern in `src/providers/note/`.

### Downloading models for local use

```bash
# Download Whisper ONNX model for local transcription
npm run models:download:whisper

# Download a GGUF LLM model for the full Electron build
npm run models:download:llm
```

## License

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2025 Birger Moell

## Acknowledgments

- **[@huggingface/transformers](https://github.com/huggingface/transformers.js)** -- Whisper ONNX inference in Node.js and browser.
- **[onnx-community/kb-whisper-large-ONNX](https://huggingface.co/onnx-community/kb-whisper-large-ONNX)** -- Swedish medical speech recognition model.
- **[llama.cpp](https://github.com/ggerganov/llama.cpp)** -- Bundled LLM inference server for the full Electron build.
- **[Ollama](https://ollama.ai/)** -- Local LLM serving for note generation.
- **[@ricky0123/vad-web](https://github.com/ricky0123/vad)** -- Silero VAD via ONNX for browser-side voice activity detection.
- **[ws](https://github.com/websockets/ws)** -- WebSocket implementation for streaming audio.

---

**Important:** Open Medical Scribe is an assistive documentation tool, not a diagnostic system. All generated clinical notes require clinician review and sign-off before use in patient care.
