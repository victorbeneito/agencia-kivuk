# Peluquería Mechas — cliente de demostración

Cliente **simulado** para enseñar el producto a peluquerías reales antes de que
tengan que decidir nada. No hay negocio detrás: ni el salón, ni la dirección, ni
Ana, Sonia y Luisa.

Tres piezas, y cada una en su archivo:

| Pieza | Archivo | Dónde acaba |
| --- | --- | --- |
| Prompt del bot | `docs/prompt-peluqueria-mechas.md` | `agent_configs.system_prompt` |
| Base de conocimiento (18 documentos) | `docs/conocimiento-peluqueria-mechas.md` | `knowledge_documents` + sus embeddings |
| Servicios reservables (25) | `docs/servicios-peluqueria-mechas.csv` | `booking_services` |

Lo que queda —los tres trabajadores, sus horarios y quién hace qué— se monta a
mano en el panel y está descrito abajo.

---

## 0. Montado el 11/09/2026

Ya está creado: **`Peluqueria Mechas`**, id `06e73c80-e60f-4a41-bbc6-d33940506e14`.
Lo montó `scripts/montar-demo-peluqueria.js`, que hace de una vez todo lo que
describen los apartados 1 a 4 —cliente, módulos, horario, las tres con su
horario día a día, los 25 servicios y las 56 casillas de la matriz—:

```bash
node scripts/montar-demo-peluqueria.js            # simulación
node scripts/montar-demo-peluqueria.js --aplicar  # lo escribe
node scripts/cargar-prompt.js docs/prompt-peluqueria-mechas.md "Peluqueria Mechas" --aplicar
node scripts/cargar-conocimiento.js docs/conocimiento-peluqueria-mechas.md "Peluqueria Mechas" --aplicar
```

Es idempotente: empareja por nombre y actualiza en vez de duplicar, así que
también sirve para **devolver la demo a su estado de fábrica** después de
enseñarla. Lo que no toca son las credenciales de WhatsApp y de Google, que se
ponen desde el panel.

Los apartados que siguen describen lo que monta, que es lo que hay que saber
para enseñarlo y para repetirlo a mano con un cliente real delante.

## 1. Alta del cliente

En **Panel → Clientes → Nuevo**, con el nombre exacto `Peluqueria Mechas` (sin
tilde: es el nombre con el que lo buscan los scripts). Módulos a activar:

- **WhatsApp con IA** — el bot.
- **Agenda / Calendar** — las citas.

El resto (voz, marketing, Instagram) **fuera**. Un módulo activo que no se
enseña es una pestaña vacía que el cliente potencial ve y por la que pregunta.

## 2. Prompt y conocimiento

```bash
node scripts/cargar-prompt.js docs/prompt-peluqueria-mechas.md "Peluqueria Mechas"
node scripts/cargar-conocimiento.js docs/conocimiento-peluqueria-mechas.md "Peluqueria Mechas" --aplicar
node scripts/probar-conocimiento.js "Peluqueria Mechas" --bateria docs/preguntas-peluqueria-mechas.txt
```

La tercera línea no es opcional. Son 60 preguntas escritas como las escribe una
clienta, y las ocho últimas **no tienen respuesta en la base a propósito**: ahí
el bot tiene que decir que no lo sabe. Un bot de demo que se inventa el precio de
un balayage delante de una peluquera se cae solo, porque ella sí sabe cuánto
cuesta.

## 3. Horario del negocio y de cada trabajadora

Primero, **Configuración → Horario de la agenda**, que es de donde hereda su
horario cada trabajadora nueva:

| Campo | Valor |
| --- | --- |
| Días laborables | martes a sábado |
| Mañana | 10:00 – 14:00 |
| Tarde | 16:00 – 20:00 |
| Duración de cada cita | 60 min |
| Una cita puede empezar cada | 15 min |

Después, en **Agenda → Trabajadores**, las tres. Se crean con ese horario ya
puesto y solo hay que quitarles la tarde que libran y la del sábado:

