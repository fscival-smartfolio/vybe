self.addEventListener("push", function (event) {
  let dati = {};
  try {
    dati = event.data ? event.data.json() : {};
  } catch (e) {
    dati = { title: "Vybe", body: event.data ? event.data.text() : "" };
  }

  const titolo = dati.title || "Vybe";
  const opzioni = {
    body: dati.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: dati.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(titolo, opzioni));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(clients.openWindow(url));
});
