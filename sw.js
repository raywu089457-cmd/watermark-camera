/* 浮水印相機 — service worker
 *
 * 策略刻意分兩種：
 *   1. 導覽（開頁面）→ 先網路。這樣我改版你重新整理就會看到新版，不會被舊快取卡住；
 *      只有在離線時才回快取。
 *   2. 其他同源資源（圖示、manifest）→ 快取優先，背景順便更新。
 *
 * 改版時把 VERSION 往上加，舊快取會在 activate 時清掉。
 */
const VERSION = "v1";
const CACHE = "wm-camera-" + VERSION;

const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // cache: "reload" 繞過 HTTP 快取，確保拿到的是這次部署的版本
      await cache.addAll(SHELL.map((url) => new Request(url, { cache: "reload" })));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE && k.startsWith("wm-camera-")).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1. 開頁面：先網路，離線才回快取
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) {
            const cache = await caches.open(CACHE);
            cache.put("./index.html", fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch (err) {
          const cache = await caches.open(CACHE);
          const hit = (await cache.match("./index.html")) || (await cache.match("./"));
          return hit || Response.error();
        }
      })()
    );
    return;
  }

  // 2. 其他資源：快取優先 + 背景更新
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) {
        fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
          })
          .catch(() => {});
        return hit;
      }
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
        return res;
      } catch (err) {
        return hit || Response.error();
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
