import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { ComponentProps, ReactNode } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import { assetUrl } from "../core/api";
import { useBootstrap } from "../core/bootstrap";
import { formatRelativeListingTime } from "../core/presentation";
import type { Listing } from "../core/types";
import { colors, fonts, radius } from "./theme";
export { colors, fonts, radius, spacing } from "./theme";
export type IconName = ComponentProps<typeof Ionicons>["name"];
export function Icon({
  name,
  size = 22,
  color = colors.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function AppText({
  variant = "body",
  color,
  style,
  ...props
}: TextProps & {
  variant?: "title" | "heading" | "body" | "caption" | "label";
  color?: string;
}) {
  return (
    <Text
      {...props}
      style={[s.text, s[variant], color ? { color } : undefined, style]}
    />
  );
}
export function Screen({
  children,
  scroll = false,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[s.screen, style]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}
export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[s.card, style]} />;
}
export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const dark = variant === "primary" || variant === "danger";
  const color = dark
    ? colors.white
    : variant === "ghost"
      ? colors.muted
      : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        variant === "primary"
          ? s.primary
          : variant === "danger"
            ? s.danger
            : variant === "secondary"
              ? s.secondary
              : s.ghost,
        disabled || loading ? s.disabled : undefined,
        pressed ? { opacity: 0.82, transform: [{ scale: 0.985 }] } : undefined,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon ? <Icon name={icon} color={color} size={19} /> : null}
          <AppText variant="label" color={color}>
            {title}
          </AppText>
        </>
      )}
    </Pressable>
  );
}
export function Field({
  label,
  style,
  ...props
}: TextInputProps & { label?: string }) {
  return (
    <View style={s.fieldWrap}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          s.field,
          props.multiline
            ? { minHeight: 112, textAlignVertical: "top" }
            : undefined,
          style,
        ]}
      />
    </View>
  );
}
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[s.chip, active ? s.activeChip : undefined]}
    >
      <AppText
        variant="caption"
        color={active ? colors.white : colors.muted}
        style={active ? { fontFamily: fonts.bold } : undefined}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
