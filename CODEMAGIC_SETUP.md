# Codemagic setup

This repository includes `codemagic.yaml` for building the Android App Bundle in Codemagic.

## Connect the repository

1. Open Codemagic.
2. Connect GitHub.
3. Choose this repository: `mahersss024-oss/app`.
4. Select "Use codemagic.yaml".
5. Choose the workflow: `Android Internal Testing`.

## Add Android signing

Create an environment variable group named:

```text
souq_hamad_android_signing
```

Add these secure variables:

```text
CM_KEYSTORE_PATH
CM_KEYSTORE_PASSWORD
CM_KEY_ALIAS
CM_KEY_PASSWORD
```

The local upload keystore file is not committed to GitHub. Upload it to Codemagic signing settings or store it securely in Codemagic, then map the generated path/password variables to the names above.

Local keystore path:

```text
C:\Users\maher\Desktop\app\mobile-app\android\upload-keystore.jks
```

Do not upload `android/keystore.properties` to GitHub.

## Build output

Codemagic will generate the signed AAB here:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

Upload that file to Google Play Internal Testing.
