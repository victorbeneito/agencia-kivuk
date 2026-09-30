# Recordatorios de cita por WhatsApp

La confirmación de la cita ya la da el bot en el mismo hilo, en el momento. Lo
que faltaba es el aviso de la víspera, y ese no se puede mandar igual: cuando
llega el momento de recordar, la conversación lleva horas o días muerta.

## Por qué no por correo

Porque no se lee. Un recordatorio compite con decenas de correos comerciales y
se cuela entre ellos o directamente en spam; un WhatsApp entra donde la persona
ya está mirando, y encima en el mismo hilo donde pidió la cita. Para una
peluquería el aviso no es cortesía: es la diferencia entre un hueco perdido y
una silla ocupada.

El correo sigue existiendo para lo que sí se archiva —una factura—, y ahí tiene
sentido. Un recordatorio no se archiva.

## La regla de las 24 horas

La Cloud API de Meta solo deja escribir texto libre dentro de las **24 horas
siguientes al último mensaje de la persona**. Fuera de esa ventana hay que usar
una **plantilla aprobada** por Meta, con el texto revisado de antemano y huecos
para los datos que cambian.

Esto no es un trámite que sortear: es la razón de que WhatsApp no sea un canal
de spam, y por eso la plataforma lo respeta en vez de buscarle la vuelta.

De ahí sale casi todo el diseño de esta pieza.

## La plantilla

Vive en `scripts/plantilla-whatsapp.js`, no en el panel de Meta, porque **la
plantilla y el código que la rellena son la misma cosa**. El cuerpo tiene cuatro
huecos y el workflow manda cuatro valores en un orden concreto; si alguien edita
el texto en WhatsApp Manager y mueve un hueco, el recordatorio sale con la hora
donde va el día y no se entera nadie hasta que lo lee una clienta. Teniéndola
aquí, el texto que se mandó a revisión está versionado al lado del código que lo
usa.

```
Recordatorio de tu cita

Te recordamos tu cita en {{1}}.

Día: {{2}}
Hora: {{3}}
Con: {{4}}

Si no puedes venir o quieres cambiarla, contéstanos a este mensaje y lo vemos.
```

```bash
node scripts/plantilla-whatsapp.js "Peluqueria Mechas"            # las que tiene
node scripts/plantilla-whatsapp.js "Peluqueria Mechas" --crear    # simula el alta
node scripts/plantilla-whatsapp.js "Peluqueria Mechas" --crear --aplicar
```

Cuatro decisiones que parecen menores y no lo son:

- **UTILITY, no MARKETING.** Recordar algo que la persona pidió es una utilidad.
  Como marketing costaría más, necesitaría consentimiento explícito y Meta la
  rechazaría por no vender nada.
- **No lleva el nombre de quien viene.** Un parámetro vacío hace que Meta
  rechace el envío **entero**, y el nombre falta más de lo que parece: una cita
  apuntada en el mostrador puede no tenerlo. «Hola {{1}}» con el hueco vacío no
  es que quede mal, es que no sale.
- **Cada hueco lleva su etiqueta delante.** Dos parámetros seguidos —aunque
  estén en líneas distintas— son motivo de rechazo. Y se lee mejor.
- **Termina invitando a contestar.** Esa respuesta abre la ventana de 24 horas:
  a partir de ahí el bot puede hablar normal, sin más plantillas. El
  recordatorio no es solo un aviso, es la puerta que deja pasar la conversación.

Una plantilla aprobada **no se edita** en su idioma: se borra y se crea otra,
que vuelve a pasar revisión. Por eso el alta pide `--aplicar`.

## El workflow

`n8n/workflows/recordatorios-citas.json`, disparado por reloj cada hora:

