import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const AUDIO_FILE = join(__dirname, "fixtures", "sample_swedish.mp3");

// ─── CLI utilities ──────────────────────────────────────────────────────

test("parseArgs parses --flag value pairs", async () => {
  const { parseArgs } = await import("../cli/lib/cli-utils.js");
  const result = parseArgs(["--provider", "openai", "--language", "sv"], {
    flags: { provider: { type: "string" }, language: { type: "string" } },
  });
  assert.equal(result.flags.provider, "openai");
  assert.equal(result.flags.language, "sv");
  assert.deepEqual(result.positional, []);
});

test("parseArgs parses --flag=value syntax", async () => {
  const { parseArgs } = await import("../cli/lib/cli-utils.js");
  const result = parseArgs(["--provider=deepgram"], {});
  assert.equal(result.flags.provider, "deepgram");
});

test("parseArgs handles boolean flags", async () => {
  const { parseArgs } = await import("../cli/lib/cli-utils.js");
  const result = parseArgs(["--help", "--version"], {
    flags: { help: { type: "boolean" }, version: { type: "boolean" } },
  });
  assert.equal(result.flags.help, true);
  assert.equal(result.flags.version, true);
});

test("parseArgs collects positional arguments", async () => {
  const { parseArgs } = await import("../cli/lib/cli-utils.js");
  const result = parseArgs(["--provider", "mock", "file.wav", "extra"], {
    flags: { provider: { type: "string" } },
  });
  assert.equal(result.flags.provider, "mock");
  assert.deepEqual(result.positional, ["file.wav", "extra"]);
});

test("mimeFromPath detects common audio formats", async () => {
  const { mimeFromPath } = await import("../cli/lib/cli-utils.js");
  assert.equal(mimeFromPath("file.mp3"), "audio/mpeg");
  assert.equal(mimeFromPath("file.wav"), "audio/wav");
  assert.equal(mimeFromPath("file.m4a"), "audio/mp4");
  assert.equal(mimeFromPath("file.webm"), "audio/webm");
  assert.equal(mimeFromPath("file.ogg"), "audio/ogg");
  assert.equal(mimeFromPath("file.flac"), "audio/flac");
  assert.equal(mimeFromPath(undefined), undefined);
  assert.equal(mimeFromPath("-"), undefined);
});

// ─── CLI transcription provider (unit) ──────────────────────────────────

test("cli transcription provider returns placeholder when no command", async () => {
  const { createCliTranscriptionProvider } = await import(
    "../src/providers/transcription/cliProvider.js"
  );
  const provider = createCliTranscriptionProvider({ cli: { transcribeCommand: "" } });
  assert.equal(provider.name, "cli");

  const result = await provider.transcribe({
    type: "audio-base64",
    content: "dGVzdA==",
    mimeType: "audio/wav",
  });
  assert.match(result.text, /not configured/i);
});

test("cli transcription provider passes through text-simulated-audio", async () => {
  const { createCliTranscriptionProvider } = await import(
    "../src/providers/transcription/cliProvider.js"
  );
  const provider = createCliTranscriptionProvider({ cli: { transcribeCommand: "" } });

  const result = await provider.transcribe({
    type: "text-simulated-audio",
    content: "Patient reports fever.",
  });
  assert.equal(result.text, "Patient reports fever.");
});

// ─── CLI note provider (unit) ───────────────────────────────────────────

test("cli note provider returns placeholder when no command", async () => {
  const { createCliNoteGenerator } = await import(
    "../src/providers/note/cliProvider.js"
  );
  const provider = createCliNoteGenerator({ cli: { noteCommand: "" } });
  assert.equal(provider.name, "cli");

  const result = await provider.generateNote({
    transcript: "Patient has cough",
    noteStyle: "soap",
    specialty: "primary-care",
  });
  assert.match(result.noteText, /not configured/i);
});

// ─── Factory registration ───────────────────────────────────────────────

test("transcription provider factory creates cli provider", async () => {
  const { createTranscriptionProvider } = await import(
    "../src/providers/transcription/index.js"
  );
  const p = createTranscriptionProvider({
    transcriptionProvider: "cli",
    cli: { transcribeCommand: "", timeoutMs: 5000 },
    openai: { apiKey: "", baseUrl: "", transcribeModel: "" },
    deepgram: { apiKey: "", model: "" },
    google: { speechApiKey: "", speechModel: "" },
    berget: { apiKey: "", baseUrl: "", transcribeModel: "" },
    whisper: { localCommand: "", timeoutMs: 5000 },
  });
  assert.equal(p.name, "cli");
});

test("note provider factory creates cli provider", async () => {
  const { createNoteGenerator } = await import(
    "../src/providers/note/index.js"
  );
  const p = createNoteGenerator({
    noteProvider: "cli",
    cli: { noteCommand: "", timeoutMs: 5000 },
    openai: { apiKey: "", baseUrl: "", noteModel: "" },
    anthropic: { apiKey: "", baseUrl: "", model: "" },
    gemini: { apiKey: "", model: "" },
    ollama: { baseUrl: "", model: "" },
  });
  assert.equal(p.name, "cli");
});

// ─── CLI integration (node cli/*.js) ────────────────────────────────────

test("cli/transcribe.js --help exits 0", async () => {
  const { stdout } = await exec("node", [join(ROOT, "cli/transcribe.js"), "--help"]);
  assert.match(stdout, /scribe-transcribe/);
});

test("cli/transcribe.js with mock provider transcribes audio file", async () => {
  const { stdout } = await exec("node", [
    join(ROOT, "cli/transcribe.js"),
    "--provider", "mock",
    AUDIO_FILE,
  ]);
  assert.match(stdout, /mock transcription/i);
});

test("cli/note.js --help exits 0", async () => {
  const { stdout } = await exec("node", [join(ROOT, "cli/note.js"), "--help"]);
  assert.match(stdout, /scribe-note/);
});

test("cli/note.js with mock provider generates note", async () => {
  const { stdout } = await exec("node", [
    join(ROOT, "cli/note.js"),
    "--provider", "mock",
    "--transcript", "Patient has cough for two days.",
  ]);
  const json = JSON.parse(stdout);
  assert.equal(typeof json.noteText, "string");
  assert.ok(json.noteText.length > 0);
  assert.ok(Array.isArray(json.warnings));
});

// ─── Compiled binary integration (skipped if not built) ─────────────────

const TRANSCRIBE_BIN = join(ROOT, "dist/scribe-transcribe");
const NOTE_BIN = join(ROOT, "dist/scribe-note");
const hasBinaries = existsSync(TRANSCRIBE_BIN) && existsSync(NOTE_BIN);

test("compiled scribe-transcribe with mock provider", { skip: !hasBinaries }, async () => {
  const { stdout } = await exec(TRANSCRIBE_BIN, ["--provider", "mock", AUDIO_FILE]);
  assert.match(stdout, /mock transcription/i);
});

test("compiled scribe-note with mock provider", { skip: !hasBinaries }, async () => {
  const { stdout } = await exec(NOTE_BIN, [
    "--provider", "mock",
    "--transcript", "Patient reports headache.",
  ]);
  const json = JSON.parse(stdout);
  assert.equal(typeof json.noteText, "string");
});
