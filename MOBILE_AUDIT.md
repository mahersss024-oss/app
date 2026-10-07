# Mobile Audit

## Project Audit

- Framework: Next.js 16.3.3 with React 19.3.0.
- Package manager: pnpm 10.32.1.
- Build command: `pnpm build`.
- Runtime architecture: SSR/API application, not a static SPA.
- Production URL: `https://souqhamad.com` from `lib/app-url.ts` and metadata.
- Backend/API: Next.js route handlers under `app/api`.
- Database: Prisma/PostgreSQL for production, file mode available for local use.
- Auth: custom session cookies plus Google OAuth and Apple OAuth.
- PWA: `app/manifest.ts`, `public/sw.js`, and `components/service-worker-registrar.tsx`.
- Welcome screen: existing app welcome overlay in `components/app-welcome-splash.tsx`.
- Native bridge: existing `components/native-app-bridge.tsx`, `hooks/use-app-bridge.ts`,
  `lib/native/app-bridge.ts`, and `lib/native/deep-links.ts`.
- Notifications: Web Push via VAPID and `app/api/push/subscribe`.
- Realtime: server-sent event route at `app/api/realtime/stream`.
- Legal/store pages: privacy, terms, commission policy, listing policy, account deletion.

## Gap Analysis

| Area | Status | Notes |
| --- | --- | --- |
| Framework discovery | EXISTS | Next.js app router with API routes. |
| Production URL | EXISTS | `https://souqhamad.com`. |
| Static web bundle for Capacitor | NOT_APPLICABLE | App depends on SSR/API/backend services. |
| Capacitor shell | EXISTS | Added in `mobile-app`. |
| Android platform | PASS | Project generated, synced, and debug APK builds successfully. |
| iOS platform | PASS_FOR_PROJECT | Project generated and synced; archive still needs macOS/Xcode or cloud build. |
| Google auth | EXISTS | Existing OAuth routes; mobile redirect/client review still required. |
| Apple auth | EXISTS | Existing OAuth routes; native capability/signing review still required. |
| Session persistence | EXISTS | Cookie session implementation in `lib/auth/session.ts`. |
| Web Push | EXISTS | Website implementation exists. Native push adapter is UNVERIFIED. |
| Native push | UNVERIFIED | Requires APNs/FCM credentials and a backend token mapping decision. |
| Deep links | PASS_BASIC | Custom scheme `smartstore://` is configured on Android and iOS; universal/app links require signing and hosted association files if needed later. |
| File/image upload | EXISTS | Browser file input and API upload exist; native camera/gallery UX is UNVERIFIED. |
| Welcome screen reuse | EXISTS | Website welcome remains source of truth; native splash is short. |
| PWA cache isolation | EXISTS | Capacitor uses remote URL and does not bundle/copy `public/sw.js`. |
| Privacy/terms/support | PARTIAL | Privacy/terms/policies exist; support URL/store metadata still required. |
| Account deletion | EXISTS | Account page exposes delete account flow. |
| Store screenshots/listings | MISSING | Requires device builds and final store assets. |
| Signing secrets | MISSING | Must not be committed. |

## PWA Issue

The current service worker is intentionally minimal:

- `/sw.js` is served with no-cache headers.
- API routes are not cached.
- image requests are not intercepted.
- navigations prefer network and fall back to `/offline`.
- static Next assets are cached only after a successful network response.

This reduces risk of cached HTML pointing to old chunks and prevents the known
PWA loading issue from being copied into the native shell. The exact historical
root cause remains `UNVERIFIED` without reproducing the failing PWA state on a
device.

## Mobile Architecture Decision

Because the application uses Next.js SSR, route handlers, cookies, Prisma,
OAuth callbacks, web push subscriptions, and server-side marketplace logic, the
mobile integration uses Capacitor as a native shell for the canonical deployed
web app instead of copying or exporting the project. This keeps one production
system and avoids creating a second app to maintain.

## User Action Required

- Android Studio, Android SDK Command-line Tools, Platform Tools, Android
  Platform 36, and Build Tools 36.0.0 are installed.
- Set `ANDROID_HOME` or create `android/local.properties` with the local SDK path,
  for example `sdk.dir=C\:\\Users\\maher\\AppData\\Local\\Android\\Sdk`.
