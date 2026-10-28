/* TruckConnect Admin push service worker.
   Upload next to admin.html (replaces the old TruckConnect-Admin-SW.js).
   Shows the TruckConnect logo and opens the right tab when you tap an alert. */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

var APP = new URL(self.location.href).searchParams.get('app') || './';

self.addEventListener('push', function(e){
  var p = {};
  try { p = e.data ? e.data.json() : {}; } catch (x) {}
  var d = (p && p.data) ? p.data : (p || {});
  var title = d.title || 'TruckConnect Admin';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: d.icon || undefined,
    badge: d.badge || undefined,
    tag: d.tag || undefined,
    renotify: !!d.tag,
    requireInteraction: d.kind === 'admin_sos',
    data: { screen: d.screen || '', url: APP }
  }));
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var dd = e.notification.data || {};
  var base = dd.url || APP;
  var url = base.split('#')[0] + (dd.screen ? '#tab=' + dd.screen : '');
  e.waitUntil((async function(){
    var list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.split('#')[0] === base.split('#')[0]) {
        try { await list[i].focus(); } catch (x) {}
        try { await list[i].navigate(url); } catch (x) {}
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
