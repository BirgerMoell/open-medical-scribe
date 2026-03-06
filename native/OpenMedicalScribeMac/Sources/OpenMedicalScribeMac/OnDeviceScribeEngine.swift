import Foundation

#if canImport(WhisperKit)
import WhisperKit
#endif

#if canImport(MLXLMCommon) && canImport(MLXLLM)
import MLXLMCommon
import MLXLLM
#endif

#if canImport(FoundationModels)
import FoundationModels
#endif

struct NativeScribePreparation: Sendable {
    let transcriptionProvider: String
    let noteProvider: String
    let warnings: [String]
}

struct LocalDraftOutput: Sendable {
    let noteDraft: String
    let warnings: [String]
}

struct AppScribeResult: Decodable, Sendable {
    struct Providers: Decodable, Sendable {
        let transcription: String
        let note: String
    }

    let providers: Providers
    let transcript: String
    let noteDraft: String
    let warnings: [String]
}

enum AppleQwenModelCatalog {
    static let defaultModelID = "mlx-community/Qwen3.5-4B-4bit"

    static func draftAdditionalContext(thinkingEnabled: Bool) -> [String: any Sendable] {
        [
            "enable_thinking": thinkingEnabled
        ]
    }

#if canImport(MLXLMCommon) && canImport(MLXLLM)
    static let draftGenerationParameters = GenerateParameters(
        maxTokens: 320,
        maxKVSize: 4096,
        kvBits: 4,
        kvGroupSize: 64,
        quantizedKVStart: 1024,
        temperature: 0,
        topP: 1,
        repetitionPenalty: 1.02,
        repetitionContextSize: 48,
        prefillStepSize: 1024
    )
#endif

    static func resolvedModelID(for requestedModelID: String) -> String {
        let trimmed = requestedModelID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return defaultModelID
        }

        let normalized = trimmed.lowercased()
        if needsMLXResolution(normalized) {
            return defaultModelID
        }

