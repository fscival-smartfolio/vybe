import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center">
      <p className="bg-gradient-to-r from-indigo-600 to-teal-500 bg-clip-text text-3xl font-black tracking-tight text-transparent">
        Vybe
      </p>

      <div>
        <h1 className="text-2xl font-black text-slate-900">
          Questa pagina non esiste 🤔
        </h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          Il link che hai seguito non porta da nessuna parte, o l&apos;attività che cercavi
          potrebbe essere scaduta.
        </p>
      </div>

      <Link
        href="/"
        className="rounded-xl bg-gradient-to-r from-indigo-600 to-teal-500 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:scale-[1.02] hover:shadow-md"
      >
        ← Torna alla home
      </Link>
    </main>
  );
}
