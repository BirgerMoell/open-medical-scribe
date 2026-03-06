import Foundation

enum SavedEncounterRevisionKind: String, Codable, Equatable, Sendable {
    case generated
    case edited
    case restored

    var title: String {
        switch self {
        case .generated:
            return "Generated"
        case .edited:
            return "Edited"
        case .restored:
            return "Restored"
        }
    }
}

struct SavedEncounterRevision: Codable, Identifiable, Equatable, Sendable {
    let id: UUID
    let createdAt: Date
    let noteDraft: String
    let kind: SavedEncounterRevisionKind

    init(
        id: UUID = UUID(),
        createdAt: Date = Date(),
        noteDraft: String,
        kind: SavedEncounterRevisionKind
    ) {
        self.id = id
        self.createdAt = createdAt
        self.noteDraft = noteDraft
        self.kind = kind
    }

    var previewText: String {
        let collapsed = noteDraft
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !collapsed.isEmpty else {
            return "No preview available."
        }

        if collapsed.count <= 100 {
            return collapsed
        }

        let endIndex = collapsed.index(collapsed.startIndex, offsetBy: 97)
        return "\(collapsed[..<endIndex])..."
    }
}

struct SavedEncounter: Codable, Identifiable, Equatable, Sendable {
    let id: UUID
    let createdAt: Date
    let sourceFileName: String
    let noteStyle: String
    let language: String
    let locale: String
    let country: String
    let transcript: String
    let noteDraft: String
    let originalNoteDraft: String
    let isEdited: Bool
    let revisions: [SavedEncounterRevision]
    let warnings: [String]
    let transcriptionProvider: String
    let noteProvider: String

    init(
        id: UUID,
        createdAt: Date,
        sourceFileName: String,
        noteStyle: String,
        language: String,
        locale: String,
        country: String,
        transcript: String,
        noteDraft: String,
        originalNoteDraft: String? = nil,
        isEdited: Bool = false,
        revisions: [SavedEncounterRevision]? = nil,
        warnings: [String],
        transcriptionProvider: String,
        noteProvider: String
    ) {
        self.id = id
        self.createdAt = createdAt
        self.sourceFileName = sourceFileName
        self.noteStyle = noteStyle
        self.language = language
        self.locale = locale
        self.country = country
        self.transcript = transcript
        self.noteDraft = noteDraft
        self.originalNoteDraft = originalNoteDraft ?? noteDraft
        self.isEdited = isEdited
        self.revisions = Self.sanitizedRevisions(
            revisions,
            createdAt: createdAt,
            noteDraft: noteDraft,
            originalNoteDraft: self.originalNoteDraft,
            isEdited: isEdited
        )
        self.warnings = warnings
        self.transcriptionProvider = transcriptionProvider
        self.noteProvider = noteProvider
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        sourceFileName = try container.decode(String.self, forKey: .sourceFileName)
        noteStyle = try container.decode(String.self, forKey: .noteStyle)
        language = try container.decode(String.self, forKey: .language)
        locale = try container.decode(String.self, forKey: .locale)
        country = try container.decode(String.self, forKey: .country)
        transcript = try container.decode(String.self, forKey: .transcript)
        noteDraft = try container.decode(String.self, forKey: .noteDraft)
        originalNoteDraft = try container.decodeIfPresent(String.self, forKey: .originalNoteDraft) ?? noteDraft
        isEdited = try container.decodeIfPresent(Bool.self, forKey: .isEdited) ?? false
        revisions = Self.sanitizedRevisions(
            try container.decodeIfPresent([SavedEncounterRevision].self, forKey: .revisions),
            createdAt: createdAt,
            noteDraft: noteDraft,
            originalNoteDraft: originalNoteDraft,
            isEdited: isEdited
        )
        warnings = try container.decode([String].self, forKey: .warnings)
        transcriptionProvider = try container.decode(String.self, forKey: .transcriptionProvider)
        noteProvider = try container.decode(String.self, forKey: .noteProvider)
    }

    var noteStyleValue: NoteStyle {
        NoteStyle(rawValue: noteStyle) ?? .journal
    }

    var title: String {
        let candidate = noteDraft
            .split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty }

        if let candidate, !candidate.isEmpty {
            return candidate
        }

        return "\(noteStyleValue.title) Note"
    }

    var previewText: String {
        let source = noteDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? transcript
            : noteDraft
        let collapsed = source
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !collapsed.isEmpty else {
            return "No preview available."
        }

        if collapsed.count <= 120 {
            return collapsed
        }

        let endIndex = collapsed.index(collapsed.startIndex, offsetBy: 117)
        return "\(collapsed[..<endIndex])..."
    }

    var sourceLabel: String {
        let trimmed = sourceFileName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? transcriptionProvider : trimmed
    }

    var versionCount: Int {
        revisions.count
    }

    private static func sanitizedRevisions(
        _ revisions: [SavedEncounterRevision]?,
        createdAt: Date,
        noteDraft: String,
        originalNoteDraft: String,
        isEdited: Bool
    ) -> [SavedEncounterRevision] {
        if let revisions, !revisions.isEmpty {
            return revisions.sorted { $0.createdAt < $1.createdAt }
        }

        var fallback = [
            SavedEncounterRevision(
                createdAt: createdAt,
                noteDraft: originalNoteDraft,
                kind: .generated
            )
        ]

        if (isEdited || noteDraft != originalNoteDraft), noteDraft != originalNoteDraft {
            fallback.append(
                SavedEncounterRevision(
                    createdAt: createdAt,
                    noteDraft: noteDraft,
                    kind: .edited
                )
            )
        }

        return fallback
    }
}
