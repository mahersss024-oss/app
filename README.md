# Souq Hamad Mobile App

This folder is the native mobile integration layer for the existing Souq Hamad
Next.js application. It intentionally does not copy the web app, backend,
database, Prisma schema, API routes, service worker, or marketplace systems.

## Architecture

- Capacitor opens the canonical production app at `https://souqhamad.com`.
- The existing Next.js project remains the source of truth for UI, routing,
  auth, listings, conversations, push subscriptions, legal pages, and data.
- The native app reuses the existing web native bridge in `components/native-app-bridge.tsx`.
- PWA service-worker behavior stays owned by the website and is not bundled
  into the Capacitor app.

## Commands

```bash
pnpm install
pnpm sync
pnpm doctor
pnpm open:android
pnpm open:ios
```

To point a local native build at another deployed compatible origin:

```bash
$env:SOUQ_HAMAD_APP_URL = "https://souqhamad.com"
pnpm sync
```

## External Requirements

- Android Studio and a supported Android SDK for Android builds.
- Xcode or a macOS cloud build service for iOS archive/TestFlight builds.
- Google Play signing configuration or Play App Signing access.
- Apple Developer account, signing certificates, provisioning profiles, and
  App Store Connect access.
- Store listing metadata, privacy declarations, screenshots, and reviewer notes.

