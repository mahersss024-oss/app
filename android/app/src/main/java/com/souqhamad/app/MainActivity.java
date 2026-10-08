package com.souqhamad.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String APP_ORIGIN = "https://souqhamad.com";
    private static final int APP_BACKGROUND = Color.rgb(8, 17, 29);
    private static final int REQUEST_POST_NOTIFICATIONS = 5101;
    private SouqHamadWebChromeClient webChromeClient;
    private NativePushRegistrar nativePushRegistrar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(OAuthNavigationPlugin.class);
        super.onCreate(savedInstanceState);
        nativePushRegistrar = new NativePushRegistrar(this);

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
            webChromeClient = new SouqHamadWebChromeClient(getBridge(), this);
            webView.setWebChromeClient(webChromeClient);
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

        requestNotificationPermissionIfNeeded();
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
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleMobileAuthIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        handleMobileAuthIntent(getIntent());
        scheduleNativePushRegistration();
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
        scheduleNativePushRegistration();
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return;
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            return;
        }

        ActivityCompat.requestPermissions(
            this,
            new String[] { Manifest.permission.POST_NOTIFICATIONS },
            REQUEST_POST_NOTIFICATIONS
        );
    }

    private void scheduleNativePushRegistration() {
        if (nativePushRegistrar == null) {
            return;
        }

        new Handler(Looper.getMainLooper()).postDelayed(
            () -> nativePushRegistrar.registerCurrentDevice(),
            2500
        );
    }
}
