import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { api, assetUrl } from "../../core/api";
import { useAuth } from "../../core/auth";
import { useBootstrap } from "../../core/bootstrap";
import { pickListingImages, type UploadAsset } from "../../core/media";
import type { Listing } from "../../core/types";
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

const c = {
  primary: "#2866B2",
  ink: "#17324F",
  muted: "#738198",
  border: "#E4EAF3",
  soft: "#EDF4FE",
  danger: "#BB3C45",
  green: "#16826A",
};
const conditionLabels: Record<string, string> = {
  new: "جديد",
  like_new: "شبه جديد",
  used: "مستعمل",
  damaged: "يحتاج إصلاح",
};
export type Form = {
  title: string;
  description: string;
  city: string;
  category: string;
  categoryOption: string;
  carModel: string;
  condition: string;
  priceMode: "amount" | "negotiable" | "bid";
  amount: string;
  year: string;
  mileage: string;
};
const blank: Form = {
  title: "",
  description: "",
  city: "",
  category: "",
  categoryOption: "",
  carModel: "",
  condition: "used",
  priceMode: "amount",
  amount: "",
  year: "",
  mileage: "",
};
type Option = { id: string; label: string };
function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : "تحقق من اتصالك ثم أعد المحاولة.";
}
function normalizeNumber(value: string) {
  return value
    .replace(/[٠-٩]/g, (char) => String("٠١٢٣٤٥٦٧٨٩".indexOf(char)))
    .replace(/[۰-۹]/g, (char) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(char)))
    .replace(/[٬,\s]/g, "")
    .replace("٫", ".");
}

export function buildListingBody(
  form: Form,
  listing: Pick<Listing, "category" | "attributes"> | null,
) {
  // The repository merges attributes, so omission retains a previous value.
  // Null explicitly clears visible fields and attributes from another category.
  const clearedPrevious =
    listing && listing.category !== form.category
      ? Object.fromEntries(
          Object.keys(listing.attributes).map((key) => [key, null]),
        )
      : {};
  return {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    city: form.city.trim() || undefined,
    category: form.category,
    condition: form.condition,
    price:
      form.priceMode === "amount"
        ? form.amount.trim()
          ? Number(normalizeNumber(form.amount))
          : undefined
        : form.priceMode,
    attributes: {
      ...clearedPrevious,
      marketplaceCategoryOption: form.categoryOption || null,
      marketplaceCarModel:
        form.category === "cars" ? form.carModel || null : null,
      year:
        form.category === "cars" && form.year.trim()
          ? Number(normalizeNumber(form.year))
          : null,
      mileage:
        form.category === "cars" && form.mileage.trim()
          ? Number(normalizeNumber(form.mileage))
          : null,
      saleTerms: null,
    },
  };
}

