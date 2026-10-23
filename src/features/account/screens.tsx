import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { api } from "../../core/api";
import { useAuth } from "../../core/auth";
import { useBootstrap } from "../../core/bootstrap";
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  Screen,
} from "../../ui";
import {
  Avatar,
  confirmAction,
  ErrorState,
  formatDate,
  GuestState,
  MenuRow,
  Notice,
  palette,
  SectionLabel,
  showError,
  styles as shared,
} from "./shared";

export function AccountScreen() {
  const { user, status, refresh, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const reload = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <Screen scroll={false}>
      <PageHeader title="حسابي" subtitle="أهلًا بك في سوق حمد" />
      <ScrollView
        contentContainerStyle={shared.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void reload()}
            tintColor={palette.primary}
          />
        }
      >
        {status === "loading" ? (
          <LoadingState />
        ) : status === "guest" ? (
          <GuestState />
        ) : (
          <>
            <Card style={local.profile}>
              <Avatar name={user?.name} picture={user?.picture} size={68} />
              <View style={shared.grow}>
                <AppText variant="heading">{user?.name || "حسابي"}</AppText>
                <AppText variant="caption" color={palette.muted}>
                  {user?.email}
                </AppText>
                <Pressable
                  onPress={() => router.push("/account/edit")}
                  style={{ marginTop: 8 }}
                >
                  <AppText variant="label" color={palette.primary}>
                    تعديل الملف الشخصي
                  </AppText>
                </Pressable>
              </View>
            </Card>
            <View>
              <SectionLabel>مساحتك في السوق</SectionLabel>
              <Card>
                <MenuRow
                  title="إعلاناتي"
                  subtitle="المسودات والإعلانات المنشورة"
                  icon="albums-outline"
                  onPress={() => router.push("/(tabs)/listings")}
                />
                <MenuRow
                  title="محادثاتي"
                  subtitle="تواصل مع المعلنين والمهتمين"
                  icon="chatbubbles-outline"
                  onPress={() => router.push("/(tabs)/messages")}
                />
                <MenuRow
                  title="المفضلة"
                  subtitle="إعلانات لفتت انتباهك"
                  icon="heart-outline"
                  onPress={() => router.push("/(tabs)/favorites")}
                />
                <MenuRow
                  title="الإشعارات"
                  subtitle="آخر تحديثات الحسابات التي تتابعها"
                  icon="notifications-outline"
                  onPress={() => router.push("/notifications")}
                />
                <MenuRow
                  title="قائمة المتابعة"
                  subtitle="المتابعون وتنبيهات الإعلانات المشابهة"
                  icon="people-outline"
                  onPress={() => router.push("/account/follows")}
                />
                <MenuRow
                  title="رسوم المنصة"
                  subtitle="سجل رسوم البيع وتعليمات الدفع"
                  icon="wallet-outline"
                  onPress={() => router.push("/commissions")}
                />
              </Card>
            </View>
          </>
        )}
        <View>
          <SectionLabel>عن سوق حمد</SectionLabel>
          <Card>
            <MenuRow
              title="شروط الاستخدام"
              icon="document-text-outline"
              onPress={() => router.push("/policies/terms")}
            />
            <MenuRow
              title="سياسة الإعلانات"
              icon="shield-checkmark-outline"
              onPress={() => router.push("/policies/listings")}
            />
            <MenuRow
              title="سياسة الخصوصية"
              icon="lock-closed-outline"
              onPress={() => router.push("/policies/privacy")}
            />
            <MenuRow
              title="سياسة رسوم المنصة"
              icon="receipt-outline"
              onPress={() => router.push("/policies/commissions")}
            />
            <MenuRow
              title="تواصل مع الدعم"
              icon="mail-outline"
              onPress={() =>
                void Linking.openURL("mailto:support@souqhamad.com").catch(
                  showError,
                )
              }
            />
          </Card>
        </View>
        {status === "authenticated" && (
          <Button
            title="تسجيل الخروج"
            variant="ghost"
            icon="log-out-outline"
            onPress={() =>
              confirmAction(
                "تسجيل الخروج",
                "يمكنك متابعة تصفح السوق بعد تسجيل الخروج.",
                () => void signOut().catch(showError),
                "تسجيل الخروج",
              )
            }
          />
        )}
        <AppText
          variant="caption"
          color={palette.muted}
          style={{ textAlign: "center" }}
        >
          سوق حمد · مساحة تلتقي فيها الفرص
        </AppText>
      </ScrollView>
    </Screen>
  );
}

