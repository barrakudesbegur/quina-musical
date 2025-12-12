import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ResourceItem<T> = {
  id: T;
  url: string;
};

type PreloadOptions = {
  concurrency?: number;
  autoStart?: boolean;
};

export const usePreloadResources = <T extends string | number>(
  resources: ResourceItem<T>[],
  options?: PreloadOptions
) => {
  const { concurrency = 4, autoStart = true } = options ?? {};

  const preloadedUrlsRef = useRef<Map<T, string>>(new Map());
  const preloadingIdsRef = useRef<Set<T>>(new Set());
  const preloadPromiseRef = useRef<Promise<void> | null>(null);
  const preloadAbortControllerRef = useRef<AbortController | null>(null);

  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadedIds, setPreloadedIds] = useState<Set<T>>(new Set());

  const preloadResource = useCallback(
    async (id: T, url: string, signal?: AbortSignal) => {
      if (preloadedUrlsRef.current.has(id)) return;
      if (preloadingIdsRef.current.has(id)) return;
      preloadingIdsRef.current.add(id);

      try {
        const response = await fetch(url, {
          cache: 'force-cache',
          signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to preload resource ${id}.`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        preloadedUrlsRef.current.set(id, objectUrl);
        setPreloadedIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      } catch (err) {
        const isAbort =
          err instanceof DOMException && err.name === 'AbortError';
        if (!isAbort) {
          console.error('Failed to preload resource', id, err);
        }
      } finally {
        preloadingIdsRef.current.delete(id);
      }
    },
    []
  );

  const preloadAll = useCallback(() => {
    if (!resources.length) return;
    if (preloadPromiseRef.current) return;

    const controller = new AbortController();
    preloadAbortControllerRef.current?.abort();
    preloadAbortControllerRef.current = controller;

    const resourcesToPreload = resources.filter(
      ({ id }) => !preloadedUrlsRef.current.has(id)
    );
    if (!resourcesToPreload.length) {
      preloadAbortControllerRef.current = null;
      setIsPreloading(false);
      return;
    }

    const promise = (async () => {
      setIsPreloading(true);

      const queue = [...resourcesToPreload];
      const workers = Array.from({ length: concurrency }, async () => {
        while (queue.length) {
          const nextResource = queue.shift();
          if (!nextResource) break;
          await preloadResource(
            nextResource.id,
            nextResource.url,
            controller.signal
          );
        }
      });

      await Promise.allSettled(workers);
    })();

    preloadPromiseRef.current = promise.finally(() => {
      if (preloadAbortControllerRef.current === controller) {
        preloadAbortControllerRef.current = null;
      }
      preloadPromiseRef.current = null;
      setIsPreloading(false);
    });
  }, [resources, concurrency, preloadResource]);

  useEffect(() => {
    if (autoStart) {
      preloadAll();
    }
  }, [autoStart, preloadAll]);

  useEffect(() => {
    const preloadingIds = preloadingIdsRef.current;
    const preloadedUrls = preloadedUrlsRef.current;

    return () => {
      preloadAbortControllerRef.current?.abort();
      preloadingIds.clear();
      preloadedUrls.forEach((url) => URL.revokeObjectURL(url));
      preloadedUrls.clear();
      setPreloadedIds(new Set());
    };
  }, []);

  const getPreloadedUrl = useCallback((id: T): string | undefined => {
    return preloadedUrlsRef.current.get(id);
  }, []);

  const preloadStatuses = useMemo(
    () =>
      resources.map(({ id }) => ({
        id,
        preloaded: preloadedIds.has(id),
      })),
    [preloadedIds, resources]
  );

  return {
    isPreloading,
    preloadedIds,
    preloadStatuses,
    preloadAll,
    getPreloadedUrl,
  };
};
