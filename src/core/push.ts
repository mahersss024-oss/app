import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { fetch as nativeFetch } from "expo/fetch";
import { getApiBaseUrl, getSessionToken } from "./api";

const preferenceKey = "hamad.native-push.enabled";
const registrationKey = "hamad.native-push.registration";
const pendingKey = "hamad.native-push.pending-removal";
let registeredToken: string | null = null;
let generation = 0;
let suspended = false;
let inFlight: Promise<unknown> = Promise.resolve();
type Removal = { token: string; bearer: string; baseUrl: string };
const secureOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function pushRequest(
  method: "POST" | "DELETE",
  body: unknown,
  bearer: string,
  baseUrl = getApiBaseUrl(),
) {
  // Capture the identity before starting. A later account switch must never
  // retarget an in-flight registration or removal to the new account.
  const response = await nativeFetch(`${baseUrl}/api/mobile/push/register`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok && !(method === "DELETE" && response.status === 401))
    throw new Error(
      "تعذر تحديث إشعارات الجهاز. تحقق من الاتصال وأعد المحاولة.",
    );
}

async function flushPending() {
  const raw = await SecureStore.getItemAsync(pendingKey);
  if (!raw) return;
  const pending = JSON.parse(raw) as Removal;
  if (pending.baseUrl !== getApiBaseUrl()) return;
  await pushRequest(
    "DELETE",
    { token: pending.token },
    pending.bearer,
    pending.baseUrl,
  );
  if ((await SecureStore.getItemAsync(pendingKey)) === raw)
    await SecureStore.deleteItemAsync(pendingKey);
}

function nativeToken(token: Notifications.DevicePushToken) {
  if (
    (token.type !== "ios" && token.type !== "android") ||
    typeof token.data !== "string" ||
    token.data.startsWith("ExponentPushToken[") ||
    token.data.startsWith("ExpoPushToken[")
  ) {
    throw new Error("تعذر الحصول على رمز إشعارات الجهاز الأصلي.");
  }
  return token.data;
}

async function registerNow(
  token: Notifications.DevicePushToken,
  expectedGeneration: number,
) {
  const value = nativeToken(token);
  if (suspended || expectedGeneration !== generation) return;
  const bearer = getSessionToken();
  if (!bearer) throw new Error("سجّل الدخول لتفعيل إشعارات حسابك.");
  await flushPending();
  await pushRequest(
    "POST",
    {
      token: value,
      platform: Platform.OS,
      locale: "ar-SA",
      appVersion: Constants.expoConfig?.version ?? "1.0.0",
    },
    bearer,
  );
  const registration: Removal = {
    token: value,
    bearer,
    baseUrl: getApiBaseUrl(),
  };
  await SecureStore.setItemAsync(
    registrationKey,
    JSON.stringify(registration),
    secureOptions,
  );
  if (expectedGeneration !== generation) {
    await SecureStore.setItemAsync(
      pendingKey,
      JSON.stringify(registration),
      secureOptions,
    );
    await flushPending();
    await SecureStore.deleteItemAsync(registrationKey);
    return;
  }
  registeredToken = value;
}

function register(
  token: Notifications.DevicePushToken,
  expectedGeneration = generation,
) {
  const result = inFlight
    .catch(() => {})
    .then(() => registerNow(token, expectedGeneration));
  inFlight = result;
  return result;
}

/** Call from a user-operated notification setting, never at application boot. */
export async function enableNativePush() {
  if (!Device.isDevice || (Platform.OS !== "ios" && Platform.OS !== "android"))
    throw new Error("الإشعارات تحتاج جهازًا حقيقيًا ونسخة تطبيق مُثبتة.");
  const ownerSession = getSessionToken();
  if (!ownerSession) throw new Error("سجّل الدخول لتفعيل إشعارات حسابك.");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("default", {
      name: "إشعارات سوق حمد",
      importance: AndroidImportance.HIGH,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted)
    permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "لم يتم السماح بالإشعارات. يمكنك تفعيلها لاحقًا من إعدادات الجهاز.",
    );
  if (ownerSession !== getSessionToken())
    throw new Error("تغيّر الحساب. أعد تفعيل الإشعارات من حسابك الحالي.");
  suspended = false;
  await register(await Notifications.getDevicePushTokenAsync());
  await SecureStore.setItemAsync(preferenceKey, "1");
}

export async function unregisterNativePushBeforeSignOut() {
  suspended = true;
  generation++;
  await inFlight.catch(() => {});
  try {
    const saved = await SecureStore.getItemAsync(registrationKey);
    const registration = saved
      ? (JSON.parse(saved) as Removal)
      : registeredToken && getSessionToken()
        ? {
            token: registeredToken,
            bearer: getSessionToken()!,
            baseUrl: getApiBaseUrl(),
          }
        : null;
    if (registration) {
      await SecureStore.setItemAsync(
        pendingKey,
        JSON.stringify(registration),
        secureOptions,
      );
      await flushPending();
    }
    await SecureStore.deleteItemAsync(registrationKey);
  } finally {
    registeredToken = null;
    await Notifications.unregisterForNotificationsAsync().catch(() => {});
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  }
}

export async function disableNativePush() {
  await SecureStore.deleteItemAsync(preferenceKey);
  await unregisterNativePushBeforeSignOut();
}

function navigateFromNotification(
  response: Notifications.NotificationResponse,
) {
  const data = response.notification.request.content.data;
  const path = typeof data?.url === "string" ? data.url : "";
  // Accept only known app destinations; authorization is rechecked by each API.
  const conversation = path.match(/^\/conversations\/([A-Za-z0-9_-]+)$/);
  const listing = path.match(/^\/listings\/([A-Za-z0-9_-]+)$/);
  if (conversation) router.push(`/conversations/${conversation[1]}` as never);
  else if (listing) router.push(`/listings/${listing[1]}` as never);
}

export function useNativePushLifecycle(userId?: string | null) {
  useEffect(() => {
    void flushPending().catch(() => {});
    if (
      !userId ||
      !Device.isDevice ||
      (Platform.OS !== "ios" && Platform.OS !== "android")
    )
      return;
    suspended = false;
    generation++;
    const sessionAtMount = getSessionToken();
    let disposed = false;
    const restore = async () => {
      const current = generation;
      if ((await SecureStore.getItemAsync(preferenceKey)) !== "1") return;
      const permission = await Notifications.getPermissionsAsync();
      if (
        !disposed &&
        permission.granted &&
        current === generation &&
        getSessionToken() === sessionAtMount
      )
        await register(await Notifications.getDevicePushTokenAsync(), current);
    };
    void restore().catch(() => {});
    const tokenSub = Notifications.addPushTokenListener((token) => {
      const current = generation;
      void SecureStore.getItemAsync(preferenceKey)
        .then((enabled) => {
          if (
            !disposed &&
            enabled === "1" &&
            getSessionToken() === sessionAtMount
          )
            return register(token, current);
        })
        .catch(() => {});
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      navigateFromNotification,
    );
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!disposed && response) {
        navigateFromNotification(response);
        void Notifications.clearLastNotificationResponseAsync();
      }
    });
    const stateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") void restore().catch(() => {});
    });
    return () => {
      disposed = true;
      generation++;
      tokenSub.remove();
      responseSub.remove();
      stateSub.remove();
    };
  }, [userId]);
}
