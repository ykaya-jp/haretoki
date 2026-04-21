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

const CACHE_VERSION = "haretoki-v1-2026-04-21";
const CACHE_SHELL = `${CACHE_VERSION}-shell`;
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_IMAGES = `${CACHE_VERSION}-images`;

const SHELL_ASSETS = ["/offline.html", "/manifest.webmanifest"];

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

/** Network-first for documents; fall back to /offline.html only on
 *  true network failures. Keeps auth redirects / 4xx / 5xx on the
 *  normal app error path. */
async function handleDocument(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cache = await caches.open(CACHE_SHELL);
    const offline = await cache.match("/offline.html");
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
