import Foundation
import UniformTypeIdentifiers

struct ScribeClient {
    func health(baseURL: URL, bearerToken: String = "") async throws {
        var request = URLRequest(url: baseURL.appending(path: "health"))
        request.httpMethod = "GET"
        request.timeoutInterval = 10
        applyAuthorizationHeader(to: &request, bearerToken: bearerToken)

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw NSError(domain: "OpenMedicalScribeApple", code: 3, userInfo: [
                NSLocalizedDescriptionKey: "Backend health check failed."
            ])
        }
    }

    func scribeAudio(
        baseURL: URL,
        bearerToken: String = "",
        audioURL: URL,
        language: String,
        locale: String,
        country: String,
        noteStyle: String
    ) async throws -> AppScribeResult {
        let audioData = try loadAudioData(from: audioURL)
        let mimeType = mimeType(for: audioURL)
        let payload = EncounterRequest(
            audioBase64: audioData.base64EncodedString(),
            audioMimeType: mimeType,
            language: language,
            locale: locale,
            country: country,
            noteStyle: noteStyle,
            specialty: "primary-care"
        )

        var request = URLRequest(url: baseURL.appending(path: "v1/encounters/scribe"))
        request.httpMethod = "POST"
        request.timeoutInterval = 240
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        applyAuthorizationHeader(to: &request, bearerToken: bearerToken)
        request.httpBody = try JSONEncoder().encode(payload)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw NSError(domain: "OpenMedicalScribeMac", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Scribe request failed: \(body)"
            ])
        }

        return try JSONDecoder().decode(AppScribeResult.self, from: data)
    }

    private func mimeType(for url: URL) -> String {
        if let type = UTType(filenameExtension: url.pathExtension),
           let mimeType = type.preferredMIMEType {
            return mimeType
        }

        return switch url.pathExtension.lowercased() {
        case "wav": "audio/wav"
        case "mp3": "audio/mpeg"
        case "m4a", "mp4": "audio/mp4"
        case "ogg": "audio/ogg"
        case "webm": "audio/webm"
        default: "audio/wav"
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

    private func applyAuthorizationHeader(to request: inout URLRequest, bearerToken: String) {
        let token = bearerToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !token.isEmpty else {
            return
        }

        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
}

private struct EncounterRequest: Encodable {
    let audioBase64: String
    let audioMimeType: String
    let language: String
    let locale: String
    let country: String
    let noteStyle: String
    let specialty: String
}
