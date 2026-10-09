import Capacitor
import UIKit
import WebKit

@objc(OAuthNavigationPlugin)
public class OAuthNavigationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OAuthNavigationPlugin"
    public let jsName = "OAuthNavigation"
    public let pluginMethods: [CAPPluginMethod] = []

    public override func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        guard let url = navigationAction.request.url else {
            return nil
        }

        if let scheme = url.scheme?.lowercased(), ["mailto", "tel", "sms"].contains(scheme) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            return true
        }

        if url.host == "accounts.google.com" || url.host == "oauth2.googleapis.com" || url.host == "appleid.apple.com" {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            return true
        }

        return nil
    }
}
