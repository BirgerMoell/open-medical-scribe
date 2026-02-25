#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { loadConfig } from "../src/config.js";
import { createNoteGenerator } from "../src/providers/note/index.js";
import { parseArgs, readStdinText, applyModelOverride, die } from "./lib/cli-utils.js";

const HELP = `scribe-note — generate a clinical note from a transcript

Usage: scribe-note [options]

Options:
  --provider <name>         Note provider (default: $NOTE_PROVIDER)
  --transcript <text>       Transcript text (alternative to stdin)
  --transcript-file <path>  Read transcript from file
  --note-style <style>      soap, hp, progress, dap, procedure (default: "soap")
  --specialty <name>        Medical specialty (default: "primary-care")
  --custom-prompt <text>    Override the system prompt
  --model <name>            Override the provider model
  --help                    Show this help
  --version                 Show version

Input:
  Transcript from --transcript, --transcript-file, or stdin.

Output:
  JSON to stdout: {noteText, sections, codingHints, followUpQuestions, warnings}`;

const VERSION = "0.1.0";

const args = parseArgs(process.argv.slice(2), {
  flags: {
    provider: { type: "string" },
    transcript: { type: "string" },
    "transcript-file": { type: "string" },
    "note-style": { type: "string" },
    specialty: { type: "string" },
    "custom-prompt": { type: "string" },
    model: { type: "string" },
    help: { type: "boolean" },
    version: { type: "boolean" },
  },
});

if (args.flags.help) { console.log(HELP); process.exit(0); }
if (args.flags.version) { console.log(VERSION); process.exit(0); }

const config = loadConfig(process.env);
if (args.flags.provider) config.noteProvider = args.flags.provider;
if (args.flags.model) applyModelOverride(config, config.noteProvider, args.flags.model);

const generator = createNoteGenerator(config);

let transcript;
if (args.flags.transcript) {
  transcript = args.flags.transcript;
} else if (args.flags["transcript-file"]) {
  try {
    transcript = readFileSync(args.flags["transcript-file"], "utf8");
  } catch (err) {
    die(`Cannot read file: ${args.flags["transcript-file"]} (${err.message})`);
  }
} else {
  transcript = await readStdinText();
}

if (!transcript.trim()) die("No transcript provided. Use --transcript, --transcript-file, or pipe to stdin.");

const result = await generator.generateNote({
  transcript: transcript.trim(),
  noteStyle: args.flags["note-style"] || config.defaultNoteStyle || "soap",
  specialty: args.flags.specialty || config.defaultSpecialty || "primary-care",
  customPrompt: args.flags["custom-prompt"] || undefined,
  patientContext: {},
  clinicianContext: {},
});

process.stdout.write(JSON.stringify(result, null, 2) + "\n");
