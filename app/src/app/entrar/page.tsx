import { redirect } from "next/navigation";
import { getPerfil } from "@/lib/auth";

/**
 * El cruce donde se decide a qué panel pertenece cada uno.
 *
 * Esto vivía en la raíz `/`, pero la raíz pasó a ser la web pública: una landing
 * no puede redirigir a nadie ni leer la sesión, porque entonces deja de poder
 * servirse pregenerada. Así que el reparto se mudó aquí y el login manda a
 * `/entrar` en vez de a `/`.
 *
 * No tiene interfaz: entra, mira el rol y sale hacia `/dashboard` o `/panel`.
 */
export default async function Entrar() {
  const perfil = await getPerfil();

  if (!perfil) redirect("/login");
  redirect(perfil.rol === "client_user" ? "/panel" : "/dashboard");
}
