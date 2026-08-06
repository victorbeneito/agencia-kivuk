"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_VISTA, exigirAccesoACliente, getPerfil } from "@/lib/auth";

/**
 * «Ver su panel»: la agencia mira `/panel` tal y como lo ve un cliente.
 *
 * Nace de una pregunta razonable —«¿puedo ver la contraseña del cliente por si
 * necesito entrar?»— que no tiene respuesta: Supabase guarda un hash bcrypt, no
 * la contraseña, y eso es lo correcto. Lo que sí se puede hacer es entrar con tu
 * propio usuario a mirar su panel, que además deja rastro de quién ha sido y no
 * obliga a nadie a compartir credenciales.
 *
 * Solo cambia lo que se pinta: los datos se leen con la sesión de la agencia,
 * que por RLS ya ve todo lo de sus clientes.
 */
export async function verComoCliente(clientId: string) {
  const perfil = await getPerfil();
  if (!perfil || perfil.rol !== "agency_admin") {
    throw new Error("Solo la agencia puede ver el panel de un cliente.");
  }

  await exigirAccesoACliente(clientId);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_VISTA, clientId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    // Dura lo que dure el rato de mirar. Sin caducidad, un despiste deja a la
    // agencia navegando por el panel de un cliente sin acordarse de por qué.
    maxAge: 60 * 60,
  });

  redirect("/panel");
}

export async function salirDeLaVista() {
  const cookieStore = await cookies();
  const clientId = cookieStore.get(COOKIE_VISTA)?.value;
  cookieStore.delete(COOKIE_VISTA);

  redirect(clientId ? `/dashboard/${clientId}` : "/dashboard");
}
