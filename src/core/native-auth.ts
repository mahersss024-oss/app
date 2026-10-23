export function isGoogleSignInSuccess<T extends { type: string }>(
  response: T | null | undefined,
): response is Extract<T, { type: "success" }> {
  return response?.type === "success";
}

export function googleSignInErrorMessage(
  error: unknown,
  packageId?: string,
) {
  const value =
    error && typeof error === "object"
      ? (error as { code?: unknown; message?: unknown; cause?: unknown })
      : undefined;
  const code = typeof value?.code === "string" ? value.code : "";
  const message = error instanceof Error ? error.message : "";
  const details = `${code} ${message}`.toUpperCase();

  if (
    code === "10" ||
    details.includes("DEVELOPER_ERROR") ||
    details.includes("DEVELOPER ERROR")
  ) {
    const appId = packageId ? ` (${packageId})` : "";
    return `إعداد Google لا يطابق نسخة التطبيق${appId}. يلزم تسجيل تطبيق Android بمعرف الحزمة وبصمة SHA-1 لتوقيع هذه النسخة، واستخدام Client ID من نوع Web المعتمد على السيرفر.`;
  }
  if (details.includes("PLAY_SERVICES_NOT_AVAILABLE"))
    return "حدّث خدمات Google Play على الجهاز ثم أعد المحاولة.";
  if (details.includes("IN_PROGRESS"))
    return "تسجيل الدخول جارٍ بالفعل. أكمل النافذة المفتوحة ثم أعد المحاولة.";
  if (code === "google_native_unavailable")
    return "تسجيل Google غير مهيأ على السيرفر حاليًا. يلزم ضبط Google OAuth على السيرفر.";
  if (code === "invalid_google_id_token")
    return "رفض السيرفر رمز Google. طابق Client ID من نوع Web في التطبيق مع إعداد الجمهور على السيرفر.";
  if (code === "google_registration_failed")
    return "تم التحقق من Google، لكن تعذّر إنشاء الحساب على السيرفر. حاول لاحقًا.";
  return message || "تعذّر تسجيل الدخول باستخدام Google. حاول مجددًا.";
}
