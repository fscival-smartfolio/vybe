"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function Registrazione() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [citta, setCitta] = useState("");
  const [accettaTermini, setAccettaTermini] = useState(false);

  const [errore, setErrore] = useState("");
  const [caricamento, setCaricamento] = useState(false);

  async function registrati(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setErrore("");

    if (!nome.trim() || !email.trim() || !password.trim()) {
      setErrore("Compila tutti i campi obbligatori.");
      return;
    }

    if (password.length < 6) {
      setErrore("La password deve contenere almeno 6 caratteri.");
      return;
    }

    if (!accettaTermini) {
      setErrore("Devi accettare i Termini e la Dichiarazione di responsabilità per continuare.");
      return;
    }

    setCaricamento(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("Registrazione non completata.");
      }

      const { error: profiloError } = await supabase
        .from("profili")
        .insert({
          id: data.user.id,
          nome: nome.trim(),
          cognome: cognome.trim() || null,
          citta: citta.trim() || null,
        });

      if (profiloError) {
        throw profiloError;
      }

      router.push("/");
      router.refresh();

    } catch (err: any) {
      console.error(err);

      setErrore(
        err?.message ||
          "Si è verificato un errore durante la registrazione."
      );

    } finally {
      setCaricamento(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">

      <div className="mx-auto max-w-md">

        <div className="mb-8 text-center">

          <Link
            href="/"
            className="text-4xl font-black tracking-tight text-slate-900"
          >
            Vy<span className="text-indigo-600">be</span>
          </Link>

          <h1 className="mt-6 text-3xl font-black text-slate-900">
            Crea il tuo account
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Entra in Vybe e trova persone con le tue stesse passioni.
          </p>

        </div>

        <form
          onSubmit={registrati}
          className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200"
        >

          <div className="space-y-4">

            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700">
                Nome *
              </label>

              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Il tuo nome"
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700">
                Cognome
              </label>

              <input
                type="text"
                value={cognome}
                onChange={(e) => setCognome(e.target.value)}
                placeholder="Il tuo cognome"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700">
                Città
              </label>

              <input
                type="text"
                value={citta}
                onChange={(e) => setCitta(e.target.value)}
                placeholder="Es. Brindisi"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700">
                Email *
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@email.com"
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700">
                Password *
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Almeno 6 caratteri"
                required
                minLength={6}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <label className="flex items-start gap-2.5 pt-1">
              <input
                type="checkbox"
                checked={accettaTermini}
                onChange={(e) => setAccettaTermini(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-indigo-600"
              />
              <span className="text-xs leading-5 text-slate-600">
                Ho letto e accetto i{" "}
                <Link href="/termini" target="_blank" className="font-bold text-indigo-600 hover:underline">
                  Termini e la Dichiarazione di responsabilità
                </Link>
                , e confermo di avere l&apos;età minima richiesta.
              </span>
            </label>

          </div>

          {errore && (
            <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {errore}
            </div>
          )}

          <button
            type="submit"
            disabled={caricamento || !accettaTermini}
            className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {caricamento
              ? "Creazione account..."
              : "Crea account"}
          </button>

          <p className="mt-5 text-center text-sm text-slate-500">
            Hai già un account?{" "}

            <Link
              href="/accesso"
              className="font-bold text-indigo-600 hover:underline"
            >
              Accedi
            </Link>

          </p>

        </form>

      </div>

    </main>
  );
}
