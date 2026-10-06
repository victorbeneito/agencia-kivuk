# Base de conocimiento — Inmobiliaria Llaves (demo)

Documentos curados para cargar en la pestaña **Conocimiento** del panel
(`/dashboard/<clientId>/conocimiento`).

**Este cliente es simulado.** No existe la inmobiliaria, ni la oficina, ni
Marta, Javier y Sergio, ni los inmuebles. Todo está escrito para enseñar el
producto a inmobiliarias reales de Ontinyent y alrededores. Si un cliente
potencial pregunta, es una demo y se dice que lo es.

```
node scripts/cargar-conocimiento.js docs/conocimiento-inmobiliaria-llaves.md "Inmobiliaria Llaves" --aplicar
node scripts/probar-conocimiento.js "Inmobiliaria Llaves" --bateria docs/preguntas-inmobiliaria-llaves.txt
```

## Reglas que se han seguido al escribirlos

Las de las otras demos (preguntas coloquiales al principio de cada documento y
cada dato en un solo sitio) y tres propias del sector:

- **Ningún inmueble ni ningún precio de inmueble aquí.** Salen de la cartera
  (`inmuebles`), que es la que se actualiza cuando se vende un piso. Un precio
  escrito en un documento se queda viejo sin que nadie se entere.
- **Lo legal, con la norma vigente**: en el alquiler de vivienda los honorarios
  de la inmobiliaria los paga el propietario (Ley 12/2023, por el derecho a la
  vivienda), la fianza es de una mensualidad en vivienda y de dos en local, y la
  garantía adicional en vivienda no pasa de dos mensualidades (LAU, art. 36).
  Es lo primero que va a mirar un comercial que vea la demo.
- **Los gastos de compra, aproximados y dicho así.** Dependen del caso
  (vivienda nueva o usada, hipoteca o no); el documento da el orden de magnitud
  y manda al comercial para la cuenta exacta.

---

## 1. Quiénes somos — la inmobiliaria y qué hacemos

- **Categoría:** La empresa

```
¿Qué inmobiliaria sois? ¿Desde cuándo estáis? ¿Qué hacéis? ¿Vendéis y alquiláis? ¿Trabajáis locales y naves? ¿Estáis registrados?

Inmobiliaria Llaves es una inmobiliaria de Ontinyent, abierta desde 2009. Trabajamos en Ontinyent y en los pueblos de alrededor: Agullent, Aielo de Malferit, Albaida, Bocairent, L'Olleria y Xàtiva.

Hacemos cuatro cosas:
- Venta de viviendas: pisos, áticos, casas de pueblo, adosados, chalets y casas de campo.
- Alquiler de viviendas de larga temporada.
- Venta y alquiler de locales comerciales, naves y oficinas.
- Valoración gratuita de tu vivienda y venta o alquiler de la misma por nosotros.

Estamos inscritos en el Registro de Agentes de Intermediación Inmobiliaria de la Comunitat Valenciana.

No hacemos alquiler vacacional ni de temporada corta, ni administración de comunidades.
```

---

## 2. Dónde estamos, horario y cómo pedir cita

- **Categoría:** La empresa

```
¿Dónde estáis? ¿Qué horario tenéis? ¿Abrís por la tarde? ¿Abrís los sábados? ¿Cómo pido una visita? ¿Puedo pasar sin cita?

La oficina está en la calle Mayor, 12, en el centro de Ontinyent.

Horario:
- De lunes a viernes: de 9:30 a 13:30 y de 16:30 a 20:00.
- Sábados: de 10:00 a 13:30, sobre todo para visitas.
- Domingos y festivos: cerrado.

Las visitas a los inmuebles se piden por este mismo WhatsApp, a cualquier hora, o en la oficina. Siempre con cita: el comercial tiene que quedar con el propietario o tener las llaves, así que sin cita no podemos enseñar nada.

A la oficina puedes pasar sin cita en horario de apertura, pero si quieres hablar de algo con calma (una hipoteca, una oferta, vender tu casa) mejor pide cita y te atiende la persona que lo lleva.

Atendemos en castellano, en valenciano y en inglés.
```

---

## 3. El equipo — quién lleva qué y qué días está cada uno

