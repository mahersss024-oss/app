# Android Internal Testing

Date: 2026-10-07

## Build Artifact

Upload this Android App Bundle to Google Play Console:

`android/app/build/outputs/bundle/release/app-release.aab`

Current package name:

`com.souqhamad.app`

Current version:

- `versionCode`: 1
- `versionName`: 1.0

## Signing

Release signing is configured through local-only files:

- `android/upload-keystore.jks`
- `android/keystore.properties`

These files are intentionally ignored by Git. Back them up securely. The upload
key fingerprint is:

`SHA256: 3A:0A:A0:AD:75:8A:D0:9A:32:DF:70:96:9A:B2:A2:E0:BD:C3:55:DE:40:03:AD:33:6F:54:16:39:E5:0C:4F:BC`

Do not share `keystore.properties` or the keystore password.

## Build Command

From `android/`:

```powershell
./gradlew.bat :app:bundleRelease
```

## Google Play Console Steps

1. Create the app in Google Play Console.
2. Package name: `com.souqhamad.app`.
3. Go to Testing > Internal testing.
4. Create a new release.
5. Upload `android/app/build/outputs/bundle/release/app-release.aab`.
6. Complete required App content forms:
   - Data safety.
   - Ads declaration.
   - Content rating.
   - Target audience.
   - Privacy policy URL.
7. Add internal testers by email list or Google Group.
8. Roll out to internal testing.
9. Open the opt-in link on the Android device and install from Google Play.

## Before Production

- Keep the upload key backed up.
- Increment `versionCode` for every new uploaded release.
- Test login, listing search, listing details, account, chat, and OAuth flows on a real Android device.
