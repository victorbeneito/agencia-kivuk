# Documentación legal de la agencia

| Archivo | Qué es | Para quién |
| --- | --- | --- |
| `contrato-servicio.md` | Contrato de prestación de servicios con tres anexos: hoja de servicios, contrato de encargado del tratamiento y lista de subencargados | El cliente, para firmar |
| `README.md` | Este archivo: por qué cada cláusula dice lo que dice, y qué falta antes de usarlo | Interno y para la revisión de la gestoría |

**Estado a 29/09/2026: borrador sin revisar.** Lo ha redactado Claude a partir
de lo que la plataforma hace de verdad y de lo que el bot de Kivuk ya promete a
los clientes. No es asesoramiento jurídico: antes de firmarlo con nadie lo tiene
que repasar alguien que responda de ello.

---

## Por qué hacía falta antes de vender

La política de privacidad de la web dice que los datos de los clientes se rigen
por «el contrato de servicio y el contrato de encargado del tratamiento que lo
acompaña». Ninguno de los dos existía.

Y no es un trámite: en cuanto el bot atiende a los clientes de un negocio, Kivuk
trata datos personales por cuenta de ese negocio, y el art. 28 RGPD exige ese
contrato por escrito. Con clínicas dentales y de fisioterapia —dos de las tres
demos— además se roza la categoría especial (datos de salud).

## El contrato repite lo que el bot ya promete

El bot de Kivuk lleva semanas contándole a quien pregunta cómo son las
condiciones (`docs/conocimiento-kivuk-agencia.md`, documentos 15-19 y 24). El
contrato no puede decir otra cosa, así que se ha escrito a partir de ahí:

| Lo que dice el bot | Dónde está en el contrato |
| --- | --- |
| Precios sin IVA | 5.1 |
| Puesta en marcha al principio | 5.2 |
| Primera cuota por transferencia o Bizum, luego domiciliada | 5.3 |
| La cuota incluye la IA y la mensajería | 5.4, con un límite de «uso incluido» |
| No hay permanencia, sin plazos ni penalizaciones | 7.1 y 7.2 |
| El número se da de alta a tu nombre y es tuyo | 3.1, 3.2 y 3.5 |
| Tus datos son tuyos y te los llevas | 9.1 y 10.1 |
| No se inventa lo que no sabe; tú entras y se calla | 4.1 y 4.2 |
| Dominio a nombre del cliente | Anexo I y 9.3 |
| Soporte L-V de 9 a 19 | 6.1 |

Si alguna de estas cosas cambia, hay que cambiarla **en los dos sitios**.

## Decisiones que conviene mirar con la gestoría

**1. El «uso incluido» (5.4, 5.5 y Anexo I).** El bot dice que la cuota cubre el
coste de la IA y de la mensajería, y Meta cobra por mensaje. Sin un techo, un
cliente con mucho volumen puede costar más de lo que paga. Se ha puesto un
límite por conversaciones al mes que se rellena en cada contrato, y si se supera
**no sube solo**: se propone y el cliente acepta o se da de baja. Falta decidir
la cifra por defecto; con los datos de Cestería y de las demos se puede estimar
el coste real por conversación.

**2. La baja (7.2).** «No hay permanencia» se ha traducido en: te das de baja
cuando quieras, tiene efecto al final del mes ya pagado y no se devuelve ese
mes. Es lo más cercano a lo que promete el bot sin regalar medio mes.

**3. La puesta en marcha si no sale (5.2).** Si el servicio no se puede montar
por algo que no depende del cliente —Meta rechaza la verificación, por ejemplo—
se devuelve la parte no hecha. Es lo que haría cualquiera de buena fe, y
escribirlo quita un miedo en la venta.

**4. El límite de responsabilidad (13.3):** lo pagado en los últimos 12 meses,
salvo dolo o culpa grave. Es el estándar en servicios de software entre
empresas. Solo vale porque el contrato es **entre profesionales** (el
Expositivo 2 lo dice): con un consumidor, buena parte de estas cláusulas no se
sostendría.

**5. Tribunales de València (16).** Válido entre empresas. Se ha dejado entre
corchetes por si se prefiere Ontinyent u otro partido.

