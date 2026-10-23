import { useLocalSearchParams } from "expo-router";
import { PolicyScreen } from "../../features/account/screens";
export default function PolicyRoute() {
  const { policyId } = useLocalSearchParams<{ policyId: string }>();
  return <PolicyScreen policyId={policyId || ""} />;
}
