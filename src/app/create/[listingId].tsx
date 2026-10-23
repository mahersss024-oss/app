import { useLocalSearchParams } from "expo-router";
import { ListingEditorScreen } from "../../features/listing-editor/screen";
export default function EditListingRoute() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  return <ListingEditorScreen listingId={listingId} />;
}
