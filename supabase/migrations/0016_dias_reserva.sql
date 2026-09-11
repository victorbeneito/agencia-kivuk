-- Hasta cuándo se puede pedir cita, por cliente.
--
-- El motor tenía una sola ventana de 7 días que hacía dos trabajos a la vez:
-- cuántos días de huecos se le enseñan a la IA, y hasta cuándo se acepta una
-- fecha concreta. Con los dos números pegados, a quien pedía para dentro de
-- tres semanas se le contestaba «todavía no tengo abierta la agenda tan lejos»
-- — y en una peluquería eso es el caso normal, no la excepción: quien se tiñe
-- vuelve a las cuatro o cinco semanas y pide la siguiente cita al salir por la
-- puerta.
--
-- Ahora son dos cosas distintas. Lo que se enseña sigue siendo una semana
-- (esa lista viaja dentro del prompt en cada mensaje, y treinta días de horas
-- libres no los lee nadie por WhatsApp). Lo que se acepta es esto, y es del
-- negocio: una peluquería lo quiere en 60, un fisio en 15.
--
-- Vive en `client_modules.config` del módulo calendar, como `duracion_min` y
-- `paso_min`, así que no hay tabla nueva: solo hay que devolverlo en el JSON
-- que lee el motor.

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
      -- Solo los campos que el motor necesita, y NO el `config` entero. Ahí
      -- dentro viven el `google_client_secret` y el `refresh_token`, y este
      -- JSON va a atravesar el nodo de cálculo, sus logs y sus mensajes de
      -- error. Las credenciales de Google las lee n8n en su propio nodo, que es
      -- el único sitio que las usa.
      select jsonb_build_object(
        'duracion_min', coalesce(cm.config->>'duracion_min', '60'),
        'paso_min', coalesce(cm.config->>'paso_min', '15'),
        'zona', coalesce(cm.config->>'zona', 'Europe/Madrid'),
        'dias_reserva', coalesce(cm.config->>'dias_reserva', '30')
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
