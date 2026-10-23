import { useLayoutEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { api, assetUrl, getApiBaseUrl } from "../../core/api";
import { useAuth } from "../../core/auth";
import { useBootstrap } from "../../core/bootstrap";
import {
  formatAttributeLabel,
  formatAttributeValue,
} from "../../core/presentation";
import type { Listing } from "../../core/types";
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Field,
  Icon,
  LoadingState,
  PageHeader,
  Screen,
  colors,
  fonts,
  formatPrice,
} from "../../ui";
type SimilarFollowState = {
  status: "ok" | "followed" | "unfollowed";
  isFollowing: boolean;
  canFollow: boolean;
};
export default function ListingScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const { user } = useAuth();
  const bootstrap = useBootstrap();
  const qc = useQueryClient();
  const [index, setIndex] = useState(0);
  const [gallery, setGallery] = useState(false);
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const followScope = `${user?.id || "guest"}:${listingId}`;
  const currentFollowScope = useRef(followScope);
  useLayoutEffect(() => {
    currentFollowScope.current = followScope;
  }, [followScope]);
  const [followNotice, setFollowNotice] = useState<{
    scope: string;
    text: string;
    failed?: boolean;
  } | null>(null);
  const path = `/api/marketplace/listings/${encodeURIComponent(listingId || "")}`;
  const listing = useQuery({
    queryKey: ["listing", listingId],
    queryFn: () => api.get<{ listing: Listing }>(path),
    enabled: !!listingId,
  });
  const saved = useQuery({
    queryKey: ["favorite", user?.id, listingId],
    queryFn: () =>
      api.get<{
        favorited?: boolean;
        favorite?: boolean;
        isFavorite?: boolean;
      }>(`${path}/favorite`),
    enabled: !!user,
  });
  const similarFollow = useQuery({
    queryKey: ["account", user?.id, "similar-follow", listingId],
    queryFn: ({ signal }) =>
      api.get<SimilarFollowState>(`${path}/similar-follow`, undefined, { signal }),
    enabled:
      !!user &&
      !!listingId &&
      listing.data?.listing.status === "published" &&
      listing.data.listing.sellerId !== user.id,
  });
  const follow = useMutation({
    mutationFn: (input: { userId: string; listingId: string }) =>
      api.post<SimilarFollowState>(
        `/api/marketplace/listings/${encodeURIComponent(input.listingId)}/similar-follow`,
        undefined,
        { idempotencyKey: Crypto.randomUUID() },
      ),
    onSuccess: (result, input) => {
      const scope = `${input.userId}:${input.listingId}`;
      if (scope !== currentFollowScope.current) return;
      qc.setQueryData(
        ["account", input.userId, "similar-follow", input.listingId],
        result,
      );
      void qc.invalidateQueries({
        queryKey: ["account", input.userId, "follows"],
      });
      setFollowNotice({
        scope,
        text: result.isFollowing
          ? "سيصلك تنبيه عند نشر إعلان مشابه بدرجة قوية."
          : "تم إيقاف متابعة الإعلانات المشابهة.",
      });
    },
    onError: (_error, input) => {
      const scope = `${input.userId}:${input.listingId}`;
      if (scope !== currentFollowScope.current) return;
      setFollowNotice({
        scope,
        failed: true,
        text: "تعذر تحديث متابعة الإعلانات المشابهة الآن.",
      });
      // A disconnected response may still have changed the server state.
      void similarFollow.refetch();
    },
  });
  const seller = useQuery({
    queryKey: ["seller", listing.data?.listing.sellerId],
    queryFn: () =>
      api.get<{
        seller: {
          id: string;
          name: string;
          picture?: string;
          ratingAverage: number;
          ratingCount: number;
          followerCount: number;
        };
      }>(
        `/api/marketplace/users/${encodeURIComponent(listing.data!.listing.sellerId)}/profile`,
      ),
    enabled: !!listing.data?.listing.sellerId,
  });
  const favorite = useMutation({
    mutationFn: () =>
      api.post(`${path}/favorite`, undefined, {
        idempotencyKey: Crypto.randomUUID(),
      }),
    onSuccess: () => {
      void saved.refetch();
      void qc.invalidateQueries({
        queryKey: ["account", user?.id, "favorites"],
      });
    },
    onError: (e) => Alert.alert("تعذّر الحفظ", e.message),
  });
  const message = useMutation({
    mutationFn: () =>
      api.post<{ conversation: { id: string } }>(
        "/api/marketplace/conversations",
        { listingId },
        { idempotencyKey: Crypto.randomUUID() },
      ),
    onSuccess: (result) =>
      router.push(
        `/conversations/${encodeURIComponent(result.conversation.id)}`,
      ),
    onError: (e) => Alert.alert("تعذّر بدء المحادثة", e.message),
  });
  function requireUser(action: () => void) {
    if (!user) router.push("/auth");
    else action();
  }
  async function contact() {
    try {
      const result = await api.get<{ phoneNumber: string | null }>(
        `${path}/contact`,
      );
      if (!result.phoneNumber) {
        Alert.alert(
          "التواصل",
          "لم يضف المعلن رقمًا للتواصل. يمكنك مراسلته داخل السوق.",
        );
        return;
      }
      await Linking.openURL(`tel:${result.phoneNumber}`);
    } catch (e) {
      Alert.alert(
        "تعذّر الاتصال",
        e instanceof Error ? e.message : "حاول مجددًا.",
      );
    }
  }
  async function sendReport() {
    if (reason.trim().length < 2) {
      setError("اكتب سبب البلاغ.");
      return;
    }
    try {
      await api.post(
        `${path}/reports`,
        { reason: "other", details: reason.trim() },
        { idempotencyKey: Crypto.randomUUID() },
      );
      setReport(false);
      setReason("");
      Alert.alert("تم إرسال البلاغ", "ستراجعه إدارة السوق.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر إرسال البلاغ.");
    }
  }
  if (listing.isPending)
    return (
      <Screen>
        <PageHeader title="تفاصيل الإعلان" back />
        <LoadingState />
      </Screen>
    );
  if (listing.isError || !listing.data)
    return (
      <Screen>
        <PageHeader title="تفاصيل الإعلان" back />
        <EmptyState
          title="الإعلان غير متاح"
          message={listing.error?.message}
          action={
            <Button
              title="إعادة المحاولة"
              onPress={() => void listing.refetch()}
            />
          }
        />
      </Screen>
    );
  const item = listing.data.listing;
  const images = (item.images || []).filter(
    (photo) => photo.status === "approved",
  );
  const image = images[index] || images[0];
  const own = item.sellerId === user?.id;
  const category =
    bootstrap.data?.categories.find((c) => c.id === item.category)?.label ||
    item.category;
  const favorited = !!(
    saved.data?.favorited ||
    saved.data?.favorite ||
    saved.data?.isFavorite
  );
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <PageHeader
          title={category}
          back
          right={
            <View style={{ flexDirection: "row", gap: 16 }}>
              <Pressable
                accessibilityLabel="مشاركة الإعلان"
                onPress={() =>
                  void Share.share({
                    title: item.title,
                    message: `${item.title || "إعلان في سوق حمد"}\n${getApiBaseUrl()}/listings/${encodeURIComponent(item.id)}`,
                  })
                }
              >
                <Icon name="share-outline" />
              </Pressable>
              <Pressable
                accessibilityLabel="حفظ في المفضلة"
                onPress={() => requireUser(() => favorite.mutate())}
              >
                <Icon
                  name={favorited ? "heart" : "heart-outline"}
                  color={favorited ? colors.danger : colors.text}
                />
              </Pressable>
            </View>
          }
        />
        <Pressable
          accessibilityLabel="عرض صور الإعلان"
          onPress={() => setGallery(true)}
          style={s.heroImage}
        >
          {image ? (
            <Image
              source={assetUrl(image.displayUrl)}
              contentFit="contain"
              style={StyleSheet.absoluteFill}
              transition={200}
            />
          ) : (
            <Icon name="image-outline" size={60} color="#BAC7D7" />
          )}
          <View style={s.counter}>
            <Icon name="images-outline" size={14} color="white" />
            <AppText style={{ color: "white", fontSize: 12 }}>
              {images.length ? `${index + 1} / ${images.length}` : "بدون صور"}
            </AppText>
          </View>
        </Pressable>
        {images.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.thumbnails}
          >
            {images.map((photo, i) => (
              <Pressable
                accessibilityLabel={`الصورة ${i + 1}`}
                key={photo.id}
                onPress={() => setIndex(i)}
                style={[
                  s.thumb,
                  i === index ? { borderColor: colors.primary } : undefined,
                ]}
              >
                <Image
                  source={assetUrl(photo.thumbnailUrl)}
                  style={{ width: "100%", height: "100%", borderRadius: 9 }}
                  contentFit="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <View style={s.content}>
          <View style={{ gap: 8 }}>
            <AppText variant="title" style={{ fontSize: 25, lineHeight: 37 }}>
              {item.title}
            </AppText>
            <AppText
              color={colors.primary}
              style={{ fontFamily: fonts.bold, fontSize: 26, lineHeight: 40 }}
            >
              {formatPrice(item.price)}
            </AppText>
            <View style={s.meta}>
              <View style={s.metaItem}>
                <Icon name="location-outline" size={16} color={colors.muted} />
                <AppText variant="caption">{item.city || "السعودية"}</AppText>
              </View>
              {item.createdAt ? (
                <View style={s.metaItem}>
                  <Icon name="time-outline" size={15} color={colors.muted} />
                  <AppText variant="caption">
                    {new Date(item.createdAt).toLocaleDateString("ar-SA")}
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>
          <Card>
            <AppText variant="heading" style={{ fontSize: 17 }}>
              عن الإعلان
            </AppText>
            <AppText style={{ lineHeight: 29 }}>
              {item.description || "لم يضف المعلن وصفًا."}
            </AppText>
            {item.condition ? (
              <View style={s.attribute}>
                <AppText variant="caption">الحالة</AppText>
                <AppText variant="label">
                  {
                    {
                      new: "جديد",
                      used: "مستعمل",
                      like_new: "شبه جديد",
                      damaged: "يحتاج إصلاح",
                    }[item.condition]
                  }
                </AppText>
              </View>
            ) : null}
            {Object.entries(item.attributes || {})
              .filter(
                ([key, value]) =>
                  !key.startsWith("_") &&
                  ["string", "number", "boolean"].includes(typeof value),
              )
              .slice(0, 12)
              .map(([key, value]) => (
                <View key={key} style={s.attribute}>
                  <AppText variant="caption">
                    {formatAttributeLabel(key)}
                  </AppText>
                  <AppText variant="label">
                    {key === "marketplaceCategoryOption"
                      ? bootstrap.data?.categories
                          .find((c) => c.id === item.category)
                          ?.options.find((option) => option.id === value)
                          ?.label || "غير محدد"
                      : key === "marketplaceCarModel"
                        ? bootstrap.data?.categories
                            .find((c) => c.id === item.category)
                            ?.carModels?.[
                              String(item.attributes.marketplaceCategoryOption)
                            ]?.find((model) => model.id === value)?.label ||
                          String(value)
                        : formatAttributeValue(key, value)}
                  </AppText>
                </View>
              ))}
          </Card>
          <Pressable
            onPress={() =>
              router.push(`/sellers/${encodeURIComponent(item.sellerId)}`)
            }
          >
            <Card style={s.seller}>
              <View style={s.avatar}>
                {seller.data?.seller.picture ? (
                  <Image
                    source={assetUrl(seller.data.seller.picture)}
                    style={{ height: 50, width: 50, borderRadius: 18 }}
                  />
                ) : (
                  <Icon name="person-outline" color={colors.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="label">
                  {seller.data?.seller.name || "المعلن"}
                </AppText>
                <View
                  style={{
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Icon name="star" size={12} color="#D8A13F" />
                  <AppText variant="caption">
                    {seller.data?.seller.ratingAverage?.toFixed(1) || "—"} ·{" "}
                    {seller.data?.seller.ratingCount || 0} تقييم
                  </AppText>
                </View>
              </View>
              <Icon name="chevron-back" size={18} color={colors.muted} />
            </Card>
          </Pressable>
          {!own ? (
            <View style={{ gap: 8 }}>
              <Button
                title={
                  user && similarFollow.isError
                    ? "إعادة تحميل حالة المتابعة"
                    : similarFollow.data?.isFollowing
                      ? "إيقاف متابعة المشابه"
                      : "تابع الإعلانات المشابهة"
                }
                icon={
                  similarFollow.data?.isFollowing
                    ? "notifications-off-outline"
                    : "notifications-outline"
                }
                variant={similarFollow.data?.isFollowing ? "secondary" : "primary"}
                loading={follow.isPending || (!!user && similarFollow.isFetching)}
                disabled={similarFollow.data?.canFollow === false}
                onPress={() => requireUser(() => {
                  if (similarFollow.isError || !similarFollow.data) {
                    void similarFollow.refetch();
                    return;
                  }
                  setFollowNotice(null);
                  follow.mutate({ userId: user!.id, listingId });
                })}
              />
              {followNotice?.scope === followScope ? (
                <AppText
                  variant="caption"
                  accessibilityLiveRegion="polite"
                  color={followNotice.failed ? colors.danger : colors.success}
                >
                  {followNotice.text}
                </AppText>
              ) : null}
            </View>
          ) : null}
          <Card style={{ backgroundColor: colors.primarySoft, borderWidth: 0 }}>
            <View style={s.metaItem}>
              <Icon
                name="shield-checkmark-outline"
                color={colors.primary}
                size={20}
              />
              <AppText variant="label" color={colors.primary}>
                تعامل بوعي واطمئنان
              </AppText>
            </View>
            <AppText variant="caption" style={{ lineHeight: 24 }}>
              افحص المنتج وتحقق من التفاصيل قبل إتمام الاتفاق. حافظ على تواصلك
              داخل السوق.
            </AppText>
          </Card>
          <Button
            title="الإبلاغ عن الإعلان"
            variant="ghost"
            icon="flag-outline"
            onPress={() => requireUser(() => setReport(true))}
          />
          <AppText variant="caption" style={{ textAlign: "center" }}>
            رقم الإعلان: {item.id}
          </AppText>
        </View>
      </ScrollView>
      <View style={s.actions}>
        {own ? (
          <Button
            title="إدارة إعلانك"
            icon="create-outline"
            onPress={() =>
              router.push(`/create/${encodeURIComponent(item.id)}`)
            }
          />
        ) : (
          <View style={{ flexDirection: "row-reverse", gap: 10 }}>
            <Button
              title="راسل المعلن"
              icon="chatbubble-ellipses-outline"
              loading={message.isPending}
              onPress={() => requireUser(() => message.mutate())}
              style={{ flex: 1 }}
            />
            <Button
              title="اتصال"
              icon="call-outline"
              variant="secondary"
              onPress={() => void contact()}
            />
          </View>
        )}
      </View>
      <Modal
        visible={gallery}
        transparent
        animationType="fade"
        onRequestClose={() => setGallery(false)}
      >
        <View style={s.gallery}>
          <Pressable
            accessibilityLabel="إغلاق الصور"
            style={s.close}
            onPress={() => setGallery(false)}
          >
            <Icon name="close" color="white" size={28} />
          </Pressable>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: Dimensions.get("window").width * index, y: 0 }}
          >
            {images.map((photo) => (
              <Image
                key={photo.id}
                source={assetUrl(photo.displayUrl || photo.originalUrl)}
                contentFit="contain"
                style={{
                  width: Dimensions.get("window").width,
                  height: "100%",
                }}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
      <Modal
        visible={report}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReport(false)}
      >
        <Screen scroll>
          <PageHeader
            title="الإبلاغ عن الإعلان"
            back={false}
            right={
              <Pressable onPress={() => setReport(false)}>
                <Icon name="close" />
              </Pressable>
            }
          />
          <Card>
            <AppText>
              ساعدنا في الحفاظ على جودة السوق. وضّح سبب البلاغ لتراجعه الإدارة.
            </AppText>
            <Field
              label="سبب البلاغ"
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={120}
            />
            {error ? <AppText color={colors.danger}>{error}</AppText> : null}
            <Button title="إرسال البلاغ" onPress={() => void sendReport()} />
          </Card>
        </Screen>
      </Modal>
    </Screen>
  );
}
const s = StyleSheet.create({
  heroImage: {
    height: 320,
    backgroundColor: "#E9EEF5",
    alignItems: "center",
    justifyContent: "center",
  },
  counter: {
    position: "absolute",
    left: 20,
    bottom: 18,
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#14243A99",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  thumbnails: {
    flexDirection: "row-reverse",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    padding: 2,
  },
  content: { padding: 20, gap: 20 },
  meta: { flexDirection: "row-reverse", gap: 20 },
  metaItem: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  attribute: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  seller: { flexDirection: "row-reverse", alignItems: "center", gap: 13 },
  avatar: {
    height: 50,
    width: 50,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
    paddingBottom: 28,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  gallery: { flex: 1, backgroundColor: "#08111D", direction: "ltr" },
  close: {
    position: "absolute",
    top: 58,
    right: 25,
    zIndex: 2,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF18",
    borderRadius: 22,
  },
});
