# Base de conocimiento — Clínica Fisioterapia Masajes (demo)

Documentos curados para cargar en la pestaña **Conocimiento** del panel
(`/dashboard/<clientId>/conocimiento`).

**Este cliente es simulado.** No existe la clínica, ni la dirección, ni el
equipo. Todo está escrito para enseñar el producto a clínicas de fisioterapia
reales, y los precios están puestos con criterio de mercado para una población
de unos 40.000 habitantes (Comunidad Valenciana, 2026), no copiados de ninguna
clínica concreta. Si un cliente potencial pregunta, es una demo y se dice que lo
es.

Carga de una vez:

```
node scripts/cargar-conocimiento.js docs/conocimiento-fisioterapia-masajes.md "Clinica Fisioterapia Masajes" --aplicar
```

Y después, la batería de preguntas:

```
node scripts/probar-conocimiento.js "Clinica Fisioterapia Masajes" --bateria docs/preguntas-fisioterapia-masajes.txt
```

## Reglas que se han seguido al escribirlos

Las de las otras dos demos —preguntas coloquiales al principio de cada
documento, cada precio en un solo sitio y con su duración, duraciones iguales a
las de `docs/servicios-fisioterapia-masajes.csv`— y tres propias del sector:

- **Nada de diagnóstico ni de ejercicios por chat.** Los documentos dicen qué se
  trata en la clínica, no qué tiene nadie. «¿Esto es una hernia?» y «¿qué
  estiramientos hago?» se contestan con una primera visita.
- **Las señales para ir antes al médico están escritas con todas las letras**
  (documento 14). En fisioterapia el paciente llega sin pasar por el médico, y
  alguien con una pérdida de fuerza en la pierna o un dolor en el pecho que
  «parece muscular» no puede quedarse esperando a un hueco del jueves.
- **Los bonos son la mitad del negocio**, así que sus reglas (caducidad, si se
  comparten, qué pasa si no se avisa) están escritas aparte de los precios.

---

## 1. Quiénes somos — la clínica y qué hacemos

- **Categoría:** La empresa

```
¿Qué clínica sois? ¿Qué tratáis? ¿Sois fisioterapeutas colegiados? ¿Hacéis solo masajes? ¿Tenéis pilates? ¿Hacéis acupuntura o presoterapia?

Clínica Fisioterapia Masajes es una clínica de fisioterapia abierta desde 2014. La dirige Pablo Ferrer, fisioterapeuta. Todo el equipo son fisioterapeutas colegiados.

Tratamos dolor de espalda y de cuello, lesiones deportivas, esguinces y tendinitis, rehabilitación después de una operación o de una fractura, dolor de mandíbula y dolores de cabeza de origen muscular, y problemas de suelo pélvico (pérdidas de orina, embarazo y postparto).

Además de la fisioterapia, hacemos masajes (descontracturante, relajante y deportivo), drenaje linfático, osteopatía, punción seca, ondas de choque, readaptación deportiva y pilates terapéutico.

Tenemos cuatro cabinas individuales y una sala de ejercicio para pilates y readaptación.

No hacemos tratamientos de estética (ni presoterapia estética, ni reductores, ni depilación), ni acupuntura.
```

---

## 2. Dónde estamos, horario y cómo pedir cita

- **Categoría:** La empresa

```
¿Dónde estáis? ¿Qué horario tenéis? ¿Abrís por la tarde? ¿Abrís los sábados? ¿Hasta qué hora abrís? ¿Cómo pido cita?

Estamos en la calle Mayor, 28, bajo, en el centro.

Horario:
- De lunes a viernes: de 9:00 a 14:00 y de 16:00 a 21:00.
- Sábados: de 9:00 a 13:00, solo fisioterapia y fisioterapia deportiva con Pablo.
- Domingos y festivos: cerrado.

Cerramos a mediodía, de 14:00 a 16:00.

La cita se pide por este mismo WhatsApp, a cualquier hora, o en recepción. Trabajamos siempre con cita: cada sesión es individual y en cabina, así que sin cita no podemos asegurar que haya un fisioterapeuta libre.

Cerramos la segunda quincena de agosto y los festivos locales; se avisa con tiempo por aquí.
```

---

## 3. El equipo — quién es quién y qué días está cada uno

- **Categoría:** La empresa

