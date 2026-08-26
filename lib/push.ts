import { createClient } from "@/lib/supabase/client";

function base64UrlAUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export type RisultatoNotifiche =
  | { ok: true }
  | { ok: false; motivo: string };

// Chiede il permesso di inviare notifiche e registra questo dispositivo.
// Restituisce SEMPRE un esito chiaro (mai un fallimento silenzioso),
// così l'interfaccia può dire all'utente esattamente cosa è successo.
export async function abilitaNotifichePush(): Promise<RisultatoNotifiche> {
  try {
    if (!("serviceWorker" in navigator)) {
      return { ok: false, motivo: "Questo browser non supporta i service worker." };
    }

    if (!("PushManager" in window)) {
      return { ok: false, motivo: "Questo browser non supporta le notifiche push (comune nei browser interni di app come Instagram/Facebook: apri il sito da Chrome o Safari veri)." };
    }

    const chiavePubblica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!chiavePubblica) {
      return { ok: false, motivo: "Configurazione mancante lato server (chiave VAPID non impostata)." };
    }

    const permesso = await Notification.requestPermission();
    if (permesso !== "granted") {
      return { ok: false, motivo: `Permesso non concesso (stato: ${permesso}).` };
    }

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
    if (!dati.endpoint || !dati.keys?.p256dh || !dati.keys?.auth) {
      return { ok: false, motivo: "L'iscrizione push non ha restituito i dati necessari." };
    }

    const supabase = createClient();
    const { error } = await supabase.rpc("salva_push_subscription", {
      p_endpoint: dati.endpoint,
      p_p256dh: dati.keys.p256dh,
      p_auth: dati.keys.auth,
    });

    if (error) {
      return { ok: false, motivo: `Errore nel salvataggio: ${error.message}` };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, motivo: err?.message || "Errore sconosciuto." };
  }
}

// Disattiva le notifiche su questo dispositivo: annulla l'iscrizione nel
// browser e rimuove il dispositivo dall'elenco di quelli da avvisare.
export async function disabilitaNotifichePush(): Promise<RisultatoNotifiche> {
  try {
    if (!("serviceWorker" in navigator)) {
      return { ok: false, motivo: "Questo browser non supporta i service worker." };
    }

    const registrazione = await navigator.serviceWorker.getRegistration();
    const iscrizione = await registrazione?.pushManager.getSubscription();

    if (iscrizione) {
      const endpoint = iscrizione.endpoint;
      await iscrizione.unsubscribe();

      const supabase = createClient();
      const { error } = await supabase.rpc("rimuovi_push_subscription", { p_endpoint: endpoint });
      if (error) return { ok: false, motivo: error.message };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, motivo: err?.message || "Errore sconosciuto." };
  }
}

// Dice se questo dispositivo ha già un'iscrizione attiva alle notifiche,
// per mostrare "Attiva" o "Disattiva" nel pulsante giusto fin da subito.
export async function statoNotifichePush(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    if (Notification.permission !== "granted") return false;

    const registrazione = await navigator.serviceWorker.getRegistration();
    const iscrizione = await registrazione?.pushManager.getSubscription();
    return !!iscrizione;
  } catch {
    return false;
  }
}
