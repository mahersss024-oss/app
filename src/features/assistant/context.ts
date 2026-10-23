import type { UIMessage } from "ai";

export function selectAssistantContext(messages: UIMessage[]) {
  const result: UIMessage[] = [];
  let count = 0;
  const latest = messages.findLast((message) => message.role === "user");
  for (const message of [...messages].reverse()) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    const parts: UIMessage["parts"] = message.parts.filter(
      (part) =>
        part.type === "text" ||
        (message.id === latest?.id && part.type === "file"),
    );
    if (
      message.id !== latest?.id &&
      message.parts.some((part) => part.type === "file")
    )
      parts.push({
        type: "text",
        text: `Earlier image attachment reference: ${message.id}`,
      });
    const size = parts.reduce(
      (sum, part) => sum + (part.type === "text" ? part.text.length : 0),
      0,
    );
    if (result.length >= 40 || (result.length && count + size > 24_000)) break;
    count += size;
    result.unshift({ ...message, parts });
  }
  while (result.length && result[0].role !== "user") result.shift();
  return result;
}
