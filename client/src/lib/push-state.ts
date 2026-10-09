// What the push switch should show, decided from facts about the device. Pure so it can be tested.

export type PushStatus = "loading" | "unsupported" | "needs_install" | "not_configured" | "denied" | "off" | "on";

export interface PushFacts {
  supported: boolean;      // service workers, Push API and Notification all exist
  ios: boolean;
  standalone: boolean;     // opened from the home screen
  configured: boolean | undefined; // server has VAPID keys; undefined while loading
  permission: NotificationPermission | "unavailable";
  subscribed: boolean | undefined; // this browser holds a subscription; undefined while loading
}

export function decidePushStatus(f: PushFacts): PushStatus {
  // iPhone only offers push to apps installed on the home screen
  if (f.ios && !f.standalone) return "needs_install";
  if (!f.supported) return "unsupported";
  if (f.configured === undefined || f.subscribed === undefined) return "loading";
  if (!f.configured) return "not_configured";
  if (f.permission === "denied") return "denied";
  return f.subscribed && f.permission === "granted" ? "on" : "off";
}

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
