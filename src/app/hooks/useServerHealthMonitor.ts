"use client";

import { useEffect, useMemo, useState } from "react";

const KEEP_ALIVE_INTERVAL_MS = 240000; // 4 minutes
const KEEP_ALIVE_MAX_COUNT = 45; // 3 hours
const BOOT_RETRY_MS = 5000;
const CONNECTED_MESSAGE_MS = 3000;

type BannerStatus = "booting" | "connected" | "hidden";

export function useServerHealthMonitor() {
  const [isBooting, setIsBooting] = useState(true);
  const [showConnected, setShowConnected] = useState(false);

  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000",
    [],
  );

  useEffect(() => {
    let mounted = true;
    let retryTimeoutId: number | null = null;
    let connectedTimeoutId: number | null = null;

    const checkHealth = async () => {
      try {
        const res = await fetch(`${apiBase}/api/health`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Health check failed: ${res.status}`);
        }

        if (!mounted) return;
        setIsBooting(false);
        setShowConnected(true);
        connectedTimeoutId = window.setTimeout(() => {
          if (mounted) setShowConnected(false);
        }, CONNECTED_MESSAGE_MS);
      } catch {
        if (!mounted) return;
        retryTimeoutId = window.setTimeout(() => {
          void checkHealth();
        }, BOOT_RETRY_MS);
      }
    };

    void checkHealth();

    return () => {
      mounted = false;
      if (retryTimeoutId !== null) window.clearTimeout(retryTimeoutId);
      if (connectedTimeoutId !== null) window.clearTimeout(connectedTimeoutId);
    };
  }, [apiBase]);

  useEffect(() => {
    if (isBooting) return;

    let count = 0;
    const intervalId = window.setInterval(() => {
      count += 1;
      void fetch(`${apiBase}/api/health`, { cache: "no-store" }).catch(() => {
        // Keep-alive failures are non-blocking for UX.
      });

      if (count >= KEEP_ALIVE_MAX_COUNT) {
        window.clearInterval(intervalId);
      }
    }, KEEP_ALIVE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [apiBase, isBooting]);

  const status: BannerStatus = isBooting
    ? "booting"
    : showConnected
      ? "connected"
      : "hidden";

  return { status };
}