**6. La cuenta de WhatsApp vive en el portfolio de Kivuk (3.2).** Corregido el
29/09/2026: el borrador decía que la cuenta de WhatsApp Business era del
cliente y estaba a su nombre, y no es así como se da de alta. Se hace como con
Cestería: una cuenta con el nombre del negocio dentro del portfolio de Kivuk
(`docs/alta-cliente-peluqueria.md`), porque el modelo «de socio» obliga a la
peluquería a crear su propio portfolio y verificar su negocio ante Meta. Lo que
sí es suyo es el número, y al irse se le traslada (3.5). Si algún cliente
prefiere tener su propio portfolio, se hace así y la 3.2 no aplica.

**7. La domiciliación (5.3).** Cobrar por domiciliación SEPA necesita un
identificador de acreedor que da el banco y una orden firmada por cada cliente.
La alternativa sin trámites es Stripe con SEPA, que está en el plan como
«cobro automático». Mientras tanto, se puede cobrar por transferencia.

## Lo que el contrato promete y la plataforma todavía no cumple

Esto es lo más importante de este archivo: una cláusula que no se cumple es peor
que no tenerla.

- ~~**El asistente se identifica como automático (4.3).**~~ **Hecho el
  29/09/2026.** El primer mensaje de cada conversación empieza por «Hola, soy el
  asistente virtual de…», y también cuando vuelve a contestar el bot después de
  una persona o tras más de 30 días. Es para todos los clientes a la vez; cómo
  funciona está en `n8n/workflows/README.md`, «El bot dice que es un asistente».
  Lo exige además el art. 50 del Reglamento europeo de IA desde el 2 de agosto
  de 2026 (que la gestoría confirme que no se ha aplazado).
- **Exportar los datos al terminar (9.1).** No hay botón. Se puede hacer a mano
  con una consulta por `client_id` mientras haya pocos clientes; con más, merece
  una pantalla.
- **Copias de seguridad (Anexo II, apartado 6).** Hay que confirmar qué copias
  hace Supabase en el plan contratado y si se hace alguna del servidor, y
  escribirlo tal cual. Si no hay, no se promete.
- **Borrar al terminar (9.2 y Anexo II, apartado 11).** Tampoco hay botón. Igual
  que la exportación: a mano, por `client_id`, y comprobando que no quedan
  archivos en Storage.

## Datos que faltan

- **Dónde están los datos.** La región del proyecto de Supabase y la ubicación
  del VPS de Contabo (Anexo III). Si alguno está fuera de la UE, es una
  transferencia internacional y hay que decirlo también en la política de
  privacidad de la web (pendiente desde `docs/web-corporativa.md`).
- **OpenRouter.** La política de privacidad de la web lo nombra, pero hoy ningún
  flujo lo usa: el bot, las notas de voz y la búsqueda en el conocimiento van
  todos a OpenAI directamente. El Anexo III solo lista lo que se usa de verdad.
  Si algún día entra OpenRouter, se avisa con 30 días (Anexo II, apartado 7).
- **Los contratos de encargado de cada proveedor** (los DPA de Supabase, OpenAI,
  Resend y Google). Todos los tienen publicados y se aceptan desde su panel;
  conviene descargarlos y guardarlos, porque el Anexo II (4.h) promete poder
  demostrar que se cumple.
- **Registro de actividades de tratamiento** (Anexo II, 4.i): una hoja con qué se
  trata por cuenta de cada cliente. Con el Anexo I de cada contrato ya está casi
  hecho.

## Cómo se usa cada vez

1. Se rellena el Anexo I con lo acordado en la llamada (servicios, precios, uso
   incluido) y los datos del cliente.
2. En el Anexo II se marca si habrá datos de salud.
3. Se envía en PDF y se firma: vale una firma electrónica o la aceptación
   expresa por correo.
4. Lo que dice el Anexo I se da de alta tal cual en
   `/dashboard/facturacion` (ficha fiscal y servicios contratados), que es de
   donde salen las facturas.

El Anexo I y la ficha de facturación contienen lo mismo, así que el día que
exista el CRM de captación, lo natural es que la hoja de servicios se genere
desde el panel con los datos del cliente ya puestos, igual que las facturas.
