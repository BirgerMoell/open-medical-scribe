import SwiftUI
import UniformTypeIdentifiers

@main
struct OpenMedicalScribeMacApp: App {
    @StateObject private var viewModel: ScribeViewModel
    @State private var importingAudio = false
    private let launchContext: AppLaunchContext

    init() {
        let launchContext = AppLaunchContext.current
        self.launchContext = launchContext
        _viewModel = StateObject(wrappedValue: ScribeViewModel(launchContext: launchContext))
    }

    var body: some Scene {
        WindowGroup(AppBrand.displayName) {
            ScribeRootView(
                viewModel: viewModel,
                importingAudio: $importingAudio,
                launchContext: launchContext
            )
            .fileImporter(
                isPresented: $importingAudio,
                allowedContentTypes: [.audio]
            ) { result in
                Task {
                    await viewModel.handleFileImport(result)
                }
            }
        }
#if os(macOS)
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandGroup(after: .newItem) {
                Button("Import Audio File") {
                    importingAudio = true
                }
                .keyboardShortcut("o")
            }
        }
#endif
    }
}

private struct ScribeRootView: View {
    private enum EditorField: Hashable {
        case noteDraft
    }

    @ObservedObject var viewModel: ScribeViewModel
    @Binding var importingAudio: Bool
    let launchContext: AppLaunchContext
    @State private var showingHistoryLibrary = false
    @State private var showingExportSheet = false
    @State private var showingVersionsSheet = false
    @State private var selectedRevisionID: UUID?
    @State private var exportArtifacts: EncounterExportArtifacts?
    @State private var exportErrorMessage = ""
    @State private var exportStatusMessage = ""
    @State private var exportStatusTask: Task<Void, Never>?
    @FocusState private var focusedField: EditorField?
    @State private var appliedLaunchPresentation = false

#if os(iOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @StateObject private var recorder = PhoneAudioRecorder()
    @State private var showingPhoneSettings = false
    @State private var showingProcessingChoice = false
    @State private var showingPrivacyNotice = false
    @State private var showingPrivacyPolicy = false
    @State private var showingLocalModelDownloadNotice = false
    @State private var pendingRecordedAudioURL: URL?
    @AppStorage("openmedicalscribe.acceptedPrivacyNotice") private var acceptedPrivacyNotice = false
    @AppStorage("openmedicalscribe.acceptedLocalModelDownloadNotice") private var acceptedLocalModelDownloadNotice = false
    @AppStorage("openmedicalscribe.useDirectBergetKey") private var useDirectBergetKey = false
    @State private var directBergetAPIKey = KeychainSecretStore.load(account: KeychainSecretStore.bergetAPIKeyAccount)
    @State private var backendAPIToken = PlatformDefaults.initialBackendAPITokenString
#endif

    var body: some View {
        Group {
#if os(iOS)
            if usesPhoneLayout {
                phoneLayout
            } else {
                desktopLayout
            }
#else
            desktopLayout
#endif
        }
        .sheet(isPresented: $showingHistoryLibrary) {
            historySheet
        }
        .sheet(isPresented: $showingExportSheet) {
            exportSheet
        }
        .sheet(isPresented: $showingVersionsSheet) {
            versionsSheet
        }
#if os(iOS)
        .sheet(isPresented: $showingPrivacyPolicy) {
            phonePrivacyPolicySheet
        }
#endif
        .onAppear {
            applyLaunchPresentationIfNeeded()
        }
#if os(iOS)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") {
                    dismissEditorKeyboard()
                }
            }
        }
#endif
    }

    private var desktopLayout: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.96, green: 0.94, blue: 0.89),
                    Color(red: 0.88, green: 0.92, blue: 0.90),
                    Color(red: 0.82, green: 0.87, blue: 0.93)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    desktopHeader
                    desktopControls
                    desktopStatusStrip
                    desktopTranscriptCard
                    desktopNoteCard
                    desktopLogCard
                }
                .padding(24)
                .frame(maxWidth: 1120)
            }
        }
#if os(macOS)
        .frame(minWidth: 980, minHeight: 760)
