# Base de conocimiento — Peluquería Mechas (demo)

Documentos curados para cargar en la pestaña **Conocimiento** del panel
(`/dashboard/<clientId>/conocimiento`).

**Este cliente es simulado.** No existe la peluquería, ni la dirección, ni el
equipo. Todo está escrito para enseñar el producto a peluquerías reales, y los
precios están puestos con criterio de mercado para una población de unos 40.000
habitantes (Comunidad Valenciana, 2026), no copiados de ningún salón concreto.
Si un cliente potencial pregunta, es una demo y se dice que lo es.

Carga de una vez:

```
node scripts/cargar-conocimiento.js docs/conocimiento-peluqueria-mechas.md "Peluqueria Mechas" --aplicar
```

Y después, la batería de preguntas:

```
node scripts/probar-conocimiento.js "Peluqueria Mechas" --bateria docs/preguntas-peluqueria-mechas.txt
```

## Reglas que se han seguido al escribirlos

- **Cada documento empieza por dos o tres formas coloquiales de preguntar lo que
  resuelve.** Es la lección de Cestería: un embedding no busca el documento que
  *contiene* la respuesta, busca el que *se parece* a la pregunta. «cuanto vale
  cortarme el pelo» no se parece a un párrafo que empieza «Tarifa de corte».
- **Cada precio está en un solo documento.** Si «Corte 22 €» aparece en dos, uno
  de los dos se quedará viejo.
- **La duración va pegada al precio**, en el mismo documento. El bot necesita las
  dos cosas en la misma frase: "las mechas son 55 € y unas dos horas y media".
  Esas duraciones tienen que coincidir con las de
  `docs/servicios-peluqueria-mechas.csv`, que es lo que se importa en la agenda.
- **Nada de lo que el salón decide sobre la marcha** (si te puede coger hoy, si
  tu pelo aguanta una decoloración) está escrito como un dato. Eso se escala.

---

## 1. Quiénes somos — el salón y a qué nos dedicamos

- **Categoría:** La empresa

```
¿Qué peluquería sois? ¿Qué hacéis? ¿Cuánto lleváis abiertos? ¿Sois una peluquería de señoras o unisex?

Peluquería Mechas es un salón de barrio con más de quince años abierto. Es unisex: atendemos a mujeres, hombres y niños, aunque la mayor parte de lo que hacemos es corte, color y mechas.

Somos tres personas en el salón: Ana, Sonia y Luisa. Ana lleva el salón.

Trabajamos con productos profesionales y damos importancia a cuidar el pelo: si un color o una decoloración no le va a sentar bien a un pelo, lo decimos antes de hacerlo, aunque suponga no hacer el servicio ese día.

Lo que sí y lo que no hacemos: hacemos corte, peinado, color, mechas, decoloración, tratamientos, alisado de keratina, permanente, recogidos y novias. No hacemos estética (ni uñas, ni depilación, ni cejas ni pestañas) ni extensiones.
```

---

## 2. Dónde estamos, horario y cómo pedir cita

- **Categoría:** La empresa

```
¿Dónde estáis? ¿Qué horario tenéis? ¿Abrís los lunes? ¿Cerráis a mediodía? ¿Puedo ir sin cita?

Estamos en la calle Sant Roc, 12, en el centro del pueblo, a pie de calle.

El horario es de martes a sábado:
- De martes a viernes: de 10:00 a 14:00 y de 16:00 a 20:00.
- Sábados: de 10:00 a 14:00. Las tardes de los sábados no abrimos.
- Lunes y domingos: cerrado.

Cerramos a mediodía, de 14:00 a 16:00, así que no se dan citas en esa franja.

Las citas se piden por este WhatsApp o pasando por el salón. Trabajamos con cita, así que sin ella no podemos asegurar que haya hueco; si alguien se pasa y hay un rato libre, se le atiende, pero lo normal es que haya que esperar o volver otro día.

Cerramos una semana en agosto y los días festivos del pueblo. Cuando toca, se avisa por aquí y en la puerta del salón.
```

