"use client";

import { useLingua } from "./LinguaProvider";
import { Lingua } from "@/lib/i18n";

const OPZIONI: { codice: Lingua; bandiera: string; etichetta: string }[] = [
  { codice: "it", bandiera: "🇮🇹", etichetta: "IT" },
  { codice: "en", bandiera: "🇬🇧", etichetta: "EN" },
  { codice: "es", bandiera: "🇪🇸", etichetta: "ES" },
];

export default function SelettoreLingua() {
  const { lingua, impostaLingua } = useLingua();

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-slate-200 p-0.5">
      {OPZIONI.map((o) => (
        <button
          key={o.codice}
          onClick={() => impostaLingua(o.codice)}
          className={`rounded-full px-2 py-1 text-xs font-bold transition ${
            lingua === o.codice ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-700"
          }`}
          aria-label={`Lingua ${o.etichetta}`}
        >
          {o.bandiera}
        </button>
      ))}
    </div>
  );
}
