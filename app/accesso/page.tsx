"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function Accesso() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errore, setErrore] = useState("");
  const [caricamento, setCaricamento] = useState(false);

  async function accedi(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setErrore("");
    setCaricamento(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      router.push("/");
      router.refresh();

    } catch (err: any) {
      console.error(err);

      setErrore(
        err?.message || "Email o password non corrette."
      );

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
            Bentornato!
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Accedi al tuo account Vybe.
          </p>

        </div>

        <form
          onSubmit={accedi}
          className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200"
        >

          <div>

            <label className="mb-1.5 block text-sm font-bold text-slate-700">
              Email
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

          <div className="mt-4">

            <label className="mb-1.5 block text-sm font-bold text-slate-700">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="La tua password"
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />

          </div>

          {errore && (
            <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {errore}
            </div>
          )}

          <button
            type="submit"
            disabled={caricamento}
            className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {caricamento ? "Accesso..." : "Accedi"}
          </button>

          <p className="mt-5 text-center text-sm text-slate-500">
            Non hai ancora un account?{" "}

            <Link
              href="/registrazione"
              className="font-bold text-indigo-600 hover:underline"
            >
              Registrati
            </Link>

          </p>

        </form>

      </div>

    </main>
  );
}
