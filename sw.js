// Service Worker - Pemindai & Verifikasi Peserta Ujian
// Naikkan angka versi ini setiap kali file aplikasi diubah agar HP memperbarui cache.
const CACHE_NAME = 'cek-peserta-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

// Pustaka eksternal yang dipakai index.html (disimpan agar aplikasi tetap tampil saat sinyal buruk)
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js'
];

const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    // CDN: best-effort, kegagalan satu file tidak membatalkan instalasi
    await Promise.allSettled(
      CDN_ASSETS.map((url) => cache.add(new Request(url, { mode: 'no-cors' })))
    );
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Google Apps Script (data kehadiran) & foto peserta: SELALU langsung ke jaringan
  if (url.hostname.endsWith('google.com') || url.hostname.endsWith('googleusercontent.com') ||
      url.hostname.endsWith('unsri.ac.id')) {
    return;
  }

  // File aplikasi sendiri: coba jaringan dulu (agar update langsung terbaca), cadangan dari cache
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Pustaka CDN (Tailwind, Font Awesome, QR): cache dulu, perbarui di latar belakang
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const network = fetch(req)
          .then((res) => {
            caches.open(CACHE_NAME).then((c) => c.put(req, res.clone()));
            return res;
          })
          .catch(() => hit);
        return hit || network;
      })
    );
  }
});
