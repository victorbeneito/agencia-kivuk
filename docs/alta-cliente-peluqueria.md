# Alta de una peluquería: del «sí» a funcionando

El procedimiento para convertir un «lo probamos» en un asistente contestando a
sus clientas. Escrito el 29/09/2026, antes del primer cliente real de
peluquería, a partir de lo que ya funcionó con las tres demos y con Cestería.

**Objetivo: una semana.** El primer «sí» es también el primer caso, y un alta
que se alarga tres semanas se enfría. La parte que depende de Kivuk es un día de
trabajo; lo demás son esperas de Meta y la agenda de la peluquera.

| Cuándo | Qué | Quién |
| --- | --- | --- |
| Día 0 | El «sí»: contrato, cobro, qué número se usa, fecha para la sesión de alta | Víctor + ella |
| Día 1-3 | Sesión de alta en el salón (45 min) con la ficha | Víctor + ella |
| Día 2-4 | Meta: la cuenta de WhatsApp, el número y la plantilla del recordatorio | Víctor (y esperar a Meta) |
| Día 3-5 | Montaje: servicios, equipo, horarios, prompt y conocimiento | Víctor |
| Día 5-6 | Prueba con ella (30 min) y ajustes | Víctor + ella |
| Día 6-7 | Se abre a sus clientas | Ella |
| Días 7-37 | Primer mes: revisar conversaciones y afinar. Día 30: los números | Víctor |

---

## Día 0 — El «sí»

1. **Contrato** (`docs/legal/contrato-servicio.md`). Rellenar el Anexo I:
   paquete «Recepcionista de WhatsApp», precio, uso incluido y, si es de las
   cinco primeras, la oferta de fundadores y la garantía como condición
   particular. En el Anexo II, datos de salud: **no**.
2. **Cobro de la puesta en marcha** por transferencia o Bizum.
3. **Qué número se va a usar.** Es la decisión que más condiciona el calendario
   (apartado siguiente). Mejor saberlo hoy.
4. **Dejarle la ficha** (`docs/material-venta/ficha-alta-peluqueria.md`,
   impresa) y **fijar la sesión de alta**, con fecha y hora, antes de irte.

## El número

Tres opciones, en el orden en que conviene proponerlas:

| Opción | A favor | En contra |
| --- | --- | --- |
| **El fijo del salón** | Sus clientas ya se lo saben; las llamadas siguen sonando igual | Solo vale si **no** está dado de alta en WhatsApp (ni en la app normal ni en WhatsApp Business). Se verifica con una llamada, no con SMS |
| **Una línea nueva** | No toca nada de lo que ya tiene | Número nuevo que dar a conocer. Una prepago hay que mantenerla activa: si caduca, la operadora puede dar el número a otra persona |
| **Su móvil actual** | Sus clientas ya se lo saben | Deja de funcionar en la app del móvil y **pierde el historial**. A partir de ahí se atiende desde el panel |

La línea nueva va **a nombre de la peluquería** y la paga ella: el contrato
dice que el número es suyo (cláusula 3.1), y así lo es de verdad.

Comprobar que el número elegido **no tiene WhatsApp**: escribirle desde tu
móvil. Si aparece, hay que borrar esa cuenta desde el teléfono que la tenga
antes de seguir. Si no se hace, Meta no deja registrarlo.

## Día 1-3 — La sesión de alta

En el salón, con la ficha y en un rato tranquilo. Cuarenta y cinco minutos.

- **Rellenarla juntos**, no dejársela de deberes: una ficha que se lleva a casa
  vuelve en dos semanas o no vuelve.
- **Foto de la lista de precios** y del cartel de horario.
- **Lo que más importa es la duración de cada servicio**, porque de ahí salen
  los huecos. Si no la sabe de memoria, preguntar «¿cuánto tiempo le reservas en
  la agenda?».
- **Quién hace qué y cuándo libra cada una.** Es lo que la peluquera comprueba
  primero cuando ve los huecos que ofrece el bot.
- **Instalar el panel en su móvil** (apartado «Panel y avisos»), si ya está
  creado el usuario. Si no, en la prueba.

## Día 2-4 — Meta

Se hace igual que con Cestería: **una cuenta de WhatsApp (WABA) a nombre de la
peluquería, dentro del portfolio de Kivuk.** No una línea más en la WABA de
Kivuk, como las demos, porque cada negocio tiene que tener su propia cuenta
(su nombre, su calidad de envíos, su historial ante Meta), y porque así se le
puede trasladar el día que se vaya.

> El modelo «de socio» de `docs/conectar-meta.md` (el cliente crea su propio
> portfolio y verifica su negocio) es mejor en teoría, pero son papeles y
> semanas para una peluquería. Para las primeras, este. El contrato ya lo
> contempla (cláusula 3.2), y al irse se le traslada el número (3.5).

