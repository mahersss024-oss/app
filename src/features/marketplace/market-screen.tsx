import { useCallback, useEffect, useRef, useState, type ElementRef } from "react";
import {
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "../../core/api";
import { useAuth } from "../../core/auth";
import { useBootstrap } from "../../core/bootstrap";
import { getNearbyMarketplaceCity } from "../../core/location";
import type { Listing, Pagination } from "../../core/types";
import {
  AppText,
  Button,
  EmptyState,
  Icon,
  ListingCard,
  LoadingState,
  Screen,
  colors,
  fonts,
} from "../../ui";
import { MarketFilterSheet, type MarketFilters } from "./filter-sheet";

type Choice = { id: string; label: string };
type FilterRow = {
  level: "groups" | "categories" | "options" | "models";
  label: string;
  value: string;
  choices: Choice[];
  select: (value: string) => void;
};

function CategoryRow({ row }: { row: FilterRow }) {
  const scroll = useRef<ElementRef<typeof ScrollView>>(null);
  const positions = useRef(new Map<string, { x: number; width: number }>());
  const width = useRef(0);
  const offset = useRef(0);
  const revealSelection = useCallback(() => {
    const selected = positions.current.get(row.value);
    if (!selected || !width.current) return;
    const next = selected.x < offset.current
      ? selected.x
      : selected.x + selected.width > offset.current + width.current
        ? selected.x + selected.width - width.current
        : offset.current;
    if (next !== offset.current) scroll.current?.scrollTo({ x: Math.max(0, next), animated: true });
  }, [row.value]);
  useEffect(() => { revealSelection(); }, [revealSelection]);
  return <ScrollView
    ref={scroll}
    horizontal
    accessibilityLabel={row.label}
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={s.categoryTrack}
    style={row.level === "groups" ? s.groupRow : s.compactRow}
    onLayout={event => { width.current = event.nativeEvent.layout.width; revealSelection(); }}
    onScroll={event => { offset.current = event.nativeEvent.contentOffset.x; }}
    scrollEventThrottle={32}
  >
    {row.choices.map(choice => {
      const active = row.value === choice.id;
      return <Pressable
        key={choice.id}
        accessibilityRole="button"
        accessibilityLabel={choice.label}
        accessibilityState={{ selected: active }}
        onLayout={event => { positions.current.set(choice.id, event.nativeEvent.layout); if (active) revealSelection(); }}
        onPress={() => row.select(choice.id)}
        style={[s.categoryChip, row.level !== "groups" && s.compactChip, active && s.activeChip]}
      ><AppText numberOfLines={1} style={[s.categoryLabel, row.level !== "groups" && s.compactLabel, active && s.activeLabel]}>{choice.label}</AppText></Pressable>;
    })}
  </ScrollView>;
}

export default function MarketScreen() {
  const bootstrap = useBootstrap();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<MarketFilters>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [locating, setLocating] = useState(false);
  const [rowStart, setRowStart] = useState(0);
  const categories = bootstrap.data?.categories ?? [];
  const cities = bootstrap.data?.cities ?? [];
  const groups = [...new Set(categories.map(category => category.group))];
  const selectedCategory = categories.find(category => category.id === filters.category);
  const selectedGroup = selectedCategory?.group || filters.group;
  const groupCategories = categories.filter(category => category.group === selectedGroup);
  const options = selectedCategory?.options ?? [];
  const models = selectedCategory?.id === "cars" && filters.categoryOption
    ? selectedCategory.carModels?.[filters.categoryOption] ?? []
    : [];
  const activeCount = Object.entries(filters).filter(([key, value]) => key !== "group" && Boolean(value)).length;

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);
  const listings = useInfiniteQuery({
    queryKey: ["marketplace", query, filters],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      // Group labels are presentation only. The server receives stable IDs.
      const apiFilters = { ...filters };
      delete apiFilters.group;
      return api.get<{ listings: Listing[]; pagination: Pagination }>(
        "/api/marketplace/listings",
        { q: query, ...apiFilters, page: pageParam, limit: 24 },
        { signal },
      );
    },
    getNextPageParam: page => page.pagination.nextPage ?? undefined,
  });
  const items = listings.data?.pages.flatMap(page => page.listings) ?? [];
  const resetCategories = (group?: string) => {
    setFilters(current => ({ ...current, group,
      categories: group ? categories.filter(category => category.group === group).map(category => category.id).join(",") : undefined,
      category: undefined, categoryOption: undefined, carModel: undefined,
      yearMin: undefined, yearMax: undefined, mileageMin: undefined, mileageMax: undefined,
    }));
    setRowStart(0);
  };
  const selectRow = (index: number, action: () => void) => {
    action();
    setRowStart(current => index === current && current > 0 ? current - 1 : index === current + 1 ? Math.min(2, current + 1) : 0);
  };
  const rows: FilterRow[] = [{
    level: "groups", label: "تصنيفات السوق", value: selectedGroup || "all",
    choices: [{ id: "all", label: "الكل" }, ...groups.map(group => ({ id: group, label: group }))],
    select: value => selectRow(0, () => resetCategories(value === "all" ? undefined : value)),
  }];
  if (selectedGroup && groupCategories.length) rows.push({
    level: "categories", label: "التصنيفات الفرعية", value: filters.category || "all",
    choices: [{ id: "all", label: "الكل" }, ...groupCategories],
    select: value => selectRow(1, () => setFilters(current => ({ ...current,
      group: selectedGroup,
      categories: value === "all" ? groupCategories.map(category => category.id).join(",") : undefined,
      category: value === "all" ? undefined : value,
      categoryOption: undefined, carModel: undefined,
      yearMin: value === "cars" ? current.yearMin : undefined,
      yearMax: value === "cars" ? current.yearMax : undefined,
      mileageMin: value === "cars" ? current.mileageMin : undefined,
      mileageMax: value === "cars" ? current.mileageMax : undefined,
    }))),
  });
  if (options.length) rows.push({
    level: "options", label: "تفريعات التصنيف", value: filters.categoryOption || "all",
    choices: [{ id: "all", label: "الكل" }, ...options],
    select: value => selectRow(2, () => setFilters(current => ({ ...current, categoryOption: value === "all" ? undefined : value, carModel: undefined }))),
  });
  if (models.length) rows.push({
    level: "models", label: "تفريعات الخيار", value: filters.carModel || "all",
    choices: [{ id: "all", label: "الكل" }, ...models],
    select: value => selectRow(3, () => setFilters(current => ({ ...current, carModel: value === "all" ? undefined : value }))),
  });
  const windowStart = Math.max(0, Math.min(rowStart, rows.length - 2));
  const openCity = () => { setCitySearch(""); setCityOpen(true); };
  const findNearby = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const city = await getNearbyMarketplaceCity();
      setFilters(current => ({ ...current, city }));
    } catch (error) {
      Alert.alert("موقعي", error instanceof Error ? error.message : "تعذر تحديد منطقتك. يمكنك اختيارها يدويًا.");
    } finally { setLocating(false); }
  };

  return <Screen>
    <View style={s.topbar}>
      <Image source={require("../../../assets/hamad-market-logo.webp")} contentFit="contain" style={s.brandLogo} accessibilityLabel="سوق حمد" />
      <View style={s.headerActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="الإشعارات" onPress={() => router.push("/notifications")} style={s.headerButton}><Icon name="notifications-outline" size={19} color={colors.text} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={user ? "حسابي" : "تسجيل الدخول"} onPress={() => router.push(user ? "/account" : "/auth")} style={s.headerButton}><Icon name="person-outline" size={19} color={colors.text} /></Pressable>
      </View>
    </View>
    <View style={s.marketPanel}>
      {bootstrap.data?.siteMessage ? <View style={s.siteMessage}><Icon name="information-circle-outline" size={17} color={colors.primary} /><AppText variant="caption" style={s.grow}>{bootstrap.data.siteMessage.message}</AppText></View> : null}
      <View style={s.toolbar} accessibilityLabel="أدوات السوق">
        <View style={s.creationActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="أنشئ إعلانك مع حمد" onPress={() => router.push("/create/assistant")} style={[s.createAction, s.hamadAction]}><Icon name="megaphone-outline" size={16} color="#FFFFFF" /><AppText style={[s.createLabel, { color: "#FFFFFF" }]}>أنشئ إعلانك مع حمد</AppText></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="أنشئ إعلانك يدويًا" onPress={() => router.push("/create/manual")} style={s.createAction}><Icon name="megaphone-outline" size={16} color={colors.text} /><AppText style={s.createLabel}>أنشئ إعلانك يدويًا</AppText></Pressable>
        </View>
        <View style={s.searchRow}>
          <View style={s.search}>
            <Icon name="search-outline" size={17} color={colors.primary} />
            <TextInput accessibilityLabel="البحث في السوق" value={search} onChangeText={setSearch} returnKeyType="search" placeholder="ابحث في كل السوق" placeholderTextColor={colors.muted} style={s.searchInput} />
            {search ? <Pressable accessibilityRole="button" accessibilityLabel="مسح البحث" hitSlop={6} onPress={() => { setSearch(""); setQuery(""); }}><Icon name="close" size={17} color={colors.muted} /></Pressable> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="تصفية النتائج" accessibilityState={{ expanded: filterOpen }} onPress={() => setFilterOpen(true)} style={[s.filterButton, activeCount > 0 && s.filterActive]}><Icon name="options-outline" size={18} color={activeCount ? "#FFFFFF" : colors.primary} />{activeCount ? <View style={s.filterBadge}><AppText style={s.filterBadgeText}>{activeCount}</AppText></View> : null}</Pressable>
        </View>
        <View style={s.regionRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="المنطقة" onPress={openCity} style={s.cityButton}><Icon name="location-outline" size={16} color={colors.primary} /><AppText numberOfLines={1} style={s.cityLabel}>{filters.city || "المنطقة"}</AppText><Icon name="chevron-down" size={14} color={colors.muted} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="موقعي" accessibilityHint="يحتاج إذن الموقع لتحديد أقرب منطقة" accessibilityState={{ disabled: locating, busy: locating }} disabled={locating} onPress={() => void findNearby()} style={[s.filterButton, locating && { opacity: 0.6 }]}>{locating ? <ActivityIndicator color={colors.primary} size="small" /> : <Icon name="locate-outline" size={18} color={colors.primary} />}</Pressable>
        </View>
        {activeCount > 0 && <Pressable accessibilityRole="button" accessibilityLabel="مسح الفلاتر" onPress={() => { setFilters({}); setRowStart(0); }} style={s.clearFilters}><Icon name="close" size={13} color={colors.primary} /><AppText style={s.clearLabel}>مسح الفلاتر</AppText></Pressable>}
        <View style={s.categoryWindow} accessibilityLabel="اختيار التصنيف">
          {rows.slice(windowStart, windowStart + 2).map(row => <CategoryRow key={`${row.level}:${selectedGroup}:${filters.category}:${filters.categoryOption}`} row={row} />)}
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => <ListingCard listing={item} />}
        ItemSeparatorComponent={() => <View style={s.cardSeparator} />}
        ListHeaderComponent={query ? <View style={s.resultsTitle}><Icon name="sparkles-outline" color={colors.primary} size={16} /><AppText style={s.resultsLabel}>نتائج البحث</AppText></View> : undefined}
        refreshing={listings.isRefetching && !listings.isFetchingNextPage}
        onRefresh={() => { void listings.refetch(); void bootstrap.refetch(); }}
        onEndReached={() => { if (listings.hasNextPage && !listings.isFetching) void listings.fetchNextPage(); }}
        onEndReachedThreshold={0.5}
        keyboardDismissMode="on-drag"
        ListFooterComponent={listings.isFetchingNextPage ? <LoadingState /> : listings.hasNextPage ? <Button title="تحميل المزيد" variant="ghost" onPress={() => void listings.fetchNextPage()} /> : <View style={s.listEnd} />}
        ListEmptyComponent={listings.isPending ? <LoadingState /> : listings.isError ? <EmptyState icon="cloud-offline-outline" title="تعذّر تحميل السوق" message={listings.error.message} action={<Button title="إعادة المحاولة" onPress={() => void listings.refetch()} />} /> : <EmptyState icon="search-outline" title="لا توجد إعلانات متاحة" message={activeCount || query ? "جرّب كلمة أخرى أو وسّع خيارات البحث." : undefined} action={activeCount || query ? <Button title="عرض جميع الإعلانات" variant="secondary" onPress={() => { setSearch(""); setFilters({}); setRowStart(0); }} /> : undefined} />}
      />
    </View>
    <MarketFilterSheet visible={filterOpen} filters={filters} categories={categories} cities={cities} onApply={next => { setFilters(next); setRowStart(next.carModel || next.categoryOption ? 2 : next.category ? 1 : 0); setFilterOpen(false); }} onClose={() => setFilterOpen(false)} />
    <Modal visible={cityOpen} transparent animationType="fade" onRequestClose={() => setCityOpen(false)}>
      <View style={s.cityOverlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="إغلاق اختيار المنطقة" style={StyleSheet.absoluteFill} onPress={() => setCityOpen(false)} />
        <View style={s.citySheet}>
          <View style={s.citySheetHeader}><AppText variant="heading" style={s.cityTitle}>اختيار المنطقة</AppText><Pressable accessibilityRole="button" accessibilityLabel="إغلاق اختيار المنطقة" hitSlop={10} onPress={() => setCityOpen(false)}><Icon name="close" size={21} /></Pressable></View>
          <View style={s.citySearch}><Icon name="search-outline" size={17} color={colors.muted} /><TextInput accessibilityLabel="البحث عن منطقة" placeholder="ابحث عن منطقة" value={citySearch} onChangeText={setCitySearch} style={s.citySearchInput} placeholderTextColor={colors.muted} /></View>
          <FlatList data={["كل المناطق", ...cities.filter(city => city.includes(citySearch.trim()))]} keyExtractor={city => city} keyboardShouldPersistTaps="handled" renderItem={({ item: city }) => {
            const value = city === "كل المناطق" ? undefined : city;
            const active = filters.city === value;
            return <Pressable accessibilityRole="button" accessibilityLabel={city} accessibilityState={{ selected: active }} onPress={() => { setFilters(current => ({ ...current, city: value })); setCityOpen(false); }} style={s.cityChoice}><AppText color={active ? colors.primary : colors.text}>{city}</AppText>{active && <Icon name="checkmark" color={colors.primary} size={18} />}</Pressable>;
          }} />
        </View>
      </View>
    </Modal>
  </Screen>;
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  topbar: { height: 56, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, backgroundColor: "#F7F9FC", borderBottomWidth: 1, borderColor: colors.border },
  brandLogo: { width: 48, height: 48, borderRadius: 6, backgroundColor: "#FFFFFF" },
  headerActions: { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
  headerButton: { width: 34, height: 34, borderRadius: 6, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF" },
  marketPanel: { flex: 1, marginHorizontal: 6, marginTop: 8, borderWidth: 1, borderColor: "#B7CBD9", borderRadius: 6, backgroundColor: "#FBFDFF", overflow: "hidden" },
  toolbar: { marginHorizontal: 8, marginTop: 8, borderWidth: 1, borderColor: "#DBEAFE", borderRadius: 6, backgroundColor: "#FFFFFF", padding: 4, gap: 4 },
  creationActions: { flexDirection: "row-reverse", gap: 6 },
  createAction: { flex: 1, minHeight: 36, borderRadius: 6, borderWidth: 1, borderColor: "#DCE4EF", backgroundColor: "#FFFFFF", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", paddingHorizontal: 5, paddingVertical: 4, gap: 4 },
  hamadAction: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  createLabel: { fontSize: 12, lineHeight: 20, fontFamily: fonts.bold, color: colors.text, flexShrink: 1 },
  searchRow: { flexDirection: "row-reverse", gap: 4 },
  search: { flex: 1, minWidth: 0, height: 36, borderWidth: 1, borderColor: colors.border, borderRadius: 6, backgroundColor: "#F7F9FC", paddingHorizontal: 8, flexDirection: "row-reverse", gap: 5, alignItems: "center" },
  searchInput: { flex: 1, minWidth: 0, height: 36, fontFamily: fonts.regular, fontSize: 14, color: colors.text, textAlign: "right", writingDirection: "rtl", paddingVertical: 0 },
  filterButton: { width: 36, height: 36, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  filterActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  filterBadge: { position: "absolute", top: -3, left: -3, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" },
  filterBadgeText: { color: "#1D4ED8", fontSize: 10, lineHeight: 14, fontFamily: fonts.bold },
  regionRow: { flexDirection: "row-reverse", gap: 4 },
  cityButton: { flex: 1, height: 36, borderRadius: 6, borderWidth: 1, borderColor: colors.border, flexDirection: "row-reverse", gap: 5, alignItems: "center", paddingHorizontal: 8 },
  cityLabel: { flex: 1, fontSize: 12, lineHeight: 20 },
  clearFilters: { flexDirection: "row-reverse", alignItems: "center", alignSelf: "flex-end", gap: 3, paddingVertical: 3, paddingHorizontal: 5 },
  clearLabel: { color: colors.primary, fontSize: 11, lineHeight: 18 },
  categoryWindow: { gap: 4, paddingVertical: 4 },
  groupRow: { height: 32, flexGrow: 0 },
  compactRow: { height: 28, flexGrow: 0 },
  categoryTrack: { flexDirection: "row-reverse", gap: 6, paddingHorizontal: 1 },
  categoryChip: { height: 32, borderRadius: 18, paddingHorizontal: 12, borderWidth: 1, borderColor: "#DEE6F0", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  compactChip: { height: 28, paddingHorizontal: 10 },
  categoryLabel: { fontSize: 12, lineHeight: 18, color: "#27364A" },
  compactLabel: { fontSize: 11, lineHeight: 17 },
  activeChip: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  activeLabel: { color: "#FFFFFF", fontFamily: fonts.bold },
  list: { paddingHorizontal: 8, paddingTop: 12, paddingBottom: 96, flexGrow: 1 },
  cardSeparator: { height: 6 },
  listEnd: { height: 12 },
  resultsTitle: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingBottom: 10 },
  resultsLabel: { fontFamily: fonts.bold, fontSize: 16 },
  siteMessage: { margin: 8, marginBottom: 0, padding: 8, flexDirection: "row-reverse", gap: 6, borderRadius: 6, backgroundColor: colors.primarySoft },
  cityOverlay: { flex: 1, backgroundColor: "#102A4766", justifyContent: "center", padding: 28, direction: "ltr" },
  citySheet: { maxHeight: "75%", minHeight: 250, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF", padding: 14, gap: 12 },
  citySheetHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 12 },
  cityTitle: { fontSize: 16 },
  citySearch: { height: 40, flexDirection: "row-reverse", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10 },
  citySearchInput: { flex: 1, height: 38, textAlign: "right", writingDirection: "rtl", fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  cityChoice: { minHeight: 42, paddingVertical: 9, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
