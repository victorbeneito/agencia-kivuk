-- Una cita movida vuelve a necesitar su recordatorio.
--
-- El cron de recordatorios (`recordatorios-citas.json`) avisa de las citas con
-- `recordatorio_enviado_at` a null, y la marca al enviar para no repetir. Pero
-- nadie la volvía a poner a null al cambiar la cita de día: una cita de mañana
-- que ya había recibido su aviso y se pasaba al viernes siguiente se quedaba
-- sin recordatorio para el viernes. Pasaba desde el panel (arrastrando en la
-- rejilla) y habría pasado mucho más desde que el bot mueve citas por el chat
-- (0021), que es justo cuando alguien dice «mañana no puedo».
--
-- La regla: si cambia `inicio`, el recordatorio se considera no enviado. Si
-- solo cambia la persona, el nombre o las notas, se respeta el que ya salió —
-- la hora que recuerda ese aviso sigue siendo la buena—.
--
-- Todo lo demás es igual que en 0019.

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
      notas = coalesce(p_notas, ''),
      -- En el lado derecho de un UPDATE, `inicio` es todavía el de antes.
      recordatorio_enviado_at = case
        when inicio is distinct from p_inicio then null
        else recordatorio_enviado_at
      end
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
