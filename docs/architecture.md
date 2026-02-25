# Architecture Plan

## Product goal

Build an open-source medical scribe that:

- works locally or via APIs
- supports batch and real-time dictation/conversation capture
- produces clinician-editable notes and structured outputs
- keeps PHI handling configurable by deployment environment

## Core principles

1. Provider abstraction first
2. Local-first runtime option
3. Streaming-ready interfaces
4. Human-in-the-loop finalization
5. Clear audit and retention boundaries

## System architecture

### 1) Capture layer

- Browser/mobile microphone capture (future)
- File upload / pasted transcript (current bootstrap)
- Voice activity detection (future)
- Optional speaker diarization (future)

### 2) Speech processing layer

Interface:

- `transcribe(input, context) -> transcript`

Implementations:

- API: OpenAI / Deepgram / Azure / AWS
- Local: `faster-whisper`, `whisper.cpp`, `mlx-whisper` (Apple Silicon)

### 3) Clinical reasoning / drafting layer

Interface:

- `generateNote(transcript, context) -> noteDraft`

Implementations:

- API: OpenAI / Anthropic / Gemini
- Local: Ollama / llama.cpp / vLLM-hosted models

### 4) Formatting layer

- SOAP / HPI-focused / specialist templates
- Structured extraction (meds, allergies, assessment, plan)
- Confidence markers and unresolved questions

### 5) Review/export layer (future)

- Web UI editor
- FHIR `DocumentReference` / note text export
- Copy-paste safe outputs for EHRs

## Runtime modes

### `api`

- All inference via hosted APIs
- Fastest to deploy
- Requires strong PHI/legal review and BAAs where applicable

### `local`

- Inference runs on local machine/on-prem services
- Best privacy posture and offline support
- More ops burden and hardware constraints

### `hybrid`

- Example: local transcription + API note drafting
- Lets teams optimize latency/cost/privacy incrementally

## Latency strategy (from voice-agent design guidance)

For real-time conversation, use two paths:

- Low-latency transcript stream for UI feedback
- Higher-quality correction pass for final note generation

Avoid making the clinician wait on a single heavyweight step. Final note quality can improve after the visit while preserving a fast live experience.

## Safety / privacy baseline

- PHI minimization by default
- Configurable logging with PHI-safe mode
- Explicit retention policy
- Local redaction hooks before API calls
- All notes marked as draft until clinician signs

## Suggested milestone sequence

1. Text transcript -> note pipeline (this scaffold)
2. Audio file transcription endpoint
3. Real-time websocket streaming with VAD and turn events
4. UI note editor and correction loop
5. Export adapters + deployment hardening

