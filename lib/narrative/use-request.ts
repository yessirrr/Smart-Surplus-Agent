"use client";

import { useState, useCallback } from "react";

export function useRequest<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (body?: Record<string, unknown>) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw new Error(`Request error: ${res.status}`);
        const result = await res.json();
        if (result.error) throw new Error(result.error);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [endpoint]
  );

  return { data, loading, error, generate };
}

