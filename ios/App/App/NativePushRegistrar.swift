import Foundation
import UIKit
import WebKit

final class NativePushRegistrar {
    static let shared = NativePushRegistrar()

    private weak var webView: WKWebView?
    private var deviceToken: String?

    private init() {}

    func configure(webView: WKWebView?) {
        self.webView = webView
    }

    func updateDeviceToken(_ tokenData: Data) {
        deviceToken = tokenData.map { String(format: "%02.2hhx", $0) }.joined()
        registerCurrentDevice()
    }

    func registerCurrentDevice() {
        guard let token = deviceToken, !token.isEmpty else {
            return
        }

        let cookies = HTTPCookieStorage.shared.cookies(for: URL(string: "https://souqhamad.com") ?? URL(fileURLWithPath: "/")) ?? []
        let cookieHeader = HTTPCookie.requestHeaderFields(with: cookies)["Cookie"] ?? ""

        guard cookieHeader.contains("smartstore_session="), let url = URL(string: "https://souqhamad.com/api/mobile/push/register") else {
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 10
        request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(cookieHeader, forHTTPHeaderField: "Cookie")
        request.setValue("SouqHamadCapacitor iOS/\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown")", forHTTPHeaderField: "User-Agent")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "token": token,
            "platform": "ios",
            "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown",
            "locale": Locale.current.identifier,
        ])

        URLSession.shared.dataTask(with: request).resume()
    }
}
