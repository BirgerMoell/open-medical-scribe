import { createMockStreamProvider } from "./mockStreamProvider.js";
import { createDeepgramStreamProvider } from "./deepgramStreamProvider.js";
import { createWhisperStreamProvider } from "./whisperStreamProvider.js";

export function createStreamingTranscriptionProvider(config) {
  const provider = config.streaming.transcriptionProvider;

  if (provider === "mock-stream") return createMockStreamProvider();
  if (provider === "deepgram-stream") return createDeepgramStreamProvider(config);
  if (provider === "whisper-stream") return createWhisperStreamProvider(config);

  throw new Error(`Unsupported streaming transcription provider: ${provider}`);
}
