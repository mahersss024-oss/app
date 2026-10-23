import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import type { UIMessage } from "ai";
import { getApiBaseUrl } from "../../core/api";

type History = {
  conversationId: string;
  messages: UIMessage[];
  creationMethod: boolean;
};
type Manifest = { chunks: number; updatedAt: number };
const indexKey = "hamad.history.index.v1";
const chunkSize = 500;
const maxChunks = 64;
let epoch = 0;
let operations: Promise<unknown> = Promise.resolve();
const options = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
async function keyFor(ownerId: string) {
  return `hamad.history.${await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${getApiBaseUrl()}:${ownerId}`)}`;
}
async function index() {
  try {
    const parsed: unknown = JSON.parse(
      (await SecureStore.getItemAsync(indexKey)) || "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter(
          (key): key is string =>
            typeof key === "string" &&
            /^hamad\.history\.[a-f0-9]{64}$/.test(key),
        )
      : [];
  } catch {
    return [];
  }
}
function textOnly(messages: UIMessage[]): UIMessage[] {
  let budget = 20_000;
  const safe: UIMessage[] = [];
  for (const message of [...messages].reverse()) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .slice(0, 12_000);
    if (!text || safe.length >= 48 || text.length > budget) continue;
    budget -= text.length;
    safe.unshift({
      id: message.id,
      role: message.role,
      parts: [{ type: "text", text }],
    });
  }
  return safe;
}

/** Text only, encrypted by the OS key store, bound to account AND API origin.
 * Photos, tool payloads and base64 attachments are never persisted. */
export async function readAssistantHistory(
  ownerId: string,
): Promise<History | null> {
  const started = epoch;
  try {
    const key = await keyFor(ownerId);
    const meta = JSON.parse(
      (await SecureStore.getItemAsync(key)) || "null",
    ) as Manifest | null;
    if (!meta || meta.chunks < 1 || meta.chunks > maxChunks) return null;
    if (Date.now() - meta.updatedAt > 30 * 86400_000) {
      await clearAssistantHistory(ownerId);
      return null;
    }
    const chunks = await Promise.all(
      Array.from({ length: meta.chunks }, (_, i) =>
        SecureStore.getItemAsync(`${key}.${i}`),
      ),
    );
    if (started !== epoch || chunks.some((chunk) => chunk == null)) return null;
    const saved = JSON.parse(chunks.join("")) as History;
    if (
      !/^[A-Za-z0-9_-]{16,80}$/.test(saved.conversationId) ||
      !Array.isArray(saved.messages)
    )
      return null;
    return {
      conversationId: saved.conversationId,
      messages: textOnly(saved.messages),
      creationMethod: saved.creationMethod === true,
    };
  } catch {
    return null;
  }
}

export function writeAssistantHistory(ownerId: string, state: History) {
  const started = epoch;
  const snapshot = {
    conversationId: state.conversationId,
    messages: textOnly(state.messages),
    creationMethod: state.creationMethod,
  };
  const run = async () => {
    if (started !== epoch) return;
    const key = await keyFor(ownerId);
    const value = JSON.stringify(snapshot);
    const chunks = Array.from(
      { length: Math.ceil(value.length / chunkSize) },
      (_, i) => value.slice(i * chunkSize, (i + 1) * chunkSize),
    );
    if (chunks.length > maxChunks) return;
    const keys = await index();
    if (!keys.includes(key))
      await SecureStore.setItemAsync(
        indexKey,
        JSON.stringify([...keys, key]),
        options,
      );
    for (let i = 0; i < chunks.length; i++) {
      if (started !== epoch) return;
      await SecureStore.setItemAsync(`${key}.${i}`, chunks[i], options);
    }
    if (started === epoch)
      await SecureStore.setItemAsync(
        key,
        JSON.stringify({ chunks: chunks.length, updatedAt: Date.now() }),
        options,
      );
  };
  operations = operations.catch(() => {}).then(run);
  return operations;
}

export async function clearAssistantHistory(ownerId: string) {
  epoch++;
  const clear = async () => {
    const key = await keyFor(ownerId);
    await Promise.all(
      Array.from({ length: maxChunks }, (_, i) =>
        SecureStore.deleteItemAsync(`${key}.${i}`),
      ),
    );
    await SecureStore.deleteItemAsync(key);
    await SecureStore.setItemAsync(
      indexKey,
      JSON.stringify((await index()).filter((item) => item !== key)),
      options,
    );
  };
  // Deletion and writes share one queue. A save begun while deletion awaits
  // the OS key store must not orphan chunks after its manifest/index is cleared.
  operations = operations.catch(() => {}).then(clear);
  await operations;
}

export async function clearAllAssistantHistory() {
  epoch++;
  const clear = async () => {
    for (const key of await index()) {
      await Promise.all(
        Array.from({ length: maxChunks }, (_, i) =>
          SecureStore.deleteItemAsync(`${key}.${i}`),
        ),
      );
      await SecureStore.deleteItemAsync(key);
    }
    await SecureStore.deleteItemAsync(indexKey);
  };
  operations = operations.catch(() => {}).then(clear);
  await operations;
}
