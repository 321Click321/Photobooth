self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('booth-cache').then(cache => {
      return cache.addAll([
        'index.html',
        'styles.css',
        'app.js',
        'admin.html',
        'admin.js',
        'manifest.json'
      ]);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
