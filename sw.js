// sw.js

// Listens for the push event from a push service.
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.error('Push event but no data');
    return;
  }

  const data = event.data.json();
  const title = data.title || 'HyperAPP Alert';
  const options = {
    body: data.body,
    icon: './logo192.png', // A default icon, assuming it exists in your assets
    badge: './logo72.png', // A default badge
    data: {
      url: data.url || '/', // Default URL to open on click
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Listens for a user clicking on the notification.
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Close the notification

  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  // This looks for an existing window and focuses it, otherwise opens a new one.
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus().then((c) => c.navigate(urlToOpen));
      }
      return self.clients.openWindow(urlToOpen);
    })
  );
});

// Ensures the new service worker activates immediately
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
