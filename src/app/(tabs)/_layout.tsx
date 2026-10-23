import { Tabs, usePathname } from "expo-router";
import { View } from "react-native";
import { BottomNavigation } from "../../features/navigation/bottom-navigation";
import { HamadBubble } from "../../features/navigation/hamad-bubble";
import { colors } from "../../ui/theme";
export default function TabLayout() {
  const pathname = usePathname();
  return <View style={{ flex: 1, direction: "ltr", backgroundColor: colors.background }}>
    <Tabs tabBar={props => <BottomNavigation {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}>
      <Tabs.Screen name="listings" options={{ title: "إعلاناتي" }} />
      <Tabs.Screen name="messages" options={{ title: "محادثاتي" }} />
      <Tabs.Screen name="index" options={{ title: "الرئيسية" }} />
      <Tabs.Screen name="favorites" options={{ title: "المفضلة" }} />
      <Tabs.Screen name="account" options={{ title: "حسابي" }} />
    </Tabs>
    <HamadBubble visible={pathname === "/"} />
  </View>;
}
