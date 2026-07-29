import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente de Supabase para usar en Server Components / API routes.
// Usa la anon key + cookies de sesión del usuario, respeta RLS.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Se puede ignorar si se llama desde un Server Component sin
            // posibilidad de escribir cookies (Next.js lo gestiona en el middleware).
          }
        },
      },
    }
  );
}

// Cliente con service_role, SOLO para uso interno de servidor (API routes,
// nunca en un componente que se ejecute en el navegador). Bypassa RLS.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
