# Marketing: potenciar a los clientes y vender la agencia

Hasta ahora la plataforma sabe **atender** (WhatsApp con IA, agenda, correos) y
**publicar** (contenido para Instagram y Facebook desde el catálogo del cliente).
Las dos cosas son reactivas: alguien escribe y se le responde, o se publica y se
espera a que pase algo.

Lo que falta es la parte que **sale a buscar**: llegar a gente que todavía no ha
escrito. Y falta en los dos frentes, porque son el mismo problema visto desde
dos lados:

- El cliente quiere vender más de lo suyo.
- Tú quieres vender más servicios de agencia.

La buena noticia es que la maquinaria es la misma. Un módulo de campañas sirve
para que Cestería Aparici avise de las cestas de Navidad y para que tú avises a
treinta comercios de que existes. Construir dos veces lo mismo sería el error.

---

## Parte 1 — Marketing para los clientes

### 1.1 Lo que ya está

- **Contenido para redes** (Fase 4): catálogo → copy con IA → pieza compuesta
  con FFmpeg → aprobación en el panel → publicación por la API. Instagram y
  Facebook.
- **Atención automática** que convierte una visita en conversación y una
  conversación en cita.

Es una base mejor de lo que parece: la mayoría de agencias pequeñas venden
«llevamos tus redes» y no tienen ni el catálogo conectado ni forma de responder
a quien pregunta por un producto a las once de la noche.

### 1.2 Lo que falta, por orden de lo que más mueve la aguja

**a) Campañas de WhatsApp con plantillas.** Es lo más valioso y lo más
infrautilizado. La base de contactos que ya tiene el cliente en `conversations`
es gente que le escribió: no es una lista comprada, es interés demostrado.
Meta permite escribirles fuera de la ventana de 24 horas mediante **plantillas
aprobadas** (marketing templates), con su coste por conversación y su
obligación de consentimiento y baja.

Sirve para: novedades de temporada, recuperación de quien preguntó y no compró,
recordatorio de cita, oferta a quien lleva seis meses sin volver.

Qué hay que construir: tabla de plantillas por cliente (las que Meta ha
aprobado), selector de audiencia sobre `conversations` (por última fecha, por lo
que preguntaron, por si compraron), envío por lotes desde n8n respetando los
límites de Meta, y **opt-out obligatorio** — un «STOP» que el bot entienda y que
marque el contacto como no contactable. Sin eso no se manda una sola campaña.

**b) Captación de conversaciones nuevas.** Ahora mismo el bot solo atiende a
quien ya conoce el número. Falta abrir la puerta:

- **Anuncios Click-to-WhatsApp** (Meta Ads). El anuncio no lleva a una web, abre
  una conversación — y esa conversación la atiende el bot que ya está montado.
  Es el encaje más directo entre lo que se vende y lo que se tiene.
- **QR en tienda, en el escaparate, en el ticket y en el embalaje.** Coste cero
  y convierte al que ya está delante del producto.
- **Enlace `wa.me` con mensaje precargado** en la web, en la biografía de
  Instagram y en la ficha de Google.

**c) Google Business Profile.** Para un negocio local con tienda física es, de
lejos, el canal con mejor relación esfuerzo/resultado — más que Instagram. Falta
como canal de publicación (las novedades se pueden publicar por API igual que en
Instagram) y como destino: reseñas, horarios, productos.

**d) Email marketing.** El módulo `email` hoy solo manda confirmaciones de cita.
Falta la lista, la segmentación y las campañas. Con Resend ya montado, el salto
es corto: una tabla de contactos con su origen y su consentimiento, un editor
sencillo, y el mismo circuito de aprobación que el contenido de redes.

Esto es **mandar** correo (campañas de salida). Es un concepto distinto de una
idea posterior planteada el 3/9/2026: que la IA **lea** el correo que le llega
al cliente — resumir la bandeja, marcar lo importante, sugerir respuesta — algo
tipo copiloto de bandeja de entrada, no un canal de marketing. No tiene nada
construido; aparece como pestaña «en desarrollo» en `docs/web-corporativa.md`
para no confundirla con esta.

