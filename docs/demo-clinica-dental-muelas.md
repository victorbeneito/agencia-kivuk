# Clínica Dental Muelas — cliente de demostración

Cliente **simulado** para enseñar el producto a clínicas dentales reales. Es la
hermana de `docs/demo-peluqueria-mechas.md`: mismo producto, mismos scripts,
otro sector. No hay negocio detrás: ni la clínica, ni la dirección, ni Elena,
Javier, Marta y Carla.

| Pieza | Archivo | Dónde acaba |
| --- | --- | --- |
| Prompt del bot | `docs/prompt-clinica-dental-muelas.md` | `agent_configs.system_prompt` |
| Base de conocimiento (23 documentos) | `docs/conocimiento-clinica-dental-muelas.md` | `knowledge_documents` + sus embeddings |
| Servicios reservables (20) | `docs/servicios-clinica-dental-muelas.csv` | `booking_services` |
| Equipo, horarios y quién hace qué | `scripts/montar-demo-clinica.js` | `staff`, `staff_hours`, `booking_service_staff` |
| Batería de 71 preguntas | `docs/preguntas-clinica-dental-muelas.txt` | — |

---

## 0. Montado el 21/09/2026

Ya está creado: **`Clinica Dental Muelas`**, id `eeb5affc-5979-4387-8232-b983ed8c2351`,
con el prompt y los 23 documentos cargados.

```bash
node scripts/montar-demo-clinica.js --aplicar
node scripts/cargar-prompt.js docs/prompt-clinica-dental-muelas.md "Clinica Dental Muelas" --aplicar
node scripts/cargar-conocimiento.js docs/conocimiento-clinica-dental-muelas.md "Clinica Dental Muelas" --aplicar
node scripts/probar-conocimiento.js "Clinica Dental Muelas" --bateria docs/preguntas-clinica-dental-muelas.txt
```

Igual que el de la peluquería, es idempotente y sirve para **devolver la demo a
su estado de fábrica** después de enseñarla. Los dos montadores comparten ahora
`scripts/lib/montar-demo.js`; cada uno solo describe su negocio.

Lo único que falta es **el número**: está explicado al final.

## 1. El horario y el equipo

La clínica abre de lunes a jueves de 9:00 a 14:00 y de 16:00 a 20:00, y el
viernes solo por la mañana. Citas de 30 minutos por defecto, cada 15.

| | Lunes | Martes | Miércoles | Jueves | Viernes |
| --- | --- | --- | --- | --- | --- |
| **Elena** (general, directora) | 9-14, 16-20 | 9-14, 16-20 | 9-14 | 9-14, 16-20 | 9-14 |
| **Javier** (cirugía, implantes, encías) | 9-14, 16-20 | | 9-14, 16-20 | | 9-14 |
| **Marta** (ortodoncia, niños) | | 16-20 | | 9-14, 16-20 | |
| **Carla** (higienista) | 9-14 | 9-14, 16-20 | 9-14, 16-20 | 9-14, 16-20 | 9-14 |

Es la forma real de una clínica pequeña: la general y la higienista casi todos
los días, y los especialistas en días sueltos. **Eso es lo que hace que la demo
enganche a un dentista**: la pregunta que más repite su recepción al teléfono es
«¿qué día viene el de los implantes?», y aquí la agenda ya lo sabe.

En el panel se ven como `Elena`, `Javier`, `Marta` y `Carla`, sin «Dra.»: el
motor empareja por palabra completa, y «con la doctora Elena» no contiene
«Dra. Elena». El tratamiento va en el conocimiento, que es lo que lee el bot.

## 2. Quién hace qué

| Servicio | Elena | Javier | Marta | Carla |
| --- | :---: | :---: | :---: | :---: |
| Primera visita, revisión, urgencia | ✅ | ✅ | | |
| Limpieza dental, revisión y limpieza | | | | ✅ |
| Empaste, endodoncia, carillas, férula | ✅ | | | |
| Extracción, corona, prótesis removible | ✅ | ✅ | | |
| Muela del juicio, implante | | ✅ | | |
| Periodoncia (raspado) | | ✅ | | ✅ |
| Blanqueamiento | ✅ | | | ✅ |
| Estudio y revisión de ortodoncia | | | ✅ | |
| Revisión infantil | ✅ | | ✅ | |
| Selladores | | | ✅ | ✅ |

Al revés que en la peluquería, **todos los servicios están en la matriz**: en
una clínica casi nada lo hace cualquiera, y uno olvidado quedaría reservable con
la higienista.

