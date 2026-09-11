-- Las dos funciones con las que el motor de agenda habla con la base.
--
-- Están aquí y no repartidas por el workflow de n8n por dos motivos distintos:
--
--   1. **`agenda_contexto` ahorra seis viajes.** El motor necesita la
--      configuración, los trabajadores, sus horarios, sus ausencias, los
--      servicios, la matriz de quién hace qué y las citas del periodo. Eso, a
--      nodo HTTP por tabla, son seis llamadas encadenadas en cada mensaje de
--      WhatsApp. Aquí es una.
--   2. **`agenda_reservar` es la que evita la doble reserva.** La restricción
--      `appointments_sin_solape` de la 0014 impide el solape, pero alguien
--      tiene que insertar la cita y sus servicios *juntos* y saber distinguir
--      "no cabía" de "ha fallado algo". Eso es una transacción, y una
--      transacción no se escribe desde n8n.
--
-- Las dos son `security invoker` (el comportamiento por defecto, no se declara
-- nada): las consultas de dentro pasan por la RLS del que llama. n8n usa la
-- `service_role` y la salta por diseño, como todo el tráfico servidor a
-- servidor; un usuario del panel solo vería lo suyo. Ponerlas `security
-- definer` habría convertido cada una en una puerta para leer la agenda de
-- cualquier cliente con solo cambiar el uuid.

-- === Todo lo que el motor necesita saber, en un solo JSON ===

create or replace function agenda_contexto(
  p_client_id uuid,
  p_desde timestamptz,
  p_hasta timestamptz
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'config', coalesce((
      -- Solo los tres campos que el motor necesita, y NO el `config` entero.
      -- Ahí dentro viven el `google_client_secret` y el `refresh_token`, y este
      -- JSON va a atravesar el nodo de cálculo, sus logs y sus mensajes de
      -- error. Las credenciales de Google las lee n8n en su propio nodo, que es
      -- el único sitio que las usa.
      --
      -- `duracion_min` es la de quien no tenga servicios definidos; `paso_min`
      -- es del negocio entero (cada cuánto puede empezar una cita), no de cada
      -- persona.
      select jsonb_build_object(
        'duracion_min', coalesce(cm.config->>'duracion_min', '60'),
        'paso_min', coalesce(cm.config->>'paso_min', '15'),
        'zona', coalesce(cm.config->>'zona', 'Europe/Madrid')
      )
      from client_modules cm
      where cm.client_id = p_client_id and cm.module = 'calendar' and cm.active
    ), '{}'::jsonb),

    'trabajadores', coalesce((
      select jsonb_agg(t order by t.orden, t.nombre)
      from (
        select
          s.id,
          s.nombre,
          s.calendar_id,
          s.orden,
          coalesce((
            select jsonb_agg(jsonb_build_object(
              'dia', h.dia_semana,
              'inicio', to_char(h.hora_inicio, 'HH24:MI'),
              'fin', to_char(h.hora_fin, 'HH24:MI')
            ) order by h.dia_semana, h.hora_inicio)
            from staff_hours h where h.staff_id = s.id
          ), '[]'::jsonb) as horario,

          -- Ausencias y citas van ya recortadas a la ventana que se consulta:
          -- las vacaciones del año pasado no ayudan a decidir el martes.
          coalesce((
            select jsonb_agg(jsonb_build_object('inicio', a.inicio, 'fin', a.fin))
            from staff_time_off a
            where a.staff_id = s.id and a.fin > p_desde and a.inicio < p_hasta
          ), '[]'::jsonb) as ausencias,

          coalesce((
            select jsonb_agg(jsonb_build_object('inicio', c.inicio, 'fin', c.fin))
            from appointments c
            where c.staff_id = s.id
              and c.estado = 'confirmada'
              and c.fin > p_desde and c.inicio < p_hasta
          ), '[]'::jsonb) as citas
        from staff s
        where s.client_id = p_client_id and s.activo
        order by s.orden, s.nombre
      ) t
    ), '[]'::jsonb),

    'servicios', coalesce((
      select jsonb_agg(v order by v.orden, v.nombre)
      from (
        select
          b.id,
          b.nombre,
          b.duracion_min,
          b.alias,
          b.orden,
          coalesce((
            select jsonb_agg(m.staff_id)
            from booking_service_staff m
            join staff s2 on s2.id = m.staff_id and s2.activo
            where m.booking_service_id = b.id
          ), '[]'::jsonb) as staff
        from booking_services b
        where b.client_id = p_client_id and b.activo
        order by b.orden, b.nombre
      ) v
    ), '[]'::jsonb)
  );
$$;

revoke execute on function agenda_contexto(uuid, timestamptz, timestamptz) from public;
grant execute on function agenda_contexto(uuid, timestamptz, timestamptz)
  to authenticated, service_role;

-- === Reservar, sin que quepa nadie por medio ===

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
begin
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

revoke execute on function agenda_reservar(
  uuid, uuid, timestamptz, timestamptz, jsonb, text, text, text, text, text, uuid
) from public;
grant execute on function agenda_reservar(
  uuid, uuid, timestamptz, timestamptz, jsonb, text, text, text, text, text, uuid
) to authenticated, service_role;

-- === Cancelar ===
-- Una cita cancelada libera su hueco (la restricción solo mira las
-- confirmadas), y hace falta desde ya: si el motor crea la cita en Supabase y
-- después falla al escribirla en Google, hay que poder deshacerla.

create or replace function agenda_cancelar(p_id uuid)
returns jsonb
language sql
as $$
  update appointments set estado = 'cancelada' where id = p_id and estado = 'confirmada';
  select jsonb_build_object('ok', true, 'id', p_id);
$$;

revoke execute on function agenda_cancelar(uuid) from public;
grant execute on function agenda_cancelar(uuid) to authenticated, service_role;
