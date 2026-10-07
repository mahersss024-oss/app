import Capacitor
import UIKit

class SouqHamadBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginType(OAuthNavigationPlugin.self)
        view.backgroundColor = UIColor(red: 0.03, green: 0.07, blue: 0.11, alpha: 1.0)
        webView?.backgroundColor = UIColor(red: 0.03, green: 0.07, blue: 0.11, alpha: 1.0)
        webView?.isOpaque = false
    }
}
