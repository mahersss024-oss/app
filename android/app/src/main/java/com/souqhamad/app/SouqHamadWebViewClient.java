package com.souqhamad.app;

import android.annotation.SuppressLint;
import android.net.Uri;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

public class SouqHamadWebViewClient extends BridgeWebViewClient {
    private final String appOrigin;
    private boolean showingOfflinePage = false;

    public SouqHamadWebViewClient(Bridge bridge, String appOrigin) {
        super(bridge);
        this.appOrigin = appOrigin;
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        super.onReceivedError(view, request, error);

        if (
            request != null &&
            request.isForMainFrame() &&
            isTrustedAppUrl(request.getUrl().toString())
        ) {
            showOfflinePage(view);
        }
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
        super.onReceivedError(view, errorCode, description, failingUrl);

        if (isTrustedAppUrl(failingUrl)) {
            showOfflinePage(view);
        }
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);

        if (url != null && url.startsWith(appOrigin)) {
            showingOfflinePage = false;
        }
    }

    private boolean isTrustedAppUrl(String value) {
        if (value == null || value.trim().isEmpty()) {
            return false;
        }

        try {
            Uri uri = Uri.parse(value);
            String host = uri.getHost();

            return "https".equals(uri.getScheme()) &&
                ("souqhamad.com".equals(host) || "www.souqhamad.com".equals(host));
        } catch (Exception ignored) {
            return false;
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void showOfflinePage(WebView view) {
        if (showingOfflinePage) {
            return;
        }

        showingOfflinePage = true;

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
