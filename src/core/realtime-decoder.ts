export type SseFrame = { event: string; id?: string; data: string };

/** Incremental UTF-8 + SSE framing, independent of browser EventSource. */
export class NativeSseDecoder {
  private decoder = new TextDecoder();
  private buffer = "";
  private maxFrameCharacters: number;
  constructor(maxFrameCharacters = 256_000) {
    this.maxFrameCharacters = maxFrameCharacters;
  }

  feed(bytes: Uint8Array): SseFrame[] {
    this.buffer = (
      this.buffer + this.decoder.decode(bytes, { stream: true })
    ).replace(/\r\n/g, "\n");
    const frames: SseFrame[] = [];
    let boundary: number;
    while ((boundary = this.buffer.indexOf("\n\n")) >= 0) {
      if (boundary > this.maxFrameCharacters)
        throw new Error("realtime_frame_too_large");
      const source = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const data: string[] = [];
      let event = "message";
      let id: string | undefined;
      for (const line of source.split("\n")) {
        if (!line || line.startsWith(":")) continue;
        const colon = line.indexOf(":");
        const field = colon < 0 ? line : line.slice(0, colon);
        const raw = colon < 0 ? "" : line.slice(colon + 1);
        const value = raw.startsWith(" ") ? raw.slice(1) : raw;
        if (field === "event") event = value;
        else if (field === "data") data.push(value);
        else if (field === "id" && !value.includes("\0")) id = value;
      }
      if (data.length)
        frames.push({
          event,
          ...(id !== undefined ? { id } : {}),
          data: data.join("\n"),
        });
    }
    if (this.buffer.length > this.maxFrameCharacters)
      throw new Error("realtime_frame_too_large");
    return frames;
  }
}
