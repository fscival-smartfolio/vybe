"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  segnalatoId: string;
};

export default function SegnalaUtente({ segnalatoId }: Props) {
  const supabase = createClient();

  const [aperto, setAperto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [caricamento, setCaricamento] = useState(false);
  const [messaggio, setMessaggio] = useState("");

  async function inviaSegnalazione() {
    setMessaggio("");

    if (!motivo) {
      setMessaggio("Seleziona un motivo.");
      return;
    }

    setCaricamento(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessaggio("Devi effettuare l'accesso.");
        return;
      }

      if (user.id === segnalatoId) {
        setMessaggio("Non puoi segnalare te stesso.");
        return;
      }

      const { error } = await supabase
        .from("segnalazioni")
        .insert({
          segnalatore_id: user.id,
          segnalato_id: segnalatoId,
          motivo,
          descrizione: descrizione.trim() || null,
        });

      if (error) {
        throw error;
      }

      setMotivo("");
      setDescrizione("");
      setMessaggio("Segnalazione inviata. Grazie per la collaborazione.");
    } catch (error: any) {
      console.error(error);

      setMessaggio(
        error?.message ||
          "Non è stato possibile inviare la segnalazione."
      );
    } finally {
      setCaricamento(false);
    }
  }

  if (!aperto) {
    return (
      <button
        onClick={() => setAperto(true)}
        className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
      >
        🚩 Segnala
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-5">

      <h3 className="font-black text-slate-900">
        Segnala questo utente
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        La segnalazione sarà valutata dall'amministratore.
      </p>

      <select
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
      >
        <option value="">Seleziona il motivo</option>
        <option value="Spam">Spam</option>
        <option value="Molestie">Molestie o comportamento offensivo</option>
        <option value="Contenuto inappropriato">
          Contenuto inappropriato
        </option>
        <option value="Profilo falso">Profilo falso</option>
        <option value="Altro">Altro</option>
      </select>

      <textarea
        value={descrizione}
        onChange={(e) => setDescrizione(e.target.value)}
        placeholder="Descrivi brevemente il problema..."
        rows={4}
        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400"
      />

      {messaggio && (
        <div className="mt-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
          {messaggio}
        </div>
      )}

      <div className="mt-4 flex gap-2">

        <button
          onClick={inviaSegnalazione}
          disabled={caricamento}
          className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {caricamento ? "Invio..." : "Invia segnalazione"}
        </button>

        <button
          onClick={() => setAperto(false)}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-600"
        >
          Annulla
        </button>

      </div>
    </div>
  );
}