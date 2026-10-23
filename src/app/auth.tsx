import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../core/auth";
import { googleSignInErrorMessage } from "../core/native-auth";
import { useBootstrap } from "../core/bootstrap";
import Constants from "expo-constants";
import { AppText, Button, Card, Icon, PageHeader, Screen, colors } from "../ui";
export default function AuthScreen() {
  const auth = useAuth();
  const bootstrap = useBootstrap();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function login(provider: "google" | "apple") {
    if (busy) return;
    if (!accepted) {
      setError("حدّد مربع الموافقة على الشروط ورسوم المنصة قبل تسجيل الدخول.");
      return;
    }
    setBusy(provider);
    setError("");
    try {
      await auth.acceptAgreement();
      const signedIn =
        provider === "google"
          ? await auth.signInGoogle()
          : (await auth.signInApple(), true);
      if (!signedIn) return;
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "ERR_REQUEST_CANCELED" && code !== "SIGN_IN_CANCELLED")
        setError(
          provider === "google"
            ? googleSignInErrorMessage(
                e,
                Platform.OS === "android"
                  ? Constants.expoConfig?.android?.package
                  : undefined,
              )
            : e instanceof Error
              ? e.message
              : "تعذّر تسجيل الدخول.",
        );
    } finally {
      setBusy(null);
    }
  }
  if (auth.user)
    return (
      <Screen scroll>
        <PageHeader title="مرحبًا بك" back />
        <Card>
          <AppText variant="heading">
            {auth.user.name || "تم تسجيل دخولك"}
          </AppText>
          <Button
            title="متابعة إلى السوق"
            onPress={() => router.replace("/")}
          />
        </Card>
      </Screen>
    );
  return (
    <Screen scroll>
      <PageHeader title="أهلًا بك في سوق حمد" back />
      <LinearGradient colors={["#EAF1FB", "#F7FAFF"]} style={s.hero}>
        <View style={s.mark}>
          <Icon name="storefront-outline" size={40} color={colors.primary} />
        </View>
        <AppText variant="title">مكانك للبيع والشراء</AppText>
        <AppText color={colors.muted} style={{ textAlign: "center" }}>
          حساب واحد لإعلاناتك ومحادثاتك والأشياء التي تهمك.
        </AppText>
      </LinearGradient>
      <Card>
        <AppText variant="heading">ابدأ بخطوة بسيطة</AppText>
        <AppText color={colors.muted}>
          تصفّح بحرية، وسجّل دخولك عندما ترغب في النشر أو التواصل.
        </AppText>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
          onPress={() => {
            setAccepted(!accepted);
            setError("");
          }}
          style={s.agreement}
        >
          <View
            style={[
              s.check,
              accepted
                ? {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  }
                : undefined,
            ]}
          >
            {accepted ? (
              <Icon name="checkmark" color="white" size={16} />
            ) : null}
          </View>
          <AppText style={{ flex: 1, fontSize: 12, lineHeight: 23 }}>
            أوافق على شروط الاستخدام والسياسات، وأقر برسوم المنصة بنسبة 1% من
            قيمة البيع عند إتمام البيع عبر سوق حمد.
          </AppText>
        </Pressable>
        <View style={s.links}>
          {[
            ["terms", "الشروط"],
            ["privacy", "الخصوصية"],
            ["listings", "الإعلانات"],
            ["commissions", "الرسوم"],
          ].map(([id, label]) => (
            <Pressable key={id} onPress={() => router.push(`/policies/${id}`)}>
              <AppText color={colors.primary} variant="caption">
                {label}
              </AppText>
            </Pressable>
          ))}
        </View>
        <Button
          title="المتابعة باستخدام Google"
          icon="logo-google"
          variant="secondary"
          disabled={!bootstrap.data?.auth.google}
          loading={busy === "google"}
          onPress={() => void login("google")}
        />
        {!accepted ? (
          <AppText variant="caption" color={colors.muted}>
            حدّد مربع الموافقة أعلاه لتفعيل تسجيل الدخول.
          </AppText>
        ) : null}
        {bootstrap.data && !bootstrap.data.auth.google ? (
          <AppText color={colors.danger}>
            تسجيل Google غير مهيأ على السيرفر حاليًا.
          </AppText>
        ) : null}
        {Platform.OS === "ios" ? (
          <Button
            title="المتابعة باستخدام Apple"
            icon="logo-apple"
            disabled={!bootstrap.data?.auth.apple}
            loading={busy === "apple"}
            onPress={() => void login("apple")}
          />
        ) : null}
        {bootstrap.isError ? (
          <>
            <AppText color={colors.danger}>تعذّر تحميل خيارات الدخول.</AppText>
            <Button
              title="إعادة المحاولة"
              variant="ghost"
              onPress={() => void bootstrap.refetch()}
            />
          </>
        ) : null}
        {error ? <AppText color={colors.danger}>{error}</AppText> : null}
      </Card>
      <View style={s.security}>
        <Icon
          name="shield-checkmark-outline"
          color={colors.success}
          size={18}
        />
        <AppText variant="caption">
          بيانات حسابك وصلاحياته تُدار بأمان عبر سيرفر سوق حمد.
        </AppText>
      </View>
    </Screen>
  );
}
const s = StyleSheet.create({
  hero: { borderRadius: 26, padding: 24, alignItems: "center", gap: 12 },
  mark: {
    width: 84,
    height: 84,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    marginBottom: 8,
  },
  agreement: {
    flexDirection: "row-reverse",
    gap: 12,
    alignItems: "flex-start",
    marginVertical: 8,
  },
  check: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,
  },
  links: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 18 },
  security: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
});
