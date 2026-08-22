"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const PASSIONI = [
  { nome: "Moto", emoji: "🏍️" },
  { nome: "Calcio", emoji: "⚽" },
  { nome: "Sport", emoji: "🏃" },
  { nome: "Running", emoji: "🏃‍♂️" },
  { nome: "Palestra", emoji: "🏋️" },
  { nome: "Ciclismo", emoji: "🚴" },
  { nome: "Tennis", emoji: "🎾" },
  { nome: "Gaming", emoji: "🎮" },
  { nome: "Musica", emoji: "🎵" },
  { nome: "Cinema", emoji: "🎬" },
  { nome: "Viaggi", emoji: "✈️" },
  { nome: "Fotografia", emoji: "📷" },
  { nome: "Cucina", emoji: "🍕" },
  { nome: "Escursioni", emoji: "🥾" },
  { nome: "Pesca", emoji: "🎣" },
  { nome: "Auto", emoji: "🚗" },
];

type Profilo = {
  id: string;
  nome: string | null;
  cognome: string | null;
  citta: string | null;
  descrizione: string | null;
  passioni: string[] | null;
  avatar_url: string | null;
  lat: number | null;
  lon: number | null;
  punteggio_affidabilita: number | null;
};

function coloreScore(punteggio: number | null) {
  if (punteggio == null) return "bg-slate-100 text-slate-600";
  if (punteggio >= 90) return "bg-teal-100 text-teal-700";
  if (punteggio >= 70) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

export default function Profilo() {
  const router = useRouter();
  const supabase = createClient();

  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [citta, setCitta] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [passioni, setPassioni] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [punteggio, setPunteggio] = useState<number | null>(null);

  const [caricamento, setCaricamento] = useState(true);
  const [caricamentoFoto, setCaricamentoFoto] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);

  const [messaggio, setMessaggio] = useState("");
  const [errore, setErrore] = useState("");
  const [posizioneStato, setPosizioneStato] = useState("");

  useEffect(() => {
    let attivo = true;

    async function caricaProfilo() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/accesso");
          return;
        }

        const { data, error } = await supabase
          .from("profili")
          .select("id,nome,cognome,citta,descrizione,passioni,avatar_url,lat,lon,punteggio_affidabilita")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (!attivo) return;

        if (!data) {
          setNome(user.user_metadata?.nome || "");
          setCognome(user.user_metadata?.cognome || "");
          setCitta("");
          setDescrizione("");
          setPassioni([]);
          setAvatarUrl("");
          setPunteggio(100);
          return;
        }

        const profilo = data as Profilo;

        setNome(profilo.nome || "");
        setCognome(profilo.cognome || "");
        setCitta(profilo.citta || "");
        setDescrizione(profilo.descrizione || "");
        setPassioni(Array.isArray(profilo.passioni) ? profilo.passioni : []);
        setAvatarUrl(profilo.avatar_url || "");
        setPunteggio(profilo.punteggio_affidabilita ?? 100);

        if (profilo.lat !== null && profilo.lon !== null) {
          setPosizioneStato("📍 Posizione salvata");
        }
      } catch (err: any) {
        console.error("ERRORE CARICAMENTO PROFILO:", err);
        if (attivo) {
          setErrore(err?.message || "Non è stato possibile caricare il profilo.");
        }
      } finally {
        if (attivo) setCaricamento(false);
      }
    }

    caricaProfilo();

    return () => {
      attivo = false;
    };
  }, [router, supabase]);

  function cambiaPassione(passione: string) {
    setPassioni((attuali) => {
      if (attuali.includes(passione)) {
        return attuali.filter((p) => p !== passione);
      }

      if (attuali.length >= 8) return attuali;

      return [...attuali, passione];
    });
  }

  async function caricaFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    setErrore("");
    setMessaggio("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrore("Puoi caricare solo immagini JPG, PNG o WebP.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrore("La foto deve essere inferiore a 5 MB.");
      e.target.value = "";
      return;
    }

    setCaricamentoFoto(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/accesso");
        return;
      }

      const estensione =
        file.name.split(".").pop()?.toLowerCase() || "jpg";

      const percorso = `${user.id}/avatar.${estensione}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(percorso, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(percorso);

      const urlFinale = `${publicUrl}?v=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profili")
        .update({ avatar_url: urlFinale })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(urlFinale);
      setMessaggio("Foto profilo aggiornata! 📸");
    } catch (err: any) {
      console.error("ERRORE CARICAMENTO FOTO:", err);
      setErrore(
        err?.message || "Non è stato possibile caricare la foto."
      );
    } finally {
      setCaricamentoFoto(false);
      e.target.value = "";
    }
  }

  async function salvaProfilo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setErrore("");
    setMessaggio("");
    setPosizioneStato("");
    setSalvataggio(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/accesso");
        return;
      }

      let lat: number | null = null;
      let lon: number | null = null;

      if ("geolocation" in navigator) {
        try {
          const posizione = await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000,
              });
            }
          );

          lat = posizione.coords.latitude;
          lon = posizione.coords.longitude;
          setPosizioneStato("📍 Posizione aggiornata");
        } catch (errorePosizione) {
          console.warn("Posizione non disponibile:", errorePosizione);
          setPosizioneStato("📍 Posizione non aggiornata");
        }
      }

      const { data: profiloEsistente } = await supabase
        .from("profili")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      const datiProfilo = {
        nome: nome.trim(),
        cognome: cognome.trim() || null,
        citta: citta.trim() || null,
        descrizione: descrizione.trim() || null,
        passioni,
        avatar_url: avatarUrl || null,
        ...(lat !== null && lon !== null ? { lat, lon } : {}),
      };

      if (profiloEsistente) {
        const { error } = await supabase
          .from("profili")
          .update(datiProfilo)
          .eq("id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profili")
          .insert({
            id: user.id,
            ...datiProfilo,
          });

        if (error) throw error;
      }

      setMessaggio("Profilo aggiornato correttamente! 🎉");

      setTimeout(() => {
        setMessaggio("");
      }, 3000);
    } catch (err: any) {
      console.error("ERRORE SALVATAGGIO PROFILO:", err);
      setErrore(
        err?.message || "Si è verificato un errore durante il salvataggio."
      );
    } finally {
      setSalvataggio(false);
    }
  }

  if (caricamento) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-12">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <p className="font-bold text-slate-600">Caricamento profilo...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-3xl font-black tracking-tight text-slate-900">
            Vy<span className="text-indigo-600">be</span>
          </Link>

          <Link
            href="/"
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            ← Home
          </Link>
        </div>
      </header>

      <section className="px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-slate-900">
                Il mio profilo
              </h1>
              <p className="mt-2 text-slate-500">
                Completa il tuo profilo per farti conoscere dagli altri utenti di Vybe.
              </p>
            </div>

            <div
              className={`shrink-0 rounded-2xl px-4 py-3 text-center ${coloreScore(punteggio)}`}
              title="Sale quando il creatore conferma la tua presenza, scende se ti iscrivi e non ti presenti."
            >
              <p className="text-2xl font-black">⭐ {punteggio ?? "—"}</p>
              <p className="text-[11px] font-bold uppercase tracking-wide">Score</p>
            </div>
          </div>

          <form onSubmit={salvaProfilo}>
            <div className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-900">La tua foto</h2>

              <div className="mt-6 flex flex-col items-center gap-5 sm:flex-row">
                <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-50 ring-4 ring-indigo-100">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Foto profilo"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-5xl">👤</span>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="foto-profilo"
                    className={`inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white transition hover:bg-indigo-700 ${
                      caricamentoFoto
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer"
                    }`}
                  >
                    {caricamentoFoto ? "Caricamento..." : "📷 Scegli una foto"}
                  </label>

                  <input
                    id="foto-profilo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={caricaFoto}
                    disabled={caricamentoFoto}
                    className="hidden"
                  />

                  <p className="mt-3 max-w-sm text-xs leading-5 text-slate-400">
                    JPG, PNG o WebP. Dimensione massima 5 MB.
                    La foto sarà visibile agli altri utenti.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-900">
                Informazioni personali
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Nome</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Cognome</label>
                  <input
                    type="text"
                    value={cognome}
                    onChange={(e) => setCognome(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-slate-700">📍 Città</label>
                  <input
                    type="text"
                    value={citta}
                    onChange={(e) => setCitta(e.target.value)}
                    placeholder="Es. Brindisi"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    La città sarà mostrata sul tuo profilo. La posizione precisa non verrà mostrata agli altri utenti.
                  </p>
                  {posizioneStato && (
                    <p className="mt-2 text-xs font-bold text-indigo-600">
                      {posizioneStato}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    📝 Qualcosa su di te
                  </label>
                  <textarea
                    value={descrizione}
                    onChange={(e) => setDescrizione(e.target.value)}
                    placeholder="Racconta brevemente chi sei e cosa ti piace fare..."
                    rows={4}
                    maxLength={300}
                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                  <p className="mt-2 text-right text-xs text-slate-400">
                    {descrizione.length}/300
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Le mie passioni</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Seleziona le attività che ti interessano.
                  </p>
                </div>

                <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">
                  {passioni.length}/8
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {PASSIONI.map((passione) => {
                  const selezionata = passioni.includes(passione.nome);

                  return (
                    <button
                      key={passione.nome}
                      type="button"
                      onClick={() => cambiaPassione(passione.nome)}
                      className={`rounded-xl border p-4 text-left transition ${
                        selezionata
                          ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100"
                          : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-2xl">{passione.emoji}</div>
                      <div
                        className={`mt-2 text-sm font-bold ${
                          selezionata ? "text-indigo-700" : "text-slate-700"
                        }`}
                      >
                        {passione.nome}
                      </div>
                      {selezionata && (
                        <div className="mt-1 text-xs font-bold text-indigo-600">
                          ✓ Selezionata
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="mt-5 text-xs text-slate-400">
                Puoi scegliere fino a 8 passioni.
              </p>
            </div>

            {errore && (
              <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errore}
              </div>
            )}

            {messaggio && (
              <div className="mt-6 rounded-xl bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
                {messaggio}
              </div>
            )}

            <button
              type="submit"
              disabled={salvataggio}
              className="mt-6 w-full rounded-xl bg-indigo-600 px-6 py-4 text-sm font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salvataggio ? "Salvataggio..." : "💾 Salva il mio profilo"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