```
¿Quién trabaja en la clínica? ¿Quién hace el suelo pélvico? ¿Quién es el osteópata? ¿Puedo pedir con Nuria? ¿Quién hace la punción seca? ¿Quién está los sábados?

Somos cuatro fisioterapeutas:

- Pablo Ferrer. Director de la clínica. Fisioterapia general y deportiva, punción seca, ondas de choque y readaptación deportiva (volver a correr o a entrenar después de una lesión). Está de lunes a viernes por la mañana, las tardes de lunes y miércoles, y los sábados por la mañana.
- Lucía Martí. Fisioterapeuta especialista en suelo pélvico, embarazo y postparto. También hace el drenaje linfático, masajes relajantes y pilates terapéutico. Está los martes y jueves todo el día y los viernes por la mañana.
- Andrés Soler. Fisioterapeuta y osteópata. Fisioterapia general, osteopatía, punción seca, dolor de mandíbula y dolores de cabeza. Está las tardes de lunes a jueves y los miércoles por la mañana.
- Nuria Gil. Fisioterapia general, masajes y pilates terapéutico. Está de lunes a viernes por la tarde y las mañanas de lunes, martes, jueves y viernes.

Se puede pedir con una persona concreta al reservar, y lo normal es seguir el tratamiento con el mismo fisioterapeuta. El suelo pélvico lo lleva siempre Lucía; la osteopatía, Andrés; y la punción seca, Pablo o Andrés.
```

---

## 4. Primera visita — qué es, qué traer y cómo venir

- **Categoría:** Preguntas frecuentes

```
¿Cómo es la primera sesión? ¿Qué me hacéis el primer día? ¿Qué tengo que llevar? ¿Qué ropa me pongo? ¿La primera visita es gratis?

La primera visita dura una hora e incluye la valoración y el primer tratamiento: no es solo una consulta, ese mismo día ya se trata.

En la valoración, el fisioterapeuta pregunta cómo empezó el dolor, qué lo empeora y qué lo alivia, explora la zona y explica qué cree que pasa, cuántas sesiones calcula y qué puedes hacer tú en casa.

Qué traer:
- Informes médicos y pruebas (radiografías, resonancias, ecografías) si los tienes, en papel o en el móvil.
- Si vienes después de una operación, el informe del cirujano.
- La lista de medicamentos, si tomas alguno.

Cómo venir: con ropa cómoda que deje ver y mover la zona (pantalón corto si es la rodilla o el tobillo, camiseta de tirantes si es el hombro). Si vienes del trabajo, hay vestuario para cambiarte. Toalla no hace falta.

La primera visita no es gratis porque ya incluye tratamiento; el precio está en el apartado de precios.
```

---

## 5. Precios de fisioterapia y bonos

- **Categoría:** Productos

```
¿Cuánto cuesta una sesión de fisio? ¿Qué precio tiene la primera visita? ¿Tenéis bonos? ¿Cuánto vale la punción seca? ¿Cuánto cuestan las ondas de choque? ¿Cuánto dura una sesión?

Fisioterapia:
- Primera visita (valoración + primer tratamiento): 45 € (1 hora).
- Sesión de fisioterapia: 38 € (45 minutos).
- Sesión corta: 28 € (30 minutos). Para revisiones o tratamientos muy localizados.
- Bono de 5 sesiones: 175 € (sale a 35 € la sesión).
- Bono de 10 sesiones: 330 € (sale a 33 € la sesión).

Técnicas:
- Sesión con punción seca: 42 € (45 minutos).
- Ondas de choque: 40 € la sesión (30 minutos); bono de 4 sesiones, 140 €.
- Vendaje neuromuscular (kinesiotape) suelto: 12 € (15 minutos). Dentro de una sesión, 5 € más.

La diatermia (tecarterapia) y la electroterapia se usan dentro de la sesión cuando el fisioterapeuta lo ve útil, sin coste añadido.

Los precios de masajes, osteopatía, suelo pélvico, pilates y readaptación están en sus apartados.
```

---

## 6. Masajes — descontracturante, relajante, deportivo y drenaje linfático

- **Categoría:** Productos

