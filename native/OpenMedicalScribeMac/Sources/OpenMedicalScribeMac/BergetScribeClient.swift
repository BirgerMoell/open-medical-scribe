import Foundation

struct BergetScribeClient {
    private let baseURL = URL(string: "https://api.berget.ai")!
    private let transcriptionModel = "KBLab/kb-whisper-large"
    private let noteModel = "openai/gpt-oss-120b"

    func scribeAudio(
        apiKey: String,
        audioURL: URL,
        language: String,
        locale: String,
        country: String,
        noteStyle: NoteStyle
    ) async throws -> AppScribeResult {
        let transcript = try await transcribeAudio(
            apiKey: apiKey,
            audioURL: audioURL,
            language: language
        )
        let noteDraft = try await draftNote(
            apiKey: apiKey,
            transcript: transcript,
            language: language,
            locale: locale,
            country: country,
            noteStyle: noteStyle
        )

        return AppScribeResult(
            providers: .init(
                transcription: "Berget AI (\(transcriptionModel))",
                note: "Berget AI (\(noteModel))"
            ),
            transcript: transcript,
            noteDraft: noteDraft,
            warnings: [
                "Processed directly with your Berget API key.",
                "Draft note requires clinician review before use."
            ]
        )
    }

    private func transcribeAudio(
        apiKey: String,
        audioURL: URL,
        language: String
    ) async throws -> String {
        let audioData = try loadAudioData(from: audioURL)
        let mimeType = mimeType(for: audioURL)
        let boundary = "Boundary-\(UUID().uuidString)"

        var request = URLRequest(url: baseURL.appending(path: "v1/audio/transcriptions"))
        request.httpMethod = "POST"
        request.timeoutInterval = 240
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = try buildMultipartBody(
            boundary: boundary,
            audioData: audioData,
            mimeType: mimeType,
            fileExtension: audioURL.pathExtension.isEmpty ? "m4a" : audioURL.pathExtension,
            language: language
        )

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw NSError(
                domain: "OpenMedicalScribeApple",
                code: 71,
                userInfo: [NSLocalizedDescriptionKey: "Berget transcription failed: \(body)"]
            )
        }

        let payload = try JSONDecoder().decode(BergetTranscriptionResponse.self, from: data)
        let text = payload.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !text.isEmpty else {
            throw NSError(
                domain: "OpenMedicalScribeApple",
                code: 72,
                userInfo: [NSLocalizedDescriptionKey: "Berget transcription returned no text."]
            )
        }
        return text
    }

    private func draftNote(
        apiKey: String,
        transcript: String,
        language: String,
        locale: String,
        country: String,
        noteStyle: NoteStyle
    ) async throws -> String {
        let payload = BergetChatRequest(
            model: noteModel,
            messages: [
                .init(
                    role: "system",
                    content: "You are a careful medical scribe. Return only the finished clinician-facing note text. Never invent facts beyond the transcript."
                ),
                .init(
                    role: "user",
                    content: OnDeviceNotePromptBuilder.prompt(
                        transcript: transcript,
                        noteStyle: noteStyle,
                        language: language,
                        locale: locale,
                        country: country
                    )
                )
            ],
            temperature: 0.2,
            maxTokens: 900
        )

        var request = URLRequest(url: baseURL.appending(path: "v1/chat/completions"))
        request.httpMethod = "POST"
        request.timeoutInterval = 240
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(payload)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw NSError(
                domain: "OpenMedicalScribeApple",
                code: 73,
                userInfo: [NSLocalizedDescriptionKey: "Berget note generation failed: \(body)"]
            )
        }

        let completion = try JSONDecoder().decode(BergetChatResponse.self, from: data)
        let text = completion.choices.first?.message.content.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !text.isEmpty else {
            throw NSError(
                domain: "OpenMedicalScribeApple",
                code: 74,
                userInfo: [NSLocalizedDescriptionKey: "Berget note generation returned no content."]
            )
        }
        return text
    }

    private func buildMultipartBody(
        boundary: String,
        audioData: Data,
        mimeType: String,
        fileExtension: String,
        language: String
    ) throws -> Data {
        var body = Data()

        func appendField(name: String, value: String) {
            body.append(Data("--\(boundary)\r\n".utf8))
            body.append(Data("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".utf8))
            body.append(Data("\(value)\r\n".utf8))
        }

        appendField(name: "model", value: transcriptionModel)
        if !language.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            appendField(name: "language", value: language)
        }

        body.append(Data("--\(boundary)\r\n".utf8))
        body.append(
            Data(
                "Content-Disposition: form-data; name=\"file\"; filename=\"audio.\(fileExtension)\"\r\n".utf8
            )
        )
        body.append(Data("Content-Type: \(mimeType)\r\n\r\n".utf8))
        body.append(audioData)
        body.append(Data("\r\n".utf8))
        body.append(Data("--\(boundary)--\r\n".utf8))

        return body
    }

    private func mimeType(for url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "wav": return "audio/wav"
        case "mp3": return "audio/mpeg"
        case "m4a", "mp4": return "audio/mp4"
        case "ogg": return "audio/ogg"
        case "webm": return "audio/webm"
        default: return "audio/wav"
        }
    }

    private func loadAudioData(from url: URL) throws -> Data {
        let hasScopedAccess = url.startAccessingSecurityScopedResource()
        defer {
            if hasScopedAccess {
                url.stopAccessingSecurityScopedResource()
            }
        }

        return try Data(contentsOf: url)
    }
}

private struct BergetTranscriptionResponse: Decodable {
    let text: String?
}

private struct BergetChatRequest: Encodable {
    struct Message: Encodable {
        let role: String
        let content: String
    }

    let model: String
    let messages: [Message]
    let temperature: Double
    let maxTokens: Int

    enum CodingKeys: String, CodingKey {
        case model
        case messages
        case temperature
        case maxTokens = "max_tokens"
    }
}

private struct BergetChatResponse: Decodable {
    struct Choice: Decodable {
        struct Message: Decodable {
            let role: String
            let content: String
        }

        let message: Message
    }

    let choices: [Choice]
}
