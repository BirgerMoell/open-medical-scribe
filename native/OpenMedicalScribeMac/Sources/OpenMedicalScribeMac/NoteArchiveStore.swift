import Foundation

struct NoteArchiveStore {
    let fileURL: URL
    private let fileManager: FileManager

    init(
        fileURL: URL = Self.defaultFileURL,
        fileManager: FileManager = .default
    ) {
        self.fileURL = fileURL
        self.fileManager = fileManager
    }

    func load() -> [SavedEncounter] {
        let candidateURL = resolvedLoadURL()
        guard let data = try? Data(contentsOf: candidateURL) else {
            return []
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        guard let encounters = try? decoder.decode([SavedEncounter].self, from: data) else {
            return []
        }

        return encounters.sorted { $0.createdAt > $1.createdAt }
    }

    func save(_ encounters: [SavedEncounter]) throws {
        let directory = fileURL.deletingLastPathComponent()
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601

        let data = try encoder.encode(encounters.sorted { $0.createdAt > $1.createdAt })
        try data.write(to: fileURL, options: .atomic)
    }

    static var defaultFileURL: URL {
        let baseDirectory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return baseDirectory
            .appendingPathComponent("EirScribe", isDirectory: true)
            .appendingPathComponent("saved-encounters.json")
    }

    private func resolvedLoadURL() -> URL {
        if fileManager.fileExists(atPath: fileURL.path) {
            return fileURL
        }

        let legacyURL = fileURL
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("OpenMedicalScribe", isDirectory: true)
            .appendingPathComponent(fileURL.lastPathComponent)

        return legacyURL
    }
}
