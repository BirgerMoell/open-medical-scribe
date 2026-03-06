#if os(iOS)
import AVFoundation
import Foundation

@MainActor
final class PhoneAudioRecorder: NSObject, ObservableObject, @preconcurrency AVAudioRecorderDelegate {
    @Published private(set) var isRecording = false
    @Published private(set) var elapsedTime: TimeInterval = 0
    @Published private(set) var lastErrorMessage: String?
    @Published private(set) var permissionDenied = false

    private var recorder: AVAudioRecorder?
    private var timer: Timer?
    private var startedAt: Date?

    var elapsedLabel: String {
        let totalSeconds = Int(elapsedTime.rounded(.down))
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    func start() async throws {
        clearError()
        try await ensureRecordPermission()

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .spokenAudio, options: [.defaultToSpeaker, .allowBluetooth])
        try session.setActive(true, options: [])

        let outputURL = Self.makeRecordingURL()
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
        ]

        let recorder = try AVAudioRecorder(url: outputURL, settings: settings)
        recorder.delegate = self
        recorder.isMeteringEnabled = true

        guard recorder.record() else {
            throw NSError(
                domain: "OpenMedicalScribeApple",
                code: 51,
                userInfo: [NSLocalizedDescriptionKey: "The recorder could not start."]
            )
        }

        self.recorder = recorder
        startedAt = Date()
        elapsedTime = 0
        isRecording = true
        startTimer()
    }

    func stop() async throws -> URL {
        guard let recorder else {
            throw NSError(
                domain: "OpenMedicalScribeApple",
                code: 52,
                userInfo: [NSLocalizedDescriptionKey: "There is no active recording to stop."]
            )
        }

        let outputURL = recorder.url
        recorder.stop()
        finishRecordingSession()

        do {
            try AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        } catch {
            lastErrorMessage = error.localizedDescription
        }

        return outputURL
    }

    func clearError() {
        lastErrorMessage = nil
        permissionDenied = false
    }

    func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: Error?) {
        if let error {
            lastErrorMessage = error.localizedDescription
        }
        finishRecordingSession()
    }

    func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        if !flag {
            lastErrorMessage = "The recording did not finish successfully."
        }
        finishRecordingSession()
    }

    private func ensureRecordPermission() async throws {
        let session = AVAudioSession.sharedInstance()

        let granted: Bool
        switch session.recordPermission {
        case .granted:
            granted = true
        case .denied:
            granted = false
        case .undetermined:
            granted = await withCheckedContinuation { continuation in
                session.requestRecordPermission { accepted in
                    continuation.resume(returning: accepted)
                }
            }
        @unknown default:
            granted = false
        }

        permissionDenied = !granted

        guard granted else {
            throw NSError(
                domain: "OpenMedicalScribeApple",
                code: 53,
                userInfo: [NSLocalizedDescriptionKey: "Microphone access is required to record a visit."]
            )
        }
    }

    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            guard let self, let startedAt = self.startedAt else { return }
            self.elapsedTime = Date().timeIntervalSince(startedAt)
        }
    }

    private func finishRecordingSession() {
        timer?.invalidate()
        timer = nil
        recorder = nil
        startedAt = nil
        isRecording = false
    }

    private static func makeRecordingURL() -> URL {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withDashSeparatorInDate, .withColonSeparatorInTime]
        let fileName = "EirScribe-\(formatter.string(from: Date()).replacingOccurrences(of: ":", with: "-")).m4a"
        return FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
    }
}
#endif
