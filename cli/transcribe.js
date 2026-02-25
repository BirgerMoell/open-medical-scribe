#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { loadConfig } from "../src/config.js";
import { createTranscriptionProvider } from "../src/providers/transcription/index.js";
import { parseArgs, readStdinBytes, mimeFromPath, applyModelOverride, die } from "./lib/cli-utils.js";

const HELP = `scribe-transcribe — transcribe audio to text

Usage: scribe-transcribe [options] [audio-file]

Options:
  --provider <name>    Transcription provider (default: $TRANSCRIPTION_PROVIDER)
  --language <code>    Language hint (e.g. "sv", "en")
  --country <code>     Country hint (e.g. "SE", "US")
  --locale <code>      Locale hint (e.g. "sv-SE")
  --mime-type <type>   Audio MIME type (auto-detected from extension)
  --model <name>       Override the provider model
  --help               Show this help
  --version            Show version

Input:
  Audio from <audio-file> path, or stdin if omitted or "-".

Output:
  Transcript text to stdout.`;

const VERSION = "0.1.0";

const args = parseArgs(process.argv.slice(2), {
  flags: {
    provider: { type: "string" },
    language: { type: "string" },
    country: { type: "string" },
    locale: { type: "string" },
    "mime-type": { type: "string" },
    model: { type: "string" },
    help: { type: "boolean" },
    version: { type: "boolean" },
  },
});

if (args.flags.help) { console.log(HELP); process.exit(0); }
if (args.flags.version) { console.log(VERSION); process.exit(0); }

const config = loadConfig(process.env);
if (args.flags.provider) config.transcriptionProvider = args.flags.provider;
if (args.flags.model) applyModelOverride(config, config.transcriptionProvider, args.flags.model);

const provider = createTranscriptionProvider(config);

const filePath = args.positional[0];
let audioBytes;
if (!filePath || filePath === "-") {
  audioBytes = await readStdinBytes();
} else {
  try {
    audioBytes = readFileSync(filePath);
  } catch (err) {
    die(`Cannot read file: ${filePath} (${err.message})`);
  }
}

if (!audioBytes.length) die("No audio input provided.");

const mimeType = args.flags["mime-type"] || mimeFromPath(filePath) || "audio/wav";

const result = await provider.transcribe({
  type: "audio-base64",
  content: audioBytes.toString("base64"),
  mimeType,
  language: args.flags.language,
  country: args.flags.country,
  locale: args.flags.locale,
});

process.stdout.write(result.text);