---

## 3. Quién es quién — Ana, Sonia y Luisa

- **Categoría:** La empresa

```
¿Quién trabaja ahí? ¿Con quién me puedo poner? ¿Quién hace las mechas? ¿Puedo pedir a alguien en concreto?

En el salón somos tres:

- Ana. Lleva el salón y hace de todo: corte, color, mechas, decoloración, tratamientos y peinados. Es la que se encarga de las novias y de los recogidos elaborados.
- Sonia. Se dedica sobre todo a la parte técnica: color, mechas, balayage, alisados de keratina y tratamientos. También corta.
- Luisa. Lleva los cortes (mujer, caballero y niños), los lavados y peinados, el arreglo de barba y los tratamientos de hidratación. El color y las mechas todavía no los hace ella.

Se puede pedir a una persona concreta al reservar y se apunta en la cita. Quien lleva la barba es Luisa, y las novias las lleva Ana.
```

---

## 4. Precios de corte, lavado y peinado

- **Categoría:** Productos

```
¿Cuánto vale cortarse el pelo? ¿Qué precio tiene el corte de señora? ¿Cuánto cuesta lavar y peinar? ¿Cuánto cobráis por marcar? ¿Cuánto se tarda en cortar el pelo?

Corte y peinado (mujer):
- Lavar y peinar con secador: 14 € (30 minutos).
- Lavar y peinar con plancha o tenacillas: 18 € (45 minutos).
- Corte, con lavado y peinado incluidos: 22 € (45 minutos).
- Solo corte, sin lavar ni peinar: 16 € (30 minutos).
- Repaso de flequillo o de puntas entre visitas: 6 € (15 minutos).

En melenas muy largas o con mucha densidad, el secado lleva más tiempo y se suman 5 € al peinado.

El precio del corte incluye siempre el lavado con masaje y el peinado, salvo que se pida solo el corte.
```

---

## 5. Precios de caballero y de niños

- **Categoría:** Productos

```
¿Cuánto vale un corte de hombre? ¿Cortáis a niños? ¿Hacéis barba? ¿Cuánto cobráis por arreglar la barba?

Caballero:
- Corte de caballero: 13 € (30 minutos).
- Corte de caballero con arreglo de barba: 20 € (45 minutos).
- Arreglo y perfilado de barba solo: 9 € (20 minutos).
- Rapado a máquina: 10 € (20 minutos).
- Cubrir canas en caballero: 25 € (45 minutos).

Niños hasta 10 años:
- Corte de niño: 11 € (30 minutos).
- Corte de niña: 13 € (30 minutos).

A partir de los 11 años se cobra la tarifa de adulto. Con los niños pequeños nos tomamos el tiempo que haga falta, y si un día no hay manera, no pasa nada: se vuelve otro día y no se cobra.
```

---

## 6. Precios de color: tinte, raíz, matiz y baño de color

- **Categoría:** Productos

```
¿Cuánto cuesta un tinte? ¿Qué vale teñirse? ¿Cuánto cobráis por cubrir las canas? ¿Qué precio tiene la raíz? ¿Cuánto se tarda en teñir el pelo?

Color:
- Retoque de raíz, con lavado y peinado: 38 € (1 hora y media).
- Color completo en media melena: 48 € (1 hora y 45 minutos).
- Color completo en melena larga: 58 € (2 horas).
- Matiz o toner suelto: 18 € (45 minutos).
- Baño de color o color semipermanente sin amoniaco: 32 € (1 hora).

El retoque de raíz es lo que se hace cada cuatro o cinco semanas cuando ya se lleva el color puesto: se cubre solo lo que ha crecido. El color completo es cuando se da color a todo el pelo, por ejemplo al cambiar de tono o la primera vez.

Todos los precios de color incluyen el lavado y el peinado al terminar.

Si se viene con un color hecho en casa, con henna o con un tinte de otro salón, hay que decirlo antes: el resultado depende de lo que haya puesto en el pelo y a veces hace falta valorarlo en persona.
```

