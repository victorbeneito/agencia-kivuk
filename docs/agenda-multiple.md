# Agenda con varios trabajadores y varios servicios

Cómo pasa la agenda de "un negocio = una agenda" a una peluquería donde Ana, Bea
y Sonia atienden a la vez, las mechas solo las hacen dos de ellas, y una visita
puede ser lavado + corte + mechas seguidos.

## De dónde venimos

Hasta la migración `0014`, toda la agenda de un cliente cabía en
`client_modules.config` del módulo `calendar`:

```json
{ "calendar_id": "...", "google_client_id": "...", "refresh_token": "...",
  "dias_laborables": "1,2,3,4,5", "manana_inicio": "09:00", "manana_fin": "14:00",
  "tarde_inicio": "16:00", "tarde_fin": "20:00", "duracion_min": "60", "paso_min": "15" }
```

Un calendario, un horario, una duración. Y las citas no existían en Supabase: la
única copia era el evento de Google, y el solape se detectaba con `freeBusy`.

Funciona para un autónomo. Se rompe con el primer negocio de dos personas.

## Las cuatro decisiones

### 1. La verdad se muda a Supabase; Google pasa a ser el espejo

**`freeBusy` devuelve franjas ocupadas anónimas.** Dice "de 17:00 a 18:00
ocupado", no de quién. Con un solo trabajador da igual; con tres es inservible,
porque la pregunta ya no es "¿está ocupado?" sino "¿está ocupada *Ana*?".

Así que las citas viven en `appointments`, con una restricción de exclusión que
impide el solape en la propia base de datos, y Google queda como espejo.

No es una rareza nuestra: **Booksy, Fresha, Treatwell y Doctoralia funcionan
igual.** Ninguna usa Google Calendar como base de datos de citas; todas tienen la
suya y ofrecen Google como sincronización opcional por profesional.

Que la verdad esté aquí resuelve además tres cosas que antes no teníamos dónde
apoyar: los **recordatorios** (un cron necesita algo que leer), la **agenda en el
panel**, y la **doble reserva** de dos conversaciones simultáneas.

### 2. Un calendario de Google por trabajador, y opcional

Consecuencia directa de lo anterior: un calendario compartido no permite saber de
quién es cada hueco ocupado.

Sirve para dos cosas concretas: que cada persona vea sus citas en el móvil, y que
si se bloquea el martes de 10 a 11 para ir al médico, el bot lo respete.

**Las credenciales de Google siguen siendo una sola**, las del negocio, en
`client_modules.config`. Los calendarios se crean dentro de esa misma cuenta. No
hay OAuth por trabajador.

Y como ya no es la fuente de la verdad, **`staff.calendar_id` puede quedar
vacío**: un negocio puede empezar sin Google en absoluto y todo funciona.

### 3. La duración es del servicio, no del negocio

Un corte son 30 minutos y unas mechas 120. `duracion_min` del módulo se queda
solo como valor por defecto para quien no defina servicios.

**Una visita puede llevar varios servicios**: la duración es la suma y los
candidatos son la intersección de quien puede hacerlos todos. Por eso
`appointment_services` es una tabla y no una columna.

### 4. El horario es del trabajador, y por día

Mañana y tarde iguales toda la semana no describe una peluquería, donde el sábado
es solo por la mañana y cada persona libra un día distinto.

## Esquema (`0014_agenda_multiple.sql`)

| Tabla | Qué guarda |
| --- | --- |
| `staff` | Trabajadores: nombre, `calendar_id` opcional, `activo`, `orden` |
| `staff_hours` | Una fila por tramo y día de la semana (1..7 = L..D) |
| `staff_time_off` | Vacaciones, bajas y ratos sueltos, con hora |
| `booking_services` | Servicios reservables: nombre, `duracion_min`, `alias[]` |
| `booking_service_staff` | La matriz servicio × trabajador |
| `appointments` | Las citas. La fuente de la verdad |
| `appointment_services` | Qué se hace en cada cita, con nombre y duración copiados |

Detalles que no se ven en la tabla y conviene no perder:

