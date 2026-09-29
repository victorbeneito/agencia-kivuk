# Captación: peluquerías de Ontinyent y la Vall d'Albaida

El plan para conseguir los primeros clientes, escrito para alguien que no ha
vendido nunca. Empezado el 29/09/2026.

La idea que lo sostiene todo: **no vas a vender un chatbot, vas a enseñar uno
funcionando y a hacer preguntas.** Quien ve a su propio móvil recibir una cita
confirmada a las once de la noche no necesita que le convenzan; necesita que le
digas cuánto cuesta y cuándo empieza.

---

## 1. Por qué peluquerías, y a cuáles

Es buen sector para empezar, por cuatro motivos:

- **El dolor se ve desde la puerta.** Tienen las manos ocupadas todo el día y el
  móvil no para de sonar. No hace falta explicarles el problema.
- **Decide quien está delante.** La dueña suele estar en el salón. No hay
  departamento de compras ni socio al que consultar.
- **Hay muchas.** En la comarca hay decenas, y un «no» no te cierra el sector.
- **La demo está hecha para ellas**, con guion probado (`docs/demo-peluqueria-mechas.md`).

La pega es que el ticket es pequeño y miran mucho el dinero. Por eso el argumento
nunca es la tecnología: es **la silla vacía** (ver apartado 7).

**A cuáles, por orden:**

| Tipo | Cómo reconocerla | Prioridad |
| --- | --- | --- |
| **A** | Da citas por WhatsApp o por teléfono. En Instagram o Google pone «pide cita al 6xx…» | **Primero.** Es exactamente para quien está hecho |
| **B** | Ya usa Booksy, Treatwell o Fresha (enlace de reserva en la bio) | Después. Tienen algo, y hay que explicar la diferencia |
| **C** | Una sola persona que casi no tiene redes | Solo si la conoces. Suele ser la que menos puede pagar |

Tamaño ideal: **de 1 a 4 personas trabajando.** Por encima suele haber
recepcionista o cadena.

---

## 2. El método: en persona, y en dos pasos

Has preguntado si llamar, escribir o ir. **Ir.** Y por este orden:

1. **Visita corta (2 minutos), sin pedir nada.** Te presentas, dejas la tarjeta
   de la demo y pides un rato otro día.
2. **Demo (15 minutos), con cita.** En el salón, a la hora que ella diga, con su
   móvil en la mano.

Por qué no las otras:

- **Llamar:** están cortando o tiñendo. Una llamada de alguien que no conocen es
  una interrupción, y el producto no se entiende sin verlo.
- **WhatsApp o Instagram en frío:** se lee en diagonal y se contesta poco. Sirve
  **después** de la visita, para el seguimiento, no para abrir.
- **En persona:** en un pueblo, la cara es la mitad de la venta. «Soy Víctor, de
  aquí de Ontinyent» es un argumento que ninguna plataforma grande tiene. Y
  **esa es tu ventaja frente a la competencia**, que existe, pero no entra por la
  puerta.

**Cuándo ir:** de martes a jueves, a media mañana (10:00-12:00) o a primera hora
de la tarde. Muchas cierran el lunes; el viernes y el sábado es cuando más
trabajo tienen. Si al entrar ves que están a tope, di «vuelvo otro rato» y vete:
eso ya cuenta a tu favor.

---

## 3. Antes de salir

- [ ] **Cancela desde el panel tu cita de prueba** en Peluquería Mechas. El bot
      da una sola cita futura por persona, y si pruebas desde tu número te dirá
      que ya tienes una.
- [ ] **La demo en tu móvil:** el panel de Peluquería Mechas como app instalada,
      con sesión iniciada y **notificaciones activadas**. El paso 6 de la demo
      (el aviso cuando alguien pide una persona) solo impresiona si el móvil
      suena.
- [ ] **Tarjetas A6 impresas** (`docs/material-venta/demos/tarjeta-peluqueria.png`),
      unas 30. Por detrás, tu nombre y tu móvil, aunque sea a mano o con un
      sello: la tarjeta lleva el número de la demo, no el tuyo.
- [ ] **Instagram de @agenciakivuk con 6 publicaciones como mínimo** (apartado
      10). Después de tu visita, lo primero que hará es buscarte.
- [ ] **La hoja de seguimiento** (`seguimiento-peluquerias.csv`, en esta misma
      carpeta). Súbela a Google Sheets para tenerla en el móvil. Estados, los
      mismos que tendrá el CRM: *nuevo → visitado → demo → propuesta → cliente /
      descartado*, más *más adelante* con su fecha. La columna que importa es
      «fecha próximo paso»: ordena por ella cada mañana.
- [ ] **El contrato revisado** por la gestoría, o al menos la hoja de servicios
      lista para rellenar. Si alguien dice que sí, que no se enfríe esperando
      papeles.
