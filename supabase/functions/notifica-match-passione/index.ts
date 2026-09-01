import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function risposta(dati: unknown, status = 200) {
  return new Response(JSON.stringify(dati), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return risposta(
      {
        ok: false,
        error: "Metodo non consentito",
      },
      405
    );
  }

  try {
    const testo = await req.text();

    let corpo: any = {};

    if (testo.trim() !== "") {
      try {
        corpo = JSON.parse(testo);
      } catch {
        return risposta(
          {
            ok: false,
            error: "JSON non valido",
          },
          400
        );
      }
    }

    const attivitaId =
      corpo.attivita_id ||
      corpo.attivitaId ||
      corpo.activity_id ||
      corpo.activityId ||
      corpo.id;

    console.log("ATTIVITA_ID:", attivitaId);

    if (!attivitaId) {
      return risposta(
        {
          ok: false,
          error: "attivita_id mancante",
        },
        400
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL mancante");
    }

    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    /*
     * RECUPERO ATTIVITA
     */

    const {
      data: attivita,
      error: erroreAttivita,
    } = await supabase
      .from("attivita")
      .select(
        "id, titolo, categoria, luogo, creatore_id"
      )
      .eq("id", String(attivitaId))
      .maybeSingle();

    if (erroreAttivita) {
      console.error(
        "ERRORE RECUPERO ATTIVITA:",
        erroreAttivita
      );

      return risposta(
        {
          ok: false,
          error: "Errore recupero attività",
          details: erroreAttivita.message,
          code: erroreAttivita.code,
        },
        500
      );
    }

    if (!attivita) {
      return risposta(
        {
          ok: false,
          error: "Attività non trovata",
          attivita_id: String(attivitaId),
        },
        404
      );
    }

    console.log(
      "ATTIVITA TROVATA:",
      attivita.id
    );

    /*
     * UTENTI STESSA PASSIONE / VICINANZA
     */

    let perPassione: any[] = [];

    const {
      data: risultatiPassione,
      error: errorePassione,
    } = await supabase.rpc(
      "utenti_da_notificare_nuova_attivita",
      {
        p_attivita_id: attivita.id,
      }
    );

    if (errorePassione) {
      console.error(
        "ERRORE RPC PASSIONE:",
        errorePassione
      );
    } else {
      perPassione = risultatiPassione || [];
    }

    /*
     * FOLLOWER ORGANIZZATORE
     */

    let perFollow: any[] = [];

    const {
      data: risultatiFollow,
      error: erroreFollow,
    } = await supabase.rpc(
      "follower_da_notificare",
      {
        p_creatore_id: attivita.creatore_id,
      }
    );

    if (erroreFollow) {
      console.error(
        "ERRORE RPC FOLLOWER:",
        erroreFollow
      );
    } else {
      perFollow = risultatiFollow || [];
    }

    /*
     * UNIAMO GLI UTENTI
     */

    const utenti = new Set<string>();

    for (const r of perPassione) {
      if (r && r.utente_id) {
        utenti.add(String(r.utente_id));
      }
    }

    for (const r of perFollow) {
      if (r && r.utente_id) {
        utenti.add(String(r.utente_id));
      }
    }

    /*
     * L'ORGANIZZATORE NON RICEVE
     * LA PROPRIA NOTIFICA
     */

    if (attivita.creatore_id) {
      utenti.delete(String(attivita.creatore_id));
    }

    console.log(
      "UTENTI DA NOTIFICARE:",
      Array.from(utenti)
    );

    /*
     * RECUPERIAMO LE SUBSCRIPTION
     */

    let subscriptionTotali = 0;
    let notificheInviate = 0;

    for (const utenteId of utenti) {
      const {
        data: subscriptions,
        error: erroreSubscriptions,
      } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("utente_id", utenteId);

      if (erroreSubscriptions) {
        console.error(
          "ERRORE RECUPERO SUBSCRIPTION:",
          erroreSubscriptions
        );

        continue;
      }

      for (const subscription of subscriptions || []) {
        subscriptionTotali++;

        /*
         * INVIO ALLA FUNZIONE
         * gia esistente "invia-notifiche"
         */

        try {
          const { error: erroreInvio } =
            await supabase.functions.invoke(
              "invia-notifiche",
              {
                body: {
                  endpoint: subscription.endpoint,
                  p256dh: subscription.p256dh,
                  auth: subscription.auth,
                  title: "Nuova attività vicino a te!",
                  body: attivita.luogo
                    ? "\"" +
                      attivita.titolo +
                      "\" - " +
                      attivita.luogo
                    : "\"" +
                      attivita.titolo +
                      "\" è stata appena pubblicata.",
                  url: "/attivita/" + attivita.id,
                  utente_id: utenteId,
                },
              }
            );

          if (erroreInvio) {
            console.error(
              "ERRORE INVIO NOTIFICA:",
              erroreInvio
            );

            continue;
          }

          notificheInviate++;

          console.log(
            "NOTIFICA INVIATA A:",
            utenteId
          );
        } catch (errore) {
          console.error(
            "ERRORE FUNZIONE INVIA-NOTIFICHE:",
            errore
          );
        }
      }
    }

    /*
     * RISULTATO
     */

    console.log(
      "NOTIFICHE INVIATE:",
      notificheInviate
    );

    return risposta({
      ok: true,
      attivita_id: attivita.id,
      titolo: attivita.titolo,
      utenti_da_notificare: utenti.size,
      subscription_totali: subscriptionTotali,
      notifiche_inviate: notificheInviate,
    });
  } catch (errore) {
    console.error(
      "ERRORE FATALE:",
      errore
    );

    return risposta(
      {
        ok: false,
        error: "Errore interno",
        details:
          errore instanceof Error
            ? errore.message
            : String(errore),
      },
      500
    );
  }
});
