import { useEffect, useState, type ComponentProps } from "react";
import { Animated, Keyboard, Pressable, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../core/api";
import { useAuth } from "../../core/auth";
import type { Conversation } from "../../core/types";
import { AppText, Icon, colors, type IconName } from "../../ui";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];
const destinations: { name: string; label: string; icon: IconName }[] = [
  { name: "listings", label: "إعلاناتي", icon: "add-circle-outline" },
  { name: "messages", label: "محادثاتي", icon: "chatbubble-outline" },
  { name: "index", label: "الرئيسية", icon: "home-outline" },
  { name: "favorites", label: "المفضلة", icon: "heart-outline" },
  { name: "account", label: "حسابي", icon: "person-outline" },
];
export function BottomNavigation({ state, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [keyboard, setKeyboard] = useState(false);
  const [width, setWidth] = useState(0);
  const [indicator] = useState(() => new Animated.Value(0));
  const activeName = state.routes[state.index]?.name;
  const activeIndex = destinations.findIndex(item => item.name === activeName);
  const alerts = useQuery({
    queryKey: ["account", user?.id, "conversations", "alert"],
    queryFn: ({ signal }) => api.get<{ conversations: Conversation[] }>("/api/marketplace/me/conversations", { page: 1, limit: 48 }, { signal }),
    enabled: !!user, staleTime: 60_000, refetchInterval: 60_000,
  });
  const unread = !!user && alerts.data?.conversations.some(conversation => conversation.messages.some(message => {
    const readBy = message.metadata?.readBy;
    return message.status === "sent" && message.senderId !== user.id && !(readBy && typeof readBy === "object" && (readBy as Record<string, unknown>)[user.id]);
  }));
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    Animated.timing(indicator, { toValue: Math.max(0, 4 - activeIndex) * width / 5, duration: 220, useNativeDriver: true }).start();
  }, [activeIndex, indicator, width]);
  if (keyboard) return null;
  return <View style={[s.reserve, { height: 76 + Math.max(insets.bottom, 8) }]}>
    <View style={[s.bar, { bottom: Math.max(insets.bottom, 8) }]}>
      <View style={s.track} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && <Animated.View pointerEvents="none" style={[s.indicatorSlot, { width: width / 5, transform: [{ translateX: indicator }] }]}><View style={s.indicator} /></Animated.View>}
        {destinations.map(item => {
          const route = state.routes.find(entry => entry.name === item.name);
          if (!route) return null;
          const selected = activeName === item.name;
          const home = item.name === "index";
          return <Pressable key={item.name} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected }}
            onPress={() => {
              const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!selected && !event.defaultPrevented) navigateToTab(route.key);
            }}
            onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
            style={s.item}>
            <View style={[s.icon, home && s.home, selected && s.active, selected && home && s.homeRing]}>
              <Icon name={item.icon} size={home ? 22 : 19} color={selected ? "#FFFFFF" : "#475569"} />
              {item.name === "messages" && unread && !selected && <View style={s.badge} />}
            </View>
            <AppText numberOfLines={1} style={s.label} color={selected ? colors.primary : "#64748B"}>{item.label}</AppText>
          </Pressable>;
        })}
      </View>
    </View>
  </View>;
}
const s = StyleSheet.create({
  reserve: { backgroundColor: "#FFFFFF", direction: "ltr" },
  bar: { position: "absolute", left: 12, right: 12, maxWidth: 448, alignSelf: "center", marginHorizontal: "auto", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 40, paddingHorizontal: 12, paddingVertical: 6, boxShadow: "0 5px 24px rgba(15,23,42,.12)" },
  track: { height: 56, flexDirection: "row-reverse", direction: "ltr" },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 1 },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  home: { width: 40, height: 40, borderRadius: 20, marginTop: -6 },
  active: { backgroundColor: colors.primary },
  homeRing: { borderWidth: 3, borderColor: "#DBEAFE" },
  label: { fontSize: 10, lineHeight: 17 },
  indicatorSlot: { position: "absolute", left: 0, top: -6, alignItems: "center" },
  indicator: { width: 24, height: 2, backgroundColor: colors.primary, borderRadius: 2 },
  badge: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#EC4899", position: "absolute", top: 0, right: 0, borderWidth: 1, borderColor: "#FFFFFF" },
});
