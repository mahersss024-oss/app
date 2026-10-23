import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { api } from "../../core/api";
import { useAuth } from "../../core/auth";
import { disableNativePush, enableNativePush } from "../../core/push";
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Icon,
  LoadingState,
  PageHeader,
  Screen,
} from "../../ui";
import {
  confirmAction,
  ErrorState,
  formatDate,
  GuestState,
  palette,
  showError,
  styles,
} from "../account/shared";

type Notification = {
  id: string;
  listingId: string;
  sellerId: string;
  title?: string;
  body?: string;
  url: string;
  readAt?: string;
  createdAt: string;
};

export function NotificationsScreen() {
  const { user, status } = useAuth();
  const [pushNotice, setPushNotice] = useState("");
  const canConfigurePush =
    Device.isDevice &&
    Platform.OS !== "web" &&
    Constants.executionEnvironment !== "storeClient";
  // A device-setting result belongs to the account that requested it.

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Permission feedback belongs to the account that requested it.
    setPushNotice("");
  }, [user?.id]);
  const query = useQuery({
    queryKey: ["account", user?.id, "notifications"],
    queryFn: () =>
      api.get<{ notifications: Notification[]; unreadCount: number }>(
        "/api/notifications",
      ),
    enabled: status === "authenticated",
  });
  const read = useMutation({
    mutationFn: () => api.patch("/api/notifications"),
    onSuccess: () => {
      void query.refetch();
    },
    onError: (error) => showError(error),
  });
  const remove = useMutation({
    mutationFn: (id?: string) =>
      api.delete(
        id
          ? `/api/notifications?id=${encodeURIComponent(id)}`
          : "/api/notifications",
      ),
    onSuccess: () => {
      void query.refetch();
    },
    onError: (error) => showError(error),
  });
  const push = useMutation({
    mutationFn: (enabled: boolean) =>
      enabled ? enableNativePush() : disableNativePush(),
    onSuccess: (_result, enabled) => {
      const message = enabled
        ? "تم تفعيل إشعارات سوق حمد على هذا الجهاز."
        : "تم إيقاف إشعارات سوق حمد على هذا الجهاز.";
      setPushNotice(message);
      Alert.alert(
        enabled ? "تم تفعيل الإشعارات" : "تم إيقاف الإشعارات",
        message,
      );
    },
    onError: (error) => {
      setPushNotice(
        error instanceof Error ? error.message : "تعذر تحديث الإشعارات.",
      );
      showError(error, "إشعارات الجهاز");
    },
  });
  return (
    <Screen scroll={false}>
      <PageHeader
        title="الإشعارات"
        subtitle={
          query.data?.unreadCount
            ? `${query.data.unreadCount} إشعار غير مقروء`
            : "آخر تحديثات ما تتابعه"
        }
        back
      />
      {status === "loading" ? (
        <LoadingState />
      ) : status === "guest" ? (
        <GuestState
          title="لا تفوّت الإعلانات الجديدة"
          message="سجّل الدخول لتتابع المعلنين وتستقبل تحديثاتهم."
        />
      ) : (
        <FlatList
          data={query.data?.notifications || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              tintColor={palette.primary}
            />
          }
          ListHeaderComponent={
            <View style={styles.stack}>
              {canConfigurePush && (
                <Card style={styles.stack}>
                  <View style={styles.row}>
                    <Icon
                      name="notifications-circle-outline"
                      color={palette.primary}
                      size={28}
                    />
                    <AppText variant="heading" style={styles.grow}>
                      إشعارات الجهاز
                    </AppText>
                  </View>
                  <AppText color={palette.muted}>
                    استقبل تنبيهات الرسائل والإعلانات التي تتابعها حتى عندما لا
                    تستخدم التطبيق.
                  </AppText>
                  <Button
                    title="تفعيل الإشعارات"
                    icon="notifications-outline"
                    loading={push.isPending && push.variables === true}
                    disabled={push.isPending}
                    onPress={() => push.mutate(true)}
                  />
                  <Button
                    title="إيقاف إشعارات الجهاز"
                    variant="ghost"
                    loading={push.isPending && push.variables === false}
                    disabled={push.isPending}
                    onPress={() => push.mutate(false)}
                  />
                  {pushNotice ? (
                    <AppText variant="caption" color={palette.primary}>
                      {pushNotice}
                    </AppText>
                  ) : undefined}
                </Card>
              )}
              {query.data?.notifications.length ? (
                <View style={styles.between}>
                  <Button
                    title="قراءة الكل"
                    variant="ghost"
                    icon="checkmark-done-outline"
                    loading={read.isPending}
                    disabled={!query.data.unreadCount}
                    onPress={() => read.mutate()}
                  />
                  <Button
                    title="مسح الكل"
                    variant="ghost"
                    icon="trash-outline"
                    loading={remove.isPending && !remove.variables}
                    onPress={() =>
                      confirmAction(
                        "مسح الإشعارات؟",
                        "سيتم حذف جميع الإشعارات من سجل حسابك.",
                        () => remove.mutate(undefined),
                        "مسح الكل",
                        true,
                      )
                    }
                  />
                </View>
              ) : undefined}
            </View>
          }
          renderItem={({ item }) => (
            <Card style={[local.notification, !item.readAt && local.unread]}>
              <Pressable
                style={local.open}
                accessibilityRole="button"
                onPress={() => {
                  if (item.listingId)
                    router.push(
                      `/listings/${encodeURIComponent(item.listingId)}`,
                    );
                }}
              >
                <View style={local.notificationIcon}>
                  <Icon
                    name="notifications-outline"
                    size={22}
                    color={palette.primary}
                  />
                </View>
                <View style={styles.grow}>
                  <AppText variant="label">
                    {item.title || "تحديث جديد"}
                  </AppText>
                  {item.body && (
                    <AppText color={palette.muted} style={{ marginTop: 4 }}>
                      {item.body}
                    </AppText>
                  )}
                  <AppText
                    variant="caption"
                    color={palette.muted}
                    style={{ marginTop: 8 }}
                  >
                    {formatDate(item.createdAt)}
                  </AppText>
                </View>
                {!item.readAt && <View style={local.dot} />}
              </Pressable>
              <Button
                title="حذف"
                variant="ghost"
                loading={remove.isPending && remove.variables === item.id}
                onPress={() => remove.mutate(item.id)}
              />
            </Card>
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
                icon="notifications-outline"
                title="أنت على اطلاع"
                message="ستظهر تحديثات المعلنين والإعلانات المشابهة التي تتابعها هنا."
              />
            )
          }
        />
      )}
    </Screen>
  );
}

const local = StyleSheet.create({
  notification: { paddingBottom: 6 },
  unread: { backgroundColor: "#F0F6FF", borderColor: "#D8E6FA" },
  open: { flexDirection: "row-reverse", gap: 12, alignItems: "flex-start" },
  notificationIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#E5EFFC",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.primary,
    marginTop: 8,
  },
});
