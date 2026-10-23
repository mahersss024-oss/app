import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import { useQueryClient } from "@tanstack/react-query";
import { isGoogleSignInSuccess } from "./native-auth";
import {
  api,
  getApiBaseUrl,
  getAgreementToken,
  getSessionToken,
  setApiIdentity,
} from "./api";
import type { User } from "./types";

type AuthResult = {
  authenticated: boolean;
  user: User | null;
  sessionToken?: string;
};
type AuthContextValue = {
  user: User | null;
  status: "loading" | "guest" | "authenticated";
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  acceptAgreement: () => Promise<void>;
  signInGoogle: () => Promise<boolean>;
  signInApple: () => Promise<void>;
};
const Context = createContext<AuthContextValue | null>(null);
const storageKey = `souq-hamad-session-${getApiBaseUrl().replace(/[^a-z0-9]/gi, "_")}`;
async function readStorage() {
  if (Platform.OS === "web") return null;
  try {
    return await SecureStore.getItemAsync(storageKey);
  } catch {
    return null;
  }
}
async function saveStorage(token: string | null, agreement: string | null) {
  if (Platform.OS === "web") return;
  if (token)
    await SecureStore.setItemAsync(
      storageKey,
      JSON.stringify({ token, agreement }),
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );
  else await SecureStore.deleteItemAsync(storageKey);
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const epoch = useRef(0);
  const operation = useRef<"login" | "logout" | null>(null);
  const storageQueue = useRef<Promise<unknown>>(Promise.resolve());
  const queryClient = useQueryClient();
  const persist = useCallback(
    (token: string | null, agreement: string | null) => {
      const pending = storageQueue.current
        .catch(() => {})
        .then(() => saveStorage(token, agreement));
      storageQueue.current = pending;
      return pending;
    },
    [],
  );
  const refresh = useCallback(async () => {
    if (operation.current) return;
    const id = epoch.current;
    try {
      const response = await api.get<AuthResult>("/api/auth/session");
      if (id !== epoch.current) return;
      if (response.authenticated && response.user) {
        setUser(response.user);
        setStatus("authenticated");
        setError(null);
      } else {
        const hadSession = Boolean(getSessionToken());
        epoch.current += 1;
        setUser(null);
        setStatus("guest");
        setApiIdentity(null, getAgreementToken());
        if (hadSession) {
          await queryClient.cancelQueries();
          queryClient.clear();
        }
        await persist(null, null);
      }
    } catch (e) {
      if (id !== epoch.current) return;
      setError(e instanceof Error ? e.message : "تعذّر التحقق من الحساب.");
      setStatus((previous) =>
        previous === "authenticated" ? previous : "guest",
      );
    }
  }, [queryClient, persist]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const value = await readStorage();
      if (!alive) return;
      if (value) {
        try {
          const parsed = JSON.parse(value) as {
            token: string;
            agreement?: string;
          };
          if (typeof parsed.token === "string")
            setApiIdentity(parsed.token, parsed.agreement || null);
        } catch {
          await saveStorage(null, null);
        }
      }
      await refresh();
    })();
    return () => {
      alive = false;
      epoch.current += 1;
    };
  }, [refresh]);
  const acceptAgreement = useCallback(async () => {
    const result = await api.post<{ agreementToken: string }>(
      "/api/auth/commission-agreement",
      { accepted: true },
    );
    if (!result.agreementToken) throw new Error("تعذّر تسجيل الموافقة.");
    const { getSessionToken } = await import("./api");
    setApiIdentity(getSessionToken(), result.agreementToken);
  }, []);
  const complete = useCallback(
    async (response: AuthResult, expectedEpoch: number) => {
      if (expectedEpoch !== epoch.current) return;
      if (!response.authenticated || !response.user || !response.sessionToken)
        throw new Error("تعذّر إكمال تسجيل الدخول.");
      await queryClient.cancelQueries();
      if (expectedEpoch !== epoch.current) return;
      queryClient.clear();
      await persist(response.sessionToken, getAgreementToken());
      if (expectedEpoch !== epoch.current) return;
      setApiIdentity(response.sessionToken, getAgreementToken());
      setUser(response.user);
      setStatus("authenticated");
      setError(null);
    },
    [queryClient, persist],
  );
  const signInGoogle = useCallback(async () => {
    if (operation.current) return false;
    operation.current = "login";
    const loginEpoch = ++epoch.current;
    try {
      if (
        Platform.OS === "web" ||
        Constants.executionEnvironment === "storeClient"
      )
        throw new Error("تسجيل الدخول متاح من نسخة التطبيق المثبتة.");
      const { clientId } = await api.get<{ clientId: string }>(
        "/api/auth/google/native-config",
      );
      const { GoogleSignin } = await import(
        "@react-native-google-signin/google-signin"
      );
      GoogleSignin.configure({
        webClientId: clientId,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      });
      if (Platform.OS === "android")
        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });
      const result = await GoogleSignin.signIn();
      if (!isGoogleSignInSuccess(result)) return false;
      const idToken = result.data.idToken;
      if (!idToken) throw new Error("تعذّر الحصول على بيانات تسجيل الدخول.");
      if (loginEpoch !== epoch.current) return false;
      await complete(
        await api.post<AuthResult>("/api/auth/google/native", { idToken }),
        loginEpoch,
      );
      return loginEpoch === epoch.current;
    } finally {
      if (loginEpoch === epoch.current) operation.current = null;
    }
  }, [complete]);
  const signInApple = useCallback(async () => {
    if (operation.current) return;
    operation.current = "login";
    const loginEpoch = ++epoch.current;
    try {
      if (
        Platform.OS !== "ios" ||
        !(await AppleAuthentication.isAvailableAsync())
      )
        throw new Error("تسجيل الدخول باستخدام Apple غير متاح على هذا الجهاز.");
      const codeVerifier =
        `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replaceAll("-", "");
      const codeChallenge = (
        await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          codeVerifier,
          { encoding: Crypto.CryptoEncoding.BASE64 },
        )
      )
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replace(/=+$/, "");
      const challenge = await api.post<{
        challengeToken: string;
        nonce: string;
      }>("/api/auth/apple/native/challenge", { codeChallenge });
      const state = Crypto.randomUUID();
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: challenge.nonce,
        state,
      });
      if (
        credential.state !== state ||
        !credential.identityToken ||
        !credential.authorizationCode
      )
        throw new Error("تعذّر التحقق من تسجيل الدخول.");
      const fullName = [
        credential.fullName?.givenName,
        credential.fullName?.familyName,
      ]
        .filter(Boolean)
        .join(" ");
      if (loginEpoch !== epoch.current) return;
      await complete(
        await api.post<AuthResult>("/api/auth/apple/native", {
          challengeToken: challenge.challengeToken,
          codeVerifier,
          identityToken: credential.identityToken,
          authorizationCode: credential.authorizationCode,
          fullName: fullName || undefined,
        }),
        loginEpoch,
      );
    } finally {
      if (loginEpoch === epoch.current) operation.current = null;
    }
  }, [complete]);
  const signOut = useCallback(async () => {
    operation.current = "logout";
    epoch.current += 1;
    setUser(null);
    setStatus("loading");
    try {
      const push = await import("./push");
      await push.unregisterNativePushBeforeSignOut();
    } catch {
      /* Local sign-out still completes when offline. */
    }
    try {
      await api.post("/api/auth/logout", undefined, { timeoutMs: 10000 });
    } catch {
      /* Expired/offline session must not trap the user. */
    }
    setApiIdentity(null, null);
    await queryClient.cancelQueries();
    queryClient.clear();
    try {
      await persist(null, null);
      setError(null);
    } catch {
      setError("خرجت من الحساب. تعذّر تحديث التخزين الآمن على الجهاز.");
    }
    setUser(null);
    setStatus("guest");
    operation.current = null;
    try {
      const history = await import("../features/assistant/history");
      await history.clearAllAssistantHistory();
    } catch {
      /* Stored text remains account and origin scoped if the OS store is unavailable. */
    }
  }, [queryClient, persist]);
  return (
    <Context.Provider
      value={{
        user,
        status,
        error,
        refresh,
        signOut,
        acceptAgreement,
        signInGoogle,
        signInApple,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error("AuthProvider is required.");
  return context;
}
