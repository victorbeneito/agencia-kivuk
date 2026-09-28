-- Una persona, una cita futura: el bot no da la segunda.
--
-- Qué pasó (28/09/2026, demo dental). Se pidió cita para el martes, el bot la
-- confirmó, y al decirle «no me va bien el martes, mejor el miércoles» creó
-- otra para el miércoles. La del martes se quedó ahí. El paciente se va
-- convencido de que la ha cambiado y a la clínica le queda un hueco muerto que
-- nadie va a ocupar, y que además no se ve: en la rejilla son dos citas
-- normales, en días distintos.
--
-- Por qué no lo paró nada de lo que ya había. La restricción anti-solape de
-- 0014 mira `staff_id`: impide que Elena tenga dos citas a la vez, que es lo
-- que hace falta para que dos personas no se queden con el mismo hueco. Pero
-- el martes era con Elena y el miércoles con Javier, así que para la base son
-- dos citas perfectamente válidas. Nadie miraba si quien reserva ya tenía una.
--
-- La causa de fondo es que **el bot no sabe cambiar citas**: solo sabe
-- reservar, así que ante «mejor el miércoles» hace lo único que sabe. Mover una
-- cita por chat es una pieza que está por construir (`agenda_editar`, de 0019,
-- ya la mueve desde el panel). Mientras tanto, esto evita el daño: si quien
-- escribe ya tiene una cita futura, no se le crea otra y se le pasa a una
-- persona, que es justo lo que el prompt ya le promete.
--
-- Por qué el canal decide y no un parámetro nuevo. Quien reserva desde el panel
-- (`p_canal = 'panel'`) es alguien del negocio con la agenda delante: si le da
-- dos citas a la misma persona es porque quiere —la clienta que pide la
-- siguiente al irse, la madre que saca cita para ella y para su hijo—. El bot y
-- los canales que vengan después (voz) no ven nada de eso. Así ninguna de las
-- dos llamadas de la aplicación cambia, y lo que se protege es exactamente lo
-- que hay que proteger.
--
-- Comparar teléfonos: solo los dígitos y solo los nueve últimos. El mismo móvil
-- llega como `34669863866` desde WhatsApp y como `669 86 38 66` escrito a mano
-- en el mostrador, y son la misma persona.

create or replace function agenda_reservar(
  p_client_id uuid,
  p_staff_id uuid,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_servicios jsonb default '[]'::jsonb,
  p_nombre text default '',
  p_contacto text default '',
  p_email text default null,
  p_canal text default 'whatsapp',
  p_notas text default '',
  p_conversation_id uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  v_id uuid;
  v_digitos text;
  v_previa appointments%rowtype;
  v_quien text;
begin
  v_digitos := right(regexp_replace(coalesce(p_contacto, ''), '\D', '', 'g'), 9);

  -- Un teléfono de menos de nueve dígitos no identifica a nadie (y el vacío,
  -- menos): sin él no se puede saber si ya tiene cita, así que no se bloquea.
  if coalesce(p_canal, 'whatsapp') <> 'panel' and length(v_digitos) = 9 then
    select a.* into v_previa
    from appointments a
    where a.client_id = p_client_id
      and a.estado = 'confirmada'
      and a.fin > now()
      and right(regexp_replace(coalesce(a.contacto, ''), '\D', '', 'g'), 9) = v_digitos
    order by a.inicio
    limit 1;

    if v_previa.id is not null then
      select s.nombre into v_quien from staff s where s.id = v_previa.staff_id;

      return jsonb_build_object(
        'ok', false,
        'motivo', 'ya_tiene_cita',
        'cita_id', v_previa.id,
        'cita_inicio', v_previa.inicio,
        'cita_con', coalesce(v_quien, '')
      );
    end if;
  end if;

  insert into appointments (
    client_id, staff_id, inicio, fin,
    nombre_contacto, contacto, email, canal, notas, conversation_id
  )
  values (
    p_client_id, p_staff_id, p_inicio, p_fin,
    coalesce(p_nombre, ''), coalesce(p_contacto, ''), nullif(p_email, ''),
    coalesce(p_canal, 'whatsapp'), coalesce(p_notas, ''), p_conversation_id
  )
  returning id into v_id;

  insert into appointment_services (
    appointment_id, booking_service_id, nombre, duracion_min, posicion
  )
  select
    v_id,
    nullif(s->>'id', '')::uuid,
    s->>'nombre',
    (s->>'duracion_min')::int,
    (i - 1)
  from jsonb_array_elements(coalesce(p_servicios, '[]'::jsonb))
       with ordinality as e(s, i);

  return jsonb_build_object('ok', true, 'id', v_id);

exception
  -- El hueco se lo ha llevado otra conversación entre que se calculó y se
  -- intentó reservar. No es un error: es un "no cabe", y quien llama tiene que
  -- poder distinguirlo para ofrecer alternativas en vez de disculparse.
  --
  -- Al saltar aquí, el insert de la cita queda deshecho: plpgsql revierte hasta
  -- el inicio del bloque, así que no puede quedarse una cita sin sus servicios.
  when exclusion_violation then
    return jsonb_build_object('ok', false, 'motivo', 'ocupado');
  when foreign_key_violation then
    return jsonb_build_object('ok', false, 'motivo', 'trabajador_desconocido');
end;
$$;

-- Buscar «las citas futuras de este teléfono» en cada reserva no puede costar
-- un recorrido de toda la tabla. Se indexa por lo que se compara.
create index if not exists appointments_contacto_idx
  on appointments (client_id, (right(regexp_replace(coalesce(contacto, ''), '\D', '', 'g'), 9)), inicio)
  where estado = 'confirmada';
