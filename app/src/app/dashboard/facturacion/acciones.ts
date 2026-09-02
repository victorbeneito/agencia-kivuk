"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { generarPdfFactura } from "@/lib/factura-pdf";
import {
  calcularTotales,
  euros,
  fecha as formatoFecha,
  mesesDe,
  nombreDelMes,
  num,
  sumarDias,
  sumarMeses,
  type DatosFiscales,
  type Factura,
  type LineaFactura,
  type Recurrencia,
} from "@/lib/facturacion";

/**
 * Todo lo que escribe la facturación.
 *
 * Se usa el cliente normal de Supabase (el que respeta RLS), no `service_role`:
 * aquí no hay ninguna escritura que el `agency_admin` no pueda hacer por sí
 * mismo, así que las políticas de la 0013 siguen siendo la frontera y no hay que
 * reimplementar los permisos a mano. El cliente final no llega a este archivo:
 * en su panel las facturas son de solo lectura.
 *
 * La regla que gobierna casi todas las comprobaciones: **una factura emitida no
 * se toca**. Ni sus líneas, ni sus fechas, ni sus importes. Lo único que cambia
 * después de emitir es su estado (enviada, pagada, anulada) y la referencia del
 * cobro.
 */

export type Resultado = { ok: boolean; mensaje: string };

const HOY = () => new Date().toISOString().slice(0, 10);

async function agenciaActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name")
    .eq("owner_user_id", user?.id ?? "")
    .single();

  if (!agency) throw new Error("No se ha encontrado la agencia del usuario.");
  return agency;
}

async function ajustesDeAgencia(agencyId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("agency_billing_settings")
    .select("*")
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (data) return data;

  // La migración crea la fila para las agencias existentes, pero una agencia
  // dada de alta después no la tendría. Se crea al vuelo en lugar de fallar.
  const { data: creada } = await supabase
    .from("agency_billing_settings")
    .insert({ agency_id: agencyId })
    .select("*")
    .single();

  return creada;
}

// === Datos fiscales ===

export async function guardarDatosAgencia(formData: FormData) {
  const agency = await agenciaActual();
  const supabase = await createClient();

  const texto = (campo: string) =>
    ((formData.get(campo) as string) ?? "").trim();

  const { error } = await supabase.from("agency_billing_settings").upsert(
    {
      agency_id: agency.id,
      razon_social: texto("razon_social"),
      nif: texto("nif"),
      direccion: texto("direccion"),
      codigo_postal: texto("codigo_postal"),
      ciudad: texto("ciudad"),
      provincia: texto("provincia"),
      pais: texto("pais") || "España",
      email: texto("email"),
      telefono: texto("telefono"),
      web: texto("web"),
      iban: texto("iban"),
      serie: texto("serie") || "F",
      iva_por_defecto: num(formData.get("iva_por_defecto")),
      irpf_por_defecto: num(formData.get("irpf_por_defecto")),
      dias_vencimiento: Math.max(0, Math.round(num(formData.get("dias_vencimiento")))),
      pie_factura: texto("pie_factura"),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "agency_id" }
  );

  if (error) throw new Error(`No se pudo guardar: ${error.message}`);

  revalidatePath("/dashboard/configuracion");
}