#endif
    }

    private var desktopHeader: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text(AppBrand.displayName)
                    .font(.system(size: 34, weight: .bold, design: .serif))
                Text("Apple client for medical transcription and note drafting, with standalone iPhone inference using WhisperKit plus MLX Qwen.")
                    .font(.system(size: 15, weight: .medium, design: .rounded))
                    .foregroundStyle(.secondary)
            }

            Spacer()

            HStack(spacing: 10) {
                Button {
                    showingHistoryLibrary = true
                } label: {
                    Label("History", systemImage: "clock.arrow.circlepath")
                }
                .buttonStyle(.bordered)

                Button {
                    presentExportSheet()
                } label: {
                    Label("Export", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.borderedProminent)
                .disabled(!hasEncounterOutput)
            }
        }
    }

    private var desktopControls: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Execution Mode")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)
                Picker("Execution Mode", selection: $viewModel.executionMode) {
                    ForEach(ScribeExecutionMode.availableModes) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                Text(viewModel.executionMode.subtitle)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 12) {
                Button(primaryActionTitle) {
                    performPrimaryAction()
                }
                .buttonStyle(.borderedProminent)

                Button("Run Swedish Sample") {
                    Task {
                        await viewModel.runBundledSample()
                    }
                }
                .buttonStyle(.bordered)
                .disabled(viewModel.executionMode != .localStack || !viewModel.serviceIsReady || viewModel.isBusy)

                Button("Import Audio") {
                    importingAudio = true
                }
                .buttonStyle(.bordered)
                .disabled(!viewModel.serviceIsReady || viewModel.isBusy)
            }

            HStack(alignment: .top, spacing: 12) {
                desktopModeFields

                VStack(alignment: .leading, spacing: 6) {
                    Text("Note Style")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundStyle(.secondary)
                    Picker("Note Style", selection: $viewModel.noteStyle) {
                        ForEach(NoteStyle.allCases, id: \.rawValue) { style in
                            Text(style.title).tag(style)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(width: 150)
                }

                desktopLabeledField("Language", text: $viewModel.language, width: 80)
                desktopLabeledField("Locale", text: $viewModel.locale, width: 100)
                desktopLabeledField("Country", text: $viewModel.country, width: 90)
            }
        }
        .padding(18)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    @ViewBuilder
    private var desktopModeFields: some View {
        if viewModel.executionMode == .localStack {
            desktopLabeledField("Repository", text: $viewModel.repoRoot, width: 380)
            desktopLabeledField("Ollama Model", text: $viewModel.ollamaModel, width: 180)
        } else if viewModel.executionMode == .remoteBackend {
            desktopLabeledField("Backend URL", text: $viewModel.backendURLString, width: 320)
        } else {
            desktopLabeledField("Whisper Model", text: $viewModel.whisperModel, width: 140)
            desktopLabeledField("Qwen / MLX Model", text: $viewModel.onDeviceQwenModelID, width: 320)
            Toggle("Enable Qwen thinking", isOn: $viewModel.onDeviceThinkingEnabled)
                .toggleStyle(.switch)
                .frame(width: 180, alignment: .leading)
        }
    }

    private var desktopStatusStrip: some View {
        HStack(spacing: 12) {
            desktopStatusPill(title: "Mode", value: viewModel.executionMode.title, active: true)
            desktopStatusPill(title: "Service", value: viewModel.serviceStatusLabel, active: viewModel.serviceIsReady)
            desktopStatusPill(title: "Transcription", value: viewModel.transcriptionProvider, active: viewModel.serviceIsReady)
            desktopStatusPill(title: "LLM", value: viewModel.noteProvider, active: viewModel.serviceIsReady)
            Spacer()
            if viewModel.isBusy {
                ProgressView()
                    .controlSize(.small)
            }
            Text(viewModel.lastAction)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundStyle(.secondary)
        }
    }

    private var desktopTranscriptCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Transcript")
                .font(.system(size: 22, weight: .bold, design: .serif))
            TextEditor(text: $viewModel.transcript)
                .font(.system(size: 14, weight: .regular, design: .monospaced))
                .frame(minHeight: 180)
                .scrollContentBackground(.hidden)
                .padding(8)
                .background(Color.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .cardStyle()
    }

    private var desktopNoteCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(viewModel.noteIsEdited ? "Note" : "Draft Note")
                    .font(.system(size: 22, weight: .bold, design: .serif))
                if viewModel.noteIsEdited {
                    NoteMetaCapsule(text: "Edited")
                }
                if !viewModel.currentNoteRevisions.isEmpty {
                    NoteMetaCapsule(text: "\(viewModel.currentNoteRevisions.count) versions")
                }
                Spacer()
                if viewModel.currentNoteRevisions.count > 1 {
                    Button("Versions") {
                        presentVersionsSheet()
                    }
                    .buttonStyle(.borderless)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(AppTheme.accent)
                }
                if !viewModel.warnings.isEmpty {
                    Text(viewModel.warnings.joined(separator: " • "))
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundStyle(.secondary)
                }
            }

            TextEditor(text: noteDraftBinding)
                .focused($focusedField, equals: .noteDraft)
                .font(.system(size: 14, weight: .regular, design: .default))
                .frame(minHeight: 240)
                .scrollContentBackground(.hidden)
                .padding(8)
                .background(Color.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .cardStyle()
    }

    private var desktopLogCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Run Log")
                .font(.system(size: 18, weight: .bold, design: .serif))
            ScrollView {
                Text(viewModel.logs.joined(separator: "\n"))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .font(.system(size: 12, weight: .regular, design: .monospaced))
                    .textSelection(.enabled)
            }
            .frame(minHeight: 140)
            .padding(10)
            .background(Color.black.opacity(0.8), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .foregroundStyle(Color.green.opacity(0.92))
        }
        .cardStyle()
    }

    private func desktopLabeledField(_ title: String, text: Binding<String>, width: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundStyle(.secondary)
            TextField(title, text: text)
                .textFieldStyle(.roundedBorder)
                .frame(width: width)
        }
    }

    private func desktopStatusPill(title: String, value: String, active: Bool) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(active ? Color.green.opacity(0.14) : Color.gray.opacity(0.14), in: Capsule())
    }

    private var cardSurfaceBackground: some View {
        RoundedRectangle(cornerRadius: 20, style: .continuous)
            .fill(AppTheme.card.opacity(0.95))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(AppTheme.stroke.opacity(0.9), lineWidth: 1)
            }
    }