```
¿Cuánto cuesta un masaje? ¿Hacéis masajes relajantes? ¿Qué diferencia hay entre un masaje y una sesión de fisio? ¿Hacéis drenaje linfático? ¿Cuánto vale un masaje deportivo? ¿Tenéis bono de masajes?

- Masaje descontracturante: 38 € (45 minutos). Para contracturas y sobrecargas de espalda, cuello y hombros.
- Masaje relajante: 45 € (1 hora). De cuerpo entero, para desconectar.
- Masaje deportivo o de descarga: 38 € (45 minutos). Antes o después de una competición, o para descargar piernas.
- Drenaje linfático manual: 45 € (1 hora). Para piernas cansadas, retención de líquidos, y después de algunas operaciones cuando lo indica el médico.
- Bono de 5 masajes (descontracturante o deportivo): 175 €.
- Bono de 5 drenajes: 200 €.

Diferencia entre un masaje y una sesión de fisioterapia: el masaje es para una sobrecarga, para descargar o para relajarse, y se puede reservar directamente. Si hay un dolor que no se va, una lesión o algo que limita el movimiento, lo que hace falta es una primera visita de fisioterapia, donde se valora y se trata con las técnicas que hagan falta, no solo con masaje.

Todos los masajes los dan fisioterapeutas.
```

---

## 7. Punción seca — qué es y si duele

- **Categoría:** Preguntas frecuentes

```
¿Qué es la punción seca? ¿Duele la punción? ¿Me podéis hacer punción seca? Me dan miedo las agujas, ¿es obligatoria?

La punción seca es una técnica en la que el fisioterapeuta introduce una aguja muy fina, como las de acupuntura, en el punto del músculo que está contracturado (el «punto gatillo»), para que se suelte. No se inyecta nada: por eso se llama seca. No es acupuntura, y la acupuntura no la hacemos.

Se nota un pinchazo y, cuando la aguja llega al punto, un pequeño espasmo del músculo, que molesta unos segundos. Después puede quedar una sensación de agujetas uno o dos días.

No es obligatoria: si te dan miedo las agujas, se dice y se trata con otras técnicas. Tampoco se hace en todos los casos; la decide el fisioterapeuta después de valorar.

La hacen Pablo y Andrés. Si ya te la han indicado, se reserva como sesión con punción seca.
```

---

## 8. Osteopatía

- **Categoría:** Productos

```
¿Hacéis osteopatía? ¿Cuánto cuesta el osteópata? ¿Qué diferencia hay entre osteopatía y fisioterapia? ¿El osteópata me va a crujir?

- Sesión de osteopatía: 50 € (50 minutos).

La osteopatía trabaja con técnicas manuales sobre las articulaciones, los músculos y los tejidos, buscando el origen del dolor en el conjunto del cuerpo y no solo en la zona que duele. La usamos mucho en dolor de espalda y cuello, dolor de mandíbula y dolores de cabeza de origen muscular.

Las manipulaciones que hacen «crac» son solo una de las técnicas, y no se hacen si no quieres o si no están indicadas.

La osteopatía la hace Andrés Soler, fisioterapeuta y osteópata, las tardes de lunes a jueves y los miércoles por la mañana. La primera sesión incluye la valoración.
```

---

## 9. Suelo pélvico, embarazo y postparto

- **Categoría:** Productos

```
¿Hacéis suelo pélvico? Se me escapa la orina al toser, ¿me podéis ayudar? ¿Cuándo puedo ir después del parto? ¿Tratáis la diástasis abdominal? Estoy embarazada, ¿puedo ir al fisio?

- Valoración de suelo pélvico: 55 € (1 hora).
- Sesión de suelo pélvico: 45 € (45 minutos).
- Bono de 5 sesiones de suelo pélvico: 210 €.

Tratamos pérdidas de orina (al toser, al saltar, al correr), sensación de peso, dolor en las relaciones, la recuperación después del parto y la diástasis abdominal (la separación de los abdominales tras el embarazo).

Las pérdidas de orina son muy frecuentes, sobre todo después de un parto o con la menopausia, pero no son algo con lo que haya que aguantarse: en muchos casos mejoran mucho con tratamiento.

Postparto: la valoración se recomienda a partir de las 6 semanas del parto (o 8 si fue cesárea), cuando ya se ha tenido la revisión con la matrona o el ginecólogo.

Embarazo: se puede venir a fisioterapia durante todo el embarazo, avisando de que estás embarazada al pedir la cita. Hacemos preparación del suelo pélvico para el parto y tratamos los dolores de espalda y pelvis del embarazo.

El suelo pélvico lo lleva siempre Lucía Martí, en una cabina individual. Está los martes y jueves todo el día y los viernes por la mañana.
```