- [ ] **Tres o cuatro fichas de alta impresas**
      (`ficha-alta-peluqueria.md`, en esta carpeta). Al «sí» se le deja una y
      se fija ese mismo día la sesión para rellenarla juntos. Lo que viene
      después, paso a paso, en `docs/alta-cliente-peluqueria.md`.
- [ ] Prueba la demo tú mismo con las seis preguntas del guion, desde **otro**
      número, para no llevarte sorpresas.

---

## 4. Empieza por las que ya te conocen

Antes de entrar en ningún salón desconocido: **la peluquería a la que vas tú, la
de tu familia, la de tus amigos.** Haz una lista de 5.

No es para venderles a ellas (aunque puede salir): es **para ensayar**. Con
alguien que te conoce puedes equivocarte, preguntarle «¿qué te ha parecido?,
¿qué no has entendido?» y pulir el guion. Cuando llegues al salón número 10, ya
lo habrás contado veinte veces.

Y a esas cinco les puedes preguntar algo que a un desconocido no: **«¿a qué
compañera tuya le vendría bien esto?»** Un contacto recomendado vale por diez
puertas en frío.

---

## 5. La visita corta: el guion

Dos minutos. De pie, sin sentarte, sin sacar el ordenador.

> Hola, perdona que te interrumpa, soy Víctor, de aquí de Ontinyent. Monto un
> asistente de WhatsApp para peluquerías: contesta a tus clientas y les da cita
> mientras tú estás trabajando, a cualquier hora.
>
> No vengo a venderte nada ahora, que estás con faena. Te dejo esto: si escaneas
> el código, le escribes como si fueras una clienta y ves cómo responde.
>
> Si te parece, me paso otro día un cuarto de hora y te lo enseño con tu agenda.
> ¿Qué día te va mejor?

Tres claves:

- **La frase importante es la última.** Lo único que buscas de esta visita es una
  fecha para la demo. Si te dice un día, apúntalo delante de ella.
- **Si dice «ya te llamo yo»:** «Perfecto. ¿Me das un WhatsApp y te escribo el
  jueves para ver si te ha dado tiempo a probarlo?». Con eso ya tienes permiso
  para escribirle.
- **Si dice que no:** «Vale, gracias por el rato. Quédate la tarjeta por si
  acaso». Y te vas. Un «no» hoy es muchas veces un «ahora no».

Si habla valenciano, en valenciano.

---

## 6. La demo: 15 minutos, en cuatro partes

### a) Preguntas primero (5 minutos)

Antes de enseñar nada. Las respuestas te dicen qué contar y te dan los números
del apartado 7:

1. «¿Cómo te piden cita ahora? ¿WhatsApp, teléfono, Instagram?»
2. «¿Cuántos mensajes te llegan al día, más o menos?»
3. «¿Quién los contesta mientras estás con una clienta?»
4. «¿Y los que escriben por la noche o el domingo?»
5. «¿Te falla gente? ¿Cuántas citas a la semana se quedan vacías?»
6. «¿Cuánto vale un servicio normal? Un corte con color, por ejemplo.»

Escucha. Si te cuenta un problema, pregunta más sobre ese. Cuanto más habla ella,
mejor va.

### b) La demo, con SU móvil (5 minutos)

**Que escriba ella** al número de la demo, desde su teléfono. Es lo que más
impacta y así la cita de prueba queda a su nombre, no al tuyo.

Seguid el guion de `docs/demo-peluqueria-mechas.md`, apartado «Guion de la demo»:
precio de unas mechas → pelo largo → hueco el viernes → reservar → rubio platino
→ «quiero hablar con alguien». Y una pregunta que el bot no sepa («¿hacéis
extensiones?») para que vea que **no se inventa nada**.

Mientras ella escribe, enséñale en tu móvil cómo entra la cita en el calendario
del panel.

Cierra con esto: **«Mañana te llegará el recordatorio de esta cita, para que lo
veas tú misma. Si quieres anularla, díselo al bot por el chat, que también lo
hace».** Al día siguiente, en mitad del trabajo, le suena el móvil con tu
producto. No hay mejor seguimiento que ese.

### c) Sus números (2 minutos)

Con lo que te ha contado en las preguntas:

> Me has dicho que se te quedan unas dos citas vacías a la semana, a unos 40 €.
> Son más de 300 € al mes. El asistente cuesta 60. Si el recordatorio te salva
> una sola de esas citas a la semana, ya te sale a cuenta, sin contar las que te
> entran de noche.

Los números **los pone ella**, no tú. Si no te ha dado ninguno, usa los de
cualquier salón («una cita perdida a la semana»).

### d) La propuesta (3 minutos)

