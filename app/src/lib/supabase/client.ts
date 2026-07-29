import { createBrowserClient } from "@supabase/ssr";

// Cliente de Supabase para usar en Client Components (navegador).
// Usa la anon key, respeta RLS según el usuario logueado.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
