import React from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { assetUrl } from "../../core/api";
import { AppText, Button, Card, EmptyState, Icon } from "../../ui";

export const palette = {
  primary: "#2866B2",
  ink: "#17324F",
  muted: "#738198",
  border: "#E4EAF3",
  background: "#F5F7FB",
  danger: "#BB3C45",
  soft: "#EDF4FE",
  green: "#16826A",
};

export function GuestState({
  title = "كل ما يخص حسابك، في مكان واحد",
  message = "سجّل الدخول للوصول إلى إعلاناتك ومحادثاتك وحفظ ما يعجبك.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <EmptyState
      icon="person-outline"
      title={title}
      message={message}
      action={
        <Button
          title="تسجيل الدخول"
          onPress={() => router.push("/auth")}
          icon="log-in-outline"
        />
      }
    />
  );
}

export function ErrorState({
  error,
  retry,
}: {
  error?: unknown;
  retry: () => void;
}) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="تعذر تحميل البيانات"
      message={
        error instanceof Error
          ? error.message
          : "تحقق من اتصالك ثم أعد المحاولة."
      }
      action={
        <Button
          title="إعادة المحاولة"
          onPress={retry}
          variant="secondary"
          icon="refresh-outline"
        />
      }
    />
  );
}

export function showError(error: unknown, title = "تعذر إكمال الطلب") {
  Alert.alert(
    title,
    error instanceof Error
      ? error.message
      : "حاول مرة أخرى بعد التحقق من الاتصال.",
  );
}

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  label = "تأكيد",
  destructive = false,
) {
  Alert.alert(title, message, [
    { text: "إلغاء", style: "cancel" },
    {
      text: label,
      style: destructive ? "destructive" : "default",
      onPress: onConfirm,
    },
  ]);
}

export function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
}

export function money(value?: number | null) {
  return value == null
    ? "لم تُحدد"
    : `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(value)} ر.س`;
}

export function Avatar({
  name,
  picture,
  size = 48,
}: {
  name?: string;
  picture?: string;
  size?: number;
}) {
  const uri = assetUrl(picture);
  return uri ? (
    <Image
      source={{ uri }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette.soft,
      }}
    />
  ) : (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <AppText variant="heading" color={palette.primary}>
        {name?.trim().charAt(0) || "ح"}
      </AppText>
    </View>
  );
}

export function MenuRow({
  title,
  subtitle,
  icon,
  onPress,
  danger = false,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentProps<typeof Icon>["name"];
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.65 }]}
    >
      <View style={[styles.menuIcon, danger && { backgroundColor: "#FCEDEF" }]}>
        <Icon
          name={icon}
          size={21}
          color={danger ? palette.danger : palette.primary}
        />
      </View>
      <View style={styles.grow}>
        <AppText variant="label" color={danger ? palette.danger : palette.ink}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color={palette.muted}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <Icon name="chevron-back" size={17} color={palette.muted} />
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <AppText
      variant="caption"
      color={palette.muted}
      style={styles.sectionLabel}
    >
      {children}
    </AppText>
  );
}
export function Notice({ children }: { children: string }) {
  return (
    <Card style={styles.notice}>
      <Icon
        name="information-circle-outline"
        size={20}
        color={palette.primary}
      />
      <AppText style={styles.grow} color={palette.ink}>
        {children}
      </AppText>
    </Card>
  );
}

export const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  stack: { gap: 14 },
  content: { paddingHorizontal: 20, paddingBottom: 28, gap: 16 },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 12,
    flexGrow: 1,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F0FC",
    borderWidth: 1,
    borderColor: "#D8E5F8",
  },
  menuRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 15,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.soft,
  },
  sectionLabel: { marginTop: 6, marginBottom: 8 },
  notice: {
    flexDirection: "row-reverse",
    gap: 10,
    backgroundColor: "#EEF4FC",
    alignItems: "flex-start",
  },
  divider: { height: 1, backgroundColor: palette.border },
});
