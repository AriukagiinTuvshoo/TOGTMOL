"use client";
import { useEffect, useState } from "react";
export function useWakeLock(enabled: boolean) {
  const [status, setStatus] = useState("Идэвхгүй");
  useEffect(() => {
    let disposed = false,
      lock: WakeLockSentinel | null = null,
      pending = false;
    const acquire = async () => {
      if (
        disposed ||
        !enabled ||
        document.visibilityState !== "visible" ||
        pending ||
        (lock && !lock.released)
      )
        return;
      if (!("wakeLock" in navigator)) {
        setStatus("Энэ браузер дэлгэц сэрүүн байлгахыг дэмжихгүй");
        return;
      }
      pending = true;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (disposed) {
          await next.release();
          return;
        }
        lock = next;
        setStatus("Дэлгэц сэрүүн байна");
        next.addEventListener("release", () => {
          if (!disposed) setStatus("Дэлгэцийн түгжээг төхөөрөмж удирдаж байна");
        });
      } catch {
        if (!disposed)
          setStatus("Төхөөрөмж дэлгэц сэрүүн байлгахыг зөвшөөрөөгүй");
      } finally {
        pending = false;
      }
    };
    if (enabled) void acquire();
    document.addEventListener("visibilitychange", acquire);
    window.addEventListener("focus", acquire);
    window.addEventListener("pageshow", acquire);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", acquire);
      window.removeEventListener("focus", acquire);
      window.removeEventListener("pageshow", acquire);
      void lock?.release().catch(() => {});
    };
  }, [enabled]);
  return enabled ? status : "Дэлгэцийн ердийн горим";
}
