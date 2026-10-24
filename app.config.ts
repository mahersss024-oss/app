import type { ConfigContext, ExpoConfig } from "expo/config";
export default function config({ config }: ConfigContext): ExpoConfig {
  const production = process.env.APP_VARIANT === "production";
  const identifier = production ? "com.souqhamad.app" : "com.souqhamad.app.dev";
  const googleIosScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  return {
    ...config,
    name: production ? "سوق حمد" : "سوق حمد · تجربة",
    slug: "souq-hamad",
    version: "1.0.33",
    orientation: "portrait",
    scheme: production ? "smartstore" : "souqhamad-dev",
    icon: "./assets/app-icon.png",
    userInterfaceStyle: "light",
    ios: {
      buildNumber: "34",
      supportsTablet: false,
      bundleIdentifier: identifier,
      usesAppleSignIn: true,
      associatedDomains: ["applinks:souqhamad.com"],
      infoPlist: {
        CFBundleAllowMixedLocalizations: true,
        CFBundleLocalizations: ["ar", "en"],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      versionCode: 34,
      icon: "./assets/app-icon.png",
      package: identifier,
      predictiveBackGestureEnabled: true,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || undefined,
      permissions: [
        "android.permission.CAMERA",
        "android.permission.POST_NOTIFICATIONS",
      ],
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "souqhamad.com",
              pathPrefix: "/listings/",
            },
            { scheme: "https", host: "souqhamad.com", pathPrefix: "/sellers/" },
            {
              scheme: "https",
              host: "souqhamad.com",
              pathPrefix: "/conversations/",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    web: { bundler: "metro", output: "single", favicon: "./assets/brand.png" },
    plugins: [
      "expo-router",
      "expo-image",
      "expo-font",
      "expo-secure-store",
      "expo-apple-authentication",
      ["expo-location", {
        locationWhenInUsePermission: "اسمح لسوق حمد بتحديد أقرب مدينة لعرض إعلانات منطقتك.",
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      }],
      ["expo-build-properties", { android: { cmakeVersion: "3.31.6" } }],
      "./plugins/with-windows-cmake-object-path",
      "./plugins/with-codemagic-android-signing",
      [
        "expo-image-picker",
        {
          photosPermission:
            "اسمح لسوق حمد باختيار صور إعلانك أو صورتك الشخصية.",
          cameraPermission: "اسمح لسوق حمد بتصوير منتجك لإضافته إلى إعلانك.",
          microphonePermission: false,
        },
      ],
      ["expo-notifications", { color: "#2866B2", defaultChannel: "default" }],
      [
        "expo-splash-screen",
        {
          image: "./assets/hamad-market-wordmark.png",
          imageWidth: 260,
          backgroundColor: "#0D2B28",
        },
      ],
      ...(googleIosScheme
        ? [
            [
              "@react-native-google-signin/google-signin",
              { iosUrlScheme: googleIosScheme },
            ] as [string, { iosUrlScheme: string }],
          ]
        : []),
    ],
    experiments: { typedRoutes: true },
    extra: {
      ...config.extra,
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://souqhamad.com",
    },
  };
}
