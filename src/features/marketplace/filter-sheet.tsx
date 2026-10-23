import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Category } from "../../core/types";
import { AppText, Button, Card, Field, Icon, Screen, colors } from "../../ui";

export type MarketFilters = {
  /** Local selection only; the API receives category or categories. */
  group?: string;
  categories?: string;
  category?: string;
  categoryOption?: string;
  carModel?: string;
  city?: string;
  minPrice?: string;
  maxPrice?: string;
  condition?: string;
  sort?: string;
  yearMin?: string;
  yearMax?: string;
  mileageMin?: string;
  mileageMax?: string;
};

type Choice = { id: string; label: string };
type Selector = {
  title: string;
  options: Choice[];
  value?: string;
  onSelect: (id: string | undefined) => void;
};
type Props = {
  visible: boolean;
  filters: MarketFilters;
  categories: Category[];
  cities: string[];
  onApply: (filters: MarketFilters) => void;
  onClose: () => void;
};

const conditions: Choice[] = [
  { id: "new", label: "جديد" },
  { id: "used", label: "مستعمل" },
  { id: "like_new", label: "شبه جديد" },
  { id: "damaged", label: "يحتاج إصلاح" },
];
// closest is accepted by the API but does not currently sort by actual distance.
const sorts: Choice[] = [
  { id: "best_match", label: "الأكثر صلة" },
  { id: "newest", label: "الأحدث" },
  { id: "cheapest", label: "الأقل سعرًا" },
  { id: "best_condition", label: "الأفضل حالة" },
  { id: "lowest_mileage", label: "الأقل ممشى" },
];
const numericFields = [
  "minPrice", "maxPrice", "yearMin", "yearMax", "mileageMin", "mileageMax",
] as const;
type NumericField = (typeof numericFields)[number];

function latinNumber(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/٫/g, ".")
    .replace(/[٬,\s]/g, "");
}