| | Martes | Miércoles | Jueves | Viernes | Sábado |
| --- | --- | --- | --- | --- | --- |
| **Ana** | 10-14, 16-20 | 10-14 | 10-14, 16-20 | 10-14, 16-20 | 10-14 |
| **Sonia** | 10-14 | 10-14, 16-20 | 10-14, 16-20 | 10-14, 16-20 | 10-14 |
| **Luisa** | 10-14, 16-20 | 10-14, 16-20 | 10-14, 16-20 | 10-14 | 10-14 |

Las tardes libres están repartidas a propósito: **cada una libra una tarde
distinta y nunca se queda el salón con una sola persona**. Ana libra el miércoles
por la tarde, Sonia el martes y Luisa el viernes. Eso hace que la agenda que ve
el cliente potencial no sea un rectángulo perfecto, que es lo que delata a una
demo.

`calendar_id` de cada una: vacío. Google es opcional desde la migración `0014`, y
para la demo estorba más de lo que aporta —salvo que se quiera enseñar
precisamente eso, en cuyo caso se crean tres calendarios en la cuenta del
negocio y se pegan sus identificadores.

## 4. Servicios y quién hace qué

**Agenda → Servicios → Importar CSV**, pegando `docs/servicios-peluqueria-mechas.csv`.
La vista previa dirá 25 altas; solo entonces se escribe.

Las duraciones del CSV son **las mismas** que las de la base de conocimiento. Si
se cambia una, hay que cambiarla en los dos sitios: el bot dice la duración que
lee en el conocimiento y la agenda reserva la del servicio, y si no coinciden,
promete hora y media y ocupa dos.

Luego, en **la matriz completa**, esto:

| Servicios | Ana | Sonia | Luisa |
| --- | :---: | :---: | :---: |
| Lavados, peinados y cortes (mujer, caballero, niños) | ✅ | ✅ | ✅ |
| Arreglo de barba | | | ✅ |
| Color: raíz, color completo, matiz, baño de color | ✅ | ✅ | |
| Mechas, balayage y decoloración | ✅ | ✅ | |
| Keratina, botox y permanente | ✅ | ✅ | |
| Hidratación y anticaída | ✅ | ✅ | ✅ |
| Peinado de fiesta y recogido | ✅ | | ✅ |
| Novia (prueba y día de la boda) | ✅ | | |

Se rellena por columnas: marcar la columna de Ana entera y luego quitarle nada,
Sonia entera y quitarle barba, recogidos y novias, y a Luisa marcarle solo las
filas suyas. Con la matriz completa son tres pasadas, no cuarenta clics.

Esa distribución no es decorativa: es la que hace posibles las dos frases que
mejor venden esto en una peluquería —*«Luisa no hace mechas, te las puede hacer
Ana o Sonia»* y *«las novias las lleva Ana»*—, que es exactamente lo que hoy
resuelven ellas al teléfono catorce veces al día.

## 5. Comprobado contra el motor

Antes de escribir nada de lo de arriba se ejecutó el motor real
(`n8n/logica/motor-agenda.js`) con este montaje —las tres con sus horarios, los
25 servicios y la matriz— situándose en el martes 15/09/2026 a las 9:00. Sale
esto:

| Consulta | Lo que devuelve |
| --- | --- |
| Disponibilidad genérica (60 min) | martes a viernes 10:00–19:00, sábado 10:00–13:00 |
| Mechas (150 min) | empiezan hasta las 11:30 y hasta las 17:30; el sábado, solo mañana |
| Arreglo de barba (solo Luisa) | el viernes se corta a las 13:30, porque libra esa tarde |
| Mechas con Luisa | *«Luisa no hace mechas medio casco. Sí lo hace Ana y Sonia»* |
| Corte + mechas juntos | una sola cita de 2 h 45, con Ana |
| Novia el sábado a las 17:00 | ocupado, con alternativas reales |

