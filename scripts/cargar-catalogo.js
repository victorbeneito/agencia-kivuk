#!/usr/bin/env node
/**
 * Carga el catálogo de servicios de Kivuk en facturación (tabla `services`).
 *
 *   node scripts/cargar-catalogo.js            # enseña lo que haría
 *   node scripts/cargar-catalogo.js --aplicar  # lo escribe
 *
 * Los precios son los de partida que da el bot de Kivuk
 * (docs/conocimiento-kivuk-agencia.md, documento 15): el mínimo por el que se
 * monta cada cosa. El precio de un cliente concreto —más alto si es un negocio
 * grande, o rebajado en la oferta de fundadores— se pone al contratarlo, en
 * `client_services`, que copia nombre y precio y a partir de ahí va por su
 * cuenta. Por eso cambiar aquí una tarifa no toca lo que ya paga nadie.
 *
 * Cada módulo son dos servicios, porque la factura los separa: la puesta en
 * marcha (pago único) y la cuota (mensual). El nombre es el que sale en la
 * línea de la factura, así que va completo.
 *
 * Lo que está «en desarrollo» (voz, campañas, correo) no se carga: no se puede
 * contratar, y un servicio en el catálogo acaba en una propuesta.
 *
 * Idempotente: empareja por nombre y actualiza en vez de duplicar.
 */
const { clienteSupabase } = require('./lib/montar-demo');

const CATALOGO = [
  {
    nombre: 'Asistente de WhatsApp: atención — puesta en marcha',
    descripcion: 'Preparación de la base de conocimiento, configuración del asistente, conexión del número y pruebas con el cliente.',
    precio: 500, recurrencia: 'unico', modulo: 'whatsapp',
  },
  {
    nombre: 'Asistente de WhatsApp: atención — cuota mensual',
    descripcion: 'Servicio en funcionamiento, inteligencia artificial y mensajería dentro del uso incluido, mantenimiento, soporte y mejora de la base de conocimiento.',
    precio: 60, recurrencia: 'mensual', modulo: 'whatsapp',
  },
  {
    nombre: 'Asistente de WhatsApp: citas — puesta en marcha',
    descripcion: 'Servicios, duraciones, equipo y horarios en la agenda, configuración del asistente, conexión del número, recordatorio y pruebas con el cliente.',
    precio: 500, recurrencia: 'unico', modulo: 'calendar',
  },
  {
    nombre: 'Asistente de WhatsApp: citas — cuota mensual',
    descripcion: 'Agenda y asistente en funcionamiento, recordatorios, inteligencia artificial y mensajería dentro del uso incluido, mantenimiento y soporte.',
    precio: 60, recurrencia: 'mensual', modulo: 'calendar',
  },
  {
    nombre: 'Asistente de WhatsApp: atención y citas — puesta en marcha',
    descripcion: 'Los dos asistentes en uno: base de conocimiento, agenda con servicios, equipo y horarios, conexión del número, recordatorio y pruebas con el cliente.',
    precio: 800, recurrencia: 'unico', modulo: 'calendar',
  },
  {
    nombre: 'Asistente de WhatsApp: atención y citas — cuota mensual',
    descripcion: 'Asistente y agenda en funcionamiento, recordatorios, inteligencia artificial y mensajería dentro del uso incluido, mantenimiento, soporte y mejora de la base de conocimiento.',
    precio: 80, recurrencia: 'mensual', modulo: 'calendar',
  },
  {
    nombre: 'Contenido para redes sociales — puesta en marcha',
    descripcion: 'Conexión de Instagram y Facebook, carga del catálogo y ajuste del estilo de las publicaciones.',
    precio: 300, recurrencia: 'unico', modulo: 'social',
  },
  {
    nombre: 'Contenido para redes sociales — cuota mensual',
    descripcion: 'Publicaciones preparadas con los productos del cliente, aprobadas por él en el panel y publicadas automáticamente.',
    precio: 60, recurrencia: 'mensual', modulo: 'social',
  },
  {
    nombre: 'Página web corporativa — creación',
    descripcion: 'Página corporativa sencilla: quién es el negocio, qué hace y cómo contactar. Dominio .es incluido, a nombre del cliente.',
    precio: 500, recurrencia: 'unico', modulo: null,
  },
  {
    nombre: 'Página web corporativa — mantenimiento y alojamiento',
    descripcion: 'Servidor, certificado, dominio y mantenimiento de la página.',
    precio: 60, recurrencia: 'mensual', modulo: null,
  },
];

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const supabase = clienteSupabase();

  const agencias = await supabase('agencies?select=id,name');
  if (agencias.length !== 1) {
    throw new Error(`esperaba una sola agencia y hay ${agencias.length}: ${agencias.map((a) => a.name).join(', ')}`);
  }
  const agencia = agencias[0];
  const hay = await supabase(`services?agency_id=eq.${agencia.id}&select=id,nombre,precio,recurrencia`);
  const porNombre = new Map(hay.map((s) => [s.nombre, s]));

  console.log(`Agencia: ${agencia.name}  ·  ahora hay ${hay.length} servicio(s) en el catálogo\n`);

  for (const s of CATALOGO) {
    const actual = porNombre.get(s.nombre);
    const precio = `${s.precio.toFixed(2).replace('.', ',')} €`.padStart(10);
    const accion = !actual ? 'nuevo     ' : 'actualiza ';
    console.log(`  ${accion}${precio}  ${s.recurrencia.padEnd(8)} ${s.nombre}`);

    if (!aplicar) continue;
    const fila = { agency_id: agencia.id, ...s, activo: true };
    if (actual) {
      await supabase(`services?id=eq.${actual.id}`, { method: 'PATCH', body: JSON.stringify(fila) });
    } else {
      await supabase('services', { method: 'POST', body: JSON.stringify(fila) });
    }
  }

  const sobran = hay.filter((s) => !CATALOGO.some((c) => c.nombre === s.nombre));
  if (sobran.length) {
    console.log(`\nEn el catálogo hay además (no se tocan): ${sobran.map((s) => s.nombre).join(' · ')}`);
  }

  console.log(aplicar ? '\nListo. Revísalo en /dashboard/facturacion/servicios.' : '\nSimulación. Añade --aplicar para escribirlo.');
}

main().catch((e) => {
  console.error(`\n✖ ${e.message}`);
  process.exit(1);
});
