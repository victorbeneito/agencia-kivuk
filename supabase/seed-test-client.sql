-- Datos de prueba para validar el flujo de WhatsApp end-to-end (Fase 1).
-- Sustituye los placeholders TU_... por tus valores reales antes de ejecutar
-- en el SQL Editor de Supabase.

-- 1) La agencia (tú mismo como agency_admin)
insert into agencies (name, owner_user_id)
values ('Agencia Kivuk', 'TU_USER_UID_DE_AUTH')
returning id; -- copia este id, lo usarás abajo como agency_id

-- 2) Vincula tu usuario como admin de esa agencia
insert into user_profiles (id, agency_id, role)
values ('TU_USER_UID_DE_AUTH', 'EL_AGENCY_ID_DE_ARRIBA', 'agency_admin');

-- 3) Un cliente de prueba (el "negocio final" que usará el bot)
insert into clients (agency_id, name)
values ('EL_AGENCY_ID_DE_ARRIBA', 'Cliente de Prueba')
returning id; -- copia este id, lo usarás abajo como client_id

-- 4) Activa el módulo WhatsApp para ese cliente, con las credenciales de Meta
insert into client_modules (client_id, module, active, config)
values (
  'EL_CLIENT_ID_DE_ARRIBA',
  'whatsapp',
  true,
  jsonb_build_object(
    'phone_number_id', 'TU_PHONE_NUMBER_ID',
    'whatsapp_business_account_id', 'TU_WHATSAPP_BUSINESS_ACCOUNT_ID',
    'access_token', 'TU_ACCESS_TOKEN_TEMPORAL'
  )
);

-- 5) El prompt del bot para ese cliente
insert into agent_configs (client_id, name, system_prompt, knowledge_base)
values (
  'EL_CLIENT_ID_DE_ARRIBA',
  'Bot de prueba',
  'Eres un asistente virtual amable de una tienda de prueba. Responde de forma breve y cercana. Si te preguntan algo que no sabes, dilo con sinceridad.',
  ''
);