- Confirm the final App Store bundle identifier and Google Play package name.
- Provide Android signing/Play configuration outside source control.
- Provide Apple Developer signing/provisioning details outside source control.
- Confirm whether native push notifications are required for store release.
- Prepare store screenshots, descriptions, privacy forms, support URL, and review account.

## Test Results

| Check | Result | Notes |
| --- | --- | --- |
| `pnpm install` in `mobile-app` | PASS | Capacitor dependencies installed. |
| `pnpm cap add android` | PASS | Android project generated. |
| `pnpm cap add ios` | PASS | iOS project generated. |
| `pnpm sync` | PASS | Web fallback and native plugin config synced. |
| `pnpm doctor` | PASS | Command completed with exit code 0. |
| Java/JDK | PASS | Eclipse Temurin JDK 21 installed at `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`; Capacitor Android requires Java source release 21. |
| Android Studio | PASS | Installed at `C:\Program Files\Android\Android Studio`. |
| Android command-line tools | PASS | Installed at `C:\Users\maher\AppData\Local\Android\Sdk\cmdline-tools\latest`. |
| Android SDK path | PASS | `android/local.properties` points to `C:\Users\maher\AppData\Local\Android\Sdk`; file is ignored by Git. |
| Custom deep-link scheme | PASS | `smartstore://` registered in Android manifest and iOS Info.plist. |
| Native launch/welcome continuity | PASS | Native launch assets now use the same Souq Hamad wordmark and dark teal welcome-style background; Capacitor shows briefly for 450ms and fades out over 350ms for a smoother transition into the existing welcome screen. |
| App icons | PASS | Android and iOS launcher icons are generated from the existing Souq Hamad source icon at `C:\Users\maher\Desktop\AI\SmartStoreAI\app\icon.png`; Android uses `ic_launcher` only without `roundIcon` or adaptive icon XML. |
| App name | PASS | Android APK badging and iOS `Info.plist` show the Arabic display name `سوق حمد`. |
| Orientation | PASS | Android, iPhone, and iPad are constrained to portrait to match the current mobile experience and prevent rotation on every screen. |
| Android backup policy | PASS | Android `allowBackup` and `fullBackupContent` are disabled to avoid backing up WebView/session data from the native wrapper. |
| Android SDK packages | PASS | `platform-tools`, `platforms;android-36`, `build-tools;35.0.0`, and `build-tools;36.0.0` are installed. |
| Android `assembleDebug` | PASS | Debug APK created at `android/app/build/outputs/apk/debug/app-debug.apk`. |
| Android APK badging | PASS | Package `com.souqhamad.app`, label `سوق حمد`, min SDK 24, target SDK 36, launcher activity `com.souqhamad.app.MainActivity`, and portrait feature verified with `aapt dump badging`. |
| Android emulator install | PASS | Debug APK installed successfully on `emulator-5554`. |
| Android emulator launch | PASS | `com.souqhamad.app/.MainActivity` launched and became the focused activity. |
| Android WebView load | PASS | `https://souqhamad.com` loaded inside the app after initial emulator delay; screenshot verified Arabic marketplace UI. |
| Android rotation lock | PASS | Forcing device rotation kept the app in `SCREEN_ORIENTATION_PORTRAIT`; screenshot remained portrait. |
| Production HTTPS reachability | PASS | Local host and emulator network can reach `souqhamad.com` over HTTPS/DNS. |
| Android release/AAB | UNVERIFIED | Requires release signing configuration. |
| iOS archive/TestFlight | UNVERIFIED | Requires macOS/Xcode or cloud build and Apple signing credentials. |
| Functional device flows | UNVERIFIED | Requires installed device/simulator build. |
| Store readiness | PARTIAL | Technical wrapper exists; store metadata, signing, screenshots, and reviewer data remain external. |

## Final Verdict

`BLOCKED_BY_EXTERNAL_REQUIREMENTS`

Android/iOS projects are generated and synced. Android debug build passes and
produces `android/app/build/outputs/apk/debug/app-debug.apk`. Store submission
remains blocked by release signing, store metadata, screenshots, and device
verification requirements.
