import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export type UploadAsset = {
  uri: string;
  name: string;
  type: string;
  mimeType: string;
  width: number;
  height: number;
  dataUrl?: string;
};

/** Decode on device and export JPEG, including camera HEIC assets. The server
 * still performs authoritative byte, decoder, image count and ownership checks. */
export async function pickListingImages(
  source: "camera" | "library",
  limit = 8,
  includeBase64 = false,
): Promise<UploadAsset[]> {
  if (limit < 1)
    throw new Error("وصلت إلى الحد الأقصى للصور. احذف صورة قبل إضافة أخرى.");
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      throw new Error("اسمح بالوصول للكاميرا من إعدادات الجهاز لالتقاط صورة.");
  }
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 1,
          allowsEditing: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 1,
          allowsEditing: false,
          allowsMultipleSelection: true,
          selectionLimit: Math.min(8, limit),
        });
  if (result.canceled) return [];
  const output: UploadAsset[] = [];
  // Sequential decoding avoids allocating several high resolution bitmaps at once.
  for (const [index, asset] of result.assets.slice(0, limit).entries()) {
    if (
      !asset.width ||
      !asset.height ||
      asset.width * asset.height > 45_000_000
    ) {
      throw new Error(
        "إحدى الصور كبيرة جدًا أو لا يمكن قراءتها. اختر صورة لا تتجاوز 45 مليون بكسل.",
      );
    }
    const context = ImageManipulator.manipulate(asset.uri);
    const largest = Math.max(asset.width, asset.height);
    if (largest > 1800)
      context.resize(
        asset.width >= asset.height ? { width: 1800 } : { height: 1800 },
      );
    try {
      const image = await context.renderAsync();
      try {
        const saved = await image.saveAsync({
          format: SaveFormat.JPEG,
          compress: 0.88,
          base64: includeBase64,
        });
        if (
          saved.base64 &&
          Math.ceil((saved.base64.length * 3) / 4) > 12 * 1024 * 1024
        )
          throw new Error("حجم الصورة يتجاوز 12 ميجابايت.");
        output.push({
          uri: saved.uri,
          name: `souq-hamad-${Date.now()}-${index}.jpg`,
          type: "image/jpeg",
          mimeType: "image/jpeg",
          width: saved.width,
          height: saved.height,
          ...(saved.base64
            ? { dataUrl: `data:image/jpeg;base64,${saved.base64}` }
            : {}),
        });
      } finally {
        image.release();
      }
    } finally {
      context.release();
    }
  }
  return output;
}
