package com.souqhamad.app;

import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String APP_ORIGIN = "https://souqhamad.com";
    private static final int APP_BACKGROUND = Color.rgb(8, 17, 29);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(OAuthNavigationPlugin.class);
        super.onCreate(savedInstanceState);

        View rootView = findViewById(android.R.id.content);
        if (rootView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, insets) -> {
                Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
                return insets;
            });
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
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
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleMobileAuthIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        handleMobileAuthIntent(getIntent());
    }

    private void handleMobileAuthIntent(Intent intent) {
        if (intent == null || intent.getData() == null || getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        Uri uri = intent.getData();

        if (!"smartstore".equals(uri.getScheme()) || !"auth".equals(uri.getHost())) {
            return;
        }

        String ticket = uri.getQueryParameter("ticket");

        if (ticket == null || ticket.isEmpty()) {
            return;
        }

        String exchangeUrl = APP_ORIGIN + "/api/auth/mobile/exchange?ticket=" + Uri.encode(ticket);
        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(exchangeUrl));
        setIntent(new Intent());
    }
}
