import Foundation

@MainActor
final class ScribeViewModel: ObservableObject {
    @Published var repoRoot: String = RepositoryLocator.defaultRepoRoot.path
    @Published var ollamaModel: String = "qwen3.5:4b"
    @Published var whisperModel: String = PlatformDefaults.defaultWhisperModel
    @Published var onDeviceQwenModelID: String = PlatformDefaults.defaultOnDeviceQwenModelID
    @Published var onDeviceThinkingEnabled: Bool = UserDefaults.standard.object(
        forKey: PlatformDefaults.onDeviceThinkingEnabledKey
    ) as? Bool ?? PlatformDefaults.defaultOnDeviceThinkingEnabled {
        didSet {
            UserDefaults.standard.set(
                onDeviceThinkingEnabled,
                forKey: PlatformDefaults.onDeviceThinkingEnabledKey
            )
        }
    }
    @Published var backendURLString: String = PlatformDefaults.initialBackendURLString {
        didSet {
            UserDefaults.standard.set(
                backendURLString,
                forKey: PlatformDefaults.backendURLStringKey
            )
#if os(iOS)
            KeychainSecretStore.save(
                backendURLString.trimmingCharacters(in: .whitespacesAndNewlines),
                account: KeychainSecretStore.backendURLAccount
            )
#endif
        }
    }
    @Published var executionMode: ScribeExecutionMode = PlatformDefaults.defaultExecutionMode
    @Published var noteStyle: NoteStyle = .journal
    @Published var language: String = "sv"
    @Published var locale: String = "sv-SE"
    @Published var country: String = "SE"
    @Published var transcript: String = ""
    @Published var noteDraft: String = ""
    @Published private(set) var noteIsEdited = false
    @Published private(set) var currentNoteRevisions: [SavedEncounterRevision] = []
    @Published var warnings: [String] = []
    @Published var logs: [String] = []
    @Published private(set) var savedEncounters: [SavedEncounter] = []
    @Published var isBusy = false
    @Published private(set) var activityTitle = ""
    @Published private(set) var activityDetail = ""
    @Published private(set) var serviceIsReady = false
    @Published private(set) var transcriptionProvider = "idle"
    @Published private(set) var noteProvider = "idle"
    @Published private(set) var lastAction = "Idle"

    private let backendManager = LocalBackendManager()
    private let client = ScribeClient()
    private let bergetClient = BergetScribeClient()
    private let onDeviceEngine = OnDeviceScribeEngine()
    private let noteArchive: NoteArchiveStore
    private var currentEncounterID: UUID?
    private var originalNoteDraft = ""
    private var pendingNoteRevisionTask: Task<Void, Never>?

    init(
        noteArchive: NoteArchiveStore = NoteArchiveStore(),
        launchContext: AppLaunchContext = .current
    ) {
        self.noteArchive = noteArchive
        self.savedEncounters = launchContext.isScreenshotMode ? [] : noteArchive.load()
#if os(iOS)
        migrateLegacyBackendURLIfNeeded()
        if KeychainSecretStore.load(account: KeychainSecretStore.backendAPITokenAccount).isEmpty,
           !PlatformDefaults.defaultBackendAPITokenString.isEmpty {
            KeychainSecretStore.save(
                PlatformDefaults.defaultBackendAPITokenString,
                account: KeychainSecretStore.backendAPITokenAccount
            )
        }
#endif
        if let scenario = launchContext.screenshotScenario {
            applyScreenshotScenario(scenario)
        }
    }

    var serviceStatusLabel: String {
        serviceIsReady ? "ready" : "stopped"
    }

    var shouldShowBusyOverlay: Bool {
        isBusy && !activityTitle.isEmpty
    }

    var supportsLocalStack: Bool {
#if os(macOS)
        true
#else
        false
#endif
    }

    func startLocalStack() async {
        guard supportsLocalStack else {
            await connectToConfiguredBackend()
            return
        }
        guard !serviceIsReady else { return }
        beginActivity(
            title: "Starting local backend",
            detail: "Launching the Mac-hosted transcription and note stack."
        )

        do {
            let config = LocalBackendConfiguration(
                repoRoot: URL(fileURLWithPath: repoRoot),
                ollamaModel: ollamaModel,
                language: language,
                noteStyle: noteStyle.rawValue
            )
            try await backendManager.start(configuration: config)
            serviceIsReady = true
            backendURLString = config.baseURL.absoluteString
            transcriptionProvider = "whisper-onnx"
            noteProvider = ollamaModel
            log("Local stack started on \(config.baseURL.absoluteString)")
            lastAction = "Local stack ready"
        } catch {
            serviceIsReady = false
            log("Failed to start local stack: \(error.localizedDescription)")
            lastAction = "Start failed"
        }

        endActivity()
    }