#if os(iOS)
    private var usesPhoneLayout: Bool {
        horizontalSizeClass == .compact
    }

    private var phoneLayout: some View {
        NavigationStack {
            ZStack {
                phoneBackground
                    .ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 20) {
                        phoneRecorderSurface
                        phoneResultsSurface
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 20)
                    .padding(.top, 16)
                    .padding(.bottom, 24)
                }
                .scrollDismissesKeyboard(.interactively)
                .simultaneousGesture(
                    TapGesture().onEnded {
                        dismissEditorKeyboard()
                    }
                )

                if viewModel.shouldShowBusyOverlay {
                    phoneLoadingOverlay
                }
            }
            .navigationTitle("Scribe")
            .navigationBarTitleDisplayMode(.inline)
            .tint(AppTheme.accent)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showingHistoryLibrary = true
                    } label: {
                        Image(systemName: "clock.arrow.circlepath")
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 14) {
                        if hasEncounterOutput {
                            Button {
                                presentExportSheet()
                            } label: {
                                Image(systemName: "square.and.arrow.up")
                            }
                        }

                        Button {
                            showingPhoneSettings = true
                        } label: {
                            Image(systemName: "gearshape")
                        }
                    }
                }
            }
            .sheet(isPresented: $showingPhoneSettings) {
                phoneSettingsSheet
            }
            .sheet(isPresented: $showingProcessingChoice) {
                phoneProcessingSheet
            }
            .sheet(isPresented: $showingPrivacyNotice) {
                phonePrivacyNoticeSheet
            }
            .alert("Download local models?", isPresented: $showingLocalModelDownloadNotice) {
                Button("Continue") {
                    acceptedLocalModelDownloadNotice = true
                    showingProcessingChoice = false
                    Task {
                        await processPendingPhoneRecording(route: .local)
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("The default on-device setup downloads roughly 3 GB on first use. Keep the iPhone on Wi-Fi and power while Whisper and Qwen finish downloading.")
            }
            .onAppear {
                if launchContext.isScreenshotMode {
                    acceptedPrivacyNotice = true
                } else if !acceptedPrivacyNotice {
                    showingPrivacyNotice = true
                }
            }
        }
    }

    private var phoneProcessingSheet: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                ScribeLogoMark(size: 52, accent: AppTheme.accent)

                Text("Process recording")
                    .font(.system(size: 24, weight: .semibold, design: .default))
                    .foregroundStyle(AppTheme.ink)

                Text("Cloud is the default. Choose local only when you want the note to stay on this iPhone.")
                    .font(.system(size: 15, weight: .regular, design: .default))
                    .foregroundStyle(AppTheme.muted)

                Button {
                    showingProcessingChoice = false
                    Task {
                        await processPendingPhoneRecording(route: .cloud)
                    }
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Use Cloud")
                            .font(.system(size: 17, weight: .semibold, design: .default))
                            .foregroundStyle(AppTheme.paper)
                        Text("Default route: Eir servers in Sweden with zero Eir retention. Berget AI runs transcription and drafting.")
                            .font(.system(size: 13, weight: .regular, design: .default))
                            .foregroundStyle(AppTheme.paper.opacity(0.82))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)

                Button {
                    if acceptedLocalModelDownloadNotice {
                        showingProcessingChoice = false
                        Task {
                            await processPendingPhoneRecording(route: .local)
                        }
                    } else {
                        showingLocalModelDownloadNotice = true
                    }
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Use Local on iPhone")
                            .font(.system(size: 17, weight: .semibold, design: .default))
                            .foregroundStyle(AppTheme.ink)
                        Text("Download models if needed, transcribe on-device, then draft locally.")
                            .font(.system(size: 13, weight: .regular, design: .default))
                            .foregroundStyle(AppTheme.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.bordered)
                .tint(AppTheme.accentSoft)

                Spacer()
            }
            .padding(24)
            .background(AppTheme.sheetBackground.ignoresSafeArea())
            .navigationTitle("Recording")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") {
                        showingProcessingChoice = false
                        pendingRecordedAudioURL = nil
                    }
                }
            }
        }
        .presentationDetents([.height(280)])
    }

    private var phonePrivacyNoticeSheet: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 18) {
                    ScribeLogoMark(size: 56, accent: AppTheme.accent)

                    Text("Privacy and clinical safety")
                        .font(.system(size: 24, weight: .semibold, design: .default))
                        .foregroundStyle(AppTheme.ink)

                    phoneNoticeBlock(
                        title: "Clinician review is required",
                        body: "This app drafts notes for clinician review. It must not be used as an autonomous diagnostic or treatment system."
                    )
                    phoneNoticeBlock(
                        title: "Cloud mode uploads audio",
                        body: "The default cloud route sends the recording to Eir-managed servers in Sweden. Those servers are configured for zero Eir-side retention, and Berget AI runs transcription and note inference."
                    )
                    phoneNoticeBlock(
                        title: "Local mode downloads models",
                        body: "The first on-device run downloads Whisper and Qwen model files to the iPhone. The default setup is roughly 3 GB."
                    )
                    phoneNoticeBlock(
                        title: "Use only with appropriate consent",
                        body: "Only record and process encounters when you have a lawful basis and the patient workflow permits it."
                    )

                    Button("Open privacy policy") {
                        showingPrivacyNotice = false
                        showingPrivacyPolicy = true
                    }
                    .buttonStyle(.bordered)
                    .tint(AppTheme.accent)
                }
                .padding(24)
            }
            .background(AppTheme.sheetBackground.ignoresSafeArea())
            .navigationTitle("Before you use it")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(acceptedPrivacyNotice ? "Done" : "I Understand") {
                        acceptedPrivacyNotice = true
                        showingPrivacyNotice = false
                    }
                }
            }
        }
        .interactiveDismissDisabled(!acceptedPrivacyNotice)
    }

    private var phoneRecorderSurface: some View {
        VStack(spacing: 24) {
            ScribeLogoMark(
                size: recorder.isRecording ? 70 : 64,
                accent: recorder.isRecording ? AppTheme.recording : AppTheme.accent
            )

            Text(recorder.isRecording ? recorder.elapsedLabel : phoneIdleLabel)
                .font(.system(size: recorder.isRecording ? 42 : 24, weight: .regular, design: .rounded))
                .foregroundStyle(AppTheme.ink)

            Button {
                Task {
                    await handlePhoneRecordButton()
                }
            } label: {
                ZStack {
                    Circle()
                        .fill((recorder.isRecording ? AppTheme.recording : AppTheme.accent).opacity(0.13))
                        .frame(width: 228, height: 228)

                    Circle()
                        .fill(AppTheme.card)
                        .frame(width: 180, height: 180)
                        .overlay {
                            Circle()
                                .stroke(AppTheme.stroke.opacity(0.85), lineWidth: 1.5)
                        }

                    Circle()
                        .fill(recorder.isRecording ? AppTheme.recording : AppTheme.ink)
                        .frame(width: 112, height: 112)
                        .overlay {
                            Image(systemName: recorder.isRecording ? "stop.fill" : "mic.fill")
                                .font(.system(size: 36, weight: .semibold))
                                .foregroundStyle(AppTheme.paper)
                        }
                }
            }
            .buttonStyle(.plain)
            .disabled(viewModel.isBusy && !recorder.isRecording)

            VStack(spacing: 6) {
                Text(phonePrimaryLabel)
                    .font(.system(size: 20, weight: .semibold, design: .default))
                    .foregroundStyle(AppTheme.ink)

                Text(phoneSecondaryLabel)
                    .font(.system(size: 14, weight: .regular, design: .default))
                    .foregroundStyle(AppTheme.muted)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 260)
            }

            if let recorderMessage = recorder.lastErrorMessage {
                Text(recorderMessage)
                    .font(.system(size: 13, weight: .medium, design: .default))
                    .foregroundStyle(AppTheme.recording)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 280)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
        .padding(.bottom, 6)
    }

    private var phoneResultsSurface: some View {
        VStack(spacing: 12) {
            if !viewModel.noteDraft.isEmpty {
                phoneNoteEditorCard
            } else {
                phoneEmptyStateCard
            }

            if !viewModel.transcript.isEmpty {
                phoneOutputCard(
                    title: "Transcript",
                    body: viewModel.transcript,
                    monospace: true
                )
            }

            if !viewModel.warnings.isEmpty {
                phoneWarningsCard
            }
        }
    }

    #if os(iOS)
    private var phonePrivacyPolicySheet: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 18) {
                    ScribeLogoMark(size: 56, accent: AppTheme.accent)

                    Text("\(AppBrand.displayName) privacy policy")
                        .font(.system(size: 24, weight: .semibold, design: .default))
                        .foregroundStyle(AppTheme.ink)

                    phoneNoticeBlock(
                        title: "What the app processes",
                        body: "The app can process encounter audio, generated transcripts, note drafts, note edits, and app settings. Local mode keeps the workflow on-device after model download. The default cloud route uses Eir-managed servers in Sweden with zero Eir retention, and Berget AI performs transcription and note inference."
                    )
                    phoneNoticeBlock(
                        title: "Where data is stored",
                        body: "Saved notes and local model settings are stored on this device. API keys and backend tokens are stored in the iPhone Keychain. Exported note files and copied journal text remain wherever you share or paste them."
                    )
                    phoneNoticeBlock(
                        title: "Who controls retention",
                        body: "If you use this app inside a healthcare organization, that organization is responsible for the retention policy, lawful basis, access controls, and any deletion workflow for patient data."
                    )
                    phoneNoticeBlock(
                        title: "Clinical responsibility",
                        body: "Draft notes are assistive output only. A licensed clinician must review, edit, and sign off before the note is entered into the medical record."
                    )

                    if let privacyPolicyURL {
                        Link("Open hosted privacy policy", destination: privacyPolicyURL)
                            .font(.system(size: 15, weight: .semibold, design: .default))
                            .foregroundStyle(AppTheme.accent)
                    }

                    if let supportURL {
                        Link("Open support", destination: supportURL)
                            .font(.system(size: 15, weight: .semibold, design: .default))
                            .foregroundStyle(AppTheme.accent)
                    }
                }
                .padding(24)
            }
            .background(AppTheme.sheetBackground.ignoresSafeArea())
            .navigationTitle("Privacy Policy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        showingPrivacyPolicy = false
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
    #endif

    private var phoneEmptyStateCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("No note yet")
                .font(.system(size: 17, weight: .semibold, design: .default))
                .foregroundStyle(AppTheme.ink)
            Text("Record a visit. When you stop, cloud is the default and local stays opt-in.")
                .font(.system(size: 14, weight: .regular, design: .default))
                .foregroundStyle(AppTheme.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(cardSurfaceBackground)
    }

    private var phoneNoteEditorCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Text(viewModel.noteIsEdited ? "Note" : "Draft Note")
                    .font(.system(size: 17, weight: .semibold, design: .default))
                    .foregroundStyle(AppTheme.ink)

                if viewModel.noteIsEdited {
                    NoteMetaCapsule(text: "Edited")
                }

                if !viewModel.currentNoteRevisions.isEmpty {
                    NoteMetaCapsule(text: "\(viewModel.currentNoteRevisions.count) versions")
                }

                Spacer()

                if viewModel.currentNoteRevisions.count > 1 {
                    Button("Versions") {
                        presentVersionsSheet()
                    }
                    .buttonStyle(.plain)
                    .font(.system(size: 13, weight: .semibold, design: .default))
                    .foregroundStyle(AppTheme.accent)
                }
            }

            TextEditor(text: noteDraftBinding)
                .focused($focusedField, equals: .noteDraft)
                .font(.system(size: 15, weight: .regular, design: .default))
                .foregroundStyle(AppTheme.ink)
                .frame(minHeight: 220)
                .scrollContentBackground(.hidden)
                .background(Color.clear)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(cardSurfaceBackground)
    }

    private func phoneOutputCard(title: String, body: String, monospace: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(size: 17, weight: .semibold, design: .default))
                .foregroundStyle(AppTheme.ink)

            Text(body)
                .font(
                    monospace
                    ? .system(size: 14, weight: .regular, design: .monospaced)
                    : .system(size: 15, weight: .regular, design: .default)
                )
                .foregroundStyle(AppTheme.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
                .textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(cardSurfaceBackground)
    }

    private var phoneWarningsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Review")
                .font(.system(size: 17, weight: .semibold, design: .default))
                .foregroundStyle(AppTheme.ink)

            ForEach(viewModel.warnings, id: \.self) { warning in
                Text(warning)
                    .font(.system(size: 14, weight: .regular, design: .default))
                    .foregroundStyle(AppTheme.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(cardSurfaceBackground)
    }

    private var phoneLoadingOverlay: some View {
        ZStack {
            AppTheme.ink.opacity(0.14)
                .ignoresSafeArea()

            VStack(spacing: 12) {
                ProgressView()
                    .controlSize(.large)
                    .tint(AppTheme.accent)
                Text(viewModel.activityTitle)
                    .font(.system(size: 18, weight: .semibold, design: .default))
                    .foregroundStyle(AppTheme.ink)
                Text(viewModel.activityDetail)
                    .font(.system(size: 14, weight: .regular, design: .default))
                    .foregroundStyle(AppTheme.muted)
                    .multilineTextAlignment(.center)
            }
            .padding(24)
            .frame(maxWidth: 280)
            .background(AppTheme.card.opacity(0.96), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(AppTheme.stroke, lineWidth: 1)
            }
        }
    }

    private var phoneSettingsSheet: some View {
        NavigationStack {
            Form {
                Section("Documentation") {
                    Picker("Note Style", selection: $viewModel.noteStyle) {
                        ForEach(NoteStyle.allCases, id: \.rawValue) { style in
                            Text(style.title).tag(style)
                        }
                    }
                }

                Section("Language") {
                    TextField("Language", text: $viewModel.language)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Locale", text: $viewModel.locale)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Country", text: $viewModel.country)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                Section("Cloud") {
                    TextField("Backend URL", text: $viewModel.backendURLString)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                        .textContentType(.URL)

                    Text("Default cloud processing uses Eir servers in Sweden with zero Eir-side data retention. On first use, the app quietly provisions a per-device trial token from Eir. Berget AI handles transcription and note inference.")
                        .font(.system(size: 12, weight: .regular, design: .default))
                        .foregroundStyle(.secondary)

                    SecureField("Operator Backend Token (advanced)", text: $backendAPIToken)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .onChange(of: backendAPIToken) { _, newValue in
                            KeychainSecretStore.save(
                                newValue.trimmingCharacters(in: .whitespacesAndNewlines),
                                account: KeychainSecretStore.backendAPITokenAccount
                            )
                        }

                    Toggle("Use your own Berget API key", isOn: $useDirectBergetKey)

                    if useDirectBergetKey {
                        SecureField("Berget API Key", text: $directBergetAPIKey)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .onChange(of: directBergetAPIKey) { _, newValue in
                                KeychainSecretStore.save(
                                    newValue.trimmingCharacters(in: .whitespacesAndNewlines),
                                    account: KeychainSecretStore.bergetAPIKeyAccount
                                )
                            }

                        Text("Stored in the iPhone Keychain and sent directly to api.berget.ai, not through the Eir backend.")
                            .font(.system(size: 12, weight: .regular, design: .default))
                            .foregroundStyle(.secondary)
                    } else {
                        Text("Cloud processing uses your configured Eir backend unless you opt in to a direct Berget key.")
                            .font(.system(size: 12, weight: .regular, design: .default))
                            .foregroundStyle(.secondary)
                    }

                    Text("Use HTTPS for production backends. Plain HTTP is only accepted for trusted local-network addresses.")
                        .font(.system(size: 12, weight: .regular, design: .default))
                        .foregroundStyle(.secondary)
                }

                Section("Local on iPhone") {
                    TextField("Whisper Model", text: $viewModel.whisperModel)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Qwen / MLX Model", text: $viewModel.onDeviceQwenModelID)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Toggle("Enable Qwen thinking", isOn: $viewModel.onDeviceThinkingEnabled)

                    Text(
                        viewModel.onDeviceThinkingEnabled
                        ? "Choose local only after recording. Thinking mode can improve deliberation, but it is slower and uses more tokens."
                        : "Choose local only after recording. Qwen thinking stays off by default for faster local drafts."
                    )
                        .font(.system(size: 12, weight: .regular, design: .default))
                        .foregroundStyle(.secondary)

                    Text("The default local setup downloads roughly 3 GB on first use.")
                        .font(.system(size: 12, weight: .regular, design: .default))
                        .foregroundStyle(.secondary)
                }

                Section("Privacy & Safety") {
                    Button("Review notice") {
                        showingPhoneSettings = false
                        showingPrivacyNotice = true
                    }

                    Button("Privacy policy") {
                        showingPhoneSettings = false
                        showingPrivacyPolicy = true
                    }

                    if let supportURL {
                        Link("Support", destination: supportURL)
                    }

                    Text("Cloud mode sends health data off-device. Local mode stores model files on this iPhone.")
                        .font(.system(size: 12, weight: .regular, design: .default))
                        .foregroundStyle(.secondary)
                }

                Section("Actions") {
                    Button("Import Existing Audio") {
                        showingPhoneSettings = false
                        importingAudio = true
                    }

                    Button("Clear Transcript and Note", role: .destructive) {
                        viewModel.clearEncounterOutput()
                    }
                }

                if !viewModel.logs.isEmpty {
                    Section("Run Log") {
                        Text(viewModel.logs.joined(separator: "\n"))
                            .font(.system(size: 12, weight: .regular, design: .monospaced))
                            .textSelection(.enabled)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        showingPhoneSettings = false
                    }
                }
            }
        }
        .presentationDetents([.large])
    }

    private var phoneBackground: some View {
        ZStack {
            LinearGradient(
                colors: [AppTheme.backgroundTop, AppTheme.backgroundBottom],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            Circle()
                .fill(AppTheme.paper.opacity(0.5))
                .frame(width: 240, height: 240)
                .offset(x: 128, y: -246)

            Circle()
                .fill(AppTheme.accent.opacity(0.08))
                .frame(width: 180, height: 180)
                .offset(x: 142, y: 298)

            Circle()
                .fill(AppTheme.card.opacity(0.65))
                .frame(width: 160, height: 160)
                .offset(x: -132, y: 314)
        }
    }

    private func phoneNoticeBlock(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 16, weight: .semibold, design: .default))
                .foregroundStyle(AppTheme.ink)
            Text(body)
                .font(.system(size: 14, weight: .regular, design: .default))
                .foregroundStyle(AppTheme.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(cardSurfaceBackground)
    }

    private var phonePrimaryLabel: String {
        if viewModel.isBusy {
            return viewModel.activityTitle
        }
        if recorder.isRecording {
            return "Recording"
        }
        return "Tap to record"
    }

    private var phoneIdleLabel: String {
        if viewModel.isBusy {
            return "Working"
        }
        return "Ready"
    }

    private var phoneSecondaryLabel: String {
        if recorder.isRecording {
            return "Tap stop when the visit is finished."
        }
        if viewModel.isBusy {
            return viewModel.activityDetail
        }
        return "Cloud is the default after recording."
    }

    private func handlePhoneRecordButton() async {
        guard acceptedPrivacyNotice else {
            showingPrivacyNotice = true
            return
        }

        if recorder.isRecording {
            do {
                let outputURL = try await recorder.stop()
                viewModel.noteCaptureSaved(fileName: outputURL.lastPathComponent)
                pendingRecordedAudioURL = outputURL
                showingProcessingChoice = true
            } catch {
                viewModel.presentInlineMessage("Failed to stop recording: \(error.localizedDescription)")
            }
            return
        }

        do {
            try await recorder.start()
            viewModel.noteCaptureStarted()
        } catch {
            viewModel.presentInlineMessage("Failed to start recording: \(error.localizedDescription)")
        }
    }

    private func processPendingPhoneRecording(route: RecordedEncounterProcessingRoute) async {
        guard let url = pendingRecordedAudioURL else { return }
        pendingRecordedAudioURL = nil
        await viewModel.analyzeRecordedAudio(
            at: url,
            route: route,
            directBergetAPIKey: useDirectBergetKey ? directBergetAPIKey : ""
        )
    }
#endif

    private var primaryActionTitle: String {
        viewModel.serviceIsReady ? viewModel.executionMode.deactivationTitle : viewModel.executionMode.activationTitle
    }

    private var hasEncounterOutput: Bool {
        !viewModel.noteDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || !viewModel.transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var historySheet: some View {
        NavigationStack {
            Group {
                if viewModel.savedEncounters.isEmpty {
                    ContentUnavailableView(
                        "No saved notes",
                        systemImage: "clock.arrow.circlepath",
                        description: Text("Finished notes are saved automatically and will appear here.")
                    )
                } else {
                    historyListView
                }
            }
            .navigationTitle("Saved Notes")
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
#if os(iOS)
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        showingHistoryLibrary = false
                    }
                }
#else
                ToolbarItem {
                    Button("Done") {
                        showingHistoryLibrary = false
                    }
                }
#endif
            }
        }
        .presentationDetents([.medium, .large])
    }

    private var historyListView: some View {
        List {
            Section {
                ForEach(viewModel.savedEncounters) { encounter in
                    Button {
                        viewModel.loadSavedEncounter(encounter)
                        showingHistoryLibrary = false
                    } label: {
                        SavedEncounterRow(encounter: encounter)
                    }
                    .buttonStyle(.plain)
                    .swipeActions {
                        Button(role: .destructive) {
                            viewModel.deleteSavedEncounter(encounter)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
            } footer: {
                Text("Tap a note to reopen it. Export from the main screen when you need to share or paste it.")
            }
        }
#if os(iOS)
        .listStyle(.insetGrouped)
#else
        .listStyle(.inset)
#endif
    }

    private var exportSheet: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 20) {
                    if let artifacts = exportArtifacts {
                        ScribeLogoMark(size: 52, accent: AppTheme.accent)
                            .padding(.top, 8)

                        Text("Export note")
                            .font(.system(size: 24, weight: .semibold, design: .default))
                            .foregroundStyle(AppTheme.ink)

                        Text("For Swedish journals, the fastest path is usually to copy the plain journal text and paste it into the note editor.")
                            .font(.system(size: 15, weight: .regular, design: .default))
                            .foregroundStyle(AppTheme.muted)

                        Button {
                            ClipboardWriter.copy(artifacts.journalCopyText)
                            showExportStatus("Copied to clipboard")
                        } label: {
                            ExportActionRow(
                                title: "Copy for Journal",
                                subtitle: "Best for Cosmic, TakeCare, Melior, and other paste-based workflows.",
                                systemImage: exportStatusMessage.isEmpty ? "doc.on.doc" : "checkmark.circle.fill"
                            )
                        }
                        .buttonStyle(.plain)

                        if !exportStatusMessage.isEmpty {
                            Label(exportStatusMessage, systemImage: "checkmark.circle.fill")
                                .font(.system(size: 13, weight: .medium, design: .default))
                                .foregroundStyle(AppTheme.accent)
                                .padding(.leading, 4)
                        }

                        if let noteFileURL = artifacts.noteFileURL {
                            ShareLink(item: noteFileURL) {
                                ExportActionRow(
                                    title: "Share Note Text",
                                    subtitle: "Export a plain text file with the finished note.",
                                    systemImage: "square.and.arrow.up"
                                )
                            }
                            .buttonStyle(.plain)
                        } else {
                            ExportActionRow(
                                title: "Share Note Text",
                                subtitle: "Plain text file export isn't available right now.",
                                systemImage: "square.and.arrow.up"
                            )
                            .opacity(0.45)
                        }

                        if let fhirFileURL = artifacts.fhirFileURL {
                            ShareLink(item: fhirFileURL) {
                                ExportActionRow(
                                    title: "Share FHIR JSON",
                                    subtitle: "Structured `DocumentReference` for future integrations.",
                                    systemImage: "curlybraces"
                                )
                            }
                            .buttonStyle(.plain)
                        } else {
                            ExportActionRow(
                                title: "Share FHIR JSON",
                                subtitle: "FHIR file export isn't available right now.",
                                systemImage: "curlybraces"
                            )
                            .opacity(0.45)
                        }

                        if !artifacts.warnings.isEmpty {
                            ForEach(artifacts.warnings, id: \.self) { warning in
                                Text(warning)
                                    .font(.system(size: 13, weight: .regular, design: .default))
                                    .foregroundStyle(AppTheme.muted)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    } else {
                        ContentUnavailableView(
                            "Export unavailable",
                            systemImage: "square.and.arrow.up",
                            description: Text(exportErrorMessage.isEmpty ? "There is nothing to export yet." : exportErrorMessage)
                        )
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 28)
            }
            .background(AppTheme.sheetBackground.ignoresSafeArea())
            .navigationTitle("Export")
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
#if os(iOS)
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        showingExportSheet = false
                    }
                }
#else
                ToolbarItem {
                    Button("Done") {
                        showingExportSheet = false
                    }
                }
#endif
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var versionsSheet: some View {
        NavigationStack {
            Group {
                if viewModel.currentNoteRevisions.isEmpty {
                    ContentUnavailableView(
                        "No versions yet",
                        systemImage: "clock.arrow.circlepath",
                        description: Text("Generate or edit a note first.")
                    )
                } else {
                    ScrollView(showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 18) {
                            if let selectedRevision = selectedRevision {
                                versionSummaryCard(for: selectedRevision)
                                versionDiffCard(for: selectedRevision)
                                versionBodyCard(for: selectedRevision)
                            }

                            VStack(alignment: .leading, spacing: 12) {
                                Text("Timeline")
                                    .font(.system(size: 18, weight: .semibold, design: .default))
                                    .foregroundStyle(AppTheme.ink)

                                ForEach(Array(viewModel.currentNoteRevisions.enumerated()), id: \.element.id) { index, revision in
                                    Button {
                                        selectedRevisionID = revision.id
                                    } label: {
                                        VersionRow(
                                            revision: revision,
                                            isSelected: selectedRevisionID == revision.id,
                                            isCurrent: index == viewModel.currentNoteRevisions.count - 1
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, 16)
                        .padding(.bottom, 28)
                    }
                    .background(AppTheme.sheetBackground.ignoresSafeArea())
                }
            }
            .navigationTitle("Versions")
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
#if os(iOS)
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") {
                        showingVersionsSheet = false
                    }
                }
#else
                ToolbarItem {
                    Button("Done") {
                        showingVersionsSheet = false
                    }
                }
#endif
                if let selectedRevision,
                   selectedRevisionID != viewModel.currentNoteRevisions.last?.id {
#if os(iOS)
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Restore") {
                            viewModel.restoreCurrentNoteRevision(selectedRevision.id)
                            selectedRevisionID = viewModel.currentNoteRevisions.last?.id
                        }
                    }
#else
                    ToolbarItem {
                        Button("Restore") {
                            viewModel.restoreCurrentNoteRevision(selectedRevision.id)
                            selectedRevisionID = viewModel.currentNoteRevisions.last?.id
                        }
                    }
#endif
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func performPrimaryAction() {
        Task {
            if viewModel.serviceIsReady {
                await viewModel.stopLocalStack()
            } else {
                switch viewModel.executionMode {
                case .localStack:
                    await viewModel.startLocalStack()
                case .remoteBackend:
                    await viewModel.connectToConfiguredBackend()
                case .onDevice:
                    await viewModel.prepareOnDevice()
                }
            }
        }
    }

    private func presentExportSheet() {
        exportStatusMessage = ""
        exportStatusTask?.cancel()
        exportStatusTask = nil

        do {
            exportArtifacts = try viewModel.exportArtifacts()
            exportErrorMessage = ""
        } catch {
            exportArtifacts = nil
            exportErrorMessage = error.localizedDescription
        }

        showingExportSheet = true
    }

    private func presentVersionsSheet() {
        viewModel.capturePendingNoteRevisionIfNeeded()
        selectedRevisionID = viewModel.currentNoteRevisions.last?.id
        showingVersionsSheet = true
    }

    private func showExportStatus(_ message: String) {
        exportStatusTask?.cancel()
        exportStatusMessage = message
        exportStatusTask = Task {
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                exportStatusMessage = ""
            }
        }
    }

    private var noteDraftBinding: Binding<String> {
        Binding(
            get: { viewModel.noteDraft },
            set: { viewModel.updateNoteDraftFromEditor($0) }
        )
    }

    private func dismissEditorKeyboard() {
        focusedField = nil
    }

    private func applyLaunchPresentationIfNeeded() {
        guard !appliedLaunchPresentation else {
            return
        }

        appliedLaunchPresentation = true

        switch launchContext.screenshotScenario {
        case .history:
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(1))
                showingHistoryLibrary = true
            }
        case .export:
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(1))
                presentExportSheet()
            }
        case .versions:
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(1))
                presentVersionsSheet()
            }
        case .processing, .main, .none:
            break
        }
    }

    #if os(iOS)
    private var privacyPolicyURL: URL? {
        configuredURL(forInfoDictionaryKey: "EIRPrivacyPolicyURL")
    }

    private var supportURL: URL? {
        configuredURL(forInfoDictionaryKey: "EIRSupportURL")
    }

    private func configuredURL(forInfoDictionaryKey key: String) -> URL? {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: key) as? String else {
            return nil
        }

        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return nil
        }

        return URL(string: trimmed)
    }
    #endif

    private var selectedRevision: SavedEncounterRevision? {
        if let selectedRevisionID,
           let revision = viewModel.currentNoteRevisions.first(where: { $0.id == selectedRevisionID }) {
            return revision
        }

        return viewModel.currentNoteRevisions.last
    }

    private func versionSummaryCard(for revision: SavedEncounterRevision) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Text(revision.kind.title)
                    .font(.system(size: 20, weight: .semibold, design: .default))
                    .foregroundStyle(AppTheme.ink)
                NoteMetaCapsule(text: versionDateFormatter.string(from: revision.createdAt))
                if selectedRevisionID == viewModel.currentNoteRevisions.last?.id {
                    NoteMetaCapsule(text: "Current")
                }
            }

            Text("Open any version to inspect it. Restore when you want to roll the note back.")
                .font(.system(size: 14, weight: .regular, design: .default))
                .foregroundStyle(AppTheme.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(cardSurfaceBackground)
    }

    private func versionDiffCard(for revision: SavedEncounterRevision) -> some View {
        let changes = changesForSelectedRevision(revision)

        return VStack(alignment: .leading, spacing: 12) {
            Text(changes.title)
                .font(.system(size: 17, weight: .semibold, design: .default))
                .foregroundStyle(AppTheme.ink)

            if changes.entries.isEmpty {
                Text("No text changes in this snapshot.")
                    .font(.system(size: 14, weight: .regular, design: .default))
                    .foregroundStyle(AppTheme.muted)
            } else {
                ForEach(changes.entries) { entry in
                    HStack(alignment: .top, spacing: 10) {
                        Text(entry.kind.symbol)
                            .font(.system(size: 14, weight: .bold, design: .monospaced))
                            .foregroundStyle(entry.kind.color)
                        Text(entry.text)
                            .font(.system(size: 14, weight: .regular, design: .default))
                            .foregroundStyle(AppTheme.ink)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(cardSurfaceBackground)
    }

    private func versionBodyCard(for revision: SavedEncounterRevision) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Version text")
                .font(.system(size: 17, weight: .semibold, design: .default))
                .foregroundStyle(AppTheme.ink)

            Text(revision.noteDraft)
                .font(.system(size: 15, weight: .regular, design: .default))
                .foregroundStyle(AppTheme.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
                .textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(cardSurfaceBackground)
    }

    private func changesForSelectedRevision(_ revision: SavedEncounterRevision) -> VersionChangeSet {
        guard let selectedIndex = viewModel.currentNoteRevisions.firstIndex(where: { $0.id == revision.id }) else {
            return VersionChangeSet(title: "Changes", entries: [])
        }

        let previousText = selectedIndex > 0 ? viewModel.currentNoteRevisions[selectedIndex - 1].noteDraft : ""
        let entries = lineChanges(from: previousText, to: revision.noteDraft)
        let title = selectedIndex == 0 ? "Generated note" : "Changes from previous version"
        return VersionChangeSet(title: title, entries: entries)
    }

    private func lineChanges(from previous: String, to current: String) -> [VersionChangeEntry] {
        let previousLines = previous.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        let currentLines = current.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        let difference = currentLines.difference(from: previousLines)
        var entries: [VersionChangeEntry] = []

        for change in difference {
            switch change {
            case .remove(_, let element, _):
                let trimmed = element.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else { continue }
                entries.append(VersionChangeEntry(kind: .removed, text: trimmed))
            case .insert(_, let element, _):
                let trimmed = element.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else { continue }
                entries.append(VersionChangeEntry(kind: .added, text: trimmed))
            }
        }

        return Array(entries.prefix(24))
    }

    private var versionDateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }
}

private enum AppBrand {
    static let displayName = "Eir Scribe"
}

struct AppLaunchContext {
    let screenshotScenario: ScreenshotScenario?

    static var current: AppLaunchContext {
        AppLaunchContext(
            screenshotScenario: ScreenshotScenario.from(arguments: ProcessInfo.processInfo.arguments)
        )
    }

    var isScreenshotMode: Bool {
        screenshotScenario != nil
    }
}

enum ScreenshotScenario: String {
    case main
    case processing
    case history
    case export
    case versions

    static func from(arguments: [String]) -> ScreenshotScenario? {
        for argument in arguments {
            guard argument.hasPrefix("--screenshot-scene=") else {
                continue
            }

            let rawValue = String(argument.dropFirst("--screenshot-scene=".count))
            return ScreenshotScenario(rawValue: rawValue)
        }

        if arguments.contains("--app-store-screenshot") {
            return .main
        }

        return nil
    }
}

private enum AppTheme {
    static let backgroundTop = Color(red: 0.96, green: 0.92, blue: 0.86)
    static let backgroundBottom = Color(red: 0.90, green: 0.87, blue: 0.82)
    static let sheetBackground = Color(red: 0.97, green: 0.94, blue: 0.90)
    static let card = Color(red: 0.99, green: 0.97, blue: 0.94)
    static let paper = Color(red: 0.99, green: 0.96, blue: 0.92)
    static let stroke = Color(red: 0.87, green: 0.80, blue: 0.73)
    static let accent = Color(red: 0.79, green: 0.47, blue: 0.35)
    static let accentSoft = Color(red: 0.90, green: 0.79, blue: 0.70)
    static let recording = Color(red: 0.84, green: 0.41, blue: 0.31)
    static let ink = Color(red: 0.34, green: 0.24, blue: 0.20)
    static let muted = Color(red: 0.52, green: 0.42, blue: 0.36)
}

private struct ScribeLogoMark: View {
    let size: CGFloat
    let accent: Color

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
                .fill(AppTheme.paper.opacity(0.96))
                .frame(width: size, height: size)
                .overlay {
                    RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
                        .stroke(AppTheme.stroke.opacity(0.85), lineWidth: max(1, size * 0.018))
                }

            VStack(spacing: size * 0.08) {
                Circle()
                    .fill(accent)
                    .frame(width: size * 0.28, height: size * 0.28)

                RoundedRectangle(cornerRadius: size * 0.08, style: .continuous)
                    .fill(AppTheme.ink)
                    .frame(width: size * 0.14, height: size * 0.34)

                RoundedRectangle(cornerRadius: size * 0.03, style: .continuous)
                    .fill(AppTheme.stroke)
                    .frame(width: size * 0.36, height: size * 0.06)
            }
        }
        .shadow(color: AppTheme.ink.opacity(0.06), radius: size * 0.14, y: size * 0.06)
    }
}