## 3. Los servicios y sus alias

El motor busca el servicio **dentro de la frase entera** cuando la IA todavía no
lo ha extraído, así que los alias se han elegido para no casar por accidente:

- Nada de «muela» suelta: casaría con el propio nombre de la clínica. Se usa
  «sacar una muela», «muela del juicio», «dolor de muelas».
- Nada de «nervio»: «estoy nerviosa» lo contiene. Se usa «matar el nervio».
- Nada de «consulta»: «quería consultar» lo contiene.
- Los síntomas no apuntan a tratamientos («me sangran las encías» no reserva un
  raspado de una hora). La excepción es el dolor, que va a **Urgencia**, porque
  es exactamente lo que haría recepción.

Las duraciones del CSV son las mismas que las de la base de conocimiento. Si se
cambia una, se cambia en los dos sitios.

## 4. Comprobado contra el motor

Antes de escribir nada se ejecutó el motor real (`n8n/logica/motor-agenda.js`)
con este montaje, situándose en el lunes 21/09/2026 a las 8:00:

| Consulta | Lo que devuelve |
| --- | --- |
| Ortodoncia (brackets) | solo martes 16:00–19:15 y jueves todo el día |
| Implante (90 min) | solo lunes, miércoles y viernes; empiezan hasta las 12:30 y las 18:30 |
| Limpieza el lunes | solo mañana, porque Carla no está por la tarde |
| Limpieza con Elena | *«Elena no hace limpieza dental. Sí lo hace Carla.»* |
| Urgencia el viernes a las 17:00 | ocupado; ofrece el viernes a las 13:30 y las tardes anteriores |
| Ortodoncia el lunes con Marta | ocupado, con alternativas de martes y jueves |
| Reservar sin decir qué | *«¿Qué te vas a hacer?»* con la lista de servicios |

Y el emparejamiento de frases reales: «me duele mucho una muela» → Urgencia;
«quiero pedir presupuesto de implantes» → Primera visita; «me toca el ajuste de
brackets» → Revisión de ortodoncia; «revisión para mi hijo» → Revisión infantil;
«estoy muy nerviosa, quiero cita» y «hola clínica dental muelas» → nada, que es
lo correcto.

La batería de 71 preguntas contra la búsqueda real: de las 63 que tienen
respuesta, el documento correcto sale **el primero en 58** y entre los cinco que
recibe el bot en todas. Las cinco flojas son preguntas muy cortas («dónde
estáis», «qué son los selladores», «habláis valenciano») o que tocan dos temas
(«tomo Sintrom, ¿me podéis sacar una muela?» trae antes el de extracciones que
el de medicación). Las ocho sin respuesta no recuperan nada que permita
inventarla.

**Lo que no se ha probado todavía** es la conversación de punta a punta con el
bot de n8n, porque la clínica aún no tiene número. Es lo primero que hay que
hacer en cuanto lo tenga, con el guion de abajo.

---

## Guion de la demo, en cuatro minutos

Cada mensaje contesta una objeción distinta del dentista:

1. **«hola cuanto cuesta una limpieza?»** → 50 €, 45 minutos, la hace la
   higienista, y la revisión sale gratis si va junto. *Sabe de lo mío.*
2. **«y un implante?»** → la referencia (1.300 € por diente, con la corona) y
   la invitación a la primera visita gratuita. *No regala presupuestos por
   chat: me trae pacientes a la primera visita, que es donde se cierra el
   tratamiento.* Este es el argumento que vende en una clínica.
3. **«vale, teneis el jueves por la tarde?»** → huecos reales del jueves.
4. **«a las 6»** → cita confirmada, con el recordatorio de traer DNI y la lista
   de medicamentos. Se enseña la cita en el panel y **el recordatorio del día
   antes**: en una clínica un sillón vacío de hora y media de implante es
   mucho dinero, y el dentista lo sabe mejor que nadie.
5. **«me duele muchísimo una muela desde ayer»** → primero «siento que te
   duela», luego la urgencia de hoy con huecos reales. *Trata a mis pacientes
   como mi recepcionista buena.*
6. **«tengo la cara muy hinchada y me cuesta tragar»** → urgencias del hospital
   o 112, lo primero y sin rodeos, y aviso al equipo. **Es el mensaje más
   importante de la demo.** Lo que le da miedo a un dentista no es que el bot no
   sepa algo: es que entretenga con horas libres a alguien con un flemón.