---

## 10. Pilates terapéutico — individual y en grupos reducidos

- **Categoría:** Productos

```
¿Tenéis pilates? ¿Cuánto cuesta el pilates? ¿Qué horarios tienen las clases de pilates? ¿Cuántas personas hay por clase? ¿Puedo hacer pilates si tengo hernia?

Pilates terapéutico, siempre guiado por una fisioterapeuta (Lucía o Nuria):

- Sesión individual: 40 € (50 minutos). Se reserva como una cita más.
- Grupos reducidos de máximo 5 personas, en sala:
  - Una clase a la semana: 55 € al mes.
  - Dos clases a la semana: 95 € al mes.
  - Clase suelta, si hay plaza: 18 €.

Horarios de los grupos: lunes y miércoles a las 19:00 y a las 20:00, y martes y jueves a las 10:00 y a las 19:00.

Para entrar en un grupo, si no se ha venido antes, se hace primero una sesión individual para ver el punto de partida y adaptar los ejercicios.

Las plazas de los grupos son fijas y se gestionan en recepción: para apuntarse o saber si hay hueco en un grupo, escribe por aquí y te lo mira una compañera.

Si hay una lesión o un problema de espalda, el pilates se adapta, pero conviene decirlo antes; en algunos casos se recomienda empezar con fisioterapia.
```

---

## 11. Fisioterapia deportiva y readaptación

- **Categoría:** Productos

```
¿Tratáis lesiones deportivas? ¿Me ayudáis a volver a correr? ¿Qué es la readaptación? Tengo una rotura de fibras. ¿Trabajáis con clubes?

Pablo Ferrer lleva la fisioterapia deportiva: esguinces, roturas de fibras, tendinitis, sobrecargas, lesiones de rodilla y de hombro, y la vuelta al deporte después de una lesión o de una operación.

- Sesión de readaptación deportiva: 45 € (1 hora). Es la fase de ejercicio, en sala, para recuperar fuerza y volver a correr, a saltar o a entrenar con seguridad.

Lo normal es empezar con una primera visita para valorar la lesión, seguir con sesiones de fisioterapia y, cuando ya no duele, pasar a readaptación.

Trabajamos con varios clubes de la zona; si perteneces a uno, pregúntalo en recepción por si hay condiciones especiales.

Los sábados por la mañana está Pablo, pensado sobre todo para deportistas que entre semana no pueden.
```

---

## 12. Problemas que tratamos con más frecuencia

- **Categoría:** Preguntas frecuentes

```
¿Tratáis el dolor de espalda? Tengo ciática, ¿me podéis ayudar? ¿Tratáis las cervicales? Tengo una hernia discal. Me duele la rodilla. ¿Me podéis ayudar con la tortícolis? ¿Hacéis rehabilitación después de una operación?

Lo que más vemos en la clínica:
- Dolor de espalda (lumbalgia), ciática y hernias discales.
- Dolor de cuello, cervicales, tortícolis y dolores de cabeza de origen muscular.
- Hombro doloroso, tendinitis y epicondilitis («codo de tenista»).
- Esguinces de tobillo, dolor de rodilla y lesiones deportivas.
- Rehabilitación después de una fractura o de una operación (prótesis de rodilla o de cadera, ligamento cruzado, hombro).
- Dolor de mandíbula (ATM) y bruxismo.
- Suelo pélvico, embarazo y postparto.

Qué tiene cada persona y cómo tratarlo se decide en la primera visita, después de explorar: dos dolores de espalda que suenan igual por WhatsApp pueden necesitar tratamientos muy distintos.

Si el dolor viene con alguna de las señales del apartado «cuándo ir antes al médico», hay que ir primero al médico.
```

---

## 13. Cuántas sesiones hacen falta y ejercicios en casa

- **Categoría:** Preguntas frecuentes

```
¿Cuántas sesiones voy a necesitar? ¿Cada cuánto tengo que ir? ¿Me dais ejercicios para casa? ¿Cuándo voy a notar mejoría?

Depende mucho de cada caso y se dice en la primera visita. Como orientación:
- Una contractura o una sobrecarga reciente: de 1 a 3 sesiones.
- Un dolor de espalda o de cuello que dura semanas: de 4 a 6 sesiones.
- Una rehabilitación después de una operación: varias semanas, con dos o tres sesiones a la semana al principio.

Al principio las sesiones suelen ser más seguidas (una o dos por semana) y se van espaciando según mejoras. No vendemos bonos «por si acaso»: si en la valoración vemos que con una o dos sesiones basta, se dice.

Sí, se dan ejercicios para casa. El fisioterapeuta te los enseña en la sesión y te los manda por aquí en vídeo o en PDF, adaptados a ti. Hacerlos es la mitad del tratamiento.

Lo normal es notar mejoría en las primeras sesiones. Si no se nota, el fisioterapeuta revisa el plan o, si hace falta, recomienda ir al médico.
```

