package com.souqhamad.app;

import android.os.CancellationSignal;
import android.webkit.CookieManager;
import android.webkit.WebView;

import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;

import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

class NativeGoogleSignIn {
    private static final String CONFIG_ENDPOINT = MainActivity.APP_ORIGIN + "/api/auth/google/native-config";
    private static final String AUTH_ENDPOINT = MainActivity.APP_ORIGIN + "/api/auth/google/native";
    private static final String AGREEMENT_PATH = "/commission-agreement?provider=google";

    private final MainActivity activity;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private boolean inProgress = false;

    NativeGoogleSignIn(MainActivity activity) {
        this.activity = activity;
    }

    void start() {
        if (inProgress) {
            return;
        }

        inProgress = true;
        executor.execute(() -> {
            try {
                String clientId = fetchClientId();

                if (clientId == null || clientId.trim().isEmpty()) {
                    finishWithError("google_native_unavailable");
                    return;
                }

                requestGoogleCredential(clientId.trim());
            } catch (Exception exception) {
                finishWithError("google_native_unavailable");
            }
        });
    }

    private String fetchClientId() throws Exception {
        HttpURLConnection connection = openConnection(CONFIG_ENDPOINT);
        connection.setRequestMethod("GET");

        int status = connection.getResponseCode();
        String body = readResponseBody(connection);
        connection.disconnect();

        if (status < 200 || status >= 300) {
            return null;
        }

        return new JSONObject(body).optString("clientId", "");
    }

    private void requestGoogleCredential(String clientId) {
        GetGoogleIdOption googleIdOption = new GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(clientId)
            .setAutoSelectEnabled(false)
            .build();
        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build();
        CredentialManager credentialManager = CredentialManager.create(activity);

        credentialManager.getCredentialAsync(
            activity,
            request,
            new CancellationSignal(),
            ContextCompat.getMainExecutor(activity),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse result) {
                    handleCredentialResponse(result);
                }

                @Override
                public void onError(GetCredentialException exception) {
                    finish();
                }
            }
        );
    }

    private void handleCredentialResponse(GetCredentialResponse response) {
        Credential credential = response.getCredential();

        if (!(credential instanceof CustomCredential)) {
            finishWithError("google_native_unavailable");
            return;
        }

        CustomCredential customCredential = (CustomCredential) credential;

        if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(customCredential.getType())) {
            finishWithError("google_native_unavailable");
            return;
        }

        try {
            GoogleIdTokenCredential googleCredential = GoogleIdTokenCredential.createFrom(customCredential.getData());
            String idToken = googleCredential.getIdToken();

            if (idToken == null || idToken.trim().isEmpty()) {
                finishWithError("invalid_google_id_token");
                return;
            }

            exchangeIdToken(idToken);
        } catch (RuntimeException exception) {
            finishWithError("invalid_google_id_token");
        }
    }

    private void exchangeIdToken(String idToken) {
        executor.execute(() -> {
            try {
                HttpURLConnection connection = openConnection(AUTH_ENDPOINT);
                connection.setRequestMethod("POST");
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");

                byte[] body = new JSONObject()
                    .put("idToken", idToken)
                    .toString()
                    .getBytes(StandardCharsets.UTF_8);

                connection.setFixedLengthStreamingMode(body.length);

                try (OutputStream output = connection.getOutputStream()) {
                    output.write(body);
                }

                int status = connection.getResponseCode();
                String responseBody = readResponseBody(connection);
                persistResponseCookies(connection.getHeaderFields());
                connection.disconnect();

                if (status >= 200 && status < 300) {
                    finishWithSuccess();
                    return;
                }

                String error = new JSONObject(responseBody).optString("error", "google_native_failed");

                if ("commission_agreement_required".equals(error)) {
                    loadTrustedPath(AGREEMENT_PATH);
                    finish();
                    return;
                }

                finishWithError(error);
            } catch (Exception exception) {
                finishWithError("google_native_failed");
            }
        });
    }

    private HttpURLConnection openConnection(String value) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(value).openConnection();
        String cookies = CookieManager.getInstance().getCookie(MainActivity.APP_ORIGIN);

        connection.setConnectTimeout(15000);
        connection.setReadTimeout(15000);
        connection.setUseCaches(false);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("User-Agent", "SouqHamadCapacitor Android");

        if (cookies != null && !cookies.trim().isEmpty()) {
            connection.setRequestProperty("Cookie", cookies);
        }

        return connection;
    }

    private String readResponseBody(HttpURLConnection connection) throws Exception {
        BufferedReader reader = new BufferedReader(
            new InputStreamReader(
                connection.getResponseCode() >= 400 ? connection.getErrorStream() : connection.getInputStream(),
                StandardCharsets.UTF_8
            )
        );
        StringBuilder builder = new StringBuilder();
        String line;

        while ((line = reader.readLine()) != null) {
            builder.append(line);
        }

        reader.close();
        return builder.toString();
    }

    private void persistResponseCookies(Map<String, List<String>> headers) {
        CookieManager cookieManager = CookieManager.getInstance();
        List<String> setCookies = headers.get("Set-Cookie");

        if (setCookies == null) {
            setCookies = headers.get("set-cookie");
        }

        if (setCookies == null) {
            return;
        }

        for (String cookie : setCookies) {
            cookieManager.setCookie(MainActivity.APP_ORIGIN, cookie);
        }

        cookieManager.flush();
    }

    private void finishWithSuccess() {
        loadTrustedPath("/");
        finish();
    }

    private void finishWithError(String error) {
        loadTrustedPath("/?auth_error=" + android.net.Uri.encode(error));
        finish();
    }

    private void loadTrustedPath(String path) {
        activity.runOnUiThread(() -> {
            WebView webView = activity.getBridge() == null ? null : activity.getBridge().getWebView();

            if (webView != null) {
                webView.loadUrl(MainActivity.APP_ORIGIN + path);
            }
        });
    }

    private void finish() {
        activity.runOnUiThread(() -> inProgress = false);
    }
}