export function EditAccountScreen() {
  const { user, status, refresh, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // Hydrate this form when the authenticated server profile changes.

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The server account can change while this form remains mounted.
    setName(user?.name || "");
    setPhone(user?.phoneNumber || "");
  }, [user?.id, user?.name, user?.phoneNumber]);
  const save = useMutation({
    mutationFn: () =>
      api.patch("/api/account/profile", {
        displayName: name.trim(),
        phoneNumber: phone.trim(),
      }),
    onSuccess: async () => {
      await refresh();
      Alert.alert("تم الحفظ", "تم تحديث بيانات حسابك.");
    },
    onError: (error) => showError(error),
  });
  const picture = useMutation({
    mutationFn: async () => {
      const selected = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (selected.canceled || !selected.assets[0]) return;
      if (
        !selected.assets[0].width ||
        !selected.assets[0].height ||
        selected.assets[0].width * selected.assets[0].height > 45_000_000
      )
        throw new Error("اختر صورة واضحة لا تتجاوز 45 مليون بكسل.");
      const context = ImageManipulator.ImageManipulator.manipulate(
        selected.assets[0].uri,
      );
      if (Math.max(selected.assets[0].width, selected.assets[0].height) > 1000)
        context.resize(
          selected.assets[0].width >= selected.assets[0].height
            ? { width: 1000 }
            : { height: 1000 },
        );
      const rendered = await context.renderAsync();
      try {
        const image = await rendered.saveAsync({
          compress: 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        await api.upload("/api/account/profile/picture", {
          uri: image.uri,
          name: "profile.jpg",
          type: "image/jpeg",
        });
      } finally {
        rendered.release();
        context.release();
      }
      await refresh();
    },
    onError: (error) => showError(error),
  });
  const removePicture = useMutation({
    mutationFn: () => api.delete("/api/account/profile/picture"),
    onSuccess: async () => {
      await refresh();
    },
    onError: (error) => showError(error),
  });
  const deleteAccount = useMutation({
    mutationFn: () => api.delete("/api/account/profile"),
    onSuccess: async () => {
      await signOut();
      queryClient.clear();
      router.replace("/");
    },
    onError: (error) => showError(error),
  });
  return (
    <Screen scroll={false}>
      <PageHeader title="تعديل حسابي" back />
      {status === "loading" ? (
        <LoadingState />
      ) : status === "guest" ? (
        <GuestState />
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={shared.content}
        >
          <Card style={local.photoCard}>
            <Avatar name={user?.name} picture={user?.picture} size={100} />
            <View style={shared.row}>
              <Button
                title="تغيير الصورة"
                variant="secondary"
                icon="camera-outline"
                loading={picture.isPending}
                onPress={() => picture.mutate()}
              />
              {user?.picture && (
                <Button
                  title="إزالة"
                  variant="ghost"
                  loading={removePicture.isPending}
                  onPress={() =>
                    confirmAction(
                      "إزالة صورة الحساب",
                      "ستعود صورة الحساب إلى الحرف الأول من اسمك.",
                      () => removePicture.mutate(),
                      "إزالة",
                      true,
                    )
                  }
                />
              )}
            </View>
          </Card>
          <Card style={shared.stack}>
            <AppText variant="heading">بياناتك الشخصية</AppText>
            <Field
              label="الاسم الظاهر"
              value={name}
              onChangeText={setName}
              maxLength={80}
              autoComplete="name"
            />
            <Field
              label="رقم الجوال"
              placeholder="05xxxxxxxx"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
            />
            <AppText variant="caption" color={palette.muted}>
              يمكن للمستخدمين التواصل معك بالرقم الذي تضيفه. احذفه لحصر التواصل
              بالمحادثات الداخلية.
            </AppText>
            <Button
              title="حفظ التغييرات"
              icon="checkmark-outline"
              loading={save.isPending}
              disabled={!name.trim()}
              onPress={() => save.mutate()}
            />
          </Card>
          <Notice>
            يرتبط حسابك بمزود تسجيل الدخول. يمكنك تحديث اسمك وصورتك ورقم التواصل
            هنا.
          </Notice>
          <Card style={shared.stack}>
            <AppText variant="heading" color={palette.danger}>
              حذف الحساب
            </AppText>
            <AppText color={palette.muted}>
              اطّلع على تفاصيل الحذف قبل المتابعة. قد تحتفظ المنصة بالبيانات
              التي يلزم الاحتفاظ بها نظاميًا أو لحماية أدلة البلاغات.
            </AppText>
            <Button
              title="قراءة سياسة الحذف"
              variant="ghost"
              onPress={() => router.push("/policies/deletion")}
            />
            <Button
              title="حذف حسابي نهائيًا"
              variant="danger"
              icon="trash-outline"
              loading={deleteAccount.isPending}
              onPress={() =>
                confirmAction(
                  "حذف حسابك؟",
                  "سيتم حذف الحساب وتسجيل خروجك. ستفقد الوصول إلى إعلاناتك ومحادثاتك والمفضلة المرتبطة به. هذا الإجراء لا يمكن التراجع عنه.",
                  () => deleteAccount.mutate(),
                  "حذف الحساب",
                  true,
                )
              }
            />
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

type FollowPerson = {
  id: string;
  userId: string;
  name: string;
  picture?: string;
  publishedListingCount: number;
  createdAt: string;
  isFollowing: boolean;
};
type SimilarFollow = {
  id: string;
  listingId: string;
  title: string;
  city?: string;
  image?: string;
  createdAt: string;
};
type FollowsPayload = {
  followers: FollowPerson[];
  following: FollowPerson[];
  similarListingFollows: SimilarFollow[];
  followerCount: number;
  followingCount: number;
  similarListingFollowCount: number;
};

export function FollowsScreen() {
  const { user, status } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"following" | "followers" | "similar">(
    "following",
  );
  const query = useQuery({
    queryKey: ["account", user?.id, "follows"],
    queryFn: () => api.get<FollowsPayload>("/api/marketplace/me/follows"),
    enabled: status === "authenticated",
  });
  const change = useMutation({
    onMutate: () => ({ userId: user?.id }),
    mutationFn: ({ id, similar }: { id: string; similar?: boolean }) =>
      api.post(
        similar
          ? `/api/marketplace/listings/${encodeURIComponent(id)}/similar-follow`
          : `/api/marketplace/users/${encodeURIComponent(id)}/follow`,
      ),
    onSuccess: (_data, variables, context) => {
      if (!context?.userId) return;
      void queryClient.invalidateQueries({
        queryKey: ["account", context.userId, "follows"],
      });
      if (variables.similar) {
        void queryClient.invalidateQueries({
          queryKey: ["account", context.userId, "similar-follow", variables.id],
        });
      }
    },
    onError: (error) => showError(error),
  });
  const people =
    query.data?.[tab === "followers" ? "followers" : "following"] || [];
  return (
    <Screen scroll={false}>
      <PageHeader title="قائمة المتابعة" subtitle="ابقَ قريبًا مما يهمك" back />
      {status === "loading" ? (
        <LoadingState />
      ) : status === "guest" ? (
        <GuestState title="تابع المعلنين المفضلين لديك" />
      ) : (
        <ScrollView
          contentContainerStyle={shared.content}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              tintColor={palette.primary}
            />
          }
        >
          <View style={[shared.row, { flexWrap: "wrap" }]}>
            <Chip
              label={`أتابعهم ${query.data?.followingCount ?? ""}`}
              active={tab === "following"}
              onPress={() => setTab("following")}
            />
            <Chip
              label={`المتابعون ${query.data?.followerCount ?? ""}`}
              active={tab === "followers"}
              onPress={() => setTab("followers")}
            />
            <Chip
              label="إعلانات مشابهة"
              active={tab === "similar"}
              onPress={() => setTab("similar")}
            />
          </View>
          {query.isPending ? (
            <LoadingState />
          ) : query.isError ? (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : tab === "similar" ? (
            query.data?.similarListingFollows.length ? (
              query.data.similarListingFollows.map((item) => (
                <Card key={item.id} style={shared.stack}>
                  <Pressable
                    onPress={() =>
                      router.push(
                        `/listings/${encodeURIComponent(item.listingId)}`,
                      )
                    }
                  >
                    <AppText variant="label">{item.title}</AppText>
                    <AppText variant="caption" color={palette.muted}>
                      {item.city} · {formatDate(item.createdAt)}
                    </AppText>
                  </Pressable>
                  <Button
                    title="إلغاء التنبيه"
                    variant="ghost"
                    loading={
                      change.isPending &&
                      change.variables?.id === item.listingId
                    }
                    onPress={() =>
                      change.mutate({ id: item.listingId, similar: true })
                    }
                  />
                </Card>
              ))
            ) : (
              <EmptyState
                title="لم تفعّل تنبيهات بعد"
                message="من صفحة أي إعلان، يمكنك متابعة الإعلانات المشابهة له."
                icon="notifications-outline"
              />
            )
          ) : people.length ? (
            people.map((person) => (
              <Card key={person.id} style={shared.row}>
                <Pressable
                  style={shared.row}
                  onPress={() =>
                    router.push(`/sellers/${encodeURIComponent(person.userId)}`)
                  }
                >
                  <Avatar name={person.name} picture={person.picture} />
                  <View style={{ maxWidth: 145 }}>
                    <AppText variant="label">{person.name}</AppText>
                    <AppText variant="caption" color={palette.muted}>
                      {person.publishedListingCount} إعلان منشور
                    </AppText>
                  </View>
                </Pressable>
                <View style={shared.grow} />
                <Button
                  title={person.isFollowing ? "إلغاء" : "متابعة"}
                  variant={person.isFollowing ? "ghost" : "secondary"}
                  loading={
                    change.isPending && change.variables?.id === person.userId
                  }
                  onPress={() => change.mutate({ id: person.userId })}
                />
              </Card>
            ))
          ) : (
            <EmptyState
              icon="people-outline"
              title={
                tab === "following"
                  ? "لم تتابع أحدًا بعد"
                  : "لا يوجد متابعون بعد"
              }
              message={
                tab === "following"
                  ? "افتح صفحة المعلن واضغط متابعة لتصلك تحديثاته."
                  : "سيظهر هنا من يتابع حسابك."
              }
            />
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

export function PolicyScreen({ policyId }: { policyId: string }) {
  const query = useBootstrap();
  const policies = query.data?.policies;
  const policy = policies?.[policyId];
  return (
    <Screen scroll={false}>
      <PageHeader title={policy?.title || "سياسات المنصة"} back />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !policy ? (
        <EmptyState
          title="الصفحة غير متاحة"
          message="تعذر العثور على هذه السياسة. أعد تحميل بيانات المنصة."
          icon="document-text-outline"
          action={
            <Button
              title="تحديث"
              onPress={() => void query.refetch()}
              variant="secondary"
            />
          }
        />
      ) : (
        <ScrollView contentContainerStyle={shared.content}>
          {policy.updatedAt && (
            <AppText variant="caption" color={palette.muted}>
              آخر تحديث: {policy.updatedAt}
            </AppText>
          )}
          {policy.sections.map((section, index) => (
            <Card key={`${index}-${section.title}`} style={shared.stack}>
              <AppText variant="heading">{section.title}</AppText>
              {section.body && (
                <AppText style={local.policyBody}>{section.body}</AppText>
              )}
              {section.items?.map((item, i) => (
                <View key={i} style={local.bullet}>
                  <View style={local.dot} />
                  <AppText style={[shared.grow, local.policyBody]}>
                    {item}
                  </AppText>
                </View>
              ))}
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const local = StyleSheet.create({
  profile: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 16,
    paddingVertical: 24,
  },
  photoCard: { alignItems: "center", gap: 18, paddingVertical: 24 },
  policyBody: { lineHeight: 27 },
  bullet: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.primary,
    marginTop: 11,
  },
});
