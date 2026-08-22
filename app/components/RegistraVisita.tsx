"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RegistraVisita() {
  useEffect(() => {
    const supabase = createClient();

    async function registra() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        let sessionId = sessionStorage.getItem("joinup_session_id");

        if (!sessionId) {
          sessionId = crypto.randomUUID();
          sessionStorage.setItem("joinup_session_id", sessionId);
        }

        await supabase.from("visite").insert({
          session_id: sessionId,
          pagina: window.location.pathname,
          user_id: user?.id || null,
        });
      } catch (error) {
        console.error("Errore registrazione visita:", error);
      }
    }

    registra();
  }, []);

  return null;
}