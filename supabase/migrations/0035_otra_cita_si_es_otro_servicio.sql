-- Una segunda cita sí, si es para otra cosa.
--
-- Qué pasó (04/11/2026, demo de la peluquería). Quien tenía un arreglo de
-- barba para esa mañana pidió raíz y mechas para el jueves a las 16:00. El bot
-- dijo que sí y la base contestó `ya_tiene_cita`: le salió «Ya tienes una cita
-- el miércoles a las 11:00 con Luisa... te atiende una compañera», que se leyó
-- como que le había dado la cita a las 11 en vez de a las 16.
--
-- La regla de 0020 («una persona, una cita futura») se puso cuando el bot no
-- sabía cambiar citas: ante «mejor el miércoles» creaba otra y dejaba la del
-- martes muerta. Desde 0021 el bot mueve citas por el chat, así que la regla ya
-- no tiene que pararlo todo, solo lo que de verdad parece un cambio mal
-- entendido: otra cita para LO MISMO. Dos citas para cosas distintas (la barba
-- hoy y las mechas el jueves; la limpieza y, otro día, el blanqueamiento) son
-- lo normal, y negarlas es perder la cita.
--
-- Cuándo se sigue parando:
--   - la cita que ya tiene comparte algún servicio con la nueva;
--   - o no se sabe qué servicios lleva una de las dos (las citas sin
--     servicios, de antes de 0014 o de un negocio sin catálogo): sin saberlo
--     no se puede distinguir un cambio de otra cita, y se hace lo de antes.
--
-- Se devuelven además los servicios de la cita que ya tiene, para que el bot
-- diga «ya tienes cita para mechas el jueves» y ofrezca cambiarla.

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
  v_nuevos uuid[];
begin
  v_digitos := right(regexp_replace(coalesce(p_contacto, ''), '\D', '', 'g'), 9);

  select coalesce(array_agg(nullif(s->>'id', '')::uuid) filter (where nullif(s->>'id', '') is not null), '{}')
  into v_nuevos
  from jsonb_array_elements(coalesce(p_servicios, '[]'::jsonb)) s;

  -- Un teléfono de menos de nueve dígitos no identifica a nadie (y el vacío,
  -- menos): sin él no se puede saber si ya tiene cita, así que no se bloquea.
  if coalesce(p_canal, 'whatsapp') <> 'panel' and length(v_digitos) = 9 then
    select a.* into v_previa
    from appointments a
    where a.client_id = p_client_id
      and a.estado = 'confirmada'
      and a.fin > now()
      and right(regexp_replace(coalesce(a.contacto, ''), '\D', '', 'g'), 9) = v_digitos
      and (
        cardinality(v_nuevos) = 0
        or not exists (
          select 1 from appointment_services x
          where x.appointment_id = a.id and x.booking_service_id is not null
        )
        or exists (
          select 1 from appointment_services x
          where x.appointment_id = a.id and x.booking_service_id = any (v_nuevos)
        )
      )
    order by a.inicio
    limit 1;

    if v_previa.id is not null then
      select s.nombre into v_quien from staff s where s.id = v_previa.staff_id;

      return jsonb_build_object(
        'ok', false,
        'motivo', 'ya_tiene_cita',
        'cita_id', v_previa.id,
        'cita_inicio', v_previa.inicio,
        'cita_con', coalesce(v_quien, ''),
        'cita_servicios', coalesce((
          select jsonb_agg(x.nombre order by x.posicion)
          from appointment_services x
          where x.appointment_id = v_previa.id
        ), '[]'::jsonb)
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
  when exclusion_violation then
    return jsonb_build_object('ok', false, 'motivo', 'ocupado');
  when foreign_key_violation then
    return jsonb_build_object('ok', false, 'motivo', 'trabajador_desconocido');
end;
$$;
