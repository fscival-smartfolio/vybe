"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import RegistraVisita from "./components/RegistraVisita";
import InstallPrompt from "./components/InstallPrompt";
import { abilitaNotifichePush, disabilitaNotifichePush, statoNotifichePush } from "@/lib/push";
import { useLingua } from "./components/LinguaProvider";
import SelettoreLingua from "./components/SelettoreLingua";

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

type RichiestaAmicizia = {
  utente_id: string;
  nome: string | null;
  cognome: string | null;
  avatar_url: string | null;
  citta: string | null;
  punteggio_affidabilita: number | null;
  richiesto_il: string;
};

function coloreScore(punteggio: number | null) {
  if (punteggio == null) return "bg-slate-100 text-slate-500";
  if (punteggio >= 90) return "bg-teal-100 text-teal-700";
  if (punteggio >= 70) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

type Amico = Partecipante & { numero_attivita_aperte: number };

type Posizione = { lat: number; lon: number };

const PAGINA_SIZE = 20;

const PALETTE_CATEGORIE = [
  { bg: "bg-fuchsia-500", text: "text-fuchsia-600" },
  { bg: "bg-orange-500", text: "text-orange-600" },
  { bg: "bg-emerald-500", text: "text-emerald-600" },
  { bg: "bg-sky-500", text: "text-sky-600" },
  { bg: "bg-violet-500", text: "text-violet-600" },
  { bg: "bg-rose-500", text: "text-rose-600" },
];

function coloreCategoria(nome: string | null) {
  if (!nome) return PALETTE_CATEGORIE[0];
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE_CATEGORIE[Math.abs(hash) % PALETTE_CATEGORIE.length];
}

function formatData(data: string) {
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return data;

  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

function statoTempo(data: string, adesso: Date) {
  const target = new Date(data).getTime();
  const diffMs = target - adesso.getTime();

  if (diffMs <= 0) {
    return { testo: "🔴 In corso", classe: "bg-rose-100 text-rose-700" };
  }

  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 60) {
    return { testo: `⏳ tra ${diffMin} min`, classe: "bg-orange-100 text-orange-700" };
  }

  const ore = Math.floor(diffMin / 60);
  const minResto = diffMin % 60;

  if (ore < 24) {
    return { testo: `⏳ tra ${ore}h ${minResto}min`, classe: "bg-indigo-100 text-indigo-700" };
  }

  const giorni = Math.floor(ore / 24);
  const oreResto = ore % 24;

  return { testo: `⏳ tra ${giorni}g ${oreResto}h`, classe: "bg-slate-100 text-slate-600" };
}

export default function Home() {
  const { t } = useLingua();
  const [numeroUtenti, setNumeroUtenti] = useState<number | null>(null);

  const [utente, setUtente] = useState<Profilo | null>(null);
  const [caricamento, setCaricamento] = useState(true);

  const [passioni, setPassioni] = useState<Passione[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);

  const [ricerca, setRicerca] = useState(false);
  const [ricercaSeguiti, setRicercaSeguiti] = useState(false);
  const [mostraCategorieRicerca, setMostraCategorieRicerca] = useState(false);
  const [modalitaCorrente, setModalitaCorrente] = useState<"vicino" | "seguiti" | null>(null);
  const [offsetAttuale, setOffsetAttuale] = useState(0);
  const [fineRisultati, setFineRisultati] = useState(false);
  const [caricandoAltro, setCaricandoAltro] = useState(false);
  const sentinellaRef = useRef<HTMLDivElement | null>(null);
  const [attivita, setAttivita] = useState<Attivita[]>([]);
  const [erroreAttivita, setErroreAttivita] = useState("");
  const [posizioneCache, setPosizioneCache] = useState<Posizione | null>(null);
  const [iscrittoA, setIscrittoA] = useState<Set<string>>(new Set());

  const [oraCorrente, setOraCorrente] = useState(() => new Date());
  const [modaleAttivitaId, setModaleAttivitaId] = useState<string | null>(null);
  const [ricercaPersoneAperta, setRicercaPersoneAperta] = useState(false);
  const [queryPersone, setQueryPersone] = useState("");
  const [risultatiPersone, setRisultatiPersone] = useState<Partecipante[]>([]);
  const [cercandoPersone, setCercandoPersone] = useState(false);
  const [amiciAperti, setAmiciAperti] = useState(false);
  const [menuMobileAperto, setMenuMobileAperto] = useState(false);
  const [richiesteAperte, setRichiesteAperte] = useState(false);
  const [listaRichieste, setListaRichieste] = useState<RichiestaAmicizia[]>([]);
  const [caricandoRichieste, setCaricandoRichieste] = useState(false);
  const [numeroRichieste, setNumeroRichieste] = useState(0);
  const [notificheAttive, setNotificheAttive] = useState(false);
  const [attivandoNotifiche, setAttivandoNotifiche] = useState(false);
  const [listaAmici, setListaAmici] = useState<Amico[]>([]);
  const [caricandoAmici, setCaricandoAmici] = useState(false);
  const [messaggioNotifiche, setMessaggioNotifiche] = useState("");
  const [partecipantiModale, setPartecipantiModale] = useState<Partecipante[]>([]);
  const [caricandoPartecipanti, setCaricandoPartecipanti] = useState(false);

  // --- Scheda guidata di creazione ---
  const [creazioneAperta, setCreazioneAperta] = useState(false);
  const [categoriaForm, setCategoriaForm] = useState("");
  const [selezionandoCategoria, setSelezionandoCategoria] = useState(false);
  const [categoriaPersonalizzata, setCategoriaPersonalizzata] = useState(false);
  const [nomeCategoriaCustom, setNomeCategoriaCustom] = useState("");
  const [iconaCategoriaCustom, setIconaCategoriaCustom] = useState("✨");

  const EMOJI_CUSTOM = [
    "✨", "☕", "🍕", "🍺", "🍷", "🍔", "🥗", "🍰",
    "🛍️", "🎨", "📚", "🎬", "🎮", "🎲", "🎤", "🎵",
    "🐾", "🌿", "🏕️", "🚴", "🏊", "🧗", "⛷️", "🎣",
    "🧘", "🏋️", "🎓", "🛠️", "🚗", "✈️", "📷", "💻",
  ];
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

    async function caricaContatoreUtenti() {
      const { data } = await supabase.rpc("numero_utenti_attivi");
      if (typeof data === "number") setNumeroUtenti(data);
    }

    async function inizializza() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await Promise.all([caricaPassioni(), caricaContatoreUtenti()]);

      if (session?.user) {
        await caricaUtente(session.user.id);

        statoNotifichePush().then(setNotificheAttive);

        supabase
          .rpc("numero_richieste_in_attesa")
          .then((risposta: { data: number | null }) => setNumeroRichieste(risposta.data || 0));
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

  useEffect(() => {
    const id = setInterval(() => setOraCorrente(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const feedGiaCaricatoAutomaticamente = useRef(false);

  useEffect(() => {
    if (utente && !feedGiaCaricatoAutomaticamente.current) {
      feedGiaCaricatoAutomaticamente.current = true;
      trovaAttivitaVicino(true);
    }
  }, [utente]);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUtente(null);
    window.location.href = "/";
  }

  function ottieniPosizione(): Promise<Posizione> {
    if (posizioneCache) return Promise.resolve(posizioneCache);

    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("La geolocalizzazione non è disponibile su questo dispositivo."));
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
      setRicerca(true);
      setModalitaCorrente("vicino");
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
        setErroreAttivita(
          "Non ci sono ancora attività nella tua zona. Sii il primo a crearne una!"
        );
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

      if (err?.code === 1) {
        setErroreAttivita(
          "Per trovare le attività vicino a te devi consentire l'accesso alla posizione."
        );
      } else {
        setErroreAttivita(
          err?.message || "Non è stato possibile trovare le attività vicino a te."
        );
      }
    } finally {
      if (reset) setRicerca(false);
      else setCaricandoAltro(false);
    }
  }

  async function trovaAttivitaSeguiti(reset: boolean = true) {
    if (!utente) {
      window.location.href = "/accesso";
      return;
    }

    const offset = reset ? 0 : offsetAttuale;

    if (reset) {
      setErroreAttivita("");
      setRicercaSeguiti(true);
      setModalitaCorrente("seguiti");
      setFineRisultati(false);
    } else {
      setCaricandoAltro(true);
    }

    try {
      const { lat, lon } = await ottieniPosizione();
      const supabase = createClient();

      const { data, error } = await supabase.rpc("attivita_seguiti", {
        lat,
        lon,
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
        setErroreAttivita(
          "Non segui ancora nessuno con attività in programma. Scopri persone da seguire, o pubblica tu la prima!"
        );
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
      console.error("ERRORE RICERCA SEGUITI:", err);
      setErroreAttivita(err?.message || "Non è stato possibile completare la ricerca.");
    } finally {
      if (reset) setRicercaSeguiti(false);
      else setCaricandoAltro(false);
    }
  }

  function caricaAltrePagine() {
    if (caricandoAltro || fineRisultati || !modalitaCorrente) return;

    if (modalitaCorrente === "seguiti") trovaAttivitaSeguiti(false);
    else trovaAttivitaVicino(false);
  }

  useEffect(() => {
    const nodo = sentinellaRef.current;
    if (!nodo) return;

    const osservatore = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) caricaAltrePagine();
      },
      { rootMargin: "600px" }
    );

    osservatore.observe(nodo);
    return () => osservatore.disconnect();
  }, [modalitaCorrente, fineRisultati, caricandoAltro, attivita.length]);

  async function cercaLuogo(query: string) {
    setLuogoForm(query);
    setPosizioneManuale(null);

    if (query.trim().length < 3) {
      setSuggerimentiLuogo([]);
      return;
    }

    setCercandoLuogo(true);

    try {
      const risposta = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=it&q=${encodeURIComponent(
          query
        )}`
      );

      const risultati = await risposta.json();
      setSuggerimentiLuogo(risultati || []);
    } catch (err) {
      console.error("ERRORE RICERCA LUOGO:", err);
    } finally {
      setCercandoLuogo(false);
    }
  }

  function scegliLuogo(suggerimento: { display_name: string; lat: string; lon: string }) {
    setLuogoForm(suggerimento.display_name.split(",").slice(0, 3).join(","));
    setPosizioneManuale({ lat: parseFloat(suggerimento.lat), lon: parseFloat(suggerimento.lon) });
    setSuggerimentiLuogo([]);
  }

  async function invitaAmici() {
    const testo =
      "Ehi! Sto usando Vybe per trovare persone con cui fare attività vicino a me — un giro in moto, una partita, una cena, quello che ti va. Unisciti anche tu 👇";
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

  function apriCreazione(categoria?: string, personalizzata: boolean = false) {
    if (!utente) {
      window.location.href = "/accesso";
      return;
    }

    setCategoriaForm(personalizzata ? "" : categoria || passioni[0]?.nome || "");
    setCategoriaPersonalizzata(personalizzata);
    setNomeCategoriaCustom("");
    setIconaCategoriaCustom("✨");
    setTitoloForm("");
    setDescrizioneForm("");
    setLuogoForm("");
    setPosizioneManuale(null);
    setSuggerimentiLuogo([]);
    setQuandoForm(formatDataOraLocale(new Date()));
    setNessunLimite(false);
    setMaxPartecipantiForm(10);
    setErroreComposer("");
    setSelezionandoCategoria(false);
    setCreazioneAperta(true);
  }

  async function pubblicaDaModale() {
    setErroreComposer("");

    if (!titoloForm.trim()) {
      setErroreComposer("Dai un titolo alla tua attività.");
      return;
    }

    if (categoriaPersonalizzata && !nomeCategoriaCustom.trim()) {
      setErroreComposer("Dai un nome alla nuova categoria.");
      return;
    }

    setPubblicando(true);

    try {
      const supabase = createClient();
      let categoriaFinale = categoriaForm;

      if (categoriaPersonalizzata) {
        const { data: nuovaPassione, error: errorePassione } = await supabase
          .rpc("aggiungi_passione", {
            p_nome: nomeCategoriaCustom.trim(),
            p_icona: iconaCategoriaCustom,
          })
          .single();

        if (errorePassione) throw errorePassione;

        const passioneCreata = nuovaPassione as Passione;
        categoriaFinale = passioneCreata.nome;

        setPassioni((prev) =>
          prev.some((p) => p.nome === passioneCreata.nome) ? prev : [...prev, passioneCreata]
        );
      }

      const { lat, lon } = posizioneManuale || (await ottieniPosizione());

      const { data: attivitaCreata, error } = await supabase
        .rpc("crea_attivita", {
          titolo: titoloForm.trim(),
          descrizione: descrizioneForm.trim() || null,
          categoria: categoriaFinale || null,
          luogo: luogoForm.trim() || null,
          data_ora: quandoForm ? new Date(quandoForm).toISOString() : null,
          max_partecipanti: nessunLimite ? null : maxPartecipantiForm + 1,
          lat,
          lon,
        })
        .single();

      if (error) throw error;

      setCreazioneAperta(false);
      abilitaNotifichePush();

      const nuovaAttivita = attivitaCreata as { id: string } | null;
      if (nuovaAttivita?.id) {
        supabase.functions
          .invoke("notifica-match-passione", { body: { attivita_id: nuovaAttivita.id } })
          .catch((err) => console.warn("Notifica match non inviata:", err));
      }

      await trovaAttivitaVicino();
    } catch (err: any) {
      console.error("ERRORE PUBBLICAZIONE:", err);

      if (err?.code === 1) {
        setErroreComposer("Per pubblicare devi consentire l'accesso alla posizione.");
      } else {
        setErroreComposer(err?.message || "Non è stato possibile pubblicare l'attività.");
      }
    } finally {
      setPubblicando(false);
    }
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
          prev.map((x) =>
            x.id === a.id ? { ...x, numero_partecipanti: risultato.numero_partecipanti } : x
          )
        );
      } else {
        const { data, error } = await supabase
          .rpc("unisciti_attivita", { p_attivita_id: a.id })
          .single();

        if (error) throw error;

        const risultato = data as { numero_partecipanti: number; gia_iscritto: boolean };

        setIscrittoA((prev) => new Set(prev).add(a.id));

        setAttivita((prev) =>
          prev.map((x) =>
            x.id === a.id ? { ...x, numero_partecipanti: risultato.numero_partecipanti } : x
          )
        );

        abilitaNotifichePush();

        if (utente) {
          supabase.functions
            .invoke("notifica-nuovo-partecipante", {
              body: { attivita_id: a.id, nuovo_utente_id: utente.id },
            })
            .catch((err) => console.warn("Notifica nuovo partecipante non inviata:", err));
        }
      }
    } catch (err: any) {
      console.error("ERRORE PARTECIPAZIONE:", err);
      alert(err?.message || "Operazione non riuscita. Riprova.");
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
        <p className="animate-pulse bg-gradient-to-r from-indigo-600 to-teal-500 bg-clip-text text-3xl font-black tracking-tight text-transparent">
          Vybe
        </p>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/2 animate-[caricaBarra_1.1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-indigo-600 to-teal-500" />
        </div>
        <style>{`
          @keyframes caricaBarra {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(250%); }
          }
        `}</style>
      </main>
    );
  }

  return (
    <>
      <RegistraVisita />
      <InstallPrompt />

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

            {/* SEZIONE DESTRA HEADER CON PROFILO E PULSANTE MENU HAMBURGER (☰) */}
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
                  
                  {/* Pulsante Hamburger ☰ visibile per aprire il menu mobile */}
                  <button
                    onClick={() => setMenuMobileAperto(!menuMobileAperto)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-slate-700 shadow-sm hover:bg-slate-50"
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

        {/* Menu Mobile a tendina (con Archivio, Ricordi e Invita amici) */}
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

        {/* RESTO DELLA PAGINA / FEED */}
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

            {/* Errori o lista attività */}
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
    </>
  );
}