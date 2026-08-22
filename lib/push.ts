import { createClient } from "@/lib/supabase/client";

function base64UrlAUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

// Chiede il permesso di inviare notifiche e registra questo dispositivo.
// Va richiamata da un'azione dell'utente (es. click su "Mi unisco"),
// mai automaticamente al caricamento della pagina: i browser bloccano
// le richieste di permesso non collegate a un'interazione reale.
export async function abilitaNotifichePush() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const chiavePubblica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!chiavePubblica) {
      console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY non impostata, notifiche push disattivate.");
      return;
    }

    const permesso = await Notification.requestPermission();
    if (permesso !== "granted") return;

    const registrazione = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let iscrizione = await registrazione.pushManager.getSubscription();

    if (!iscrizione) {
      iscrizione = await registrazione.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlAUint8Array(chiavePubblica),
      });
    }

    const dati = iscrizione.toJSON();
    if (!dati.endpoint || !dati.keys?.p256dh || !dati.keys?.auth) return;

    const supabase = createClient();
    await supabase.rpc("salva_push_subscription", {
      p_endpoint: dati.endpoint,
      p_p256dh: dati.keys.p256dh,
      p_auth: dati.keys.auth,
    });
  } catch (err) {
    // Non blocchiamo mai il flusso principale (iscrizione/creazione attività)
    // se le notifiche push falliscono per qualsiasi motivo.
    console.warn("Notifiche push non attivate:", err);
  }
}