        return trimmed
    }

    static func resolutionWarning(for requestedModelID: String) -> String? {
        let trimmed = requestedModelID.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolved = resolvedModelID(for: requestedModelID)

        guard !trimmed.isEmpty, trimmed != resolved else {
            return nil
        }

        return "Resolved \(trimmed) to MLX Swift-compatible model \(resolved) for on-device note generation."
    }

    private static func needsMLXResolution(_ normalizedModelID: String) -> Bool {
        normalizedModelID == "qwen/qwen3.5-4b"
            || normalizedModelID == "qwen3.5-4b"
            || normalizedModelID == "https://huggingface.co/qwen/qwen3.5-4b"
            || normalizedModelID == "mlx-community/qwen3.5-4b-mlx-4bit"
            || normalizedModelID == "mlx-community/qwen3.5-4b-4bit"
            || normalizedModelID.contains("qwen3.5-4b")
    }

    static func sanitizedDraft(_ draft: String) -> String {
        draft
            .replacingOccurrences(
                of: "(?s)<think>.*?</think>\\s*",
                with: "",
                options: .regularExpression
            )
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

#if canImport(WhisperKit)
private actor WhisperRuntime {
    nonisolated(unsafe) private var whisperKit: WhisperKit?
    private var preparedModel: String?

    func prepare(model: String) async throws {
        if let whisperKit, preparedModel == model {
            _ = whisperKit
            return
        }

        let config = WhisperKitConfig(
            model: model,
            verbose: false,
            logLevel: .none,
            prewarm: true,
            download: true
        )
        whisperKit = try await WhisperKit(config)
        preparedModel = model
    }

    func transcribe(audioURL: URL, language: String) async throws -> String {
        guard let whisperKit else {
            throw NSError(
                domain: "OpenMedicalScribeApple",
                code: 22,
                userInfo: [NSLocalizedDescriptionKey: "On-device transcription is not prepared yet."]
            )
        }

        let normalizedLanguage = language.trimmingCharacters(in: .whitespacesAndNewlines)
        let options = DecodingOptions(
            verbose: false,
            language: normalizedLanguage.isEmpty ? nil : normalizedLanguage,
            detectLanguage: normalizedLanguage.isEmpty,
            withoutTimestamps: false,
            wordTimestamps: true,
            chunkingStrategy: .vad
        )
        let results = try await whisperKit.transcribe(audioPath: audioURL.path, decodeOptions: options)
        let text = results
            .map(\.text)
            .joined(separator: " ")
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !text.isEmpty else {
            throw NSError(
                domain: "OpenMedicalScribeApple",
                code: 23,
                userInfo: [NSLocalizedDescriptionKey: "The on-device transcription model returned no text."]
            )
        }

        return text
    }
}
#endif

#if canImport(MLXLMCommon) && canImport(MLXLLM)
private actor QwenRuntime {
    nonisolated(unsafe) private var qwenContainer: ModelContainer?
    private var preparedModelID: String?

    func prepare(modelID: String) async throws -> String {
        let resolvedModelID = AppleQwenModelCatalog.resolvedModelID(for: modelID)
        _ = try await ensureContainer(modelID: resolvedModelID)
        return resolvedModelID
    }

    func generate(prompt: String, modelID: String, thinkingEnabled: Bool) async throws -> String? {
        let resolvedModelID = AppleQwenModelCatalog.resolvedModelID(for: modelID)
        let container = try await ensureContainer(modelID: resolvedModelID)
        let session = ChatSession(
            container,
            instructions: "You are a careful medical scribe. Draft concise clinician-facing notes and never invent facts beyond the transcript.",
            generateParameters: AppleQwenModelCatalog.draftGenerationParameters,
            additionalContext: AppleQwenModelCatalog.draftAdditionalContext(
                thinkingEnabled: thinkingEnabled
            )
        )
        let response = try await session.respond(to: prompt)
        let text = AppleQwenModelCatalog.sanitizedDraft(response)
        return text.isEmpty ? nil : text
    }

    private func ensureContainer(modelID: String) async throws -> ModelContainer {
        if let qwenContainer, preparedModelID == modelID {
            return qwenContainer
        }

        let configuration = ModelConfiguration(id: modelID)
        let container = try await LLMModelFactory.shared.loadContainer(configuration: configuration)
        qwenContainer = container
        preparedModelID = modelID
        return container
    }
}
#endif

@MainActor
final class OnDeviceScribeEngine {
#if canImport(WhisperKit)
    private let whisperRuntime = WhisperRuntime()
#endif
#if canImport(MLXLMCommon) && canImport(MLXLLM)
    private let qwenRuntime = QwenRuntime()
#endif

    func prepare(
        whisperModel: String,
        qwenModelID: String,
        locale: String
    ) async throws -> NativeScribePreparation {
        var warnings = [String]()
        let noteProvider = localNoteProviderName(
            qwenModelID: qwenModelID,
            locale: locale,
            warnings: &warnings
        )

#if canImport(WhisperKit)
        try await whisperRuntime.prepare(model: whisperModel)

        return NativeScribePreparation(
            transcriptionProvider: "WhisperKit (\(whisperModel))",
            noteProvider: noteProvider,
            warnings: warnings
        )
#else
        warnings.append("WhisperKit is not linked into this build, so on-device transcription is unavailable.")
        throw NSError(
            domain: "OpenMedicalScribeApple",
            code: 21,
            userInfo: [NSLocalizedDescriptionKey: warnings.joined(separator: " ")]
        )
#endif
    }

    func analyzeAudio(
        at url: URL,
        whisperModel: String,
        qwenModelID: String,
        thinkingEnabled: Bool,
        language: String,
        locale: String,
        country: String,
        noteStyle: NoteStyle
    ) async throws -> AppScribeResult {
        let preparation = try await prepare(
            whisperModel: whisperModel,
            qwenModelID: qwenModelID,
            locale: locale
        )
        let transcript = try await transcribeAudio(at: url, language: language)

        var warnings = preparation.warnings
        let noteDraft = try await draftNote(
            transcript: transcript,
            noteStyle: noteStyle,
            qwenModelID: qwenModelID,
            thinkingEnabled: thinkingEnabled,
            language: language,
            locale: locale,
            country: country,
            warnings: &warnings
        )

        return AppScribeResult(
            providers: .init(
                transcription: preparation.transcriptionProvider,
                note: preparation.noteProvider
            ),
            transcript: transcript,
            noteDraft: noteDraft,
            warnings: warnings
        )
    }

    func transcribePreparedAudio(at url: URL, language: String) async throws -> String {
        try await transcribeAudio(at: url, language: language)
    }

    func draftNoteFromTranscript(
        transcript: String,
        noteStyle: NoteStyle,
        qwenModelID: String,
        thinkingEnabled: Bool,
        language: String,
        locale: String,
        country: String
    ) async throws -> LocalDraftOutput {
        var warnings = [String]()
        let noteDraft = try await draftNote(
            transcript: transcript,
            noteStyle: noteStyle,
            qwenModelID: qwenModelID,
            thinkingEnabled: thinkingEnabled,
            language: language,
            locale: locale,
            country: country,
            warnings: &warnings
        )
        return LocalDraftOutput(noteDraft: noteDraft, warnings: warnings)
    }

    private func transcribeAudio(at url: URL, language: String) async throws -> String {
#if canImport(WhisperKit)
        let hasScopedAccess = url.startAccessingSecurityScopedResource()
        defer {
            if hasScopedAccess {
                url.stopAccessingSecurityScopedResource()
            }
        }

        return try await whisperRuntime.transcribe(audioURL: url, language: language)
#else
        throw NSError(
            domain: "OpenMedicalScribeApple",
            code: 24,
            userInfo: [NSLocalizedDescriptionKey: "WhisperKit is unavailable in this build."]
        )
#endif
    }

    private func draftNote(
        transcript: String,
        noteStyle: NoteStyle,
        qwenModelID: String,
        thinkingEnabled: Bool,
        language: String,
        locale: String,
        country: String,
        warnings: inout [String]
    ) async throws -> String {
        let prompt = OnDeviceNotePromptBuilder.prompt(
            transcript: transcript,
            noteStyle: noteStyle,
            language: language,
            locale: locale,
            country: country
        )

#if canImport(MLXLMCommon) && canImport(MLXLLM)
        do {
            if let response = try await generateWithMLX(
                prompt: prompt,
                qwenModelID: qwenModelID,
                thinkingEnabled: thinkingEnabled
            ) {
                return response
            }
        } catch {
            let resolvedModelID = AppleQwenModelCatalog.resolvedModelID(for: qwenModelID)
            warnings.append("Failed to use MLX Qwen model \(resolvedModelID): \(error.localizedDescription)")
        }
#endif

#if canImport(FoundationModels)
        do {
            if #available(iOS 26.0, macOS 26.0, visionOS 26.0, *), let response = try await generateWithFoundationModels(prompt: prompt, locale: locale) {
                return response
            }
        } catch {
            warnings.append("Failed to use Apple's local language model: \(error.localizedDescription)")
        }
#endif

        warnings.append("Local note generation is not available on this device, so the app used an offline transcript-based fallback note.")
        return OfflineNoteFallbackBuilder.fallbackNote(transcript: transcript, noteStyle: noteStyle)
    }

    private func localNoteProviderName(
        qwenModelID: String,
        locale: String,
        warnings: inout [String]
    ) -> String {
        if let resolutionWarning = AppleQwenModelCatalog.resolutionWarning(for: qwenModelID) {
            warnings.append(resolutionWarning)
        }

#if canImport(MLXLMCommon) && canImport(MLXLLM)
        let resolvedModelID = AppleQwenModelCatalog.resolvedModelID(for: qwenModelID)
        return "MLX Qwen (\(resolvedModelID))"
#elseif canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, visionOS 26.0, *) {
            let model = SystemLanguageModel(useCase: .general)
            switch model.availability {
            case .available:
                let preferredLocale = Locale(identifier: locale)
                if model.supportsLocale(preferredLocale) || locale.isEmpty {
                    return "Foundation Models"
                }

                warnings.append("The on-device Apple model is available but does not list \(locale) support, so note drafting may fall back to a transcript-only template.")
                return "Foundation Models (locale-limited)"
            case .unavailable(let reason):
                warnings.append(noteAvailabilityWarning(for: reason))
                return "Offline fallback template"
            }
        }

        warnings.append("This OS version does not expose Apple's on-device Foundation Models framework.")
        return "Offline fallback template"
#else
        warnings.append("This build does not include the MLX Swift runtime for Qwen on-device note generation.")
        return "Offline fallback template"
#endif
    }

