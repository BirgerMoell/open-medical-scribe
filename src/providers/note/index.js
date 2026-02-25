import { createMockNoteGenerator } from "./mockProvider.js";
import { createOllamaNoteGenerator } from "./ollamaProvider.js";
import { createOpenAiNoteGenerator } from "./openAiProvider.js";
import { createAnthropicNoteGenerator } from "./anthropicProvider.js";
import { createGeminiNoteGenerator } from "./geminiProvider.js";

export function createNoteGenerator(config) {
  const provider = config.noteProvider;

  if (provider === "mock") return createMockNoteGenerator();
  if (provider === "openai") return createOpenAiNoteGenerator(config);
  if (provider === "ollama") return createOllamaNoteGenerator(config);
  if (provider === "anthropic") return createAnthropicNoteGenerator(config);
  if (provider === "gemini") return createGeminiNoteGenerator(config);

  throw new Error(`Unsupported note provider: ${provider}`);
}
