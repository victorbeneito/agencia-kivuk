"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { exigirAccesoACliente, getPerfil } from "@/lib/auth";

/**
 * Alta y mantenimiento de los usuarios que entran al panel del cliente.
 *
 * Crear un usuario en Supabase Auth solo se puede hacer con `service_role`, así
 * que estas acciones se saltan la RLS por definición: la comprobación de a
 * quién pertenece el cliente la hace `exigirAccesoACliente` antes de tocar
 * nada, y además se exige rol de agencia — un cliente no se da de alta a sí
 * mismo ni a sus compañeros.
 */

export type ResultadoAcceso = {
  ok: boolean;
  mensaje: string;
  /** Solo al crear o restablecer: se enseña una vez y no se guarda en claro. */
  password?: string;
};

/**
 * Contraseña temporal legible: sin caracteres que se confundan al dictarla por
 * teléfono (l/1, O/0). No pretende ser definitiva — el cliente la cambia — pero
 * sí ser larga y aleatoria de verdad, no un "cliente1234".
 */
function generarPassword(): string {
  const alfabeto = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(14);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

async function soloAgencia(clientId: string) {
  const perfil = await getPerfil();
  if (!perfil || perfil.rol !== "agency_admin") {
    throw new Error("Solo la agencia puede gestionar los accesos.");
  }
  await exigirAccesoACliente(clientId);
}

export async function crearAccesoCliente(
  clientId: string,
  email: string
): Promise<ResultadoAcceso> {
  await soloAgencia(clientId);

  const correo = email.trim().toLowerCase();
  if (!correo) return { ok: false, mensaje: "Falta el email." };

  const admin = createServiceRoleClient();
  const password = generarPassword();

  const { data, error } = await admin.auth.admin.createUser({
    email: correo,
    password,
    // Sin confirmación por correo: el acceso se entrega a mano y el cliente no
    // tiene por qué pasar por una bandeja de entrada para estrenarlo.
    email_confirm: true,
  });

  if (error || !data.user) {
    return {
      ok: false,
      mensaje:
        error?.message.includes("already been registered")
          ? "Ya existe un usuario con ese email."
          : `No se pudo crear el usuario: ${error?.message ?? "sin detalle"}`,
    };
  }

  const { error: errorPerfil } = await admin.from("user_profiles").insert({
    id: data.user.id,
    client_id: clientId,
    role: "client_user",
  });

  if (errorPerfil) {
    // Un usuario de Auth sin perfil no puede entrar a ninguna parte y además
    // ocupa el email, así que no se deja a medias: se deshace.
    await admin.auth.admin.deleteUser(data.user.id);
    return {
      ok: false,
      mensaje: `No se pudo asignar el cliente: ${errorPerfil.message}`,
    };
  }

  revalidatePath(`/dashboard/${clientId}/configuracion`);

  return {
    ok: true,
    mensaje: `Acceso creado para ${correo}.`,
    password,
  };
}

export async function restablecerPasswordCliente(
  clientId: string,
  userId: string
): Promise<ResultadoAcceso> {
  await soloAgencia(clientId);

  const admin = createServiceRoleClient();

  // Que el usuario sea de este cliente se comprueba contra `user_profiles`, no
  // contra lo que llegue del formulario: si no, bastaría con mandar el id de
  // cualquier otro usuario para cambiarle la contraseña.
  const { data: perfil } = await admin
    .from("user_profiles")
    .select("client_id")
    .eq("id", userId)
    .single();

  if (!perfil || perfil.client_id !== clientId) {
    return { ok: false, mensaje: "Ese usuario no es de este cliente." };
  }

  const password = generarPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });

  if (error) {
    return { ok: false, mensaje: `No se pudo cambiar: ${error.message}` };
  }

  return { ok: true, mensaje: "Contraseña nueva generada.", password };
}

export async function eliminarAccesoCliente(
  clientId: string,
  userId: string
): Promise<ResultadoAcceso> {
  await soloAgencia(clientId);

  const admin = createServiceRoleClient();

  const { data: perfil } = await admin
    .from("user_profiles")
    .select("client_id")
    .eq("id", userId)
    .single();

  if (!perfil || perfil.client_id !== clientId) {
    return { ok: false, mensaje: "Ese usuario no es de este cliente." };
  }

  // `user_profiles.id` referencia a `auth.users` con `on delete cascade`, así
  // que borrar el usuario se lleva por delante su perfil.
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    return { ok: false, mensaje: `No se pudo eliminar: ${error.message}` };
  }

  revalidatePath(`/dashboard/${clientId}/configuracion`);
  return { ok: true, mensaje: "Acceso eliminado." };
}
