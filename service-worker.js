import { precacheAndRoute } from 'workbox-precaching';

// Garante ativação e controle imediato
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// will be replaced by workbox
precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener('push', (event) => {
  try {
    const data = event.data ? JSON.parse(event.data.text()) : {};
    const title = data.title || 'Estety Cloud';
    const body = data.body || 'Nova notificação';
    const payload = data.data || {};
    event.waitUntil(self.registration.showNotification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      data: payload,
    }));
  } catch (e) {
    // no-op
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
