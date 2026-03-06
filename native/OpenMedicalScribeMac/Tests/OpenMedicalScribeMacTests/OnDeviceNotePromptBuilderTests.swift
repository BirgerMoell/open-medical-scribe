import XCTest
@testable import OpenMedicalScribeMac

final class OnDeviceNotePromptBuilderTests: XCTestCase {
    func testPromptCarriesLocaleAndTranscriptGuardrails() {
        let prompt = OnDeviceNotePromptBuilder.prompt(
            transcript: "Patienten har haft hosta i tre dagar.",
            noteStyle: .journal,
            language: "sv",
            locale: "sv-SE",
            country: "SE"
        )

        XCTAssertTrue(prompt.contains("same language as the transcript"))
        XCTAssertTrue(prompt.contains("sv-SE"))
        XCTAssertTrue(prompt.contains("Patienten har haft hosta i tre dagar."))
        XCTAssertTrue(prompt.contains("Do not invent symptoms"))
    }

    func testFallbackSoapTemplateIncludesReviewMarkers() {
        let note = OfflineNoteFallbackBuilder.fallbackNote(
            transcript: "Patient reports fever and sore throat.",
            noteStyle: .soap
        )

        XCTAssertTrue(note.contains("Subjective:"))
        XCTAssertTrue(note.contains("Patient reports fever and sore throat."))
        XCTAssertTrue(note.contains("Requires clinician review."))
    }

    func testAppleQwenCatalogResolvesBaseModelToMLXVariant() {
        XCTAssertEqual(
            AppleQwenModelCatalog.resolvedModelID(for: "Qwen/Qwen3.5-4B"),
            AppleQwenModelCatalog.defaultModelID
        )
        XCTAssertEqual(
            AppleQwenModelCatalog.resolvedModelID(for: "mlx-community/Qwen3.5-4B-MLX-4bit"),
            AppleQwenModelCatalog.defaultModelID
        )
        XCTAssertEqual(
            AppleQwenModelCatalog.resolutionWarning(for: "https://huggingface.co/Qwen/Qwen3.5-4B"),
            "Resolved https://huggingface.co/Qwen/Qwen3.5-4B to MLX Swift-compatible model \(AppleQwenModelCatalog.defaultModelID) for on-device note generation."
        )
    }

    func testAppleQwenThinkingDefaultsToOff() {
        XCTAssertFalse(PlatformDefaults.defaultOnDeviceThinkingEnabled)

        let context = AppleQwenModelCatalog.draftAdditionalContext(thinkingEnabled: false)
        XCTAssertEqual(context["enable_thinking"] as? Bool, false)
    }

    func testAppleQwenSanitizedDraftRemovesThinkBlocks() {
        let draft = """
        <think>
        I should reason first.
        </think>

        Journal Note:
        Patienten har hosta sedan tre dagar.
        """

        XCTAssertEqual(
            AppleQwenModelCatalog.sanitizedDraft(draft),
            "Journal Note:\nPatienten har hosta sedan tre dagar."
        )
    }
}
