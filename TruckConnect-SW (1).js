/* TruckConnect service worker  (driver, customer and admin apps)
   Shows push notifications with the blue-and-white TC logo, rings for new
   loads, and handles Accept / Decline straight from the notification.
   Put this file in the same folder as the apps, replacing the old one. */
const WORKER = 'https://truckconnect-fcm.madibasphiwe50.workers.dev';
const LOGO = WORKER + '/logo.png';
const BADGE = WORKER + '/badge.png';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (e) { p = {}; }
  const d = p.data || p || {};
  const n = p.notification || {};
  const title = d.title || n.title || 'Truck Connect';
  const ring = d.ring === '1';
  // Keep a price together: "R 1 850" never splits across two lines.
  const keepPrice = t => String(t || '').replace(/(^|[^A-Za-z])R\s*(\d[\d\s,.]*\d|\d)/g, (m, pre, num) => pre + 'R\u00A0' + num.trim().replace(/\s+/g, '\u00A0'));
  const actions = [];
  if (ring && d.actionToken) {
    actions.push({ action: 'accept', title: 'Accept' }, { action: 'decline', title: 'Decline' });
  }
  const opts = {
    body: keepPrice(d.body || n.body || ''),
    icon: d.icon || LOGO,
    badge: d.badge || BADGE,
    tag: d.tag || ('tc-' + (d.kind || 'msg')),
    renotify: true,
    data: d,
    actions,
    // A ringing load stays on screen and buzzes like a call until answered.
    requireInteraction: ring,
    vibrate: ring ? [600, 300, 600, 300, 600, 300, 600, 300, 600, 300, 600] : [200, 100, 200],
    silent: false,
    timestamp: Date.now()
  };
  if (d.image) opts.image = d.image;
  event.waitUntil((async () => {
    await self.registration.showNotification(title, opts);
    // If the app is open and visible, let it chime / show its own toast too.
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    cs.forEach(c => c.postMessage({ type: 'TC_PUSH', data: d }));
    if (ring) {
      // stop ringing after 45 s (same as the Worker's expiry)
      setTimeout(async () => {
        const list = await self.registration.getNotifications({ tag: opts.tag });
        list.forEach(x => x.close());
      }, 45000);
    }
  })());
});

self.addEventListener('notificationclick', event => {
  const d = event.notification.data || {};
  const act = event.action;
  event.notification.close();
  if ((act === 'accept' || act === 'decline') && d.actionToken) {
    event.waitUntil((async () => {
      let res = null, j = {};
      try {
        const r = await fetch(WORKER + '/notification-action', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: act, token: d.actionToken })
        });
        j = await r.json().catch(() => ({}));
        res = r;
      } catch (e) { j = { ok: false, reason: 'offline' }; }
      if (act === 'decline') return;
      if (res && res.ok && j.ok) {
        // Accepted: open the app on the job.
        return openApp(Object.assign({}, d, { screen: 'job' }));
      }
      const why = j.reason === 'job-already-taken' || j.reason === 'job-no-longer-available'
        ? 'This load was already taken by another driver.'
        : j.reason === 'quote-required' ? 'This heavy load needs your quote. Open the app.'
        : 'Could not accept. Open the app and try again.';
      await self.registration.showNotification('Truck Connect', { body: why, icon: LOGO, badge: BADGE, tag: 'tc-result' });
    })());
    return;
  }
  event.waitUntil(openApp(d));
});

async function openApp(d) {
  const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of cs) {
    if ('focus' in c) {
      await c.focus();
      c.postMessage({ type: 'TC_NOTIFICATION_CLICK', data: d });
      return;
    }
  }
  const scope = self.registration.scope;
  const page = d.app === 'customer' ? 'truckconnect-c.html' : d.app === 'admin' ? 'admin.html' : 'truckconnect-d.html';
  return self.clients.openWindow(scope + page + '?screen=' + encodeURIComponent(d.screen || '') + '&id=' + encodeURIComponent(d.id || ''));
}
