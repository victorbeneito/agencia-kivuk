import { cookies } from "next/headers";
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
 * Cookie con la que la agencia mira el panel de un cliente concreto.
 *
 * Va en cookie y no en la URL porque los layouts de Next.js no reciben
 * `searchParams`, y es el layout el que necesita saber de quién es el panel para
 * dibujar la barra lateral. `httpOnly` para que no la pueda escribir un script
 * desde el navegador — aunque el valor se valida en cada lectura de todas
 * formas, así que fabricarla a mano no daría acceso a nada.
 */
export const COOKIE_VISTA = "kivuk_vista_cliente";

export type ContextoPanel = {
  clientId: string;
  /** La agencia mirando el panel de un cliente, no el cliente. */
  esVistaDeAgencia: boolean;
  email: string | null;
};

/**
 * De quién es el panel que se está pintando.
 *
 * Dos formas de llegar a `/panel`: el cliente entra al suyo, o la agencia pulsa
 * «Ver su panel» desde la ficha del cliente. La segunda existe porque nadie
 * puede saber la contraseña de un cliente —Supabase guarda un hash, no la
 * contraseña— y aun así hace falta poder mirar lo que él ve cuando llama
 * diciendo que algo no le aparece.
 *
 * Importante: en la vista de agencia los datos se leen con la sesión de la
 * agencia, que por RLS ya ve todo lo de sus clientes. No se suplanta a nadie ni
 * se toca su sesión.
 */
export async function clienteDelPanel(): Promise<ContextoPanel> {
  const perfil = await getPerfil();
  if (!perfil) redirect("/login");

  if (perfil.rol === "client_user") {
    if (!perfil.clientId) redirect("/login");
    return {
      clientId: perfil.clientId,
      esVistaDeAgencia: false,
      email: perfil.email,
    };
  }

  const cookieStore = await cookies();
  const clientId = cookieStore.get(COOKIE_VISTA)?.value;

  // Un admin de agencia en `/panel` sin haber elegido cliente no tiene nada que
  // ver aquí: vuelve a su panel.
  if (!clientId) redirect("/dashboard");

  // La cookie no se cree: se comprueba que ese cliente es suyo en cada carga.
  await exigirAccesoACliente(clientId);

  return { clientId, esVistaDeAgencia: true, email: perfil.email };
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