Las 25 filas del CSV entran sin un solo error con el parser del panel, y el
emparejamiento acierta las 39 formas de pedirlo que se probaron: «mechitas»,
«cortarme el pelo», «la raiz», «californianas», «moño», «rubio platino».

Dos detalles menores que se ven en esa tabla y que conviene saber antes de que
los vea un cliente: el motor escribe *«Sí lo hace Ana y Sonia»* (en singular) y
da las fechas en formato `2026-09-19` dentro de algunos mensajes de alternativas.
Ninguna de las dos rompe nada, las dos se arreglan en un rato, y en una demo se
notan.

---

## Lo que hoy funciona y lo que todavía no

Esto hay que leerlo **antes** de enseñar nada, porque la demo promete lo que se
enseña y el cliente potencial lo va a probar.

### Funciona

- Preguntas frecuentes con datos reales: precios, duraciones, horarios,
  políticas, quién hace qué. Y decir «no lo sé» cuando el dato no está.
- Dar cita: el bot ofrece **huecos reales** de los próximos 7 días, calculados
  sobre el horario de las tres, y reserva. La cita entra en `appointments`, se
  ve en el panel y llega un correo de confirmación.
- Pedir una persona: se avisa al equipo y la conversación salta a la bandeja del
  panel, con aviso en pantalla, correo y notificación al móvil. **Este es el
  mejor momento de la demo**: se pide "quiero hablar con alguien" y suena el
  móvil delante del cliente potencial, que contesta él mismo desde la PWA.

### Antes que nada: la fase 3 no está desplegada

Comprobado contra Supabase el 11/09/2026: **la migración `0015` no está
aplicada**. Las tablas de la `0014` sí están (por eso el montaje ha podido
escribir trabajadoras, servicios y matriz), pero `agenda_contexto` y
`agenda_reservar` no existen en la base, y `agenda-api.json` sigue modificado sin
desplegar. O sea que el motor nuevo está escrito y probado, pero **en producción
todavía responde la Agenda API vieja, la de un solo trabajador**.

Hasta que eso se despliegue, la demo puede enseñar las preguntas frecuentes y el
relevo humano, pero no las citas. El orden es: aplicar la `0015` en Supabase,
regenerar y desplegar los workflows, y después la fase 4.

### Todavía no (fase 4 de `docs/agenda-multiple.md`)

**El bot no le pasa a la agenda ni el servicio ni la trabajadora.** El motor sabe
hacerlo desde la fase 3 —la Agenda API acepta `servicios` y `trabajador`, los
empareja y elige a quien menos carga tenga—, pero el workflow del bot todavía
manda solo fecha, hora y correo. Consecuencias en la demo:

- Todos los huecos se calculan con la duración por defecto (60 min), no con la
  del servicio. Unas mechas de dos horas y media entran en un hueco de una hora.
- La cita se asigna a quien esté libre, aunque pidan a Ana. Por eso el prompt
  dice *«te lo apunto»* y no *«te la dejo con Ana»*: el nombre queda escrito en
  el motivo de la cita y se ve en el panel, pero no es una asignación real.

**Mi recomendación: cerrar la fase 4 antes de enseñar esto a nadie.** El material
está listo y toda la lógica difícil ya está hecha y probada (62 comprobaciones
del motor); falta el cableado en `whatsapp-bot.json`: extraer servicio y persona
en `Preparar contexto`, emparejarlos en código en `Decidir acción` y pasarlos en
`Comprobar o reservar`. Sin eso, la demo enseña una peluquería en la que todas
las citas duran lo mismo y da igual quién te atienda, que es justo lo que una
peluquera sabe que no es verdad.

### Dos detalles que conviene decidir

**El correo es obligatorio para reservar, y hay que quitarlo.** Hoy no se cierra
una cita sin él (lo exige tanto `Decidir acción` como el motor). En una tienda es
normal; en una peluquería de pueblo, pedirle el correo a una señora para cortarse
el pelo chirría —el teléfono ya lo tenemos, es por donde está escribiendo—.

