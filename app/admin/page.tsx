"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const ADMIN_ID = "ffe0dab2-cb25-48de-a401-f2b7946619b0";

type Profilo = {
  id: string;
  nome: string | null;
  cognome: string | null;
  citta: string | null;
  stato: string | null;
  ultimo_accesso: string | null;
};

type Segnalazione = {
  id: string;
  segnalatore_id: string;
  segnalato_id: string;
  motivo: string;
  descrizione: string | null;
  stato: string;
  creato_il: string;
};
type StatisticaVisita = {
  giorno: string;
  visite: number;
};

export default function AdminPage() {
  const supabase = createClient();

  const [utenti, setUtenti] = useState<Profilo[]>([]);
  const [segnalazioni, setSegnalazioni] = useState<Segnalazione[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [autorizzato, setAutorizzato] = useState(false);
  const [visiteTotali, setVisiteTotali] = useState(0);
  const [statisticheVisite, setStatisticheVisite] = useState<
  StatisticaVisita[]
>([]);
const [visiteOggi, setVisiteOggi] = useState(0);

  async function caricaDati() {
    setCaricamento(true);
    setErrore("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/accesso";
        return;
      }

      // CONTROLLO AMMINISTRATORE
      if (user.id !== ADMIN_ID) {
        setErrore("Accesso negato. Questa area è riservata all'amministratore.");
        setAutorizzato(false);
        return;
      }

      setAutorizzato(true);

      const { data: profili, error: profiliError } = await supabase
        .from("profili")
        .select(
          "id, nome, cognome, citta, stato, ultimo_accesso"
        )
        .order("nome", { ascending: true });

      if (profiliError) {
        throw profiliError;
      }

      const { data: report, error: reportError } = await supabase
        .from("segnalazioni")
        .select("*")
        .order("creato_il", { ascending: false });

      if (reportError) {
        throw reportError;
      }
setUtenti(profili || []);
setSegnalazioni(report || []);

// STATISTICHE VISITE
const { count: totaleVisite, error: visiteError } = await supabase
  .from("visite")
  .select("*", { count: "exact", head: true });

if (visiteError) {
  throw visiteError;
}

const inizioOggi = new Date();
inizioOggi.setHours(0, 0, 0, 0);

const { count: totaleVisiteOggi, error: visiteOggiError } =
  await supabase
    .from("visite")
    .select("*", { count: "exact", head: true })
    .gte("creato_il", inizioOggi.toISOString());

if (visiteOggiError) {
  throw visiteOggiError;
}

setVisiteTotali(totaleVisite || 0);
setVisiteOggi(totaleVisiteOggi || 0);
// VISITE ULTIMI 7 GIORNI
const setteGiorniFa = new Date();
setteGiorniFa.setHours(0, 0, 0, 0);
setteGiorniFa.setDate(setteGiorniFa.getDate() - 6);

const { data: visiteSetteGiorni, error: statisticheError } =
  await supabase
    .from("visite")
    .select("creato_il")
    .gte("creato_il", setteGiorniFa.toISOString())
    .order("creato_il", { ascending: true });

if (statisticheError) {
  throw statisticheError;
}

const giorni: StatisticaVisita[] = [];

for (let i = 0; i < 7; i++) {
  const giorno = new Date(setteGiorniFa);
  giorno.setDate(setteGiorniFa.getDate() + i);

  const chiave = giorno.toISOString().slice(0, 10);

  const numeroVisite = (visiteSetteGiorni || []).filter((visita) => {
    return visita.creato_il.slice(0, 10) === chiave;
  }).length;

  giorni.push({
    giorno: giorno.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
    }),
    visite: numeroVisite,
  });
}

setStatisticheVisite(giorni);
    } catch (err: any) {
      console.error(err);

      setErrore(
        err?.message || "Errore durante il caricamento dei dati."
      );
    } finally {
      setCaricamento(false);
    }
  }

  useEffect(() => {
    caricaDati();
  }, []);

  async function cambiaStato(
    id: string,
    nuovoStato: "attivo" | "sospeso" | "bannato"
  ) {
    const conferma = window.confirm(
      `Vuoi impostare questo utente come "${nuovoStato}"?`
    );

    if (!conferma) return;

    const { error } = await supabase
      .from("profili")
      .update({
        stato: nuovoStato,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await caricaDati();
  }

  async function aggiornaSegnalazione(
    id: string,
    stato: "in_revisione" | "risolta" | "rifiutata"
  ) {
    const { error } = await supabase
      .from("segnalazioni")
      .update({
        stato,
        gestito_il: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await caricaDati();
  }

  const utentiAttivi = utenti.filter(
    (u) => u.stato === "attivo"
  ).length;

  const utentiSospesi = utenti.filter(
    (u) => u.stato === "sospeso"
  ).length;

  const utentiBannati = utenti.filter(
    (u) => u.stato === "bannato"
  ).length;

  const segnalazioniNuove = segnalazioni.filter(
    (s) => s.stato === "nuova"
  ).length;

  if (caricamento) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-slate-500">
            Caricamento pannello amministratore...
          </p>
        </div>
      </main>
    );
  }

  if (!autorizzato) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">

          <div className="text-5xl">
            🔒
          </div>

          <h1 className="mt-5 text-2xl font-black text-slate-900">
            Accesso negato
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Questa area è riservata all'amministratore di Vybe.
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700"
          >
            Torna a Vybe
          </Link>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">

      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <div>
            <Link
              href="/"
              className="bg-gradient-to-r from-indigo-600 to-teal-500 bg-clip-text text-3xl font-black tracking-tight text-transparent"
            >
              Vybe
            </Link>

            <p className="mt-1 text-sm text-slate-500">
              Pannello amministratore
            </p>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-600"
          >
            ← Torna a Vybe
          </Link>

        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* ERRORE */}
        {errore && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {errore}
          </div>
        )}

        {/* STATISTICHE */}
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-bold text-slate-500">
              👥 Utenti totali
            </p>

            <p className="mt-2 text-4xl font-black text-slate-900">
              {utenti.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-bold text-slate-500">
              🟢 Utenti attivi
            </p>

            <p className="mt-2 text-4xl font-black text-green-600">
              {utentiAttivi}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-bold text-slate-500">
              ⛔ Utenti sospesi
            </p>

            <p className="mt-2 text-4xl font-black text-orange-500">
              {utentiSospesi}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-bold text-slate-500">
              🚨 Segnalazioni nuove
            </p>

            <p className="mt-2 text-4xl font-black text-red-600">
              {segnalazioniNuove}
            </p>
          </div>

        </section>
        {/* STATISTICHE VISITE */}
<section className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
    <p className="text-sm font-bold text-slate-500">
      👁️ Visite totali
    </p>

    <p className="mt-2 text-4xl font-black text-indigo-600">
      {visiteTotali}
    </p>

    <p className="mt-1 text-xs text-slate-400">
      Tutte le visite registrate
    </p>
  </div>

  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
    <p className="text-sm font-bold text-slate-500">
      📅 Visite oggi
    </p>

    <p className="mt-2 text-4xl font-black text-blue-600">
      {visiteOggi}
    </p>

    <p className="mt-1 text-xs text-slate-400">
      Dalla mezzanotte di oggi
    </p>
  </div>

  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
    <p className="text-sm font-bold text-slate-500">
      📊 Registrazioni
    </p>

    <p className="mt-2 text-4xl font-black text-green-600">
      {utenti.length}
    </p>

    <p className="mt-1 text-xs text-slate-400">
      Utenti presenti su Vybe
    </p>
  </div>

</section>
{/* GRAFICO VISITE */}
<section className="mt-8">
  <div className="mb-4">
    <h2 className="text-2xl font-black text-slate-900">
      📈 Andamento visite
    </h2>

    <p className="text-sm text-slate-500">
      Visite registrate negli ultimi 7 giorni.
    </p>
  </div>

  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={statisticheVisite}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="giorno" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar
            dataKey="visite"
            name="Visite"
            fill="#4f46e5"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
</section>

        {/* UTENTI */}
        <section className="mt-8">

          <div className="mb-4">
            <h2 className="text-2xl font-black text-slate-900">
              Gestione utenti
            </h2>

            <p className="text-sm text-slate-500">
              Controlla e modera gli utenti di Vybe.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

            <div className="overflow-x-auto">

              <table className="w-full text-left text-sm">

                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 font-bold">
                      Utente
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Città
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Stato
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Azioni
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {utenti.map((utente) => (

                    <tr
                      key={utente.id}
                      className="border-b border-slate-100 last:border-0"
                    >

                      <td className="px-5 py-4">

                        <div className="font-bold text-slate-900">
                          {utente.nome || "Utente"}{" "}
                          {utente.cognome || ""}
                        </div>

                        <div className="text-xs text-slate-400">
                          {utente.id}
                        </div>

                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {utente.citta || "—"}
                      </td>

                      <td className="px-5 py-4">

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            utente.stato === "bannato"
                              ? "bg-red-100 text-red-700"
                              : utente.stato === "sospeso"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {utente.stato || "attivo"}
                        </span>

                      </td>

                      <td className="px-5 py-4">

                        <div className="flex flex-wrap gap-2">

                          {utente.stato !== "attivo" && (
                            <button
                              onClick={() =>
                                cambiaStato(
                                  utente.id,
                                  "attivo"
                                )
                              }
                              className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700"
                            >
                              Riattiva
                            </button>
                          )}

                          {utente.stato !== "sospeso" && (
                            <button
                              onClick={() =>
                                cambiaStato(
                                  utente.id,
                                  "sospeso"
                                )
                              }
                              className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white hover:bg-orange-600"
                            >
                              Sospendi
                            </button>
                          )}

                          {utente.stato !== "bannato" && (
                            <button
                              onClick={() =>
                                cambiaStato(
                                  utente.id,
                                  "bannato"
                                )
                              }
                              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                            >
                              Banna
                            </button>
                          )}

                        </div>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>

        </section>

        {/* SEGNALAZIONI */}
        <section className="mt-10">

          <div className="mb-4">
            <h2 className="text-2xl font-black text-slate-900">
              🚨 Segnalazioni
            </h2>

            <p className="text-sm text-slate-500">
              Controlla le segnalazioni inviate dagli utenti.
            </p>
          </div>

          <div className="space-y-4">

            {segnalazioni.length === 0 ? (

              <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
                Nessuna segnalazione presente.
              </div>

            ) : (

              segnalazioni.map((segnalazione) => (

                <div
                  key={segnalazione.id}
                  className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                >

                  <div className="flex flex-wrap items-start justify-between gap-4">

                    <div>

                      <p className="font-black text-slate-900">
                        {segnalazione.motivo}
                      </p>

                      {segnalazione.descrizione && (
                        <p className="mt-2 text-sm text-slate-600">
                          {segnalazione.descrizione}
                        </p>
                      )}

                      <p className="mt-3 text-xs text-slate-400">
                        {new Date(
                          segnalazione.creato_il
                        ).toLocaleString("it-IT")}
                      </p>

                    </div>

                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
                      {segnalazione.stato}
                    </span>

                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">

                    <button
                      onClick={() =>
                        aggiornaSegnalazione(
                          segnalazione.id,
                          "in_revisione"
                        )
                      }
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      In revisione
                    </button>

                    <button
                      onClick={() =>
                        aggiornaSegnalazione(
                          segnalazione.id,
                          "risolta"
                        )
                      }
                      className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700"
                    >
                      Risolta
                    </button>

                    <button
                      onClick={() =>
                        aggiornaSegnalazione(
                          segnalazione.id,
                          "rifiutata"
                        )
                      }
                      className="rounded-lg bg-slate-600 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700"
                    >
                      Rifiuta
                    </button>

                  </div>

                </div>

              ))

            )}

          </div>

        </section>

      </div>

    </main>
  );
}