---

## 7. Precios de mechas, balayage y decoloración

- **Categoría:** Productos

```
¿Cuánto valen unas mechas? ¿Qué precio tienen las mechitas? ¿Cuánto cuesta un balayage? ¿Cuánto se tarda en hacer mechas? ¿Hacéis californianas?

Mechas y decoloración:
- Mechas de medio casco, con papel, matiz y peinado incluidos: 55 € (2 horas y media).
- Mechas de casco completo: 70 € (3 horas).
- Balayage o babylights: desde 85 € (3 horas).
- Decoloración global: desde 95 €, siempre con valoración previa (de 3 a 4 horas).

En melenas por debajo del pecho o con mucha densidad se suman 10 €, porque lleva más producto y más tiempo.

El precio de las mechas ya lleva dentro el matiz y el peinado; no se cobran aparte. Si entre unas mechas y las siguientes se quiere refrescar solo el matiz, es el precio del matiz suelto.

El balayage y la decoloración ponen "desde" porque el precio depende del largo, de la densidad y sobre todo de lo que haya puesto en el pelo antes. Se ve en el salón, sin compromiso, y se dice el precio antes de empezar.
```

---

## 8. Precios de tratamientos: keratina, botox capilar, hidratación y anticaída

- **Categoría:** Productos

```
¿Cuánto vale un alisado de keratina? ¿Hacéis tratamientos para el pelo? ¿Qué precio tiene el botox capilar? ¿Tenéis algo para la caída del pelo? ¿Cuánto dura la keratina?

Tratamientos:
- Hidratación exprés, añadida a otro servicio: 12 € (15 minutos más).
- Hidratación profunda con vapor: 28 € (45 minutos).
- Reconstrucción tipo Olaplex añadida a un color o unas mechas: 15 €.
- Botox capilar: 45 € (1 hora y cuarto).
- Alisado de keratina: 95 € en pelo corto o media melena, 140 € en melena larga (2 horas y media).
- Sesión de tratamiento anticaída: 25 €; el bono de 6 sesiones, 130 € (30 minutos por sesión).

El alisado de keratina no deja el pelo liso para siempre: quita el encrespado y hace el peinado mucho más fácil, y dura entre tres y cuatro meses según el pelo y el champú que se use en casa.

El tratamiento anticaída ayuda cuando la caída es estacional o por estrés, pero no sustituye a un dermatólogo. Si la caída es fuerte o va a más, lo suyo es que lo vea un médico.
```

---

## 9. Precios de permanente y ondas

- **Categoría:** Productos

```
¿Hacéis permanente? ¿Cuánto vale rizar el pelo? ¿Qué precio tiene la permanente de ondas?

- Permanente clásica: 55 € (2 horas).
- Permanente de ondas suaves: 60 € (2 horas).

Las dos incluyen el lavado y el peinado al terminar.

No se puede hacer una permanente sobre un pelo recién decolorado ni sobre un pelo muy castigado: se valora antes en el salón y, si no está en condiciones, se recomienda tratarlo primero.
```

---

## 10. Novias, recogidos y peinados de fiesta

- **Categoría:** Productos

```
¿Peináis novias? ¿Cuánto cobráis por un recogido? ¿Hacéis peinados para bodas? ¿Vais a domicilio? ¿Puedo ir con las invitadas?

- Peinado de fiesta con ondas: 28 € (45 minutos).
- Recogido sencillo: 32 € (45 minutos).
- Recogido elaborado: 42 € (1 hora).
- Novia: 95 €, con la prueba previa incluida (la prueba es otro día, y dura 1 hora; el peinado del día de la boda, hora y media).
- A domicilio o fuera del horario del salón: 30 € más.

Las novias las lleva Ana, y hay que reservar con tiempo: en temporada de bodas las fechas se llenan con meses de antelación.

Para grupos de invitadas abrimos antes de la hora si hace falta. Eso se organiza hablando con el salón, no por aquí, porque hay que cuadrar a quién peina cada una y a qué hora tenéis la ceremonia.
```

