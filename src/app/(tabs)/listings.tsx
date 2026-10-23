import { useState } from "react";
import { Alert, FlatList, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { api } from "../../core/api";
import { useAuth } from "../../core/auth";
import type { Listing, Pagination } from "../../core/types";
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  LoadingState,
  PageHeader,
  Screen,
  colors,
  formatPrice,
} from "../../ui";
const statuses: Record<string, string> = {
  draft: "مسودة",
  pending: "قيد المراجعة",
  published: "منشور",
  paused: "متوقف",
  sold: "تم بيعه",
  rejected: "غير منشور",
  deleted: "محذوف",
};
export default function ListingsScreen() {
  const { user, status } = useAuth();
  const [filter, setFilter] = useState("all");
  const query = useInfiniteQuery({
    queryKey: ["my-listings", user?.id],
    enabled: !!user,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get<{ listings: Listing[]; pagination: Pagination }>(
        "/api/marketplace/me/listings",
        { page: pageParam, limit: 24 },
      ),
    getNextPageParam: (page) => page.pagination.nextPage ?? undefined,
  });
  const update = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.patch(
        `/api/marketplace/listings/${encodeURIComponent(id)}`,
        { action },
        { idempotencyKey: Crypto.randomUUID() },
      ),
    onSuccess: () => void query.refetch(),
    onError: (e) => Alert.alert("تعذّر تحديث الإعلان", e.message),
  });
  function action(item: Listing, value: string) {
    const labels: Record<string, string> = {
      mark_sold: "تأكيد البيع",
      delete: "حذف الإعلان",
      pause: "إيقاف الإعلان",
      publish: "نشر الإعلان",
    };
    Alert.alert(
      labels[value],
      value === "mark_sold"
        ? "سيتم تسجيل رسوم المنصة بنسبة 1% من قيمة البيع."
        : value === "delete"
          ? "سيُزال الإعلان من السوق وفق سياسة الحفظ."
          : "تأكيد تحديث حالة الإعلان؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تأكيد",
          style: value === "delete" ? "destructive" : "default",
          onPress: () => update.mutate({ id: item.id, action: value }),
        },
      ],
    );
  }
  const all = query.data?.pages.flatMap((p) => p.listings) || [];
  const items = all.filter(
    (l) => l.status !== "deleted" && (filter === "all" || l.status === filter),
  );
  if (status === "loading")
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  if (!user)
    return (
      <Screen>
        <PageHeader title="إعلاناتي" subtitle="كل إعلاناتك في مكان واحد" />
        <EmptyState
          title="إعلانك القادم يبدأ هنا"
          message="سجّل دخولك لنشر إعلانك وإدارته ومتابعة حالته."
          icon="albums-outline"
          action={
            <Button title="تسجيل الدخول" onPress={() => router.push("/auth")} />
          }
        />
      </Screen>
    );
  return (
    <Screen>
      <PageHeader
        title="إعلاناتي"
        subtitle="أدر تفاصيلك، واجعلها أقرب للمشتري"
        right={
          <Button
            title="إضافة"
            icon="add"
            onPress={() => router.push("/create")}
          />
        }
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 56 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          flexDirection: "row-reverse",
          gap: 8,
        }}
      >
        {[
          ["all", "الكل"],
          ["published", "المنشورة"],
          ["draft", "المسودات"],
          ["paused", "المتوقفة"],
          ["sold", "المباعة"],
        ].map(([id, label]) => (
          <Chip
            key={id}
            label={label}
            active={filter === id}
            onPress={() => setFilter(id)}
          />
        ))}
      </ScrollView>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 30 }}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage)
            void query.fetchNextPage();
        }}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        ListEmptyComponent={
          query.isPending ? (
            <LoadingState />
          ) : query.isError ? (
            <EmptyState
              title="تعذّر تحميل إعلاناتك"
              message={query.error.message}
              action={
                <Button
                  title="إعادة المحاولة"
                  onPress={() => void query.refetch()}
                />
              }
            />
          ) : (
            <EmptyState
              title="مساحة لفكرة جديدة"
              message="أضف أول إعلان لك يدويًا أو بمساعدة حمد."
              action={
                <Button
                  title="إنشاء إعلان"
                  onPress={() => router.push("/create")}
                />
              }
            />
          )
        }
        renderItem={({ item }) => (
          <Card>
            <View
              style={{
                flexDirection: "row-reverse",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <AppText variant="heading" style={{ fontSize: 17, flex: 1 }}>
                {item.title || "مسودة بدون عنوان"}
              </AppText>
              <AppText
                variant="caption"
                color={
                  item.status === "published" ? colors.success : colors.muted
                }
              >
                {statuses[item.status]}
              </AppText>
            </View>
            <AppText variant="label" color={colors.primary}>
              {formatPrice(item.price)}
            </AppText>
            <AppText variant="caption">
              {item.city || "لم تحدد المدينة"} · {item.images.length} صور
            </AppText>
            <Button
              title="تعديل ومعاينة"
              variant="secondary"
              icon="create-outline"
              onPress={() =>
                router.push(`/create/${encodeURIComponent(item.id)}`)
              }
            />
            <View
              style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" }}
            >
              {item.status === "published" ? (
                <>
                  <Button
                    title="إيقاف"
                    variant="ghost"
                    disabled={update.isPending}
                    onPress={() => action(item, "pause")}
                  />
                  <Button
                    title="تم البيع"
                    variant="ghost"
                    disabled={update.isPending}
                    onPress={() => action(item, "mark_sold")}
                  />
                </>
              ) : ["draft", "paused", "pending"].includes(item.status) ? (
                <Button
                  title="نشر"
                  variant="ghost"
                  disabled={update.isPending}
                  onPress={() => action(item, "publish")}
                />
              ) : null}
              <Button
                title="حذف"
                variant="ghost"
                disabled={update.isPending}
                onPress={() => action(item, "delete")}
              />
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}
