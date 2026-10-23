import * as Location from "expo-location";
import coordinates from "./city-coordinates.json";

export function nearestMarketplaceCity(latitude: number, longitude: number): string {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    throw new Error("تعذّر تحديد الموقع. يمكنك اختيار المنطقة يدويًا.");
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const distance = (point: typeof coordinates[number]) => {
    const a = Math.sin(radians(point.latitude - latitude) / 2) ** 2
      + Math.cos(radians(latitude)) * Math.cos(radians(point.latitude))
      * Math.sin(radians(point.longitude - longitude) / 2) ** 2;
    return Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  };
  let nearest = coordinates[0];
  let shortest = Infinity;
  for (const point of coordinates) {
    const delta = distance(point);
    if (delta < shortest) { nearest = point; shortest = delta; }
  }
  return nearest.city;
}

export async function getNearbyMarketplaceCity(): Promise<string> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error("لم يُسمح بالوصول للموقع. يمكنك اختيار المنطقة يدويًا.");
  if (!(await Location.hasServicesEnabledAsync())) throw new Error("شغّل خدمة الموقع، أو اختر المنطقة يدويًا.");
  // Only city-level filtering leaves this function; coordinates are never sent
  // to the API or saved. A recent coarse fix avoids waiting indoors for GPS.
  const recent = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 5000 }).catch(() => null);
  if (recent) return nearestMarketplaceCity(recent.coords.latitude, recent.coords.longitude);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("استغرق تحديد الموقع وقتًا طويلًا. حاول مجددًا أو اختر المنطقة يدويًا.")), 15_000); }),
    ]);
    return nearestMarketplaceCity(position.coords.latitude, position.coords.longitude);
  } catch (error) {
    if (error instanceof Error && error.message.includes("اختر المنطقة")) throw error;
    throw new Error("تعذّر تحديد الموقع. حاول مجددًا أو اختر المنطقة يدويًا.");
  } finally {
    clearTimeout(timer);
  }
}
