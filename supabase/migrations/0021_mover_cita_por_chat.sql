-- Lo que le falta a la base para que el bot pueda mover una cita por el chat.
--
-- Mover ya se sabía hacer: `agenda_editar` (0019) cambia hora y persona en una
-- sola transacción y avisa si no cabe. Lo que no había era la forma de
-- **encontrar** la cita de quien escribe y de reconocerla dentro del hueco que
-- ocupa. Dos piezas:
--
--   1. `agenda_cita_futura`: las citas futuras de un teléfono, con sus
--      servicios. La regla de comparar teléfonos (solo dígitos, los nueve
--      últimos) vive aquí y en el candado de 0020, y en ningún otro sitio.
--
--   2. `agenda_contexto` devuelve ahora el `id` de cada cita ocupada. Sin él,
--      mover una cita de las 17:00 a las 17:30 diría «ocupado»: el motor vería
--      su propio hueco y no sabría que es el de la cita que está moviendo. La
--      base no tiene ese problema —una restricción de exclusión no compara una
--      fila con su versión anterior—, pero el motor calcula antes de tocar
--      nada, y es el que responde.
--
-- El `id` es un añadido: quien no lo mire sigue viendo el mismo JSON.

create or replace function agenda_cita_futura(
  p_client_id uuid,
  p_contacto text
)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(t.cita order by t.inicio), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', a.id,
      'inicio', a.inicio,
      'fin', a.fin,
      'staff_id', a.staff_id,
      'staff_nombre', coalesce(s.nombre, ''),
      'nombre_contacto', a.nombre_contacto,
      'contacto', a.contacto,
      'notas', a.notas,
      'google_event_id', a.google_event_id,
      'calendar_id', s.calendar_id,
      -- Los servicios viajan con el mismo formato que espera `agenda_editar`,
      -- porque de aquí salen tal cual: mover una cita no cambia lo que se hace,
      -- y si no se le pasaran, los borraría (reemplaza la lista entera).
      'servicios', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', x.booking_service_id,
          'nombre', x.nombre,
          'duracion_min', x.duracion_min
        ) order by x.posicion)
        from appointment_services x
        where x.appointment_id = a.id
      ), '[]'::jsonb)
    ) as cita,
    a.inicio
    from appointments a
    left join staff s on s.id = a.staff_id
    where a.client_id = p_client_id
      and a.estado = 'confirmada'
      and a.fin > now()
      and length(right(regexp_replace(coalesce(p_contacto, ''), '\D', '', 'g'), 9)) = 9
      and right(regexp_replace(coalesce(a.contacto, ''), '\D', '', 'g'), 9)
        = right(regexp_replace(coalesce(p_contacto, ''), '\D', '', 'g'), 9)
    order by a.inicio
  ) t;
$$;

revoke execute on function agenda_cita_futura(uuid, text) from public;
grant execute on function agenda_cita_futura(uuid, text) to authenticated, service_role;

-- === El contexto del motor, con el id de cada cita ===========================

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
            select jsonb_agg(jsonb_build_object('id', c.id, 'inicio', c.inicio, 'fin', c.fin))
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
