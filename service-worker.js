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

// Web Push removido: sem handlers de push/notificationclick