export function PageHeader({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={s.pageHeader}>
      <View style={s.headerTitle}>
        {back ? (
          <Pressable
            accessibilityLabel="رجوع"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
            style={s.iconButton}
          >
            <Icon name="arrow-forward" />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <AppText variant="heading">{title}</AppText>
          {subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
        </View>
      </View>
      {right}
    </View>
  );
}
export function EmptyState({
  title,
  message,
  icon = "file-tray-outline",
  action,
}: {
  title: string;
  message?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Icon name={icon} size={34} color={colors.primary} />
      </View>
      <AppText variant="heading">{title}</AppText>
      {message ? (
        <AppText
          color={colors.muted}
          style={{ textAlign: "center", lineHeight: 26, maxWidth: 310 }}
        >
          {message}
        </AppText>
      ) : null}
      {action ? (
        <View style={{ marginTop: 10, alignSelf: "stretch" }}>{action}</View>
      ) : null}
    </View>
  );
}
export function LoadingState() {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={colors.primary} />
      <AppText variant="caption">جارٍ التحميل…</AppText>
    </View>
  );
}
export function formatPrice(price: Listing["price"]) {
  return typeof price === "number"
    ? `${new Intl.NumberFormat("ar-SA").format(price)} ر.س`
    : price === "bid"
      ? "على السوم"
      : price === "negotiable"
        ? "قابل للتفاوض"
        : "السعر لدى المعلن";
}
export function ListingCard({
  listing,
  onPress,
}: {
  listing: Listing;
  onPress?: () => void;
}) {
  const bootstrap = useBootstrap();
  const visibleImages =
    listing.status === "published"
      ? listing.images?.filter((i) => i.status === "approved")
      : listing.images;
  const image = visibleImages?.find((i) => i.isPrimary) || visibleImages?.[0];
  const category = bootstrap.data?.categories.find(item => item.id === listing.category);
  const optionId = listing.attributes?.marketplaceCategoryOption;
  const option = category?.options.find(item => item.id === optionId);
  const modelId = listing.attributes?.marketplaceCarModel;
  const model = typeof optionId === "string"
    ? category?.carModels?.[optionId]?.find(item => item.id === modelId)
    : undefined;
  const categoryLabel = [category?.label, option?.label, model?.label].filter(Boolean).join(" · ");
  const date = listing.createdAt || listing.updatedAt;
  const stats = [
    typeof listing.views === "number" ? `${new Intl.NumberFormat("ar-SA").format(listing.views)} مشاهدة` : undefined,
    typeof listing.messageCount === "number" ? `${new Intl.NumberFormat("ar-SA").format(listing.messageCount)} رسائل` : undefined,
  ].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={
        onPress ||
        (() => router.push(`/listings/${encodeURIComponent(listing.id)}`))
      }
      accessibilityRole="button"
      accessibilityLabel={listing.title || "تفاصيل الإعلان"}
      style={({ pressed }) => [
        s.listing,
        pressed ? { opacity: 0.9 } : undefined,
      ]}
    >
      <View style={s.listingImage}>
        {assetUrl(image?.thumbnailUrl || image?.displayUrl) ? (
          <Image
            source={assetUrl(image?.thumbnailUrl || image?.displayUrl)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
          />
        ) : <View style={s.listingImageFallback}><Icon name="image-outline" size={21} color="#64748B" /><AppText style={s.listingImageFallbackText}>لا توجد صورة حقيقية</AppText></View>}
      </View>
      <View style={s.listingBody}>
        <AppText
          numberOfLines={2}
          variant="label"
          style={s.listingTitle}
        >
          {listing.title || "مسودة إعلان"}
        </AppText>
        <AppText
          style={s.listingPrice}
        >
          {formatPrice(listing.price)}
        </AppText>
        <View style={s.listingMeta}>
          <View style={s.listingMetaItem}><Icon name="time-outline" size={13} color={colors.muted} /><AppText numberOfLines={1} style={s.listingMetaText}>{date ? formatRelativeListingTime(date) : "وقت غير محدد"}</AppText></View>
          <View style={s.listingMetaItem}><Icon name="location-outline" size={13} color={colors.muted} /><AppText numberOfLines={1} style={s.listingMetaText}>{listing.city || "السعودية"}</AppText></View>
        </View>
        {(categoryLabel || stats) ? <View style={s.listingFoot}><AppText numberOfLines={1} style={s.listingCategory}>{categoryLabel}</AppText>{stats ? <AppText numberOfLines={1} style={s.listingStats}>{stats}</AppText> : null}</View> : null}
      </View>
    </Pressable>
  );
}
const s = StyleSheet.create({
  // Rows already express the Arabic design explicitly with row-reverse.
  // Keep Yoga's coordinate direction stable across device locales; text keeps
  // its own RTL writing direction below.
  screen: { flex: 1, backgroundColor: colors.background, direction: "ltr" },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  text: {
    fontFamily: fonts.regular,
    color: colors.text,
    textAlign: "right",
    writingDirection: "rtl",
    fontSize: 14,
    lineHeight: 23,
  },
  title: { fontSize: 30, lineHeight: 44, fontFamily: fonts.bold },
  heading: { fontSize: 20, lineHeight: 30, fontFamily: fonts.bold },
  body: { fontSize: 14, lineHeight: 24 },
  caption: { fontSize: 12, lineHeight: 20, color: colors.muted },
  label: { fontSize: 14, lineHeight: 23, fontFamily: fonts.bold },
  card: {
    padding: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  button: {
    minHeight: 50,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.md,
    flexDirection: "row-reverse",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.primary },
  danger: { backgroundColor: colors.danger },
  secondary: { backgroundColor: colors.primarySoft },
  ghost: { backgroundColor: "transparent" },
  disabled: { opacity: 0.5 },
  fieldWrap: { gap: 8 },
  field: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 50,
    fontFamily: fonts.regular,
    color: colors.text,
    textAlign: "right",
    writingDirection: "rtl",
    fontSize: 14,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 17,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  activeChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  pageHeader: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 12,
    minHeight: 300,
  },
  emptyIcon: {
    height: 76,
    width: 76,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  loading: {
    flex: 1,
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  listing: {
    width: "100%",
    minHeight: 100,
    // Keep the explicitly reversed Arabic row stable inside any RTL parent.
    direction: "ltr",
    flexDirection: "row-reverse",
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#B9CEDA",
    overflow: "hidden",
    minWidth: 0,
    boxShadow: "0px 3px 10px rgba(31,88,122,0.07)",
  },
  listingImage: {
    width: 100,
    minHeight: 100,
    alignSelf: "stretch",
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  listingImageFallback: { alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 5 },
  listingImageFallbackText: { fontSize: 10, lineHeight: 16, color: "#64748B", textAlign: "center" },
  listingBody: { flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: 6, gap: 2, justifyContent: "space-between" },
  listingTitle: { color: "#059669", fontSize: 13, lineHeight: 20, fontFamily: fonts.bold },
  listingPrice: { color: "#0F172A", fontSize: 15, lineHeight: 24, fontFamily: fonts.bold },
  listingMeta: { flexDirection: "row-reverse", gap: 8, alignItems: "center" },
  listingMetaItem: { flexDirection: "row-reverse", gap: 3, alignItems: "center", flexShrink: 1, minWidth: 0 },
  listingMetaText: { fontSize: 10, lineHeight: 18, color: colors.muted, flexShrink: 1 },
  listingFoot: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", gap: 6 },
  listingCategory: { fontSize: 10, lineHeight: 18, color: colors.muted, flexShrink: 1, minWidth: 0 },
  listingStats: { fontSize: 9, lineHeight: 18, color: colors.muted, flexShrink: 1, minWidth: 0 },
});
