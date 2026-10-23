import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, PanResponder, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Point = { x: number; y: number };
const key = "hamad-bubble-position-v1";
async function remember(point: Point) {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(key, JSON.stringify(point));
    else await SecureStore.setItemAsync(key, JSON.stringify(point));
  } catch { /* An optional layout preference must not prevent opening Hamad. */ }
}
export function HamadBubble({ visible }: { visible: boolean }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [point, setPoint] = useState<Point | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const current = useRef<Point>({ x: 0, y: 0 });
  const start = useRef<Point>({ x: 0, y: 0 });
  const minY = insets.top + 62;
  const maxX = Math.max(14, width - 78);
  const maxY = Math.max(minY, height - Math.max(insets.bottom, 8) - 156);
  useEffect(() => {
    let active = true;
    const clamp = (p: Point) => ({ x: Math.max(14, Math.min(maxX, p.x)), y: Math.max(minY, Math.min(maxY, p.y)) });
    void (async () => {
      let next: Point = { x: maxX, y: maxY };
      try {
        const raw = Platform.OS === "web" ? globalThis.localStorage?.getItem(key) : await SecureStore.getItemAsync(key);
        const stored = raw ? JSON.parse(raw) : null;
        if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) next = clamp(stored);
      } catch { /* Use the default position if storage is unavailable. */ }
      if (active) { current.current = next; setPoint(next); }
    })();
    return () => { active = false; };
  }, [maxX, maxY, minY]);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  // PanResponder invokes these callbacks on a gesture, after render.
  // eslint-disable-next-line react-hooks/refs
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.hypot(gesture.dx, gesture.dy) > 8,
    onPanResponderGrant: () => { start.current = current.current; },
    onPanResponderMove: (_, gesture) => {
      const next = { x: Math.max(14, Math.min(maxX, start.current.x + gesture.dx)), y: Math.max(minY, Math.min(maxY, start.current.y + gesture.dy)) };
      current.current = next;
      setPoint(next);
    },
    onPanResponderRelease: (_, gesture) => {
      if (Math.hypot(gesture.dx, gesture.dy) < 8) router.push("/create/assistant");
      else void remember(current.current);
    },
    onPanResponderTerminate: () => { void remember(current.current); },
  }), [maxX, maxY, minY]);
  if (!visible || keyboard || !point) return null;
  return <View
    accessible accessibilityRole="button" accessibilityLabel="فتح حمد"
    accessibilityHint="مساعد سوق حمد. يمكنك سحب الأيقونة لتغيير مكانها."
    onAccessibilityTap={() => router.push("/create/assistant")}
    {...responder.panHandlers}
    style={[s.bubble, { left: point.x, top: point.y }]}
  ><Image source={require("../../../assets/hamad-assistant-bubble.webp")} contentFit="contain" style={s.image} /></View>;
}
const s = StyleSheet.create({
  bubble: { position: "absolute", width: 64, height: 64, zIndex: 30, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(21,184,166,.13)", borderWidth: 1, borderColor: "#99E9DD", boxShadow: "0 5px 18px rgba(14,116,110,.18)", direction: "ltr" },
  image: { width: 46, height: 46, borderRadius: 15 },
});
