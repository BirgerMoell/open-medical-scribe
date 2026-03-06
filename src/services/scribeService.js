import { buildSoapNoteFromTranscript } from "./soapFormatter.js";
import { createAuditLogger } from "./auditLogger.js";
import { maybeRedactForProvider } from "./privacy.js";
import { buildNotePrompt } from "./promptBuilder.js";
import { buildTranscriptDocument } from "./transcriptArtifacts.js";

export function createScribeService({ config, transcriptionProvider, noteGenerator }) {
  const audit = createAuditLogger(config);

  return {
    async transcribeOnly(input) {
      const transcriptDocument = await resolveTranscriptDocument({ input, transcriptionProvider });
      const transcript = transcriptDocument.text;
      audit.log({
        event: "transcribe_only",
        provider: transcriptionProvider.name,
        transcriptChars: transcript.length,
      });
      return {
        transcript,
        transcriptDocument,
        provider: transcriptionProvider.name,
      };
    },

    async processEncounter(input) {
      if (!input || typeof input !== "object") {
        const error = new Error("Request body must be an object");
        error.statusCode = 400;
        throw error;
      }

      const transcriptDocument = await resolveTranscriptDocument({ input, transcriptionProvider });
      const transcript = transcriptDocument.text;
      const noteStyle = input.noteStyle || config.defaultNoteStyle || "soap";
      const specialty = input.specialty || config.defaultSpecialty || "primary-care";
      const redacted = maybeRedactForProvider({
        config,
        providerName: noteGenerator.name,
        transcript,
      });

      const notePromptArgs = {
        transcript: redacted.text,
        noteStyle: input.customPrompt ? "custom" : noteStyle,
        specialty,
        patientContext: input.patientContext || {},
        clinicianContext: input.clinicianContext || {},
      };

      // Build the prompt to capture what was sent
      const prompt = buildNotePrompt(notePromptArgs);
      // If user provided a custom prompt, override the style instruction
      if (input.customPrompt) {
        prompt.system = input.customPrompt;
      }

      const draft = await noteGenerator.generateNote({
        transcript: redacted.text,
        sourceTranscript: transcript,
        noteStyle: input.customPrompt ? "custom" : noteStyle,
        specialty,
        customPrompt: input.customPrompt || undefined,
        patientContext: input.patientContext || {},
        clinicianContext: input.clinicianContext || {},
        encounterMetadata: input.encounterMetadata || {},
      });

      const fallback = noteStyle === "soap" ? buildSoapNoteFromTranscript(transcript) : null;

      const result = {
        id: `enc_${Date.now()}`,
        mode: config.scribeMode,
        providers: {
          transcription: transcriptionProvider.name,
          note: noteGenerator.name,
        },
        transcript,
        transcriptDocument,
        noteDraft: draft.noteText || (fallback ? fallback.noteText : "") || "",
        sections: draft.sections || (fallback ? fallback.sections : {}),
        codingHints: draft.codingHints || [],
        followUpQuestions: draft.followUpQuestions || [],
        warnings: draft.warnings || [
          "Draft note requires clinician review and sign-off before use.",
        ],
        prompt: {
          system: prompt.system,
          user: prompt.user,
        },
        meta: {
          noteStyle,
          specialty,
          redactionApplied: redacted.redactionApplied,
          redactionSummary: redacted.redactionSummary,
          generatedAt: new Date().toISOString(),
        },
      };

      audit.log({
        event: "encounter_scribed",
        transcriptionProvider: transcriptionProvider.name,
        noteProvider: noteGenerator.name,
        transcriptChars: transcript.length,
        noteChars: String(result.noteDraft || "").length,
        noteStyle,
        specialty,
        redactionApplied: redacted.redactionApplied,
      });

      return result;
    },
  };
}

async function resolveTranscriptDocument({ input, transcriptionProvider }) {
  const transcriptionHints = {
    language: typeof input.language === "string" ? input.language : undefined,
    country: typeof input.country === "string" ? input.country : undefined,
    locale: typeof input.locale === "string" ? input.locale : undefined,
  };

  if (typeof input.transcript === "string" && input.transcript.trim()) {
    return buildTranscriptDocument({ text: input.transcript }, transcriptionHints);
  }

  if (typeof input.audioText === "string" && input.audioText.trim()) {
    const result = await transcriptionProvider.transcribe({
      type: "text-simulated-audio",
      content: input.audioText,
      mimeType: "text/plain",
      ...transcriptionHints,
    });
    return buildTranscriptDocument(result, transcriptionHints);
  }

  if (typeof input.audioBase64 === "string" && input.audioBase64.trim()) {
    const result = await transcriptionProvider.transcribe({
      type: "audio-base64",
      content: input.audioBase64,
      mimeType: input.audioMimeType || "audio/wav",
      ...transcriptionHints,
    });
    return buildTranscriptDocument(result, transcriptionHints);
  }

  const error = new Error(
    'Provide either "transcript", "audioText" (dev), or "audioBase64".',
  );
  error.statusCode = 400;
  throw error;
}
