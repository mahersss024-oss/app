# Codemagic readiness audit

## Summary

- Project type: Capacitor native wrapper for the live website.
- Package manager: pnpm, based on `pnpm-lock.yaml`.
- App URL: `https://souqhamad.com`.
- App ID / bundle ID: `com.souqhamad.app`.
- Android folder: present.
- iOS folder: present.
- Web folder: present, minimal fallback content because the app loads the remote website.

## Capacitor

- `capacitor.config.ts` defines `appId` as `com.souqhamad.app`.
- `webDir` is `www`.
- `server.url` is controlled by `SOUQ_HAMAD_APP_URL` and defaults to `https://souqhamad.com`.
- Splash and WebView backgrounds use the dark site color `#08111d`.

## Android

- Android `applicationId` is `com.souqhamad.app`.
- Release signing is configured through `android/keystore.properties` locally.
- Codemagic signing is configured through app-level secure environment variables: `CM_KEYSTORE`, `CM_KEYSTORE_PASSWORD`, `CM_KEY_ALIAS`, and `CM_KEY_PASSWORD`.
- Build output is AAB for Google Play.

## iOS

- Xcode project exists at `ios/App/App.xcodeproj`.
- Bundle identifier resolves to `com.souqhamad.app`.
- No local IPA build should be attempted on Windows.
- Codemagic `ios-release` is configured for a macOS build machine, App Store Connect integration `codemagic`, and App Store distribution signing.
- `ITSAppUsesNonExemptEncryption` is set to `false` because the native wrapper does not add custom encryption.

## Deep links and OAuth

- Android and iOS both register `smartstore://auth`.
- This was not changed because it may be tied to existing OAuth callback settings.
- App links / universal links are not configured in this native wrapper.

## Native push

- Native FCM/APNs push is unverified.
- The project has a conditional `google-services.json` hook, but no Firebase config is committed.
- Website Web Push may exist separately; this audit does not claim native push is ready.

## Security

- `.gitignore` excludes node modules, build outputs, Gradle local files, keystores, `.p8`, `.p12`, `.mobileprovision`, and service account JSON files.
- No signing secret should be committed to GitHub.

## Status

READY for Codemagic repository detection and Android cloud build after adding the app-level Android signing environment variables.

BLOCKED for signed iOS IPA until Apple Developer / App Store Connect signing is configured inside Codemagic.
