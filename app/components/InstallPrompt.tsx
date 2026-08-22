"use client";

import { useEffect, useState } from "react";

type EventoInstallazione = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPrompt() {
  const [promptEvento, setPromptEvento] = useState<EventoInstallazione | null>(null);
  const [mostra, setMostra] = useState(false);
  const [piattaforma, setPiattaforma] = useState<"android" | "ios" | null>(null);

  useEffect(() => {
    // Se è già installata (l'utente la apre dalla schermata Home), non mostrare nulla.
    const giaInstallata =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (giaInstallata) return;

    // Se l'ha già chiusa di recente, non tornare a infastidire subito.
    const chiusaIl = localStorage.getItem("vybe_install_dismesso");
    if (chiusaIl && Date.now() - Number(chiusaIl) < 7 * 24 * 60 * 60 * 1000) return;

    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

    function alBeforeInstall(e: Event) {
      e.preventDefault();
      setPromptEvento(e as EventoInstallazione);
      setPiattaforma("android");
      setTimeout(() => setMostra(true), 1200);
    }

    if (isIOS) {
      setPiattaforma("ios");
      setTimeout(() => setMostra(true), 1200);
    } else {
      window.addEventListener("beforeinstallprompt", alBeforeInstall);
      return () => window.removeEventListener("beforeinstallprompt", alBeforeInstall);
    }
  }, []);

  function chiudi() {
    setMostra(false);
    localStorage.setItem("vybe_install_dismesso", String(Date.now()));
  }

  async function installa() {
    if (!promptEvento) return;
    await promptEvento.prompt();
    await promptEvento.userChoice;
    setMostra(false);
  }

  if (!mostra) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 sm:left-auto sm:right-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-teal-500 text-lg font-black text-white">
          V
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900">Installa Vybe</p>

          {piattaforma === "ios" ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Tocca <strong>Condividi</strong> (l&apos;icona con la freccia in su) e poi{" "}
              <strong>&quot;Aggiungi alla schermata Home&quot;</strong> per aprirla come
              un&apos;app vera, con le notifiche.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Aggiungila alla schermata Home per aprirla come un&apos;app, senza passare dal
              browser ogni volta.
            </p>
          )}

          <div className="mt-3 flex gap-2">
            {piattaforma === "android" && (
              <button
                onClick={installa}
                className="rounded-lg bg-gradient-to-r from-indigo-600 to-teal-500 px-4 py-2 text-xs font-black text-white"
              >
                Installa
              </button>
            )}

            <button
              onClick={chiudi}
              className="rounded-lg px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              {piattaforma === "ios" ? "Ho capito" : "Non ora"}
            </button>
          </div>
        </div>

        <button
          onClick={chiudi}
          className="shrink-0 text-slate-300 hover:text-slate-500"
          aria-label="Chiudi"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
