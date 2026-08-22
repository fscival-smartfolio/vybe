import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const ESTENSIONI_VALIDE = ["png", "jpg", "jpeg", "webp"];
const TIPI_VALIDI = ["image/png", "image/jpeg", "image/webp"];

export async function POST(request: Request) {
  try {
    // ------------------------------------------------------------
    // 1) Chi sta facendo davvero questa richiesta? Lo chiediamo alla
    // sessione (cookie), MAI a un campo del form. Questo è il fix
    // del problema critico: prima l'identità veniva presa da un
    // campo "userId" che chiunque poteva scrivere a piacere.
    // ------------------------------------------------------------
    const cookieStore = await cookies();

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Non dobbiamo scrivere cookie in questa route.
          },
        },
      }
    );

    const {
      data: { user },
      error: erroreAuth,
    } = await supabaseAuth.auth.getUser();

    if (erroreAuth || !user) {
      return NextResponse.json({ error: "Devi essere autenticato." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const userIdRichiesto = formData.get("userId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File non valido." }, { status: 400 });
    }

    // ------------------------------------------------------------
    // 2) Di default puoi modificare SOLO la tua foto. Se viene
    // richiesto di modificare quella di un altro utente, verifichiamo
    // (lato server, con una query reale) che chi chiama sia admin.
    // ------------------------------------------------------------
    let userId = user.id;

    if (typeof userIdRichiesto === "string" && userIdRichiesto && userIdRichiesto !== user.id) {
      const { data: èAdmin } = await supabaseAuth.rpc("is_admin");

      if (!èAdmin) {
        return NextResponse.json(
          { error: "Non hai i permessi per modificare la foto di un altro utente." },
          { status: 403 }
        );
      }

      userId = userIdRichiesto;
    }

    // ------------------------------------------------------------
    // 3) Validazione file: whitelist di tipo MIME *e* di estensione
    // (il client può dichiarare un MIME falso, l'estensione del nome
    // file è un secondo controllo). Niente SVG: in un bucket pubblico
    // verrebbero serviti come HTML inline, un vettore XSS.
    // ------------------------------------------------------------
    if (!TIPI_VALIDI.includes(file.type)) {
      return NextResponse.json({ error: "Formato immagine non supportato." }, { status: 400 });
    }

    const estensione = file.name.split(".").pop()?.toLowerCase() || "";

    if (!ESTENSIONI_VALIDE.includes(estensione)) {
      return NextResponse.json({ error: "Estensione file non supportata." }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "La foto deve essere inferiore a 5 MB." }, { status: 400 });
    }

    // ------------------------------------------------------------
    // 4) Solo ORA, dopo aver verificato chi sei e cosa puoi fare,
    // usiamo il service role — solo per l'operazione tecnica di
    // storage, mai per decidere l'identità di chi chiama.
    // ------------------------------------------------------------
    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const percorso = `${userId}/avatar.${estensione}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabaseService.storage
      .from("avatars")
      .upload(percorso, bytes, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("ERRORE STORAGE SERVER:", uploadError);
      return NextResponse.json({ error: "Caricamento non riuscito, riprova." }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabaseService.storage.from("avatars").getPublicUrl(percorso);

    const urlFinale = `${publicUrl}?v=${Date.now()}`;

    const { error: profiloError } = await supabaseService
      .from("profili")
      .update({ avatar_url: urlFinale })
      .eq("id", userId);

    if (profiloError) {
      console.error("ERRORE PROFILO:", profiloError);
      return NextResponse.json({ error: "Aggiornamento profilo non riuscito." }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: urlFinale });
  } catch (error: any) {
    // Non esponiamo mai il messaggio di errore interno al client.
    console.error("ERRORE API AVATAR:", error);
    return NextResponse.json(
      { error: "Errore durante il caricamento della foto." },
      { status: 500 }
    );
  }
}
