import Foundation

struct LocalBackendConfiguration {
    let repoRoot: URL
    let ollamaModel: String
    let language: String
    let noteStyle: String

    let port: Int = 8799

    var baseURL: URL {
        URL(string: "http://127.0.0.1:\(port)")!
    }
}

actor LocalBackendManager {
#if os(macOS)
    private var process: Process?
    private var outputPipe: Pipe?
    private var errorPipe: Pipe?
#endif
    private(set) var baseURL: URL = URL(string: "http://127.0.0.1:8799")!

    func start(configuration: LocalBackendConfiguration) async throws {
#if os(macOS)
        if process != nil {
            return
        }

        baseURL = configuration.baseURL

        let task = Process()
        task.currentDirectoryURL = configuration.repoRoot
        task.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        task.arguments = ["node", "src/index.js"]

        var environment = ProcessInfo.processInfo.environment
        environment["PORT"] = String(configuration.port)
        environment["SCRIBE_MODE"] = "local"
        environment["ENABLE_WEB_UI"] = "false"
        environment["TRANSCRIPTION_PROVIDER"] = "whisper-onnx"
        environment["NOTE_PROVIDER"] = "ollama"
        environment["DEFAULT_NOTE_STYLE"] = configuration.noteStyle
        environment["DEFAULT_COUNTRY"] = configuration.language == "sv" ? "SE" : "US"
        environment["STREAMING_TRANSCRIPTION_PROVIDER"] = "whisper-stream"
        environment["STREAMING_WHISPER_LANGUAGE"] = configuration.language
        environment["OLLAMA_MODEL"] = configuration.ollamaModel
        environment["OLLAMA_TIMEOUT_MS"] = "180000"
        task.environment = environment

        let out = Pipe()
        let err = Pipe()
        task.standardOutput = out
        task.standardError = err
        outputPipe = out
        errorPipe = err

        try task.run()
        process = task

        try await waitUntilHealthy(baseURL: configuration.baseURL)
#else
        throw NSError(domain: "OpenMedicalScribeApple", code: 10, userInfo: [
            NSLocalizedDescriptionKey: "Local backend launch is only supported on macOS. Use a reachable backend URL on iPhone."
        ])
#endif
    }

    func stop() async {
#if os(macOS)
        process?.terminate()
        process = nil
        outputPipe = nil
        errorPipe = nil
#endif
    }

    func overrideBaseURL(_ url: URL) {
        baseURL = url
    }

    private func waitUntilHealthy(baseURL: URL) async throws {
        let deadline = Date().addingTimeInterval(120)
        while Date() < deadline {
            do {
                var request = URLRequest(url: baseURL.appending(path: "health"))
                request.timeoutInterval = 5
                let (_, response) = try await URLSession.shared.data(for: request)
                if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                    return
                }
            } catch {
                try? await Task.sleep(for: .milliseconds(800))
            }
        }

        throw NSError(domain: "OpenMedicalScribeMac", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "Timed out waiting for the local backend to become healthy."
        ])
    }
}