1. **Crear la WABA** en el portfolio de Kivuk → WhatsApp Manager → crear cuenta.
   Nombre: el del salón.
2. **Asignarla al usuario del sistema** de Kivuk con control total
   (Configuración del negocio → Usuarios del sistema → Asignar activos). El
   token de Kivuk es el mismo para todos los clientes; sin este paso no llega a
   la WABA nueva. Comprobado el 29/09/2026 que sí llega a la de Cestería.
3. **Añadir el número** en esa WABA, con el **nombre visible** del salón tal
   como lo escribe en su cartel. Verificar con el SMS (o con la llamada, si es
   un fijo). Meta revisa el nombre visible; mientras lo revisa, puede salir el
   número en vez del nombre.
4. **Crear el cliente en el panel** si no está (apartado siguiente) y activar el
   número:

   ```bash
   node scripts/activar-numero-demo.js "Peluqueria Rosi" <phone_number_id> <pin> --waba <waba_id>            # comprueba
   node scripts/activar-numero-demo.js "Peluqueria Rosi" <phone_number_id> <pin> --waba <waba_id> --aplicar  # lo hace
   ```

   Registra el número, suscribe la app a la WABA (sin esto no llega ni un
   mensaje y no da ningún error) y guarda número, WABA y token en el cliente.
   El PIN son 6 dígitos que eliges tú: **apúntalo** en el gestor de
   contraseñas, hace falta si algún día hay que volver a registrarlo.
5. **Plantilla del recordatorio.** Es por WABA, así que la nueva no la tiene:

   ```bash
   node scripts/plantilla-whatsapp.js "Peluqueria Rosi" --crear --aplicar
   node scripts/plantilla-whatsapp.js "Peluqueria Rosi"     # hasta que salga APPROVED
   ```

   Meta tarda de minutos a 24 horas. Hasta entonces el recordatorio no sale.
6. **Foto de perfil y descripción** del número: el logo del salón, su dirección
   y su horario. Es lo primero que ve una clienta al abrir el chat.

## Día 3-5 — El montaje

Mismo patrón que las demos, con un archivo por pieza y el nombre del salón en
todos:

| Pieza | Se hace a partir de | Archivo |
| --- | --- | --- |
| Servicios y duraciones | Apartado 5 de la ficha | `docs/servicios-peluqueria-rosi.csv` |
| Horario, equipo y quién hace qué | Apartados 3 y 4 | `scripts/montar-peluqueria-rosi.js` |
| Prompt | `docs/prompt-peluqueria-mechas.md` | `docs/prompt-peluqueria-rosi.md` |
| Conocimiento | `docs/conocimiento-peluqueria-mechas.md` y la ficha | `docs/conocimiento-peluqueria-rosi.md` |
| Batería de preguntas | Apartado 7 de la ficha y las de la demo | `docs/preguntas-peluqueria-rosi.txt` |

**El cliente**, con el nombre **sin tildes** (`Peluqueria Rosi`): así lo buscan
los scripts. Lo que ve la clienta sale del prompt, no de ahí. Se crea en el panel
con los módulos **WhatsApp** y **Agenda**; nada más, que un módulo activo que no
se usa es una pestaña vacía por la que preguntará.

**Servicios** (`nombre,duracion_min,alias`): los alias son las formas en que
las clientas lo piden («mechitas», «cortarme las puntas»). Los de
`docs/servicios-peluqueria-mechas.csv` sirven casi todos. **El precio no va
aquí**: va en el conocimiento.

**Horario y equipo:** copiar `scripts/montar-peluqueria-rosi.js` de
`scripts/montar-demo-peluqueria.js` y cambiar el horario, el equipo y
`soloLosHacen`. La librería se llama `montar-demo` pero no tiene nada de demo:
sirve para cualquier cliente y es idempotente.

**Prompt:** copiar el de la demo y cambiar el nombre, el tono si hace falta y
las reglas de la ficha (apartado 8: lo que no debe hacer). **Quitar el bloque
`[SI PREGUNTAN QUÉ ES ESTO O QUIÉN LO HA HECHO]`**, que es de demo: en un salón
de verdad no es un negocio inventado. Si en el apartado 10 de la ficha dijo que
sí, se deja una línea: si preguntan quién lo ha montado, «Kivuk,
agenciakivuk.com». Solo si preguntan.

**Conocimiento:** las 18 secciones de la demo son las de la ficha. Cada
documento empieza con dos o tres preguntas como las haría una clienta, porque
el buscador encuentra lo que se parece a la pregunta.

```bash
node scripts/montar-peluqueria-rosi.js --aplicar
node scripts/cargar-prompt.js docs/prompt-peluqueria-rosi.md "Peluqueria Rosi" --aplicar
node scripts/cargar-conocimiento.js docs/conocimiento-peluqueria-rosi.md "Peluqueria Rosi" --aplicar
node scripts/probar-conocimiento.js "Peluqueria Rosi" --bateria docs/preguntas-peluqueria-rosi.txt
```

