"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Ricordo = {
  id: string;
  media_url: string;
  descrizione: string;
  pubblico: boolean;
  user_id: string;
  created_at: string;
  vybe_count?: number;
  ha_messo_vybe?: boolean;
  commenti?: { id: string; testo: string; user_id: string }[];
};

export default function PaginaRicordi() {
  const [tab, setTab] = useState<"miei" | "feed">("miei");
  const [ricordi, setRicordi] = useState<Ricordo[]>([]);
  const [loading, setLoading] = useState(true);
  const [testoCommento, setTestoCommento] = useState<{ [key: string]: string }>({});
  const supabase = createClient();

  useEffect(() => {
    caricaRicordi();
  }, [tab]);

  async function caricaRicordi() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase.from("ricordi").select("*").order("created_at", { ascending: false });

    if (tab === "miei") {
      if (user) query = query.eq("user_id", user.id);
    } else {
      query = query.eq("pubblico", true);
    }

    const { data, error } = await query;
    if (!error && data) {
      const ricordiArricchiti = await Promise.all(
        data.map(async (ricordo) => {
          const { count } = await supabase
            .from("ricordi_vybe")
            .select("*", { count: "exact", head: true })
            .eq("ricordo_id", ricordo.id);

          let haVybe = false;
          if (user) {
            const { data: userVybe } = await supabase
              .from("ricordi_vybe")
              .select("id")
              .eq("ricordo_id", ricordo.id)
              .eq("user_id", user.id)
              .maybeSingle();
            if (userVybe) haVybe = true;
          }

          const { data: commentiData } = await supabase
            .from("ricordi_commenti")
            .select("*")
            .eq("ricordo_id", ricordo.id)
            .order("created_at", { ascending: true });

          return {
            ...ricordo,
            vybe_count: count || 0,
            ha_messo_vybe: haVybe,
            commenti: commentiData || [],
          };
        })
      );
      setRicordi(ricordiArricchiti);
    }
    setLoading(false);
  }

  async function toggleVybe(ricordoId: string, haVybe: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (haVybe) {
      await supabase.from("ricordi_vybe").delete().eq("ricordo_id", ricordoId).eq("user_id", user.id);
    } else {
      await supabase.from("ricordi_vybe").insert({ ricordo_id: ricordoId, user_id: user.id });
    }

    setRicordi(
      ricordi.map((r) =>
        r.id === ricordoId
          ? {
              ...r,
              ha_messo_vybe: !haVybe,
              vybe_count: haVybe ? (r.vybe_count || 1) - 1 : (r.vybe_count || 0) + 1,
            }
          : r
      )
    );
  }

  async function inviaCommento(ricordoId: string) {
    const testo = testoCommento[ricordoId];
    if (!testo || !testo.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("ricordi_commenti")
      .insert({ ricordo_id: ricordoId, user_id: user.id, testo: testo.trim() })
      .select()
      .single();

    if (!error && data) {
      setRicordi(
        ricordi.map((r) =>
          r.id === ricordoId ? { ...r, commenti: [...(r.commenti || []), data] } : r
        )
      );
      setTestoCommento({ ...testoCommento, [ricordoId]: "" });
    }
  }

  async function eliminaRicordo(id: string) {
    if (!window.confirm("Vuoi davvero eliminare questo ricordo?")) return;
    const { error } = await supabase.from("ricordi").delete().eq("id", id);
    if (!error) {
      caricaRicordi();
    }
  }

  async function togglePubblico(id: string, statoAttuale: boolean) {
    const nuovoStato = !statoAttuale;
    await supabase.from("ricordi").update({ pubblico: nuovoStato }).eq("id", id);
    setRicordi(ricordi.map((r) => (r.id === id ? { ...r, pubblico: nuovoStato } : r)));
  }

  return (
    <div className="max-w-xl mx-auto p-4 pb-24">
      {/* Barra superiore con tasto Home */}
      <div className="flex items-center justify-between mb-4">
        <Link 
          href="/" 
          className="text-sm font-medium bg-gray-100 px-3 py-1.5 rounded-lg text-gray-700 hover:bg-gray-200"
        >
          ← Torna alla Home
        </Link>
        <h1 className="font-bold text-lg">Ricordi & Feed</h1>
        <div className="w-16"></div>
      </div>

      {/* Selettore Tab */}
      <div className="flex border-b mb-6 bg-white sticky top-0 z-10">
        <button
          onClick={() => setTab("miei")}
          className={`flex-1 py-3 font-semibold text-center ${
            tab === "miei" ? "border-b-2 border-black text-black" : "text-gray-400"
          }`}
        >
          I Miei Ricordi
        </button>
        <button
          onClick={() => setTab("feed")}
          className={`flex-1 py-3 font-semibold text-center ${
            tab === "feed" ? "border-b-2 border-black text-black" : "text-gray-400"
          }`}
        >
          Feed Pubblico ⚡
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-10">Caricamento in corso...</p>
      ) : ricordi.length === 0 ? (
        <p className="text-center text-gray-400 py-10">Nessun ricordo trovato.</p>
      ) : (
        <div className="space-y-6">
          {ricordi.map((ricordo) => (
            <div key={ricordo.id} className="bg-white border rounded-2xl overflow-hidden shadow-sm">
              <img src={ricordo.media_url} alt="Ricordo" className="w-full h-80 object-cover" />
              
              <div className="p-4 space-y-3">
                <p className="text-gray-800">{ricordo.descrizione}</p>

                <div className="flex items-center justify-between pt-2 border-t">
                  <button
                    onClick={() => toggleVybe(ricordo.id, !!ricordo.ha_messo_vybe)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition ${
                      ricordo.ha_messo_vybe
                        ? "bg-pink-500 text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <span>⚡ Vybe</span>
                    <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-xs">
                      {ricordo.vybe_count || 0}
                    </span>
                  </button>

                  {tab === "miei" && (
                    <div className="flex items-center gap-3 text-sm">
                      <button
                        onClick={() => togglePubblico(ricordo.id, ricordo.pubblico)}
                        className={`px-3 py-1 rounded-full font-medium ${
                          ricordo.pubblico ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {ricordo.pubblico ? "Nel Feed 🌐" : "Rendi Pubblico 🚀"}
                      </button>
                      <button
                        onClick={() => eliminaRicordo(ricordo.id)}
                        className="text-red-500 hover:underline"
                      >
                        Elimina 🗑️
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t space-y-2">
                  <div className="max-h-32 overflow-y-auto space-y-1.5">
                    {ricordo.commenti?.map((c) => (
                      <div key={c.id} className="text-xs bg-gray-50 p-2 rounded-lg">
                        <span className="text-gray-800">{c.testo}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Scrivi un commento..."
                      value={testoCommento[ricordo.id] || ""}
                      onChange={(e) =>
                        setTestoCommento({ ...testoCommento, [ricordo.id]: e.target.value })
                      }
                      className="flex-1 text-xs border rounded-lg px-3 py-2 outline-none focus:border-black"
                    />
                    <button
                      onClick={() => inviaCommento(ricordo.id)}
                      className="bg-black text-white text-xs px-3 py-2 rounded-lg font-medium"
                    >
                      Invia
                    </button>
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}