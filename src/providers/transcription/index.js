import { createMockTranscriptionProvider } from "./mockProvider.js";
import { createOpenAiTranscriptionProvider } from "./openAiProvider.js";
import { createWhisperCppTranscriptionProvider } from "./whisperCppProvider.js";
import { createDeepgramTranscriptionProvider } from "./deepgramProvider.js";
import { createGoogleSpeechTranscriptionProvider } from "./googleSpeechProvider.js";
import { createBergetTranscriptionProvider } from "./bergetProvider.js";
import { createCliTranscriptionProvider } from "./cliProvider.js";

export function createTranscriptionProvider(config) {
  const provider = config.transcriptionProvider;

  if (provider === "mock") return createMockTranscriptionProvider();
  if (provider === "openai") return createOpenAiTranscriptionProvider(config);
  if (provider === "whisper.cpp" || provider === "faster-whisper") {
    return createWhisperCppTranscriptionProvider(config);
  }
  if (provider === "deepgram") return createDeepgramTranscriptionProvider(config);
  if (provider === "google") return createGoogleSpeechTranscriptionProvider(config);
  if (provider === "berget") return createBergetTranscriptionProvider(config);
  if (provider === "cli") return createCliTranscriptionProvider(config);

  throw new Error(`Unsupported transcription provider: ${provider}`);
}
