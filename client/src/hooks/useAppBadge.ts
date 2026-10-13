import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNotifications } from "@/hooks/useNotifications";

// Keeps the number on the app's icon in step with what is unread, while the app is open.
// (When it is closed, the same number arrives with each push.) Works where the device supports badges: installed
// apps on iPhone (iOS 16.4+) and Android, and desktop PWAs; it needs notification permission.
export function useAppBadge(enabled = true) {
  const { unreadCount } = useNotifications(1, 1);
  const messages = useQuery<{ unreadCount: number }>({ queryKey: ["/api/messages/unread-count"], enabled, refetchInterval: 30_000, staleTime: 10_000 }).data?.unreadCount ?? 0;
  const total = enabled ? (unreadCount ?? 0) + messages : 0;

  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    try {
      if (total > 0 && nav.setAppBadge) nav.setAppBadge(total).catch(() => {});
      else if (nav.clearAppBadge) nav.clearAppBadge().catch(() => {});
    } catch { /* not supported here */ }
  }, [total]);

  // Signing out clears the number
  useEffect(() => () => {
    try { (navigator as any).clearAppBadge?.()?.catch?.(() => {}); } catch { /* ignore */ }
  }, []);
}
