import { fetch as expoFetch } from "expo/fetch";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import type { UploadAsset } from "./types";

let sessionToken: string | null = null;
let agreementToken: string | null = null;
let generation = 0;
const controllers = new Set<AbortController>();
export const getApiBaseUrl = () =>
  (process.env.EXPO_PUBLIC_API_URL || "https://souqhamad.com").replace(
    /\/+$/,
    "",
  );
export const getSessionToken = () => sessionToken;
export const getAgreementToken = () => agreementToken;
export function setApiIdentity(
  session: string | null,
  agreement?: string | null,
) {
  if (session !== sessionToken) {
    generation += 1;
    for (const controller of controllers) controller.abort();
    controllers.clear();
  }
  sessionToken = session;
  if (agreement !== undefined) agreementToken = agreement;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
const messages: Record<string, string> = {
  auth_required: "سجّل دخولك للمتابعة.",
  cross_site_request_blocked: "تعذّر الاتصال بالخدمة من هذه البيئة.",
  listing_not_found: "هذا الإعلان غير متاح حاليًا.",
  conversation_not_found: "المحادثة غير متاحة.",
  commission_locked: "حالة الرسوم معتمدة ولا يمكن تعديلها.",
  seller_listing_limit_reached: "وصل حسابك إلى الحد المسموح من الإعلانات.",
  account_deactivated: "الحساب موقوف. تواصل مع إدارة المنصة.",
  commission_agreement_required: "وافق على اتفاقية المنصة قبل تسجيل الدخول.",
  google_native_unavailable: "تسجيل Google غير مهيأ على السيرفر حاليًا.",
  invalid_google_id_token:
    "رفض السيرفر رمز Google. تحقّق من مطابقة Client ID بين التطبيق والسيرفر.",
  google_registration_failed:
    "تعذّر إنشاء الحساب على السيرفر بعد التحقق من Google. حاول لاحقًا.",
  image_too_large: "حجم الصورة يتجاوز الحد المسموح.",
  listing_image_limit_reached: "وصل الإعلان إلى الحد المسموح من الصور.",
};
export function assetUrl(url?: string | null) {
  if (!url) return undefined;
  if (/^https:\/\//i.test(url) || /^data:image\//i.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//"))
    return `${getApiBaseUrl()}${url}`;
  if (
    __DEV__ &&
    /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:|\/)/.test(url)
  )
    return url;
  return undefined;
}
function requestUrl(path: string, params?: Record<string, unknown>) {
  if (!path.startsWith("/api/"))
    throw new Error("Only server API paths are accepted.");
  const url = new URL(`${getApiBaseUrl()}${path}`);
  if (!__DEV__ && url.protocol !== "https:")
    throw new Error("HTTPS API is required.");
  for (const [key, value] of Object.entries(params || {}))
    if (value !== undefined && value !== null && value !== "")
      url.searchParams.set(key, String(value));
  return url.toString();
}
export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);
  if (agreementToken)
    headers.set("X-Souq-Hamad-Commission-Agreement", agreementToken);
  return expoFetch(requestUrl(path), { ...init, headers, credentials: "omit" });
}
type RequestOptions = {
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, unknown>,
  options: RequestOptions = {},
): Promise<T> {
  const startedGeneration = generation;
  const controller = new AbortController();
  controllers.add(controller);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, options.timeoutMs ?? 45000);
  try {
    const headers = new Headers({ Accept: "application/json" });
    if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);
    if (agreementToken)
      headers.set("X-Souq-Hamad-Commission-Agreement", agreementToken);
    if (options.idempotencyKey)
      headers.set("Idempotency-Key", options.idempotencyKey);
    const multipart = body instanceof FormData;
    if (body !== undefined && !multipart)
      headers.set("Content-Type", "application/json");
    const response = await expoFetch(requestUrl(path, params), {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : multipart
            ? body
            : JSON.stringify(body),
      signal: controller.signal,
      credentials: "omit",
    });
    if (startedGeneration !== generation)
      throw new ApiError(409, "account_changed", "تغيّر الحساب. أعد المحاولة.");
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (startedGeneration !== generation)
      throw new ApiError(409, "account_changed", "تغيّر الحساب. أعد المحاولة.");
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      throw new ApiError(
        response.status,
        "invalid_response",
        "استجابة الخدمة غير صالحة. حاول مرة أخرى.",
      );
    }
    if (!response.ok) {
      const error = data as { error?: string; message?: string };
      const code = error?.error || `http_${response.status}`;
      const message =
        messages[code] ||
        (error?.message && /[\u0600-\u06ff]/.test(error.message)
          ? error.message
          : response.status === 429
            ? "طلبات كثيرة، انتظر قليلًا ثم حاول مجددًا."
            : response.status >= 500
              ? "الخدمة غير متاحة مؤقتًا. حاول بعد قليل."
              : "تعذّر إتمام الطلب. راجع البيانات وحاول مجددًا.");
      throw new ApiError(response.status, code, message, data);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted)
      throw new ApiError(
        0,
        "aborted",
        "توقف الطلب أو انتهت مهلة الاتصال. أعد المحاولة.",
      );
    throw new ApiError(
      0,
      "network",
      "تعذّر الاتصال بالسيرفر. تحقق من الإنترنت وحاول مجددًا.",
    );
  } finally {
    clearTimeout(timer);
    controllers.delete(controller);
    options.signal?.removeEventListener("abort", abort);
  }
}
export const api = {
  get: <T>(
    path: string,
    params?: Record<string, unknown>,
    options?: RequestOptions,
  ) => request<T>("GET", path, undefined, params, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, undefined, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, undefined, options),
  delete: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("DELETE", path, body, undefined, options),
  upload: async <T>(
    path: string,
    asset: UploadAsset,
    options?: RequestOptions,
  ) => {
    const form = new FormData();
    if (Platform.OS === "web") {
      const response = await fetch(asset.uri);
      form.append("image", await response.blob(), asset.name);
    } else {
      // expo/fetch serializes File bytes; React Native's { uri } parts are unsupported.
      form.append("image", new File(asset.uri));
    }
    return request<T>("POST", path, form, undefined, {
      timeoutMs: 120000,
      ...options,
    });
  },
};
