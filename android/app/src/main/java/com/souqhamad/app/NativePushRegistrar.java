package com.souqhamad.app;

import android.content.Context;
import android.os.Build;
import android.webkit.CookieManager;

import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class NativePushRegistrar {
    private static final String REGISTER_URL = "https://souqhamad.com/api/mobile/push/register";

    private final Context context;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean registrationInFlight = new AtomicBoolean(false);

    public NativePushRegistrar(Context context) {
        this.context = context.getApplicationContext();
    }

    public void registerCurrentDevice() {
        if (!registrationInFlight.compareAndSet(false, true)) {
            return;
        }

        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null || task.getResult().isEmpty()) {
                registrationInFlight.set(false);
                return;
            }

            String cookie = CookieManager.getInstance().getCookie("https://souqhamad.com");

            if (cookie == null || cookie.isEmpty() || !cookie.contains("smartstore_session=")) {
                registrationInFlight.set(false);
                return;
            }

            postToken(task.getResult(), cookie);
        });
    }

    public void shutdown() {
        executor.shutdownNow();
    }

    private void postToken(String token, String cookie) {
        executor.execute(() -> {
            HttpURLConnection connection = null;

            try {
                JSONObject payload = new JSONObject();
                payload.put("token", token);
                payload.put("platform", "android");
                payload.put("appVersion", BuildConfig.VERSION_NAME);
                payload.put("locale", Locale.getDefault().toLanguageTag());

                byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
                URL url = new URL(REGISTER_URL);
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(10_000);
                connection.setReadTimeout(10_000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("Cookie", cookie);
                connection.setRequestProperty("User-Agent", "SouqHamadCapacitor Android/" + BuildConfig.VERSION_NAME);
                connection.setFixedLengthStreamingMode(body.length);

                try (OutputStream outputStream = connection.getOutputStream()) {
                    outputStream.write(body);
                }

                connection.getResponseCode();
            } catch (Exception ignored) {
                // Push registration must not block the app experience.
            } finally {
                registrationInFlight.set(false);
                if (connection != null) {
                    connection.disconnect();
                }
            }
        });
    }
}
