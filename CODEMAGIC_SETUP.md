# Codemagic setup

This repository includes `codemagic.yaml` for building the Souq Hamad Capacitor app on Codemagic.

## Project facts

- Project type: Capacitor WebView app.
- Package manager: pnpm.
- App URL: `https://souqhamad.com`.
- Android application ID: `com.souqhamad.app`.
- iOS bundle ID: `com.souqhamad.app`.
- Current deep link scheme: `smartstore://auth`.

Do not rename the app ID, bundle ID, or deep link scheme unless the website OAuth callback configuration is migrated at the same time.

## Connect the repository

1. Open Codemagic.
2. Connect GitHub.
3. Choose this repository: `mahersss024-oss/app`.
4. Select "Use codemagic.yaml".
5. Choose one workflow:
   - `android-release` for Google Play AAB.
   - `ios-release` for App Store/TestFlight IPA.

## Android signing

In Codemagic, open Team settings, then `codemagic.yaml settings`, then `Code signing identities`, then `Android keystores`.

Upload the local keystore file:

```text
C:\Users\maher\Desktop\app\mobile-app\android\upload-keystore.jks
```

Use this reference name exactly:

```text
souq_hamad_upload_keystore
```

Codemagic will then expose these variables during the build:

```text
CM_KEYSTORE_PATH
CM_KEYSTORE_PASSWORD
CM_KEY_ALIAS
CM_KEY_PASSWORD
```

Do not upload `android/keystore.properties` to GitHub.

## iOS signing

For the `ios-release` workflow, Codemagic needs App Store signing files for:

```text
com.souqhamad.app
```

Use one of these Codemagic-supported approaches:

1. Upload an Apple Distribution certificate and App Store provisioning profile in Codemagic Code signing identities.
2. Or connect App Store Connect / Apple Developer Portal in Codemagic and let Codemagic fetch or create the matching signing files.

Required Apple values stay inside Codemagic only:

```text
APP_STORE_CONNECT_KEY_IDENTIFIER
APP_STORE_CONNECT_ISSUER_ID
APP_STORE_CONNECT_PRIVATE_KEY
CERTIFICATE_PRIVATE_KEY
```

Do not put `.p8`, `.p12`, `.mobileprovision`, Apple passwords, or API keys in GitHub.

## Build outputs

Android AAB:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

iOS IPA:

```text
build/ios/ipa/*.ipa
```

## Publishing

The current workflows build signed artifacts only. They do not automatically submit to Production.

After a successful Android build, upload the AAB to Google Play Internal Testing first. Production rollout should remain manual until approved.
