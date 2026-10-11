package com.souqhamad.app;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

public class SouqHamadWebViewClient extends BridgeWebViewClient {
    private final MainActivity activity;
    private final String appOrigin;
    private boolean showingOfflinePage = false;

    public SouqHamadWebViewClient(Bridge bridge, MainActivity activity, String appOrigin) {
        super(bridge);
        this.activity = activity;
        this.appOrigin = appOrigin;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (request == null || request.getUrl() == null) {
            return false;
        }

        return handleNavigation(request.getUrl().toString());
    }

    @SuppressWarnings("deprecation")
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        return handleNavigation(url);
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (request != null && request.isForMainFrame() && isTrustedAppUrl(request.getUrl().toString())) {
            showOfflinePage(view);
            return;
        }

        super.onReceivedError(view, request, error);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
        if (isTrustedAppUrl(failingUrl)) {
            showOfflinePage(view);
            return;
        }

        super.onReceivedError(view, errorCode, description, failingUrl);
    }

    @Override
    public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
        if (request != null && request.isForMainFrame() && isTrustedAppUrl(request.getUrl().toString())) {
            showOfflinePage(view);
            return;
        }

        super.onReceivedHttpError(view, request, errorResponse);
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);

        if (url != null && url.startsWith(appOrigin)) {
            showingOfflinePage = false;
        }
    }

    static String toTrustedAppUrl(String value, String appOrigin) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }

        if (value.startsWith("/") && !value.startsWith("//") && !value.contains("\\")) {
            return appOrigin + value;
        }

        try {
            Uri uri = Uri.parse(value);
            String host = uri.getHost();

            if (!"https".equals(uri.getScheme())) {
                return null;
            }

            if (!"souqhamad.com".equals(host) && !"www.souqhamad.com".equals(host)) {
                return null;
            }

            return uri.toString();
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean handleNavigation(String url) {
        if (url == null || url.trim().isEmpty()) {
            return false;
        }

        if (activity.handleMobileAuthUrl(url)) {
            return true;
        }

        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();

        if ("mailto".equals(scheme) || "tel".equals(scheme) || "sms".equals(scheme)) {
            openExternal(url);
            return true;
        }

        if (isGoogleStartUrl(uri)) {
            activity.startNativeGoogleSignIn();
            return true;
        }

        if (isOAuthProviderUrl(uri)) {
            openExternal(url);
            return true;
        }

        if (isTrustedAppUrl(url)) {
            return false;
        }

        if ("http".equals(scheme) || "https".equals(scheme)) {
            openExternal(url);
            return true;
        }

        return false;
    }

    private boolean isOAuthProviderUrl(Uri uri) {
        String host = uri.getHost();

        return "accounts.google.com".equals(host) ||
            "oauth2.googleapis.com".equals(host) ||
            "appleid.apple.com".equals(host);
    }

    private boolean isGoogleStartUrl(Uri uri) {
        return "https".equals(uri.getScheme()) &&
            ("souqhamad.com".equals(uri.getHost()) || "www.souqhamad.com".equals(uri.getHost())) &&
            "/api/auth/google/start".equals(uri.getPath());
    }

    private boolean isTrustedAppUrl(String value) {
        return toTrustedAppUrl(value, appOrigin) != null;
    }

    private void openExternal(String url) {
        try {
            activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (ActivityNotFoundException ignored) {
            // If no browser is available, leave the WebView untouched.
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void showOfflinePage(WebView view) {
        if (showingOfflinePage) {
            return;
        }

        showingOfflinePage = true;
        view.stopLoading();

        String html = "<!doctype html><html lang=\"ar\" dir=\"rtl\"><head>"
            + "<meta charset=\"utf-8\">"
            + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">"
            + "<title>لا يوجد اتصال</title>"
            + "<style>"
            + "html,body{height:100%;margin:0;background:#08111d;color:#eaf6ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}"
            + "body{display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;}"
            + ".box{width:min(420px,100%);text-align:center;border:1px solid rgba(125,211,252,.28);border-radius:22px;padding:28px 22px;background:linear-gradient(180deg,rgba(15,33,52,.94),rgba(8,17,29,.94));box-shadow:0 18px 54px rgba(0,0,0,.32);}"
            + ".icon{width:62px;height:62px;margin:0 auto 18px;border-radius:20px;background:#0ea5e9;display:flex;align-items:center;justify-content:center;font-size:30px;}"
            + "h1{font-size:24px;margin:0 0 10px;font-weight:800;}"
            + "p{font-size:15px;line-height:1.8;margin:0 0 22px;color:#b8c7d9;}"
            + "button{width:100%;border:0;border-radius:14px;padding:14px 16px;background:#1d64f2;color:white;font-size:17px;font-weight:700;}"
            + ".hint{margin-top:14px;font-size:13px;color:#8aa0b7;}"
            + "</style></head><body><main class=\"box\">"
            + "<div class=\"icon\">!</div>"
            + "<h1>لا يوجد اتصال بالإنترنت</h1>"
            + "<p>تعذر تحميل سوق حمد الآن. تحقق من الاتصال ثم أعد المحاولة.</p>"
            + "<button onclick=\"location.href='" + appOrigin + "/'\">إعادة المحاولة</button>"
            + "<div class=\"hint\">سيعود التطبيق تلقائيًا عند توفر الاتصال.</div>"
            + "</main></body></html>";

        view.loadDataWithBaseURL(appOrigin + "/", html, "text/html", "UTF-8", null);
    }
}
