import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

// Lists on a phone should be fresh when the app comes back to the foreground
export function useList<T>(url: string, enabled = true) {
  return useQuery<T>({ queryKey: [url], enabled, staleTime: 15_000, refetchOnWindowFocus: true });
}

// After an add or an edit every list that may show the record is reloaded
export function refreshLists() {
  return queryClient.invalidateQueries({
    predicate: (q) => typeof q.queryKey[0] === "string" && /^\/api\/(tasks|projects|clients)/.test(q.queryKey[0] as string),
  });
}

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

// Android/Chrome offers installation through an event; iPhone has to use Share > Add to Home Screen
export function useInstall() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  const standalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);
  const ios = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  return {
    canPrompt: !!event && !standalone,
    showIosHint: ios && !standalone,
    install: async () => {
      if (!event) return;
      await event.prompt();
      setEvent(null);
    },
  };
}