```
Cada hora
  -> Citas próximas            (appointments confirmadas, sin avisar, < 86 h)
  -> Configuración de agenda   (quién lo tiene encendido, y cuánto antes)
  -> Credenciales de WhatsApp  (el token de cada negocio)
  -> Preparar avisos           (a quién toca ahora, y con qué texto exacto)
  -> Enviar plantilla          (Meta)
  -> ¿Lo aceptó Meta?  sí -> Marcar como avisada -> Guardar en la conversación
                       no -> Sin enviar
```

### Cada hora, y una ventana que se arrastra

Lo evidente sería un cron diario: «a las seis de la tarde, los de mañana». Se
hizo rodante —**todo lo que esté a menos de las horas configuradas y a más de
dos**— y esa decisión resuelve tres problemas de golpe:

- Si n8n estuvo parado justo a esa hora, el aviso sale en la siguiente pasada en
  vez de perderse para siempre.
- Como la ventana **se cierra sola** dos horas antes de la cita, un número que
  Meta rechaza deja de reintentarse sin necesidad de una lista de reintentos ni
  de un contador de fallos.
- A quien pide cita para dentro de tres horas no se le manda un recordatorio de
  algo que acaba de decidir.

Que no se mande dos veces lo garantiza `recordatorio_enviado_at`, que existe en
`appointments` desde la migración `0014` con su índice parcial.

### De noche no se escribe a nadie

Añadido el 30/09/2026, al poder elegir avisos de pocas horas. Con la ventana
rodante sola, «3 horas antes» recordaba una cita de las 9:00 a las 6:00 de la
mañana, y ya pasaba con la antigua opción de 4 horas. **Entre las 21:00 y las
9:00 no sale nada**, y el momento de avisar se mueve así:

| Si el aviso cae… | Sale… |
| --- | --- |
| por la noche (21:00-24:00) | a las 20:00 de esa tarde |
| de madrugada, y a las 9:00 aún quedan 3 horas para la cita | a las 9:00 |
| de madrugada, y a las 9:00 ya no quedan 3 horas | a las 20:00 de la tarde anterior |

| Cita | Aviso | Sale |
| --- | --- | --- |
| 9:00 | 3 h | 20:00 del día antes |
| 10:00 | 4 h | 20:00 del día antes |
| 12:00 | 6 h | 9:00 del mismo día |
| 18:00 | 12 h | 9:00 del mismo día |
| 11:00 | 12 h | 20:00 del día antes |
| 8:30 | 24 h | 9:00 del día antes |

Se adelanta en vez de retrasar porque retrasarlo lo dejaría pegado a la cita,
sin margen para anularla. Si el aviso sale el mismo día de la cita, dice «hoy»
en vez de «mañana».

Por el adelanto, un aviso de 72 horas puede tocar hasta 13 horas antes: por eso
`Citas próximas` carga las de las próximas 86 horas y no 73.

Y si la pasada misma cae de noche —n8n estuvo parado, o la cita se dio a las
23:00 para las 10:00 del día siguiente— se espera a la mañana; si para entonces
faltan menos de dos horas, ese recordatorio no sale. Comprobado con el código
real del nodo, simulando las pasadas de hora en hora.

### Solo se marca si Meta lo acepta

La cita se marca como avisada **después** de que Meta devuelva un id de mensaje.
Si falla —el número no existe, el token caducó, la plantilla no está aprobada—
no se marca, y la siguiente pasada lo reintenta hasta que la ventana se cierra
sola. El motivo del rechazo queda a la vista en el nodo `Sin enviar`.

### Y se marca antes de guardarlo en la bandeja

Al revés parece más natural, pero si fallara la escritura del historial la
próxima pasada mandaría el recordatorio **otra vez**. Perder una línea del
historial es peor que mandar dos WhatsApp solo si no has visto nunca la cara de
alguien que recibe dos.

### Qué se le pide a Supabase, y qué no

Las tres consultas piden **los campos sueltos**, no el `config` entero del
módulo: ahí dentro viven el `client_secret` y el `refresh_token` de Google, y
este JSON atraviesa nodos, logs y mensajes de error. Es el mismo criterio que
sigue `agenda_contexto` desde la `0015`.