- **Categoría:** La empresa

```
¿Quién me enseña el piso? ¿Con quién hablo para alquilar? ¿Quién lleva los locales? ¿Está Marta el sábado? ¿Qué días está Javier?

Somos tres comerciales, cada uno con lo suyo:

- Marta: venta de viviendas y valoraciones. Está de lunes a viernes por la mañana y por la tarde, menos el miércoles por la tarde, y el sábado por la mañana.
- Javier: alquiler de viviendas. Está sobre todo por las tardes, de lunes a viernes; el martes y el jueves también por la mañana, y el sábado por la mañana.
- Sergio: locales, naves y oficinas, en venta y en alquiler. Está por las mañanas de lunes a viernes, y el lunes y el miércoles también por la tarde. También enseña viviendas en venta cuando Marta no puede.

Las visitas a viviendas en venta las hacen Marta o Sergio; las de alquiler, Javier o Marta; las de locales y naves, Sergio. Las valoraciones, siempre Marta.

El sábado por la mañana están Marta y Javier: se pueden ver viviendas en venta y en alquiler, pero no locales ni naves.
```

---

## 4. Cómo es una visita

- **Categoría:** Preguntas frecuentes

```
¿Cuánto dura una visita? ¿Dónde quedamos? ¿Me dais la dirección? ¿Puedo ir con mi pareja? ¿Puedo ver varios pisos el mismo día? ¿Tengo que pagar algo por ver un piso? ¿Puedo ir solo a verlo?

Las visitas son gratis y sin compromiso. Una visita a una vivienda en venta dura unos 45 minutos; a una de alquiler, unos 30; a un local o una nave, unos 45.

Al confirmar la visita, el comercial te escribe con la dirección exacta y el punto de encuentro. No damos la dirección antes por respeto a los propietarios.

Puedes venir acompañado de quien quieras: pareja, familia o quien te vaya a ayudar a decidir.

Si quieres ver varios inmuebles el mismo día, dilo al pedir la cita y el comercial organiza la ruta.

Las visitas se hacen siempre con el comercial: no dejamos llaves ni hacemos visitas sin nadie de la inmobiliaria.

Si no vas a poder llegar, avisa por aquí: así el comercial no se queda esperando en la puerta y le damos el hueco a otra persona.
```

---

## 5. Zonas de Ontinyent y alrededores

- **Categoría:** Preguntas frecuentes

```
¿Qué zona me recomendáis? ¿Dónde está la universidad? ¿Qué zona es más tranquila? ¿Dónde hay chalets? ¿Qué es la Vila? ¿Dónde están los polígonos? ¿Trabajáis en Xàtiva?

Zonas de Ontinyent con las que trabajamos:
- Centro: comercios, servicios y todo a mano andando. Pisos con ascensor y algunos de obra nueva.
- La Vila: el casco antiguo. Casas de pueblo con mucho espacio, muchas para reformar, a buen precio.
- Sant Josep: zona de comercios y de paso, con pisos a buen precio y locales a pie de calle.
- El Llombo: junto al campus universitario. Pisos más nuevos, urbanizaciones con piscina comunitaria y pisos para estudiantes. Si buscas algo cerca de la universidad, es El Llombo.
- Sant Rafel: residencial y tranquilo, con pisos amplios y adosados.
- Almaig: avenida principal, buena para locales y oficinas.
- El Pilar, la Ombria, Les Aigües y la Carretera de Valencia: urbanizaciones y zonas de chalets, a pocos minutos del centro en coche.
- Polígono El Pla: naves industriales.

Fuera de Ontinyent trabajamos Agullent, Aielo de Malferit, Albaida, Bocairent, L'Olleria y Xàtiva. Que trabajemos una zona no quiere decir que siempre haya algo disponible en ella: lo que hay en cada momento lo dice la búsqueda.

No recomendamos una zona sobre otra en general: depende de lo que busques (andar a todo, tranquilidad, jardín, cerca del trabajo o de la universidad). Si nos lo cuentas, te enseñamos lo que encaja.
```

---

## 6. Comprar una vivienda — los pasos

- **Categoría:** Preguntas frecuentes