    func connectToConfiguredBackend() async {
        beginActivity(
            title: "Connecting to backend",
            detail: "Checking the configured Eir Scribe backend."
        )

        guard let url = normalizedBackendURL() else {
          log("Backend URL is invalid.")
          lastAction = "Invalid backend URL"
          endActivity()
          return
        }

        guard isSecureOrLocalBackendURL(url) else {
            log("Remote backend must use HTTPS unless it is a local-network address.")
            lastAction = "Insecure backend URL"
            endActivity()
            return
        }

        do {
            try await client.health(baseURL: url, bearerToken: preferredBackendBearerToken())
            serviceIsReady = true
            backendURLString = url.absoluteString
            await backendManager.overrideBaseURL(url)
            transcriptionProvider = "remote backend"
            noteProvider = "remote backend"
            log("Connected to backend at \(url.absoluteString)")
            lastAction = "Backend connected"
        } catch {
            serviceIsReady = false
            log("Backend connection failed: \(error.localizedDescription)")
            lastAction = "Connection failed"
        }

        endActivity()
    }

    func prepareOnDevice() async {
        beginActivity(
            title: "Preparing on-device models",
            detail: "Downloading and warming Whisper and Qwen for local use."
        )

        do {
            let preparation = try await onDeviceEngine.prepare(
                whisperModel: whisperModel,
                qwenModelID: onDeviceQwenModelID,
                locale: locale
            )
            serviceIsReady = true
            transcriptionProvider = preparation.transcriptionProvider
            noteProvider = preparation.noteProvider
            warnings = preparation.warnings
            log("On-device path ready with \(preparation.transcriptionProvider) + \(preparation.noteProvider)")
            lastAction = "On-device ready"
        } catch {
            serviceIsReady = false
            log("Failed to prepare on-device models: \(error.localizedDescription)")
            lastAction = "On-device setup failed"
        }

        endActivity()
    }

    func prepareCurrentModeIfNeeded() async -> Bool {
        guard !serviceIsReady else { return true }

        switch executionMode {
        case .localStack:
            await startLocalStack()
        case .remoteBackend:
            await connectToConfiguredBackend()
        case .onDevice:
            await prepareOnDevice()
        }

        return serviceIsReady
    }

    func stopLocalStack() async {
        if executionMode == .localStack, supportsLocalStack {
            await backendManager.stop()
        }
        serviceIsReady = false
        transcriptionProvider = "idle"
        noteProvider = "idle"
        switch executionMode {
        case .localStack:
            lastAction = "Local stack stopped"
            log("Local stack stopped.")
        case .remoteBackend:
            lastAction = "Backend disconnected"
            log("Backend disconnected.")
        case .onDevice:
            lastAction = "On-device state reset"
            log("On-device state reset.")
        }
    }

    func noteCaptureStarted() {
        lastAction = "Recording"
        log("Recording started.")
    }

    func noteCaptureSaved(fileName: String) {
        lastAction = "Recorded \(fileName)"
        log("Saved recording as \(fileName).")
    }

    func presentInlineMessage(_ message: String) {
        lastAction = message
        log(message)
    }

    func runBundledSample() async {
        guard supportsLocalStack else {
            log("Bundled sample is only available on macOS because the sample file lives in the repository.")
            return
        }
        let sampleURL = URL(fileURLWithPath: repoRoot)
            .appendingPathComponent("test/fixtures/sample_swedish.mp3")
        await analyzeAudioFile(at: sampleURL)
    }

    func handleFileImport(_ result: Result<URL, Error>) async {
        switch result {
        case .success(let url):
            await analyzeImportedAudioFile(at: url)
        case .failure(let error):
            log("Audio import failed: \(error.localizedDescription)")
        }
    }

    func analyzeRecordedAudio(
        at url: URL,
        route: RecordedEncounterProcessingRoute,
        directBergetAPIKey: String
    ) async {
        switch route {
        case .cloud:
            await analyzeCloudAudioFile(at: url, directBergetAPIKey: directBergetAPIKey)
        case .local:
            await analyzeOnDeviceAudioFile(at: url)
        }
    }