**Decidido (11/09/2026): la confirmación se manda por WhatsApp**, que es donde la
gente la ve, en vez de por correo, donde se pierde entre el spam. Es lo que hacen
los sistemas de reservas de restaurantes y dentistas, y aquí sale casi de balde:
la persona acaba de escribir, así que la ventana de 24 horas de la Cloud API está
abierta y vale un mensaje normal, sin plantilla ni aprobación de Meta. Además ya
existe `enviar-whatsapp.json`, que es el único sitio del proyecto que habla con
Meta para mandar mensajes.

Lo que sí necesita plantilla aprobada es el **recordatorio de la víspera**, que
cae fuera de esa ventana. Es una plantilla de utilidad, se aprueba en un rato y
tiene un coste por mensaje pequeño; conviene pedirla con tiempo, no el día antes
de la primera demo.

Con la confirmación por WhatsApp, el correo pasa a ser opcional: se pide solo si
lo quieren, y deja de ser un paso obligatorio en mitad de la conversación.

**Cambiar y anular citas no está construido.** El prompt lo dice y lo escala a
una persona, que es lo honesto. Es la segunda pregunta que hará quien vea la
demo, así que mejor tener la respuesta preparada: se resuelve desde la bandeja,
y automatizarlo es la siguiente pieza.

---

## El número de WhatsApp para las pruebas

Dos caminos, y la diferencia importa más de lo que parece:

**El número de pruebas de Meta.** Es gratis, viene con la app y no hay que dar de
alta ninguna línea. A cambio: solo puede escribirse con hasta cinco números que
hay que registrar a mano en el panel de Meta, cada uno confirmando un código, y
aparece como número de test. Sirve para probar tú y para enseñarlo desde tu
propio móvil. **No sirve** para que el cliente potencial lo pruebe desde el suyo
esa misma tarde, ni para dejarle el enlace y que juegue en casa.

**Una línea nueva de verdad en la Cloud API** (una eSIM o una prepago valen).
Cualquiera puede escribirle, se le puede poner un `wa.me` o un QR en el móvil y
en la web, y el cliente potencial se lo lleva puesto: prueba en el sofá esa noche
y enseña la conversación a su socia. Es lo mismo que ya se hizo con Cestería, con
los mismos scripts (`scripts/conectar-meta.js`, `scripts/registrar-numero-whatsapp.js`),
y el número tiene que ser uno que **no esté dado de alta en la app de WhatsApp**.

Yo iría por la segunda. Una demo que solo funciona con tu móvil delante se muere
en cuanto sales por la puerta, y el momento en que esto se vende de verdad no es
la reunión: es cuando la peluquera le escribe «¿cuánto valen unas mechas?» a las
once de la noche y le contesta bien.

## Guion de la demo, en tres minutos

El orden está pensado para que cada mensaje conteste una objeción distinta:

1. **«hola cuanto valen unas mechas?»** → precio, qué incluye y cuánto dura.
   *Sabe de lo mío.*
2. **«y si tengo el pelo muy largo?»** → el recargo de 10 €.
   *Sabe los matices, no suelta un folleto.*
3. **«teneis hueco el viernes por la tarde?»** → huecos reales del viernes.
   *No se los inventa: son los de mi agenda.*
4. **«a las 5 me va bien»** y el correo → cita confirmada, correo enviado.
   Se enseña la cita ya metida en el panel.
5. **«me podeis dejar rubio platino? tengo tinte negro de casa»** → no valora un
   pelo por chat, invita a pasar por el salón. *No me va a prometer imposibles a
   mis clientas.*
6. **«quiero hablar con alguien»** → salta el aviso, suena el móvil, y se
   contesta desde la PWA delante de ella. *Sigo mandando yo.*

Y una que conviene hacer aunque no luzca: **preguntarle algo que no está en la
base** («¿hacéis extensiones?»). Que el bot diga que no lo sabe y avise al equipo
es lo que convence a quien lleva veinte años detrás de un mostrador, porque lo
que de verdad le da miedo no es que el bot no sepa: es que se lo invente.