Los dos nodos de configuración van con `executeOnce`: sin eso se llamarían una
vez **por cita**.

## Se enciende a mano, por cliente

Panel → cliente → Configuración → **Recordatorio de la cita por WhatsApp**:

| Campo | Qué es |
| --- | --- |
| Mandar el recordatorio | Apagado de serie. |
| Nombre del negocio en el mensaje | Como lo escribe el negocio, con tildes (`recordatorio_negocio`). Vacío = el nombre interno del cliente |
| Cuánto antes | 3, 6, 12, 24 (por defecto), 48 o 72 horas. Nunca de noche: ver «De noche no se escribe a nadie». |
| Plantilla en Meta | `recordatorio_cita`. |
| Idioma | `es`. |

Apagado de serie a propósito: esto no le escribe al negocio, le escribe **a sus
clientas**. Eso se enciende mirando, no se hereda de un valor por defecto.

**El nombre, siempre relleno.** Hasta el 30/09/2026 el recordatorio usaba
`clients.name`, que es el nombre interno y va sin tildes para que lo encuentren
los scripts. El primer recordatorio real de la demo salió como «Te recordamos tu
cita en Peluqueria Mechas». Ahora ese nombre queda solo de respaldo, y las tres
demos llevan el suyo en `scripts/montar-demo-*.js`.

## Cuando contestan

La respuesta entra por el webhook de siempre y abre la ventana de 24 horas. El
bot la contesta como cualquier otro mensaje: con su prompt, su conocimiento y su
agenda. Hoy, si lo que piden es **cambiar o anular** la cita, el bot escala a una
persona —que es lo honesto mientras no esté construido—; pero el hilo ya está
abierto y no hace falta ninguna plantilla más.

## Límites conocidos

- **El número de pruebas de Meta solo habla con cinco números** dados de alta.
  Con él, cualquier recordatorio a otro número se rechaza. Es la razón de que la
  demo necesite una línea real.
- **Una cita sin conversación no deja rastro en la bandeja.** El recordatorio
  sale igual; lo que no hay es hilo donde escribirlo. Desde este cambio, las
  citas que da el bot guardan su `conversation_id` —antes no lo hacían, y se
  descubrió justo aquí—, así que esto solo afecta a las citas apuntadas a mano
  en el mostrador, hasta que esa persona conteste y el bot le abra un hilo.
- **Mover o cancelar una cita no avisa a nadie.** Necesita su propia plantilla
  («tu cita ha cambiado»), que no es esta: recordar y avisar de un cambio son
  dos mensajes distintos y Meta los revisa por separado.
- **El texto está en dos sitios**: la plantilla en el script, y una copia en el
  nodo `Preparar avisos` para dejarlo escrito en la bandeja. Meta no devuelve el
  mensaje ya montado, así que o se duplica o el historial se queda en blanco. Si
  se cambia uno hay que cambiar el otro, y está avisado en ambos.
- **Las conversaciones de utilidad las cobra Meta** (céntimos), y una cita
  recordada es una conversación abierta. Con las cuentas de hoy no se nota; con
  cientos de citas al mes, entra en el precio del módulo.

## Probarlo

```bash
node n8n/logica/recordatorios.prueba.js
```

41 comprobaciones sobre el `jsCode` real del nodo `Preparar avisos`, tal como
ha quedado dentro del JSON. Lo que se comprueba sobre todo es **a quién NO se le
escribe**: sin encender, sin credenciales, sin teléfono, la config de otro
cliente, demasiado pronto, demasiado tarde. Un recordatorio de más no es un
fallo que se vea en una pantalla y se arregle: es un mensaje que ya está en el
teléfono de la clienta de otro.

También cubre el horario de invierno, que es donde esto se rompería sin que
nadie lo estuviera mirando: en enero Madrid va a UTC+1, y formatear en UTC
mandaría el aviso diciendo una hora antes de la buena.