> Esto se monta en unos días. Yo me encargo de todo: meto tus servicios, tus
> precios y tus horarios, y lo probamos juntas antes de que lo vea ninguna
> clienta. Tú solo me cuentas cómo trabajas.
>
> [Precio y oferta, apartado 8.]
>
> ¿Lo probamos?

Y **te callas**. El silencio después de la pregunta es incómodo, y es normal.
Quien habla primero después del precio suele ser quien cede. Deja que conteste.

Si dice «me lo tengo que pensar»: «Claro. ¿Qué es lo que te hace dudar?». Lo que
responda es la objeción de verdad (apartado 9). Y pon fecha: «¿Te escribo el
martes?».

---

## 7. El argumento: la silla vacía

Lo que vende no es «inteligencia artificial». Son tres cosas que ella ya sabe
que le pasan:

1. **La silla vacía.** Alguien que no viene y no avisa. El recordatorio de la
   víspera por WhatsApp es lo que la recupera.
2. **La clienta de las 23:00.** Escribe para pedir cita, nadie contesta y a la
   mañana siguiente ya ha reservado en otro sitio.
3. **Las manos ocupadas.** Dejar el tinte para contestar «¿cuánto valen unas
   mechas?» por quinta vez.

Y dos frases que desmontan los miedos:

- «**No se inventa nada.** Lo que no sabe, te lo pasa.»
- «**Cuando entras tú, el bot se calla.** Sigues mandando tú.»

---

## 8. Precio y oferta de lanzamiento

> **Esto lo decides tú.** Lo que sigue es una propuesta.

**Qué vender a una peluquería:** un único paquete, **«Recepcionista de
WhatsApp»**, que es exactamente lo que hace la demo: contesta dudas sobre
servicios y precios, **y** da, cambia y anula citas, con recordatorio. Venderle
«atención» y «citas» por separado a una peluquería la obliga a elegir algo que no
entiende. Propuesta: el precio del agente de citas, **desde 500 € + 60 €/mes**,
incluyendo las preguntas sobre servicios y precios que salen al pedir cita.

**Oferta para los 5 primeros salones de la comarca (clientes fundadores):**

- Puesta en marcha a **250 €** en vez de 500 €.
- La cuota, igual: **60 €/mes**, sin permanencia.
- **Garantía de 30 días:** si en el primer mes no le convence, se le devuelve la
  puesta en marcha.
- **A cambio:** que te deje usar su nombre y sus números como caso (cuántos
  mensajes atendió el bot, cuántas citas dio), y una reseña.

Por qué así:

- **Los 500 € de entrada son la barrera**, no los 60 al mes. Bajarla para los
  primeros quita el «me lo tengo que pensar».
- **La garantía te quita el miedo a ti.** Ya no le pides que se fíe: le pides que
  lo pruebe. Es mucho más fácil de decir.
- **Lo que más necesitas ahora no es dinero, son casos.** La sección «Casos» de
  la web tiene uno, sin nombre. Con tres peluquerías de la comarca con nombre y
  números, las siguientes se venden solas, y a precio completo.
- Que sean **5 y de la comarca** lo hace real: se acaba, y eso ayuda a decidir.

La oferta se escribe en el Anexo I del contrato como condición particular.

---

## 9. Las objeciones que vas a oír

| Te dice | Le respondes |
| --- | --- |
| «Es caro» | «¿Cuántas citas se te quedan vacías al mes? Con que el recordatorio te salve una a la semana, ya te sobra.» Y la garantía: «Si en un mes no lo ves, te devuelvo la puesta en marcha.» |
| «Ya contesto yo el WhatsApp» | «Claro, y lo seguirás haciendo cuando quieras. Esto es para cuando estás con las manos en un tinte, o a las once de la noche.» |
| «A mis clientas no les va a gustar hablar con una máquina» | «Por eso habla como tu salón y lo que no sabe te lo pasa. Pruébalo tú: ¿te ha parecido frío?» (Acaba de hacer la demo.) |
| «¿Y si se equivoca?» | «Solo dice lo que tú le das. Si le preguntan algo que no sabe, lo dice y te avisa. Y ves todas las conversaciones.» |
| «Ya tengo Booksy / Treatwell» | «Eso está bien para quien entra en el enlace. Pero la mayoría te escribe por WhatsApp igualmente, ¿no? Esto contesta ahí, donde ya te escriben, y les da la cita en tu misma agenda.» Ojo: hoy **no** se sincroniza con Booksy. Si depende de eso, no es tu cliente todavía. |
| «No quiero cambiar de número» | «No hace falta. Lo normal es un número nuevo solo para citas, y tú te quedas con el tuyo como siempre.» |
| «Me lo tengo que pensar» | «Claro. ¿Qué es lo que te hace dudar?» Y pon fecha para volver a hablar. |
| «Ahora no, en temporada / en verano» | «Perfecto. ¿Te escribo en [mes]?» Apúntalo en la hoja. |

