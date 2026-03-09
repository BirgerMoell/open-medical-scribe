import Foundation

#if os(iOS)
import UIKit
#endif

#if canImport(DeviceCheck)
import DeviceCheck
#endif

struct CloudBootstrapAttestation: Encodable, Sendable {
    let provider: String
    let status: String
    let isSupported: Bool
    let keyID: String?
    let evidence: String?
}

struct CloudBootstrapContext: Sendable {
    let installID: String
    let platform: String
    let attestation: CloudBootstrapAttestation
}

enum CloudBootstrapper {
    static func currentContext() async -> CloudBootstrapContext {
        CloudBootstrapContext(
            installID: installID(),
            platform: platformLabel,
            attestation: await attestation()
        )
    }

    static func installID() -> String {
#if os(iOS)
        let stored = KeychainSecretStore
            .load(account: KeychainSecretStore.cloudInstallIDAccount)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if !stored.isEmpty {
            return stored
        }

        let generated = UUID().uuidString.lowercased()
        KeychainSecretStore.save(generated, account: KeychainSecretStore.cloudInstallIDAccount)
        return generated
#else
        return "macos-\(UUID().uuidString.lowercased())"
#endif
    }

    private static var platformLabel: String {
#if os(iOS)
        "ios"
#elseif os(macOS)
        "macos"
#else
        "apple"
#endif
    }

    private static func attestation() async -> CloudBootstrapAttestation {
#if os(iOS) && canImport(DeviceCheck)
        if #available(iOS 14.0, *), DCAppAttestService.shared.isSupported {
            let keyID = await appAttestKeyID()
            return CloudBootstrapAttestation(
                provider: "app_attest",
                status: keyID == nil ? "supported_uninitialized" : "supported_key_ready",
                isSupported: true,
                keyID: keyID,
                evidence: nil
            )
        }

        return CloudBootstrapAttestation(
            provider: "none",
            status: "unsupported",
            isSupported: false,
            keyID: nil,
            evidence: nil
        )
#else
        return CloudBootstrapAttestation(
            provider: "none",
            status: "unavailable",
            isSupported: false,
            keyID: nil,
            evidence: nil
        )
#endif
    }

#if os(iOS) && canImport(DeviceCheck)
    @available(iOS 14.0, *)
    private static func appAttestKeyID() async -> String? {
        let stored = KeychainSecretStore
            .load(account: KeychainSecretStore.cloudAppAttestKeyIDAccount)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if !stored.isEmpty {
            return stored
        }

        do {
            let generated: String = try await withCheckedThrowingContinuation { (
                continuation: CheckedContinuation<String, Error>
            ) in
                DCAppAttestService.shared.generateKey { keyID, error in
                    if let error {
                        continuation.resume(throwing: error)
                        return
                    }

                    continuation.resume(returning: keyID ?? "")
                }
            }

            let normalized = generated.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !normalized.isEmpty else {
                return nil
            }

            KeychainSecretStore.save(
                normalized,
                account: KeychainSecretStore.cloudAppAttestKeyIDAccount
            )
            return normalized
        } catch {
            return nil
        }
    }
#endif
}
