# Open Medical Scribe (WIP)

Open-source medical scribe foundation that can run:

- `api` mode: cloud APIs (transcription + note generation)
- `local` mode: local models/services
- `hybrid` mode: mix local and API providers

This repo includes a backend with pluggable providers, a structured note generation pipeline, and a browser UI for recording and reviewing clinical notes.

## Why this architecture

Medical scribes need two deployment modes:

- Cloud/API for rapid quality and managed infra
- Local/on-prem for privacy, offline workflows, and cost control

The core design isolates provider implementations behind stable interfaces so the product logic stays the same when switching between providers.

## Supported providers

### Transcription

| Provider | Type | Config | Notes |
|----------|------|--------|-------|
| **OpenAI Whisper** | Cloud | `OPENAI_API_KEY` | Also works with OpenAI-compatible services (vLLM, llama.cpp, LiteLLM, Groq) via `OPENAI_BASE_URL` |
| **Deepgram** | Cloud | `DEEPGRAM_API_KEY` | Nova-3 Medical model, smart formatting |
| **Google Cloud Speech** | Cloud | `GOOGLE_SPEECH_API_KEY` | Speech-to-Text v1 |
| **Berget AI** | Cloud (EU) | `BERGET_API_KEY` | EU sovereign infrastructure, KBLab/kb-whisper-large default |
| **whisper.cpp** | Local | `WHISPER_LOCAL_COMMAND` | Any CLI command that accepts audio on stdin |
| **faster-whisper** | Local | `WHISPER_LOCAL_COMMAND` | Same adapter as whisper.cpp |

### Note generation (LLM)

| Provider | Type | Config | Notes |
|----------|------|--------|-------|
| **OpenAI** | Cloud | `OPENAI_API_KEY` | GPT-4.1, GPT-4o, etc. Also works with OpenAI-compatible services via `OPENAI_BASE_URL` |
| **Anthropic Claude** | Cloud | `ANTHROPIC_API_KEY` | Claude Sonnet/Opus via Messages API |
| **Google Gemini** | Cloud | `GEMINI_API_KEY` | Gemini 2.0 Flash default |
| **Ollama** | Local | `OLLAMA_BASE_URL` | Any local model (Llama, Mistral, MedLlama2, BioMistral) |

### Note styles

- **SOAP** — Subjective, Objective, Assessment, Plan
- **H&P** — History & Physical (initial encounters)
- **Progress** — Follow-up progress note
- **DAP** — Data, Assessment, Plan (behavioral health)
- **Procedure** — Procedure note with findings and complications

## Quick start

```bash
cp .env.example .env
# Edit .env to set your provider and API keys
npm start
```

Server starts on `http://localhost:8787` by default. Open it in a browser for the recording UI.

## Example requests

Health:

```bash
curl http://localhost:8787/health
```

List available providers:

```bash
curl http://localhost:8787/v1/providers
```

Create note from transcript:

```bash
curl -X POST http://localhost:8787/v1/encounters/scribe \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Patient reports 3 days of sore throat and fever. No shortness of breath. Exam notable for erythematous pharynx. Rapid strep positive. Start amoxicillin.",
    "patientContext": {
      "age": 29,
      "sex": "F"
    },
    "noteStyle": "soap"
  }'
```

Create H&P note:

```bash
curl -X POST http://localhost:8787/v1/encounters/scribe \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "New patient, 52M, presents with chest pain on exertion for 2 weeks. PMH: hypertension, type 2 diabetes. Takes metformin and lisinopril.",
    "noteStyle": "hp"
  }'
```

Transcribe from audio (base64) with configured provider:

```bash
curl -X POST http://localhost:8787/v1/transcribe \
  -H "Content-Type: application/json" \
  -d '{"audioBase64":"<BASE64_AUDIO>","audioMimeType":"audio/wav"}'
```

## Using OpenAI-compatible services

The OpenAI provider works with any service that implements the OpenAI API format. Set `OPENAI_BASE_URL` to point to your service:

```bash
# vLLM
OPENAI_BASE_URL=http://localhost:8000

# llama.cpp server
OPENAI_BASE_URL=http://localhost:8080

# LiteLLM proxy
OPENAI_BASE_URL=http://localhost:4000

# Together AI
OPENAI_BASE_URL=https://api.together.xyz

# Groq
OPENAI_BASE_URL=https://api.groq.com/openai
```

## Roadmap (next)

1. Streaming audio ingest + VAD + diarization
2. Realtime transcript correction and structured event timeline
3. Web note editor + human feedback loop
4. Auth/multitenancy + deployment hardening

## Important safety note

This is an assistive documentation tool scaffold, not a diagnostic system. Clinical review and sign-off is required.

See `docs/architecture.md` for the implementation plan and component boundaries.
