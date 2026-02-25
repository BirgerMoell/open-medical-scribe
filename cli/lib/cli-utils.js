/**
 * Zero-dependency CLI utilities shared by scribe-transcribe and scribe-note.
 */

/**
 * Parse CLI arguments into flags and positional args.
 * Handles: --flag value, --flag=value, --boolean-flag
 */
export function parseArgs(argv, spec = {}) {
  const flags = {};
  const positional = [];
  const flagSpec = spec.flags || {};
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith("--")) {
      let key, value;
      if (arg.includes("=")) {
        [key, ...value] = arg.slice(2).split("=");
        value = value.join("=");
      } else {
        key = arg.slice(2);
        const type = flagSpec[key]?.type;
        if (type === "boolean") {
          value = true;
        } else if (i + 1 < argv.length) {
          value = argv[++i];
        } else {
          value = true;
        }
      }
      flags[key] = value;
    } else {
      positional.push(arg);
    }
    i++;
  }

  return { flags, positional };
}

/** Read all of stdin as a Buffer. */
export function readStdinBytes() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
    process.stdin.on("error", reject);
  });
}

/** Read all of stdin as a UTF-8 string. */
export async function readStdinText() {
  const buf = await readStdinBytes();
  return buf.toString("utf8");
}

/** Infer MIME type from file extension. */
export function mimeFromPath(filePath) {
  if (!filePath || filePath === "-") return undefined;
  const ext = String(filePath).split(".").pop().toLowerCase();
  const map = {
    wav: "audio/wav",
    mp3: "audio/mpeg",
    mpeg: "audio/mpeg",
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    ogg: "audio/ogg",
    webm: "audio/webm",
    flac: "audio/flac",
  };
  return map[ext];
}

/** Set model on the correct provider config section. */
export function applyModelOverride(config, providerName, model) {
  const map = {
    openai: () => { config.openai.transcribeModel = model; config.openai.noteModel = model; },
    anthropic: () => { config.anthropic.model = model; },
    gemini: () => { config.gemini.model = model; },
    ollama: () => { config.ollama.model = model; },
    deepgram: () => { config.deepgram.model = model; },
    google: () => { config.google.speechModel = model; },
    berget: () => { config.berget.transcribeModel = model; },
  };
  if (map[providerName]) map[providerName]();
}

/** Write message to stderr and exit with code 1. */
export function die(message) {
  process.stderr.write(message + "\n");
  process.exit(1);
}
