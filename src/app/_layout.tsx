import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { AppState, Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
} from "@expo-google-fonts/ibm-plex-sans-arabic";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "../core/auth";
import { useNativePushLifecycle } from "../core/push";
import { useRealtime } from "../core/realtime";
import { colors, fonts } from "../ui/theme";
void SplashScreen.preventAutoHideAsync().catch(() => {});
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});
function AppLifecycle() {
  const { user, refresh } = useAuth();
  useNativePushLifecycle(user?.id);
  useRealtime(user?.id);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      focusManager.setFocused(state === "active");
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  return null;
}
export default function RootLayout() {
  const [loaded, error] = useFonts({
    ArabicRegular: IBMPlexSansArabic_400Regular,
    ArabicMedium: IBMPlexSansArabic_500Medium,
    ArabicBold: IBMPlexSansArabic_600SemiBold,
  });
  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);
  if (!loaded && !error)
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppLifecycle />
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation:
                Platform.OS === "android"
                  ? "fade_from_bottom"
                  : "slide_from_right",
              headerTitleStyle: { fontFamily: fonts.bold },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth" options={{ presentation: "modal" }} />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
