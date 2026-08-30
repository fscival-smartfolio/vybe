"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type RicordoFeed = {
  id: string;
  attivita_id: string;
  url: string;
  didascalia: string | null;
  creato_il: string;
  autore_id: string;
  autore_nome: string | null;
  autore_avatar: string | null;
  attivita_titolo: string;
};

const PAGINA_SIZE = 10;

function eVideo(url: string) {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

export default function Ricordi() {
  const [vista, setVista] = useState<"feed" | "archivio">("feed");

  const [feed, setFeed] = useState<RicordoFeed[]>([]);
  const [offsetFeed, setOffsetFeed] = useState(0);
  const [fineFeed, setFineFeed] = useState(false);
  const [caricandoFeed, setCaricandoFeed] = useState(true);

  const [archivio, setArchivio] = useState<RicordoFeed[]>([]);
  const [caricandoArchivio, setCaricandoArchivio] = useState(false);

  const sentinellaRef = useRef<HTMLDivElement | null>(null);

  async function caricaFeed(reset: boolean) {
    const offset = reset ? 0 : offsetFeed;
    setCaricandoFeed(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("feed_ricordi", {
        p_limit: PAGINA_SIZE,
        p_offset: offset,
      });

      if (error) throw error;

      const risultati = (data || []) as RicordoFeed[];
      setFeed((prev) => (reset ? risultati : [...prev, ...risultati]));
      setOffsetFeed(offset + risultati.length);
      setFineFeed(risultati.length < PAGINA_SIZE);
    } catch (err) {
      console.error("ERRORE FEED RICORDI:", err);
    } finally {
      setCaricandoFeed(false);
    }
  }

  async function caricaArchivio() {
    setCaricandoArchivio(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("miei_ricordi", { p_limit: 60, p_offset: 0 });
      if (error) throw error;
      setArchivio((data || []) as RicordoFeed[]);
    } catch (err) {
      console.error("ERRORE ARCHIVIO RICORDI:", err);
    } finally {
      setCaricandoArchivio(false);
    }
  }

  useEffect(() => {
    caricaFeed(true);
  }, []);

  useEffect(() => {
    if (vista === "archivio" && archivio.length === 0) {
      caricaArchivio();
    }
  }, [vista]);

  useEffect(() => {
    if (vista !== "feed") return;
    const nodo = sentinellaRef.current;
    if (!nodo) return;

    const osservatore = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !fineFeed && !caricandoFeed) {
          caricaFeed(false);
        }
      },
      { rootMargin: "800px" }
    );

    osservatore.observe(nodo);
    return () => osservatore.disconnect();
  }, [vista, fineFeed, caricandoFeed, feed.length]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
        <Link href="/" className="text-sm font-bold text-white/90">
          ← Vybe
        </Link>

        <div className="flex items-center gap-1 rounded-full bg-white/10 p-1 backdrop-blur">
          <button
            onClick={() => setVista("feed")}
            className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
              vista === "feed" ? "bg-white text-slate-900" : "text-white/80"
            }`}
          >
            Feed
          </button>
          <button
            onClick={() => setVista("archivio")}
            className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
              vista === "archivio" ? "bg-white text-slate-900" : "text-white/80"
            }`}
          >
            I miei ricordi
          </button>
        </div>

        <span className="w-12" />
      </header>

      {vista === "feed" ? (
        <div className="h-screen snap-y snap-mandatory overflow-y-scroll">
          {feed.length === 0 && !caricandoFeed && (
            <div className="flex h-screen flex-col items-center justify-center gap-3 px-8 text-center">
              <p className="text-5xl">📸</p>
              <p className="font-bold text-white/80">
                Nessun ricordo da mostrare ancora. Segui qualcuno o partecipa a un&apos;attività per
                iniziare a vedere qualcosa qui!
              </p>
            </div>
          )}

          {feed.map((r) => (
            <div key={r.id} className="relative flex h-screen w-full snap-start items-center justify-center bg-black">
              {eVideo(r.url) ? (
                <video
                  src={r.url}
                  className="h-full w-full object-contain"
                  controls
                  playsInline
                  loop
                />
              ) : (
                <img src={r.url} alt={r.didascalia || ""} className="h-full w-full object-contain" />
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5 pb-8">
                <div className="mb-2 flex items-center gap-2">
                  {r.autore_avatar ? (
                    <img src={r.autore_avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-teal-500 text-sm font-black">
                      {(r.autore_nome?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                  <p className="font-black">{r.autore_nome || "Utente Vybe"}</p>
                </div>

                <Link href={`/attivita/${r.attivita_id}`} className="text-sm font-bold text-teal-300">
                  📍 {r.attivita_titolo}
                </Link>

                {r.didascalia && <p className="mt-1 text-sm text-white/90">{r.didascalia}</p>}
              </div>
            </div>
          ))}

          {!fineFeed && <div ref={sentinellaRef} className="h-4" />}

          {caricandoFeed && feed.length > 0 && (
            <div className="flex h-24 items-center justify-center">
              <p className="text-xs text-white/60">Carico altri ricordi...</p>
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-screen px-4 pb-10 pt-20">
          {caricandoArchivio ? (
            <p className="text-sm text-white/60">Carico...</p>
          ) : archivio.length === 0 ? (
            <div className="flex flex-col items-center gap-3 pt-20 text-center">
              <p className="text-5xl">📷</p>
              <p className="font-bold text-white/80">Non hai ancora caricato nessun ricordo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {archivio.map((r) => (
                <Link
                  key={r.id}
                  href={`/attivita/${r.attivita_id}`}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-slate-800"
                >
                  {eVideo(r.url) ? (
                    <>
                      <video src={r.url} className="h-full w-full object-cover" muted />
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-black">
                        ▶
                      </span>
                    </>
                  ) : (
                    <img src={r.url} alt={r.didascalia || ""} className="h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="truncate text-[11px] font-bold text-white">{r.attivita_titolo}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
