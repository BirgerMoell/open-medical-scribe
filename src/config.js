const ALLOWED_MODES = new Set(["api", "local", "hybrid"]);

export function loadConfig(env) {
  const scribeMode = env.SCRIBE_MODE || "hybrid";
  if (!ALLOWED_MODES.has(scribeMode)) {
    throw new Error(
      `Invalid SCRIBE_MODE="${scribeMode}". Expected one of: api, local, hybrid.`,
    );
  }

  return {
    port: parseInt(env.PORT || "8787", 10),
    scribeMode,
    defaultNoteStyle: env.DEFAULT_NOTE_STYLE || "journal",
    defaultSpecialty: env.DEFAULT_SPECIALTY || "primary-care",
    defaultCountry: env.DEFAULT_COUNTRY || "",
    enableWebUi: String(env.ENABLE_WEB_UI || "true").toLowerCase() !== "false",
    privacy: {
      phiRedactionMode: env.PHI_REDACTION_MODE || "basic",
      redactBeforeApiCalls: String(env.REDACT_BEFORE_API_CALLS || "true").toLowerCase() !== "false",
      auditLogFile: env.AUDIT_LOG_FILE || "",
    },
    transcriptionProvider: env.TRANSCRIPTION_PROVIDER || defaultTranscriptionProvider(scribeMode),
    noteProvider: env.NOTE_PROVIDER || defaultNoteProvider(scribeMode),
    openai: {
      apiKey: env.OPENAI_API_KEY || "",
      baseUrl: env.OPENAI_BASE_URL || "https://api.openai.com",
      transcribeModel: env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
      noteModel: env.OPENAI_NOTE_MODEL || "gpt-4.1-mini",
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY || "",
      baseUrl: env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
      model: env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    },
    gemini: {
      apiKey: env.GEMINI_API_KEY || "",
      model: env.GEMINI_MODEL || "gemini-2.0-flash",
    },
    ollama: {
      baseUrl: env.OLLAMA_BASE_URL || "http://localhost:11434",
      model: env.OLLAMA_MODEL || "llama3.1:8b",
    },
    deepgram: {
      apiKey: env.DEEPGRAM_API_KEY || "",
      model: env.DEEPGRAM_MODEL || "nova-3-medical",
    },
    google: {
      speechApiKey: env.GOOGLE_SPEECH_API_KEY || "",
      speechModel: env.GOOGLE_SPEECH_MODEL || "latest_long",
    },
    berget: {
      apiKey: env.BERGET_API_KEY || "",
      baseUrl: env.BERGET_BASE_URL || "https://api.berget.ai",
      transcribeModel: env.BERGET_TRANSCRIBE_MODEL || "KBLab/kb-whisper-large",
    },
    whisper: {
      localCommand: env.WHISPER_LOCAL_COMMAND || "",
      timeoutMs: parseInt(env.LOCAL_TRANSCRIBE_TIMEOUT_MS || "120000", 10),
      expects: env.LOCAL_TRANSCRIBE_EXPECTS || "stdin",
    },
    cli: {
      transcribeCommand: env.CLI_TRANSCRIBE_COMMAND || "",
      noteCommand: env.CLI_NOTE_COMMAND || "",
      timeoutMs: parseInt(env.CLI_TIMEOUT_MS || "120000", 10),
    },
    streaming: {
      transcriptionProvider: env.STREAMING_TRANSCRIPTION_PROVIDER || defaultStreamingProvider(env.TRANSCRIPTION_PROVIDER),
      diarizeSidecarUrl: env.DIARIZE_SIDECAR_URL || "http://localhost:8786",
      diarizeOnEnd: String(env.DIARIZE_ON_END || "false").toLowerCase() === "true",
      whisperModel: env.STREAMING_WHISPER_MODEL || "onnx-community/kb-whisper-large-ONNX",
      whisperLanguage: env.STREAMING_WHISPER_LANGUAGE || "sv",
      whisperIntervalMs: parseInt(env.STREAMING_WHISPER_INTERVAL_MS || "5000", 10),
    },
  };
}

function defaultTranscriptionProvider(mode) {
  if (mode === "api") return "openai";
  if (mode === "local") return "whisper.cpp";
  return "mock";
}

function defaultStreamingProvider(txProvider) {
  if (txProvider === "whisper-onnx") return "whisper-stream";
  return "mock-stream";
}

function defaultNoteProvider(mode) {
  if (mode === "api") return "openai";
  if (mode === "local") return "ollama";
  return "mock";
}