7. **«quiero hablar con alguien»** → suena el móvil y contesta él desde la PWA.
   *Sigo mandando yo.*

Dos de propina, si hay tiempo o si el dentista quiere pillarlo:

- **«que antibiótico me tomo?»** → no pauta medicación. **«os mando una foto
  de la muela»** → no diagnostica, primera visita.
- **«ortodoncia el lunes»** → «la Dra. Marta viene martes y jueves».

Lo que conviene tener preparado porque lo van a preguntar:

- **Protección de datos.** Los datos de salud son categoría especial. El bot
  está diseñado para no pedirlos y no repetirlos, pero un paciente puede
  escribirlos igualmente, y la conversación queda en el panel. Antes de un
  cliente real hay que cerrar con él el encargo de tratamiento y el aviso de
  privacidad del WhatsApp.
- **No cambia ni anula citas por chat**, igual que en la peluquería: lo pasa a
  recepción, que lo hace desde el panel.
- **No se conecta con su software de gestión** (Gesden, Clinic Cloud y
  similares). La agenda es la del panel. Es la primera objeción seria que hará
  una clínica que ya tiene programa, y la respuesta honesta hoy es esa.

---

## El número de WhatsApp

**La decisión es tuya, y hay tres caminos.**

### 1. Compartir el número de pruebas entre las dos demos (hoy, gratis)

El bot averigua qué negocio es por el `phone_number_id`, así que un número solo
puede estar en un cliente a la vez. Pero en cada reunión se enseña **una** demo,
así que basta con moverlo antes:

```bash
node scripts/pasar-numero-demo.js "Clinica Dental Muelas"            # simulación
node scripts/pasar-numero-demo.js "Clinica Dental Muelas" --aplicar  # lo mueve
node scripts/pasar-numero-demo.js "Peluqueria Mechas" --aplicar      # y de vuelta
```

Mueve número, WABA y token juntos, quita el número del origen antes de ponerlo
en el destino (si fallara, lo devuelve) y se niega si el destino ya tiene otro
número. Mientras la clínica tenga el número, Mechas se queda sin él: no contesta
y sus recordatorios no salen.

Sirve para lo mismo que servía con Mechas: probarlo tú y enseñarlo **desde tu
móvil**. Sigue con los mismos límites: solo habla con los cinco números dados de
alta en Meta y aparece como «Test Number».

### 2. Otro número de pruebas de Meta (no merece la pena)

El número de pruebas viene con la cuenta de pruebas de la app de Meta. Para
tener otro habría que crear **otra app** en Meta, con su propio token y su
propio webhook apuntando a n8n, y seguiría con los mismos dos límites. Es
trabajo y no resuelve lo que importa, que es que el cliente potencial pueda
escribir desde su móvil.

### 3. Una línea real para demos (lo que hace falta para vender)

Una prepago o una eSIM que **no esté dada de alta en la app de WhatsApp**,
registrada en la Cloud API con los mismos scripts que Cestería
(`scripts/registrar-numero-whatsapp.js`). Cualquiera puede escribirle, se le
pone un QR o un `wa.me` en la tarjeta, y el dentista la prueba esa noche en el
sofá. Es la misma razón que en la peluquería: la venta no pasa en la reunión,
pasa cuando le contesta bien a las once de la noche.

Tres cosas a comprobar antes de comprarla:

- **El límite de números del portfolio.** Meta limita los números que puede
  registrar un portfolio sin verificar, y el de Kivuk ya tiene dos reales
  (Cestería y la agencia). Hay que mirar en el Centro de seguridad si está
  verificado; si no, el tercero puede no entrar.
- **El nombre que se ve.** Meta revisa el nombre visible y tiene que
  corresponder a un negocio real. «Clínica Dental Muelas» no existe y lo más
  probable es que lo rechace. Uno genérico como «Kivuk Demo» sí es defendible,
  y además vale para todos los sectores.
- **La plantilla del recordatorio.** `recordatorio_cita` está aprobada en la
  cuenta de pruebas; en una WABA nueva hay que volver a pedirla con
  `scripts/plantilla-whatsapp.js`.

**Recomendación:** una sola línea real con nombre genérico («Kivuk Demo») y
`pasar-numero-demo.js` para cambiarla de sector antes de cada reunión. Da el
mismo efecto que una por sector por el precio de una. El único inconveniente es
que, si esa semana se enseñan las dos demos, el primero que se la llevó a casa
deja de tener la suya; cuando pase, será el momento de la segunda línea.
