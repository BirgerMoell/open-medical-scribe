import XCTest
@testable import OpenMedicalScribeMac

final class SavedEncounterTests: XCTestCase {
    func testNoteArchiveStoreRoundTripsEncounters() throws {
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("json")
        let store = NoteArchiveStore(fileURL: tempURL)
        let generatedRevision = SavedEncounterRevision(
            id: UUID(uuidString: "11111111-2222-3333-4444-555555555555")!,
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            noteDraft: "Aktuellt:\nOnt i halsen sedan tre dagar.",
            kind: .generated
        )
        let editedRevision = SavedEncounterRevision(
            id: UUID(uuidString: "66666666-7777-8888-9999-AAAAAAAAAAAA")!,
            createdAt: Date(timeIntervalSince1970: 1_700_000_060),
            noteDraft: "Aktuellt:\nOnt i halsen sedan fyra dagar.",
            kind: .edited
        )
        let encounter = SavedEncounter(
            id: UUID(),
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            sourceFileName: "visit.m4a",
            noteStyle: NoteStyle.journal.rawValue,
            language: "sv",
            locale: "sv-SE",
            country: "SE",
            transcript: "Patienten har ont i halsen.",
            noteDraft: "Aktuellt:\nOnt i halsen sedan fyra dagar.",
            originalNoteDraft: "Aktuellt:\nOnt i halsen sedan tre dagar.",
            isEdited: true,
            revisions: [generatedRevision, editedRevision],
            warnings: ["Requires clinician review."],
            transcriptionProvider: "WhisperKit",
            noteProvider: "Qwen"
        )

        try store.save([encounter])
        let loaded = store.load()

        XCTAssertEqual(loaded, [encounter])
        XCTAssertEqual(loaded.first?.versionCount, 2)
    }

    func testEncounterExportFormatterBuildsSwedishJournalArtifacts() throws {
        let encounter = SavedEncounter(
            id: UUID(uuidString: "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE")!,
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            sourceFileName: "visit.m4a",
            noteStyle: NoteStyle.journal.rawValue,
            language: "sv",
            locale: "sv-SE",
            country: "SE",
            transcript: "Patienten har ont i halsen.",
            noteDraft: "Aktuellt:\nOnt i halsen sedan tre dagar.",
            originalNoteDraft: "Aktuellt:\nOnt i halsen sedan tre dagar.",
            warnings: [],
            transcriptionProvider: "WhisperKit",
            noteProvider: "Qwen"
        )
        let exportDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)

        let artifacts = EncounterExportFormatter.makeArtifacts(for: encounter, in: exportDirectory)
        let noteURL = try XCTUnwrap(artifacts.noteFileURL)
        let fhirURL = try XCTUnwrap(artifacts.fhirFileURL)
        let journalText = try String(contentsOf: noteURL, encoding: .utf8)
        let fhirText = try String(contentsOf: fhirURL, encoding: .utf8)

        XCTAssertEqual(journalText, "Aktuellt:\nOnt i halsen sedan tre dagar.")
        XCTAssertTrue(noteURL.lastPathComponent.hasPrefix("journalanteckning-"))
        XCTAssertTrue(fhirText.contains("\"resourceType\" : \"DocumentReference\""))
        XCTAssertTrue(fhirText.contains("\"valueString\" : \"journal\""))
        XCTAssertTrue(artifacts.warnings.isEmpty)
    }

    func testSavedEncounterDecodesOlderArchiveWithoutEditMetadata() throws {
        let json = """
        [
          {
            "country" : "SE",
            "createdAt" : "2023-11-14T22:13:20Z",
            "id" : "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE",
            "language" : "sv",
            "locale" : "sv-SE",
            "noteDraft" : "Journaltext",
            "noteProvider" : "Qwen",
            "noteStyle" : "journal",
            "sourceFileName" : "visit.m4a",
            "transcript" : "Transkript",
            "transcriptionProvider" : "WhisperKit",
            "warnings" : [ ]
          }
        ]
        """

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let encounters = try decoder.decode([SavedEncounter].self, from: Data(json.utf8))

        XCTAssertEqual(encounters.count, 1)
        XCTAssertEqual(encounters[0].originalNoteDraft, "Journaltext")
        XCTAssertFalse(encounters[0].isEdited)
        XCTAssertEqual(encounters[0].versionCount, 1)
    }

    func testSavedEncounterSynthesizesEditedRevisionWhenArchiveHasNoRevisionArray() {
        let createdAt = Date(timeIntervalSince1970: 1_700_000_000)
        let encounter = SavedEncounter(
            id: UUID(),
            createdAt: createdAt,
            sourceFileName: "visit.m4a",
            noteStyle: NoteStyle.journal.rawValue,
            language: "sv",
            locale: "sv-SE",
            country: "SE",
            transcript: "Transkript",
            noteDraft: "Journaltext uppdaterad",
            originalNoteDraft: "Journaltext",
            isEdited: true,
            revisions: nil,
            warnings: [],
            transcriptionProvider: "WhisperKit",
            noteProvider: "Qwen"
        )

        XCTAssertEqual(encounter.versionCount, 2)
        XCTAssertEqual(encounter.revisions.first?.kind, .generated)
        XCTAssertEqual(encounter.revisions.last?.kind, .edited)
        XCTAssertEqual(encounter.revisions.first?.createdAt, createdAt)
    }
}
