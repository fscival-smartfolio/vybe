import Link from "next/link";

export default function Termini() {
  return (
    <main className="min-h-screen bg-slate-50 pb-20 text-slate-900">
      <header className="border-b bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="text-sm font-bold text-slate-500 hover:text-indigo-600">
            ← Torna alla home
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-10">
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-indigo-600">
          Bozza di lavoro
        </p>
        <h1 className="mb-8 text-3xl font-black text-slate-900">
          Dichiarazione di responsabilità — Incontri tra utenti
        </h1>

        <div className="space-y-8 text-sm leading-relaxed text-slate-700">
          <section>
            <h2 className="mb-2 text-lg font-black text-slate-900">1. Natura del servizio</h2>
            <p>
              Vybe è una piattaforma che permette agli utenti di pubblicare proposte di attività e
              di mettersi in contatto con altre persone interessate a parteciparvi.{" "}
              <strong>
                Vybe non organizza, non supervisiona e non garantisce lo svolgimento delle attività
                pubblicate dagli utenti.
              </strong>{" "}
              Ogni attività è ideata, proposta e gestita autonomamente dall&apos;utente che la crea.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-black text-slate-900">2. Partecipazione a proprio rischio</h2>
            <p className="mb-3">
              Incontrarsi di persona con altre persone conosciute tramite l&apos;app è una scelta
              libera e personale di ciascun utente. Partecipando a un&apos;attività, l&apos;utente
              riconosce e accetta che:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Vybe <strong>non verifica l&apos;identità, le intenzioni o il comportamento</strong>{" "}
                degli altri utenti oltre ai controlli minimi previsti in fase di registrazione;
              </li>
              <li>
                il <strong>punteggio di affidabilità</strong> mostrato sui profili è un indicatore
                basato sulle conferme di presenza raccolte nel tempo e{" "}
                <strong>non costituisce garanzia</strong> sulla condotta, affidabilità o sicurezza
                di un utente;
              </li>
              <li>
                la decisione di incontrare, frequentare o svolgere un&apos;attività con un altro
                utente è <strong>esclusiva responsabilità della persona che vi partecipa</strong>;
              </li>
              <li>
                Vybe non è responsabile per eventuali danni, furti, infortuni, controversie o
                qualsiasi altro evento spiacevole che dovesse verificarsi prima, durante o dopo un
                incontro organizzato tramite la piattaforma.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-black text-slate-900">3. Raccomandazioni per incontri sicuri</h2>
            <p className="mb-3">Per la propria sicurezza, si raccomanda agli utenti di:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>prediligere, specialmente per un primo incontro, luoghi pubblici e frequentati;</li>
              <li>informare un amico o un familiare su dove e con chi ci si sta recando;</li>
              <li>non condividere dati sensibili, informazioni finanziarie o documenti con altri utenti;</li>
              <li>
                utilizzare la funzione di <strong>segnalazione</strong> presente nell&apos;app in
                caso di comportamenti scorretti, molesti o sospetti;
              </li>
              <li>
                affidarsi sempre al proprio giudizio personale: nessun sistema, punteggio o verifica
                sostituisce il buon senso.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-black text-slate-900">4. Contenuti generati dagli utenti</h2>
            <p>
              Titoli, descrizioni, foto e altri contenuti pubblicati (comprese le foto caricate
              nella sezione &quot;Ricordo del Join&quot;) sono creati dagli utenti sotto la loro
              responsabilità. Vybe si riserva il diritto di rimuovere contenuti segnalati come
              inappropriati o in violazione dei termini d&apos;uso, ma non è tenuta a un controllo
              preventivo sistematico di ogni contenuto pubblicato.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-black text-slate-900">5. Limitazione di responsabilità</h2>
            <p className="mb-3">
              Nei limiti massimi consentiti dalla legge applicabile, Vybe non potrà essere ritenuta
              responsabile per danni diretti, indiretti, incidentali o consequenziali derivanti da:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>l&apos;uso o l&apos;impossibilità di utilizzare il servizio;</li>
              <li>il comportamento di altri utenti, online o in occasione di incontri di persona;</li>
              <li>
                la cancellazione, modifica o mancata realizzazione di un&apos;attività pubblicata da
                un utente.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-black text-slate-900">6. Età minima e idoneità</h2>
            <p>
              L&apos;utilizzo di Vybe è riservato a persone che abbiano compiuto la maggiore età
              prevista dalla legge del proprio paese di residenza.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-black text-slate-900">7. Modifiche</h2>
            <p>
              Vybe si riserva il diritto di modificare la presente dichiarazione in qualsiasi
              momento. L&apos;uso continuato del servizio dopo una modifica costituisce accettazione
              dei nuovi termini.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