function SelectField({
  title,
  value,
  options,
  onSelect,
}: {
  title: string;
  value: string;
  options: Option[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  return (
    <>
      <AppText variant="label">{title}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={() => {
          setSearch("");
          setOpen(true);
        }}
        style={s.select}
      >
        <AppText color={value ? c.ink : c.muted}>
          {options.find((item) => item.id === value)?.label || `اختر ${title}`}
        </AppText>
        <Icon name="chevron-down" size={18} color={c.muted} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.between}>
              <AppText variant="heading">{title}</AppText>
              <Button
                title="إغلاق"
                variant="ghost"
                onPress={() => setOpen(false)}
              />
            </View>
            <Field
              placeholder="ابحث في القائمة"
              value={search}
              onChangeText={setSearch}
            />
            <ScrollView keyboardShouldPersistTaps="handled">
              {options
                .filter((item) => item.label.includes(search))
                .map((item) => (
                  <Pressable
                    key={item.id}
                    style={s.option}
                    onPress={() => {
                      onSelect(item.id);
                      setOpen(false);
                    }}
                  >
                    <AppText color={item.id === value ? c.primary : c.ink}>
                      {item.label}
                    </AppText>
                    {item.id === value && (
                      <Icon
                        name="checkmark-circle"
                        color={c.primary}
                        size={22}
                      />
                    )}
                  </Pressable>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function ListingEditorScreen({ listingId }: { listingId?: string }) {
  const { user, status } = useAuth();
  if (status === "loading")
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  if (!user)
    return (
      <Screen>
        <PageHeader title="إعلانك القادم يبدأ هنا" back />
        <EmptyState
          title="سجّل الدخول لإنشاء إعلانك"
          message="احفظ مسودتك وأضف الصور ثم انشر عندما تكون جاهزًا."
          icon="person-outline"
          action={
            <Button title="تسجيل الدخول" onPress={() => router.push("/auth")} />
          }
        />
      </Screen>
    );
  return (
    <Editor
      key={`${user.id}:${listingId ?? "new"}`}
      listingId={listingId}
      ownerId={user.id}
    />
  );
}

function Editor({
  listingId,
  ownerId,
}: {
  listingId?: string;
  ownerId: string;
}) {
  const bootstrap = useBootstrap();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(blank);
  const [listing, setListing] = useState<Listing | null>(null);
  const [assets, setAssets] = useState<UploadAsset[]>([]);
  const [picking, setPicking] = useState(false);
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState("");
  const createKey = useRef(Crypto.randomUUID());
  const uploadKeys = useRef(new Map<string, string>());
  const alive = useRef(true);
  const hydrated = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const ownedQuery = useQuery({
    queryKey: ["owned-listing", ownerId, listingId],
    queryFn: () =>
      api.get<{ listing: Listing }>(
        `/api/marketplace/me/listings/${listingId}`,
      ),
    enabled: Boolean(listingId),
  });
  useEffect(() => {
    if (!ownedQuery.data?.listing || hydrated.current) return;
    hydrated.current = true;
    const value = ownedQuery.data.listing;
    setListing(value);
    const attributes = value.attributes ?? {};
    setForm({
      title: value.title || "",
      description: value.description || "",
      city: value.city || "",
      category: value.category,
      categoryOption: String(attributes.marketplaceCategoryOption || ""),
      carModel: String(attributes.marketplaceCarModel || ""),
      condition: value.condition || "used",
      priceMode:
        typeof value.price === "number" || value.price == null
          ? "amount"
          : value.price,
      amount: typeof value.price === "number" ? String(value.price) : "",
      year: String(attributes.year || ""),
      mileage: String(attributes.mileage || ""),
    });
  }, [ownedQuery.data]);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice("");
  };
  const maxImages = Math.min(8, bootstrap.data?.limits.maxListingImages ?? 8);
  const category = bootstrap.data?.categories.find(
    (item) => item.id === form.category,
  );
  const categoryOptions = category?.options ?? [];
  const carModels = category?.carModels?.[form.categoryOption] ?? [];
  const validate = (forPublication = false) => {
    if (form.title.trim().length < 2)
      throw new Error("أضف عنوانًا واضحًا من حرفين على الأقل.");
    if (!form.category) throw new Error("اختر تصنيف الإعلان.");
    if (
      (forPublication || form.description.trim()) &&
      form.description.trim().length < 2
    )
      throw new Error("اكتب وصفًا يوضح حالة المنتج وتفاصيله.");
    if ((forPublication || form.city.trim()) && form.city.trim().length < 2)
      throw new Error("اختر المدينة.");
    if (
      form.priceMode === "amount" &&
      ((forPublication && !form.amount.trim()) ||
        (form.amount.trim() &&
          (!Number.isFinite(Number(normalizeNumber(form.amount))) ||
            Number(normalizeNumber(form.amount)) < 0)))
    )
      throw new Error("أدخل سعرًا صحيحًا أو اختر قابل للتفاوض أو على السوم.");
    if (
      form.category === "cars" &&
      form.year &&
      (!/^\d{4}$/.test(normalizeNumber(form.year)) ||
        Number(normalizeNumber(form.year)) < 1900 ||
        Number(normalizeNumber(form.year)) > 2099)
    )
      throw new Error("أدخل سنة صحيحة بين 1900 و2099.");
    if (
      form.category === "cars" &&
      form.mileage &&
      !/^\d+$/.test(normalizeNumber(form.mileage))
    )
      throw new Error("أدخل المسافة بالكيلومتر كرقم صحيح.");
  };
  const body = () => buildListingBody(form, listing);
  const save = useMutation({
    mutationFn: async () => {
      validate();
      const response = listing
        ? await api.patch<{ listing: Listing }>(
            `/api/marketplace/listings/${listing.id}`,
            body(),
          )
        : await api.post<{ listing: Listing }>(
            "/api/marketplace/listings",
            body(),
            { idempotencyKey: createKey.current },
          );
      let saved = response.listing;
      if (!alive.current)
        throw new Error("توقفت العملية بعد مغادرة شاشة الإعلان.");
      setListing(saved);
      // Save each upload independently; failed items stay in the queue for retry.
      for (const asset of assets) {
        const uploadKey =
          uploadKeys.current.get(asset.uri) ?? Crypto.randomUUID();
        uploadKeys.current.set(asset.uri, uploadKey);
        const result = await api.upload<{ listing?: Listing }>(
          `/api/marketplace/listings/${saved.id}/images`,
          asset,
          { idempotencyKey: uploadKey },
        );
        if (!alive.current)
          throw new Error("توقفت العملية بعد مغادرة شاشة الإعلان.");
        setAssets((current) =>
          current.filter((item) => item.uri !== asset.uri),
        );
        if (result.listing) {
          saved = result.listing;
          setListing(saved);
        }
      }
      const fresh = await api.get<{ listing: Listing }>(
        `/api/marketplace/me/listings/${saved.id}`,
      );
      if (alive.current) setListing(fresh.listing);
      return fresh.listing;
    },
    onSuccess: () => {
      if (!alive.current) return;
      setNotice("حُفظت التعديلات والصور. يمكنك معاينة إعلانك ثم نشره.");
      void queryClient.invalidateQueries({ queryKey: ["my-listings"] });
    },
  });
  const publish = useMutation({
    mutationFn: async () => {
      validate(true);
      const saved = await save.mutateAsync();
      if (!alive.current)
        throw new Error("توقفت عملية النشر بعد مغادرة شاشة الإعلان.");
      return api.patch<{ listing: Listing }>(
        `/api/marketplace/listings/${saved.id}`,
        { action: "publish" },
        { idempotencyKey: Crypto.randomUUID() },
      );
    },
    onSuccess: (result) => {
      if (!alive.current) return;
      setListing(result.listing);
      setPreview(false);
      void queryClient.invalidateQueries();
      Alert.alert("تم نشر إعلانك", "إعلانك متاح الآن في السوق.", [
        {
          text: "عرض الإعلان",
          onPress: () =>
            router.replace(`/listings/${result.listing.id}` as never),
        },
      ]);
    },
    onError: (error) => {
      if (alive.current) Alert.alert("لم يتم النشر", errorText(error));
    },
  });
  const busy = save.isPending || publish.isPending;
  const chooseImages = async (source: "camera" | "library") => {
    setPicking(true);
    try {
      const selected = await pickListingImages(
        source,
        maxImages - (listing?.images.length ?? 0) - assets.length,
      );
      if (alive.current)
        setAssets((current) =>
          [...current, ...selected].slice(
            0,
            maxImages - (listing?.images.length ?? 0),
          ),
        );
    } catch (error) {
      Alert.alert("إضافة الصور", errorText(error));
    } finally {
      if (alive.current) setPicking(false);
    }
  };
  const removeImage = (imageId: string) =>
    Alert.alert("حذف الصورة", "هل تريد إزالة هذه الصورة من الإعلان؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => {
          void api
            .delete(
              `/api/marketplace/listings/${listing!.id}/images/${imageId}`,
            )
            .then(() => {
              if (alive.current)
                setListing(
                  (current) =>
                    current && {
                      ...current,
                      images: current.images.filter(
                        (image) => image.id !== imageId,
                      ),
                    },
                );
            })
            .catch((error) => Alert.alert("تعذر حذف الصورة", errorText(error)));
        },
      },
    ]);
  if (bootstrap.isPending || (listingId && ownedQuery.isPending))
    return (
      <Screen>
        <PageHeader title="تجهيز مساحة إعلانك" back />
        <LoadingState />
      </Screen>
    );
  if (bootstrap.isError || ownedQuery.isError)
    return (
      <Screen>
        <PageHeader title="إعلانك" back />
        <EmptyState
          title="تعذر تحميل بيانات الإعلان"
          message={errorText(bootstrap.error || ownedQuery.error)}
          action={
            <Button
              title="إعادة المحاولة"
              onPress={() => {
                void bootstrap.refetch();
                void ownedQuery.refetch();
              }}
            />
          }
        />
      </Screen>
    );
  const images = [
    ...(listing?.images.map((image) => ({
      uri:
        assetUrl(image.displayUrl || image.thumbnailUrl || image.originalUrl) ??
        "",
      id: image.id,
      saved: true,
      primary: image.isPrimary,
    })) ?? []),
    ...assets.map((image) => ({
      uri: image.uri,
      id: image.uri,
      saved: false,
      primary: false,
    })),
  ];
  const price =
    form.priceMode === "amount"
      ? `${form.amount || "—"} ر.س`
      : form.priceMode === "bid"
        ? "على السوم"
        : "قابل للتفاوض";
  return (
    <Screen scroll={false}>
      <PageHeader
        title={listingId ? "تعديل الإعلان" : "إعلان جديد"}
        subtitle="أضف التفاصيل التي تجعل الفرصة واضحة"
        back
        right={
          <Chip
            label={listing?.status === "published" ? "منشور" : "مسودة"}
            active
          />
        }
      />
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={s.tip}>
          <Icon name="sparkles-outline" size={22} color={c.primary} />
          <View style={s.grow}>
            <AppText variant="label">صورة واضحة. وصف صادق. فرصة أقرب.</AppText>
            <AppText variant="caption" color={c.muted}>
              احفظ مسودتك في أي وقت. النشر يتم باختيارك أنت.
            </AppText>
          </View>
        </Card>
        <View style={s.between}>
          <AppText variant="heading">صور الإعلان</AppText>
          <AppText variant="caption" color={c.muted}>
            {images.length} / {maxImages}
          </AppText>
        </View>
        <ScrollView
          horizontal
          contentContainerStyle={s.photos}
          showsHorizontalScrollIndicator={false}
        >
          {images.map((image, index) => (
            <View key={image.id} style={s.photoBox}>
              <Image source={{ uri: image.uri }} style={s.photo} />
              {(image.primary || (!listing?.images.length && index === 0)) && (
                <View style={s.photoBadge}>
                  <AppText variant="caption" color="#fff">
                    الرئيسية
                  </AppText>
                </View>
              )}
              <Pressable
                accessibilityLabel="حذف الصورة"
                disabled={busy}
                style={s.remove}
                onPress={() =>
                  image.saved
                    ? removeImage(image.id)
                    : setAssets((current) =>
                        current.filter((item) => item.uri !== image.uri),
                      )
                }
              >
                <Icon name="close" size={16} color="#fff" />
              </Pressable>
              {image.saved && !image.primary && (
                <Pressable
                  style={s.makePrimary}
                  onPress={() => {
                    void api
                      .patch(
                        `/api/marketplace/listings/${listing!.id}/images/${image.id}`,
                        { action: "set_primary" },
                      )
                      .then(() =>
                        setListing(
                          (current) =>
                            current && {
                              ...current,
                              images: current.images.map((item) => ({
                                ...item,
                                isPrimary: item.id === image.id,
                              })),
                            },
                        ),
                      )
                      .catch((error) =>
                        Alert.alert("تعذر تحديث الصورة", errorText(error)),
                      );
                  }}
                >
                  <AppText variant="caption" color={c.primary}>
                    تعيين كرئيسية
                  </AppText>
                </Pressable>
              )}
            </View>
          ))}
          {!images.length && (
            <View style={s.photoEmpty}>
              <Icon name="images-outline" size={32} color={c.primary} />
              <AppText variant="caption" color={c.muted}>
                أظهر منتجك من أكثر من زاوية
              </AppText>
            </View>
          )}
        </ScrollView>
        <View style={s.row}>
          <View style={s.grow}>
            <Button
              title="من الصور"
              variant="secondary"
              icon="images-outline"
              loading={picking}
              disabled={busy || images.length >= maxImages}
              onPress={() => void chooseImages("library")}
            />
          </View>
          <View style={s.grow}>
            <Button
              title="التقاط صورة"
              variant="secondary"
              icon="camera-outline"
              disabled={busy || picking || images.length >= maxImages}
              onPress={() => void chooseImages("camera")}
            />
          </View>
        </View>
        <AppText variant="caption" color={c.muted}>
          تُحوّل صور الكاميرا إلى JPEG تلقائيًا. الحد الأقصى للصورة 12 ميجابايت.
        </AppText>
        <Card style={s.stack}>
          <AppText variant="heading">التفاصيل الأساسية</AppText>
          <Field
            label="عنوان الإعلان"
            placeholder="ما الذي تعرضه للبيع؟"
            value={form.title}
            onChangeText={(value) => set("title", value)}
            maxLength={140}
            editable={!busy}
          />
          <SelectField
            title="التصنيف"
            value={form.category}
            options={bootstrap.data?.categories ?? []}
            onSelect={(value) => {
              setForm((current) =>
                current.category === value
                  ? current
                  : {
                      ...current,
                      category: value,
                      categoryOption: "",
                      carModel: "",
                      year: "",
                      mileage: "",
                    },
              );
            }}
          />
          {!!categoryOptions.length && (
            <SelectField
              title={form.category === "cars" ? "الماركة" : "النوع"}
              value={form.categoryOption}
              options={categoryOptions}
              onSelect={(value) => {
                set("categoryOption", value);
                set("carModel", "");
              }}
            />
          )}
          {!!carModels.length && (
            <SelectField
              title="الموديل"
              value={form.carModel}
              options={carModels}
              onSelect={(value) => set("carModel", value)}
            />
          )}
          <SelectField
            title="المدينة"
            value={form.city}
            options={(bootstrap.data?.cities ?? []).map((city) => ({
              id: city,
              label: city,
            }))}
            onSelect={(value) => set("city", value)}
          />
          <AppText variant="label">الحالة</AppText>
          <View style={s.wrap}>
            {Object.entries(conditionLabels).map(([id, label]) => (
              <Chip
                key={id}
                label={label}
                active={form.condition === id}
                onPress={() => set("condition", id)}
              />
            ))}
          </View>
        </Card>
        {form.category === "cars" && (
          <Card style={s.stack}>
            <AppText variant="heading">تفاصيل المركبة</AppText>
            <Field
              label="سنة الصنع"
              value={form.year}
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={(value) => set("year", value)}
            />
            <Field
              label="المسافة المقطوعة (كم)"
              value={form.mileage}
              keyboardType="number-pad"
              onChangeText={(value) => set("mileage", value)}
            />
          </Card>
        )}
        <Card style={s.stack}>
          <AppText variant="heading">السعر والوصف</AppText>
          <View style={s.wrap}>
            {(
              [
                { id: "amount", label: "سعر محدد" },
                { id: "negotiable", label: "قابل للتفاوض" },
                { id: "bid", label: "على السوم" },
              ] as const
            ).map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                active={form.priceMode === item.id}
                onPress={() => set("priceMode", item.id)}
              />
            ))}
          </View>
          {form.priceMode === "amount" && (
            <Field
              label="السعر بالريال السعودي"
              value={form.amount}
              keyboardType="decimal-pad"
              placeholder="0"
              onChangeText={(value) => set("amount", value)}
              editable={!busy}
            />
          )}
          <Field
            label="وصف الإعلان"
            placeholder="الحالة، المواصفات، الملحقات وأي ملاحظات يهم المشتري معرفتها…"
            value={form.description}
            onChangeText={(value) => set("description", value)}
            maxLength={4000}
            multiline
            numberOfLines={6}
            style={{ minHeight: 145, textAlignVertical: "top" }}
            editable={!busy}
          />
          <AppText variant="caption" color={c.muted}>
            {form.description.length} / 4000
          </AppText>
        </Card>
        {!!notice && (
          <Card style={{ backgroundColor: "#EAF7F1" }}>
            <AppText color={c.green}>{notice}</AppText>
          </Card>
        )}
        <Card style={s.tip}>
          <Icon name="shield-checkmark-outline" size={22} color={c.primary} />
          <AppText style={s.grow} variant="caption" color={c.muted}>
            عند إتمام البيع عبر المنصة تستحق رسوم قدرها 1% من قيمة البيع. راجع
            إعلانك وصورك قبل النشر.
          </AppText>
        </Card>
        <Button
          title="معاينة الإعلان"
          icon="eye-outline"
          onPress={() => {
            try {
              validate(true);
              setPreview(true);
            } catch (error) {
              Alert.alert("أكمل تفاصيل إعلانك", errorText(error));
            }
          }}
          disabled={busy || picking}
        />
        <Button
          title="حفظ التعديلات"
          variant="secondary"
          icon="save-outline"
          loading={save.isPending && !publish.isPending}
          disabled={busy || picking}
          onPress={() =>
            save.mutate(undefined, {
              onError: (error) =>
                Alert.alert(
                  "تعذر حفظ كل التعديلات",
                  `${errorText(error)}\nالصور التي لم تُرفع باقية لإعادة المحاولة.`,
                ),
            })
          }
        />
      </ScrollView>
      <Modal
        visible={preview}
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setPreview(false);
        }}
      >
        <Screen scroll={false}>
          <PageHeader
            title="معاينة إعلانك"
            subtitle="كما سيظهر للمهتمين"
            right={
              <Button
                title="إغلاق"
                variant="ghost"
                onPress={() => setPreview(false)}
                disabled={busy}
              />
            }
          />
          <ScrollView contentContainerStyle={s.content}>
            <ScrollView horizontal pagingEnabled>
              {images.map((image) => (
                <Image
                  key={image.id}
                  source={{ uri: image.uri }}
                  style={{
                    width: 320,
                    height: 270,
                    borderRadius: 18,
                    marginEnd: 10,
                    backgroundColor: c.soft,
                  }}
                />
              ))}
            </ScrollView>
            <AppText variant="title">{form.title}</AppText>
            <AppText variant="heading" color={c.primary}>
              {price}
            </AppText>
            <View style={s.wrap}>
              <Chip label={form.city} />
              <Chip label={category?.label || form.category} />
              <Chip label={conditionLabels[form.condition]} />
            </View>
            <Card>
              <AppText>{form.description}</AppText>
            </Card>
            <AppText variant="caption" color={c.muted}>
              تخضع الصور والمحتوى لسياسات المنصة. لن يتم النشر حتى تضغط تأكيد
              النشر.
            </AppText>
            <Button
              title="نشر الإعلان"
              icon="paper-plane-outline"
              loading={publish.isPending}
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  "نشر الإعلان",
                  "تأكدت من صحة البيانات والصور وأرغب في نشر الإعلان. تستحق رسوم المنصة 1% عند إتمام البيع عبرها.",
                  [
                    { text: "مراجعة", style: "cancel" },
                    { text: "تأكيد النشر", onPress: () => publish.mutate() },
                  ],
                )
              }
            />
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  stack: { gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  grow: { flex: 1, minWidth: 0 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: c.soft,
  },
  photos: { gap: 12, paddingVertical: 2 },
  photoBox: { width: 122 },
  photo: { width: 122, height: 122, borderRadius: 16, backgroundColor: c.soft },
  photoBadge: {
    position: "absolute",
    bottom: 26,
    start: 5,
    backgroundColor: c.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  remove: {
    position: "absolute",
    top: 6,
    end: 6,
    backgroundColor: "#17324FCC",
    borderRadius: 20,
    width: 27,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  makePrimary: { paddingTop: 5 },
  photoEmpty: {
    width: 300,
    height: 122,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#BBCFE9",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  select: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  overlay: {
    direction: "ltr",
    flex: 1,
    backgroundColor: "#102A4780",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "85%",
    minHeight: "50%",
    backgroundColor: "#fff",
    borderTopStartRadius: 26,
    borderTopEndRadius: 26,
    padding: 22,
    gap: 15,
  },
  option: {
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