    func analyzeCloudAudioFile(at url: URL, directBergetAPIKey: String = "") async {
        executionMode = .remoteBackend
        let sanitizedKey = directBergetAPIKey.trimmingCharacters(in: .whitespacesAndNewlines)

        beginActivity(
            title: sanitizedKey.isEmpty ? "Sending to cloud" : "Sending to Berget",
            detail: sanitizedKey.isEmpty
                ? "Uploading the recording to your configured cloud backend."
                : "Uploading the recording directly to Berget with your own API key."
        )
        lastAction = "Analyzing \(url.lastPathComponent)"

        do {
            let result: AppScribeResult
            if sanitizedKey.isEmpty {
                guard let baseURL = normalizedBackendURL() else {
                    throw NSError(
                        domain: "OpenMedicalScribeApple",
                        code: 61,
                        userInfo: [
                            NSLocalizedDescriptionKey:
                                "Cloud processing needs a backend URL, or enable 'Use your own Berget API key' in Settings."
                        ]
                    )
                }

                guard isSecureOrLocalBackendURL(baseURL) else {
                    throw NSError(
                        domain: "OpenMedicalScribeApple",
                        code: 63,
                        userInfo: [
                            NSLocalizedDescriptionKey:
                                "Production backends must use HTTPS. Plain HTTP is only allowed for trusted local-network addresses."
                        ]
                    )
                }

                let backendBearerToken = preferredBackendBearerToken()
                if requiresBackendBearerToken(baseURL), backendBearerToken.isEmpty {
                    throw NSError(
                        domain: "OpenMedicalScribeApple",
                        code: 64,
                        userInfo: [
                            NSLocalizedDescriptionKey:
                                "This Eir cloud backend requires a Backend API Token. Open Settings and paste the token into the 'Backend API Token' field."
                        ]
                    )
                }

#if os(iOS)
                if baseURL.isFileURL == false, isLoopbackBackendURL(baseURL) {
                    throw NSError(
                        domain: "OpenMedicalScribeApple",
                        code: 62,
                        userInfo: [
                            NSLocalizedDescriptionKey:
                                "This iPhone is pointing at \(baseURL.host ?? "localhost"), which refers to the phone itself. Use your Mac's LAN address or enable 'Use your own Berget API key' in Settings."
                        ]
                    )
                }
#endif

                result = try await client.scribeAudio(
                    baseURL: baseURL,
                    bearerToken: backendBearerToken,
                    audioURL: url,
                    language: language,
                    locale: locale,
                    country: country,
                    noteStyle: noteStyle.rawValue
                )
            } else {
                result = try await bergetClient.scribeAudio(
                    apiKey: sanitizedKey,
                    audioURL: url,
                    language: language,
                    locale: locale,
                    country: country,
                    noteStyle: noteStyle
                )
            }

            applyResult(result, sourceFileName: url.lastPathComponent)
        } catch {
            let message = error.localizedDescription
            transcript = ""
            setCurrentNoteDraft(
                "",
                originalNoteDraft: "",
                isEdited: false,
                encounterID: nil,
                revisions: []
            )
            warnings = [message]
            log("Cloud analysis failed: \(message)")
            lastAction = "Cloud processing failed"
        }

        endActivity()
    }

    func analyzeOnDeviceAudioFile(at url: URL) async {
        executionMode = .onDevice
        beginActivity(
            title: "Preparing local models",
            detail: "Downloading or warming Whisper and the local note model on this iPhone. The first run can take a few minutes."
        )
        lastAction = "Analyzing \(url.lastPathComponent)"

        do {
            let preparation = try await onDeviceEngine.prepare(
                whisperModel: whisperModel,
                qwenModelID: onDeviceQwenModelID,
                locale: locale
            )
            serviceIsReady = true
            transcriptionProvider = preparation.transcriptionProvider
            noteProvider = preparation.noteProvider

            updateActivity(
                title: "Transcribing locally",
                detail: "Running Whisper on the recording."
            )
            let transcript = try await onDeviceEngine.transcribePreparedAudio(at: url, language: language)

            updateActivity(
                title: "Drafting locally",
                detail: onDeviceThinkingEnabled
                    ? "Writing the note on this iPhone with Qwen thinking enabled. This can take longer."
                    : "Writing the note on this iPhone with fast local drafting."
            )
            let noteOutput = try await onDeviceEngine.draftNoteFromTranscript(
                transcript: transcript,
                noteStyle: noteStyle,
                qwenModelID: onDeviceQwenModelID,
                thinkingEnabled: onDeviceThinkingEnabled,
                language: language,
                locale: locale,
                country: country
            )

            applyResult(
                AppScribeResult(
                    providers: .init(
                        transcription: preparation.transcriptionProvider,
                        note: preparation.noteProvider
                    ),
                    transcript: transcript,
                    noteDraft: noteOutput.noteDraft,
                    warnings: preparation.warnings + noteOutput.warnings
                ),
                sourceFileName: url.lastPathComponent
            )
        } catch {
            log("Local analysis failed: \(error.localizedDescription)")
            lastAction = "Local processing failed"
        }

        endActivity()
    }

    func analyzeAudioFile(at url: URL) async {
        guard serviceIsReady else {
            log(readinessHint)
            return
        }

        beginActivity(
            title: "Generating note",
            detail: "Transcribing the recording and drafting the clinical note."
        )
        lastAction = "Analyzing \(url.lastPathComponent)"

        do {
            let result: AppScribeResult
            switch executionMode {
            case .onDevice:
                result = try await onDeviceEngine.analyzeAudio(
                    at: url,
                    whisperModel: whisperModel,
                    qwenModelID: onDeviceQwenModelID,
                    thinkingEnabled: onDeviceThinkingEnabled,
                    language: language,
                    locale: locale,
                    country: country,
                    noteStyle: noteStyle
                )
            case .remoteBackend, .localStack:
                let baseURL = await backendManager.baseURL
                result = try await client.scribeAudio(
                    baseURL: baseURL,
                    bearerToken: preferredBackendBearerToken(),
                    audioURL: url,
                    language: language,
                    locale: locale,
                    country: country,
                    noteStyle: noteStyle.rawValue
                )
            }

            applyResult(result, sourceFileName: url.lastPathComponent)
        } catch {
            log("Analysis failed: \(error.localizedDescription)")
            lastAction = "Analysis failed"
        }

        endActivity()
    }

