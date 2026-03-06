import Foundation

enum OnDeviceNotePromptBuilder {
    static func prompt(
        transcript: String,
        noteStyle: NoteStyle,
        language: String,
        locale: String,
        country: String
    ) -> String {
        """
        You are a careful medical scribe creating a \(noteStyle.title) note.

        Rules:
        - Write the output in the same language as the transcript. Prefer locale \(locale) and country \(country) conventions.
        - Base the note only on the transcript. Do not invent symptoms, findings, diagnoses, medications, or plans.
        - If something is missing or uncertain, state that it was not clearly stated.
        - Keep the wording concise, clinical, and ready for clinician review.
        - Avoid markdown, bullet lists, or commentary about being an AI system.
        - Preserve Swedish medical terminology when the transcript is Swedish.

        Output:
        - Return plain text in \(noteStyle.title) format.

        Transcript language hint: \(language)

        Transcript:
        \(transcript)
        """
    }
}

enum OfflineNoteFallbackBuilder {
    static func fallbackNote(
        transcript: String,
        noteStyle: NoteStyle
    ) -> String {
        let trimmedTranscript = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        let source = trimmedTranscript.isEmpty ? "No transcript text available." : trimmedTranscript

        switch noteStyle {
        case .soap:
            return """
            Subjective:
            \(source)

            Objective:
            Not stated in transcript.

            Assessment:
            Requires clinician review.

            Plan:
            Requires clinician review.
            """
        case .hp:
            return """
            Chief Concern:
            \(source)

            History of Present Illness:
            Requires clinician review.

            Review of Systems:
            Not clearly stated.

            Assessment and Plan:
            Requires clinician review.
            """
        case .progress:
            return """
            Interval Update:
            \(source)

            Assessment:
            Requires clinician review.

            Plan:
            Requires clinician review.
            """
        case .dap:
            return """
            Data:
            \(source)

            Assessment:
            Requires clinician review.

            Plan:
            Requires clinician review.
            """
        case .procedure:
            return """
            Procedure Summary:
            \(source)

            Findings:
            Not clearly stated.

            Complications:
            Not clearly stated.
            """
        case .journal:
            return """
            Journal Note:
            \(source)

            Clinical Interpretation:
            Requires clinician review before use in the medical record.
            """
        }
    }
}