private struct SavedEncounterRow: View {
    let encounter: SavedEncounter

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(encounter.title)
                    .font(.system(size: 16, weight: .semibold, design: .default))
                    .foregroundStyle(AppTheme.ink)
                    .lineLimit(2)

                Spacer()

                Text(Self.dateFormatter.string(from: encounter.createdAt))
                    .font(.system(size: 12, weight: .medium, design: .default))
                    .foregroundStyle(AppTheme.muted)
            }

            Text(encounter.previewText)
                .font(.system(size: 14, weight: .regular, design: .default))
                .foregroundStyle(AppTheme.muted)
                .lineLimit(3)

            HStack(spacing: 8) {
                NoteMetaCapsule(text: encounter.noteStyleValue.title)
                NoteMetaCapsule(text: encounter.sourceLabel)
                if encounter.isEdited {
                    NoteMetaCapsule(text: "Edited")
                }
                if encounter.versionCount > 1 {
                    NoteMetaCapsule(text: "\(encounter.versionCount) versions")
                }
            }
        }
        .padding(.vertical, 6)
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
}

private struct VersionChangeSet {
    let title: String
    let entries: [VersionChangeEntry]
}

private struct VersionChangeEntry: Identifiable {
    enum Kind {
        case added
        case removed

        var symbol: String {
            switch self {
            case .added:
                return "+"
            case .removed:
                return "-"
            }
        }