    func clearEncounterOutput() {
        pendingNoteRevisionTask?.cancel()
        transcript = ""
        noteDraft = ""
        originalNoteDraft = ""
        noteIsEdited = false
        currentNoteRevisions = []
        currentEncounterID = nil
        warnings = []
        lastAction = "Ready"
    }

    private func beginActivity(title: String, detail: String) {
        isBusy = true
        activityTitle = title
        activityDetail = detail
        lastAction = title
    }

    private func updateActivity(title: String, detail: String) {
        activityTitle = title
        activityDetail = detail
        lastAction = title
    }

    private func endActivity() {
        isBusy = false
        activityTitle = ""
        activityDetail = ""
    }

    private func applyResult(_ result: AppScribeResult, sourceFileName: String) {
        transcript = result.transcript
        warnings = result.warnings
        transcriptionProvider = result.providers.transcription
        noteProvider = result.providers.note
        let encounter = archiveEncounter(result: result, sourceFileName: sourceFileName)
        setCurrentNoteDraft(
            result.noteDraft,
            originalNoteDraft: encounter.originalNoteDraft,
            isEdited: encounter.isEdited,
            encounterID: encounter.id,
            revisions: encounter.revisions
        )
        lastAction = "Completed \(sourceFileName)"
        log("Analyzed \(sourceFileName) with \(result.providers.transcription) + \(result.providers.note)")
    }

    func loadSavedEncounter(_ encounter: SavedEncounter) {
        transcript = encounter.transcript
        setCurrentNoteDraft(
            encounter.noteDraft,
            originalNoteDraft: encounter.originalNoteDraft,
            isEdited: encounter.isEdited,
            encounterID: encounter.id,
            revisions: encounter.revisions
        )
        warnings = encounter.warnings
        noteStyle = encounter.noteStyleValue
        language = encounter.language
        locale = encounter.locale
        country = encounter.country
        transcriptionProvider = encounter.transcriptionProvider
        noteProvider = encounter.noteProvider
        lastAction = "Opened saved note"
        log("Loaded saved note from \(encounter.sourceLabel)")
    }

    func deleteSavedEncounter(_ encounter: SavedEncounter) {
        savedEncounters.removeAll { $0.id == encounter.id }
        if currentEncounterID == encounter.id {
            currentEncounterID = nil
        }
        persistSavedEncounters()
        log("Deleted saved note from \(encounter.sourceLabel)")
    }

    func updateNoteDraftFromEditor(_ updatedNoteDraft: String) {
        guard noteDraft != updatedNoteDraft else {
            return
        }

        noteDraft = updatedNoteDraft
        let isEdited = updatedNoteDraft != originalNoteDraft
        noteIsEdited = isEdited

        if let currentEncounterID {
            if let index = savedEncounters.firstIndex(where: { $0.id == currentEncounterID }) {
                let existing = savedEncounters[index]
                savedEncounters[index] = SavedEncounter(
                    id: existing.id,
                    createdAt: existing.createdAt,
                    sourceFileName: existing.sourceFileName,
                    noteStyle: existing.noteStyle,
                    language: existing.language,
                    locale: existing.locale,
                    country: existing.country,
                    transcript: transcript,
                    noteDraft: updatedNoteDraft,
                    originalNoteDraft: existing.originalNoteDraft,
                    isEdited: isEdited,
                    revisions: existing.revisions,
                    warnings: warnings,
                    transcriptionProvider: transcriptionProvider,
                    noteProvider: noteProvider
                )
                persistSavedEncounters()
            }
        }

        schedulePendingNoteRevisionSnapshot()
        lastAction = isEdited ? "Note edited" : "Draft restored"
    }

    func capturePendingNoteRevisionIfNeeded() {
        pendingNoteRevisionTask?.cancel()
        pendingNoteRevisionTask = nil
        appendCurrentNoteRevisionIfNeeded(kind: noteIsEdited ? .edited : .restored)
    }

