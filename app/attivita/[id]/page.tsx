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
    // Carichiamo il feed in automatico una sola volta, appena "utente"
    // risulta davvero valorizzato (non nella stessa esecuzione in cui
    // viene impostato: qui React garantisce che il valore sia quello
    // vero, evitando il bug del redirect al login).
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
        // L'utente ha annullato la condivisione: nessun problema, non facciamo nulla.
        return;
      }
    }

    // Browser senza condivisione nativa (es. desktop): apriamo WhatsApp Web direttamente.
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

      // Avvisa subito chi ha la stessa passione ed è vicino. Non deve
      // mai bloccare la pubblicazione se fallisce per qualsiasi motivo.
      const nuovaAttivita = attivitaCreata as { id: string } | null;
      console.log("DIAGNOSTICA — attività creata dal server:", nuovaAttivita);

      if (nuovaAttivita?.id) {
        console.log("DIAGNOSTICA — chiamo notifica-match-passione per id:", nuovaAttivita.id);
        supabase.functions
          .invoke("notifica-match-passione", { body: { attivita_id: nuovaAttivita.id } })
          .then((risposta) => console.log("DIAGNOSTICA — risposta notifica-match-passione:", risposta))
          .catch((err) => console.warn("Notifica match non inviata:", err));
      } else {
        console.warn("DIAGNOSTICA — nessun id ricevuto da crea_attivita, notifica NON inviata.");
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

  async function attivaNotifichePulsante() {
    setAttivandoNotifiche(true);
    setMessaggioNotifiche(notificheAttive ? "Disattivo..." : "Attivo...");

    if (notificheAttive) {
      const risultato = await disabilitaNotifichePush();
      setNotificheAttive(false);
      setMessaggioNotifiche(risultato.ok ? "🔕 Notifiche disattivate su questo dispositivo." : `⚠️ ${risultato.motivo}`);
    } else {
      const risultato = await abilitaNotifichePush();

      if (risultato.ok) {
        setNotificheAttive(true);
        setMessaggioNotifiche("🔔 Notifiche attivate su questo dispositivo!");
      } else {
        setMessaggioNotifiche(`⚠️ ${risultato.motivo}`);
      }
    }

    setAttivandoNotifiche(false);
  }

  async function apriAmici() {
    if (!utente) {
      window.location.href = "/accesso";
      return;
    }

    setAmiciAperti(true);
    setCaricandoAmici(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("chi_seguo");
      if (error) throw error;
      setListaAmici((data || []) as Amico[]);
    } catch (err) {
      console.error("ERRORE LISTA AMICI:", err);
    } finally {
      setCaricandoAmici(false);
    }
  }

  async function vediAttivitaDi(amico: Amico) {
    setErroreAttivita("");

    try {
      const { lat, lon } = await ottieniPosizione();
      const supabase = createClient();

      const { data, error } = await supabase.rpc("attivita_di_utente", {
        p_creatore_id: amico.utente_id,
        lat,
        lon,
      });

      if (error) throw error;

      const risultati = (data || []) as Attivita[];
      setAttivita(risultati);
      setModalitaCorrente(null);
      setFiltroCategoria(null);
      setFineRisultati(true);
      setAmiciAperti(false);

      if (risultati.length === 0) {
        setErroreAttivita(
          `${amico.nome || "Questa persona"} non ha attività aperte al momento.`
        );
      } else if (utente) {
        const ids = risultati.map((r) => r.id);
        const { data: mie } = await supabase
          .from("partecipazioni")
          .select("attivita_id")
          .eq("utente_id", utente.id)
          .in("attivita_id", ids);

        setIscrittoA(new Set((mie || []).map((r: any) => r.attivita_id)));
      }
    } catch (err: any) {
      console.error("ERRORE ATTIVITÀ DI UTENTE:", err);
      setErroreAttivita(err?.message || "Non è stato possibile caricare le sue attività.");
    }
  }

  async function alternaSegui(partecipanteId: string, statoAttuale: StatoFollow) {
    try {
      const supabase = createClient();

      if (statoAttuale === "nessuno") {
        const { error } = await supabase.rpc("segui_utente", { p_utente_id: partecipanteId });
        if (error) throw error;

        if (utente) {
          supabase.functions
            .invoke("notifica-richiesta-follow", {
              body: { richiedente_id: utente.id, destinatario_id: partecipanteId },
            })
            .catch((err) => console.warn("Notifica richiesta non inviata:", err));
        }

        aggiornaStatoFollow(partecipanteId, "in_attesa");
      } else {
        const { error } = await supabase.rpc("smetti_di_seguire", { p_utente_id: partecipanteId });
        if (error) throw error;

        aggiornaStatoFollow(partecipanteId, "nessuno");
      }
    } catch (err: any) {
      console.error("ERRORE SEGUI:", err);
      alert(err?.message || "Operazione non riuscita.");
    }
  }

  function aggiornaStatoFollow(utenteId: string, nuovoStato: StatoFollow) {
    const aggiorna = (prev: Partecipante[]) =>
      prev.map((p) => (p.utente_id === utenteId ? { ...p, stato_follow: nuovoStato } : p));

    setPartecipantiModale(aggiorna);
    setRisultatiPersone(aggiorna);
  }

  function etichettaFollow(stato: StatoFollow) {
    if (stato === "accettata") return "✓ Amici";
    if (stato === "in_attesa") return "⏳ Richiesta inviata";
    return "+ Segui";
  }

  function classeFollow(stato: StatoFollow) {
    if (stato === "accettata")
      return "border border-slate-200 text-slate-500 hover:border-rose-200 hover:text-rose-600";
    if (stato === "in_attesa")
      return "border border-amber-200 bg-amber-50 text-amber-700 hover:border-rose-200 hover:text-rose-600";
    return "bg-gradient-to-r from-indigo-600 to-teal-500 text-white";
  }

  async function apriRichiesteAmicizia() {
    if (!utente) return;

    setRichiesteAperte(true);
    setCaricandoRichieste(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("richieste_in_attesa");
      if (error) throw error;
      setListaRichieste((data || []) as RichiestaAmicizia[]);
    } catch (err) {
      console.error("ERRORE RICHIESTE:", err);
    } finally {
      setCaricandoRichieste(false);
    }
  }

  async function rispondiRichiesta(richiedenteId: string, accetta: boolean) {
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc(accetta ? "accetta_richiesta" : "rifiuta_richiesta", {
        p_richiedente_id: richiedenteId,
      });
      if (error) throw error;

      setListaRichieste((prev) => prev.filter((r) => r.utente_id !== richiedenteId));
      setNumeroRichieste((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error("ERRORE RISPOSTA RICHIESTA:", err);
      alert(err?.message || "Operazione non riuscita.");
    }
  }

  async function cercaPersone(query: string) {
    setQueryPersone(query);

    if (query.trim().length < 2) {
      setRisultatiPersone([]);
      return;
    }

    setCercandoPersone(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("cerca_utenti", { p_query: query.trim() });

      if (error) throw error;
      setRisultatiPersone((data || []) as Partecipante[]);
    } catch (err) {
      console.error("ERRORE RICERCA PERSONE:", err);
    } finally {
      setCercandoPersone(false);
    }
  }

  function apriRicercaPersone() {
    if (!utente) {
      window.location.href = "/accesso";
      return;
    }
    setQueryPersone("");
    setRisultatiPersone([]);
    setRicercaPersoneAperta(true);
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

            <div className="flex items-center gap-3">
              <SelettoreLingua />

              {utente ? (
                <>
                  <span className="hidden text-sm font-bold text-slate-500 sm:block">
                    Ciao, {utente.nome || "su Vybe"}!
                  </span>

                  {numeroRichieste > 0 && (
                    <button
                      onClick={apriRichiesteAmicizia}
                      className="relative rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      📥
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white">
                        {numeroRichieste}
                      </span>
                    </button>
                  )}

                  <div className="relative sm:hidden">
                    <button
                      onClick={() => setMenuMobileAperto((s) => !s)}
                      className="rounded-full border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      aria-label="Altre opzioni"
                    >
                      ☰
                    </button>

                    {menuMobileAperto && (
                      <div
                        className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200"
                        onClick={() => setMenuMobileAperto(false)}
                      >
                        <button
                          onClick={invitaAmici}
                          className="block w-full px-4 py-3 text-left text-sm font-bold text-teal-700 hover:bg-slate-50"
                        >
                          {t("invitaAmici")}
                        </button>
                        <Link
                          href="/ricordi"
                          className="block border-t border-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                          📸 Ricordi
                        </Link>
                        <Link
                          href="/archivio"
                          className="block border-t border-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                          {t("archivio")}
                        </Link>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={invitaAmici}
                    className="hidden rounded-full bg-teal-50 px-4 py-2 text-sm font-bold text-teal-700 transition hover:bg-teal-100 sm:inline-flex"
                  >
                    {t("invitaAmici")}
                  </button>

                  <Link
                    href="/ricordi"
                    className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 sm:inline-flex"
                  >
                    📸 Ricordi
                  </Link>

                  <Link
                    href="/archivio"
                    className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 sm:inline-flex"
                  >
                    {t("archivio")}
                  </Link>

                  <Link
                    href="/profilo"
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                  >
                    {t("profilo")}
                  </Link>

                  <button
                    onClick={logout}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
                  >
                    {t("esci")}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/accesso"
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                  >
                    {t("accedi")}
                  </Link>

                  <Link
                    href="/registrazione"
                    className="rounded-full bg-gradient-to-r from-indigo-600 to-teal-500 px-4 py-2 text-sm font-bold text-white transition hover:shadow-md"
                  >
                    {t("registrati")}
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-6 py-8">
          {/* HERO */}
          <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 p-8 text-white shadow-lg">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.15]"
              style={{
                backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-400/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-teal-300/20 blur-3xl" />

            <div className="relative z-10">
              <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-black tracking-wide backdrop-blur">
                {t("eyebrow")}
              </p>

              {utente ? (
                <>
                  <h2 className="max-w-2xl text-4xl font-black leading-tight md:text-5xl">
                    Ciao {utente.nome || "!"}
                    <br />
                    <span className="text-teal-200">{t("ciaoTitolo")}</span>
                  </h2>

                  <p className="mt-4 max-w-xl text-indigo-100">{t("ciaoSottotitolo")}</p>

                  <button
                    onClick={invitaAmici}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-black text-indigo-700 shadow-sm transition hover:scale-[1.02] hover:shadow-md sm:hidden"
                  >
                    {t("invitaAmiciEsteso")}
                  </button>
                </>
              ) : (
                <>
                  <h2 className="max-w-2xl text-4xl font-black leading-tight md:text-5xl">
                    {t("ospiteTitolo1")}
                    <br />
                    <span className="text-teal-200">{t("ospiteTitolo2")}</span>
                  </h2>

                  <p className="mt-4 max-w-xl text-indigo-100">{t("ospiteSottotitolo")}</p>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Link
                      href="/registrazione"
                      className="rounded-xl bg-white px-6 py-3 text-sm font-black text-indigo-600 shadow-sm transition hover:scale-[1.02] hover:shadow-md"
                    >
                      {t("inizia")}
                    </Link>

                    <Link
                      href="/accesso"
                      className="rounded-xl border border-white/40 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10"
                    >
                      {t("hoAccount")}
                    </Link>
                  </div>

                  {numeroUtenti !== null && numeroUtenti > 0 && (
                    <p className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-indigo-100">
                      <span className="flex h-2 w-2 animate-pulse rounded-full bg-teal-300" />
                      🎉 {numeroUtenti.toLocaleString()} {t("utentiSuffisso")}
                    </p>
                  )}
                </>
              )}
            </div>
          </section>

          {/* CERCA E PUBBLICA */}
          {utente && passioni.length > 0 && (
            <section className="mb-8 rounded-2xl border bg-white p-6 shadow-sm">
              <h3 className="mb-1 text-xl font-bold">{t("cercaPubblicaTitolo")}</h3>
              <p className="mb-5 text-sm text-slate-500">
                {t("cercaPubblicaSottotitolo")}
              </p>

              <div className="mb-2 flex flex-wrap gap-3">
                <button
                  onClick={() => trovaAttivitaVicino(true)}
                  disabled={ricerca}
                  className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {ricerca ? "📍 ..." : t("vicinoATe")}
                </button>

                <button
                  onClick={apriAmici}
                  className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  {t("persoeSegui")}
                </button>

                <button
                  onClick={apriRicercaPersone}
                  className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  🔍 Trova amici
                </button>

                <button
                  onClick={attivaNotifichePulsante}
                  disabled={attivandoNotifiche}
                  className={`rounded-full border px-5 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    notificheAttive
                      ? "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {notificheAttive ? "🔕 Disattiva notifiche" : "🔔 Attiva notifiche"}
                </button>

                <button
                  onClick={() => setMostraCategorieRicerca((s) => !s)}
                  className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  {t("perPassione")}
                </button>
              </div>

              {messaggioNotifiche && (
                <p className="mb-2 mt-2 text-xs font-bold text-teal-700">{messaggioNotifiche}</p>
              )}

              {mostraCategorieRicerca && (
                <div className="mb-2 mt-3 flex flex-wrap gap-2 rounded-xl bg-slate-50 p-3">
                  {passioni.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setFiltroCategoria(filtroCategoria === p.nome ? null : p.nome);
                        if (attivita.length === 0) trovaAttivitaVicino();
                      }}
                      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                        filtroCategoria === p.nome
                          ? "bg-gradient-to-r from-indigo-600 to-teal-500 text-white shadow-sm"
                          : "bg-white text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {p.icona} {p.nome}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* CONTENUTO */}
          <div>
            {/* ATTIVITÀ */}
            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold">{t("feedTitolo")}</h3>
                  <p className="text-sm text-slate-500">
                    {t("feedSottotitolo")}
                  </p>
                </div>

                {utente && attivita.length > 0 && (
                  <button
                    onClick={() =>
                      modalitaCorrente === "seguiti" ? trovaAttivitaSeguiti(true) : trovaAttivitaVicino(true)
                    }
                    disabled={ricerca || ricercaSeguiti}
                    className="whitespace-nowrap rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {ricerca || ricercaSeguiti ? "..." : t("aggiorna")}
                  </button>
                )}
              </div>

              {filtroCategoria && (
                <button
                  onClick={() => setFiltroCategoria(null)}
                  className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700"
                >
                  Filtro: {filtroCategoria} ✕
                </button>
              )}

              {!utente && (
                <div className="rounded-2xl border bg-white p-7 text-center shadow-sm">
                  <p className="font-bold text-slate-700">
                    {t("accediPerVedere")}
                  </p>
                  <Link
                    href="/registrazione"
                    className="mt-5 inline-flex rounded-xl bg-gradient-to-r from-indigo-600 to-teal-500 px-5 py-3 text-sm font-black text-white hover:shadow-md"
                  >
                    🚀 Inizia con Vybe
                  </Link>
                </div>
              )}

              {utente && attivitaVisibili.length > 0 && (
                <div className="space-y-5">
                  {attivitaVisibili.map((a) => {
                    const giaIscritto = iscrittoA.has(a.id);
                    const postiEsauriti =
                      a.max_partecipanti != null &&
                      a.numero_partecipanti >= a.max_partecipanti &&
                      !giaIscritto;
                    const colore = coloreCategoria(a.categoria);
                    const percentuale =
                      a.max_partecipanti != null
                        ? Math.min(100, Math.round((a.numero_partecipanti / a.max_partecipanti) * 100))
                        : null;
                    const quasiPieno = percentuale !== null && percentuale >= 70 && percentuale < 100;
                    const pubblicataDaPoco =
                      oraCorrente.getTime() - new Date(a.created_at).getTime() < 10 * 60000;

                    return (
                      <article
                        key={a.id}
                        className="flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-all duration-200 hover:-translate-y-1 hover:rotate-[0.3deg] hover:shadow-xl"
                      >
                        <div className="mb-3 flex items-start gap-4">
                          <div
                            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-sm ${colore.bg}`}
                          >
                            {iconaCategoria(a.categoria)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-xs font-black uppercase tracking-wide ${colore.text}`}>
                                {a.categoria || "Generale"}
                              </span>

                              {pubblicataDaPoco && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-black text-teal-700">
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
                                  NUOVO
                                </span>
                              )}

                              {quasiPieno && (
                                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-600">
                                  🔥 QUASI PIENO
                                </span>
                              )}
                            </div>

                            <h4 className="mt-1 text-xl font-black text-slate-900">{a.titolo}</h4>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span className="whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-black text-white">
                              🕐 {formatOrarioEvidente(a.data_ora)}
                            </span>

                            <span
                              className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                                statoTempo(a.data_ora, oraCorrente).classe
                              }`}
                            >
                              {statoTempo(a.data_ora, oraCorrente).testo}
                            </span>
                          </div>
                        </div>

                        {a.descrizione && (
                          <p className="mb-4 text-sm leading-relaxed text-slate-600">{a.descrizione}</p>
                        )}

                        <div className="mb-4 flex flex-wrap gap-3 text-sm font-medium text-slate-500">
                          {a.luogo && <span>📍 {a.luogo}</span>}
                          <span>🧭 {formatDistanza(a.distanza_metri)} da te</span>
                        </div>

                        <div className="mt-auto">
                          <div className="mb-4">
                            <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <button
                                onClick={() => apriPartecipanti(a.id)}
                                className="text-xs font-bold text-slate-500 underline decoration-dotted underline-offset-2 hover:text-indigo-600"
                              >
                                👥 {a.numero_partecipanti}
                                {a.max_partecipanti ? `/${a.max_partecipanti}` : ""} partecipanti
                              </button>

                              {a.max_partecipanti != null && !postiEsauriti && (
                                <span className="text-xs font-black text-teal-600">
                                  🟢 {a.max_partecipanti - a.numero_partecipanti} post
                                  {a.max_partecipanti - a.numero_partecipanti === 1 ? "o" : "i"} disponibil
                                  {a.max_partecipanti - a.numero_partecipanti === 1 ? "e" : "i"}
                                </span>
                              )}
                            </div>

                            {percentuale !== null && (
                              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    width: `${percentuale}%`,
                                    backgroundColor:
                                      percentuale >= 100
                                        ? "#e11d48"
                                        : percentuale >= 70
                                          ? "#f59e0b"
                                          : "#4f46e5",
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex gap-3">
                            <button
                              onClick={() => !postiEsauriti && alternaPartecipazione(a)}
                              disabled={postiEsauriti}
                              className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black transition active:scale-95 ${
                                giaIscritto
                                  ? "border-2 border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                                  : postiEsauriti
                                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                                    : "bg-gradient-to-r from-indigo-600 to-teal-500 text-white shadow-sm hover:scale-[1.02] hover:shadow-md"
                              }`}
                            >
                              {giaIscritto
                                ? t("abbandona")
                                : postiEsauriti
                                  ? t("postiEsauriti")
                                  : t("miUnisco")}
                            </button>

                            <Link
                              href={`/attivita/${a.id}`}
                              className="flex items-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
                            >
                              {t("dettagli")}
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {utente && attivitaVisibili.length === 0 && erroreAttivita && (
                <div className="rounded-2xl border bg-white p-7 shadow-sm">
                  <p className="font-bold text-slate-700">{erroreAttivita}</p>
                </div>
              )}

              {utente && modalitaCorrente && attivita.length > 0 && (
                <div ref={sentinellaRef} className="flex justify-center py-8">
                  {caricandoAltro && (
                    <p className="text-sm font-bold text-slate-400">Carico altre attività...</p>
                  )}
                  {fineRisultati && !caricandoAltro && (
                    <p className="text-sm font-medium text-slate-400">
                      Hai visto tutte le attività disponibili 🎉
                    </p>
                  )}
                </div>
              )}
            </section>

          </div>
        </div>

        <footer className="mt-16 border-t border-slate-200 px-6 py-8 text-center">
          <Link href="/termini" className="text-xs font-medium text-slate-400 hover:text-indigo-600">
            {t("termini")}
          </Link>
        </footer>

        {/* PULSANTE FLOTTANTE */}
        {utente && (
          <button
            onClick={() => apriCreazione()}
            className="fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-teal-500 text-3xl font-black text-white shadow-xl transition hover:scale-110 active:scale-95"
            aria-label="Pubblica una nuova attività"
          >
            +
          </button>
        )}
      </main>

      {/* SCHEDA GUIDATA DI CREAZIONE */}
      {creazioneAperta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => !pubblicando && setCreazioneAperta(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900">Nuova attività</h3>
              <button
                onClick={() => setCreazioneAperta(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Categoria scelta */}
            {categoriaPersonalizzata ? (
              <div className="mb-5 rounded-2xl bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Nuova categoria
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoriaPersonalizzata(false);
                      setCategoriaForm(passioni[0]?.nome || "");
                    }}
                    className="text-xs font-bold text-indigo-600 underline underline-offset-2"
                  >
                    Scegli tra le esistenti
                  </button>
                </div>

                <input
                  value={nomeCategoriaCustom}
                  onChange={(e) => setNomeCategoriaCustom(e.target.value)}
                  placeholder='Es. "Shopping", "Arte", "Studio"...'
                  maxLength={30}
                  className="mb-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />

                <p className="mb-2 text-xs font-bold text-slate-400">Scegli un&apos;icona</p>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_CUSTOM.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setIconaCategoriaCustom(emoji)}
                      className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl transition ${
                        iconaCategoriaCustom === emoji
                          ? "bg-gradient-to-r from-indigo-600 to-teal-500 shadow-sm"
                          : "bg-white ring-1 ring-slate-200 hover:ring-indigo-300"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-5 flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                <div
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl shadow-sm ${coloreCategoria(categoriaForm).bg}`}
                >
                  {passioni.find((p) => p.nome === categoriaForm)?.icona || "📅"}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Categoria
                  </p>
                  <p className="truncate text-lg font-black text-slate-900">
                    {categoriaForm || "Generale"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelezionandoCategoria((s) => !s)}
                  className="shrink-0 text-xs font-bold text-indigo-600 underline underline-offset-2"
                >
                  Cambia
                </button>
              </div>
            )}

            {selezionandoCategoria && !categoriaPersonalizzata && (
              <div className="mb-5 flex flex-wrap gap-2">
                {passioni.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setCategoriaForm(p.nome);
                      setSelezionandoCategoria(false);
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      categoriaForm === p.nome
                        ? "bg-gradient-to-r from-indigo-600 to-teal-500 text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {p.icona} {p.nome}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setCategoriaPersonalizzata(true);
                    setSelezionandoCategoria(false);
                  }}
                  className="rounded-full border-2 border-dashed border-slate-300 px-4 py-2 text-sm font-bold text-slate-500 transition hover:border-indigo-400 hover:text-indigo-600"
                >
                  ➕ Nuova categoria
                </button>
              </div>
            )}

            {/* Titolo */}
            <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
              Titolo
            </label>
            <input
              value={titoloForm}
              onChange={(e) => setTitoloForm(e.target.value)}
              placeholder='Es. "Giro in moto domenica, chi si unisce?"'
              className="mb-5 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />

            {/* Descrizione */}
            <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
              Descrizione (facoltativa)
            </label>
            <textarea
              value={descrizioneForm}
              onChange={(e) => setDescrizioneForm(e.target.value)}
              placeholder="Qualche dettaglio in più per chi vuole unirsi..."
              rows={3}
              className="mb-5 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />

            {/* Dove e Quando */}
            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <div className="relative">
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
                  Dove
                </label>
                <input
                  value={luogoForm}
                  onChange={(e) => cercaLuogo(e.target.value)}
                  placeholder="Cerca un indirizzo o un luogo..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />

                {posizioneManuale && (
                  <p className="mt-1 text-xs font-bold text-teal-600">📍 Posizione impostata</p>
                )}

                {!posizioneManuale && luogoForm.trim().length === 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    Se non cerchi nulla, uso la tua posizione attuale.
                  </p>
                )}

                {cercandoLuogo && (
                  <p className="mt-1 text-xs text-slate-400">Cerco...</p>
                )}

                {suggerimentiLuogo.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    {suggerimentiLuogo.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => scegliLuogo(s)}
                        className="block w-full border-b border-slate-100 px-4 py-2.5 text-left text-xs text-slate-700 last:border-0 hover:bg-indigo-50"
                      >
                        📍 {s.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
                  Quando
                </label>
                <input
                  type="datetime-local"
                  value={quandoForm}
                  onChange={(e) => setQuandoForm(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Impostato su adesso — cambialo se l&apos;evento è più avanti.
                </p>
              </div>
            </div>

            {/* Partecipanti */}
            <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
              Quante persone ti servono, oltre a te?
            </label>
            <div className="mb-2 flex items-center gap-3">
              <input
                type="number"
                min={1}
                value={maxPartecipantiForm}
                disabled={nessunLimite}
                onChange={(e) => setMaxPartecipantiForm(Number(e.target.value))}
                className="w-28 rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400"
              />

              <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={nessunLimite}
                  onChange={(e) => setNessunLimite(e.target.checked)}
                  className="h-4 w-4 rounded accent-indigo-600"
                />
                Nessun limite — più si è, meglio è! 🎉
              </label>
            </div>

            {erroreComposer && (
              <p className="mb-3 text-sm font-bold text-red-600">{erroreComposer}</p>
            )}

            <button
              onClick={pubblicaDaModale}
              disabled={pubblicando}
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-teal-500 px-6 py-4 font-black text-white shadow-sm transition hover:scale-[1.01] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {pubblicando ? "Pubblico..." : "🚀 Pubblica attività"}
            </button>
          </div>
        </div>
      )}

      {/* MODALE RICHIESTE DI AMICIZIA */}
      {richiesteAperte && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setRichiesteAperte(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">📥 Richieste di amicizia</h3>
              <button
                onClick={() => setRichiesteAperte(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {caricandoRichieste ? (
              <p className="text-sm text-slate-400">Carico...</p>
            ) : listaRichieste.length === 0 ? (
              <p className="text-sm text-slate-400">Nessuna richiesta in attesa.</p>
            ) : (
              <ul className="space-y-3">
                {listaRichieste.map((r) => (
                  <li key={r.utente_id} className="flex items-center gap-3">
                    {r.avatar_url ? (
                      <img src={r.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-teal-500 text-sm font-black text-white">
                        {(r.nome?.[0] || "?").toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {[r.nome, r.cognome].filter(Boolean).join(" ") || "Utente Vybe"}
                      </p>
                      {r.citta && <p className="text-xs text-slate-500">{r.citta}</p>}
                    </div>

                    <button
                      onClick={() => rispondiRichiesta(r.utente_id, true)}
                      className="shrink-0 rounded-full bg-gradient-to-r from-indigo-600 to-teal-500 px-3 py-1.5 text-xs font-black text-white"
                    >
                      ✓ Accetta
                    </button>

                    <button
                      onClick={() => rispondiRichiesta(r.utente_id, false)}
                      className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-500 hover:border-rose-200 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* MODALE ELENCO AMICI */}
      {amiciAperti && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setAmiciAperti(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">👥 Persone che segui</h3>
              <button
                onClick={() => setAmiciAperti(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {caricandoAmici ? (
              <p className="text-sm text-slate-400">Carico...</p>
            ) : listaAmici.length === 0 ? (
              <div className="text-center">
                <p className="mb-4 text-sm text-slate-500">
                  Non segui ancora nessuno. Cerca qualcuno da seguire!
                </p>
                <button
                  onClick={() => {
                    setAmiciAperti(false);
                    apriRicercaPersone();
                  }}
                  className="rounded-xl bg-gradient-to-r from-indigo-600 to-teal-500 px-5 py-2.5 text-sm font-black text-white"
                >
                  🔍 Trova amici
                </button>
              </div>
            ) : (
              <ul className="space-y-2">
                {listaAmici.map((a) => (
                  <li key={a.utente_id}>
                    <button
                      onClick={() => vediAttivitaDi(a)}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-slate-50"
                    >
                      {a.avatar_url ? (
                        <img src={a.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-teal-500 text-sm font-black text-white">
                          {(a.nome?.[0] || "?").toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {[a.nome, a.cognome].filter(Boolean).join(" ") || "Utente Vybe"}
                        </p>
                        {a.citta && <p className="text-xs text-slate-500">{a.citta}</p>}
                      </div>

                      {a.numero_attivita_aperte > 0 ? (
                        <span className="shrink-0 rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-black text-teal-700">
                          🟢 {a.numero_attivita_aperte} attiv.
                        </span>
                      ) : (
                        <span className="shrink-0 text-[11px] font-medium text-slate-400">
                          Niente al momento
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* MODALE RICERCA PERSONE */}
      {ricercaPersoneAperta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setRicercaPersoneAperta(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">🔍 Trova amici</h3>
              <button
                onClick={() => setRicercaPersoneAperta(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <input
              value={queryPersone}
              onChange={(e) => cercaPersone(e.target.value)}
              placeholder="Cerca per nome o cognome..."
              autoFocus
              className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />

            {cercandoPersone && <p className="text-sm text-slate-400">Cerco...</p>}

            {!cercandoPersone && queryPersone.trim().length >= 2 && risultatiPersone.length === 0 && (
              <p className="text-sm text-slate-400">Nessuna persona trovata con questo nome.</p>
            )}

            <ul className="space-y-3">
              {risultatiPersone.map((p) => (
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

                  <button
                    onClick={() => alternaSegui(p.utente_id, p.stato_follow)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition ${classeFollow(p.stato_follow)}`}
                  >
                    {etichettaFollow(p.stato_follow)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* MODALE PARTECIPANTI */}
      {modaleAttivitaId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setModaleAttivitaId(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Chi partecipa</h3>
              <button
                onClick={() => setModaleAttivitaId(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {caricandoPartecipanti ? (
              <p className="text-sm text-slate-500">Carico...</p>
            ) : partecipantiModale.length === 0 ? (
              <p className="text-sm text-slate-500">Nessun partecipante ancora. Sii il primo!</p>
            ) : (
              <ul className="space-y-3">
                {partecipantiModale.map((p) => (
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

                    {p.utente_id !== utente?.id && (
                      <button
                        onClick={() => alternaSegui(p.utente_id, p.stato_follow)}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition ${classeFollow(p.stato_follow)}`}
                      >
                        {etichettaFollow(p.stato_follow)}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
