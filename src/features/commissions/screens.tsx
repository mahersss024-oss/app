import React, { useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { api } from "../../core/api";
import { useAuth } from "../../core/auth";
import type { Pagination } from "../../core/types";
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
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
  money,
  Notice,
  palette,
  showError,
  styles,
} from "../account/shared";

type Commission = {
  id: string;
  listingId: string;
  productValue: number | null;
  commissionAmount: number | null;
  status: "pending_amount" | "due" | "paid" | "waived" | "disputed";
  createdAt: string;
  listing?: { title?: string; city?: string } | null;
};
type CommissionPage = { commissions: Commission[]; pagination: Pagination };
type PaymentMethod = {
  id: string;
  name: string;
  subtitle: string;
  logoLabel: string;
  fields: { label: string; value: string; copyValue: string }[];
};
const statusLabels: Record<Commission["status"], string> = {
  pending_amount: "بانتظار قيمة البيع",
  due: "مستحقة",
  paid: "مدفوعة",
  waived: "معفاة",
  disputed: "قيد المراجعة",
};

function normalizeAmount(value: string) {
  return Number(
    value
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٬,\s]/g, "")
      .replace("٫", "."),
  );
}

function CommissionRow({
  item,
  onSaved,
}: {
  item: Commission;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const parsedAmount = normalizeAmount(amount);
  const update = useMutation({
    mutationFn: () =>
      api.patch(`/api/marketplace/commissions/${encodeURIComponent(item.id)}`, {
        productValue: parsedAmount,
      }),
    onSuccess: () => {
      setAmount("");
      onSaved();
    },
    onError: (error) => showError(error),
  });
  return (
    <Card style={styles.stack}>
      <View style={styles.between}>
        <View style={styles.grow}>
          <AppText variant="label">
            {item.listing?.title || "رسوم إعلان مباع"}
          </AppText>
          <AppText variant="caption" color={palette.muted}>
            {formatDate(item.createdAt)}
            {item.listing?.city ? ` · ${item.listing.city}` : ""}
          </AppText>
        </View>
        <Chip
          label={statusLabels[item.status]}
          active={item.status === "due"}
        />
      </View>
      <View style={local.amounts}>
        <View style={styles.grow}>
          <AppText variant="caption" color={palette.muted}>
            قيمة البيع
          </AppText>
          <AppText variant="label">{money(item.productValue)}</AppText>
        </View>
        <View style={styles.grow}>
          <AppText variant="caption" color={palette.muted}>
            رسوم المنصة · 1%
          </AppText>
          <AppText variant="heading" color={palette.primary}>
            {money(item.commissionAmount)}
          </AppText>
        </View>
      </View>
      {(item.status === "pending_amount" || item.status === "due") && (
        <View style={styles.stack}>
          <Field
            label="قيمة البيع النهائية (ر.س)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={
              item.productValue == null
                ? "أدخل قيمة البيع"
                : String(item.productValue)
            }
          />
          <Button
            title="حفظ قيمة البيع"
            variant="secondary"
            loading={update.isPending}
            disabled={
              !amount.trim() ||
              !Number.isFinite(parsedAmount) ||
              parsedAmount <= 0
            }
            onPress={() =>
              confirmAction(
                "تأكيد قيمة البيع",
                `أتعهد وأقسم بالله أن قيمة البيع النهائية التي أدخلتها صحيحة، وأنني سأدفع رسوم منصة سوق حمد وهي 1% من قيمة البيع، سواء تم البيع عن طريق المنصة أو بسببها.\n\nقيمة البيع: ${money(parsedAmount)}\nرسوم المنصة: ${money(Math.round(parsedAmount) / 100)}`,
                () => update.mutate(),
                "أتعهد وأؤكد",
              )
            }
          />
        </View>
      )}
    </Card>
  );
}

