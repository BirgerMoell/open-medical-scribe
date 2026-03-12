# Product Boundary Matrix For OMS Class I Reference Build

Document ID: OMS-MDR-CL1-PRODUCT-BOUNDARY-MATRIX
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This matrix separates:

- features that may sit inside the CE-marked Class I reference build
- features that should remain outside the CE-marked boundary
- features that should be removed or heavily constrained before a Class I claim is relied on

The goal is not to describe every possible repository configuration. The goal is to define one defensible manufacturer-controlled reference build.

## Status key

- `Inside`: included in or intended for the CE-marked Class I reference build
- `Outside`: keep available upstream if desired, but outside the CE-marked scope
- `Constrain`: keep only with additional controls or narrower implementation
- `Exclude`: remove from the CE-marked build

## Matrix

| Feature area | Current repo evidence | Recommended status | Class I condition |
| --- | --- | --- | --- |
| Audio recording / upload | Browser, desktop, CLI, and native clients support live or uploaded audio | Inside | Treated as input capture only |
| Batch transcription | Core OMS workflow and CLI transcription | Inside | Output stays transcript text, not interpretation |
| Real-time streaming transcription | WebSocket streaming transcription | Inside | Presented as interim transcript support only |
| Transcript storage and history | Transcript artifacts and saved encounters | Inside | Used for documentation workflow only |
| Accent-insensitive transcript search | `/v1/transcripts/search` and README feature | Inside | Retrieval only, no clinical prioritization |
| Speaker diarization | Optional pyannote sidecar | Constrain | Position as speaker separation only, not clinical interpretation |
| PHI redaction before cloud calls | Privacy service and README | Inside | Safety/privacy support feature |
| Draft note generation | Core OMS note flow | Constrain | Must remain transcript-grounded draft documentation for review |
| Structured note templates | SOAP, H&P, progress, DAP, procedure, Swedish journal | Constrain | Review wording and section labels for clinical judgment risk |
| `Assessment` / `Plan` style sections | SOAP formatter and multiple note styles | Constrain | Keep only if clearly transcript-grounded and clinician-authored after review |
| FHIR `DocumentReference` export | FHIR export service | Inside | Treat as document packaging/export only |
| Copy/export of approved note text | UI and export workflow | Inside | Ideally require explicit review approval first |
| Audit logging | Audit service and settings | Inside | Supports traceability and PMS |
| Settings UI for providers/models | Browser settings UI | Outside | Too much configuration freedom for a locked CE-marked build |
| Pluggable cloud providers | OpenAI, Anthropic, Gemini, Deepgram, Google, Berget | Outside | CE-marked build should not permit arbitrary provider switching by end users |
| Arbitrary OpenAI-compatible endpoints | README and provider architecture | Exclude | Not compatible with a tightly validated certified configuration |
| Local model downloads and swaps | Whisper model download, Ollama / MLX / llama.cpp options | Outside | Keep upstream; certified build should use fixed validated assets |
| Hybrid mode with mixed providers | Configurable cloud/local combinations | Outside | Too many combinations for one Class I reference build |
| CLI binaries | `scribe-transcribe` and `scribe-note` | Outside | Hard to control clinical-use context and release boundary |
| Native Apple standalone mode | iOS/iPad local transcription and note drafting | Outside | Treat as a later separate controlled configuration or narrower companion client |
| Electron desktop app | Desktop packaged app | Outside | Candidate for later inclusion if it stays a thin client to the same locked backend |
| Web backend + browser UI | Node backend plus browser UI | Inside | Included only as the manufacturer-controlled web architecture defined for the regulated build |
| Warnings / follow-up questions in model output | README mentions JSON with warnings and follow-up questions | Exclude | Too close to clinical prompting and decision-support semantics |
| Coding hints | README mentions coding hints in note output | Exclude | Creates reimbursement and decision-support risk |
| Risk, triage, red-flag, or urgency logic | Not current core claim, but possible future drift | Exclude | Would likely trigger Rule 11 IIa or higher |

## Proposed first certified configuration

Recommended first CE-marked build:

- one manufacturer-controlled web deployment
- one fixed deployment architecture
- one fixed transcription stack
- one fixed note-generation stack
- one fixed prompt set
- one limited set of note templates
- explicit draft/review/approve workflow
- no end-user model or provider switching

This is the smallest credible path to a controllable Class I product.

## Repo changes suggested by this matrix

1. Split the product into `upstream OSS` and `Class I reference build` profiles.
2. Add a review-approval gate before final export in the reference build.
3. Remove `coding hints`, `follow-up questions`, and similar decision-adjacent outputs from the reference build.
4. Limit or relabel sections such as `Assessment` and `Plan` where they imply machine clinical reasoning.
5. Replace runtime provider/model freedom with a manufacturer-defined fixed configuration in the reference build.

## Open decisions

1. Which note styles remain in the first certified release.
2. Whether the current Berget-based cloud inference baseline remains the final v1 production baseline or is replaced under change control before release.
3. Whether FHIR export remains in scope for v1 or slips to a later certified release.
4. When desktop and iPhone/iPad move from out-of-scope to controlled expansion configurations.
