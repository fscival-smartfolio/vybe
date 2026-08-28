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

  const urlDestinazione =
    event.notification.data && event.notification.data.url ? event.notification.data.url : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((listaClient) => {
      // Se l'app è già aperta in una scheda/finestra, la portiamo in
      // primo piano e la spostiamo sulla pagina giusta, invece di
      // aprirne una seconda copia.
      for (const client of listaClient) {
        try {
          const urlClient = new URL(client.url);
          if (urlClient.origin === self.location.origin) {
            client.focus();
            if ("navigate" in client) {
              return client.navigate(urlDestinazione);
            }
          }
        } catch (e) {
          // ignora e prova il prossimo client
        }
      }

      // Nessuna finestra aperta: ne apriamo una nuova sulla pagina giusta.
      return clients.openWindow(urlDestinazione);
    })
  );
});
