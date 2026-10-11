package com.souqhamad.app;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    static final String APP_ORIGIN = "https://souqhamad.com";
    private static final String MOBILE_AUTH_SCHEME = "smartstore";
    private static final String MOBILE_AUTH_HOST = "auth";
    private static final int APP_BACKGROUND = Color.rgb(8, 17, 29);
    private static final int REQUEST_POST_NOTIFICATIONS = 5101;

    private NativePushRegistrar nativePushRegistrar;
    private NativeGoogleSignIn nativeGoogleSignIn;
    private SouqHamadWebChromeClient webChromeClient;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        nativePushRegistrar = new NativePushRegistrar(this);
        nativeGoogleSignIn = new NativeGoogleSignIn(this);
        configureWebView();
        requestNotificationPermissionIfNeeded();
        scheduleNativePushRegistration();
        scheduleNativePushStatusInjection();
        handleTrustedNavigationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleTrustedNavigationIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        injectNativePushStatus();
        scheduleNativePushRegistration();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (webChromeClient != null && webChromeClient.handleActivityResult(requestCode, resultCode, data)) {
            return;
        }

        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (webChromeClient != null && webChromeClient.handlePermissionResult(requestCode, grantResults)) {
            return;
        }

        if (requestCode == REQUEST_POST_NOTIFICATIONS) {
            injectNativePushStatus();
            scheduleNativePushRegistration();
        }
    }

    boolean handleMobileAuthUrl(String value) {
        try {
            Uri uri = Uri.parse(value);

            if (!MOBILE_AUTH_SCHEME.equals(uri.getScheme()) || !MOBILE_AUTH_HOST.equals(uri.getHost())) {
                return false;
            }

            String error = uri.getQueryParameter("error");
            String ticket = uri.getQueryParameter("ticket");
            String targetUrl;

            if (error != null && !error.trim().isEmpty()) {
                targetUrl = APP_ORIGIN + "/?auth_error=" + Uri.encode(error);
            } else if (ticket != null && !ticket.trim().isEmpty()) {
                String next = uri.getQueryParameter("next");
                targetUrl = APP_ORIGIN + "/api/auth/mobile/exchange?ticket=" + Uri.encode(ticket);

                if (next != null && !next.trim().isEmpty()) {
                    targetUrl += "&next=" + Uri.encode(next);
                }
            } else {
                return true;
            }

            loadTrustedUrl(targetUrl);
            return true;
        } catch (Exception ignored) {
            return true;
        }
    }

    void loadTrustedUrl(String url) {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(url));
    }

    void startNativeGoogleSignIn() {
        if (nativeGoogleSignIn != null) {
            nativeGoogleSignIn.start();
        }
    }

    private void configureWebView() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        WebView webView = getBridge().getWebView();
        webChromeClient = new SouqHamadWebChromeClient(getBridge(), this);
        webView.setWebViewClient(new SouqHamadWebViewClient(getBridge(), this, APP_ORIGIN));
        webView.setWebChromeClient(webChromeClient);
        webView.addJavascriptInterface(new NativeBridge(), "SmartStoreNative");
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setBackgroundColor(APP_BACKGROUND);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setScrollbarFadingEnabled(true);

        WebSettings settings = webView.getSettings();
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setLoadsImagesAutomatically(true);
        settings.setBlockNetworkImage(false);
        settings.setOffscreenPreRaster(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    }

    private void handleTrustedNavigationIntent(Intent intent) {
        if (intent == null) {
            return;
        }

        String url = intent.getData() != null ? intent.getData().toString() : intent.getStringExtra("url");

        if (url == null || url.trim().isEmpty()) {
            return;
        }

        String trimmedUrl = url.trim();

        if (handleMobileAuthUrl(trimmedUrl)) {
            intent.removeExtra("url");
            intent.setData(null);
            return;
        }

        String targetUrl = SouqHamadWebViewClient.toTrustedAppUrl(trimmedUrl, APP_ORIGIN);

        if (targetUrl != null) {
            loadTrustedUrl(targetUrl);
            intent.removeExtra("url");
            intent.setData(null);
        }
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return;
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            return;
        }

        ActivityCompat.requestPermissions(this, new String[] { Manifest.permission.POST_NOTIFICATIONS }, REQUEST_POST_NOTIFICATIONS);
    }

    private void scheduleNativePushRegistration() {
        if (nativePushRegistrar == null) {
            return;
        }

        new Handler(Looper.getMainLooper()).postDelayed(() -> nativePushRegistrar.registerCurrentDevice(), 2500);
    }

    private void scheduleNativePushStatusInjection() {
        new Handler(Looper.getMainLooper()).postDelayed(this::injectNativePushStatus, 500);
        new Handler(Looper.getMainLooper()).postDelayed(this::injectNativePushStatus, 2500);
    }

    private void injectNativePushStatus() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        boolean notificationsEnabled = NotificationManagerCompat.from(this).areNotificationsEnabled();
        String permission = notificationsEnabled ? "granted" : "denied";
        String statusJson = "{"
            + "\"supported\":true,"
            + "\"platform\":\"android\","
            + "\"permission\":" + JSONObject.quote(permission) + ","
            + "\"active\":" + notificationsEnabled
            + "}";
        String script = "(() => {"
            + "const status = " + statusJson + ";"
            + "window.SouqHamadNativePush = status;"
            + "window.dispatchEvent(new CustomEvent('smartstore:native-push-status', { detail: status }));"
            + "})();";

        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(script, null));
    }

    private void openNotificationSettings() {
        Intent intent;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).setData(Uri.parse("package:" + getPackageName()));
        }

        try {
            startActivity(intent);
        } catch (ActivityNotFoundException exception) {
            startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).setData(Uri.parse("package:" + getPackageName())));
        }
    }

    private class NativeBridge {
        @JavascriptInterface
        public void postMessage(String payload) {
            try {
                JSONObject message = new JSONObject(payload);

                if ("open-notification-settings".equals(message.optString("type"))) {
                    runOnUiThread(MainActivity.this::openNotificationSettings);
                }
            } catch (Exception ignored) {
                // Ignore malformed bridge messages.
            }
        }
    }
}
