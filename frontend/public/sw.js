// Service worker for Web Push notifications (mobile web)
self.addEventListener('push', function (event) {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch (_) {
    payload = { title: event.data.text() || 'Notification', body: '', link: '/' };
  }
  const title = payload.title || 'Crew Bench';
  const body = payload.body || '';
  const link = payload.link || '/';
  const options = {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.tag || 'crew-bench',
    data: { url: link },
    requireInteraction: false,
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        const base = self.location.origin;
        return clients.openWindow(url.startsWith('http') ? url : base + url);
      }
    })
  );
});