---

## 11. Bonos, tarjetas regalo y descuentos

- **Categoría:** Pagos

```
¿Tenéis bonos? ¿Puedo regalar una sesión? ¿Hacéis descuentos? ¿Tenéis ofertas? ¿Hay descuento para jubilados?

- Bono de 5 lavar y peinar: 60 €. Sale uno gratis y no caduca.
- Tarjeta regalo: desde 20 €, para el importe que se quiera. Vale un año desde que se compra y se puede gastar en cualquier servicio o en producto.
- Miércoles por la mañana: 10 % de descuento en corte para mayores de 65 años.
- Si traes a una amiga que no ha venido nunca, 5 € de descuento para cada una en ese servicio.

Los descuentos no se acumulan entre sí ni con los bonos.
```

---

## 12. Formas de pago

- **Categoría:** Pagos

```
¿Se puede pagar con tarjeta? ¿Aceptáis Bizum? ¿Hay que pagar por adelantado? ¿Se paga antes o después?

Se puede pagar en efectivo, con tarjeta (Visa y Mastercard) o por Bizum.

Se paga al terminar, en el salón. No se cobra nada por adelantado ni por reservar la cita, con una excepción: las novias dejan una señal de 30 € al hacer la prueba, y se descuenta del total del día de la boda.

Se da tique siempre. Si hace falta factura con datos fiscales, se pide en el salón y se hace sin problema.
```

---

## 13. Cancelar, cambiar la cita y llegar tarde

- **Categoría:** Preguntas frecuentes

```
¿Puedo anular la cita? ¿Qué pasa si no puedo ir? ¿Y si llego tarde? ¿Cobráis por cancelar? ¿Puedo cambiar la hora?

Cancelar o cambiar una cita no cuesta nada. Solo pedimos avisar con al menos 24 horas: ese hueco casi siempre lo quiere otra persona, y con tiempo se puede dar.

Si se llega tarde, se hace lo que dé tiempo hasta la hora de la siguiente cita. Con más de 15 minutos de retraso puede que haya que dejar el servicio en otra cosa (por ejemplo, cortar sin peinar) o cambiar la cita de día, porque detrás hay más gente esperando.

Cuando alguien falta dos veces seguidas sin avisar, para la siguiente cita se pide una señal. No es una multa: es que un hueco de tres horas de mechas vacío no se recupera.

Los cambios y las anulaciones se hacen hablando con el salón; no se pueden hacer solas por chat.
```

---

## 14. Cómo va una cita — qué pasa al llegar

- **Categoría:** Preguntas frecuentes

```
¿Tengo que venir con el pelo lavado? ¿Voy con el pelo sucio o limpio? ¿Cuánto voy a estar? ¿Puedo llevar una foto de lo que quiero?

No hace falta venir con el pelo lavado: aquí se lava siempre antes de cortar o de peinar. Para un color o unas mechas es incluso mejor no habérselo lavado ese mismo día, porque el cuero cabelludo lo lleva mejor.

Sí conviene venir con el pelo suelto y seco, sin coleta ni moño apretado, y sin laca ni productos de fijación puestos.

Traer una foto de lo que se busca ayuda mucho, sobre todo con el color. También ayuda decir qué se ha hecho antes en el pelo: tintes de casa, henna, decoloraciones, alisados.

El tiempo que se indica en cada servicio es orientativo, y en color o mechas puede alargarse un poco según cómo vaya cogiendo el pelo.
```

---

## 15. Alergias, cuero cabelludo sensible y embarazo

- **Categoría:** Preguntas frecuentes

