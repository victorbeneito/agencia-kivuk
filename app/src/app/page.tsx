import { redirect } from "next/navigation";
import { getPerfil } from "@/lib/auth";

// La raíz no tiene contenido propio: es el cruce donde se decide a qué panel
// pertenece cada uno. Sin sesión, a /login; la agencia a su panel y el cliente
// al suyo. Concentrarlo aquí evita que el login, el logout y cualquier enlace
// suelto tengan que saber de roles.
export default async function Home() {
  const perfil = await getPerfil();

  if (!perfil) redirect("/login");
  redirect(perfil.rol === "client_user" ? "/panel" : "/dashboard");
}
