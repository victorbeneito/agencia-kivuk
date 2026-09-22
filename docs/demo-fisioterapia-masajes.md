# Clínica Fisioterapia Masajes — cliente de demostración

Cliente **simulado** para enseñar el producto a clínicas de fisioterapia reales.
Es la tercera demo sectorial, después de `docs/demo-peluqueria-mechas.md` y
`docs/demo-clinica-dental-muelas.md`: mismo producto, mismos scripts. No hay
negocio detrás: ni la clínica, ni la dirección, ni Pablo, Lucía, Andrés y Nuria.

| Pieza | Archivo | Dónde acaba |
| --- | --- | --- |
| Prompt del bot | `docs/prompt-fisioterapia-masajes.md` | `agent_configs.system_prompt` |
| Base de conocimiento (20 documentos) | `docs/conocimiento-fisioterapia-masajes.md` | `knowledge_documents` + sus embeddings |
| Servicios reservables (15) | `docs/servicios-fisioterapia-masajes.csv` | `booking_services` |
| Equipo, horarios y quién hace qué | `scripts/montar-demo-fisio.js` | `staff`, `staff_hours`, `booking_service_staff` |
| Batería de 77 preguntas | `docs/preguntas-fisioterapia-masajes.txt` | — |

---

## 0. Montado el 22/09/2026

Ya está creado: **`Clinica Fisioterapia Masajes`**, id `0861b19d-f8ed-4f03-9ce8-b582a353bed2`,
con el prompt y los 20 documentos cargados.

```bash
node scripts/montar-demo-fisio.js --aplicar
node scripts/cargar-prompt.js docs/prompt-fisioterapia-masajes.md "Clinica Fisioterapia Masajes" --aplicar
node scripts/cargar-conocimiento.js docs/conocimiento-fisioterapia-masajes.md "Clinica Fisioterapia Masajes" --aplicar
node scripts/probar-conocimiento.js "Clinica Fisioterapia Masajes" --bateria docs/preguntas-fisioterapia-masajes.txt
```

Idempotente, como las otras dos: sirve también para devolverla a su estado de
fábrica. **Número: +34 623 81 47 87** (`wa.me/34623814787`), eSIM propia con
nombre visible `Kivuk Demo Fisio`, activo desde el 22/09/2026 (ver «El número de
WhatsApp» en la demo de la clínica dental).

## 1. El horario y el equipo

Abre de lunes a viernes de 9:00 a 14:00 y de 16:00 a 21:00 —la tarde hasta las
nueve, que es la franja que más se pide después del trabajo— y el sábado de 9:00
a 13:00 solo con Pablo. Citas de 45 minutos por defecto, cada 15.

| | Lunes | Martes | Miércoles | Jueves | Viernes | Sábado |
| --- | --- | --- | --- | --- | --- | --- |
| **Pablo** (director, deportiva, punción) | 9-14, 16-21 | 9-14 | 9-14, 16-21 | 9-14 | 9-14 | 9-13 |
| **Lucía** (suelo pélvico, drenaje, pilates) | | 9-14, 16-21 | | 9-14, 16-21 | 9-14 | |
| **Andrés** (osteopatía, punción) | 16-21 | 16-21 | 9-14, 16-21 | 16-21 | | |
| **Nuria** (general, masajes, pilates) | 9-14, 16-21 | 9-14, 16-21 | 16-21 | 9-14, 16-21 | 9-14, 16-21 | |

Dos generalistas que cubren la semana y dos especialistas con días propios. Las
frases que salen de aquí: *«el suelo pélvico lo lleva Lucía, que está martes y
jueves»*, *«el osteópata viene por las tardes»* y *«el sábado por la mañana está
Pablo»*.

`Lucía` y `Andrés` llevan tilde en el panel; el motor la quita al comparar, así
que «con lucia» los encuentra igual.

## 2. Quién hace qué

| Servicio | Pablo | Lucía | Andrés | Nuria |
| --- | :---: | :---: | :---: | :---: |
| Primera visita, sesión, sesión corta, masaje descontracturante | ✅ | | ✅ | ✅ |
| Punción seca | ✅ | | ✅ | |
| Masaje deportivo | ✅ | | | ✅ |
| Masaje relajante, pilates individual | | ✅ | | ✅ |
| Drenaje linfático, suelo pélvico (valoración y sesión) | | ✅ | | |
| Osteopatía | | | ✅ | |
| Ondas de choque, readaptación deportiva | ✅ | | | |
| Vendaje neuromuscular | ✅ | ✅ | ✅ | ✅ |

## 3. Los servicios y sus alias

