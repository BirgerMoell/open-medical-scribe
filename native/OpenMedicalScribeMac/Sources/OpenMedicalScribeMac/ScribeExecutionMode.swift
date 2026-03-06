import Foundation

enum ScribeExecutionMode: String, CaseIterable, Identifiable {
    case onDevice
    case remoteBackend
    case localStack

    var id: String { rawValue }

    var title: String {
        switch self {
        case .onDevice:
            return "On Device"
        case .remoteBackend:
            return "Remote Backend"
        case .localStack:
            return "Mac Local Stack"
        }
    }

    var activationTitle: String {
        switch self {
        case .onDevice:
            return "Prepare On-Device"
        case .remoteBackend:
            return "Connect Backend"
        case .localStack:
            return "Start Local Stack"
        }
    }

    var deactivationTitle: String {
        switch self {
        case .onDevice:
            return "Reset On-Device"
        case .remoteBackend:
            return "Disconnect"
        case .localStack:
            return "Stop Local Stack"
        }
    }

    var subtitle: String {
        switch self {
        case .onDevice:
            return "Runs transcription locally and drafts notes on-device when Apple Intelligence is available."
        case .remoteBackend:
            return "Uses any reachable Eir Scribe-compatible backend."
        case .localStack:
            return "Launches the repository backend with whisper-onnx and Ollama on this Mac."
        }
    }

    static var availableModes: [ScribeExecutionMode] {
#if os(macOS)
        [.localStack, .remoteBackend]
#else
        [.onDevice, .remoteBackend]
#endif
    }
}
