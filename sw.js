const CACHE_NAME = 'event-configurator-v1';
const ASSETS = [
	'./',
	'./index.html',
	'./styles.css',
	'./app.js',
	'./favicon.svg',
	'./manifest.webmanifest'
];
self.addEventListener('install', (event) => {
	event.waitUntil((async () => {
		const cache = await caches.open(CACHE_NAME);
		try { await cache.addAll(ASSETS); } catch (e) { /* ignore */ }
		self.skipWaiting();
	})());
});
self.addEventListener('activate', (event) => {
	event.waitUntil((async () => {
		const keys = await caches.keys();
		await Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()));
		self.clients.claim();
	})());
});
self.addEventListener('fetch', (event) => {
	const req = event.request;
	const url = new URL(req.url);
	if (req.method !== 'GET' || url.origin !== location.origin) return;
	// HTML navigation: network-first fallback to cache
	if (req.mode === 'navigate') {
		event.respondWith((async () => {
			try { return await fetch(req); } catch (e) {
				const cache = await caches.open(CACHE_NAME);
				return await cache.match('./index.html');
			}
		})());
		return;
	}
	// Static: cache-first
	event.respondWith((async () => {
		const cache = await caches.open(CACHE_NAME);
		const cached = await cache.match(req);
		if (cached) return cached;
		try {
			const res = await fetch(req);
			if (res && res.ok) cache.put(req, res.clone());
			return res;
		} catch (e) {
			return cached || Response.error();
		}
	})());
}); 