"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Attivita = {
  id: string;
  creatore_id: string;
  titolo: string;
  descrizione: string | null;
  categoria: string | null;
  luogo: string | null;
  data_ora: string;
  max_partecipanti: number | null;
};

type Partecipante = {
  utente_id: string;
  nome: string | null;
  cognome: string | null;
  avatar_url: string | null;
  citta: string | null;
  stato_presenza: string;
  punteggio_affidabilita: number | null;
};

function coloreScore(punteggio: number | null) {
  if (punteggio == null) return "bg-slate-100 text-slate-500";
  if (punteggio >= 90) return "bg-teal-100 text-teal-700";
  if (punteggio >= 70) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

type Ricordo = {
  id: string;
  utente_id: string;
  url: string;
  didascalia: string | null;
  creato_il: string;
  nome: string | null;
  avatar_url: string | null;
};

export default function DettaglioAttivita() {
  const params = useParams();
  const id = params?.id as string;

  const [utenteId, setUtenteId] = useState<string | null>(null);
  const [attivita, setAttivita] = useState<Attivita | null>(null);
  const [partecipanti, setPartecipanti] = useState<Partecipante[]>([]);
  const [ricordi, setRicordi] = useState<Ricordo[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [puoVedereRicordi, setPuoVedereRicordi] = useState(false);

  const [didascalia, setDidascalia] = useState("");
  const [fileRicordo, setFileRicordo] = useState<File | null>(null);
  const [caricandoRicordo, setCaricandoRicordo] = useState(false);
  const [erroreRicordo, setErroreRicordo] = useState("");

  useEffect(() => {
    if (!id) return;

    async function carica() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUtenteId(user?.id || null);

      const { data: att } = await supabase
        .from("attivita")
        .select("id, creatore_id, titolo, descrizione, categoria, luogo, data_ora, max_partecipanti")
        .eq("id", id)
        .maybeSingle();

      setAttivita(att as Attivita | null);

      const { data: parts } = await supabase.rpc("partecipanti_attivita", {
        p_attivita_id: id,
      });

      setPartecipanti((parts || []) as Partecipante[]);

      if (user && (parts || []).some((p: Partecipante) => p.utente_id === user.id)) {
        setPuoVedereRicordi(true);

        const { data: ric } = await supabase.rpc("ricordi_attivita", {
          p_attivita_id: id,
        });

        setRicordi((ric || []) as Ricordo[]);
      }

      setCaricamento(false);
    }

    carica();
  }, [id]);

  async function confermaPresenza(partecipanteId: string) {
    const supabase = createClient();

    const { error } = await supabase.rpc("conferma_presenza", {
      p_attivita_id: id,
      p_utente_id: partecipanteId,
    });

    if (error) {
      alert(error.message || "Non è stato possibile confermare la presenza.");
      return;
    }

    setPartecipanti((prev) =>
      prev.map((p) => (p.utente_id === partecipanteId ? { ...p, stato_presenza: "presente" } : p))
    );
  }

  async function caricaRicordo() {
    setErroreRicordo("");

    if (!fileRicordo || !utenteId) {
      setErroreRicordo("Scegli una foto da caricare.");
      return;
    }

    setCaricandoRicordo(true);

    try {
      const supabase = createClient();
      const percorso = `${utenteId}/${Date.now()}-${fileRicordo.name}`;

      const { error: erroreUpload } = await supabase.storage
        .from("ricordi")
        .upload(percorso, fileRicordo);

      if (erroreUpload) throw erroreUpload;

      const {
        data: { publicUrl },
      } = supabase.storage.from("ricordi").getPublicUrl(percorso);

      const { error: erroreRpc } = await supabase.rpc("aggiungi_ricordo", {
        p_attivita_id: id,
        p_url: publicUrl,
        p_didascalia: didascalia.trim() || null,
      });

      if (erroreRpc) throw erroreRpc;

      const { data: ric } = await supabase.rpc("ricordi_attivita", { p_attivita_id: id });
      setRicordi((ric || []) as Ricordo[]);

      setFileRicordo(null);
      setDidascalia("");
    } catch (err: any) {
      console.error("ERRORE RICORDO:", err);
      setErroreRicordo(err?.message || "Non è stato possibile caricare la foto.");
    } finally {
      setCaricandoRicordo(false);
    }
  }

  if (caricamento) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-bold text-slate-500">Caricamento...</p>
      </main>
    );
  }

  if (!attivita) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <p className="font-bold text-slate-700">Attività non trovata.</p>
        <Link href="/" className="text-sm font-bold text-indigo-600 underline">
          Torna alla home
        </Link>
      </main>
    );
  }

  const eCreatore = utenteId === attivita.creatore_id;
  const dataFormattata = new Date(attivita.data_ora).toLocaleString("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="min-h-screen bg-slate-50 pb-20 text-slate-900">
      <header className="border-b bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="text-sm font-bold text-slate-500 hover:text-indigo-600">
            ← Torna alla home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* DETTAGLIO ATTIVITÀ */}
        <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <span className="text-xs font-black uppercase tracking-wide text-indigo-600">
            {attivita.categoria || "Generale"}
          </span>
          <h1 className="mt-1 text-2xl font-black text-slate-900">{attivita.titolo}</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">🕐 {dataFormattata}</p>
          {attivita.luogo && <p className="mt-1 text-sm text-slate-500">📍 {attivita.luogo}</p>}
          {attivita.descrizione && (
            <p className="mt-4 text-sm leading-relaxed text-slate-600">{attivita.descrizione}</p>
          )}
        </section>

        {/* PARTECIPANTI */}
        <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h2 className="mb-1 text-lg font-black text-slate-900">
            👥 Partecipanti ({partecipanti.length}
            {attivita.max_partecipanti ? `/${attivita.max_partecipanti}` : ""})
          </h2>

          {eCreatore && (
            <p className="mb-4 text-xs text-slate-400">
              Sei l&apos;organizzatore: dopo l&apos;evento conferma chi si è davvero presentato.
            </p>
          )}

          <ul className="space-y-3">
            {partecipanti.map((p) => (
              <li key={p.utente_id} className="flex items-center gap-3">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-teal-500 text-sm font-black text-white">
                    {(p.nome?.[0] || "?").toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {[p.nome, p.cognome].filter(Boolean).join(" ") || "Utente Vybe"}
                  </p>
                  {p.citta && <p className="text-xs text-slate-500">{p.citta}</p>}
                </div>

                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${coloreScore(p.punteggio_affidabilita)}`}
                  title="Punteggio di affidabilità"
                >
                  ⭐ {p.punteggio_affidabilita ?? "—"}
                </span>

                {p.stato_presenza === "presente" ? (
                  <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-black text-teal-700">
                    ✅ Presente
                  </span>
                ) : eCreatore ? (
                  <button
                    onClick={() => confermaPresenza(p.utente_id)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
                  >
                    Conferma presenza
                  </button>
                ) : (
                  <span className="text-xs font-medium text-slate-400">In attesa</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* IL RICORDO DEL JOIN */}
        {puoVedereRicordi && (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-1 text-lg font-black text-slate-900">📸 Il Ricordo del Join</h2>
            <p className="mb-5 text-sm text-slate-500">
              Visibile solo a chi ha partecipato a questa attività.
            </p>

            <div className="mb-6 rounded-2xl bg-slate-50 p-4">
              <label
                htmlFor="foto-ricordo"
                className="mb-2 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white transition hover:bg-slate-700"
              >
                📷 {fileRicordo ? "Cambia foto" : "Scegli una foto"}
              </label>

              <input
                id="foto-ricordo"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setFileRicordo(f);
                  setErroreRicordo("");
                }}
                className="hidden"
              />

              {fileRicordo && (
                <p className="mb-3 mt-2 text-xs font-bold text-teal-700">
                  ✓ Foto scelta: {fileRicordo.name}
                </p>
              )}

              <input
                value={didascalia}
                onChange={(e) => setDidascalia(e.target.value)}
                placeholder="Aggiungi una didascalia (facoltativo)"
                className="mb-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />

              <button
                onClick={caricaRicordo}
                disabled={caricandoRicordo}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-teal-500 px-5 py-2.5 text-sm font-black text-white transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                {caricandoRicordo ? "Carico..." : "Aggiungi al ricordo"}
              </button>

              {erroreRicordo && (
                <p className="mt-2 text-sm font-bold text-red-600">{erroreRicordo}</p>
              )}
            </div>

            {ricordi.length === 0 ? (
              <p className="text-sm text-slate-400">Nessuna foto ancora. Sii il primo a caricarla!</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ricordi.map((r) => (
                  <figure key={r.id} className="overflow-hidden rounded-2xl bg-slate-100">
                    <img src={r.url} alt={r.didascalia || ""} className="aspect-square w-full object-cover" />
                    <figcaption className="p-2 text-xs text-slate-500">
                      {r.didascalia && <p className="mb-0.5 font-medium text-slate-700">{r.didascalia}</p>}
                      {r.nome}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
