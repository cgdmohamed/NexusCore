import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useNotifications } from "@/hooks/useNotifications";

// Keeps the number on the app's icon in step with the server's figure (unread notifications + my open tasks due today
// or late) while the app is open. When it is closed, the same figure arrives with each push. Works where the device
// supports badges: installed apps on iPhone (iOS 16.4+) and Android, and desktop PWAs; it needs notification permission.
export function useAppBadge(enabled = true) {
  const { unreadCount } = useNotifications(1, 1);
  const total = useQuery<{ total: number }>({ queryKey: ["/api/badge"], enabled, refetchInterval: 30_000, staleTime: 10_000, refetchOnWindowFocus: true }).data?.total ?? 0;

  // Reading or receiving a notification changes the figure at once, without waiting for the next refresh
  useEffect(() => { if (enabled) queryClient.invalidateQueries({ queryKey: ["/api/badge"] }); }, [unreadCount, enabled]);

  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    try {
      if (enabled && total > 0 && nav.setAppBadge) nav.setAppBadge(total).catch(() => {});
      else if (nav.clearAppBadge) nav.clearAppBadge().catch(() => {});
    } catch { /* not supported here */ }
  }, [total, enabled]);

  // Signing out clears the number
  useEffect(() => () => {
    try { (navigator as any).clearAppBadge?.()?.catch?.(() => {}); } catch { /* ignore */ }
  }, []);
}
