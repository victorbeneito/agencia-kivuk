import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Quién es el que está mirando la pantalla.
 *
 * Todo el panel se bifurca aquí: la agencia entra por `/dashboard` y ve a todos
 * sus clientes; el cliente entra por `/panel` y solo se ve a sí mismo. El
 * middleware ya reparte por rutas, pero cada página lo vuelve a comprobar: una
 * redirección es una comodidad de navegación, no una medida de seguridad.
 */
export type Rol = "agency_admin" | "client_user";

export type Perfil = {
  userId: string;
  email: string | null;
  rol: Rol;
  agencyId: string | null;
  clientId: string | null;
};

export async function getPerfil(): Promise<Perfil | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from("user_profiles")
    .select("role, agency_id, client_id")
    .eq("id", user.id)
    .single();

  // Un usuario de Supabase Auth sin fila en `user_profiles` no puede estar en
  // ningún panel: no sabemos de quién es. Se trata como si no hubiera sesión.
  if (!perfil) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    rol: perfil.role as Rol,
    agencyId: perfil.agency_id,
    clientId: perfil.client_id,
  };
}

/** Página del panel de agencia: exige `agency_admin`. */
export async function requireAgencia(): Promise<Perfil> {
  const perfil = await getPerfil();
  if (!perfil) redirect("/login");
  if (perfil.rol !== "agency_admin") redirect("/panel");
  return perfil;
}

/** Página del panel de cliente: exige `client_user` con cliente asignado. */
export async function requireCliente(): Promise<Perfil & { clientId: string }> {
  const perfil = await getPerfil();
  if (!perfil) redirect("/login");
  if (perfil.rol !== "client_user" || !perfil.clientId) redirect("/dashboard");
  return { ...perfil, clientId: perfil.clientId };
}

/**
 * Puerta para las server actions que usan `service_role`.
 *
 * `service_role` se salta la RLS por diseño — es lo que permite que el panel
 * escriba cosas que el usuario no puede escribir directamente (aprobar una
 * pieza, tomar el mando de un chat). El precio es que la comprobación de a
 * quién pertenece ese dato deja de ser automática y hay que hacerla aquí, antes
 * de tocar nada. Si esto no se llama, cualquier usuario autenticado podría
 * mandar el `clientId` de otro.
 */
export async function exigirAccesoACliente(clientId: string): Promise<Perfil> {
  const perfil = await getPerfil();
  if (!perfil) redirect("/login");

  if (perfil.rol === "client_user") {
    if (perfil.clientId !== clientId) {
      throw new Error("Sin acceso a este cliente.");
    }
    return perfil;
  }

  // La agencia: solo sus propios clientes. Se pregunta con el cliente que
  // respeta RLS, así que si la fila no aparece es que no es suyo.
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();

  if (!data) throw new Error("Sin acceso a este cliente.");
  return perfil;
}

/** Módulos contratados y activos de un cliente, para dibujar su navegación. */
export async function modulosActivos(clientId: string): Promise<Set<string>> {
  const supabase = await createClient();

  // Vista sin el `config`: ahí viven las credenciales y el cliente no las ve.
  const { data } = await supabase
    .from("client_modules_publicos")
    .select("module, active")
    .eq("client_id", clientId);

  return new Set(
    (data ?? []).filter((m) => m.active).map((m) => m.module as string)
  );
}