La regla general: **nunca discutas.** Pregunta. «¿Por qué lo dices?» vale más
que cualquier argumento.

---

## 10. Instagram y publicidad: qué ahora y qué después

**Publicidad: todavía no.** Tienes razón en que sin contenido no hay nada que
anunciar. Y además, para un negocio local como este, los anuncios rinden mucho
menos que tus visitas. Cuando tengas 2 o 3 clientes con nombre, un anuncio
pequeño (5-10 €/día, radio de 20 km, que abra el WhatsApp de Kivuk) tiene
sentido. Antes no.

**Instagram: sí, pero no para captar, sino para que te den credibilidad.** Tras
tu visita, te buscarán. Si encuentran una cuenta vacía, pierdes puntos. Con 6
publicaciones basta para empezar:

1. **Quién soy:** foto tuya y «Víctor, de Ontinyent. Monto asistentes de WhatsApp
   para negocios de la comarca». En un pueblo, esto es lo que más pesa.
2. **Vídeo de la demo:** grabación de pantalla de la conversación de Peluquería
   Mechas, de 20 segundos. Mechas, hueco el viernes, cita confirmada.
3. **El recordatorio:** «La víspera, tu clienta recibe esto». Captura del
   mensaje.
4. **«No se inventa nada»:** la respuesta a «¿hacéis extensiones?».
5. **«Cuando entras tú, el bot se calla»:** el relevo, con la bandeja del panel.
6. **Pruébalo:** el QR de la demo y «escríbele como si fueras una clienta».

Y **la ficha de Google Business Profile de Kivuk**, gratis, que es donde irán
las reseñas de los primeros clientes.

---

## 11. Seguimiento: donde se pierden las ventas

La mayoría de ventas no se cierran en la primera conversación. Se pierden porque
**nadie vuelve a escribir.**

| Cuándo | Qué |
| --- | --- |
| Día siguiente a la visita | Nada: le llega el recordatorio de su cita de prueba. |
| 2-3 días después | «Hola [nombre], soy Víctor, el del asistente de WhatsApp. ¿Te dio tiempo a probarlo? ¿Qué te pareció?» |
| 1 semana | Si no contestó: «Te dejo un momento, que sé que vais a tope. Si te apetece, el [día] me paso 15 minutos y te lo enseño con tu agenda.» |
| 3 semanas | Último: «¿Lo dejamos para más adelante? Si quieres, te escribo en [mes].» Y lo apuntas. |

Después de tres mensajes sin respuesta, se para. Insistir más quema la relación
en un pueblo donde todo el mundo se conoce.

Solo se escribe a quien te dio su número o te lo pidió en la visita.

---

## 12. Números realistas y ritmo

Los primeros meses de alguien que empieza suelen ir más o menos así:

```
30 visitas cortas  →  8-12 demos  →  2-4 «sí»
```

Puede salir mejor o peor, pero **el orden de magnitud es ese**: muchos «no» por
cada «sí». Un «no» no es un fracaso tuyo, es la estadística. Cada «no» te
acerca al siguiente «sí», y cada demo te sale mejor que la anterior.

**Ritmo propuesto:**

| Semana | Qué |
| --- | --- |
| 1 | Preparación (apartado 3), las 6 publicaciones de Instagram y las 5 peluquerías conocidas |
| 2-3 | Ontinyent: 10-15 visitas cortas por semana y las demos que salgan |
| 4 | Revisar la hoja: qué objeciones se repiten, qué funciona. Ajustar el guion |
| 5+ | Resto de la Vall d'Albaida (Albaida, Bocairent, Aielo, l'Olleria…) |

**Objetivo del primer mes: 1 o 2 clientes firmados**, montados y funcionando. No
hace falta más: con dos casos reales, todo lo demás se vuelve más fácil.

---

## 13. Lo que no hay que hacer

- **Enseñar el panel antes que el WhatsApp.** Lo que vende es lo que ve su
  clienta, no las pantallas de administración.
- **Hablar de «IA», «modelos» o «automatización».** Di «asistente», «contesta»,
  «te da la cita».
- **Prometer lo que no hay:** sincronización con Booksy, llamadas de teléfono,
  voz. Si lo piden, «lo estudio para tu caso» y lo apuntas: es información
  valiosa para saber qué construir.
- **Mandar mensajes masivos** o escribir a números que no te han dado.
- **Bajar el precio en la misma conversación porque te dicen «es caro».** La
  oferta de fundadores ya está rebajada. Si aun así no puede, no es tu cliente
  ahora.