    func restoreCurrentNoteRevision(_ revisionID: UUID) {
        guard let currentEncounterID,
              let revision = currentNoteRevisions.first(where: { $0.id == revisionID }),
              let index = savedEncounters.firstIndex(where: { $0.id == currentEncounterID })
        else {
            return
        }

        pendingNoteRevisionTask?.cancel()
        let restoredDraft = revision.noteDraft
        let isEdited = restoredDraft != originalNoteDraft
        var revisions = savedEncounters[index].revisions

        if revisions.last?.noteDraft != restoredDraft {
            revisions.append(
                SavedEncounterRevision(
                    noteDraft: restoredDraft,
                    kind: .restored
                )
            )
        }

        currentNoteRevisions = revisions
        savedEncounters[index] = SavedEncounter(
            id: savedEncounters[index].id,
            createdAt: savedEncounters[index].createdAt,
            sourceFileName: savedEncounters[index].sourceFileName,
            noteStyle: savedEncounters[index].noteStyle,
            language: savedEncounters[index].language,
            locale: savedEncounters[index].locale,
            country: savedEncounters[index].country,
            transcript: transcript,
            noteDraft: restoredDraft,
            originalNoteDraft: savedEncounters[index].originalNoteDraft,
            isEdited: isEdited,
            revisions: revisions,
            warnings: warnings,
            transcriptionProvider: transcriptionProvider,
            noteProvider: noteProvider
        )
        setCurrentNoteDraft(
            restoredDraft,
            originalNoteDraft: savedEncounters[index].originalNoteDraft,
            isEdited: isEdited,
            encounterID: currentEncounterID,
            revisions: revisions
        )
        persistSavedEncounters()
        lastAction = "Restored previous version"
        log("Restored note version from \(revision.kind.title.lowercased()) snapshot.")
    }

    func exportArtifacts(for encounter: SavedEncounter? = nil) throws -> EncounterExportArtifacts {
        let target = encounter ?? currentEncounterForExport()
        guard let target else {
            throw NSError(
                domain: "OpenMedicalScribeApple",
                code: 81,
                userInfo: [NSLocalizedDescriptionKey: "There is no completed note to export yet."]
            )
        }

        return EncounterExportFormatter.makeArtifacts(for: target)
    }

    private func log(_ line: String) {
        let stamp = ISO8601DateFormatter().string(from: Date())
        logs.append("[\(stamp)] \(line)")
        if logs.count > 200 {
            logs.removeFirst(logs.count - 200)
        }
    }

    private func archiveEncounter(result: AppScribeResult, sourceFileName: String) -> SavedEncounter {
        let encounter = SavedEncounter(
            id: UUID(),
            createdAt: Date(),
            sourceFileName: sourceFileName,
            noteStyle: noteStyle.rawValue,
            language: language,
            locale: locale,
            country: country,
            transcript: result.transcript,
            noteDraft: result.noteDraft,
            originalNoteDraft: result.noteDraft,
            isEdited: false,
            revisions: [
                SavedEncounterRevision(
                    noteDraft: result.noteDraft,
                    kind: .generated
                )
            ],
            warnings: result.warnings,
            transcriptionProvider: result.providers.transcription,
            noteProvider: result.providers.note
        )

        savedEncounters.insert(encounter, at: 0)
        if savedEncounters.count > 250 {
            savedEncounters.removeLast(savedEncounters.count - 250)
        }
        persistSavedEncounters()
        return encounter
    }

    private func currentEncounterForExport() -> SavedEncounter? {
        let trimmedNote = noteDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedTranscript = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedNote.isEmpty || !trimmedTranscript.isEmpty else {
            return nil
        }

        return SavedEncounter(
            id: UUID(),
            createdAt: Date(),
            sourceFileName: "current-note",
            noteStyle: noteStyle.rawValue,
            language: language,
            locale: locale,
            country: country,
            transcript: transcript,
            noteDraft: noteDraft,
            originalNoteDraft: originalNoteDraft,
            isEdited: noteIsEdited,
            revisions: currentNoteRevisions,
            warnings: warnings,
            transcriptionProvider: transcriptionProvider,
            noteProvider: noteProvider
        )
    }

    private func persistSavedEncounters() {
        do {
            try noteArchive.save(savedEncounters)
        } catch {
            log("Failed to save note history: \(error.localizedDescription)")
        }
    }

    private func applyScreenshotScenario(_ scenario: ScreenshotScenario) {
        let demo = ScreenshotDemo.fixture

        executionMode = .remoteBackend
        noteStyle = .journal
        language = "sv"
        locale = "sv-SE"
        country = "SE"
        backendURLString = "https://scribe.eir.space"
        serviceIsReady = true
        warnings = demo.currentEncounter.warnings
        transcriptionProvider = demo.currentEncounter.transcriptionProvider
        noteProvider = demo.currentEncounter.noteProvider
        lastAction = "Demo state ready"
        logs = demo.logs
        savedEncounters = demo.encounters
        loadSavedEncounter(demo.currentEncounter)

        if scenario == .processing {
            transcript = ""
            setCurrentNoteDraft(
                "",
                originalNoteDraft: "",
                isEdited: false,
                encounterID: nil,
                revisions: []
            )
            warnings = []
            isBusy = true
            activityTitle = "Preparing local models"
            activityDetail = "Downloading Whisper and Qwen to this iPhone. The first run can take a few minutes."
            transcriptionProvider = "WhisperKit"
            noteProvider = "Qwen 3.5 MLX"
            lastAction = "Preparing local models"
        }
    }