#if canImport(MLXLMCommon) && canImport(MLXLLM)
    private func generateWithMLX(
        prompt: String,
        qwenModelID: String,
        thinkingEnabled: Bool
    ) async throws -> String? {
        try await qwenRuntime.generate(
            prompt: prompt,
            modelID: qwenModelID,
            thinkingEnabled: thinkingEnabled
        )
    }
#endif

#if canImport(FoundationModels)
    @available(iOS 26.0, macOS 26.0, visionOS 26.0, *)
    private func generateWithFoundationModels(prompt: String, locale: String) async throws -> String? {
        let model = SystemLanguageModel(useCase: .general)
        guard model.isAvailable else {
            return nil
        }

        let preferredLocale = Locale(identifier: locale)
        guard locale.isEmpty || model.supportsLocale(preferredLocale) else {
            return nil
        }

        let session = LanguageModelSession(
            model: model,
            instructions: "Draft concise clinician-facing notes. Never invent facts beyond the transcript."
        )
        let response = try await session.respond(to: prompt)
        let text = response.content.trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? nil : text
    }

    @available(iOS 26.0, macOS 26.0, visionOS 26.0, *)
    private func noteAvailabilityWarning(for reason: SystemLanguageModel.Availability.UnavailableReason) -> String {
        switch reason {
        case .deviceNotEligible:
            return "This device is not eligible for Apple's on-device language model, so note drafting will use the offline template."
        case .appleIntelligenceNotEnabled:
            return "Apple Intelligence is disabled on this device, so note drafting will use the offline template until it is enabled."
        case .modelNotReady:
            return "The on-device Apple model is still downloading or preparing, so note drafting will use the offline template for now."
        @unknown default:
            return "The on-device Apple model is unavailable, so note drafting will use the offline template."
        }
    }
#endif
}