La trampa de esta demo es su nombre: **«Fisioterapia» y «Masajes» están en el
nombre del negocio**, y el motor busca el servicio dentro de la frase entera.
Un alias «masaje» o «fisio» casaría con cualquier «hola, Clínica Fisioterapia
Masajes». Por eso los alias son frases: «un masaje», «masaje relajante»,
«sesión de fisio».

Los síntomas («dolor de espalda», «ciática», «cervicales», «esguince») apuntan a
la **primera visita** (60 min), no a la sesión (45): quien escribe por un dolor
suele ser nuevo, y un hueco de 60 también sirve a quien ya está en tratamiento.

El emparejamiento es por frase literal, así que «me duele *mucho* la espalda»
no casa con «me duele la espalda». No pasa nada: la IA extrae el servicio de
todas formas y la reserva se comprueba con la duración buena. Solo afecta a los
primeros huecos que se enseñan, que salen de 45 minutos en vez de 60.

## 4. Comprobado contra el motor

Con el motor real (`n8n/logica/motor-agenda.js`) y este montaje, situándose en
el lunes 28/09/2026 a las 8:00:

| Consulta | Lo que devuelve |
| --- | --- |
| Suelo pélvico | solo martes, jueves y viernes por la mañana |
| Osteopatía | tardes de lunes a jueves y el miércoles por la mañana |
| Sesión el sábado a las 10:00 | libre, con Pablo |
| Sesión el sábado con Nuria | ocupado, con alternativas entre semana |
| Suelo pélvico con Nuria | *«Nuria no hace suelo pélvico - valoración. Sí lo hace Lucía.»* |
| Punción seca con Lucía | *«Lucía no hace punción seca. Sí lo hace Pablo y Andrés.»* |
| Primera visita el viernes a las 20:15 | ocupado (acabaría a las 21:15); ofrece las 20:00 |

Y las frases: «quiero un masaje» → descontracturante; «quiero un masaje
relajante» → relajante; «se me escapa el pis desde el parto» → valoración de
suelo pélvico; «quiero volver a correr» → readaptación; «hola clínica
fisioterapia masajes» y «estoy muy nervioso con la lesión» → nada, que es lo
correcto.

La batería de 77 preguntas contra la búsqueda real: de las 69 que tienen
respuesta, el documento correcto sale **el primero en 64** y entre los cinco que
recibe el bot en todas. Las cinco que aciertan en segundo lugar son preguntas de
precio cuyo tema tiene documento propio («¿cuánto vale la punción seca?» trae
antes el de qué es la punción que el de precios).

Como en la clínica dental, **falta probar la conversación de punta a punta**
con el bot de n8n, cuando llegue su número.

---

## Guion de la demo, en cuatro minutos

1. **«hola cuanto cuesta una sesion?»** → 38 €, 45 minutos, y los bonos de 5 y
   10. *Sabe de lo mío, y me vende el bono.*
2. **«tengo ciatica desde hace un mes, teneis hueco?»** → «qué rabia», y le
   ofrece una **primera visita**, no una sesión. *No reserva a ciegas: lleva a
   la valoración, que es de donde sale el bono.*
3. **«el jueves por la tarde»** → huecos reales; **«a las 7»** → cita
   confirmada, con el recordatorio de traer ropa cómoda y los informes. Se
   enseña la cita en el panel y el recordatorio del día antes: en una clínica
   que vive de sesiones de 45 minutos, cada hueco sin avisar es dinero.
4. **«y los ejercicios para la ciatica cuales son?»** → no pauta ejercicios, se
   los da el fisio en la sesión. *No regala lo que cobro, ni se arriesga a
   empeorar a nadie.*
5. **«me duele la espalda y se me duerme la zona de las ingles»** → urgencias,
   lo primero y sin rodeos. **Es el mensaje más importante de la demo**: el
   fisioterapeuta es de acceso directo y sabe que le llegan cosas que deberían
   haber pasado por el médico.
6. **«quiero hablar con alguien»** → suena el móvil y contesta él desde la PWA.

De propina: **«quiero un masaje relajante el sábado»** → el sábado solo está
Pablo y los relajantes los hacen Lucía y Nuria; **«quiero apuntarme a pilates
en grupo»** → lo pasa a recepción.

Lo que van a preguntar:

- **Pilates en grupo.** La agenda da citas individuales; los grupos con plazas
  fijas no los gestiona, y el bot los pasa a recepción. Si la clínica vive del
  pilates, es una pieza por construir, y hay que decirlo.
- **Bonos.** El bot explica los bonos pero **no lleva la cuenta** de las
  sesiones que le quedan a cada paciente. Es la siguiente pregunta que hará
  cualquier fisio.
- **Protección de datos**, igual que en la clínica dental: el bot no pide datos
  de salud ni los repite, pero un paciente puede escribirlos.
- **Software de gestión** (Fisiocloud, Clinic Cloud y similares): no se
  conecta; la agenda es la del panel.
