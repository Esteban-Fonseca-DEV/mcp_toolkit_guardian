import { useEffect, useRef, useState, useCallback } from "react";

export interface UseSSEOptions {
  url: string;
  maxRetries?: number;
}

export interface UseSSEResult<T> {
  data: T | null;
  connected: boolean;
}

export function useSSE<T>(options: UseSSEOptions): UseSSEResult<T> {
  const { url, maxRetries = 5 } = options;
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const retriesRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      retriesRef.current = 0;
    };

    es.addEventListener("audit-update", (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as T;
        setData(parsed);
      } catch {
        // Ignore malformed messages
      }
    });

    es.onerror = () => {
      es.close();
      setConnected(false);

      if (retriesRef.current < maxRetries) {
        const delay = Math.pow(2, retriesRef.current) * 1000;
        retriesRef.current += 1;
        timeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };
  }, [url, maxRetries]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [connect]);

  return { data, connected };
}