**e) Medición.** Lo que renueva un contrato no es una gráfica bonita, es poder
decir «este mes 43 conversaciones, 12 citas, 7 ventas». Hoy los datos están en
Supabase pero nadie los cuenta. Un panel de resultados por cliente — y el mismo
resumen enviado por correo cada mes — es probablemente la funcionalidad con
mejor retorno de todo este documento, porque protege los ingresos que ya tienes.

### 1.3 El orden que propongo

1. Panel de resultados (protege lo que ya cobras).
2. Campañas de WhatsApp con plantillas (el activo desaprovechado).
3. Google Business Profile como canal de publicación.
4. Email marketing.
5. Click-to-WhatsApp: no es software, es acompañar al cliente a montarlo.

---

## Parte 2 — Vender los servicios de la agencia

### 2.1 El activo que ya tienes y no estás usando

**El producto es la mejor demostración de sí mismo.** Un comercio al que le
explicas «un asistente que atiende tu WhatsApp» se queda igual; uno al que le
das un número, le escribe y recibe una respuesta con criterio en dos segundos,
entiende el negocio entero en treinta segundos.

Lo primero, entonces: **un WhatsApp de la propia Kivuk con su bot**, entrenado
con los servicios y precios de la agencia, capaz de agendar una llamada en tu
calendario. Es la Fase 1 y la Fase 2 aplicadas a ti mismo. No hay que construir
nada nuevo: es darse de alta a uno mismo como cliente en el panel. Ese número va
en la web, en la firma del correo, en el QR de las tarjetas y en todos los
anuncios.

Lo segundo: **casos con números**. Tu tienda (`@hogardetusuenos`) y Cestería
Aparici son las dos pruebas. No hace falta que sean espectaculares, hace falta
que sean reales y concretos: cuántas conversaciones atendidas sin intervención
humana, cuántas fuera del horario comercial, cuántas citas. El dato de «fuera de
horario» es el que más convence a un comerciante, porque es dinero que sabe que
está perdiendo.

### 2.2 Canales, por orden de coste y de eficacia

**1. Prospección directa a negocios locales (lo primero y lo más barato).**
Elige un nicho concreto donde ya tengas un caso — comercio de decoración y
artesanía, por ejemplo — y trabaja una lista de 20-30 negocios de tu zona. Para
cada uno: un vídeo de 60 segundos enseñando **su** Instagram y **su** web, y qué
haría el bot con las preguntas que le llegan. Ese vídeo es el mensaje; el resto
es ruido.

Sobre la legalidad, que importa: a empresas y autónomos, sobre datos de contacto
publicados y para ofrecer servicios relacionados con su actividad, se puede
contactar amparándose en el interés legítimo (LOPDGDD art. 19), **siempre** con
identificación clara y una forma evidente de decir que no. Volumen humano,
personalizado y con registro de quién ha dicho que no. Nada de listas compradas
ni envíos masivos: además de ilegal, quema el dominio de correo y con él las
facturas y los avisos que salen del mismo sitio.

**2. Tu propio contenido, con tu propio producto.** Publicar en el Instagram y
el LinkedIn de la agencia usando el módulo de contenido. Que la herramienta se
alimente a sí misma es, además, el argumento de venta: «esto que ves lo genera
lo mismo que te vendo».

**3. Google Business Profile + SEO local.** «Agencia IA WhatsApp [tu ciudad]» es
una búsqueda con poquísima competencia y con intención de compra clarísima. Una
ficha bien puesta y tres páginas de servicio bien escritas rinden durante años.

**4. Alianzas.** Gestorías, diseñadores web, asociaciones de comercio y viveros
de empresas hablan cada semana con negocios que necesitan exactamente esto y no
lo saben. Una comisión por cliente traído es más barata que cualquier anuncio y
llega con la confianza puesta.

