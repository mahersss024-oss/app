package com.souqhamad.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OAuthNavigation")
public class OAuthNavigationPlugin extends Plugin {
    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        if (url == null || getActivity() == null) {
            return null;
        }

        String host = url.getHost();
        String scheme = url.getScheme();

        if (
            "mailto".equalsIgnoreCase(scheme) ||
            "tel".equalsIgnoreCase(scheme) ||
            "sms".equalsIgnoreCase(scheme)
        ) {
            Intent intent = new Intent(Intent.ACTION_VIEW, url);

            try {
                getActivity().startActivity(intent);
            } catch (ActivityNotFoundException ignored) {
            }

            return true;
        }

        if (
            "accounts.google.com".equals(host) ||
            "oauth2.googleapis.com".equals(host) ||
            "appleid.apple.com".equals(host)
        ) {
            Intent intent = new Intent(Intent.ACTION_VIEW, url);
            getActivity().startActivity(intent);
            return true;
        }

        return null;
    }
}