    private func setCurrentNoteDraft(
        _ noteDraft: String,
        originalNoteDraft: String,
        isEdited: Bool,
        encounterID: UUID?,
        revisions: [SavedEncounterRevision]
    ) {
        pendingNoteRevisionTask?.cancel()
        self.noteDraft = noteDraft
        self.originalNoteDraft = originalNoteDraft
        self.noteIsEdited = isEdited
        self.currentEncounterID = encounterID
        self.currentNoteRevisions = revisions
    }

    private func schedulePendingNoteRevisionSnapshot() {
        guard currentEncounterID != nil else {
            return
        }

        pendingNoteRevisionTask?.cancel()
        pendingNoteRevisionTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled else { return }
            self?.appendCurrentNoteRevisionIfNeeded(kind: self?.noteIsEdited == true ? .edited : .restored)
        }
    }

    private func appendCurrentNoteRevisionIfNeeded(kind: SavedEncounterRevisionKind) {
        guard let currentEncounterID,
              let index = savedEncounters.firstIndex(where: { $0.id == currentEncounterID })
        else {
            return
        }

        if currentNoteRevisions.last?.noteDraft == noteDraft {
            return
        }

        var revisions = currentNoteRevisions
        revisions.append(
            SavedEncounterRevision(
                noteDraft: noteDraft,
                kind: kind
            )
        )
        currentNoteRevisions = revisions

        let existing = savedEncounters[index]
        savedEncounters[index] = SavedEncounter(
            id: existing.id,
            createdAt: existing.createdAt,
            sourceFileName: existing.sourceFileName,
            noteStyle: existing.noteStyle,
            language: existing.language,
            locale: existing.locale,
            country: existing.country,
            transcript: transcript,
            noteDraft: noteDraft,
            originalNoteDraft: existing.originalNoteDraft,
            isEdited: noteIsEdited,
            revisions: revisions,
            warnings: warnings,
            transcriptionProvider: transcriptionProvider,
            noteProvider: noteProvider
        )
        persistSavedEncounters()
    }

    private func normalizedBackendURL() -> URL? {
        let raw = backendURLString.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.isEmpty { return nil }
        if raw.contains("://") {
            return URL(string: raw)
        }
        return URL(string: "http://\(raw)")
    }

    private func isLoopbackBackendURL(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else {
            return false
        }

        return host == "127.0.0.1" || host == "localhost" || host == "::1"
    }

    private func isSecureOrLocalBackendURL(_ url: URL) -> Bool {
        if url.scheme?.lowercased() == "https" {
            return true
        }

        guard url.scheme?.lowercased() == "http", let host = url.host?.lowercased() else {
            return false
        }

        if isLoopbackBackendURL(url) || host.hasSuffix(".local") || host.hasPrefix("10.") || host.hasPrefix("192.168.") {
            return true
        }

        let octets = host.split(separator: ".")
        guard octets.count == 4, octets[0] == "172", let second = Int(octets[1]) else {
            return false
        }

        return (16...31).contains(second)
    }

    private var readinessHint: String {
        switch executionMode {
        case .localStack:
            return "Start the local stack before analyzing audio."
        case .remoteBackend:
            return "Connect to a backend before analyzing audio."
        case .onDevice:
            return "Prepare the on-device models before analyzing audio."
        }
    }

    private func analyzeImportedAudioFile(at url: URL) async {
#if os(iOS)
        let directBergetAPIKey = preferredDirectBergetAPIKey()
        await analyzeCloudAudioFile(at: url, directBergetAPIKey: directBergetAPIKey)
#else
        await analyzeAudioFile(at: url)
#endif
    }

