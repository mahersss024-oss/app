import Foundation
import UIKit
import WebKit

final class NativePushRegistrar {
    static let shared = NativePushRegistrar()

    private let registerUrl = URL(string: "https://souqhamad.com/api/mobile/push/register")!
    private let appOrigin = "https://souqhamad.com"
    private let queue = DispatchQueue(label: "com.souqhamad.app.nativePushRegistrar")
    private var latestToken: String?
    private weak var webView: WKWebView?

    private init() {}

    func configure(webView: WKWebView?) {
        self.webView = webView
        registerCurrentDevice()
    }

    func updateDeviceToken(_ deviceToken: Data) {
        latestToken = deviceToken.map { String(format: "%02x", $0) }.joined()
        registerCurrentDevice()
    }

    func registerCurrentDevice() {
        guard let token = latestToken, !token.isEmpty else {
            return
        }

        let cookieStore = webView?.configuration.websiteDataStore.httpCookieStore ?? WKWebsiteDataStore.default().httpCookieStore

        cookieStore.getAllCookies { [weak self] cookies in
            guard let self else {
                return
            }

            let cookieHeader = cookies
                .filter { cookie in
                    cookie.domain == "souqhamad.com" ||
                        cookie.domain == ".souqhamad.com" ||
                        cookie.domain.hasSuffix(".souqhamad.com")
                }
                .map { "\($0.name)=\($0.value)" }
                .joined(separator: "; ")

            guard cookieHeader.contains("smartstore_session=") else {
                return
            }

            self.postToken(token, cookieHeader: cookieHeader)
        }
    }

    private func postToken(_ token: String, cookieHeader: String) {
        queue.async {
            var request = URLRequest(url: self.registerUrl)
            request.httpMethod = "POST"
            request.timeoutInterval = 10
            request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.setValue(cookieHeader, forHTTPHeaderField: "Cookie")
            request.setValue(
                "SouqHamadCapacitor iOS/\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown")",
                forHTTPHeaderField: "User-Agent"
            )

            let payload: [String: Any] = [
                "token": token,
                "platform": "ios",
                "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "",
                "locale": Locale.current.identifier.replacingOccurrences(of: "_", with: "-"),
            ]

            request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

            URLSession.shared.dataTask(with: request).resume()
        }
    }
}