```
¿Cómo funciona comprar con vosotros? ¿Qué pasos hay? ¿Cuánto se tarda? ¿Qué es la señal? ¿Qué son las arras? ¿Puedo hacer una oferta? ¿Se puede negociar el precio?

Comprar con nosotros va así:
1. Nos cuentas qué buscas y te enseñamos lo que encaja.
2. Visitas los que te interesen, con el comercial.
3. Si te gusta uno, haces una oferta por escrito. Se la trasladamos al propietario, que la acepta, la rechaza o hace una contraoferta.
4. Con el precio acordado, se firma una reserva o un contrato de arras con una señal, y el inmueble deja de enseñarse.
5. Se firma la compraventa en la notaría y te damos las llaves.

Entre el acuerdo y la notaría suelen pasar entre uno y tres meses, sobre todo si hay hipoteca de por medio.

El precio de cada inmueble es el que pide el propietario. Ofertas se pueden hacer siempre, pero las lleva el comercial en persona, no por este chat.

Si compras, no pagas comisión a la inmobiliaria: nuestros honorarios los paga quien vende.
```

---

## 7. Gastos e impuestos al comprar

- **Categoría:** Pagos

```
¿Qué gastos tiene comprar un piso? ¿Cuánto son los impuestos? ¿Pago comisión a la inmobiliaria si compro? ¿Cuánto dinero necesito ahorrado? ¿Qué es el ITP?

Si compras, no pagas comisión a la inmobiliaria: nuestros honorarios en una venta los paga el propietario que vende.

Además del precio, comprar tiene impuestos y gastos:
- Vivienda de segunda mano: el Impuesto de Transmisiones Patrimoniales (ITP), que en la Comunitat Valenciana es un porcentaje del precio.
- Vivienda nueva, comprada al promotor: IVA y el impuesto de actos jurídicos documentados.
- En los dos casos: notaría, registro de la propiedad y, si la hay, gestoría.

Como orientación, entre impuestos y gastos hay que contar con algo en torno al 10-12 % del precio, pero depende de cada caso (edad del comprador, si es vivienda habitual, si hay hipoteca). La cuenta exacta para un inmueble concreto te la hace el comercial o el asesor financiero.

Si vas a pedir hipoteca, los bancos suelen financiar como mucho el 80 % del precio, así que lo normal es tener ahorrado el 20 % más los gastos.
```

---

## 8. Hipoteca y financiación

- **Categoría:** Pagos

```
¿Me ayudáis con la hipoteca? ¿Tenéis un banco? ¿Cuánto me darían? ¿Cuánto pagaría al mes? ¿Me conceden la hipoteca?

Colaboramos con un asesor financiero que estudia tu caso y busca la hipoteca entre varios bancos. El primer estudio es gratis y sin compromiso.

Nosotros no concedemos hipotecas ni podemos asegurar que un banco te la dé: eso depende de tus ingresos, de tus ahorros y de lo que decida el banco.

Tampoco calculamos cuotas por este chat: dependen del tipo de interés, del plazo y del banco. Si quieres saber cuánto te darían y cuánto pagarías al mes, pide una cita en la oficina y te lo mira el asesor con tus números.

Si todavía no tienes la hipoteca, es buena idea pedir el estudio antes de enamorarte de un piso: así sabes hasta dónde puedes llegar.
```

---

## 9. Alquilar una vivienda — requisitos y lo que se paga

- **Categoría:** Pagos

```
¿Qué piden para alquilar? ¿Cuánto hay que pagar al entrar? ¿Cuánto es la fianza? ¿Pago comisión a la inmobiliaria por alquilar? ¿Piden aval? ¿Cuánto dura el contrato? ¿Qué papeles necesito?

Para alquilar una vivienda, el propietario suele pedir:
- DNI o NIE.
- Justificante de ingresos: las últimas nóminas y el contrato de trabajo, o la última declaración de la renta si trabajas por tu cuenta.
- A veces, un aval o un seguro de impago, según el propietario.

Esa documentación se entrega en la oficina o por correo al comercial, nunca por este chat.

Al firmar el contrato se paga:
- La primera mensualidad.
- La fianza legal: una mensualidad.
- Si el propietario la pide, una garantía adicional, que en vivienda no puede pasar de dos mensualidades.

Si alquilas una vivienda, no pagas honorarios a la inmobiliaria: por ley (Ley 12/2023, por el derecho a la vivienda), los gastos de gestión y de formalización del contrato los paga el propietario.

Los contratos de vivienda habitual son por años: aunque se firme por uno, el inquilino puede prorrogarlo hasta cinco (siete si el propietario es una empresa).
```

