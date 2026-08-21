/**
 * ATC365 web push worker.
 * Messaging-only: it never caches app shell assets, so it does not affect
 * previews or deploys. It exists purely so notifications can be delivered
 * while the site is in the background or fully closed.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "ATC365", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "ATC365";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      tag: payload.tag || "atc365",
      renotify: !!payload.tag,
      icon: "/favicon.png",
      badge: "/favicon.png",
      silent: !!payload.silent,
      requireInteraction: !!payload.sticky,
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
