import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Dos paneles, una sesión.
 *
 * `/dashboard` es el panel de la agencia y `/panel` el del cliente final. Aquí
 * solo se decide a cuál de los dos pertenece quien llama: sin sesión, a
 * `/login`; con sesión, al que le toca por su rol. La comprobación de verdad
 * está en la RLS de Supabase y en `requireAgencia` / `requireCliente`, que cada
 * página vuelve a llamar. Esto es navegación, no seguridad.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
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

  const ruta = request.nextUrl.pathname;
  const esZonaPrivada = ruta.startsWith("/dashboard") || ruta.startsWith("/panel");

  if (!user) {
    if (esZonaPrivada) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  const { data: perfil } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Sesión válida en Auth pero sin perfil: no sabemos de quién es ese usuario,
  // así que no entra a ninguna parte. Pasa, por ejemplo, si alguien se crea a
  // mano en el panel de Supabase sin darle cliente ni agencia.
  if (!perfil) {
    if (esZonaPrivada) {
      return NextResponse.redirect(new URL("/login?sin_perfil=1", request.url));
    }
    return response;
  }

  const inicio = perfil.role === "client_user" ? "/panel" : "/dashboard";

  if (ruta === "/login") {
    return NextResponse.redirect(new URL(inicio, request.url));
  }

  // Rutas que no son ninguno de los dos paneles (el PDF de una factura, que
  // abren tanto la agencia como el cliente) solo pasan por aquí para que la
  // sesión se refresque antes de leer con RLS. No hay nada que repartir.
  if (!esZonaPrivada) return response;

  // La agencia sí puede estar en `/panel` si ha pulsado «Ver su panel»: la
  // cookie dice de qué cliente. Aquí solo se mira que exista — de quién es ese
  // cliente lo comprueba `clienteDelPanel()` en cada carga, que es donde se
  // puede consultar la base de datos.
  const mirandoUnCliente =
    perfil.role === "agency_admin" &&
    ruta.startsWith("/panel") &&
    Boolean(request.cookies.get("kivuk_vista_cliente")?.value);

  if (!ruta.startsWith(inicio) && !mirandoUnCliente) {
    return NextResponse.redirect(new URL(inicio, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/panel/:path*",
    "/login",
    // El PDF se sirve con la sesión del usuario: si el token ha caducado y no
    // se refresca antes, la consulta con RLS no devuelve nada y la factura
    // parecería no existir.
    "/api/facturas/:path*",
  ],
};