export function CommissionsScreen() {
  const { user, status } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["account", user?.id, "commissions"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get<CommissionPage>("/api/marketplace/me/commissions", {
        page: pageParam,
        limit: 20,
      }),
    getNextPageParam: (page) => page.pagination.nextPage ?? undefined,
    enabled: status === "authenticated",
  });
  const payment = useQuery({
    queryKey: ["account", user?.id, "commission-payment-methods"],
    queryFn: () =>
      api.get<{ paymentMethods: PaymentMethod[] }>(
        "/api/marketplace/commission-payment-methods",
      ),
    enabled: status === "authenticated",
  });
  const items = query.data?.pages.flatMap((page) => page.commissions) || [];
  const copy = async (value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      setCopied(value);
    } catch (error) {
      showError(error, "تعذر نسخ البيانات");
    }
  };
  return (
    <Screen scroll={false}>
      <PageHeader
        title="رسوم المنصة"
        subtitle="التزامك يساهم في استمرار سوق حمد"
        back
      />
      {status === "loading" ? (
        <LoadingState />
      ) : status === "guest" ? (
        <GuestState title="سجل رسوم البيع الخاص بك" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching || payment.isRefetching}
              onRefresh={() => {
                void query.refetch();
                void payment.refetch();
              }}
              tintColor={palette.primary}
            />
          }
          ListHeaderComponent={
            <View style={[styles.stack, { marginBottom: 8 }]}>
              <Card style={local.hero}>
                <View style={local.percent}>
                  <AppText variant="title" color={palette.primary}>
                    1%
                  </AppText>
                </View>
                <View style={styles.grow}>
                  <AppText variant="heading">رسوم البيع عبر سوق حمد</AppText>
                  <AppText color={palette.muted}>
                    من قيمة البيع المكتمل عبر المنصة.
                  </AppText>
                </View>
              </Card>
              <Button
                title="قراءة سياسة رسوم المنصة"
                variant="ghost"
                icon="document-text-outline"
                onPress={() => router.push("/policies/commissions")}
              />
              <AppText variant="heading">طرق دفع رسوم المنصة</AppText>
              {payment.isPending ? (
                <LoadingState />
              ) : payment.isError ? (
                <ErrorState
                  error={payment.error}
                  retry={() => void payment.refetch()}
                />
              ) : payment.data?.paymentMethods.length ? (
                payment.data.paymentMethods.map((method) => (
                  <Card key={method.id} style={styles.stack}>
                    <View style={styles.between}>
                      <View style={styles.grow}>
                        <AppText variant="label">{method.name}</AppText>
                        <AppText variant="caption" color={palette.muted}>
                          {method.subtitle}
                        </AppText>
                      </View>
                      <View style={local.bankBadge}>
                        <AppText variant="label" color={palette.primary}>
                          {method.logoLabel}
                        </AppText>
                      </View>
                    </View>
                    {method.fields.map((field, index) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`نسخ ${field.label}`}
                        key={`${method.id}-${index}`}
                        style={local.paymentField}
                        onPress={() => void copy(field.copyValue)}
                      >
                        <View style={styles.grow}>
                          <AppText variant="caption" color={palette.muted}>
                            {field.label}
                          </AppText>
                          <AppText style={local.paymentValue}>
                            {field.value}
                          </AppText>
                        </View>
                        <Icon
                          name={
                            copied === field.copyValue
                              ? "checkmark-circle"
                              : "copy-outline"
                          }
                          size={20}
                          color={palette.primary}
                        />
                      </Pressable>
                    ))}
                  </Card>
                ))
              ) : (
                <Notice>لم يتم إعداد بيانات دفع رسوم المنصة بعد.</Notice>
              )}
              <AppText variant="heading" style={{ marginTop: 8 }}>
                سجل رسوم المنصة
              </AppText>
            </View>
          }
          renderItem={({ item }) => (
            <CommissionRow item={item} onSaved={() => void query.refetch()} />
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
                icon="receipt-outline"
                title="لا توجد رسوم مسجلة"
                message="تظهر هنا الرسوم عند تسجيل بيع أحد إعلاناتك."
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

const local = StyleSheet.create({
  hero: { flexDirection: "row-reverse", alignItems: "center", gap: 16 },
  percent: {
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: palette.soft,
    justifyContent: "center",
    alignItems: "center",
  },
  amounts: {
    flexDirection: "row-reverse",
    padding: 14,
    backgroundColor: palette.background,
    borderRadius: 12,
    gap: 12,
  },
  bankBadge: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: palette.soft,
  },
  paymentField: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: palette.background,
    borderRadius: 12,
  },
  paymentValue: { writingDirection: "ltr", textAlign: "right", marginTop: 4 },
});
