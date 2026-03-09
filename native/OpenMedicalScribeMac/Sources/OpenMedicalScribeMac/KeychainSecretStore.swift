#if os(iOS)
import Foundation
import Security

enum KeychainSecretStore {
    static let bergetAPIKeyAccount = "io.openmedicalscribe.berget.api-key"
    static let backendAPITokenAccount = "io.openmedicalscribe.backend.api-token"
    static let cloudClientTokenAccount = "io.openmedicalscribe.cloud.client-token"
    static let cloudInstallIDAccount = "io.openmedicalscribe.cloud.install-id"
    static let cloudAppAttestKeyIDAccount = "io.openmedicalscribe.cloud.app-attest-key-id"
    static let backendURLAccount = "io.openmedicalscribe.backend.url"

    static func load(account: String) -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8)
        else {
            return ""
        }

        return value
    }

    static func save(_ value: String, account: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: account
        ]

        SecItemDelete(query as CFDictionary)

        guard !value.isEmpty else {
            return
        }

        var create = query
        create[kSecValueData as String] = data
        SecItemAdd(create as CFDictionary, nil)
    }
}
#endif