---

## 10. Mascotas, estudiantes y otras condiciones del alquiler

- **Categoría:** Preguntas frecuentes

```
¿Admiten mascotas? ¿Puedo ir con mi perro? ¿Alquiláis a estudiantes? ¿Se puede empadronar? ¿Están amueblados? ¿Incluye los gastos? ¿Puedo alquilar por meses?

Si se admiten mascotas lo decide cada propietario. Dilo al pedir la visita y el comercial te lo confirma para ese piso en concreto.

Alquilamos a estudiantes en los pisos que lo indican, sobre todo en El Llombo, junto al campus. Lo normal es que firmen todos los que vayan a vivir y que haya un aval.

En todos los alquileres de vivienda habitual te puedes empadronar.

Si un piso está amueblado, lo dice su ficha. Los suministros (luz, agua, gas, internet) normalmente los paga el inquilino aparte; si alguno va incluido, te lo dice el comercial.

Solo hacemos alquiler de larga temporada para vivienda habitual. No hacemos alquileres por meses, de temporada ni vacacionales.
```

---

## 11. Vender tu vivienda — la valoración gratuita

- **Categoría:** Preguntas frecuentes

```
¿Cuánto vale mi piso? ¿Me tasáis la casa? ¿Cuánto cobráis por vender? ¿Cómo vendéis? ¿Tengo que firmar exclusiva? ¿Cuánto se tarda en vender? Quiero vender mi casa.

Si quieres vender, lo primero es la valoración: Marta va a tu casa, la ve, la compara con lo que se ha vendido en la zona y te dice por cuánto se puede vender y en cuánto tiempo. Es gratis y sin compromiso, y dura alrededor de una hora.

La valoración no es una tasación oficial: la tasación la hace una sociedad tasadora, normalmente cuando el comprador pide la hipoteca.

Si decides vender con nosotros, nos encargamos de todo: fotos, anuncio en los portales inmobiliarios y en nuestra web, filtrar a los interesados, enseñar la vivienda, negociar las ofertas y acompañarte hasta la notaría.

Nuestros honorarios son un porcentaje del precio de venta que se acuerda contigo en la valoración, y solo se cobran si la vivienda se vende. Puedes encargárnosla en exclusiva o no; en la valoración te explicamos las dos opciones.

Cuánto se tarda en vender depende sobre todo del precio y de la zona. Te lo decimos con datos en la valoración.

Para la valoración ayuda tener a mano la escritura o la nota simple, el último recibo del IBI y, si lo tienes, el certificado energético.
```

---

## 12. Alquilar tu vivienda o tu local con nosotros

- **Categoría:** Preguntas frecuentes

```
Quiero alquilar mi piso. ¿Me buscáis inquilino? ¿Cómo elegís al inquilino? ¿Tenéis seguro de impago? ¿Cuánto cobráis por alquilar mi piso?

Si tienes un piso, una casa o un local para alquilar, te buscamos inquilino: lo anunciamos, enseñamos el inmueble, pedimos y revisamos la documentación de los interesados y preparamos el contrato.

Al propietario le presentamos a los candidatos con su documentación, y quien decide es él.

Podemos tramitar un seguro de impago de alquiler, que paga la renta si el inquilino deja de pagar. Es opcional.

Nuestros honorarios por alquilar tu inmueble se acuerdan contigo antes de empezar. Para hablarlo, pide una cita en la oficina o una valoración, y te lo explicamos con tu inmueble delante.

Esto es para propietarios. Quien busca piso de alquiler para vivir no paga honorarios a la inmobiliaria: por ley los paga el propietario.
```

---

## 13. Locales, naves y oficinas

- **Categoría:** Preguntas frecuentes

