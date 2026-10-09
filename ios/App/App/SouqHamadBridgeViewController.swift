import Capacitor
import UIKit
import UserNotifications
import WebKit

private final class WeakScriptMessageDelegate: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?

    init(_ delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}

class SouqHamadBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private let nativeMessageHandlerName = "smartstore"
    private var activeObserver: NSObjectProtocol?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginType(OAuthNavigationPlugin.self)
        view.backgroundColor = UIColor(red: 0.03, green: 0.07, blue: 0.11, alpha: 1.0)
        webView?.backgroundColor = UIColor(red: 0.03, green: 0.07, blue: 0.11, alpha: 1.0)
        webView?.isOpaque = false
        NativePushRegistrar.shared.configure(webView: webView)

        let source = """
        window.SmartStoreNative = window.SmartStoreNative || {
          postMessage: function(payload) {
            window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.smartstore && window.webkit.messageHandlers.smartstore.postMessage(payload);
          }
        };
        """
        let script = WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        webView?.configuration.userContentController.addUserScript(script)
        webView?.configuration.userContentController.add(WeakScriptMessageDelegate(self), name: nativeMessageHandlerName)

        activeObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.scheduleNativePushStatusInjection()
        }
    }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: nativeMessageHandlerName)

        if let activeObserver {
            NotificationCenter.default.removeObserver(activeObserver)
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        requestNotificationPermissionIfNeeded()
        NativePushRegistrar.shared.registerCurrentDevice()
        scheduleNativePushStatusInjection()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == nativeMessageHandlerName else {
            return
        }

        let payload: [String: Any]?

        if let body = message.body as? [String: Any] {
            payload = body
        } else if
            let body = message.body as? String,
            let data = body.data(using: .utf8),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            payload = json
        } else {
            payload = nil
        }

        if payload?["type"] as? String == "open-notification-settings" {
            openAppSettings()
        }
    }

    private func requestNotificationPermissionIfNeeded() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            guard settings.authorizationStatus == .notDetermined else {
                DispatchQueue.main.async {
                    if settings.authorizationStatus == .authorized ||
                        settings.authorizationStatus == .provisional ||
                        settings.authorizationStatus == .ephemeral {
                        UIApplication.shared.registerForRemoteNotifications()
                    }
                    NativePushRegistrar.shared.registerCurrentDevice()
                    self.scheduleNativePushStatusInjection()
                }
                return
            }

            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { _, _ in
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                    NativePushRegistrar.shared.registerCurrentDevice()
                    self.scheduleNativePushStatusInjection()
                }
            }
        }
    }

    private func scheduleNativePushStatusInjection() {
        injectNativePushStatus()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.injectNativePushStatus()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak self] in
            self?.injectNativePushStatus()
        }
    }

    private func injectNativePushStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { [weak self] settings in
            let permission: String

            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                permission = "granted"
            case .denied:
                permission = "denied"
            case .notDetermined:
                permission = "default"
            @unknown default:
                permission = "default"
            }

            let active = permission == "granted"
            let status: [String: Any] = [
                "supported": true,
                "platform": "ios",
                "permission": permission,
                "active": active,
            ]

            guard
                let data = try? JSONSerialization.data(withJSONObject: status),
                let json = String(data: data, encoding: .utf8)
            else {
                return
            }

            let script = """
            (() => {
              const status = \(json);
              window.SouqHamadNativePush = status;
              window.dispatchEvent(new CustomEvent('smartstore:native-push-status', { detail: status }));
            })();
            """

            DispatchQueue.main.async {
                self?.webView?.evaluateJavaScript(script, completionHandler: nil)
            }
        }
    }

    private func openAppSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            return
        }

        UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }
}
