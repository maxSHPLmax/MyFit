// ============================================
// Service Worker — для офлайн-работы и кеширования
// ============================================
// Каждый раз, когда меняешь файлы — увеличивай VERSION,
// чтобы пользователи получили свежую версию.

const VERSION = 'myfit-v2';

// Какие файлы кешировать при первой установке
const FILES_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './products.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

// ============================================
// 1. УСТАНОВКА — кешируем все файлы
// ============================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => {
      console.log('[SW] Кеширую файлы приложения');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  // Сразу активируем новый SW, не ждём перезагрузки вкладки
  self.skipWaiting();
});

// ============================================
// 2. АКТИВАЦИЯ — чистим старые кеши
// ============================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== VERSION)
          .map((key) => {
            console.log('[SW] Удаляю старый кеш:', key);
            return caches.delete(key);
          })
      );
    })
  );
  // Берём контроль над всеми открытыми вкладками
  self.clients.claim();
});

// ============================================
// 3. ПЕРЕХВАТ ЗАПРОСОВ — сначала кеш, потом сеть
// ============================================
self.addEventListener('fetch', (event) => {
  // Обрабатываем только GET-запросы
  if (event.request.method !== 'GET') return;

  // Запросы к Open Food Facts не трогаем — пусть идут напрямую в сеть
  const url = new URL(event.request.url);
  if (url.hostname.endsWith('openfoodfacts.org')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Если файл есть в кеше — отдаём его
      if (cachedResponse) {
        return cachedResponse;
      }
      // Иначе грузим из сети и сохраняем в кеш
      return fetch(event.request).then((networkResponse) => {
        // Кешируем только успешные ответы того же домена
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const responseClone = networkResponse.clone();
          caches.open(VERSION).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    }).catch(() => {
      // Если ни кеш, ни сеть не сработали — возвращаем главную
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
