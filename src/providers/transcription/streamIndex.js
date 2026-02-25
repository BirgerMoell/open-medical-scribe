import { createMockStreamProvider } from "./mockStreamProvider.js";
import { createDeepgramStreamProvider } from "./deepgramStreamProvider.js";

export function createStreamingTranscriptionProvider(config) {
  const provider = config.streaming.transcriptionProvider;

  if (provider === "mock-stream") return createMockStreamProvider();
  if (provider === "deepgram-stream") return createDeepgramStreamProvider(config);

  throw new Error(`Unsupported streaming transcription provider: ${provider}`);
}