Todo es relanzable: se corrige el archivo y se vuelve a cargar.

## Panel y avisos

- **Usuario del panel** para la dueña, desde la configuración del cliente en
  `/dashboard` (el acceso lo crea `dashboard/[clientId]/acceso.ts`). Es rol de
  cliente: ve sus conversaciones y su agenda, contesta en la bandeja y no toca
  nada de la configuración. Otro por cada persona del salón que vaya a atender.
- **La app en su móvil**: abrir `panel.agenciakivuk.com`, «Añadir a pantalla de
  inicio», entrar y **activar las notificaciones**. Probar que suena.
- **Correo de avisos**, si lo quiere.
- **Recordatorio** activado en la agenda, cuando la plantilla esté aprobada, con
  el **nombre del negocio en el mensaje** escrito como en su cartel. Si se deja
  vacío, las clientas leen el nombre interno, sin tildes.
- **Facturación**: ficha fiscal y servicios contratados en
  `/dashboard/facturacion`, tal cual el Anexo I. Antes, el catálogo de servicios
  y el IBAN de Kivuk (hoy vacíos, ver `docs/plan-agencia-ia.md`).

## Día 5-6 — La prueba con ella

Treinta minutos en el salón. Ella escribe desde **su** móvil, como si fuera una
clienta, y tú miras el panel.

- [ ] Se presenta como el asistente del salón.
- [ ] Los precios son los suyos, con sus recargos.
- [ ] Pide cita para un servicio largo: los huecos son de verdad y de quien lo
      hace.
- [ ] Pide cita con una persona concreta en su tarde libre: no se la da.
- [ ] La cita aparece en el calendario del panel.
- [ ] Cambia la cita de día por el chat, y después la anula.
- [ ] «Quiero hablar con alguien»: le suena el móvil, entra en la bandeja y
      contesta ella; el bot se calla.
- [ ] Una pregunta que no está en la ficha: no se la inventa.
- [ ] Las cinco preguntas del apartado 7 de la ficha.

Lo que falle, se corrige en el archivo y se vuelve a cargar delante de ella. Que
vea que se ajusta en el momento es la mitad de la confianza.

**Antes de irte, borrar las citas de prueba** desde el panel: el bot da una sola
cita futura por persona, y la suya de prueba le bloquearía la agenda y la de su
número.

## Día 6-7 — Se abre

Lo hace ella, y hay que decirle cómo:

- **Cartel con el QR** en el mostrador y en el espejo: «Pide tu cita por
  WhatsApp, a cualquier hora». Hoy `scripts/generar-qr-demos.js` solo hace
  las tarjetas de las demos; para el primer cliente hay que añadirle el cartel
  (es cambiar el número, el texto y el tamaño).
- **El número en la bio de Instagram** y en su ficha de Google.
- **Contárselo a sus clientas en persona**, al cobrar. Nada de mensajes
  masivos desde el número del asistente: los mensajes que inicia el negocio
  necesitan plantillas aprobadas, y a quien no lo ha pedido no se le escribe.

## El primer mes

Es el que decide si renueva y si se convierte en caso.

- **Revisar las conversaciones** dos veces por semana las dos primeras semanas,
  y una después. Lo que no supo contestar va al conocimiento el mismo día.
- **Llamarla a la semana**: «¿qué tal?, ¿algo que no te guste?». Una queja que
  se oye a tiempo es un ajuste; si no, es una baja.
- **Día 30, los números**: conversaciones atendidas, cuántas fuera de horario,
  citas dadas, cambiadas y anuladas por el chat. Se sacan de `conversations`,
  `messages` y `appointments` por `client_id`. Con ellos:
  - se cierra la garantía (si era de las cinco primeras);
  - se le pide la reseña y el permiso para contarlo con su nombre;
  - y va a la sección «Casos» de la web.

## Trampas conocidas

- **El número tiene WhatsApp** en algún móvil: Meta no lo registra. Se nota
  tarde, así que comprobarlo el día 0.
- **La app sin suscribir a la WABA**: todo verde y no llega nada. Lo hace el
  script; si se hace a mano, no olvidarlo.
- **La WABA sin asignar al usuario del sistema**: el script lo detecta y lo
  dice.
- **El PIN** del registro, apuntado.
- **Una prepago que caduca** se lleva el número.
- **El nombre del cliente con tildes** en el panel: los scripts no lo
  encuentran.
- **Citas de prueba sin borrar**: una sola cita futura por persona.
- **Horarios mal cargados** son lo primero que la peluquera detecta y lo que
  más confianza quita. Revisar la tarde libre de cada una antes de la prueba.
