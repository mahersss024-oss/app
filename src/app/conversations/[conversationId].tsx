import { useLocalSearchParams } from "expo-router";
import { ConversationScreen } from "../../features/conversations/screens";
export default function ConversationRoute() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  return <ConversationScreen conversationId={conversationId || ""} />;
}
