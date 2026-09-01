"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import RegistraVisita from "./components/RegistraVisita";
import InstallPrompt from "./components/InstallPrompt";
import { useLingua } from "./components/LinguaProvider";

type Profilo = {
  id: string;
  nome: string | null;
  cognome: string | null;
  citta: string | null;
  stato: string | null;
};

type Attivita = {
  id: string;
  creatore_id: string;
  titolo: string;
  descrizione: string | null;
  categoria: string | null;
  luogo: string | null;
  data_ora: string;
  max_partecipanti: number | null;
  created_at: string;
  distanza_metri: number;
  numero_partecipanti: number;
};

type Passione = {
  id: number;
  nome: string;
  icona: string | null;
};

type StatoFollow = "nessuno" | "in_attesa" | "accettata";

type Partecipante = {
  utente_id: string;
  nome: string | null;
  cognome: string | null;
  avatar_url: string | null;
  citta: string | null;
  punteggio_affidabilita: number | null;
  stato_follow: StatoFollow;
};

type Posizione = { lat: number; lon: number };

const PAGINA_SIZE = 20;

function formatDistanza(metri: number) {
  if (metri < 1000) return `${Math.round(metri)} m`;
  return `${(metri / 1000).toFixed(1)} km`;
}

function formatDataOraLocale(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatOrarioEvidente(data: string) {
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return data;

  const oggi = new Date();
  const domani = new Date(oggi);
  domani.setDate(oggi.getDate() + 1);

  const ora = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  if (d.toDateString() === oggi.toDateString()) return `Oggi · ${ora}`;
  if (d.toDateString() === domani.toDateString()) return `Domani · ${ora}`;

  return `${d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })} · ${ora}`;
}

export default function Home() {
  const { t } = useLingua();
  const [utente, setUtente] = useState<Profilo | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [passioni, setPassioni] = useState<Passione[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [offsetAttuale, setOffsetAttuale] = useState(0);
  const [fineRisultati, setFineRisultati] = useState(false);
  const [caricandoAltro, setCaricandoAltro] = useState(false);
  const sentinellaRef = useRef<HTMLDivElement | null>(null);
  const [attivita, setAttivita] = useState<Attivita[]>([]);
  const [erroreAttivita, setErroreAttivita] = useState("");
  const [posizioneCache, setPosizioneCache] = useState<Posizione | null>(null);
  const [iscrittoA, setIscrittoA] = useState<Set<string>>(new Set());
  const [menuMobileAperto, setMenuMobileAperto] = useState(false);
  const [partecipantiModale, setPartecipantiModale] = useState<Partecipante[]>([]);
  const [caricandoPartecipanti, setCaricandoPartecipanti] = useState(false);
  const [modaleAttivitaId, setModaleAttivitaId] = useState<string | null>(null);

  // --- Scheda guidata di creazione ---
  const [creazioneAperta, setCreazioneAperta] = useState(false);
  const [categoriaForm, setCategoriaForm] = useState("");
  const [categoriaPersonalizzata, setCategoriaPersonalizzata] = useState(false);
  const [nomeCategoriaCustom, setNomeCategoriaCustom] = useState("");
  const [iconaCategoriaCustom, setIconaCategoriaCustom] = useState("✨");
  const [titoloForm, setTitoloForm] = useState("");
  const [descrizioneForm, setDescrizioneForm] = useState("");
  const [luogoForm, setLuogoForm] = useState("");
  const [quandoForm, setQuandoForm] = useState("");
  const [nessunLimite, setNessunLimite] = useState(false);
  const [maxPartecipantiForm, setMaxPartecipantiForm] = useState(10);
  const [pubblicando, setPubblicando] = useState(false);
  const [erroreComposer, setErroreComposer] = useState("");
  const [suggerimentiLuogo, setSuggerimentiLuogo] = useState<
    { display_name: string; lat: string; lon: string }[]
  >([]);
  const [cercandoLuogo, setCercandoLuogo] = useState(false);
  const [posizioneManuale, setPosizioneManuale] = useState<Posizione | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function caricaUtente(userId: string) {
      const { data: profilo } = await supabase
        .from("profili")
        .select("id, nome, cognome, citta, stato")
        .eq("id", userId)
        .maybeSingle();

      if (profilo) {
        setUtente(profilo);
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUtente({
            id: user.id,
            nome: user.user_metadata?.nome ?? null,
            cognome: user.user_metadata?.cognome ?? null,
            citta: null,
            stato: "attivo",
          });
        }
      }
    }

    async function caricaPassioni() {
      const { data } = await supabase
        .from("passioni")
        .select("id, nome, icona")
        .order("nome");

      if (data && data.length > 0) {
        setPassioni(data as Passione[]);
      }
    }

    async function inizializza() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await caricaPassioni();

      if (session?.user) {
        await caricaUtente(session.user.id);
      } else {
        setUtente(null);
      }

      setCaricamento(false);
    }

    inizializza();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await caricaUtente(session.user.id);
      } else {
        setUtente(null);
      }

      setCaricamento(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const feedGiaCaricatoAutomaticamente = useRef(false);

  useEffect(() => {
    if (utente && !feedGiaCaricatoAutomaticamente.current) {
      feedGiaCaricatoAutomaticamente.current = true;
      trovaAttivitaVicino(true);
    }
  }, [utente]);

  function ottieniPosizione(): Promise<Posizione> {
    if (posizioneCache) return Promise.resolve(posizioneCache);

    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("La geolocalizzazione non è disponibile."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setPosizioneCache(p);
          resolve(p);
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });
  }

  async function trovaAttivitaVicino(reset: boolean = true) {
    if (!utente) {
      window.location.href = "/accesso";
      return;
    }

    const offset = reset ? 0 : offsetAttuale;

    if (reset) {
      setErroreAttivita("");
      setFineRisultati(false);
    } else {
      setCaricandoAltro(true);
    }

    try {
      const { lat, lon } = await ottieniPosizione();
      const supabase = createClient();

      const { data, error } = await supabase.rpc("attivita_vicine", {
        lat,
        lon,
        raggio_metri: 50000,
        p_limit: PAGINA_SIZE,
        p_offset: offset,
      });

      if (error) throw error;

      const risultati = (data || []) as Attivita[];
      const listaCompleta = reset ? risultati : [...attivita, ...risultati];

      setAttivita(listaCompleta);
      setOffsetAttuale(offset + risultati.length);
      setFineRisultati(risultati.length < PAGINA_SIZE);

      if (reset && risultati.length === 0) {
        setErroreAttivita("Non ci sono ancora attività nella tua zona. Sii il primo a crearne una!");
      } else if (listaCompleta.length > 0) {
        const ids = listaCompleta.map((r) => r.id);
        const { data: mie } = await supabase
          .from("partecipazioni")
          .select("attivita_id")
          .eq("utente_id", utente.id)
          .in("attivita_id", ids);

        setIscrittoA(new Set((mie || []).map((r: any) => r.attivita_id)));
      }
    } catch (err: any) {
      console.error("ERRORE RICERCA ATTIVITÀ:", err);
      setErroreAttivita(err?.message || "Non è stato possibile trovare le attività.");
    } finally {
      setCaricandoAltro(false);
    }
  }

  async function invitaAmici() {
    const testo = "Ehi! Sto usando Vybe per trovare persone con cui fare attività vicino a me. Unisciti anche tu 👇";
    const url = window.location.origin;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Vybe", text: testo, url });
        return;
      } catch (err) {
        return;
      }
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(`${testo} ${url}`)}`, "_blank");
  }

  function apriCreazione() {
    if (!utente) {
      window.location.href = "/accesso";
      return;
    }

    setCategoriaForm(passioni[0]?.nome || "");
    setCategoriaPersonalizzata(false);
    setNomeCategoriaCustom("");
    setTitoloForm("");
    setDescrizioneForm("");
    setLuogoForm("");
    setPosizioneManuale(null);
    setSuggerimentiLuogo([]);
    setQuandoForm(formatDataOraLocale(new Date()));
    setNessunLimite(false);
    setMaxPartecipantiForm(10);
    setErroreComposer("");
    setCreazioneAperta(true);
  }

  async function alternaPartecipazione(a: Attivita) {
    if (!utente) {
      window.location.href = "/accesso";
      return;
    }

    const giaIscritto = iscrittoA.has(a.id);

    try {
      const supabase = createClient();

      if (giaIscritto) {
        const { data, error } = await supabase
          .rpc("abbandona_attivita", { p_attivita_id: a.id })
          .single();

        if (error) throw error;
        const risultato = data as { numero_partecipanti: number };

        setIscrittoA((prev) => {
          const s = new Set(prev);
          s.delete(a.id);
          return s;
        });

        setAttivita((prev) =>
          prev.map((x) => (x.id === a.id ? { ...x, numero_partecipanti: risultato.numero_partecipanti } : x))
        );
      } else {
        const { data, error } = await supabase
          .rpc("unisciti_attivita", { p_attivita_id: a.id })
          .single();

        if (error) throw error;
        const risultato = data as { numero_partecipanti: number };

        setIscrittoA((prev) => new Set(prev).add(a.id));
        setAttivita((prev) =>
          prev.map((x) => (x.id === a.id ? { ...x, numero_partecipanti: risultato.numero_partecipanti } : x))
        );
      }
    } catch (err: any) {
      console.error("ERRORE PARTECIPAZIONE:", err);
      alert(err?.message || "Operazione non riuscita.");
    }
  }

  async function apriPartecipanti(attivitaId: string) {
    setModaleAttivitaId(attivitaId);
    setCaricandoPartecipanti(true);
    setPartecipantiModale([]);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("partecipanti_attivita", {
        p_attivita_id: attivitaId,
      });

      if (error) throw error;
      setPartecipantiModale((data || []) as Partecipante[]);
    } catch (err) {
      console.error("ERRORE PARTECIPANTI:", err);
    } finally {
      setCaricandoPartecipanti(false);
    }
  }

  const attivitaVisibili = filtroCategoria
    ? attivita.filter((a) => a.categoria === filtroCategoria)
    : attivita;

  function iconaCategoria(categoria: string | null) {
    const trovata = passioni.find((p) => p.nome === categoria);
    return trovata?.icona || "📅";
  }

  if (caricamento) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <p className="bg-gradient-to-r from-indigo-600 to-teal-500 bg-clip-text text-3xl font-black tracking-tight text-transparent">
          Vybe
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/">
            <h1 className="bg-gradient-to-r from-indigo-600 to-teal-500 bg-clip-text text-2xl font-black tracking-tight text-transparent">
              Vybe
            </h1>
            <p className="text-xs text-slate-500">{t("tagline")}</p>
          </Link>

          {/* SEZIONE DESTRA HEADER */}
          <div className="flex items-center gap-3">
            {utente ? (
              <>
                <Link
                  href="/profilo"
                  className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300"
                >
                  <span>👤</span>
                  <span>{utente.nome || "Profilo"}</span>
                </Link>
                
                {/* Pulsante Hamburger ☰ */}
                <button
                  onClick={() => setMenuMobileAperto(!menuMobileAperto)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-slate-700 shadow-sm hover:bg-slate-50 md:hidden"
                  aria-label="Menu"
                >
                  ☰
                </button>
              </>
            ) : (
              <Link
                href="/accesso"
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-sm"
              >
                Accedi
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Menu Mobile a tendina */}
      {menuMobileAperto && (
        <div className="border-b bg-white px-6 py-4 shadow-md md:hidden">
          <div className="flex flex-col gap-3">
            <Link
              href="/archivio"
              onClick={() => setMenuMobileAperto(false)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-700 py-1 hover:text-indigo-600"
            >
              📦 Archivio
            </Link>
            <Link
              href="/ricordi"
              onClick={() => setMenuMobileAperto(false)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-700 py-1 hover:text-indigo-600"
            >
              📸 Ricordi
            </Link>
            <button
              onClick={() => { setMenuMobileAperto(false); invitaAmici(); }}
              className="flex items-center gap-2 text-sm font-semibold text-slate-700 py-1 text-left hover:text-indigo-600"
            >
              📤 Invita amici
            </button>
          </div>
        </div>
      )}

      {/* CONTENUTO PRINCIPALE */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">Attività nella tua zona</h2>
            <button
              onClick={() => apriCreazione()}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-sm"
            >
              + Crea attività
            </button>
          </div>

          {erroreAttivita && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
              {erroreAttivita}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {attivitaVisibili.map((a) => (
              <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                      {iconaCategoria(a.categoria)} {a.categoria}
                    </span>
                    <span className="text-xs text-slate-400">{formatDistanza(a.distanza_metri)}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-800 mb-1">{a.titolo}</h3>
                  <p className="text-xs text-slate-500 mb-4">{a.luogo || "Luogo non specificato"}</p>
                  <p className="text-xs font-medium text-slate-600 mb-4">📅 {formatOrarioEvidente(a.data_ora)}</p>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button
                    onClick={() => apriPartecipanti(a.id)}
                    className="text-xs font-semibold text-slate-600 hover:text-indigo-600"
                  >
                    👥 {a.numero_partecipanti} partecipanti
                  </button>
                  <button
                    onClick={() => alternaPartecipazione(a)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                      iscrittoA.has(a.id)
                        ? "bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                    }`}
                  >
                    {iscrittoA.has(a.id) ? "Annulla" : "Partecipa"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div ref={sentinellaRef} className="h-10" />
        </div>
      </div>
    </main>
  );
}