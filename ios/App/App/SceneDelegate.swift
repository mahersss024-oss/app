import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    private let appOrigin = "https://souqhamad.com"
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = SouqHamadBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let url = URLContexts.first?.url, handleMobileAuthUrl(url) {
            return
        }

        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    private func handleMobileAuthUrl(_ url: URL) -> Bool {
        guard url.scheme == "smartstore", url.host == "auth" else {
            return false
        }

        guard
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
            var exchangeComponents = URLComponents(string: "\(appOrigin)/api/auth/mobile/exchange")
        else {
            return true
        }

        if let error = components.queryItems?.first(where: { $0.name == "error" })?.value,
           var fallbackComponents = URLComponents(string: appOrigin) {
            fallbackComponents.queryItems = [URLQueryItem(name: "auth_error", value: error)]

            if
                let fallbackUrl = fallbackComponents.url,
                let bridgeViewController = window?.rootViewController as? CAPBridgeViewController
            {
                bridgeViewController.webView?.load(URLRequest(url: fallbackUrl))
            }

            return true
        }

        guard let ticket = components.queryItems?.first(where: { $0.name == "ticket" })?.value else {
            return true
        }

        var queryItems = [URLQueryItem(name: "ticket", value: ticket)]

        if let next = components.queryItems?.first(where: { $0.name == "next" })?.value,
           !next.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            queryItems.append(URLQueryItem(name: "next", value: next))
        }

        exchangeComponents.queryItems = queryItems

        guard
            let exchangeUrl = exchangeComponents.url,
            let bridgeViewController = window?.rootViewController as? CAPBridgeViewController
        else {
            return true
        }

        bridgeViewController.webView?.load(URLRequest(url: exchangeUrl))
        return true
    }
}
