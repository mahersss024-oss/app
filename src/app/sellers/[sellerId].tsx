import { useLocalSearchParams } from "expo-router";
import { SellerScreen } from "../../features/seller/screens";
export default function SellerRoute() {
  const { sellerId } = useLocalSearchParams<{ sellerId: string }>();
  return <SellerScreen sellerId={sellerId || ""} />;
}
