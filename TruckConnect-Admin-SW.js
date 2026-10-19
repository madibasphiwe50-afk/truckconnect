/* =====================================================================
   TruckConnect Admin — push service worker
   File name: TruckConnect-Admin-SW.js
   Upload it to the SAME GitHub folder as your Admin HTML file.

   - Shows the admin push notifications, even when the app is closed.
   - Tapping a notification opens the Admin app on the right tab.
   - Registered on its own scope (./tc-admin-push/), so it does not
     interfere with TruckConnect-SW.js or the Driver/Customer apps.
   ===================================================================== */

var APP_URL = '';
try { APP_URL = new URL(self.location.href).searchParams.get('app') || ''; } catch (e) { APP_URL = ''; }

var ICON = '';
try { ICON = new URL('icon-192.png', self.location.href).href; } catch (e) { ICON = ''; }

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (event) {
  var p = {};
  try { p = event.data ? event.data.json() : {}; }
  catch (e) {
    try { p = { data: { body: event.data.text() } }; } catch (e2) { p = {}; }
  }
  var d = p.data || {};
  var n = p.notification || {};
  var title = d.title || n.title || 'TruckConnect Admin';
  var body = d.body || n.body || '';
  var tag = d.tag || '';
  var opts = {
    body: body,
    icon: ICON || undefined,
    badge: ICON || undefined,
    data: { type: d.type || '', tab: d.tab || '', url: APP_URL }
  };
  if (tag) { opts.tag = tag; opts.renotify = true; }
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var d = event.notification.data || {};
  var tab = d.tab || '';
  var base = (d.url || '').split('#')[0].split('?')[0];
  var target = base ? base + (tab ? '#tab=' + encodeURIComponent(tab) : '') : '';

  event.waitUntil((async function () {
    var wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (var i = 0; i < wins.length; i++) {
      var c = wins[i];
      var cu = (c.url || '').split('#')[0].split('?')[0];
      if (base && cu === base) {
        try { await c.focus(); } catch (e) { /* ignore */ }
        try { var bc = new BroadcastChannel('tc-admin-push'); bc.postMessage({ tab: tab }); bc.close(); } catch (e) { /* ignore */ }
        return;
      }
    }
    if (target) { await self.clients.openWindow(target); }
  })());
});