export async function guardarDatosFiscalesCliente(formData: FormData) {
  const clientId = formData.get("client_id") as string;
  const supabase = await createClient();

  const texto = (campo: string) =>
    ((formData.get(campo) as string) ?? "").trim();

  // Vacío significa «usa el valor por defecto de la agencia», que en la base es
  // null. Un 0 escrito a mano sí es un 0 (exento de IVA), y hay que distinguirlo.
  const opcional = (campo: string) => {
    const v = texto(campo);
    return v === "" ? null : num(v);
  };

  const { error } = await supabase.from("client_billing_profiles").upsert(
    {
      client_id: clientId,
      razon_social: texto("razon_social"),
      nif: texto("nif"),
      direccion: texto("direccion"),
      codigo_postal: texto("codigo_postal"),
      ciudad: texto("ciudad"),
      provincia: texto("provincia"),
      pais: texto("pais") || "España",
      email: texto("email"),
      telefono: texto("telefono"),
      persona_contacto: texto("persona_contacto"),
      forma_pago: texto("forma_pago") || "transferencia",
      iva: opcional("iva"),
      irpf: opcional("irpf"),
      dias_vencimiento: opcional("dias_vencimiento"),
      notas: texto("notas"),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" }
  );

  if (error) throw new Error(`No se pudo guardar: ${error.message}`);

  revalidatePath(`/dashboard/${clientId}/facturacion`);
}

// === Catálogo de servicios de la agencia ===

export async function guardarServicio(formData: FormData) {
  const agency = await agenciaActual();
  const supabase = await createClient();

  const id = (formData.get("id") as string) || null;
  const fila = {
    agency_id: agency.id,
    nombre: ((formData.get("nombre") as string) ?? "").trim(),
    descripcion: ((formData.get("descripcion") as string) ?? "").trim(),
    precio: num(formData.get("precio")),
    recurrencia: (formData.get("recurrencia") as Recurrencia) || "mensual",
    modulo: ((formData.get("modulo") as string) || "") || null,
    // Casilla sin marcar = no llega en el FormData. Retirar un servicio del
    // catálogo no toca lo que ya tengan contratado los clientes.
    activo: formData.get("activo") === "si",
  };

  if (!fila.nombre) throw new Error("El servicio necesita un nombre.");

  const { error } = id
    ? await supabase.from("services").update(fila).eq("id", id)
    : await supabase.from("services").insert(fila);

  if (error) throw new Error(`No se pudo guardar el servicio: ${error.message}`);

  revalidatePath("/dashboard/facturacion/servicios");
}

export async function borrarServicio(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw new Error(`No se pudo borrar: ${error.message}`);
  revalidatePath("/dashboard/facturacion/servicios");
}

// === Servicios contratados por un cliente ===

export async function contratarServicio(formData: FormData) {
  const clientId = formData.get("client_id") as string;
  const supabase = await createClient();

  const serviceId = ((formData.get("service_id") as string) || "") || null;

  let nombre = ((formData.get("nombre") as string) ?? "").trim();
  let descripcion = ((formData.get("descripcion") as string) ?? "").trim();
  let precio = num(formData.get("precio"));
  let recurrencia = (formData.get("recurrencia") as Recurrencia) || "mensual";

  // Si se elige del catálogo, se copian sus datos como punto de partida. A
  // partir de ahí el contrato vive por su cuenta: cambiar la tarifa no cambia
  // lo que paga quien ya la tenía.
  if (serviceId) {
    const { data: servicio } = await supabase
      .from("services")
      .select("nombre, descripcion, precio, recurrencia")
      .eq("id", serviceId)
      .single();

    if (servicio) {
      nombre = nombre || servicio.nombre;
      descripcion = descripcion || servicio.descripcion;
      if (!formData.get("precio")) precio = num(servicio.precio);
      recurrencia = (formData.get("recurrencia") as Recurrencia) || servicio.recurrencia;
    }
  }

  if (!nombre) throw new Error("El servicio contratado necesita un nombre.");

  const fechaAlta = ((formData.get("fecha_alta") as string) || HOY()).slice(0, 10);

  const { error } = await supabase.from("client_services").insert({
    client_id: clientId,
    service_id: serviceId,
    nombre,
    descripcion,
    precio,
    cantidad: num(formData.get("cantidad")) || 1,
    recurrencia,
    fecha_alta: fechaAlta,
    // Se factura desde el alta: si se contrata a mitad de mes, la primera
    // factura sale en la siguiente generación y cubre desde ese día.
    proxima_factura: fechaAlta,
  });

  if (error) throw new Error(`No se pudo contratar: ${error.message}`);

  revalidatePath(`/dashboard/${clientId}/facturacion`);
}

export async function cambiarEstadoContratado(
  clientId: string,
  id: string,
  estado: "activo" | "pausado" | "cancelado"
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("client_services")
    .update({
      estado,
      fecha_baja: estado === "cancelado" ? HOY() : null,
      // Un servicio pausado o cancelado no entra en la generación mensual.
      proxima_factura: estado === "activo" ? HOY() : null,
    })
    .eq("id", id)
    .eq("client_id", clientId);

  if (error) throw new Error(`No se pudo actualizar: ${error.message}`);

  revalidatePath(`/dashboard/${clientId}/facturacion`);
}

export async function borrarContratado(clientId: string, id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_services")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);

  if (error) throw new Error(`No se pudo borrar: ${error.message}`);
  revalidatePath(`/dashboard/${clientId}/facturacion`);
}

// === Facturas ===

/** Recalcula base, IVA, IRPF y total a partir de las líneas guardadas. */
async function recalcular(invoiceId: string) {
  const supabase = await createClient();

  const [{ data: factura }, { data: lineas }] = await Promise.all([
    supabase
      .from("invoices")
      .select("iva_pct, irpf_pct")
      .eq("id", invoiceId)
      .single(),
    supabase
      .from("invoice_items")
      .select("cantidad, precio")
      .eq("invoice_id", invoiceId),
  ]);

  if (!factura) return;

  const totales = calcularTotales(
    (lineas ?? []).map((l) => ({ cantidad: num(l.cantidad), precio: num(l.precio) })),
    num(factura.iva_pct),
    num(factura.irpf_pct)
  );

  await supabase
    .from("invoices")
    .update({ ...totales, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
}

async function exigirBorrador(invoiceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("estado")
    .eq("id", invoiceId)
    .single();

  if (!data) throw new Error("No se encuentra la factura.");
  if (data.estado !== "borrador") {
    throw new Error(
      "Esta factura ya está emitida y no se puede modificar. Anúlala y haz una nueva."
    );
  }
}

/**
 * Crea un borrador para un cliente.
 *
 * `desdeServicios` mete de golpe todo lo que tiene contratado y activo, que es
 * el caso normal; sin ella sale una factura vacía a la que se le añaden líneas
 * a mano (un trabajo puntual, una campaña).
 */
export async function crearFactura(clientId: string, desdeServicios = true) {
  const agency = await agenciaActual();
  const ajustes = await ajustesDeAgencia(agency.id);
  const supabase = await createClient();

  const { data: perfil } = await supabase
    .from("client_billing_profiles")
    .select("iva, irpf, dias_vencimiento, forma_pago")
    .eq("client_id", clientId)
    .maybeSingle();

  const hoy = HOY();
  const dias = perfil?.dias_vencimiento ?? ajustes?.dias_vencimiento ?? 15;

  const { data: factura, error } = await supabase
    .from("invoices")
    .insert({
      agency_id: agency.id,
      client_id: clientId,
      fecha_emision: hoy,
      fecha_vencimiento: sumarDias(hoy, dias),
      iva_pct: perfil?.iva ?? ajustes?.iva_por_defecto ?? 21,
      irpf_pct: perfil?.irpf ?? ajustes?.irpf_por_defecto ?? 0,
      forma_pago: perfil?.forma_pago ?? "transferencia",
      concepto: `Servicios de ${nombreDelMes(hoy)}`,
    })
    .select("id")
    .single();

  if (error || !factura) {
    throw new Error(`No se pudo crear la factura: ${error?.message}`);
  }

  if (desdeServicios) {
    const { data: contratados } = await supabase
      .from("client_services")
      .select("id, nombre, descripcion, precio, cantidad")
      .eq("client_id", clientId)
      .eq("estado", "activo")
      .order("created_at");

    if (contratados?.length) {
      await supabase.from("invoice_items").insert(
        contratados.map((c, i) => ({
          invoice_id: factura.id,
          client_service_id: c.id,
          concepto: c.nombre,
          descripcion: c.descripcion,
          cantidad: num(c.cantidad),
          precio: num(c.precio),
          posicion: i,
        }))
      );
      await recalcular(factura.id);
    }
  }

  revalidatePath("/dashboard/facturacion");
  revalidatePath(`/dashboard/${clientId}/facturacion`);
  redirect(`/dashboard/facturacion/${factura.id}`);
}

export async function actualizarFactura(formData: FormData) {
  const id = formData.get("id") as string;
  await exigirBorrador(id);

  const supabase = await createClient();
  const texto = (campo: string) => ((formData.get(campo) as string) ?? "").trim();

  const { error } = await supabase
    .from("invoices")
    .update({
      fecha_emision: texto("fecha_emision") || HOY(),
      fecha_vencimiento: texto("fecha_vencimiento") || null,
      periodo_inicio: texto("periodo_inicio") || null,
      periodo_fin: texto("periodo_fin") || null,
      concepto: texto("concepto"),
      iva_pct: num(formData.get("iva_pct")),
      irpf_pct: num(formData.get("irpf_pct")),
      forma_pago: texto("forma_pago") || "transferencia",
      enlace_pago: texto("enlace_pago") || null,
      notas: texto("notas"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(`No se pudo guardar: ${error.message}`);

  await recalcular(id);
  revalidatePath(`/dashboard/facturacion/${id}`);
}

export async function anadirLinea(formData: FormData) {
  const invoiceId = formData.get("invoice_id") as string;
  await exigirBorrador(invoiceId);

  const supabase = await createClient();

  const { count } = await supabase
    .from("invoice_items")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoiceId);

  const concepto = ((formData.get("concepto") as string) ?? "").trim();
  if (!concepto) throw new Error("La línea necesita un concepto.");

  const { error } = await supabase.from("invoice_items").insert({
    invoice_id: invoiceId,
    concepto,
    descripcion: ((formData.get("descripcion") as string) ?? "").trim(),
    cantidad: num(formData.get("cantidad")) || 1,
    precio: num(formData.get("precio")),
    posicion: count ?? 0,
  });

  if (error) throw new Error(`No se pudo añadir la línea: ${error.message}`);

  await recalcular(invoiceId);
  revalidatePath(`/dashboard/facturacion/${invoiceId}`);
}

export async function borrarLinea(invoiceId: string, lineaId: string) {
  await exigirBorrador(invoiceId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoice_items")
    .delete()
    .eq("id", lineaId)
    .eq("invoice_id", invoiceId);

  if (error) throw new Error(`No se pudo borrar la línea: ${error.message}`);

  await recalcular(invoiceId);
  revalidatePath(`/dashboard/facturacion/${invoiceId}`);
}

/**
 * Emitir: asignar número y congelar el documento.
 *
 * El número lo da la base con `siguiente_numero_factura`, que bloquea la fila de
 * ajustes mientras lo reparte. Aquí no se puede hacer «leer, sumar uno,
 * escribir»: dos pestañas emitiendo a la vez se llevarían el mismo número, y una
 * numeración repetida es justo lo que la ley no perdona.
 */
export async function emitirFactura(id: string): Promise<Resultado> {
  const supabase = await createClient();

  const { data: factura } = await supabase
    .from("invoices")
    .select("id, agency_id, client_id, estado, fecha_emision, fecha_vencimiento, total")
    .eq("id", id)
    .single();

  if (!factura) return { ok: false, mensaje: "No se encuentra la factura." };
  if (factura.estado !== "borrador") {
    return { ok: false, mensaje: "Esta factura ya estaba emitida." };
  }

  const { count } = await supabase
    .from("invoice_items")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", id);

  if (!count) {
    return { ok: false, mensaje: "No se puede emitir una factura sin líneas." };
  }

  const ajustes = await ajustesDeAgencia(factura.agency_id);

  if (!ajustes?.nif || !ajustes?.razon_social) {
    return {
      ok: false,
      mensaje:
        "Faltan tus datos fiscales (razón social y NIF). Complétalos en Configuración de la agencia.",
    };
  }

  const { data: cliente } = await supabase
    .from("clients")
    .select("name")
    .eq("id", factura.client_id)
    .single();

  const { data: perfil } = await supabase
    .from("client_billing_profiles")
    .select("*")
    .eq("client_id", factura.client_id)
    .maybeSingle();

  if (!perfil?.nif) {
    return {
      ok: false,
      mensaje:
        "Faltan los datos fiscales del cliente (al menos el NIF). Están en su pestaña de Facturación.",
    };
  }

  const emisor: DatosFiscales = {
    razon_social: ajustes.razon_social,
    nif: ajustes.nif,
    direccion: ajustes.direccion,
    codigo_postal: ajustes.codigo_postal,
    ciudad: ajustes.ciudad,
    provincia: ajustes.provincia,
    pais: ajustes.pais,
    email: ajustes.email,
    telefono: ajustes.telefono,
    web: ajustes.web,
    iban: ajustes.iban,
  };

  const receptor: DatosFiscales = {
    razon_social: perfil.razon_social || cliente?.name || "",
    nif: perfil.nif,
    direccion: perfil.direccion,
    codigo_postal: perfil.codigo_postal,
    ciudad: perfil.ciudad,
    provincia: perfil.provincia,
    pais: perfil.pais,
    email: perfil.email,
    telefono: perfil.telefono,
  };

  const { data: numero, error: errorNumero } = await supabase.rpc(
    "siguiente_numero_factura",
    { p_agency_id: factura.agency_id, p_fecha: factura.fecha_emision }
  );

  if (errorNumero || !numero) {
    return {
      ok: false,
      mensaje: `No se pudo asignar el número: ${errorNumero?.message ?? "sin respuesta"}`,
    };
  }

  const { error } = await supabase
    .from("invoices")
    .update({
      numero,
      estado: "emitida",
      emitida_at: new Date().toISOString(),
      fecha_vencimiento:
        factura.fecha_vencimiento ??
        sumarDias(factura.fecha_emision, ajustes.dias_vencimiento ?? 15),
      emisor,
      receptor,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    // Que siga siendo borrador en el momento del UPDATE: si otra pestaña la
    // emitió mientras tanto, esta se queda sin efecto en vez de renumerarla.
    .eq("estado", "borrador");

  if (error) {
    return { ok: false, mensaje: `No se pudo emitir: ${error.message}` };
  }

  revalidatePath(`/dashboard/facturacion/${id}`);
  revalidatePath("/dashboard/facturacion");
  return { ok: true, mensaje: `Emitida con el número ${numero}.` };
}

export async function marcarPagada(id: string, referencia: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices")
    .update({
      estado: "pagada",
      pagada_at: new Date().toISOString(),
      referencia_pago: referencia.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .neq("estado", "borrador");

  if (error) throw new Error(`No se pudo marcar como pagada: ${error.message}`);

  revalidatePath(`/dashboard/facturacion/${id}`);
  revalidatePath("/dashboard/facturacion");
}

export async function marcarPendiente(id: string) {
  const supabase = await createClient();

  const { data: factura } = await supabase
    .from("invoices")
    .select("enviada_at")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("invoices")
    .update({
      estado: factura?.enviada_at ? "enviada" : "emitida",
      pagada_at: null,
      referencia_pago: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("estado", "pagada");

  if (error) throw new Error(`No se pudo deshacer el cobro: ${error.message}`);

  revalidatePath(`/dashboard/facturacion/${id}`);
}

/**
 * Anular. No se borra: una factura emitida ya salió con su número, y ese número
 * no puede desaparecer de la serie. Se queda a la vista, marcada como anulada.
 */
export async function anularFactura(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices")
    .update({ estado: "anulada", updated_at: new Date().toISOString() })
    .eq("id", id)
    .neq("estado", "borrador");

  if (error) throw new Error(`No se pudo anular: ${error.message}`);

  revalidatePath(`/dashboard/facturacion/${id}`);
  revalidatePath("/dashboard/facturacion");
}

/** Un borrador sí se borra: nunca tuvo número ni existió para nadie. */
export async function borrarBorrador(id: string) {
  const supabase = await createClient();

  const { data: factura } = await supabase
    .from("invoices")
    .select("client_id, estado")
    .eq("id", id)
    .single();

  if (factura?.estado !== "borrador") {
    throw new Error("Solo se pueden borrar los borradores. Una factura emitida se anula.");
  }

  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw new Error(`No se pudo borrar: ${error.message}`);

  revalidatePath("/dashboard/facturacion");
  redirect("/dashboard/facturacion");
}

// === Envío por correo ===

/** Los datos completos de una factura, para el PDF y el correo. */
async function cargarFactura(id: string) {
  const supabase = await createClient();

  const [{ data: factura }, { data: lineas }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", id)
      .order("posicion"),
  ]);

  return { factura: factura as Factura | null, lineas: (lineas ?? []) as LineaFactura[] };
}

/**
 * Manda la factura por correo con el PDF adjunto.
 *
 * Va por Resend directamente desde el panel y no por n8n, al contrario que los
 * avisos del cliente: aquí quien escribe es la agencia con su propio dominio
 * (`agenciakivuk.com`, ya verificado), no el cliente con sus credenciales. La
 * clave vive en `RESEND_API_KEY` del entorno del panel.
 */
export async function enviarFactura(id: string, destinatario?: string): Promise<Resultado> {
  const apiKey = process.env.RESEND_API_KEY;
  const remitente = process.env.FACTURAS_REMITENTE;

  if (!apiKey || !remitente) {
    return {
      ok: false,
      mensaje:
        "Falta configurar el envío: RESEND_API_KEY y FACTURAS_REMITENTE en las variables de entorno del panel.",
    };
  }

  const { factura, lineas } = await cargarFactura(id);
  if (!factura) return { ok: false, mensaje: "No se encuentra la factura." };
  if (factura.estado === "borrador") {
    return { ok: false, mensaje: "Emítela antes de enviarla: un borrador no tiene número." };
  }
  if (factura.estado === "anulada") {
    return { ok: false, mensaje: "Esta factura está anulada." };
  }

  const para = (destinatario || factura.receptor?.email || "").trim();
  if (!para) {
    return {
      ok: false,
      mensaje: "El cliente no tiene correo de facturación. Añádelo en su pestaña de Facturación.",
    };
  }

  const ajustes = await ajustesDeAgencia(factura.agency_id);
  const pdf = await generarPdfFactura({
    factura,
    lineas,
    pieFactura: ajustes?.pie_factura || undefined,
  });

  const asunto = `Factura ${factura.numero} — ${factura.emisor?.razon_social ?? ""}`.trim();

  const enlacePago = factura.enlace_pago
    ? `<p style="margin:0 0 16px"><a href="${factura.enlace_pago}" style="background:#B45831;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Pagar ahora</a></p>`
    : "";

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#222;max-width:560px">
      <p>Hola${factura.receptor?.razon_social ? ` ${factura.receptor.razon_social}` : ""},</p>
      <p>Te adjuntamos la factura <strong>${factura.numero}</strong>${
        factura.concepto ? ` correspondiente a ${factura.concepto.toLowerCase()}` : ""
      }.</p>
      <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr><td style="padding:4px 16px 4px 0;color:#666">Importe</td><td style="padding:4px 0"><strong>${euros(
          factura.total
        )}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">Fecha</td><td style="padding:4px 0">${formatoFecha(
          factura.fecha_emision
        )}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">Vencimiento</td><td style="padding:4px 0">${formatoFecha(
          factura.fecha_vencimiento
        )}</td></tr>
        ${
          ajustes?.iban
            ? `<tr><td style="padding:4px 16px 4px 0;color:#666">IBAN</td><td style="padding:4px 0">${ajustes.iban}</td></tr>`
            : ""
        }
      </table>
      ${enlacePago}
      <p style="color:#666;font-size:13px">Indica la referencia ${factura.numero} en el concepto de la transferencia.</p>
      <p style="color:#666;font-size:13px">Cualquier duda, respóndenos a este correo.</p>
    </div>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remitente,
        to: [para],
        subject: asunto,
        html,
        attachments: [
          {
            filename: `factura-${factura.numero}.pdf`,
            content: Buffer.from(pdf).toString("base64"),
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!r.ok) {
      const detalle = await r.text().catch(() => "");
      return { ok: false, mensaje: `Resend respondió ${r.status}. ${detalle.slice(0, 200)}` };
    }
  } catch (e) {
    return {
      ok: false,
      mensaje: `No se pudo enviar: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const supabase = await createClient();
  await supabase
    .from("invoices")
    .update({
      // Solo sube a «enviada» si venía de «emitida»: reenviar una factura ya
      // cobrada no la descobra.
      estado: factura.estado === "emitida" ? "enviada" : factura.estado,
      enviada_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath(`/dashboard/facturacion/${id}`);
  revalidatePath("/dashboard/facturacion");
  return { ok: true, mensaje: `Enviada a ${para}.` };
}

// === Facturación recurrente ===

/**
 * Prepara los borradores del periodo: una factura por cliente con todo lo que
 * le toca facturar hoy o antes.
 *
 * Deja borradores, no facturas emitidas. La generación es automática; darle al
 * botón de emitir, no. Entre una cosa y otra hay una persona mirando que el mes
 * es el que es y que nadie se ha dado de baja.
 */
export async function generarRecurrentes(): Promise<Resultado> {
  const agency = await agenciaActual();
  const supabase = await createClient();
  const hoy = HOY();

  const { data: clientes } = await supabase
    .from("clients")
    .select("id, name")
    .eq("agency_id", agency.id);

  if (!clientes?.length) return { ok: false, mensaje: "No hay clientes." };

  const { data: contratados } = await supabase
    .from("client_services")
    .select("id, client_id, nombre, descripcion, precio, cantidad, recurrencia, proxima_factura")
    .in(
      "client_id",
      clientes.map((c) => c.id)
    )
    .eq("estado", "activo")
    .not("proxima_factura", "is", null)
    .lte("proxima_factura", hoy);

  if (!contratados?.length) {
    return { ok: true, mensaje: "No hay nada pendiente de facturar hoy." };
  }

  const porCliente = new Map<string, typeof contratados>();
  for (const c of contratados) {
    porCliente.set(c.client_id, [...(porCliente.get(c.client_id) ?? []), c]);
  }

  const ajustes = await ajustesDeAgencia(agency.id);
  let creadas = 0;
  const omitidos: string[] = [];

  for (const [clientId, servicios] of porCliente) {
    // El periodo lo marca el servicio que antes vencía: si algo lleva dos meses
    // sin facturarse, la factura cubre desde entonces.
    const inicio = servicios
      .map((s) => s.proxima_factura as string)
      .sort()[0]
      .slice(0, 10);

    // ¿Ya hay una factura viva para ese periodo? Darle dos veces al botón el
    // mismo día no puede duplicar el cobro.
    const { data: yaHay } = await supabase
      .from("invoices")
      .select("id")
      .eq("client_id", clientId)
      .eq("periodo_inicio", inicio)
      .neq("estado", "anulada")
      .maybeSingle();

    if (yaHay) {
      omitidos.push(clientes.find((c) => c.id === clientId)?.name ?? "cliente");
      continue;
    }

    const { data: perfil } = await supabase
      .from("client_billing_profiles")
      .select("iva, irpf, dias_vencimiento, forma_pago")
      .eq("client_id", clientId)
      .maybeSingle();

    const dias = perfil?.dias_vencimiento ?? ajustes?.dias_vencimiento ?? 15;

    const { data: factura, error } = await supabase
      .from("invoices")
      .insert({
        agency_id: agency.id,
        client_id: clientId,
        fecha_emision: hoy,
        fecha_vencimiento: sumarDias(hoy, dias),
        periodo_inicio: inicio,
        periodo_fin: sumarDias(sumarMeses(inicio, 1), -1),
        concepto: `Servicios de ${nombreDelMes(inicio)}`,
        iva_pct: perfil?.iva ?? ajustes?.iva_por_defecto ?? 21,
        irpf_pct: perfil?.irpf ?? ajustes?.irpf_por_defecto ?? 0,
        forma_pago: perfil?.forma_pago ?? "transferencia",
      })
      .select("id")
      .single();

    if (error || !factura) continue;

    await supabase.from("invoice_items").insert(
      servicios.map((s, i) => ({
        invoice_id: factura.id,
        client_service_id: s.id,
        concepto: s.nombre,
        descripcion: s.descripcion,
        cantidad: num(s.cantidad),
        precio: num(s.precio),
        posicion: i,
      }))
    );

    await recalcular(factura.id);

    // Y se adelanta el contador de cada servicio. Los de pago único se quedan a
    // null: ya están facturados y no vuelven.
    for (const s of servicios) {
      const meses = mesesDe(s.recurrencia as Recurrencia);
      await supabase
        .from("client_services")
        .update({
          proxima_factura: meses
            ? sumarMeses((s.proxima_factura as string).slice(0, 10), meses)
            : null,
        })
        .eq("id", s.id);
    }

    creadas++;
  }

  revalidatePath("/dashboard/facturacion");

  if (!creadas) {
    return {
      ok: true,
      mensaje: `Nada nuevo: ${omitidos.join(", ")} ya tenía factura de este periodo.`,
    };
  }

  return {
    ok: true,
    mensaje:
      `${creadas} ${creadas === 1 ? "borrador creado" : "borradores creados"}.` +
      (omitidos.length ? ` Omitidos por duplicado: ${omitidos.join(", ")}.` : "") +
      " Revísalos y emítelos.",
  };
}
