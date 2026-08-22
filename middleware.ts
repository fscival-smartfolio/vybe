import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Le route API si gestiscono i propri controlli da sole (vedi
  // app/api/profilo/avatar/route.ts): qui le lasciamo passare senza
  // reindirizzarle, altrimenti una richiesta non autenticata riceverebbe
  // una redirect HTML invece di una risposta JSON pulita.
  if (pathname.startsWith("/api/")) {
    return response;
  }

  // Pagine pubbliche
  const paginePubbliche = [
    "/",
    "/accesso",
    "/registrazione",
    "/termini",
  ];

  const paginaPubblica = paginePubbliche.includes(pathname);

  // Se non è loggato e prova ad accedere a una pagina privata
  if (!user && !paginaPubblica) {
    return NextResponse.redirect(
      new URL("/accesso", request.url)
    );
  }

  // Controllo speciale per il pannello amministratore
  const ADMIN_ID = "ffe0dab2-cb25-48de-a401-f2b7946619b0";

  if (pathname.startsWith("/admin")) {
    if (!user || user.id !== ADMIN_ID) {
      return NextResponse.redirect(
        new URL("/", request.url)
      );
    }
  }

  // Controllo stato dell'utente
  if (user) {
    const { data: profilo } = await supabase
      .from("profili")
      .select("stato")
      .eq("id", user.id)
      .single();

    if (profilo?.stato === "bannato") {
      const url = request.nextUrl.clone();
      url.pathname = "/accesso";
      url.searchParams.set("errore", "bannato");

      return NextResponse.redirect(url);
    }

    if (profilo?.stato === "sospeso") {
      const url = request.nextUrl.clone();
      url.pathname = "/accesso";
      url.searchParams.set("errore", "sospeso");

      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Esegue il proxy sulle pagine dell'app,
     * escludendo file statici e risorse interne di Next.js.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