- **`booking_services` no es `services`.** Aquella (0013) es el catálogo de lo
  que la agencia le vende al cliente. Esta es lo que el cliente le vende a su
  público. De ahí el prefijo.
- **Sin precio en `booking_services`, a propósito.** Los precios que dice el bot
  salen del conocimiento y del catálogo; una segunda fuente de precios es la
  forma de acabar diciendo dos cifras distintas.
- **Los alias son del código, no del modelo.** "mechitas", "tinte", "revisión":
  el emparejamiento del texto libre con el servicio se hace normalizando en
  código, igual que en `buscar_productos`.
- **Sin filas en `staff_hours`, el trabajador no trabaja nunca.** El panel tiene
  que crear a todo trabajador nuevo con un horario ya puesto.
- **Un trabajador no se borra, se desactiva.** La clave ajena de `appointments`
  lo impide, y es intencionado: sus citas pasadas tienen que seguir contando.
- **Las ausencias no se deducen de Google.** Los eventos de todo el día se crean
  a menudo como "libre" y `freeBusy` no los devuelve. Una semana de vacaciones
  que el bot no ve es una semana de citas que nadie va a atender.
- **La restricción anti-solape es una `exclude using gist`**, no una comprobación
  previa: entre comprobar e insertar cabe la otra reserva. Las canceladas quedan
  fuera del índice, así que liberan su hueco.
- **Claves compuestas `(id, client_id)`** en las uniones. Sin ellas, nada impide
  colgar a Ana del servicio de otro negocio.

### El traspaso evita el camino doble

La migración crea un trabajador `Principal` para cada cliente con el módulo
`calendar` activo, copiando su `calendar_id` y su horario.

Se hace así para que **el motor tenga un solo camino**. La alternativa —que sepa
funcionar "con trabajadores" y "sin ellos"— son dos ramas, y una de las dos casi
nunca se prueba.

Regla que hace que el nombre `Principal` no moleste: **con un solo trabajador, el
bot nunca lo nombra.**

## Cómo cambia el motor de huecos

```
entrada: fecha, servicios (opcional), trabajador (opcional)

1. candidatos = staff activos
                ∩ quienes pueden hacer TODOS los servicios pedidos
                ∩ el trabajador pedido, si lo hay
   → vacío: "Ana no hace mechas, pero Bea y Sonia sí"
2. duracion = suma de las duraciones de los servicios (o la del módulo)
3. ocupación = appointments confirmadas de los candidatos
              + freeBusy de sus calendarios (los que tengan)
              + staff_time_off
4. por candidato: su horario − su ocupación − el pasado
5. pidió persona → sus huecos
   no pidió      → unión, guardando quién puede en cada uno
6. al reservar sin persona: el que menos carga tenga ese día,
   desempate por `orden`
7. fila en appointments (la restricción decide) + evento en SU calendario
```

## El cambio de flujo de la conversación

Hoy el bot consulta la disponibilidad **al principio de cada mensaje, a ciegas**,
y le enseña las horas libres a la IA. Con duraciones por servicio eso deja de ser
verdad: le enseñaría un hueco de 30 minutos a quien va a pedir mechas de dos
horas.

El orden pasa a ser el de cualquier sistema de reservas:

**servicio → (persona, o "cualquiera") → fecha y hora → email**

En negocios con servicios definidos, el bot pregunta el servicio **antes** de dar
horas concretas. Y no se le pide al modelo que lo entienda: si falta el servicio,
`Decidir acción` no llega a `reservar`, igual que hoy no llega si falta la fecha.

Como siempre en este repo: **la IA extrae, el código decide.** El nombre "Ana" se
empareja contra la lista real de trabajadores en código; no se confía en que el
modelo devuelva un identificador.

## Contrato de la Agenda API

Se amplía sin romper lo que hay: `servicios` y `trabajador` son opcionales.

```
POST /webhook/agenda
{ "client_id": "...", "accion": "disponibilidad",
  "fecha": "2026-09-15", "servicios": ["corte", "mechas"], "trabajador": "Ana" }
```

