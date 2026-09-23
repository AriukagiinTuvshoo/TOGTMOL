"use client";

import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { useStudy } from "@/hooks/use-study";
import { registerAuthDeepLinks } from "@/lib/auth/capacitor";

export function CapacitorAuthBridge() {
  const { setNotice } = useStudy();

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;

    let active = true;
    let remove: (() => Promise<void>) | null = null;

    void registerAuthDeepLinks(client, (message) => {
      if (!active) return;
      setNotice(message);
    }).then((cleanup) => {
      if (!active) {
        void cleanup();
        return;
      }
      remove = cleanup;
    });

    return () => {
      active = false;
      if (remove) void remove();
    };
  }, [setNotice]);

  return null;
}