#if os(iOS)
    private func preferredDirectBergetAPIKey() -> String {
        let useDirectKey = UserDefaults.standard.bool(forKey: "openmedicalscribe.useDirectBergetKey")
        guard useDirectKey else {
            return ""
        }

        return KeychainSecretStore
            .load(account: KeychainSecretStore.bergetAPIKeyAccount)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func preferredBackendBearerToken() -> String {
        KeychainSecretStore
            .load(account: KeychainSecretStore.backendAPITokenAccount)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
#else
    private func preferredBackendBearerToken() -> String {
        ""
    }
#endif

    private func requiresBackendBearerToken(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else {
            return false
        }

        return host == "eir-scribe-backend.fly.dev" || host == "scribe.eir.space"
    }

    private func migrateLegacyBackendURLIfNeeded() {
#if os(iOS)
        let legacyURL = "https://eir-scribe-backend.fly.dev"
        guard PlatformDefaults.defaultBackendURLString == "https://scribe.eir.space" else {
            return
        }

        let defaultsValue = UserDefaults.standard.string(forKey: PlatformDefaults.backendURLStringKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if defaultsValue == legacyURL {
            UserDefaults.standard.set(
                PlatformDefaults.defaultBackendURLString,
                forKey: PlatformDefaults.backendURLStringKey
            )
        }

        let keychainValue = KeychainSecretStore
            .load(account: KeychainSecretStore.backendURLAccount)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if keychainValue == legacyURL {
            KeychainSecretStore.save(
                PlatformDefaults.defaultBackendURLString,
                account: KeychainSecretStore.backendURLAccount
            )
        }
#endif
    }
}

private struct ScreenshotDemo {
    let encounters: [SavedEncounter]
    let currentEncounter: SavedEncounter
    let logs: [String]

    static let fixture: ScreenshotDemo = {
        let baseDate = Date(timeIntervalSince1970: 1_772_800_000)
        let generatedDraft = """
        Kontaktorsak
        Patienten söker för tre dagars halsont, lätt feber och trötthet.

        Status
        AT gott. Temp 38,1. Rodnade tonsiller utan andningspåverkan. Ingen nackstelhet.

        Bedömning
        Bild förenlig med övre luftvägsinfektion utan alarmsymtom.

        Plan
        Vila, vätska, egenvård och åter vid försämring. CRP eller snabbtest endast vid tilltagande besvär.
        """
        let editedDraft = """
        Kontaktorsak
        Patienten söker för tre dagars halsont, lätt feber och trötthet.

        Anamnes
        Besvären började efter helgen. Ingen dyspné, inga sväljningssvårigheter och ingen tidigare allvarlig infektion senaste månaderna.

        Status
        AT gott. Temp 38,1. Rodnade tonsiller utan beläggningar. Ingen andningspåverkan. Ingen nackstelhet.

        Bedömning
        Bild förenlig med övre luftvägsinfektion utan alarmsymtom.

        Plan
        Vila, vätska och paracetamol vid behov. Egenvårdsråd givna. Ny kontakt vid försämring, andningsbesvär eller kvarstående feber.
        """
        let restoredDraft = """
        Kontaktorsak
        Patienten söker för tre dagars halsont, lätt feber och trötthet.

        Anamnes
        Besvären började efter helgen. Ingen dyspné eller sväljningssvårigheter.

        Status
        AT gott. Temp 38,1. Rodnade tonsiller utan beläggningar. Ingen andningspåverkan.

        Bedömning
        Trolig viral övre luftvägsinfektion.

        Plan
        Vätska, vila och åter vid försämring.
        """
        let transcript = """
        Lakare: Vad kan jag hjalpa dig med idag?
        Patient: Jag har haft ont i halsen sedan i mandags och kanner mig febrig.
        Lakare: Har du haft andningssvarigheter eller svart att svalja?
        Patient: Nej, mest ont och jag ar trott.
        Lakare: Det later som en ovre luftvagsinfektion. Vi gar igenom egenvard och nar du ska soka igen.
        """
        let currentEncounter = SavedEncounter(
            id: UUID(uuidString: "3D35D78E-CB0B-4F7F-9AFA-57D1C68AE001") ?? UUID(),
            createdAt: baseDate,
            sourceFileName: "besok-2026-03-06.m4a",
            noteStyle: NoteStyle.journal.rawValue,
            language: "sv",
            locale: "sv-SE",
            country: "SE",
            transcript: transcript,
            noteDraft: editedDraft,
            originalNoteDraft: generatedDraft,
            isEdited: true,
            revisions: [
                SavedEncounterRevision(
                    id: UUID(uuidString: "3D35D78E-CB0B-4F7F-9AFA-57D1C68AE101") ?? UUID(),
                    createdAt: baseDate,
                    noteDraft: generatedDraft,
                    kind: .generated
                ),
                SavedEncounterRevision(
                    id: UUID(uuidString: "3D35D78E-CB0B-4F7F-9AFA-57D1C68AE102") ?? UUID(),
                    createdAt: baseDate.addingTimeInterval(420),
                    noteDraft: editedDraft,
                    kind: .edited
                ),
                SavedEncounterRevision(
                    id: UUID(uuidString: "3D35D78E-CB0B-4F7F-9AFA-57D1C68AE103") ?? UUID(),
                    createdAt: baseDate.addingTimeInterval(840),
                    noteDraft: restoredDraft,
                    kind: .restored
                ),
                SavedEncounterRevision(
                    id: UUID(uuidString: "3D35D78E-CB0B-4F7F-9AFA-57D1C68AE104") ?? UUID(),
                    createdAt: baseDate.addingTimeInterval(1_080),
                    noteDraft: editedDraft,
                    kind: .edited
                )
            ],
            warnings: [
                "Verifiera duration och feberforlopp innan journalen signeras.",
                "Kontrollera att egenvardsrad stammer med lokal rutin."
            ],
            transcriptionProvider: "Berget kb-whisper-large",
            noteProvider: "Berget openai/gpt-oss-120b"
        )
        let followUpEncounter = SavedEncounter(
            id: UUID(uuidString: "3D35D78E-CB0B-4F7F-9AFA-57D1C68AE002") ?? UUID(),
            createdAt: baseDate.addingTimeInterval(-86_400),
            sourceFileName: "uppfoljning-2026-03-05.m4a",
            noteStyle: NoteStyle.journal.rawValue,
            language: "sv",
            locale: "sv-SE",
            country: "SE",
            transcript: "Uppfoljning efter blodtryckskontroll och justering av medicinering.",
            noteDraft: """
            Kontaktorsak
            Uppfoljning av hypertoni.

            Bedomning
            Blodtrycket battre kontrollerat efter dosokning.

            Plan
            Fortsatt behandling och ny kontroll om 3 manader.
            """,
            warnings: [],
            transcriptionProvider: "Berget kb-whisper-large",
            noteProvider: "Berget openai/gpt-oss-120b"
        )
        let logs = [
            "[2026-03-06T08:40:12Z] Connected to backend at https://scribe.eir.space",
            "[2026-03-06T08:41:03Z] Recording started.",
            "[2026-03-06T08:42:18Z] Saved recording as besok-2026-03-06.m4a.",
            "[2026-03-06T08:42:19Z] Analyzed besok-2026-03-06.m4a with Berget kb-whisper-large + Berget openai/gpt-oss-120b"
        ]

        return ScreenshotDemo(
            encounters: [currentEncounter, followUpEncounter],
            currentEncounter: currentEncounter,
            logs: logs
        )
    }()
}

enum NoteStyle: String, CaseIterable {
    case soap
    case hp
    case progress
    case dap
    case procedure
    case journal

    var title: String {
        switch self {
        case .hp: return "H&P"
        case .dap: return "DAP"
        case .journal: return "Journal"
        case .soap: return "SOAP"
        case .progress: return "Progress"
        case .procedure: return "Procedure"
        }
    }
}

enum RepositoryLocator {
    static var defaultRepoRoot: URL {
        let compiledPath = URL(fileURLWithPath: #filePath)
        return compiledPath
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }
}

enum PlatformDefaults {
    static let backendURLStringKey = "openmedicalscribe.backendURLString"
    static let backendAPITokenKey = "openmedicalscribe.backendAPIToken"
    static let initialBackendURLString: String = {
        let defaultsValue = UserDefaults.standard.string(forKey: backendURLStringKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
#if os(iOS)
        if !defaultsValue.isEmpty {
            return defaultsValue
        }

        let keychainValue = KeychainSecretStore
            .load(account: KeychainSecretStore.backendURLAccount)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return keychainValue.isEmpty ? defaultBackendURLString : keychainValue
#else
        return defaultsValue.isEmpty ? defaultBackendURLString : defaultsValue
#endif
    }()
    static let initialBackendAPITokenString: String = {
#if os(iOS)
        let defaultsValue = UserDefaults.standard.string(forKey: backendAPITokenKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !defaultsValue.isEmpty {
            return defaultsValue
        }

        let keychainValue = KeychainSecretStore
            .load(account: KeychainSecretStore.backendAPITokenAccount)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return keychainValue.isEmpty ? defaultBackendAPITokenString : keychainValue
#else
        ""
#endif
    }()
    static let defaultBackendURLString: String = {
#if os(iOS)
        bundleConfiguredBackendURLString
#else
        "http://127.0.0.1:8799"
#endif
    }()
    static let defaultBackendAPITokenString: String = {
#if os(iOS)
        bundleConfiguredBackendAPITokenString
#else
        ""
#endif
    }()
    static let defaultWhisperModel = "small"
    static let defaultOnDeviceQwenModelID = "mlx-community/Qwen3.5-4B-4bit"
    static let onDeviceThinkingEnabledKey = "openmedicalscribe.onDeviceThinkingEnabled"
    static let defaultOnDeviceThinkingEnabled = false
    static let defaultExecutionMode: ScribeExecutionMode = {
#if os(iOS)
        .remoteBackend
#else
        ScribeExecutionMode.availableModes.first ?? .remoteBackend
#endif
    }()

    private static let bundleConfiguredBackendURLString: String = {
#if os(iOS)
        (Bundle.main.object(forInfoDictionaryKey: "OMSDefaultBackendURL") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
#else
        ""
#endif
    }()
    private static let bundleConfiguredBackendAPITokenString: String = {
#if os(iOS)
        (Bundle.main.object(forInfoDictionaryKey: "OMSDefaultBackendAPIToken") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
#else
        ""
#endif
    }()
}

enum RecordedEncounterProcessingRoute {
    case cloud
    case local
}