La respuesta añade `trabajador` a la reserva y a las alternativas ("el martes a
las 17:00 con Ana"). Cuando no se pide persona, la lista de huecos va **sin
nombres**: con cinco trabajadores, nombrarlos multiplica por cinco un texto que
va dentro del prompt.

## Fases

1. **Esquema** — `0014` + traspaso del trabajador principal. ✅
2. **Panel** — trabajadores, servicios y la matriz, en la pestaña *Agenda* del
   panel de la agencia (`/dashboard/[clientId]/agenda`). ✅
3. **Agenda API** — multi-trabajador, `appointments` como verdad, Google como
   espejo. ✅
4. **Bot** — extracción de servicio y trabajador, emparejamiento en código,
   prompt.
5. **Recordatorios** — cron sobre `appointments`, y la agenda visible en
   `/panel`.

## La pantalla del panel

Pestaña **Agenda** dentro de cada cliente, con dos bloques: trabajadores y
servicios. La matriz de "quién hace qué" no es una tercera pantalla — vive dentro
de cada servicio, como una fila de casillas con los nombres, que es donde se
decide de verdad.

Tres cosas que la pantalla hace a propósito:

- **Un trabajador nuevo nace con el horario del negocio ya puesto**, no en
  blanco. Sin franjas horarias no trabaja nunca, y alguien recién creado al que
  el bot no ofrece jamás es un fallo que desde esta pantalla no se ve.
- **Un servicio que no hace nadie se avisa en rojo.** Es reservable en apariencia
  e imposible en la práctica.
- **Borrar a alguien con citas no se permite**, y el mensaje explica la salida:
  desmarcarlo como activo, que deja de recibir citas y conserva su historial.

Dos franjas por día en el formulario (jornada partida). La tabla admite las que
haga falta, así que ampliarlo no pide migración.

### La matriz completa

Además de las casillas dentro de cada servicio, hay una tabla con **todos los
servicios contra todos los trabajadores**. Montar una clínica marcando de uno en
uno son cuarenta clics; aquí una fila asigna un servicio a todo el mundo y una
columna le da a alguien todos los servicios — que son las dos formas en que esto
se piensa: *"las mechas las hacen Bea y Sonia"* y *"Luis lleva todo lo de
fisioterapia"*.

No guarda al marcar, solo al pulsar el botón: marcar y desmarcar mientras se
decide no puede ir escribiendo en la base. Y al guardar **calcula la diferencia**
en vez de borrarlo todo y reescribirlo — si el borrado saliera bien y el alta
fallara, el cliente se quedaría con todos sus servicios sin nadie que los haga.

### Importar y exportar servicios (CSV)

La lista de servicios de una clínica dental se parece muchísimo a la de la
siguiente, y cuarenta servicios a base de formularios es una tarde perdida. Se
pega o se sube un CSV, se ve **una vista previa de qué va a pasar con cada
línea**, y solo entonces se escribe. También se descarga la lista actual, que es
lo que hace real la reutilización entre clientes.

El parser (`lib/agenda-csv.ts`) está escrito para tragar lo que salga de una hoja
de cálculo sin pedirle a nadie que prepare el fichero "bien":

- **El separador se detecta solo** (`,`, `;` o tabulador). El Excel en español
  exporta con punto y coma: obligar a la coma es garantizar que el primer fichero
  real no se lee.
- **Los alias no hay que entrecomillarlos.** Si una fila trae columnas de sobra,
  son alias: `Mechas,120,mechitas,tinte` funciona igual que la versión con
  comillas.
- **La cabecera es opcional**: si la primera fila ya lleva un número en la
  segunda columna, es un dato y no un título.
- **Si el nombre ya existe se actualiza**, comparando sin tildes ni mayúsculas,
  así que el mismo fichero se puede pasar dos veces sin duplicar nada.
- **Los alias solo se pisan si el fichero trae alguno.** Una columna vacía suele
  ser que no se rellenó, no que se quieran borrar los que había puestos a mano.

Lo que **no** viaja en el fichero es quién hace cada servicio: los trabajadores
son de cada cliente y sus nombres no significan nada en el siguiente. Eso se
reparte después en la matriz, que es cuando ya se sabe quién es quién.

De momento solo está en el panel de la agencia. Cuando se abra al cliente final,
sus escrituras tendrán que pasar por `service_role` con comprobación de permisos:
el `client_user` solo tiene SELECT sobre estas tablas.

## El motor (fase 3)

Tres piezas, y la separación entre ellas es lo que hace que esto se pueda tocar
sin miedo:

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| `agenda_contexto` | migración `0015` | Devuelve en un JSON todo lo que el motor necesita saber |
| `motor-agenda.js` | `n8n/logica/` | Decide: candidatos, huecos, a quién se asigna, qué se contesta |
| `agenda-api.json` | `n8n/workflows/` | El pegamento: HTTP, Google, email |

**El motor no sabe nada de n8n, de Supabase ni de HTTP.** Recibe el contexto ya
cargado y devuelve una decisión, así que se ejecuta con `node` y se comprueba
contra ochenta casos antes de tocar el workflow que está dando citas de verdad.
Se inyecta dentro de los nodos Code con `construir-workflows.js`, porque un nodo
de n8n no puede hacer `require` de un fichero del repositorio.

### Lo que decide, en orden

El orden importa, y tiene dos escalones nuevos delante de los que ya había:

1. **¿Se entiende el servicio?** Si no, no se sigue: la duración depende de él y
   sin duración los huecos son mentira.
2. **¿Hay alguien que lo haga?** Si han pedido a una persona que no lo hace, se
   dice quién sí. *"Ana no hace mechas. Sí lo hacen Bea y Sonia"* — no "no hay
   hueco", que sería falso y la manda a casa creyendo que no hay sitio.
3. **¿Falta fecha u hora?** Contesta la IA pidiendo lo que falte.
4. **¿Está ocupado?** Se dice ya, con alternativas cercanas. No se piden más
   datos: sacarle el email a alguien para una cita imposible es sacárselo para
   nada.
5. **¿Libre y con email?** Se reserva.

### Cuatro decisiones del motor

- **Una fecha fuera de la ventana no está "ocupada".** El motor mira siete días;
  a quien pide dentro de tres semanas se le dice que la agenda no llega tan
  lejos, no que no hay hueco. La versión anterior contestaba "no está
  disponible", que es mentira, y la persona se iba convencida de que no había
  sitio.
- **A quién se le asigna una cita que nadie ha pedido a nombre de alguien:** al
  que menos ocupado esté ese día, y a igualdad, por el `orden` del panel. Dar
  siempre al primero de la lista carga a una persona y deja al resto vacío.
- **Con un solo trabajador, nunca se le nombra.** Por eso el `Principal` que crea
  el traspaso no molesta.
- **Emparejar texto con catálogo tiene tres niveles**, y el orden entre ellos es
  lo importante: exacta, luego el texto contiene al servicio (gana el más
  largo), luego el servicio contiene al texto (gana el más **corto**). Con una
  sola regla de "gana el más largo", *"corte"* se llevaba «Corte y mechas»: dos
  horas de cita, y solo dos personas capaces de hacerla, para quien pedía un
  corte de treinta minutos.

### Cómo se comprueba

```bash
node n8n/logica/motor-agenda.prueba.js   # 62 comprobaciones del motor
node n8n/logica/nodos.prueba.js          # 20 del pegamento con n8n
```

La segunda ejecuta el `jsCode` de los nodos **tal como ha quedado dentro del
JSON generado**, con un `$()` de mentira. Es lo único que puede ver un nombre de
nodo mal escrito o que un nodo no ejecutado reviente la ejecución.
`contexto-ejemplo.json` es la salida real de `agenda_contexto` para una
peluquería de tres personas, así que vale además de contrato: si alguien cambia
la función de Postgres y no el motor, esto falla.

## Lo que esta versión no cubre

- **Recursos compartidos**: dos fisios libres pero una sola camilla, o el box del
  dentista. Se modelaría como un trabajador más (un "recurso" con calendario).
- **Tiempo de limpieza entre citas** (`buffer_min` por servicio).
- **Zona horaria**: sigue fija en `Europe/Madrid`, como hasta ahora.