```
Busco un local para abrir un negocio. ¿Puedo poner un bar en ese local? ¿Tiene licencia? ¿Hacéis traspasos? ¿Cuánto es la fianza de un local? ¿Quién lleva las naves? ¿Dónde están las naves?

Los locales, naves y oficinas los lleva Sergio, en venta y en alquiler.

Los locales están sobre todo en el centro de Ontinyent, en Sant Josep y en la avenida de Almaig. Las naves, en el polígono El Pla de Ontinyent y en el polígono de Aielo de Malferit.

Antes de alquilar o comprar un local para un negocio, comprueba que tu actividad se puede poner ahí: lo dice el ayuntamiento según la zona y el local. Para hostelería, además, hace falta salida de humos; si un local la tiene, lo dice su ficha. Sergio te ayuda a hacer la consulta antes de firmar, pero la licencia de actividad la pide quien abre el negocio.

En el alquiler de un local la fianza legal es de dos mensualidades, y las condiciones (duración, actualización de la renta, obras) se pactan en cada contrato.

No hacemos traspasos de negocios en funcionamiento: alquilamos o vendemos el local vacío.
```

---

## 14. Reservar un inmueble y hacer una oferta

- **Categoría:** Preguntas frecuentes

```
Quiero reservar el piso. ¿Cómo se reserva? ¿Cuánto es la señal? ¿Me lo guardáis? ¿Puedo hacer una oferta por WhatsApp? ¿Lo puedo dejar reservado hasta que me den la hipoteca?

Un inmueble se reserva firmando un documento de reserva o un contrato de arras con una señal, en la oficina y con el comercial. Hasta entonces, el inmueble se sigue enseñando a otras personas: no se guarda por un mensaje.

Cuánto es la señal y qué pasa si al final no se compra (por ejemplo, si el banco no da la hipoteca) se acuerda en ese documento. El comercial te lo explica antes de firmar nada.

Las ofertas también las lleva el comercial: se hacen por escrito y se le trasladan al propietario. Si quieres hacer una, te pasamos con él.

Si un inmueble aparece como reservado, ya hay alguien con una reserva firmada. Si se cae, vuelve a estar disponible y te avisamos si lo pides.
```

---

## 15. Si no tenemos lo que buscas

- **Categoría:** Preguntas frecuentes

```
No tenéis lo que busco. ¿Me avisáis si entra algo? ¿Cada cuánto entran pisos nuevos? ¿Tenéis más pisos que no salen en la web?

Si ahora mismo no tenemos lo que buscas, apuntamos tu búsqueda (zona, presupuesto, habitaciones y lo que no puede faltar) y el comercial te escribe en cuanto entre algo que encaje. Muchas veces los pisos se venden o se alquilan antes de llegar a anunciarse, así que estar apuntado es la mejor forma de no perdértelos.

Entran inmuebles nuevos cada semana, pero no hay un ritmo fijo.

Lo que ves en esta búsqueda es todo lo que tenemos disponible ahora mismo.
```

---

## 16. Fotos, planos, certificado energético y documentación del inmueble

- **Categoría:** Productos

```
¿Me mandas fotos? ¿Tenéis planos? ¿Qué certificado energético tiene? ¿Cuánto son los gastos de comunidad? ¿Cuánto es el IBI? ¿De qué año es? ¿Qué orientación tiene? ¿Tiene cargas?

Las fotos, los planos y la dirección de cada inmueble te los manda el comercial: por este chat te enseñamos las fichas y te damos la visita.

Todos los inmuebles que vendemos o alquilamos tienen su certificado de eficiencia energética, que es obligatorio. La etiqueta te la dice el comercial.

Los gastos de comunidad, el IBI, el año de construcción, la orientación y si tiene cargas son datos de cada inmueble que te confirma el comercial, con los papeles delante. Mejor preguntarlos antes de la visita o en ella, para no dar un dato equivocado.

Antes de firmar una compra revisamos la nota simple del registro, que dice quién es el propietario y si el inmueble tiene cargas.
```

---

# Pendiente de confirmar

Nada: es una demo. Si se convierte en la plantilla de un cliente real, hay que
pedirle sus honorarios, si colabora con un asesor financiero, sus horarios, su
número de registro y si trabaja en exclusiva.
