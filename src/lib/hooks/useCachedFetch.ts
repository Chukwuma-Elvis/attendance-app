"use client";

import { useEffect, useState, useRef, useCallback } from "react";

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes default

export function useCachedFetch<T>(
  fetcher: () => Promise<T>,
  dependencies: unknown[] = [],
  ttlMs = CACHE_TTL
): { data: T | null; loading: boolean; error: Error | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const cacheKey = JSON.stringify(dependencies);
    const cached = cacheRef.current.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < ttlMs) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      if (!abortControllerRef.current?.signal.aborted) {
        setData(result);
        cacheRef.current.set(cacheKey, { data: result, timestamp: Date.now() });
      }
    } catch (err) {
      if (!abortControllerRef.current?.signal.aborted) {
        setError(err instanceof Error ? err : new Error("Fetch failed"));
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, dependencies);

  useEffect(() => {
    fetchData();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchData]);

  const refetch = useCallback(() => {
    const cacheKey = JSON.stringify(dependencies);
    cacheRef.current.delete(cacheKey);
    fetchData();
  }, [dependencies, fetchData]);

  return { data, loading, error, refetch };
}

export function useLocalStorageState<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`Failed to set localStorage value for ${key}:`, error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}