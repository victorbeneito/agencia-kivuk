-- Editar una cita ya dada, sin que pueda quedarse a medias.
--
-- Mover una cita ya se podía (arrastrándola en la rejilla), y cancelarla
-- también. Lo que faltaba era corregirla: el bot guarda el nombre que la
-- persona usa en WhatsApp («VicBen»), y en el mostrador se quiere poner el
-- nombre de verdad, anotar «trae radiografía» o cambiar el tratamiento porque
-- al verlo resulta que no era una revisión.
--
-- Por qué una función y no dos escrituras desde la aplicación: cambiar el
-- tratamiento cambia la duración, y son dos tablas —la cita y sus servicios—.
-- Hechas por separado, un fallo entre medias deja una cita que ocupa 90 minutos
-- con el servicio de 30 escrito debajo, y eso no lo detecta nadie hasta que
-- alguien se queda sin su hora. Aquí las dos van en el mismo bloque: o las dos
-- o ninguna, igual que en `agenda_reservar` (0015).
--
-- Los servicios se reemplazan enteros en vez de irse comparando uno a uno: la
-- lista es corta, llega ya ordenada desde el formulario y así `posicion` se
-- recalcula sola sin huecos.

create or replace function agenda_editar(
  p_id uuid,
  p_staff_id uuid,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_servicios jsonb default '[]'::jsonb,
  p_nombre text default '',
  p_contacto text default '',
  p_notas text default ''
)
returns jsonb
language plpgsql
as $$
declare
  v_estado text;
begin
  select estado into v_estado from appointments where id = p_id for update;

  if v_estado is null then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;

  -- Una cita cancelada no se edita: su hueco ya está libre y otra persona puede
  -- tenerlo. Revivirla por la puerta de atrás sería dar dos veces la misma hora.
  if v_estado <> 'confirmada' then
    return jsonb_build_object('ok', false, 'motivo', 'cancelada');
  end if;

  update appointments
  set staff_id = p_staff_id,
      inicio = p_inicio,
      fin = p_fin,
      nombre_contacto = coalesce(p_nombre, ''),
      contacto = coalesce(p_contacto, ''),
      notas = coalesce(p_notas, '')
  where id = p_id;

  delete from appointment_services where appointment_id = p_id;

  insert into appointment_services (
    appointment_id, booking_service_id, nombre, duracion_min, posicion
  )
  select
    p_id,
    nullif(s->>'id', '')::uuid,
    s->>'nombre',
    (s->>'duracion_min')::int,
    (i - 1)
  from jsonb_array_elements(coalesce(p_servicios, '[]'::jsonb))
       with ordinality as e(s, i);

  return jsonb_build_object('ok', true, 'id', p_id);

exception
  -- Alargar una cita puede hacer que se pise con la siguiente, y cambiar de
  -- persona, con lo que esa persona ya tenía. No es un error: es un "así no
  -- cabe", y quien llama tiene que poder decirlo con esas palabras.
  --
  -- La cita no se pisa consigo misma: una restricción de exclusión no compara
  -- una fila con su propia versión anterior.
  when exclusion_violation then
    return jsonb_build_object('ok', false, 'motivo', 'ocupado');
  when foreign_key_violation then
    return jsonb_build_object('ok', false, 'motivo', 'trabajador_desconocido');
end;
$$;

revoke execute on function agenda_editar(
  uuid, uuid, timestamptz, timestamptz, jsonb, text, text, text
) from public;
grant execute on function agenda_editar(
  uuid, uuid, timestamptz, timestamptz, jsonb, text, text, text
) to authenticated, service_role;
