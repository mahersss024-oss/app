import React from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../core/api";
import { useAuth } from "../../core/auth";
import type { Listing, Pagination } from "../../core/types";
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ListingCard,
  LoadingState,
  PageHeader,
  Screen,
} from "../../ui";
import {
  confirmAction,
  ErrorState,
  GuestState,
  palette,
  showError,
  styles,
} from "../account/shared";

type FavoritesPage = {
  favorites: { id: string; listingId: string; listing: Listing | null }[];
  pagination: Pagination;
};

export function FavoritesScreen() {
  const { user, status } = useAuth();
  const query = useInfiniteQuery({
    queryKey: ["account", user?.id, "favorites"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get<FavoritesPage>("/api/marketplace/me/favorites", {
        page: pageParam,
        limit: 24,
      }),
    getNextPageParam: (page) => page.pagination.nextPage ?? undefined,
    enabled: status === "authenticated",
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/marketplace/listings/${encodeURIComponent(id)}/favorite`),
    onSuccess: () => {
      void query.refetch();
    },
    onError: (error) => showError(error),
  });
  const items = query.data?.pages.flatMap((page) => page.favorites) ?? [];
  return (
    <Screen scroll={false}>
      <PageHeader title="المفضلة" subtitle="فرص أعجبتك، احتفظ بها قريبًا" />
      {status === "loading" ? (
        <LoadingState />
      ) : status === "guest" ? (
        <GuestState
          title="احتفظ بالإعلانات التي تعجبك"
          message="سجّل الدخول لحفظ المفضلة والعودة إليها في أي وقت."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              tintColor={palette.primary}
            />
          }
          renderItem={({ item }) => (
            <View style={{ gap: 4 }}>
              {item.listing ? (
                <ListingCard
                  listing={item.listing}
                  onPress={() =>
                    router.push(
                      `/listings/${encodeURIComponent(item.listingId)}`,
                    )
                  }
                />
              ) : (
                <Card>
                  <AppText variant="label">الإعلان لم يعد متاحًا</AppText>
                </Card>
              )}
              <Button
                title="إزالة من المفضلة"
                variant="ghost"
                icon="heart-dislike-outline"
                loading={
                  remove.isPending && remove.variables === item.listingId
                }
                onPress={() =>
                  confirmAction(
                    "إزالة من المفضلة؟",
                    "يمكنك حفظ الإعلان مجددًا من صفحة التفاصيل.",
                    () => remove.mutate(item.listingId),
                    "إزالة",
                  )
                }
              />
            </View>
          )}
          ListEmptyComponent={
            query.isPending ? (
              <LoadingState />
            ) : query.isError ? (
              <ErrorState
                error={query.error}
                retry={() => void query.refetch()}
              />
            ) : (
              <EmptyState
                icon="heart-outline"
                title="مفضلتك تنتظر أول فرصة"
                message="اضغط رمز القلب في صفحة الإعلان لتجده هنا."
                action={
                  <Button
                    title="استكشف السوق"
                    onPress={() => router.push("/")}
                    variant="secondary"
                  />
                }
              />
            )
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <LoadingState />
            ) : query.hasNextPage ? (
              <Button
                title="تحميل المزيد"
                variant="secondary"
                onPress={() => void query.fetchNextPage()}
              />
            ) : undefined
          }
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetching)
              void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
        />
      )}
    </Screen>
  );
}