**5. Anuncios Click-to-WhatsApp.** Cuando haya presupuesto: el anuncio abre una
conversación con tu propio bot, que cualifica y agenda la llamada. Cierra el
círculo — vendes el producto usándolo.

### 2.3 La oferta

Sin una oferta escrita con precio no hay marketing que valga. El catálogo de
servicios del panel (`/dashboard/facturacion/servicios`) es el sitio donde vive:
lo que vendes, a qué precio y cada cuánto se cobra. Recomendación de estructura,
que además encaja con cómo está montada la facturación:

- **Puesta en marcha** (pago único): alta, conexión de WhatsApp, redacción del
  prompt, carga de la base de conocimiento y del catálogo.
- **Cuota mensual por módulo**: asistente de WhatsApp, agenda, contenido de
  redes. Que se pueda contratar suelto es lo que hace fácil decir que sí — y la
  plataforma ya funciona así, módulo a módulo.
- **Extras puntuales**: campaña de temporada, sesión de fotos, lote extra de
  contenido.

---

## Parte 3 — Qué construir en la aplicación

Todo lo anterior necesita una pieza que hoy no existe: **la agencia no tiene
dónde guardar a quien todavía no es cliente**. Un negocio al que has mandado un
vídeo, otro que pidió precio, otro al que hay que volver a llamar en octubre.
Eso hoy vive en la cabeza o en un cuaderno, y ahí es donde se pierden las
ventas.

### 3.1 CRM de captación (lo siguiente que construiría)

Una tabla `leads` colgando de `agencies` con: nombre del negocio, sector, cómo
se llegó a él, teléfono, correo, Instagram, estado del embudo y notas.

El embudo, corto a propósito: **nuevo → contactado → demo enviada → propuesta →
cliente / descartado**. Cinco columnas se mantienen al día; doce, no.

Dos cosas lo hacen valer la pena de verdad:

- **Convertir un lead en cliente sin retecleado**: el botón que crea el `client`,
  su ficha fiscal y sus servicios contratados a partir de la propuesta. La
  facturación ya está esperando al otro lado.
- **Seguimiento automático**: n8n avisa de los leads que llevan X días parados.
  El 80% de lo que se pierde se pierde por no volver a escribir.

### 3.2 Campañas (sirve para los clientes y para ti)

El mismo módulo, con el `client_id` apuntando a la agencia cuando la campaña es
tuya. Plantillas aprobadas, audiencia, envío por lotes desde n8n, y opt-out.

### 3.3 Panel de resultados

Por cliente y por mes: conversaciones, citas, contenido publicado, alcance.
Visible en `/panel` para el cliente y resumido por correo el día 1. Es lo que
justifica la cuota que ahora ya le estás facturando.

---

## Resumen: el orden que propongo

| # | Qué | Para quién | Por qué ahí |
| --- | --- | --- | --- |
| 0 | **Web corporativa en `agenciakivuk.com`** ✅ construida (`docs/web-corporativa.md`) | Agencia | Decidido el 2/9/2026: va antes que todo lo demás porque todo lo demás la necesita como destino — la prospección, la ficha de Google, los anuncios y la firma del correo. Landing corta orientada a una sola acción, no sitio corporativo. Y con el bot dentro: el botón principal abre el WhatsApp de la agencia, de modo que la web **es** la demostración |
| 1 | Kivuk como cliente de sí misma (bot propio + caso con números) | Agencia | Coste cero, es la demostración que vende. Va pegado al punto 0: sin el bot, la web es un folleto |
| 2 | CRM de captación | Agencia | Sin dónde guardar leads, la prospección se pierde |
| 3 | Panel de resultados | Cliente | Protege los ingresos que ya tienes |
| 4 | Campañas de WhatsApp con plantillas | Los dos | El activo desaprovechado, mismo motor |
| 5 | Google Business Profile | Los dos | Mejor esfuerzo/resultado en negocio local |
| 6 | Email marketing | Cliente | Resend ya está montado |
| 7 | Cobro automático con Stripe | Agencia | Cuando haya suficientes cuotas que perseguir |
