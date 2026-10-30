/*
 * CheckingBoard service worker: makes the app installable, shows the shift
 * reminders sent by the shift-reminders Edge Function, and keeps the last good copy of the app
 * so it still opens on a weak connection. Data always comes live from Supabase.
 */
const SHELL_CACHE = 'cb-shell-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== SHELL_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: network first, the last copy when offline
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(SHELL_CACHE);
        cache.put('/', res.clone());
        return res;
      } catch (err) {
        return (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  // Built files have content hashes in their names, so a cached copy never goes stale
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok) (await caches.open(SHELL_CACHE)).put(req, res.clone());
      return res;
    })());
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(data.title || 'CheckingBoard', {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/?view=checkin' }
  }));
});

// Tapping a reminder opens (or focuses) the app on the page in its link (?view=checkin)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/?view=checkin', self.location.origin);
  const view = target.searchParams.get('view') || 'checkin';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        client.postMessage({ type: 'open-view', view });
        return client.focus();
      }
    }
    return self.clients.openWindow(target.href);
  })());
});
