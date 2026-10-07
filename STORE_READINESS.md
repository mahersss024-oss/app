# Store Readiness Review

Date: 2026-10-06

## Verdict

Status: PARTIAL_READY

The Capacitor wrapper builds successfully for Android and the app identity,
launcher icon, splash assets, portrait orientation, HTTPS production URL, and
target SDK are in good shape. Final publication is still blocked by external
store items: production signing, App Store archive/TestFlight, privacy forms,
review account, and a complete set of real in-app screenshots.

## Confirmed Ready

- App name: سوق حمد
- Package / bundle id: com.souqhamad.app
- Production URL: https://souqhamad.com
- Android target SDK: 36
- Android min SDK: 24
- Android release build command succeeds: `android/gradlew.bat :app:bundleRelease`
- Android permissions are minimal in source: `INTERNET`
- App is locked to portrait on Android, iPhone, and iPad.
- Android backup is disabled.
- iOS app icons were flattened to remove alpha transparency for App Store validation.

## Created Store Assets

Generated in `store-assets/`:

- `google-play-icon-512.png` - 512 x 512, copied from the main project's `app/icon.png`.
- `google-play-feature-graphic-1024x500.png` - 1024 x 500 placeholder derived from the platform logo asset. Do not treat it as the welcome screen; replace it with an approved Google Play feature graphic before submission.
- `google-phone-screenshot-01-1080x1920.png` - 1080 x 1920, no alpha.
- `app-store-iphone-dynamic-medium-01-1179x2556.png` - 1179 x 2556, no alpha.

## Important Findings

- Existing `android/app/build/outputs/bundle/release/app-release.aab` is still not
  production-signed. `jarsigner` reports: `jar is unsigned`.
- Several existing screenshots are not store-ready because they show the launcher,
  app drawer, Android recents screen, or blank/black loading states.
- Google Play requires at least two screenshots for publishing, and recommends at
  least four app screenshots at 1080 px or larger.
- The current generated screenshots are a starting point only. Capture final real
  screens from the live app after login/guest flows are stable.
- The platform logo / app icon asset is not the welcome message screen. Do not
  use it as proof that the store feature graphic matches the welcome flow.

## Needs Before Google Play Submission

- Configure release signing with a private upload key outside source control.
- Build a signed release AAB.
- Upload store assets:
  - 512 x 512 app icon.
  - 1024 x 500 feature graphic.
  - At least two screenshots, preferably four or more.
- Complete store listing:
  - App name.
  - Short description, 80 characters max.
  - Full description, 4000 characters max.
  - Category, contact email, support URL, privacy policy URL.
- Complete Play Console App content forms:
  - Data safety.
  - Ads declaration.
  - Content rating.
  - Target audience.
  - News/government/financial declarations if applicable.
- Provide tester/reviewer account if restricted features require login.

## Needs Before App Store Submission

- Archive on macOS/Xcode or a cloud Mac builder with the Apple Developer account.
- Configure signing team, provisioning profile, and App Store Connect app record.
- Upload at least one required iPhone screenshot. More are strongly recommended.
- If the app supports iPadOS, upload the required 13-inch iPad screenshot or limit
  device support intentionally.
- Complete App Privacy details in App Store Connect.
- Provide privacy policy URL, support URL, copyright, age rating, and review notes.
- Provide reviewer login credentials if needed.

## Recommended Final Screenshots

Capture these as real app screens, not launcher/system screens:

- Home/listing feed.
- Search and filters.
- Listing details.
- Create listing or chat flow.
- Account/login or favorites.

Avoid screenshots that show notification bars with personal notifications,
launcher/app drawer screens, emulator controls, Android recents, blank loading
states, or images from outside the actual app experience.
