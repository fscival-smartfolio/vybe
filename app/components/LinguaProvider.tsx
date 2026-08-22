"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { TRADUZIONI, Lingua, ChiaveTraduzione } from "@/lib/i18n";

type ContestoLingua = {
  lingua: Lingua;
  impostaLingua: (l: Lingua) => void;
  t: (chiave: ChiaveTraduzione) => string;
};

const Contesto = createContext<ContestoLingua | null>(null);

export function LinguaProvider({ children }: { children: ReactNode }) {
  const [lingua, setLingua] = useState<Lingua>("it");

  useEffect(() => {
    const salvata = localStorage.getItem("vybe_lingua") as Lingua | null;

    if (salvata && (salvata === "it" || salvata === "en" || salvata === "es")) {
      setLingua(salvata);
      return;
    }

    // Se non ha mai scelto, proponiamo la lingua del browser se supportata.
    const browserLang = navigator.language.slice(0, 2);
    if (browserLang === "en" || browserLang === "es") {
      setLingua(browserLang as Lingua);
    }
  }, []);

  function impostaLingua(l: Lingua) {
    setLingua(l);
    localStorage.setItem("vybe_lingua", l);
  }

  function t(chiave: ChiaveTraduzione): string {
    return TRADUZIONI[lingua][chiave] || TRADUZIONI.it[chiave];
  }

  return (
    <Contesto.Provider value={{ lingua, impostaLingua, t }}>{children}</Contesto.Provider>
  );
}

export function useLingua() {
  const ctx = useContext(Contesto);
  if (!ctx) throw new Error("useLingua va usato dentro <LinguaProvider>");
  return ctx;
}