        var color: Color {
            switch self {
            case .added:
                return AppTheme.accent
            case .removed:
                return AppTheme.muted
            }
        }
    }

    let id = UUID()
    let kind: Kind
    let text: String
}

private struct VersionRow: View {
    let revision: SavedEncounterRevision
    let isSelected: Bool
    let isCurrent: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(revision.kind.title)
                    .font(.system(size: 15, weight: .semibold, design: .default))
                    .foregroundStyle(AppTheme.ink)
                if isCurrent {
                    NoteMetaCapsule(text: "Current")
                }
                Spacer()
                Text(Self.dateFormatter.string(from: revision.createdAt))
                    .font(.system(size: 12, weight: .medium, design: .default))
                    .foregroundStyle(AppTheme.muted)
            }

            Text(revision.previewText)
                .font(.system(size: 14, weight: .regular, design: .default))
                .foregroundStyle(AppTheme.muted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .lineLimit(3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(isSelected ? AppTheme.paper : AppTheme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(isSelected ? AppTheme.accent.opacity(0.65) : AppTheme.stroke, lineWidth: 1)
        }
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
}

private struct NoteMetaCapsule: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold, design: .rounded))
            .foregroundStyle(AppTheme.muted)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(AppTheme.paper.opacity(0.9), in: Capsule())
    }
}

private struct ExportActionRow: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: systemImage)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(AppTheme.accent)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 16, weight: .semibold, design: .default))
                    .foregroundStyle(AppTheme.ink)
                Text(subtitle)
                    .font(.system(size: 13, weight: .regular, design: .default))
                    .foregroundStyle(AppTheme.muted)
            }

            Spacer()
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(AppTheme.card.opacity(0.95))
                .overlay {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(AppTheme.stroke.opacity(0.9), lineWidth: 1)
                }
        )
    }
}

private extension View {
    func cardStyle() -> some View {
        self
            .padding(18)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}
