# Contributing to Open Medical Scribe

Thank you for your interest in contributing to Open Medical Scribe. Whether you are
fixing a bug, adding a new provider, improving documentation, working on translations,
or simply reporting an issue, every contribution is welcome and valued.

This guide will help you get started and make the process as smooth as possible for
everyone involved.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [How to Contribute](#how-to-contribute)
4. [Development Guide](#development-guide)
5. [Code Style](#code-style)
6. [Commit Messages](#commit-messages)
7. [Review Process](#review-process)

---

## Code of Conduct

We are committed to providing a welcoming and inclusive experience for everyone. When
participating in this project, please:

- **Be respectful.** Treat other contributors with courtesy and professionalism,
  regardless of background, experience level, or opinion.
- **Be constructive.** Offer helpful feedback. If you disagree with a decision,
  explain your reasoning calmly and with concrete examples.
- **Be inclusive.** Use language that is accessible and considerate. Welcome
  newcomers and help them find their footing.
- **Assume good intentions.** Misunderstandings happen. Give people the benefit of
  the doubt and seek clarification before reacting.

Unacceptable behavior -- including harassment, personal attacks, or deliberately
exclusionary language -- will not be tolerated. Maintainers reserve the right to
remove comments, commits, or contributors that violate these principles.

---

## Getting Started

### Prerequisites

- **Node.js >= 22** (see the `engines` field in `package.json`)
- **Git**

### Setup

1. **Fork** the repository on GitHub.

2. **Clone** your fork locally:

   ```bash
   git clone https://github.com/<your-username>/open-medical-scribe.git
   cd open-medical-scribe
   ```

3. **Install dependencies:**

   ```bash
   npm install
   ```

4. **Start the development server:**

   ```bash
   npm start
   ```

   Or, to enable automatic reload on file changes:

   ```bash
   npm run dev
   ```

5. **Run the tests:**

   ```bash
   npm test
   ```

   This uses the Node.js built-in test runner (`node --test`). No extra test
   framework dependencies are required.

---

## How to Contribute

### Reporting Bugs

If you encounter a bug, please open a GitHub issue and include the following:

- **Summary** -- a clear, concise description of the problem.
- **Steps to reproduce** -- the exact sequence of actions that triggers the bug.
- **Expected behavior** -- what you expected to happen.
- **Actual behavior** -- what actually happened (include error messages, stack traces, or
  screenshots where relevant).
- **Provider information** -- which transcription provider (e.g., `openai`,
  `whisper.cpp`, `deepgram`, `google`, `berget`) and which note provider (e.g.,
  `openai`, `anthropic`, `gemini`, `ollama`) you were using.
- **Environment** -- Node.js version, operating system, and browser (if using the
  web UI).

The more detail you provide, the faster we can diagnose and fix the issue.

### Suggesting Features

Before writing code for a new feature, **please open an issue first** to discuss it.
This lets maintainers and the community weigh in on the design before significant
effort is invested. Describe the problem you are trying to solve, any alternatives
you considered, and how the feature fits into the project.

### Submitting Pull Requests

1. **Fork** the repository (if you have not already).
2. **Create a feature branch** from `main`:

   ```bash
   git checkout -b my-feature
   ```

3. **Make your changes.** Write clear, focused commits (see
   [Commit Messages](#commit-messages)).
4. **Run the tests** to make sure nothing is broken:

   ```bash
   npm test
   ```

5. **Push** your branch to your fork:

   ```bash
   git push origin my-feature
   ```

6. **Open a Pull Request** against the `main` branch of the upstream repository.
   In the PR description, explain what the change does and why. Reference any
   related issues (e.g., "Closes #42").

---

## Development Guide

### Project Structure

```
open-medical-scribe/
  src/
    config.js                          # Environment-based configuration
    index.js                           # Application entry point
    providers/
      transcription/                   # Transcription provider implementations
        index.js                       #   Provider factory / registry
        openAiProvider.js              #   OpenAI Whisper API
        whisperCppProvider.js          #   Local whisper.cpp / faster-whisper
        whisperOnnxProvider.js         #   ONNX-based Whisper (in-process)
        deepgramProvider.js            #   Deepgram Nova
        googleSpeechProvider.js        #   Google Cloud Speech-to-Text
        bergetProvider.js              #   Berget AI (Swedish Whisper)
        cliProvider.js                 #   Generic CLI wrapper
        mockProvider.js                #   Mock provider for testing
      note/                            # Note generation provider implementations
        index.js                       #   Provider factory / registry
        openAiProvider.js              #   OpenAI GPT
        anthropicProvider.js           #   Anthropic Claude
        geminiProvider.js              #   Google Gemini
        ollamaProvider.js              #   Ollama (local LLM)
        cliProvider.js                 #   Generic CLI wrapper
        mockProvider.js                #   Mock provider for testing
    services/
      promptBuilder.js                 # Builds system/user prompts for note generation
      scribeService.js                 # Core orchestration (transcribe -> generate note)
      privacy.js                       # PHI redaction utilities
      fhirExport.js                    # FHIR resource export
      diarizeClient.js                 # Speaker diarization client
      auditLogger.js                   # Audit log for PHI access
      settingsStore.js                 # Runtime settings persistence
      soapFormatter.js                 # SOAP note formatter
    server/
      createApp.js                     # HTTP server and route setup
      streamHandler.js                 # WebSocket streaming handler
      static.js                        # Static file serving
    util/                              # Shared utility functions
  public/                              # Web UI (HTML, CSS, JS)
    index.html
    settings.html
    app.js
    settings.js
    stream.js
    styles.css
  electron/                            # Electron desktop app wrapper
    main.js
    preload.js
    llamaServer.js
  cli/                                 # Standalone CLI tools
  test/                                # Tests (Node.js built-in test runner)
    *.test.js
    fixtures/
```

### Adding a New Transcription Provider

1. **Create a new file** in `src/providers/transcription/`, for example
   `myServiceProvider.js`.

2. **Export a factory function** that returns an object implementing the
   transcription provider interface:

   ```js
   export function createMyServiceTranscriptionProvider(config) {
     return {
       name: "my-service",

       async transcribe(input) {
         // input.type     - "audio-base64" or "text-simulated-audio"
         // input.content  - base64-encoded audio data (or plain text for simulated)
         // input.mimeType - MIME type of the audio (e.g. "audio/wav", "audio/mp3")
         // input.language - optional language hint (e.g. "en", "sv")

         const text = "..."; // your transcription logic here
         return { text };
       },
     };
   }
   ```

3. **Register the provider** in `src/providers/transcription/index.js` by adding
   an import and a new `if` branch inside `createTranscriptionProvider()`:

   ```js
   import { createMyServiceTranscriptionProvider } from "./myServiceProvider.js";

   // Inside createTranscriptionProvider():
   if (provider === "my-service") return createMyServiceTranscriptionProvider(config);
   ```

4. **Add any new configuration** keys to `src/config.js` if your provider
   requires API keys or other settings.

5. **Write tests** in `test/` to cover your provider's behavior.

### Adding a New Note Provider

1. **Create a new file** in `src/providers/note/`, for example
   `myLlmProvider.js`.

2. **Export a factory function** that returns an object implementing the note
   provider interface:

   ```js
   import { buildNotePrompt } from "../../services/promptBuilder.js";

   export function createMyLlmNoteGenerator(config) {
     return {
       name: "my-llm",

       async generateNote({ transcript, noteStyle, specialty, patientContext, clinicianContext, customPrompt }) {
         const prompt = buildNotePrompt({ transcript, noteStyle, specialty, patientContext, clinicianContext });

         // Call your LLM with prompt.system and prompt.user
         // Parse the response and return the standard result shape:
         return {
           noteText: "...",          // The full note as a string
           sections: {},             // Structured sections (keys depend on noteStyle)
           codingHints: [],          // Optional ICD/CPT coding suggestions
           followUpQuestions: [],    // Items the clinician should verify
           warnings: [],             // Any warnings for the end user
         };
       },
     };
   }
   ```

3. **Register the provider** in `src/providers/note/index.js` by adding an
   import and a new `if` branch inside `createNoteGenerator()`:

   ```js
   import { createMyLlmNoteGenerator } from "./myLlmProvider.js";

   // Inside createNoteGenerator():
   if (provider === "my-llm") return createMyLlmNoteGenerator(config);
   ```

4. **Add configuration** to `src/config.js` as needed.

5. **Write tests** in `test/`.

### Adding a New Note Format (Style)

The note format is determined by the `styleInstruction()` function in
`src/services/promptBuilder.js`. To add a new format:

1. **Add a new `case`** to the `switch` statement in `styleInstruction()`:

   ```js
   case "my-format":
     return "Format noteText as ... Sections object keys: ...";
   ```

2. **Add the option to the web UI** in `public/settings.html` so users can
   select it from the settings page.

3. **Write a test** in `test/promptBuilder.test.js` to verify the new style
   produces the expected instruction string.

### Running Tests

The project uses the **Node.js built-in test runner** (available in Node.js 22+).
No extra test dependencies are needed.

```bash
# Run all tests
npm test

# Run a specific test file
node --test test/promptBuilder.test.js

# Run tests with verbose output
node --test --test-reporter spec
```

Test files live in the `test/` directory and follow the naming convention
`<module>.test.js`. Test fixtures (such as sample audio files) are stored in
`test/fixtures/`.

---

## Code Style

There is no linter or formatter configured in the project yet. To keep the
codebase consistent, please follow the existing patterns:

- **ES modules** -- use `import` / `export`, not `require()`. The project sets
  `"type": "module"` in `package.json`.
- **Async/await** -- prefer `async`/`await` over raw Promises or callbacks.
- **Descriptive function names** -- use clear, self-documenting names
  (e.g., `createOpenAiTranscriptionProvider`, `buildNotePrompt`).
- **Factory functions over classes** -- providers are plain objects returned from
  factory functions, not class instances.
- **Minimal dependencies** -- the project deliberately keeps its dependency
  footprint small. Think twice before adding a new npm package; if the
  functionality can be achieved with Node.js built-in APIs, prefer that.
- **No trailing semicolons debate** -- just match the style of the file you are
  editing.

---

## Commit Messages

Write commit messages in the **imperative mood** (as if completing the sentence
"This commit will ..."). Keep the subject line concise (ideally under 72
characters) and add a body when the change warrants further explanation.

**Good examples:**

```
Add Deepgram transcription provider

Implement the Deepgram Nova API integration for real-time medical
transcription. Includes configuration for API key and model selection.
```

```
Fix MIME type detection for m4a audio files
```

```
Update promptBuilder to support DAP note format
```

**Avoid vague messages** such as "fix stuff", "update code", or "wip".

---

## Review Process

All pull requests are reviewed by project maintainers before being merged.
Here is what to expect:

- **Turnaround time** -- maintainers review PRs as time allows. Please be
  patient; this is an open-source project maintained in spare time.
- **Feedback** -- you may be asked to make changes. This is normal and not a
  reflection of the quality of your work. Reviewers aim to keep the codebase
  consistent and maintainable.
- **CI checks** -- make sure all tests pass before requesting a review. PRs with
  failing tests will not be merged.
- **Scope** -- smaller, focused PRs are easier to review and more likely to be
  merged quickly. If you have a large change, consider splitting it into
  multiple PRs.

---

Thank you for helping make Open Medical Scribe better. If you have any questions
that are not covered here, feel free to open a discussion or issue on GitHub.
