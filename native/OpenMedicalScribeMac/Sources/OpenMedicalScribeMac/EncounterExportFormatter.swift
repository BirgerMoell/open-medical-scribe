import Foundation

struct EncounterExportArtifacts: Sendable {
    let journalCopyText: String
    let noteFileURL: URL?
    let fhirFileURL: URL?
    let warnings: [String]
}

enum EncounterExportFormatter {
    static func journalCopyText(for encounter: SavedEncounter) -> String {
        let trimmed = encounter.noteDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? encounter.transcript.trimmingCharacters(in: .whitespacesAndNewlines) : trimmed
    }

    static func makeArtifacts(
        for encounter: SavedEncounter,
        in directory: URL = defaultExportDirectory()
    ) -> EncounterExportArtifacts {
        let fileManager = FileManager.default
        let baseName = exportBaseName(for: encounter)
        let noteText = journalCopyText(for: encounter)
        let noteFileURL = directory.appendingPathComponent("\(baseName).txt")
        let fhirFileURL = directory.appendingPathComponent("\(baseName).fhir.json")
        var writableDirectory: URL?
        var warnings = [String]()

        do {
            try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
            writableDirectory = directory
        } catch {
            warnings.append("File export is unavailable on this device right now: \(error.localizedDescription)")
        }

        var exportedNoteURL: URL?
        if writableDirectory != nil {
            do {
                try noteText.write(to: noteFileURL, atomically: true, encoding: .utf8)
                exportedNoteURL = noteFileURL
            } catch {
                warnings.append("Couldn't prepare the text file export: \(error.localizedDescription)")
            }
        }

        var exportedFhirURL: URL?
        if writableDirectory != nil {
            do {
                let encoder = JSONEncoder()
                encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
                encoder.dateEncodingStrategy = .iso8601
                let fhirData = try encoder.encode(buildFhirDocumentReference(for: encounter))
                try fhirData.write(to: fhirFileURL, options: .atomic)
                exportedFhirURL = fhirFileURL
            } catch {
                warnings.append("Couldn't prepare the FHIR export: \(error.localizedDescription)")
            }
        }

        return EncounterExportArtifacts(
            journalCopyText: noteText,
            noteFileURL: exportedNoteURL,
            fhirFileURL: exportedFhirURL,
            warnings: warnings
        )
    }

    static func exportBaseName(for encounter: SavedEncounter) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyyMMdd-HHmm"

        let prefix: String
        if encounter.noteStyleValue == .journal || encounter.locale.lowercased().hasPrefix("sv") || encounter.country.uppercased() == "SE" {
            prefix = "journalanteckning"
        } else {
            prefix = "clinical-note"
        }

        return "\(prefix)-\(formatter.string(from: encounter.createdAt))"
    }

    private static func defaultExportDirectory() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("EirScribeExports", isDirectory: true)
    }

    private static func buildFhirDocumentReference(for encounter: SavedEncounter) -> FhirDocumentReference {
        let noteText = journalCopyText(for: encounter)

        return FhirDocumentReference(
            status: "current",
            docStatus: "preliminary",
            id: encounter.id.uuidString,
            type: .init(text: "Clinical note draft"),
            date: encounter.createdAt,
            subject: .init(display: "Unknown patient"),
            author: [.init(display: "Clinician (unassigned)")],
            description: "Scribe-generated \(encounter.noteStyleValue.title.lowercased()) note draft",
            category: [.init(text: "clinical-note")],
            content: [
                .init(
                    attachment: .init(
                        contentType: "text/plain",
                        title: encounter.title,
                        creation: encounter.createdAt,
                        data: Data(noteText.utf8).base64EncodedString()
                    )
                )
            ],
            context: .init(encounter: []),
            extension: [
                .init(
                    url: "https://open-medical-scribe.dev/fhir/StructureDefinition/note-style",
                    valueString: encounter.noteStyle
                ),
                .init(
                    url: "https://open-medical-scribe.dev/fhir/StructureDefinition/specialty",
                    valueString: encounter.country.uppercased() == "SE" ? "primary-care-sweden" : "general"
                ),
            ]
        )
    }
}

private struct FhirDocumentReference: Encodable {
    let resourceType = "DocumentReference"
    let status: String
    let docStatus: String
    let id: String
    let type: TextValue
    let date: Date
    let subject: DisplayValue
    let author: [DisplayValue]
    let description: String
    let category: [TextValue]
    let content: [ContentItem]
    let context: ContextValue
    let `extension`: [StringExtension]

    struct TextValue: Encodable {
        let text: String
    }

    struct DisplayValue: Encodable {
        let display: String
    }

    struct ContentItem: Encodable {
        let attachment: Attachment
    }

    struct Attachment: Encodable {
        let contentType: String
        let title: String
        let creation: Date
        let data: String
    }

    struct ContextValue: Encodable {
        let encounter: [ReferenceValue]
    }

    struct ReferenceValue: Encodable {
        let reference: String
    }

    struct StringExtension: Encodable {
        let url: String
        let valueString: String
    }
}
