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
 *   - Stale-while-revalidate for opted-in read-only `/api/*` GETs.
 *     The server signals opt-in by responding with `Cache-Control:
 *     public, max-age=...`. Auth-sensitive paths under /api/coach,
 *     /api/user, /api/cron, /api/webhooks, /api/visits are excluded
 *     by an explicit skip-list regardless of headers — those should
 *     never round-trip via the SW even if the server forgot to set
 *     `private`. See `API_CACHE_SKIP` below.
 *   - Images: cache-first with a 7-day max age. Wedding venue photos
 *     are large and rarely change, worth the storage cost.
 *
 * Cache invalidation strategy:
 *   1. **CACHE_VERSION** is the master kill-switch. Bump it whenever
 *      ANY of the cached shapes change — new SHELL_ASSETS entry, the
 *      `sw-cached-at` stamp format, the API skip-list, the request
 *      classifier rules. Old caches (any key not starting with the
 *      current version) are purged in the `activate` handler.
 *   2. **Per-cache TTL** sits on top of the version:
 *        - shell:  no TTL (re-pulled on every activate via skipWaiting)
 *        - static: no TTL (immutable hashed `_next/static/` URLs)
 *        - images: 7 days, then re-fetched
 *        - api:    respects server `Cache-Control: max-age=...`,
 *                  capped at API_CACHE_MAX_AGE_SECONDS
 *   3. **Engagement-driven busting**: a future client `markPwaEngaged`
 *      / venue-edit flow can `postMessage` the SW with `{ type:
 *      "invalidate", path: "/api/..." }` to drop a specific cached
 *      response without bumping the version. The handler is
 *      registered below — no callsites yet, kept dormant the same
 *      way the push handler shipped in Phase 2.
 *
 * Version bump checklist: change CACHE_VERSION below, then verify
 * the offline page still loads after `chrome://serviceworker-internals
 * → unregister → reload` (or DevTools → Application → SW → unregister).
 */

const CACHE_VERSION = "haretoki-v3-2026-05-02";
const CACHE_SHELL = `${CACHE_VERSION}-shell`;
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_IMAGES = `${CACHE_VERSION}-images`;
const CACHE_API = `${CACHE_VERSION}-api`;

// /offline is now a Next.js App Router route (src/app/offline/page.tsx),
// replacing the previous static /offline.html. The pre-rendered shell is
// stored at the route's HTML response on first install, then kept warm
// across activations until CACHE_VERSION bumps.
const SHELL_ASSETS = ["/offline", "/manifest.webmanifest"];

const ONE_DAY = 86400;
const IMAGE_MAX_AGE_SECONDS = 7 * ONE_DAY;
// Hard ceiling on API cache age — even if the server says
// `max-age=86400` we won't trust an SW-cached response older than
// 1 hour. Keeps stale data from leaking past a typical commute /
// session window. The SWR background refresh covers fresher cases.
const API_CACHE_MAX_AGE_SECONDS = 60 * 60;
const API_CACHE_DEFAULT_TTL_SECONDS = 5 * 60;

/** Path prefixes that MUST never be cached by the SW even if the
 *  server response carries `Cache-Control: public`. Authoritative
 *  source of "this returns user-private data". */
const API_CACHE_SKIP = [
  "/api/coach/",
  "/api/user/",
  "/api/cron/",
  "/api/webhooks/",
  "/api/visits/",
  "/api/projects/",
];

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

/** Parse `Cache-Control: public, max-age=...` and return seconds.
 *  Returns null when the response is `private`, `no-store`,
 *  `no-cache`, or has no usable max-age. */
function readCacheControlMaxAge(response) {
  const cc = response.headers.get("Cache-Control");
  if (!cc) return null;
  const tokens = cc.split(",").map((t) => t.trim().toLowerCase());
  if (
    tokens.includes("private") ||
    tokens.includes("no-store") ||
    tokens.includes("no-cache")
  ) {
    return null;
  }
  if (!tokens.includes("public")) return null;
  for (const t of tokens) {
    if (t.startsWith("max-age=")) {
      const n = Number(t.slice("max-age=".length));
      if (Number.isFinite(n) && n > 0) {
        return Math.min(n, API_CACHE_MAX_AGE_SECONDS);
      }
    }
  }
  return API_CACHE_DEFAULT_TTL_SECONDS;
}

/** Stale-while-revalidate for opted-in read-only `/api/*` GETs.
 *  Returns null when the path is on the skip-list — caller falls
 *  through to the default network path. */
async function handleApi(request, url) {
  if (API_CACHE_SKIP.some((prefix) => url.pathname.startsWith(prefix))) {
    return null;
  }
  const cache = await caches.open(CACHE_API);
  const cached = await cache.match(request);
  // Serve cached immediately if fresh; refresh in background.
  if (cached) {
    const stampedAt = Number(cached.headers.get("sw-cached-at") || 0);
    const ttl = Number(cached.headers.get("sw-cache-ttl") || 0);
    const ageSec = (Date.now() - stampedAt) / 1000;
    if (Number.isFinite(stampedAt) && Number.isFinite(ttl) && ageSec < ttl) {
      // Background refresh — don't await, don't block.
      void revalidateApi(request, cache);
      return cached;
    }
  }
  try {
    const response = await fetch(request);
    void storeApiResponse(request, response, cache);
    return response;
  } catch {
    return cached || Response.error();
  }
}

async function revalidateApi(request, cache) {
  try {
    const response = await fetch(request);
    await storeApiResponse(request, response, cache);
  } catch {
    // Stale entry stays — better than nothing on flaky networks.
  }
}

async function storeApiResponse(request, response, cache) {
  if (!response.ok) return;
  const ttl = readCacheControlMaxAge(response);
  if (ttl === null) return;
  const buffer = await response.clone().arrayBuffer();
  const stamped = new Response(buffer, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers({
      ...Object.fromEntries(response.headers),
      "sw-cached-at": String(Date.now()),
      "sw-cache-ttl": String(ttl),
    }),
  });
  await cache.put(request, stamped);
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

  if (url.pathname.startsWith("/api/") && url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cached = await handleApi(request, url);
        if (cached) return cached;
        // Skip-listed path → default network path.
        return fetch(request);
      })(),
    );
    return;
  }

  if (request.destination === "image") {
    event.respondWith(handleImage(request));
    return;
  }
});

/** Engagement-driven invalidation. Clients can `postMessage` this SW
 *  with `{ type: "invalidate", path: "/api/..." }` after a write so
 *  the next read pulls fresh data without waiting for the TTL. The
 *  caller chooses the path because the SW has no domain knowledge of
 *  which write invalidates which read.                                 */
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "invalidate" && typeof data.path === "string") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_API);
        const keys = await cache.keys();
        await Promise.all(
          keys
            .filter((req) => {
              try {
                return new URL(req.url).pathname.startsWith(data.path);
              } catch {
                return false;
              }
            })
            .map((req) => cache.delete(req)),
        );
      })(),
    );
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