```
¿Hacéis prueba de alergia? ¿Me puedo teñir si estoy embarazada? ¿Y si tengo el cuero cabelludo irritado? Soy alérgica al tinte, ¿qué hacéis?

La primera vez que teñimos a alguien, o si alguna vez ha tenido reacción a un tinte, hacemos una prueba de sensibilidad 48 horas antes del color. Es un momento y se hace en el salón.

Si el cuero cabelludo está irritado, con heridas o con costras, no se aplica color ni decoloración ese día: primero tiene que estar bien.

En el embarazo se puede teñir el pelo, y en general se recomienda esperar al segundo trimestre y usar productos sin amoniaco. Ahora bien, esto es lo que hacemos en el salón, no un consejo médico: lo mejor es comentarlo con el médico o la matrona.

Si hay una alergia diagnosticada a algún componente del tinte, hay que decirlo antes de reservar para ver qué se puede hacer.
```

---

## 16. Cada cuánto volver y cómo mantener el pelo en casa

- **Categoría:** Preguntas frecuentes

```
¿Cada cuánto tengo que retocarme la raíz? ¿Cada cuánto se cortan las puntas? ¿Cuánto duran las mechas? ¿Qué champú uso?

Orientativamente:
- Raíz de color: cada 4 o 5 semanas, según lo rápido que crezca el pelo y el contraste con las canas.
- Mechas: cada 3 o 4 meses, con un matiz de mantenimiento a las 6 u 8 semanas para que no se pongan amarillas.
- Corte: cada 8 o 10 semanas si se lleva un corte definido; en melenas largas, cada 3 meses para quitar puntas.
- Alisado de keratina: dura de 3 a 4 meses.

En casa, lo que más se nota: champú sin sulfatos si se lleva color o mechas, mascarilla una vez por semana, protector de calor antes de la plancha o el secador, y no abusar de la plancha a temperatura alta.

El agua muy caliente y el sol del verano son lo que más apaga un color.
```

---

## 17. Productos que vendemos en el salón

- **Categoría:** Productos

```
¿Vendéis champú? ¿Puedo comprar productos ahí? ¿Vendéis por internet? ¿Qué marcas usáis?

En el salón se venden los mismos productos profesionales que usamos: champús, acondicionadores, mascarillas, protectores de calor y matizadores para rubios. Los champús y mascarillas van desde 14 €.

No vendemos por internet ni hacemos envíos: los productos se compran en el salón.

Si alguien quiere saber qué producto le conviene, lo suyo es preguntarlo en la cita, viendo el pelo: el champú que le va bien a un pelo con mechas no es el mismo que el de un pelo con permanente.
```

---

## 18. Aparcamiento, accesibilidad y venir con niños

- **Categoría:** Preguntas frecuentes

```
¿Dónde aparco? ¿Hay parking cerca? ¿Se puede entrar con carrito? ¿Hay escalones? ¿Puedo ir con mi hijo?

El salón está a pie de calle, sin escalones, y entra un carrito o una silla de ruedas por la puerta.

Para aparcar hay zona azul en la plaza, a un minuto, y un aparcamiento gratuito a unos tres minutos andando.

Se puede venir con niños. Hay una silla elevadora para cortarles el pelo y no pasa nada si vienen mientras se atiende a otra persona.

Hay wifi gratis en el salón, que para una cita de mechas de tres horas se agradece.
```

---

# Pendiente de confirmar

Nada de lo de arriba es real: **todo el documento es material de demostración.**
Esta sección existe para dejar claro qué habría que preguntarle a una peluquería
de verdad antes de reutilizar estos documentos con ella, porque son justo los
datos que cambian de un salón a otro y que no se pueden suponer:

- **Los precios.** Los de aquí son de mercado para una población de unos 40.000
  habitantes, pero cada salón tiene los suyos y la diferencia entre pueblos es
  grande. Nunca se carga una tarifa que el cliente no haya confirmado.
- **Las duraciones reales de cada servicio.** Determinan los huecos que ofrece la
  agenda: si en su salón unas mechas son tres horas y aquí pone dos y media,
  cada día de agenda sale mal por media hora.
- **Quién hace qué.** La matriz de servicios por trabajador es lo primero que
  hay que rellenar con ellos delante.
- **Los días de cierre**, las vacaciones y los festivos locales.
- **La política de señal y cancelación**, que es una decisión del negocio y no un
  estándar.
