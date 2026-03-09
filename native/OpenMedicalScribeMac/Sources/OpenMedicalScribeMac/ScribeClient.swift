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

    func bootstrapCloudClient(
        baseURL: URL,
        installID: String,
        platform: String,
        attestation: CloudBootstrapAttestation
    ) async throws -> CloudBootstrapResponse {
        var request = URLRequest(url: baseURL.appending(path: "v1/client/bootstrap"))
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            CloudBootstrapRequest(
                installId: installID,
                platform: platform,
                attestation: attestation
            )
        )

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw backendError(data: data, fallback: "Secure cloud access setup failed.")
        }

        return try JSONDecoder().decode(CloudBootstrapResponse.self, from: data)
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
            throw backendError(data: data, fallback: "Scribe request failed.")
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

    private func backendError(data: Data, fallback: String) -> NSError {
        if let payload = try? JSONDecoder().decode(BackendErrorPayload.self, from: data) {
            var description = payload.error.trimmingCharacters(in: .whitespacesAndNewlines)
            if description.isEmpty {
                description = fallback
            }

            if let quota = payload.quota {
                description += " Remaining trial audio: \(Int(quota.remaining.audioSeconds / 60)) min."
            }

            return NSError(domain: "OpenMedicalScribeMac", code: 2, userInfo: [
                NSLocalizedDescriptionKey: description
            ])
        }

        let body = String(data: data, encoding: .utf8) ?? fallback
        return NSError(domain: "OpenMedicalScribeMac", code: 2, userInfo: [
            NSLocalizedDescriptionKey: "\(fallback) \(body)"
        ])
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

private struct CloudBootstrapRequest: Encodable {
    let installId: String
    let platform: String
    let attestation: CloudBootstrapAttestation
}

struct CloudBootstrapResponse: Decodable, Sendable {
    struct Quota: Decodable, Sendable {
        struct UsageBlock: Decodable, Sendable {
            let requests: Int
            let audioSeconds: Int
            let estimatedCostUsd: Double
        }

        let used: UsageBlock
        let limits: UsageBlock
        let remaining: UsageBlock
    }

    let clientId: String
    let bearerToken: String
    let mode: String
    let quota: Quota
}

private struct BackendErrorPayload: Decodable {
    struct Quota: Decodable {
        struct UsageBlock: Decodable {
            let requests: Int
            let audioSeconds: Int
            let estimatedCostUsd: Double
        }

        let used: UsageBlock
        let limits: UsageBlock
        let remaining: UsageBlock
    }

    let error: String
    let code: String?
    let quota: Quota?
}
