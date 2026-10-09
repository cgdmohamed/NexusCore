// Service worker for the phone app. The app works online only, so this does two small things:
//  - keeps the app's own files (scripts, styles, fonts, icons) so it opens fast and can show a clear
//    "no connection" page instead of the browser's error
//  - never touches /api: data always comes from the server
const CACHE = "nexus-shell-v1";
const ICON = "/icons/icon-192.png";
const STATIC = /^\/(assets|fonts|icons)\//;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const OFFLINE_PAGE = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nexus</title><body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f6f7f9;color:#111827;text-align:center">
<div style="padding:24px"><h1 style="font-size:20px;margin:0 0 8px">لا يوجد اتصال بالإنترنت</h1><p style="margin:0 0 4px;color:#6b7280">No internet connection</p>
<p style="margin:12px 0 20px;color:#6b7280">يرجى إعادة فتح التطبيق عند عودة الاتصال</p>
<button onclick="location.reload()" style="height:44px;padding:0 24px;border:0;border-radius:10px;background:#2554d4;color:#fff;font-size:16px">إعادة المحاولة / Retry</button></div></body></html>`;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Pages: always try the network; remember the latest copy of the app shell
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("/", copy));
          }
          return res;
        })
        .catch(async () => {
          // Without a network the app cannot load data, so show the clear message
          return new Response(OFFLINE_PAGE, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
        }),
    );
    return;
  }

  // Static files: serve from cache, refresh in the background
  if (STATIC.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        const refresh = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      }),
    );
  }
});

// ---- Push notifications ---------------------------------------------------------------------
// The server sends { title, body, url, tag }. Every push must end in a visible notification.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Creative Code Nexus";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: ICON,
      badge: ICON,
      tag: data.tag,
      data: { url: data.url || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      // Reuse an open window of the app: focus it and let the app move to the right screen
      for (const win of windows) {
        if (new URL(win.url).origin === self.location.origin && "focus" in win) {
          await win.focus();
          win.postMessage({ type: "navigate", url });
          return;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