---

## 14. Cuándo ir antes al médico o a urgencias

- **Categoría:** Preguntas frecuentes

```
¿Tengo que ir al médico antes que al fisio? Me duele la espalda y se me duerme la pierna. Me he caído y me duele mucho. Me duele el pecho, ¿puede ser muscular? Tengo dolor de espalda y fiebre.

Para venir al fisioterapeuta no hace falta pasar antes por el médico. Pero hay situaciones en las que hay que ir primero al médico, o a urgencias:

Ir a URGENCIAS o llamar al 112, sin esperar a la clínica, si:
- Hay dolor en el pecho, sobre todo si se va hacia el brazo, el cuello o la mandíbula, o con falta de aire o sudor frío. Aunque parezca muscular.
- Después de una caída o un golpe fuerte hay mucho dolor, deformidad, no se puede apoyar o mover la zona, o se ha dado un golpe en la cabeza.
- Junto con el dolor de espalda se pierde el control de la orina o de las heces, o se nota dormida la zona de los genitales o del interior de los muslos.
- Se pierde fuerza de repente en una pierna o en un brazo, o se tuerce la boca o cuesta hablar.
- Aparece un dolor de cabeza muy fuerte y repentino, distinto a los habituales.
- Una pantorrilla se hincha, se pone roja y caliente, sobre todo después de una operación o de mucho tiempo inmovilizado.

Ir primero al MÉDICO (sin urgencia, pero antes de venir) si:
- El dolor de espalda va con fiebre, o con pérdida de peso sin motivo.
- El dolor no cambia con ninguna postura y despierta por la noche siempre.
- Hay un hormigueo o una debilidad en la pierna o el brazo que va a más.

Si no estás seguro, pregunta por aquí y un fisioterapeuta te lo mira.
```

---

## 15. Receta, informes y fisioterapia después de una operación

- **Categoría:** Preguntas frecuentes

```
¿Necesito receta del médico para ir al fisio? ¿Me tiene que mandar el traumatólogo? Me acaban de operar, ¿cuándo puedo empezar? ¿Me hacéis un informe?

No hace falta receta ni volante del médico para venir a fisioterapia en una clínica privada: puedes pedir cita directamente.

Después de una operación, se empieza cuando lo indica el cirujano o el traumatólogo; cada operación tiene sus tiempos. Trae el informe de la operación y las indicaciones que te hayan dado, y el fisioterapeuta ajusta el tratamiento a ellas.

Si tu médico te pide un informe de cómo va la fisioterapia, se hace sin coste para los pacientes en tratamiento.

Si hace falta una prueba (una resonancia, una ecografía), el fisioterapeuta te lo dice y te explica a qué médico pedírsela; nosotros no las pedimos.
```

---

## 16. Accidentes de tráfico, seguros y mutuas

- **Categoría:** Pagos

```
He tenido un accidente de coche, ¿me cubre el seguro la fisio? ¿Trabajáis con aseguradoras? ¿Aceptáis mi seguro médico? He tenido un accidente en el trabajo.

Accidentes de tráfico: estamos adheridos al convenio de las aseguradoras para accidentes de tráfico, así que si has tenido un accidente la fisioterapia no te cuesta nada: la paga el seguro del vehículo. Hay que traer el informe de urgencias (del primer médico que te vio después del accidente) y los datos del seguro y del parte; nosotros hacemos la gestión con la aseguradora. Cuanto antes se empiece, mejor.

Seguros médicos privados: no estamos concertados con ninguna aseguradora de salud. Si tu seguro es de reembolso, te damos la factura detallada para reclamarlo.

Accidentes de trabajo: los atiende la mutua de tu empresa en sus propios centros. Si prefieres venir aquí por tu cuenta, se puede, pero no lo paga la mutua.

Qué cubre tu póliza concreta lo sabe tu aseguradora; nosotros no podemos consultarlo.
```

