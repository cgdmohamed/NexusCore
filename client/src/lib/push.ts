import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { decidePushStatus, urlBase64ToUint8Array, type PushStatus } from "@/lib/push-state";

type Platform = "desktop" | "mobile";

const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);
const isIos = () => typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// The worker is only registered in production builds; in development this resolves to null
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 2500))]);
}

export function usePush(platform: Platform) {
  const [subscribed, setSubscribed] = useState<boolean | undefined>(undefined);
  const [permission, setPermission] = useState<NotificationPermission | "unavailable">(
    typeof Notification === "undefined" ? "unavailable" : Notification.permission,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = useQuery<{ enabled: boolean; publicKey: string | null }>({ queryKey: ["/api/push/config"], staleTime: 5 * 60_000 });

  // Find out whether this browser already holds a subscription, and keep the server's copy current
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupported()) return setSubscribed(false);
      const reg = await getRegistration();
      const existing = reg ? await reg.pushManager.getSubscription() : null;
      if (cancelled) return;
      setSubscribed(!!existing);
      if (existing && Notification.permission === "granted") {
        const json = existing.toJSON();
        apiRequest("POST", "/api/push/subscribe", { endpoint: json.endpoint, keys: json.keys, platform }).catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [platform]);

  const status: PushStatus = decidePushStatus({
    supported: isSupported(), ios: isIos(), standalone: isStandalone(),
    configured: config.isLoading ? undefined : !!config.data?.enabled, permission, subscribed,
  });

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const key = config.data?.publicKey;
      const reg = await getRegistration();
      if (!key || !reg) throw new Error("unavailable");
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;
      const sub = (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) as BufferSource }));
      const json = sub.toJSON();
      await apiRequest("POST", "/api/push/subscribe", { endpoint: json.endpoint, keys: json.keys, platform });
      setSubscribed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }, [config.data?.publicKey, platform]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await apiRequest("POST", "/api/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setBusy(true);
    try {
      await apiRequest("POST", "/api/push/test", {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, error, enable, disable, sendTest };
}
