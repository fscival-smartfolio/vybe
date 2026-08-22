"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type AttivitaArchiviata = {
  id: string;
  creatore_id: string;
  titolo: string;
  descrizione: string | null;
  categoria: string | null;
  luogo: string | null;
  data_ora: string;
  max_partecipanti: number | null;
  numero_partecipanti: number;
  ero_creatore: boolean;
};

function formatData(data: string) {
  const d = new Date(data);
  return d.toLocaleString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Archivio() {
  const [attivita, setAttivita] = useState<AttivitaArchiviata[]>([]);
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    async function carica() {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("attivita_archivio");

      if (!error) setAttivita((data || []) as AttivitaArchiviata[]);
      setCaricamento(false);
    }

    carica();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 pb-16 text-slate-900">
      <header className="border-b bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="text-sm font-bold text-slate-500 hover:text-indigo-600">
            ← Torna alla home
          </Link>
          <h1 className="text-lg font-black text-slate-900">📂 Archivio</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <p className="mb-6 text-sm text-slate-500">
          Le attività concluse a cui hai partecipato o che hai creato. Puoi ancora aprirle per
          confermare le presenze o rivedere i ricordi.
        </p>

        {caricamento ? (
          <p className="text-sm font-bold text-slate-400">Carico...</p>
        ) : attivita.length === 0 ? (
          <div className="rounded-2xl border bg-white p-7 text-center shadow-sm">
            <p className="font-bold text-slate-700">Non hai ancora attività concluse.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {attivita.map((a) => (
              <Link
                key={a.id}
                href={`/attivita/${a.id}`}
                className="block rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-black uppercase tracking-wide text-indigo-600">
                      {a.categoria || "Generale"}
                    </span>
                    <h2 className="mt-0.5 truncate text-lg font-black text-slate-900">
                      {a.titolo}
                    </h2>
                    <p className="mt-1 text-xs font-bold text-slate-400">{formatData(a.data_ora)}</p>
                    {a.luogo && <p className="text-xs text-slate-500">📍 {a.luogo}</p>}
                  </div>

                  {a.ero_creatore && (
                    <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700">
                      Organizzata da te
                    </span>
                  )}
                </div>

                <p className="mt-3 text-xs font-medium text-slate-500">
                  👥 {a.numero_partecipanti}
                  {a.max_partecipanti ? `/${a.max_partecipanti}` : ""} partecipanti
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