---

## 17. Formas de pago y cómo funcionan los bonos

- **Categoría:** Pagos

```
¿Se puede pagar con tarjeta? ¿Aceptáis Bizum? ¿Los bonos caducan? ¿Puedo compartir el bono con mi pareja? ¿Hay que pagar por adelantado?

Formas de pago: efectivo, tarjeta y Bizum.

Las sesiones sueltas se pagan al terminar. Los bonos se pagan al comprarlos, en la clínica.

Cómo funcionan los bonos:
- Caducan a los 6 meses de comprarlos.
- Se pueden compartir con alguien de la familia que viva contigo.
- No se devuelve el dinero de las sesiones que no se usen, salvo por un motivo médico justificado.
- Las sesiones no avisadas con tiempo se descuentan del bono (ver el apartado de cancelaciones).

Tarjeta regalo: se puede regalar una sesión, un masaje o un bono, por el importe que se quiera. Vale un año.

Se da factura siempre.
```

---

## 18. Cancelar, cambiar la cita y llegar tarde

- **Categoría:** Preguntas frecuentes

```
¿Puedo anular la cita? ¿Cómo cambio la hora? ¿Qué pasa si no aviso? ¿Y si llego tarde? ¿Cobráis por cancelar?

Cambiar o anular una cita no cuesta nada si se avisa con al menos 24 horas.

Si no se avisa con 24 horas o no se viene, la sesión se cobra, o se descuenta del bono si se tiene uno. No es por el dinero: es una hora de cabina con un fisioterapeuta reservada solo para ti que ya no puede aprovechar otro paciente. Si ha sido por una causa de fuerza mayor, se habla.

Si llegas tarde, la sesión termina a su hora para no retrasar al siguiente paciente, así que será más corta.

Los cambios y las anulaciones los gestiona recepción: escribe por aquí y te lo cambian.
```

---

## 19. Fisioterapia a domicilio

- **Categoría:** Productos

```
¿Venís a casa? ¿Hacéis fisioterapia a domicilio? Mi madre no puede salir de casa. ¿Cuánto cuesta a domicilio?

Sí, para personas que no pueden desplazarse: mayores, recién operados o con movilidad reducida.

- Sesión de fisioterapia a domicilio: 55 € (1 hora), dentro del pueblo y hasta 10 km.

Las sesiones a domicilio se organizan con recepción, no por la agenda de citas, porque hay que cuadrar la dirección y los desplazamientos del fisioterapeuta. Escribe por aquí y te lo organiza una compañera.
```

---

## 20. Aparcamiento, accesibilidad, vestuario e idiomas

- **Categoría:** Preguntas frecuentes

```
¿Dónde aparco? ¿Hay parking? ¿Se puede entrar en silla de ruedas? ¿Tenéis vestuario? ¿Hay ducha? ¿Habláis valenciano? ¿Habláis inglés?

La clínica está en un bajo, sin escalones, y es accesible en silla de ruedas. Las camillas son eléctricas y bajan a la altura que haga falta.

Para aparcar hay un aparcamiento público a tres minutos andando y zona azul en la misma calle.

Hay vestuario para cambiarse y taquillas. No tenemos ducha.

Atendemos en castellano y en valenciano, y Pablo y Lucía también en inglés.
```

---

# Pendiente de confirmar

Nada de lo de arriba es real: **todo el documento es material de demostración.**
Lo que habría que preguntarle a una clínica de verdad antes de reutilizarlo:

- **Los precios, los bonos y sus reglas** (caducidad, si se comparten, qué pasa
  con las sesiones no avisadas). Es lo que más cambia entre clínicas.
- **Las duraciones reales**, que dan los huecos de la agenda: hay clínicas de
  sesiones de 30 minutos y otras de una hora.
- **Quién hace qué y qué días**, sobre todo suelo pélvico y osteopatía.
- **Si está adherida al convenio de accidentes de tráfico** y con qué
  aseguradoras trabaja. El documento 16 cambia entero según eso.
- **Los horarios y las plazas de los grupos de pilates**, que la agenda de citas
  no gestiona: son plazas fijas en sala, no citas individuales.
- **El documento 14 (cuándo ir al médico)** lo tiene que revisar un
  fisioterapeuta de la clínica antes de que lo diga el bot. Son las señales de
  alarma habituales, pero cada clínica debe firmar las suyas.
