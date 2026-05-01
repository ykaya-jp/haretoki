/**
 * haretoki service worker — minimal app-shell + runtime cache.
 *
 * Strategy:
 *   - Precache only the offline fallback page + manifest on install.
 *     The app itself is mostly SSR/PPR, so precaching route HTML would
 *     go stale quickly. Runtime "stale-while-revalidate" for static
 *     assets handles the rest.
 *   - Network-first for document navigations, falling back to the
 *     offline page only when the network genuinely fails (not on
 *     401/403/500 — those still bubble to the normal error boundary).
 *   - Stale-while-revalidate for /_next/static/ assets so returning
 *     users see instant renders on flaky networks.
 *   - Images: cache-first with a 7-day max age. Wedding venue photos
 *     are large and rarely change, worth the storage cost.
 *
 * Version bump: change CACHE_VERSION when any cached file in the
 * install list changes. Older caches are purged on activate.
 */

const CACHE_VERSION = "haretoki-v2-2026-05-02";
const CACHE_SHELL = `${CACHE_VERSION}-shell`;
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_IMAGES = `${CACHE_VERSION}-images`;

// /offline is now a Next.js App Router route (src/app/offline/page.tsx),
// replacing the previous static /offline.html. The pre-rendered shell is
// stored at the route's HTML response on first install, then kept warm
// across activations until CACHE_VERSION bumps.
const SHELL_ASSETS = ["/offline", "/manifest.webmanifest"];

const ONE_DAY = 86400;
const IMAGE_MAX_AGE_SECONDS = 7 * ONE_DAY;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      // Allow individual assets to fail without aborting the whole
      // install — the offline page is the only truly critical one.
      await Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Network-first for documents; fall back to the cached /offline route
 *  only on true network failures. Keeps auth redirects / 4xx / 5xx on
 *  the normal app error path. */
async function handleDocument(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cache = await caches.open(CACHE_SHELL);
    const offline = await cache.match("/offline");
    return (
      offline ||
      new Response("オフラインです", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

/** Stale-while-revalidate for /_next/static/ (immutable hashes) — cache
 *  forever, refresh in background. */
async function handleStatic(request) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || networkPromise;
}

/** Cache-first for images under Supabase Storage + next/image.
 *  Age-limited so venues that actually replace their hero photo
 *  eventually pick up the new one. */
async function handleImage(request) {
  const cache = await caches.open(CACHE_IMAGES);
  const cached = await cache.match(request);
  if (cached) {
    const dateHeader = cached.headers.get("sw-cached-at");
    const cachedAt = dateHeader ? Number(dateHeader) : 0;
    const ageSec = (Date.now() - cachedAt) / 1000;
    if (ageSec < IMAGE_MAX_AGE_SECONDS) return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Clone + stamp a cached-at header so we can age-check later.
      const buffer = await response.clone().arrayBuffer();
      const stamped = new Response(buffer, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers({
          ...Object.fromEntries(response.headers),
          "sw-cached-at": String(Date.now()),
        }),
      });
      void cache.put(request, stamped);
    }
    return response;
  } catch {
    return cached || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !url.hostname.endsWith(".supabase.co")) {
    // Third-party requests (Sentry, analytics, Claude) stay on the
    // default network path to keep auth / CORS behaviour intact.
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleDocument(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(handleStatic(request));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(handleImage(request));
    return;
  }
});

/* ─── Push Notifications (Phase 3 foundation) ─────────────────────────
 * Phase 2 ships the worker-side handler so a future Phase 3 backend
 * (VAPID + Resend / web-push) can target installed PWAs without
 * needing another service-worker version bump. The payload contract
 * is `{ title, body, url? }` — `url` defaults to `/` if absent.
 * No server delivery is wired up in Phase 2, so these handlers stay
 * dormant unless the browser receives a push event.                   */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }
  if (!data || typeof data.title !== "string") return;
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    lang: "ja",
    data: { url: typeof data.url === "string" ? data.url : "/" },
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windows) => {
      // Focus an existing tab on the same origin if one is already open
      // (avoids "duplicate Haretoki tab" UX), otherwise open a new one.
      for (const client of windows) {
        if (client.url && "focus" in client) {
          const target = new URL(url, self.location.origin);
          if (new URL(client.url).origin === target.origin) {
            client.navigate(target.href);
            return client.focus();
          }
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
