import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { fetch as streamFetch } from "expo/fetch";
import { useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl, getSessionToken } from "./api";
import { NativeSseDecoder } from "./realtime-decoder";

export type RealtimeEvent = {
  id: number;
  type: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};
export type RealtimeState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "paused";

/** Native SSE transport. Events invalidate authoritative API reads; payloads are
 * never treated as complete marketplace records or authorization decisions. */
export function useRealtime(
  userId?: string | null,
  onEvent?: (event: RealtimeEvent) => void,
) {
  const client = useQueryClient();
  const callback = useRef(onEvent);
  useEffect(() => {
    callback.current = onEvent;
  }, [onEvent]);
  const [state, setState] = useState<RealtimeState>("connecting");
  useEffect(() => {
    let disposed = false;
    let active = AppState.currentState === "active";
    let controller: AbortController | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let lastId: number | null = null;
    let connecting = false;
    const resync = () => {
      void client.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== "bootstrap",
      });
    };
    const connect = async () => {
      if (disposed || !active || connecting) return;
      connecting = true;
      controller = new AbortController();
      const currentController = controller;
      setState(attempt ? "reconnecting" : "connecting");
      try {
        const token = await getSessionToken();
        if (disposed || !active) return;
        const headers: Record<string, string> = { Accept: "text/event-stream" };
        if (token) headers.Authorization = `Bearer ${token}`;
        if (lastId !== null) headers["Last-Event-ID"] = String(lastId);
        const response = await streamFetch(
          `${getApiBaseUrl()}/api/realtime/stream`,
          { headers, signal: currentController.signal },
        );
        if (!response.ok || !response.body)
          throw new Error(`realtime_${response.status}`);
        setState("connected");
        attempt = 0;
        // The current server has process-local cursors. Always reconcile on
        // reconnect so a restart or a different replica cannot hide updates.
        resync();
        const reader = response.body.getReader();
        const decoder = new NativeSseDecoder();
        try {
          while (!disposed && active) {
            const next = await reader.read();
            if (next.done) break;
            if (disposed || !active) break;
            for (const frame of decoder.feed(next.value)) {
              if (frame.event !== "smartstore") continue;
              try {
                const event = JSON.parse(frame.data) as RealtimeEvent;
                if (
                  !Number.isSafeInteger(event.id) ||
                  typeof event.type !== "string"
                )
                  continue;
                lastId = event.id;
                callback.current?.(event);
                resync();
              } catch {
                /* A malformed event must not terminate the connection. */
              }
            }
          }
        } finally {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
      } catch {
        if (!disposed && active) {
          setState("reconnecting");
          resync();
        }
      } finally {
        connecting = false;
        if (!disposed && active) {
          const delay =
            Math.min(30_000, 2000 * 2 ** Math.min(attempt++, 4)) +
            Math.random() * 750;
          retry = setTimeout(() => void connect(), delay);
        }
      }
    };
    const subscription = AppState.addEventListener("change", (next) => {
      active = next === "active";
      if (retry) clearTimeout(retry);
      if (!active) {
        setState("paused");
        controller?.abort();
      } else {
        lastId = null;
        resync();
        void connect();
      }
    });
    void connect();
    // Polling remains a reconciliation safety net, including with a connected
    // process-local SSE server behind a load balancer.
    const fallback = setInterval(() => {
      if (active) resync();
    }, 30_000);
    return () => {
      disposed = true;
      controller?.abort();
      if (retry) clearTimeout(retry);
      clearInterval(fallback);
      subscription.remove();
    };
  }, [client, userId]);
  return state;
}