function SelectField({ title, value, onPress }: {
  title: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${value || "الكل"}`}
      onPress={onPress} style={s.select}>
      <View style={{ flex: 1, gap: 5 }}>
        <AppText variant="caption">{title}</AppText>
        <AppText variant="label">{value || "الكل"}</AppText>
      </View>
      <Icon name="chevron-down" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function MarketFilterSheet(props: Props) {
  return (
    <Modal visible={props.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onClose}>
      {props.visible ? <MarketFilterContent key={JSON.stringify(props.filters)} {...props} /> : null}
    </Modal>
  );
}

function MarketFilterContent({ filters, categories, cities, onApply, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<MarketFilters>(filters);
  const [selector, setSelector] = useState<Selector | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const groups = [...new Set(categories.map((category) => category.group))];
  const category = categories.find((entry) => entry.id === draft.category);
  const group = category?.group || draft.group || groups.find((entry) => {
    const ids = categories.filter((entryCategory) => entryCategory.group === entry).map((entryCategory) => entryCategory.id);
    const selected = draft.categories?.split(",");
    return selected?.length === ids.length && ids.every((id) => selected.includes(id));
  });
  const groupCategories = categories.filter((entry) => !group || entry.group === group);
  const options = category?.options || [];
  const models = category?.carModels?.[draft.categoryOption || ""] || [];
  const label = (options: Choice[], id?: string) => options.find((entry) => entry.id === id)?.label;

  function update(values: Partial<MarketFilters>) {
    setError("");
    setDraft((current) => ({ ...current, ...values }));
  }
  function choose(next: Selector) {
    setSearch("");
    setSelector(next);
  }
  function updateNumber(key: NumericField, value: string) {
    update({ [key]: latinNumber(value) });
  }
  function apply() {
    const next: MarketFilters = {};
    if (group && groups.includes(group)) next.group = group;
    if (category) {
      next.category = category.id;
      if (options.some((entry) => entry.id === draft.categoryOption)) {
        next.categoryOption = draft.categoryOption;
        if (models.some((entry) => entry.id === draft.carModel)) next.carModel = draft.carModel;
      }
    } else if (next.group) {
      next.categories = categories.filter((entry) => entry.group === next.group).map((entry) => entry.id).join(",");
    }
    if (draft.city && cities.includes(draft.city)) next.city = draft.city;
    if (conditions.some((entry) => entry.id === draft.condition)) next.condition = draft.condition;
    if (sorts.some((entry) => entry.id === draft.sort)) next.sort = draft.sort;
    for (const field of numericFields) {
      if (field !== "minPrice" && field !== "maxPrice" && category?.id !== "cars") continue;
      const value = latinNumber(draft[field] || "");
      if (!value) continue;
      const number = Number(value);
      const integer = field !== "minPrice" && field !== "maxPrice";
      if (!/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(number) || number < 0 ||
        (integer && !Number.isSafeInteger(number))) {
        setError("أدخل أرقامًا صحيحة موجبة في نطاقات البحث.");
        return;
      }
      if ((field === "yearMin" || field === "yearMax") && (number < 1900 || number > 2099)) {
        setError("سنة الصنع يجب أن تكون بين 1900 و2099.");
        return;
      }
      next[field] = String(number);
    }
    for (const [min, max, title] of [
      ["minPrice", "maxPrice", "السعر"],
      ["yearMin", "yearMax", "سنة الصنع"],
      ["mileageMin", "mileageMax", "الممشى"],
    ] as const) {
      if (next[min] !== undefined && next[max] !== undefined && Number(next[min]) > Number(next[max])) {
        setError(`الحد الأدنى لـ${title} يجب ألا يتجاوز الحد الأعلى.`);
        return;
      }
    }
    onApply(next);
  }

  const selectionOptions = selector
    ? [{ id: "", label: "الكل" }, ...selector.options].filter((entry) =>
      `${entry.label} ${entry.id}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    : [];
  return (
      <Screen>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <AppText variant="heading">{selector?.title || "تصفية الإعلانات"}</AppText>
              {!selector ? <AppText variant="caption">حدّد ما تبحث عنه بدقة</AppText> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={selector ? "العودة للفلاتر" : "إغلاق الفلاتر"}
              hitSlop={12} onPress={() => selector ? setSelector(null) : onClose()} style={s.close}>
              <Icon name={selector ? "arrow-forward" : "close"} />
            </Pressable>
          </View>
          {selector ? (
            <View style={{ flex: 1 }}>
              <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
                <Field placeholder="بحث في الخيارات" value={search} onChangeText={setSearch} autoCorrect={false} />
              </View>
              <FlatList data={selectionOptions} keyboardShouldPersistTaps="handled"
                keyExtractor={(entry) => entry.id} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}
                ListEmptyComponent={<AppText variant="caption" style={{ padding: 20 }}>لا توجد خيارات مطابقة.</AppText>}
                renderItem={({ item }) => (
                  <Pressable accessibilityRole="radio" accessibilityState={{ checked: item.id === (selector.value || "") }}
                    style={s.choice} onPress={() => { selector.onSelect(item.id || undefined); setSelector(null); }}>
                    <AppText style={{ flex: 1 }}>{item.label}</AppText>
                    <Icon name={item.id === (selector.value || "") ? "checkmark-circle" : "ellipse-outline"}
                      color={item.id === (selector.value || "") ? colors.primary : colors.border} />
                  </Pressable>
                )} />
            </View>
          ) : (
            <>
              <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={s.content}>
                <Card>
                  <AppText variant="label">القسم</AppText>
                  <SelectField title="المجموعة" value={group} onPress={() => choose({ title: "المجموعة", options: groups.map((entry) => ({ id: entry, label: entry })), value: group,
                    onSelect: (id) => update({ group: id, categories: id ? categories.filter((entry) => entry.group === id).map((entry) => entry.id).join(",") : undefined,
                      category: undefined, categoryOption: undefined, carModel: undefined, yearMin: undefined, yearMax: undefined, mileageMin: undefined, mileageMax: undefined }) })} />
                  <SelectField title="القسم الفرعي" value={category?.label} onPress={() => choose({ title: "القسم الفرعي", options: groupCategories, value: category?.id,
                    onSelect: (id) => update({ category: id, group: categories.find((entry) => entry.id === id)?.group || group,
                      categories: id ? undefined : groupCategories.map((entry) => entry.id).join(","), categoryOption: undefined, carModel: undefined,
                      yearMin: undefined, yearMax: undefined, mileageMin: undefined, mileageMax: undefined }) })} />
                  {options.length ? <SelectField title={category?.optionLabel || "النوع"} value={label(options, draft.categoryOption)}
                    onPress={() => choose({ title: category?.optionLabel || "النوع", options, value: draft.categoryOption,
                      onSelect: (id) => update({ categoryOption: id, carModel: undefined }) })} /> : null}
                  {models.length ? <SelectField title="الموديل" value={label(models, draft.carModel)} onPress={() => choose({ title: "الموديل", options: models, value: draft.carModel,
                    onSelect: (id) => update({ carModel: id }) })} /> : null}
                </Card>
                <Card>
                  <SelectField title="المدينة" value={draft.city} onPress={() => choose({ title: "المدينة", options: cities.map((entry) => ({ id: entry, label: entry })), value: draft.city,
                    onSelect: (id) => update({ city: id }) })} />
                  <SelectField title="الحالة" value={label(conditions, draft.condition)} onPress={() => choose({ title: "الحالة", options: conditions, value: draft.condition,
                    onSelect: (id) => update({ condition: id }) })} />
                  <SelectField title="ترتيب النتائج" value={label(sorts, draft.sort) || "الأكثر صلة"} onPress={() => choose({ title: "ترتيب النتائج", options: sorts, value: draft.sort,
                    onSelect: (id) => update({ sort: id }) })} />
                </Card>
                <Card>
                  <AppText variant="label">السعر (ريال)</AppText>
                  <View style={s.range}>
                    <View style={{ flex: 1 }}><Field label="من" placeholder="أقل سعر" keyboardType="decimal-pad" value={draft.minPrice || ""} onChangeText={(value) => updateNumber("minPrice", value)} /></View>
                    <View style={{ flex: 1 }}><Field label="إلى" placeholder="أعلى سعر" keyboardType="decimal-pad" value={draft.maxPrice || ""} onChangeText={(value) => updateNumber("maxPrice", value)} /></View>
                  </View>
                </Card>
                {category?.id === "cars" ? <Card>
                  <AppText variant="label">تفاصيل السيارة</AppText>
                  <View style={s.range}>
                    <View style={{ flex: 1 }}><Field label="سنة الصنع من" placeholder="1900" keyboardType="number-pad" maxLength={4} value={draft.yearMin || ""} onChangeText={(value) => updateNumber("yearMin", value)} /></View>
                    <View style={{ flex: 1 }}><Field label="سنة الصنع إلى" placeholder="2099" keyboardType="number-pad" maxLength={4} value={draft.yearMax || ""} onChangeText={(value) => updateNumber("yearMax", value)} /></View>
                  </View>
                  <View style={s.range}>
                    <View style={{ flex: 1 }}><Field label="الممشى من (كم)" placeholder="0" keyboardType="number-pad" value={draft.mileageMin || ""} onChangeText={(value) => updateNumber("mileageMin", value)} /></View>
                    <View style={{ flex: 1 }}><Field label="الممشى إلى (كم)" placeholder="بدون حد" keyboardType="number-pad" value={draft.mileageMax || ""} onChangeText={(value) => updateNumber("mileageMax", value)} /></View>
                  </View>
                </Card> : null}
                {error ? <AppText color={colors.danger} accessibilityRole="alert">{error}</AppText> : null}
              </ScrollView>
              <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <Button title="عرض النتائج" onPress={apply} style={{ flex: 1 }} />
                <Button title="مسح الفلاتر" variant="ghost" onPress={() => { setDraft({}); setError(""); }} />
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </Screen>
  );
}

const s = StyleSheet.create({
  header: { padding: 20, flexDirection: "row", alignItems: "center", gap: 12 },
  close: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
  select: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 9 },
  choice: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 58, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  range: { flexDirection: "row", gap: 12 },
  footer: { flexDirection: "row", gap: 8, paddingTop: 14, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
