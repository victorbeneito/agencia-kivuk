# Base de conocimiento — Cestería Aparici

Documentos curados para cargar en la pestaña **Conocimiento** del panel
(`/dashboard/<clientId>/conocimiento`).

Todo lo que hay aquí está extraído de **www.cesteriaaparici.es** el **03/08/2026**.
Lo que no se pudo verificar en su web **no está escrito como afirmación**: está
en la sección «Pendiente de confirmar» al final, y no debe cargarse hasta que el
cliente lo confirme. Un dato inventado en un documento es un dato que el bot le
dará a un comprador real como si fuera cierto.

Cómo usar este archivo: por cada documento, copia el **Título**, elige la
**Categoría**, pega el **Contenido** y la **URL de origen** en el formulario del
panel. Al guardar se indexa solo. O de una vez:

```
node scripts/cargar-conocimiento.js docs/conocimiento-cesteria-aparici.md "Cesteria Aparici" --aplicar
```

## Dos lecciones de la batería de pruebas

**1. Pon dentro del documento las preguntas que responde.** El documento 1
respondía perfectamente a «¿cuántos años lleváis?» pero no se recuperaba con
«desde cuando existis»: 0,187 de similitud. El dato estaba y el bot habría dicho
que no lo sabía. Añadiendo al principio del contenido las formulaciones
coloquiales de lo que resuelve, subió a 0,248. Un embedding no busca el
documento que *contiene* la respuesta, busca el que *se parece* a la pregunta.

**2. El umbral estaba demasiado alto.** Aun con las preguntas dentro, esa
consulta se quedaba en 0,248 contra un umbral de 0,25. Perseguir centésimas
reescribiendo el texto es frágil: se bajó el umbral a **0,20** en el nodo
`Buscar conocimiento` del bot. Una pregunta corta y coloquial nunca va a dar
similitudes altas contra un párrafo de 800 caracteres, y quien decide si el
fragmento sirve es el modelo, que ya tiene instrucciones de decir que no lo sabe
cuando el dato no está.

Con ese umbral, las 29 preguntas de la batería recuperan algo, y en las 24 que
tienen respuesta en la base el documento correcto sale **el primero**.

Regla para los próximos: **cada documento empieza por dos o tres formulaciones
coloquiales de lo que resuelve.** Y después de escribirlo, se lanza la batería:

```
node scripts/probar-conocimiento.js "Cesteria Aparici" --bateria docs/preguntas-cesteria-aparici.txt
```

---

## 1. Quiénes somos — historia, años y generaciones

- **Categoría:** La empresa
- **URL de origen:** https://www.cesteriaaparici.es/quien-es-aparici

```
¿Desde cuándo existís? ¿Cuántos años lleváis? ¿Sois una empresa antigua? ¿Quién está detrás?

Cestería Aparici es un taller artesanal de fibras naturales fundado en 1950 en Aielo de Malferit (Valencia). Es una empresa familiar que va por su tercera generación y que lleva más de 75 años dedicada a la cestería, así que es de las más antiguas y con más experiencia del sector en España.

Empezó con Juan Domenech, conocido como "el Moreno", forrando con mimbre y caña las garrafas de vino y aceite de las fábricas de vidrio de la zona. En 1984 tomaron la dirección Mercedes Domenech y Pepe Aparici, la segunda generación. Hoy la dirige José Aparici, de la tercera generación.

Todo se fabrica de forma manual y artesanal en su propio taller de Aielo de Malferit, con técnicas tradicionales que se han ido transmitiendo de una generación a otra. Las fibras que trabajan son naturales: mimbre, esparto, caña y palma.

La razón social de la empresa es Cestería Aparici SL.
```

---

## 2. Contacto y dónde estamos

- **Categoría:** La empresa
- **URL de origen:** https://www.cesteriaaparici.es/contactus

```
Puedes contactar con Cestería Aparici por teléfono en el 96 236 03 33 o en el 633 67 81 92. Ese segundo número tiene WhatsApp.

El correo electrónico de la empresa es gestion@cesteriaaparici.es.

El taller y el almacén están en Aielo de Malferit (Valencia). No es una tienda abierta al público: la dirección y el horario de recogida no se dan por aquí, los coordina una persona del equipo con quien ya tiene un pedido.
```

---

## 3. Envíos para particulares — coste, plazos y zonas

- **Categoría:** Envíos
- **URL de origen:** https://www.cesteriaaparici.es/envios

```
¿Cuánto tarda en llegar? ¿Cuánto cuesta el envío? ¿Enviáis a Baleares? ¿Y a Canarias? ¿Enviáis fuera de España? ¿Cuándo sale mi pedido?

Los envíos de Cestería Aparici para clientes particulares cuestan 4,99 € en la Península. El envío es gratuito a partir de 80 € de compra.

Si el pedido se hace antes de las 11:00 y lo que se ha elegido está en stock, se prepara y sale ese mismo día.

En la Península, los paquetes pequeños, de hasta 10 kg y con medidas de hasta 70x45x40 cm, llegan en 24 a 48 horas laborables. Los lleva CTT Express. Los grandes, de más de 10 kg o que superen esas medidas, tardan entre 2 y 14 días laborables, según el tamaño. Los lleva CBL Logística. Casi todos los muebles (sillas, tronas, sillones, mesas, bancos) pasan de esas medidas, así que van como envío grande. Si es una pieza que se fabrica para el cliente, el plazo es otro: el de fabricación más el envío.

Si alguien necesita el pedido para un día concreto («¿me llega el miércoles?»), no se le garantiza una fecha: se le dan estos plazos y, si es urgente, se pasa a una persona del equipo, que mira si hay forma de enviarlo antes.

A Baleares el envío cuesta 25 €, IVA incluido, para particulares. Los paquetes de menos de 10 kg o de menos de 150 cm sumando sus medidas van con TIPSA y tardan 48 a 72 horas. Los más voluminosos van con Rhenus o CBL y tardan entre 4 y 14 días laborables.

A Canarias y fuera de España se prepara una cotización a medida, para darle el mejor precio posible. Para hacerla hacen falta las referencias y cantidades de los artículos y la dirección de entrega completa, con el código postal. Fuera de España, el cliente también puede mandar su propia agencia a recogerlo, con el coste y la gestión a su cargo.

A Ceuta y Melilla no se realizan entregas.

Cuando el pedido sale, se envía un correo electrónico con el seguimiento para poder consultar dónde está.
```

---

## 4. Devoluciones y cambios para particulares

- **Categoría:** Devoluciones
- **URL de origen:** https://www.cesteriaaparici.es/cambios-y-devoluciones

```
Quiero devolver algo. ¿Cómo hago un cambio? Me ha llegado roto. Ha llegado con un defecto. Está dañado. Quiero cancelar mi pedido. ¿Puedo cambiar mi pedido?

Un cliente particular tiene 14 días naturales desde que recibe el pedido para devolverlo sin coste de recogida. Pasados esos 14 días, todavía se admite la devolución o el cambio hasta un máximo de 30 días naturales desde la recepción, pero entonces se cobra la recogida: 11 € en la Península y 25 € en Baleares. Un cambio, además, paga el nuevo envío (4,99 € en la Península, 25 € en Baleares). Más allá de los 30 días ya no se aceptan devoluciones ni cambios.

La devolución gratuita es solo en la Península. En Baleares la recogida cuesta 25 € en todos los casos, también dentro de los primeros 14 días.

Los productos voluminosos (los que pasan de 0,45 x 0,40 x 0,70 m) tienen otro coste de recogida en la Península: 25 € IVA incluido hasta 0,46 x 1,19 x 0,79 m, y 50 € por bulto a partir de 0,47 x 1,2 x 0,80 m (el ancho de un palet europeo). En Baleares, el de un voluminoso se consulta con el equipo. Fuera de España, el transporte de la devolución lo paga entero el cliente.

En cualquier devolución, el importe del envío original (4,99 € o lo que se pagara de envío) no se reembolsa. Solo se admite una devolución por pedido.

Para que se acepte, el producto tiene que estar en perfectas condiciones y en su embalaje original. Si la recogida no se puede hacer al primer intento, los siguientes intentos los paga el cliente. Si prefiere mandarlo por su cuenta también puede, avisando antes al equipo.

Para tramitarla hay que rellenar el formulario de cambios y devoluciones de la web, indicando nombre, el correo con el que hizo el pedido, número de pedido, el motivo (con fotos si hace falta) y la dirección y el horario de recogida que prefiera:
https://www.cesteriaaparici.es/cambios-y-devoluciones

Cuándo se devuelve el dinero: el equipo revisa el caso, y una vez el producto llega al taller y se comprueba que está en buen estado, se hace el reembolso, descontando el envío original y, si se ha usado su agencia, el coste de la recogida. No hay un número de días fijo: no se le promete ninguno. Si pregunta por un reembolso que ya debería haberle llegado, se le pide el número de pedido y se pasa al equipo.

Garantía: los productos tienen la garantía legal que marca la ley para consumidores, que en España es de tres años desde la entrega. Si algo falla, se trata como un defecto (ver abajo).

Defectos o errores en el pedido: si el producto tiene un defecto de fabricación o se envió algo equivocado, la devolución o el cambio son gratuitos siempre que se avise en los 30 días siguientes a recibirlo.

No se consideran defectos, porque son propios de una pieza artesanal hecha con fibras naturales (conviene explicarlo con cariño, como algo que hace única la pieza, nunca como una excusa):
- las variaciones de color y de tono de la fibra;
- unos centímetros de diferencia con las medidas de la ficha;
- los remates y cierres a mano del trenzado, que forman parte de la técnica;
- los nudos, orificios y vetas de la madera.
Las piezas de madera natural sin tratamiento protector necesitan cuidado: los desperfectos que aparezcan después por la propia naturaleza del material no se cubren.

Si una pieza llega rota o con un defecto: se pide disculpas y, en ese mismo mensaje, se le pide una foto o un vídeo y el número de pedido (el que empieza por S), y se pasa al equipo para solucionarlo enseguida. Por ejemplo: «¡Vaya, cuánto lo siento! Mándanos una foto o un vídeo y el número de pedido, y lo solucionamos enseguida.» Si ahora el equipo no está (fuera del horario de atención, o en fin de semana), dile también cuándo lo verán: «El equipo lo verá el lunes a partir de las 9» o «mañana a partir de las 9». No se le promete una pieza nueva ni un reembolso concreto: eso lo decide una persona del equipo, que en estos casos suele ser generosa.

Para modificar o cancelar un pedido: si todavía no se ha empaquetado ni enviado, se puede cambiar sin problema. Se le pide el número de pedido y se pasa al equipo.
```

---

## 5. Productos que no admiten devolución

- **Categoría:** Devoluciones
- **URL de origen:** https://www.cesteriaaparici.es/cambios-y-devoluciones

```
Hay productos de Cestería Aparici que no se pueden devolver ni cambiar en ningún caso:

- Los productos hechos a medida por encargo, como los capazos personalizados o las alfombras a medida.
- La materia prima, como la rejilla y la pleita.
- Los productos con acabados especiales pedidos por el cliente (barnices, logotipos…).
- Los productos de OUTLET.
- Los productos de promociones con condiciones especiales, como Black Friday: cada promoción tiene las suyas.

Esto no afecta a los casos de defecto de fabricación, error en el envío o daño durante el transporte, que se resuelven igualmente.
```

---

## 6. Devoluciones para clientes profesionales

- **Categoría:** Devoluciones
- **URL de origen:** https://www.cesteriaaparici.es/cambios-y-devoluciones

```
Para clientes profesionales, es decir, compras B2B con cuenta PRO, no se aceptan cambios ni devoluciones por cambio de opinión.

Sí se resuelven los casos de defecto de fabricación, error en el envío o daño durante el transporte. Estas incidencias hay que notificarlas en las primeras 24 a 48 horas desde que se recibe la mercancía.

El plazo máximo para cualquier reclamación de este tipo es de 7 días naturales desde la recepción del pedido. En los daños de transporte, además, el daño tiene que quedar anotado en el albarán del transportista.

No se aceptan devoluciones por desistimiento (cambio de opinión, ya no lo necesita) una vez el pedido se ha procesado y enviado. Si excepcionalmente se aceptara una devolución que no es por un error de Cestería Aparici, el transporte de ida y vuelta y la gestión los paga el cliente profesional. Si la recogida falla al primer intento, a partir de ahí la devolución la hace el cliente con su propia agencia.

Los productos excluidos son los mismos que para particulares: personalizados, materia prima, acabados especiales y outlet.
```

---

## 7. Comprar como profesional (B2B)

- **Categoría:** Envíos
- **URL de origen:** https://www.cesteriaaparici.es/envios

```
¿Cuánto cuesta el envío para profesionales? ¿Qué portes tengo como tienda? ¿Enviáis a Baleares a profesionales? ¿Y a Europa?

Cestería Aparici vende también a profesionales: tiendas, hoteles, restaurantes, decoradores y empresas. Para ello hay que crear una cuenta PRO a través del formulario de profesionales de la web.

Las condiciones para profesionales son distintas a las de particulares:

El pedido mínimo es de 99 €.

Envío en la Península: gratis a partir de 170 € sin IVA. Por debajo de 170 €, los portes son 20 €.

Baleares: 35 € de portes siempre, sea cual sea el importe del pedido.

Canarias, Europa y los envíos voluminosos: el coste depende del volumen del pedido, así que no se da una cifra: se le prepara un presupuesto. Se recogen sus datos como en cualquier presupuesto (qué productos y cuántas unidades, dirección de entrega con código postal, email) y se pasa al equipo.
```

---

## 8. Qué fabrica y vende Aparici

- **Categoría:** Productos
- **URL de origen:** https://www.cesteriaaparici.es/shop

```
Cestería Aparici fabrica y vende piezas artesanales de fibras naturales. El catálogo se organiza en estas familias:

- Capazos: de playa, de mano, de bandolera, personalizados con iniciales o logotipo, y ediciones limitadas.
- Cestos: para ropa, redondos, rectangulares, con tapa, y cestas navideñas.
- Leñeros de esparto.
- Muebles: sillas, taburetes, sillones, bancos y mesas.
- Decoración: alfombras, maceteros, espejos y menaje.
- Iluminación: lámparas y apliques.
- Kids: productos infantiles.
- Materia prima, para quien quiera trabajar la fibra por su cuenta.

Además hacen proyectos y piezas a medida.
```

---

## 9. Las fibras: mimbre, ratán, bambú, esparto y palma

- **Categoría:** Productos
- **URL de origen:** https://www.cesteriaaparici.es/blog/cesteria-2/cuales-son-las-principales-diferencias-entre-mimbre-ratan-y-bambu-292

```
Cestería Aparici trabaja con fibras naturales distintas, y cada una sirve mejor para unas cosas.

El mimbre son brotes vegetales elegidos por su flexibilidad y resistencia. Es la fibra de toda la vida para cestas, mobiliario ligero y decoración de aire acogedor.

El ratán viene de una palma trepadora. Es más resistente y duradero que el mimbre, así que es el material adecuado cuando la pieza tiene que aguantar peso o hacer de estructura: muebles, respaldos y lámparas.

El bambú son tallos de la planta del mismo nombre. Combina rigidez con poco peso, y es la opción más ecológica de las tres porque la planta crece muy rápido.

Sobre el exterior, conviene ser claro: el mimbre, el ratán y el bambú naturales no están pensados para estar a la intemperie de forma permanente. Aguantan bien en porches, galerías o zonas cubiertas, pero la humedad y los cambios bruscos de temperatura los acaban castigando. El ratán sintético sí resiste mejor estar fuera.

Aparici trabaja también el esparto y la palma. El esparto es la fibra de los leñeros, alfombras y persianas. La palma trenzada a mano es la de los capazos.
```

---

## 10. Capazo Clásico o capazo Basic: cuál elegir

- **Categoría:** Productos
- **URL de origen:** https://www.cesteriaaparici.es/blog/cesteria-2/capazo-clasico-vs-capazo-basic-como-elegir-mi-proximo-capazo-de-palma-cesteria-aparici-279

```
¿Qué diferencia hay entre el capazo básico y el clásico? Me interesa el capazo básico. ¿Qué capazo me recomiendas? ¿Cuál es mejor?

Los capazos de palma de Aparici tienen dos versiones, Clásico y Basic, y la diferencia no es solo el precio.

El capazo Clásico lleva una selección de palma más minuciosa y asas de piel de más calidad, más finas y de tacto suave. En la boca lleva un doble bordón, un remate reforzado que le da firmeza, evita que el capazo vuelque y alarga bastante su vida útil. Es el que eligen las marcas de lujo cuando lo quieren como complemento de mujer. Hay tamaños desde 4 hasta 9 vueltas.

El capazo Basic usa una palma a propósito menos homogénea y asas más gruesas, lo que le da un aire más rústico y una sensación de robustez. El remate de arriba es simple. Está en los tamaños más habituales: 7, 8 y 9 vueltas. Es la opción más asequible, y sigue siendo un capazo auténtico y duradero.

Los dos modelos se hacen con asa corta de mano y con asa larga de bandolera.

En resumen: si se busca una pieza de vestir, con un acabado más fino y que dure muchos veranos, el Clásico. Si se busca un buen capazo de playa o de diario sin gastar de más, el Basic.

Al recomendar, se enseñan los dos, el Clásico primero; y si solo se recomienda uno, el Clásico. En la tienda el Clásico no lleva la palabra «Clásico» en el nombre. Las parejas son:

Con asa larga o de bandolera:
- Clásico: Capazo de palma con asas de cuero bandolera beige (también en marrón), del N°6 al N°9.
https://www.cesteriaaparici.es/shop/capazo-de-palma-con-asas-de-cuero-bandolera-beige-1217
- Basic: Capazo de palma Basic con asas de cuero largas, del N°7 al N°9.
https://www.cesteriaaparici.es/shop/capazo-de-palma-basic-con-asas-de-cuero-largas-4762

Con asa corta de mano:
- Clásico: Capazo de palma con asas cortas beige (también en marrón).
https://www.cesteriaaparici.es/shop/capazo-de-palma-con-asas-cortas-beige-1271
- Basic: Capazo de palma Basic con asa de mano.
https://www.cesteriaaparici.es/shop/capazo-de-palma-basic-con-asa-de-mano-4761
```

---

## 11. Son piezas hechas a mano: qué significa

- **Categoría:** Preguntas frecuentes
- **URL de origen:** https://www.cesteriaaparici.es/terms

```
Todas las piezas de Cestería Aparici están hechas a mano, una a una. Eso tiene una consecuencia práctica que conviene saber antes de comprar: pueden existir diferencias de tamaño de varios centímetros entre una unidad y otra del mismo modelo, y pequeñas variaciones en el tono de la fibra y en el trenzado.

No es un defecto ni un error: es lo que distingue una pieza artesanal de una industrial. Las medidas que aparecen en la ficha de cada producto son orientativas por ese motivo.
```

---

## 12. Proyectos y piezas a medida

- **Categoría:** Productos
- **URL de origen:** https://www.cesteriaaparici.es/proyectos-a-medida

```
Cestería Aparici hace proyectos a medida además de su catálogo. Los más habituales son capazos personalizados con iniciales o con la marca del cliente, persianas de esparto a medida, alfombras de fibras naturales, lámparas de diseño exclusivo y cestas de Navidad de empresa.

Trabajan para hoteles y alojamientos, restaurantes, marcas de moda y retail, arquitectos e interioristas, museos y empresas que buscan regalos corporativos. Han hecho proyectos para Meliá Hotels, el Grand Hotel Central de Barcelona, el Museo Dalí, el Thyssen-Bornemisza Art Contemporary, Mango, Oysho, Tiffany & Co., Eroski y RTVE.

¿Hacéis piezas a medida? ¿Me podéis personalizar un capazo con mi logo? Quiero algo personalizado. ¿Cuál es el pedido mínimo para algo a medida?

Antes de dar ningún pedido mínimo, primero se pregunta qué producto quiere (cesta, cajón, capazo, lámpara...) y cuántas unidades necesita. Por ejemplo: «¡Qué bien que hayas pensado en nosotros para algo hecho a tu medida! Para orientarte bien, ¿me cuentas qué producto tienes en mente y cuántas unidades necesitarías?»

Si quiere 50 unidades o más: para piezas a medida o personalizadas se trabaja normalmente a partir de 50 unidades, porque cada pieza se hace a mano desde cero. Se le da el formulario de su producto para que cuente todos los detalles, y en cuanto llega, el equipo lo revisa con calma y le contacta.

Si quiere menos de 50: se le dice con sinceridad que para tan pocas unidades normalmente no sale hacerlo a medida, porque cada pieza se hace a mano desde cero. Aun así, se le anima a rellenar el formulario con lo que busca: lo miran con detalle y, si hay manera, se lo dicen. Y si le encaja algo de lo que ya está hecho, se le ayuda a encontrarlo.

El formulario de cada producto es este:
- Capazos de palma personalizados: https://www.cesteriaaparici.es/capazos-personalizados
- Persianas: https://www.cesteriaaparici.es/shop/7123-persiana-de-esparto-a-medida-4471
- Alfombras: https://www.cesteriaaparici.es/shop/category/decoracion-alfombras-y-persianas-a-medida-26
- Lámparas: https://www.cesteriaaparici.es/lamparas-personalizadas
- Cestas de Navidad: https://www.cesteriaaparici.es/cestas-de-navidad-personalizadas
- Todo lo demás (cestas, cajones): https://www.cesteriaaparici.es/contactus

Los formularios son el camino preferido para todo lo que es a medida: así el cliente queda registrado y se puede seguir en contacto con él.

Asientos de enea de repuesto: NO se hacen a medida. Solo están en las medidas estándar de la web (https://www.cesteriaaparici.es/shop/asiento-de-enea-de-repuesto-1465). A quien pide un asiento con otras medidas o con otra forma se le dice así, con amabilidad, y se le enseñan las medidas que hay; no se le manda al formulario, no se le pide presupuesto ni email y no se pasa al equipo. Lo explica el documento «Asientos de enea de repuesto: solo en las medidas de la web».

Capazo con logo en pocas unidades: para personalizarlo hay que fabricar un cliché, que cuesta 220 €, así que con muy pocas unidades (por ejemplo, 5) no le sale a cuenta. Se le pregunta cuántas unidades necesita y qué tipo de asa le gusta, se le deja el formulario de capazos personalizados (https://www.cesteriaaparici.es/capazos-personalizados) y se revisa qué opción le encaja mejor.

Personalización en cuero: los colores son marrón oscuro, marrón claro, beige y negro, con grabado directo en la piel o bicolor. En qué productos se puede y cuánto cuesta depende de cada proyecto, que es único: se le dan los colores, se le pregunta qué producto y cuántas unidades, y se pasa a una persona del equipo.

Si el cliente quiere poner su propia tela: también depende de cada proyecto. No se le dice ni que sí ni que no; se le pregunta para qué producto y cuántas unidades, y se pasa al equipo.

Un producto personalizado no admite devolución ni cambio una vez hecho, porque se fabrica expresamente para ese cliente. Las condiciones de pago de un encargo (anticipos, porcentajes) no se dan por aquí: las pone la persona que hace el presupuesto.

Si prefiere hablar con la empresa directamente, el WhatsApp y teléfono de Cestería Aparici es el 633 67 81 92, el fijo el 96 236 03 33 y el correo gestion@cesteriaaparici.es. Es una alternativa que se le ofrece, nunca una forma de despacharle.
```

---

## 13. Horario de atención

- **Categoría:** La empresa
- **URL de origen:** *(confirmado por el cliente, 20/10/2026)*

```
¿Qué horario tenéis? ¿A qué hora abrís? ¿Cuándo me podéis llamar? ¿Trabajáis el sábado? ¿Cuándo me contestaréis?

El horario de atención de Cestería Aparici es:
- de lunes a miércoles, de 9:00 a 16:30;
- jueves y viernes, de 9:00 a 14:00.
Sábados, domingos y festivos no se atiende. En verano el horario cambia a 9:00-13:00.

Fuera de ese horario se puede escribir igualmente por aquí o al correo gestion@cesteriaaparici.es, y el equipo contesta en cuanto abre: lo que llega el fin de semana, el lunes.

La tienda online está disponible las 24 horas para hacer pedidos.
```

---

## 14. Formas de pago e IVA

- **Categoría:** Pagos
- **URL de origen:** *(confirmado por el cliente, 03/08/2026)*

```
En Cestería Aparici se puede pagar de cuatro formas: con tarjeta de crédito, por Bizum, con PayPal o por transferencia bancaria.

Sobre el IVA, depende de quién compra:

Si compras como particular, es decir, como persona física, los precios que ves en la tienda ya llevan el IVA incluido. Lo que aparece en la ficha del producto es lo que se paga.

Si compras como profesional, con una cuenta PRO, los precios de la tarifa profesional son sin IVA: el IVA se añade después, al hacer la factura.

Por WhatsApp nunca se piden datos de la tarjeta ni contraseñas. Para pagar, siempre por la web o con el enlace de pago que manda el equipo.
```

---

## 15. Cuidado y mantenimiento: dónde poner cada pieza

- **Categoría:** Productos
- **URL de origen:** *(indicaciones del cliente, 05/08/2026)*

```
¿Puedo dejar esto en el jardín? ¿Aguanta la lluvia? ¿Se puede poner fuera? ¿Cómo se limpia? ¿Hay que darle algo para que dure?

Las piezas de Cestería Aparici están hechas con fibras naturales y madera, así que no están pensadas para estar a la intemperie de forma permanente.

Sí se pueden usar en exterior, pero cubierto: un porche, una galería, una terraza techada o un rincón resguardado. Lo que hay que evitar es la lluvia directa y el sol constante, que es lo que reseca la fibra y descolora la madera.

Para las piezas que vayan a estar fuera, aunque sea bajo techo, se recomienda aplicar una capa de barniz protector. Alarga bastante su vida y protege del cambio de temperatura y de la humedad.

Para limpiarlas, un paño ligeramente húmedo y dejar secar al aire. Nada de sumergirlas en agua ni de usar productos agresivos.
```

---

## 16. Medidas de los capazos: qué significa cada número

- **Categoría:** Productos
- **URL de origen:** https://www.cesteriaaparici.es/tamanos-de-capazos

```
¿Qué medidas tiene el capazo? ¿Qué tamaños hay? ¿De qué tamaño es un N7? ¿Cuál es el más grande? ¿Cuánto mide? ¿Qué capazo me llevo a la playa? ¿Cuál es el tamaño normal?

El número del capazo no es una talla cualquiera: es el número de vueltas completas de palma trenzada que lo forman. Un N°7 lleva siete vueltas, y de ahí sale su tamaño.

Hay seis tamaños, que se agrupan en tres parejas:

- N°4 y N°5, los pequeños. Manejables y coquetos: como bolso de mano, como centro de mesa, como macetero o como elemento decorativo.
- N°6 y N°7, los medianos. El equilibrio: para el día a día, como cesta de la compra y como organizadores en estanterías y armarios.
- N°8 y N°9, los grandes. Máxima capacidad: días de playa y de campo, o almacenaje grande en casa.

Estas son sus medidas aproximadas, en ancho x fondo x alto:

- N°4 — 28 x 15 x 14 cm. El más pequeño. Cesta para flores, regalos gourmet, decoración.
- N°5 — 32 x 18 x 14 cm. Para los esenciales del día o como pieza decorativa en casa.
- N°6 — 38 x 20 x 22 cm. Bolso manejable donde cabe lo justo: los esenciales, un libro, lo de una tarde de paseo.
- N°7 — 42 x 23 x 25 cm. El equilibrio entre ligereza y capacidad, y el más conocido. El todoterreno para quien pasa muchas horas fuera de casa.
- N°8 — 45 x 25 x 27 cm. Formato grande: playa, piscina y la compra diaria. En casa, revistero, guarda-mantas o cesta de almacenaje.
- N°9 — 52 x 28 x 35 cm. El maxi. Para la playa con toallas, cremas y pareos, o para las compras más grandes.

Los seis se pueden personalizar: bordados, pintura, telas o parches. Para marcas y pedidos personalizados hay presupuesto a medida.

Estas medidas son siempre aproximadas, y conviene decirlo de entrada: cada capazo se trenza a mano y su tamaño depende de las vueltas de palma, así que es muy difícil encontrar dos exactamente iguales y puede haber unos centímetros de diferencia entre dos del mismo número. No es un fallo ni un descuido: es la diferencia entre una pieza hecha a mano y una fabricada en serie, y es lo que hace que cada capazo sea único, en forma y en medida. Se cuenta como lo que es, algo bueno, no como una pega ni pidiendo disculpas. Vale igual cuando un cliente dice que su capazo no mide lo que pone en la web.

La guía de tamaños completa está aquí:
https://www.cesteriaaparici.es/tamanos-de-capazos

Las medidas de cada producto concreto están en su ficha de la web.

Si el cliente dice que su capazo es de esparto, y no de palma, en realidad habla de un leñero: los capazos son de palma y los leñeros de esparto. Cada leñero tiene su medida, así que se le pregunta cuál es exactamente (el nombre o el enlace), y se le pasa la lista para que lo encuentre:
https://www.cesteriaaparici.es/shop/category/leneros-96
Con el modelo claro, se le dan las medidas de su ficha. Si no están, se pasa a una persona.
```

---

## 17. Dónde ver el estado de un pedido y el seguimiento del envío

- **Categoría:** Envíos
- **URL de origen:** https://cesteriaaparici.es/my/orders

```
¿Dónde está mi pedido? ¿Cuándo me llega? ¿Lo habéis enviado ya? ¿Me pasáis el número de seguimiento? Quiero saber cómo va mi pedido. ¿Ha salido ya del taller?

El estado de cada pedido se consulta en el área de cliente de la web. Entrando con los datos de acceso de la cuenta con la que se hizo la compra, en el apartado "Mis pedidos" aparece cada pedido y en qué punto está: pendiente, en preparación, enviado.

El enlace directo es este:
https://cesteriaaparici.es/my/orders

Si lo que quiere saber es por dónde va el paquete una vez ha salido, esos datos están en el correo que se envía al expedir el pedido: ahí van el enlace de seguimiento y los datos del transportista. Si no lo encuentra, conviene que mire también la carpeta de spam.

Si aun así no lo resuelve, o si el pedido lleva más tiempo del previsto, entonces sí hay que pasar la conversación a una persona del equipo.

Si hay un problema con la agencia de transporte (no le ha llegado, ha llegado mal, la agencia no da señales), se le pide disculpas, se le pide el número de pedido —el que empieza por S— y se le tranquiliza: el equipo lo revisa con la agencia y se encarga de todo, incluida la reclamación. Se pasa a una persona en ese mismo mensaje.

Si ha pagado pero no le ha llegado la confirmación del pedido: que no se preocupe, se le pide el número de pedido y se pasa al equipo para comprobarlo.
```

---

## 18. Si venden en Amazon o en otras plataformas

- **Categoría:** Preguntas frecuentes
- **URL de origen:** https://cesteriaaparici.es

```
¿Vendéis en Amazon? ¿Estáis en Amazon? ¿Se os puede comprar en otro sitio? ¿Tenéis tienda en algún marketplace?

Sí, algunos productos de Cestería Aparici están también a la venta en Amazon.

La tienda propia, cesteriaaparici.es, es donde está el catálogo completo y donde se compra directamente al taller.
```

---

## 19. Qué pieza es la de cada uso

- **Categoría:** Productos
- **URL de origen:** https://www.cesteriaaparici.es/shop

```
Busco algo para la leña. Quiero un cesto para la ropa. ¿Qué me llevo a la playa? Algo para la compra. Para guardar mantas. Para las plantas. Para poner flores. Algo para la entrada de casa.

La gente llama "cesto" o "cesta" a casi todo, y cada uso tiene su pieza con su nombre propio. Esta es la correspondencia:

- Para la leña, junto a la chimenea: los leñeros de esparto. Los hay redondos, ovalados, con una o dos asas, con asa transversal y forrados de arpillera o yute. Para leña, los ovalados (o rectangulares) son los más prácticos, porque los troncos son alargados y caben mejor; aun así, es cuestión de gusto. Al recomendar, enséñale uno ovalado y uno redondo, para que elija.
- Para la playa: los capazos de palma. Los tamaños que se llevan a la playa son el N°7, el N°8 y el N°9; el N°8 es el familiar y el N°9 el más grande.
- Para la compra o el mercado: capazos del N°6 al N°9, según lo que se quiera cargar.
- Como bolso de mano o de diario: capazos N°4, N°5 y N°6, y los bolsos de palma y de fibras naturales.
- Para la ropa: cestos con tapa y cestos grandes de fibra.
- Para mantas, revistas o almacenaje en el salón: cestos grandes, capazos N°8 y N°9, y el baúl.
- Para plantas y flores: maceteros de esparto, de pared o colgantes, y cestos redondos.
- Para servir o presentar en la mesa: bandejas de palma y de seagrass, y el menaje natural.
- Para regalo gourmet o de Navidad: las cestas de Navidad, que las hay de uno, dos y tres pisos.

Si lo que busca no encaja en ninguna de estas, o quiere una medida que no existe, se puede hacer a medida.

Cada familia tiene su página en la tienda, con todos sus productos. Sirven cuando no tienes delante productos concretos de lo que busca, o cuando quiere ver más:
- Leñeros: https://www.cesteriaaparici.es/shop/category/leneros-96
- Capazos: https://www.cesteriaaparici.es/shop/category/capazos-todos-los-capazos-76
- Cestos para la ropa: https://www.cesteriaaparici.es/shop/category/cestos-para-ropa-102
- Todos los cestos: https://www.cesteriaaparici.es/shop/category/cestos-todos-los-cestos-57
- Bandejas: https://www.cesteriaaparici.es/shop/category/cestos-bandejas-100
- Cestas de Navidad: https://www.cesteriaaparici.es/shop/category/cestos-cestas-de-navidad-11
- Alfombras: https://www.cesteriaaparici.es/shop/category/decoracion-alfombras-23
- Maceteros: https://www.cesteriaaparici.es/shop/category/decoracion-maceteros-fibras-vegetales-25
- Espejos: https://www.cesteriaaparici.es/shop/category/decoracion-espejos-de-fibras-naturales-31
- Menaje: https://www.cesteriaaparici.es/shop/category/decoracion-menaje-natural-32
- Garrafas: https://www.cesteriaaparici.es/shop/category/decoracion-garrafas-95
- Salvamanteles: https://www.cesteriaaparici.es/shop/category/decoracion-salvamanteles-106
- Lámparas: https://www.cesteriaaparici.es/shop/category/iluminacion-65
- Sillas: https://www.cesteriaaparici.es/shop/category/muebles-sillas-13
- Taburetes: https://www.cesteriaaparici.es/shop/category/muebles-taburetes-15
- Sillones: https://www.cesteriaaparici.es/shop/category/muebles-sillones-17
- Mesas: https://www.cesteriaaparici.es/shop/category/muebles-mesas-88
- Kids (moisés, sillas y muebles infantiles): https://www.cesteriaaparici.es/shop/category/kids-7
- Materia prima (rejilla, pleita, enea…): https://www.cesteriaaparici.es/shop/category/materia-prima-60
```

---

## 20. Cupones de descuento: cómo se aplican y qué hacer si no funcionan

- **Categoría:** Pagos
- **URL de origen:** https://cesteriaaparici.es/web/login

```
No puedo aplicar el cupón. El código de descuento no funciona. Me da error el cupón. ¿Cómo uso el código de descuento? ¿Dónde pongo el cupón? No me hace el descuento.

Para que un cupón de descuento se aplique hay que haber iniciado sesión en la tienda antes de usarlo. Si se intenta sin haber entrado con la cuenta, el cupón no se aplica. Es lo primero que hay que comprobar.

Se inicia sesión aquí:
https://cesteriaaparici.es/web/login

En esa primera respuesta todavía NO se pasa la conversación al equipo: casi siempre se resuelve iniciando sesión, y avisar al taller por cada cupón sería llenarles de avisos que no hacen falta. Se le explica lo de iniciar sesión y se le dice que, si ya lo había hecho o sigue sin funcionar, mande por aquí una captura de pantalla del error.

En cuanto vuelva diciendo que ya había iniciado sesión o que sigue sin funcionar, se pasa al equipo en ese mismo mensaje, sin esperar a la captura: se le dice que se lo pasas al taller, que alguien lo revisará y se pondrá en contacto con él lo antes posible, y se le pide que mande la captura por aquí para que la tengan delante. Esperar a la captura antes de avisar a nadie deja tirado a quien no sabe hacerla.

Los códigos de descuento son solo para particulares registrados en la web.

Si no le ha llegado el código: que mire la carpeta de spam o la de promociones, porque a veces se cuela ahí. Si no aparece, que lo diga y se mira.

Si ya ha comprado sin usar el código: una vez confirmado el pedido ya no se puede aplicar. Pero no lo pierde: se le guarda para su próxima compra.

El descuento por cantidad no necesita código: se aplica solo en cuanto pone en el carrito las unidades que quiere, y lo ve reflejado ahí mismo.

Para quien no tiene cupón todavía: suscribiéndose a la newsletter de la web se consigue un 15% de descuento en la primera compra.
```

---

## 21. Club Artesano PRO: qué ventajas y qué descuentos tiene un profesional

- **Categoría:** La empresa
- **URL de origen:** https://www.cesteriaaparici.es/formulario-b2b

```
Tengo una tienda, ¿me hacéis descuento? Soy profesional, ¿tenéis precios especiales? ¿Qué descuento hacéis a empresas? ¿Tenéis tarifa para profesionales? Quiero comprar para mi negocio. ¿Cómo me doy de alta como profesional? ¿Qué es la cuenta PRO? ¿Qué ventajas tiene ser cliente profesional?

Cestería Aparici tiene un programa para clientes profesionales llamado Club Artesano PRO. No es solo un descuento: es una forma distinta de trabajar con la marca, con un equipo Business que acompaña el proyecto de principio a fin.

Las ventajas del Club Artesano PRO son estas:

Tarifa exclusiva. Grandes descuentos sobre el PVP, de hasta el 50%. Es un HASTA: el descuento que le corresponde a cada cliente depende del producto, de la cantidad y de las condiciones que se acuerden, así que nunca se promete un 50% ni ningún otro porcentaje concreto. Quien lo fija es el equipo Business, con un presupuesto personalizado. Además hay ofertas y promociones reservadas a profesionales.

Atención prioritaria. Contacto directo con el equipo Business, asesoramiento en tiempo real, compromiso de respuesta en menos de 24 horas y acompañamiento durante todo el proyecto.

Logística adaptada. Entrega a pie de calle o premium en la estancia que se elija, envíos express en una selección de productos con seguimiento en tiempo real, y posibilidad de entrega única y montaje.

Diseños exclusivos. Posibilidad de fabricar productos a medida y de crear una colección propia para la marca del cliente.

Visibilidad para su marca. Presencia en la web de Aparici y difusión del proyecto en sus redes sociales, sujeto a aprobación.

Un proyecto con valores. Producto sostenible, hecho a mano, que contribuye a mantener viva la cultura artesanal.

Para darse de alta como profesional se rellena el formulario de la web, y el equipo Business se pone en contacto:
https://www.cesteriaaparici.es/formulario-b2b

Quien se registra recibe además un cupón del 5% adicional en su correo electrónico. Es el gancho para darse de alta: no es un descuento que el cliente ya tenga, es un cupón que le llega al correo después de registrarse. Por eso la forma de cerrar cualquier conversación con un profesional es siempre esta, con el enlace debajo: «Regístrate ahora y obtén en tu correo electrónico un cupón del 5% adicional».

El pedido mínimo para clientes profesionales es de 99 €. En la Península el envío es gratis a partir de 170 € sin IVA, y por debajo cuesta 20 €. A Baleares, 35 € siempre. Canarias, Europa y los envíos voluminosos dependen del volumen: se les prepara presupuesto.
```

---

## 22. A qué negocios vende Aparici y compras al por mayor

- **Categoría:** La empresa
- **URL de origen:** https://www.cesteriaaparici.es/formulario-b2b

```
¿Vendéis al por mayor? ¿Trabajáis con hoteles? Soy interiorista. Tengo un restaurante. ¿Servís a tiendas? Quiero comprar capazos al por mayor. ¿Hacéis pedidos grandes para eventos? ¿Vendéis a empresas?

Cestería Aparici trabaja habitualmente con clientes profesionales de muchos sectores. Entre ellos:

Arquitectura e interiorismo. Hoteles y alojamientos. Hostelería y restauración. Comercios y tiendas. Oficinas y despachos. Eventos. Educación. Distribuidores gourmet y de regalo. Moda.

También se sirve al por mayor el catálogo habitual: capazos, cestas y bandejas de mimbre, entre otros productos.

Todo esto se canaliza a través de la cuenta profesional, que se solicita en el formulario de profesionales de la web. La forma de cerrar cualquier conversación con un profesional es siempre esta, con el enlace debajo:

Regístrate ahora y obtén en tu correo electrónico un cupón del 5% adicional:
https://www.cesteriaaparici.es/formulario-b2b

Para el catálogo, el pedido mínimo profesional es de 99 €. Para productos personalizados o hechos a medida se trabaja normalmente a partir de 50 unidades, pero antes de dar esa cifra se pregunta qué producto quiere y cuántas unidades.

Plazos en pedidos grandes: dependen de los productos y de las cantidades, así que no se da ninguno de memoria. Se le explica que, si se da de alta como profesional, el equipo le prepara un presupuesto personalizado con los plazos y le responde en menos de 24 horas. Si ya está registrado, se recogen sus datos como en cualquier presupuesto y se pasa a una persona.
```

---

## 23. Persianas, esteras, cortinas y alfombras de esparto

- **Categoría:** Productos
- **URL de origen:** *(guía del bot del cliente, 01/10/2026)*

```
¿Qué medidas tienen las persianas? ¿Hacéis persianas a medida? ¿Cuánto cuesta una persiana de esparto? ¿Cómo se cuelga? ¿Qué ancho máximo puede tener? El color no es como en la foto. ¿Qué terminaciones o acabados tienen las persianas? ¿Qué calidades hay? ¿Hay varios tipos de persiana?

Las persianas de esparto se hacen totalmente a medida. Para preparar el presupuesto hacen falta el ancho y el largo, la dirección de envío con el código postal y un email. Por ejemplo: «¡Gracias por pensar en nosotros para tus persianas! Las hacemos totalmente a medida. Si me pasas el ancho y el largo, la dirección de envío y un email, te preparamos el presupuesto encantados.»

Ancho máximo: se recomienda que no pase de 2 metros, porque el esparto pesa y al mecanismo le cuesta. Si la ventana es más ancha, lo mejor es dividirla en dos persianas: queda igual de bonita y dura más.

Cómo se cuelga: es muy sencillo, se le pueden poner ganchos o atornillar directamente el listón de madera. Si al montarla le surge cualquier duda, que escriba y se le echa una mano.

El color no es como en la web: el esparto es una fibra natural, así que cada pieza tiene su propio tono y, con el tiempo y sobre todo con el sol, va cambiando. Es parte de su encanto: no hay dos iguales.

Calidad y acabado: hay uno solo. Todas las persianas se hacen con el mismo estándar de calidad y el mismo acabado, en pleita de unos 7 cm de ancho y 0,6 cm de grosor, así que el cliente no tiene que elegir entre acabados, calidades ni terminaciones: solo da las medidas. Si pide algo distinto (otro acabado, otro color, un remate especial), no se le dice que se puede: se pasa a una persona del equipo.

Las persianas y las alfombras se fabrican en 4 a 6 semanas, más el envío.
```

---

## 24. Productos agotados, reposiciones y reservas

- **Categoría:** Productos
- **URL de origen:** *(guía del bot del cliente, 01/10/2026)*

```
¿Volveréis a tener este producto? ¿Cuándo repondréis? Está agotado, ¿cuándo vuelve? Quedan pocas, ¿me lo guardáis? ¿Me podéis reservar uno?

Si pregunta si volverá a haber un producto agotado, eso no se sabe desde aquí: se le dice que se consulta con el equipo y que se le dice algo en cuanto se sepa, y se pasa a una persona.

Reservas: no se puede reservar stock por adelantado. La única manera es hacer el pedido: en cuanto se recibe el pago, la pieza queda reservada para él y, si no quedara, se empieza a hacer. Si responde que sí lo quiere, se pasa a una persona.
```

---

## 25. Problemas al pagar en la web

- **Categoría:** Pagos
- **URL de origen:** *(guía del bot del cliente, 01/10/2026)*

```
No me deja pagar. Me da error al pagar. No funciona el pago. He pagado y no me ha llegado la confirmación. No puedo terminar la compra.

Si no le deja pagar: se le pide disculpas y se le dice que lo solucionamos. Primero, que pruebe desde otro navegador o reduciendo el zoom de la página. Si sigue sin ir, también puede pagar por transferencia. Y si pasa el número de pedido, el equipo lo revisa también.

Si ha pagado pero no tiene confirmación: que no se preocupe. Se le pide el número de pedido y se pasa al equipo para comprobarlo.

Por WhatsApp nunca se piden datos de la tarjeta ni contraseñas.
```

---

## 26. Plazos de fabricación de lo que se hace por encargo

- **Categoría:** Productos
- **URL de origen:** *(guía del bot del cliente, 01/10/2026)*

```
¿Cuánto tardáis en hacerlo? ¿Cuánto tarda un pedido a medida? ¿Para cuándo lo tendría? ¿Cuánto se tarda en fabricar?

Cada pieza se hace a mano desde cero, así que el plazo depende del producto. A ese plazo hay que sumarle de 2 a 5 días laborables de envío.

- Capazos personalizados: de 6 a 8 semanas.
- Persianas y alfombras: de 4 a 6 semanas.
- Muebles a medida: hasta 5 meses.

El resto de productos de la tienda (lámparas, cestas de Navidad, cestas, cajones, asientos…) no se fabrican por encargo: se venden hechos, así que no tienen plazo de fabricación. Si lo que quiere está disponible, sale con los plazos normales de envío. Si está agotado, o si quiere una pieza de esas personalizada o a medida, cada proyecto es distinto: se pasa a una persona del equipo. Salvo los asientos de enea de repuesto, que no se hacen a medida: solo las medidas de la web.

Si no ha dicho qué producto le interesa, primero se le pregunta. Las unidades no hacen falta para darle el plazo de esta lista.
```

---

## 27. Tienda física y recoger un pedido

- **Categoría:** La empresa
- **URL de origen:** *(guía del bot del cliente, 01/10/2026)*

```
¿Tenéis tienda física? ¿Puedo ir a veros? ¿Dónde estáis? ¿Puedo pasar a recogerlo? ¿Se puede visitar el taller?

Cestería Aparici es una tienda online: no tiene tienda abierta al público.

Si ya ha hecho y pagado su pedido y le viene mejor, puede pasar a recogerlo por el almacén. Se le dice que lo coordinamos con él y se pasa a una persona del equipo, que es quien le da la dirección y el horario. El bot no da ni la dirección ni el horario de recogida.
```

---

## 28. Profesionales ya registrados, errores al darse de alta y alquiler

- **Categoría:** La empresa
- **URL de origen:** *(guía del bot del cliente, 01/10/2026)*

```
Ya soy cliente PRO, ¿qué precio tengo? ¿Qué descuento tengo yo? Ya estoy registrado como profesional. No me deja darme de alta como profesional. Me da error el formulario de alta.

Si YA está registrado como profesional y pregunta por sus precios o su descuento: si al iniciar sesión en la web ve «ApariciPRO» arriba a la izquierda, los precios que ve ya llevan su descuento de profesional. El pedido mínimo es de 99 € y en la Península el envío es gratis a partir de 170 € sin IVA. No se le repite el discurso de las ventajas, que ya lo tiene. Si con eso no le basta y quiere un presupuesto, se recogen sus datos como en cualquier presupuesto y se pasa a una persona.

Si al darse de alta le da error: que revise el código postal y que elija la provincia en el desplegable, que suele ser eso. Si aun así no le deja, se le da de alta desde el equipo: para eso hacen falta su email, la dirección con código postal, los datos fiscales y si está en régimen general o en recargo de equivalencia. Se le piden y se pasa a una persona.
```

---

## 29. Alquiler de piezas para bodas y eventos

- **Categoría:** Preguntas frecuentes
- **URL de origen:** *(guía del bot del cliente, 01/10/2026)*

```
¿Alquiláis capazos para una boda? ¿Alquiláis piezas para un evento? ¿Se pueden alquilar cestas? Es para decorar una boda, ¿las alquiláis?

No se alquilan piezas. Pero quien organiza bodas o eventos puede comprar como profesional, y entonces tiene acceso a tarifas especiales y además a un descuento en su primer pedido. Se le ofrece ayudarle a darse de alta. Por ejemplo: «¡Qué ilusión que pienses en nosotros para un evento así! No alquilamos piezas, pero como profesional tienes acceso a tarifas especiales y, además, descuento en tu primer pedido. Si quieres, te ayudo a darte de alta.»

Si es un particular que celebra su propia boda, se le dice igual que no se alquilan y se le ayuda a elegir entre lo que hay en la tienda.
```

---

## 30. Rejilla: se vende por metros

- **Categoría:** Productos
- **URL de origen:** https://www.cesteriaaparici.es/shop/rejilla-clasica-natural-1528

Lo de la cantidad y el rollo de 15 m lo contestó el equipo a un cliente el
08/10/2026; la ficha solo dice «se vende por metros lineales».

```
¿Cuánto mide de largo la rejilla? Aparece el ancho pero no veo el largo. ¿Cómo se vende la rejilla? ¿Cuántos metros son? ¿Qué es la talla de la rejilla? ¿Vendéis el rollo entero? Quiero rejilla para una silla o un mueble.

La rejilla se vende por metros lineales. Vale para las cuatro de la tienda: Rejilla tupida natural, Rejilla clásica natural, Rejilla de ratán clásica natural Premium y Rejilla cuadradillo natural Premium.

En la ficha se elige el ancho, que aparece como «Talla» (de 36 cm a 90 cm), y la cantidad son los metros de largo: 1 unidad es 1 metro del ancho elegido; 3 unidades, 3 metros. El precio que marca la ficha es el de un metro del ancho elegido.

El rollo completo son 15 metros. Si pide varios metros, pueden llegarle en una sola pieza seguida o en trozos, según el stock que haya en ese momento: si lo necesita de una pieza, se pasa al equipo para que lo confirme.

A los profesionales se les puede hacer descuento por el rollo entero: se le propone darse de alta como profesional o, si ya lo es, se recogen sus datos como en cualquier presupuesto y se pasa al equipo.

Por eso en la ficha sale el ancho y no el largo: el largo lo pone el cliente con la cantidad.
```

---

## 31. Asientos de enea de repuesto: solo en las medidas de la web

- **Categoría:** Productos
- **URL de origen:** https://www.cesteriaaparici.es/shop/asiento-de-enea-de-repuesto-1465

Lo pidió Cestería el 26/10/2026, después de que el bot prometiera asientos a
medida a dos clientas (21/10 y 25/10) y Ángela tuviera que desdecirle. Antes
decía que con más de 100 unidades sí se hacían a medida; ahora no se ofrece.

```
¿Hacéis asientos de enea a medida? Necesito un asiento de enea con estas medidas. Mi silla tiene el hueco trapezoidal. ¿Me podéis hacer el asiento de mi silla? Necesito un asiento de 31 x 35 cm. ¿Tenéis asientos de enea de recambio? ¿Qué medidas tienen los asientos de enea? Presupuesto para asientos de enea a medida. Asiento de anea, asiento de enea para silla, recambio de asiento, asiento de repuesto.

Los asientos de enea de repuesto NO se hacen a medida: solo están en las medidas estándar de la web, que son cuadradas. Ahora mismo hay cuatro: 28 x 28 cm, 30 x 30 cm, 35 x 35 cm y 37 x 37 cm. El precio y el stock de cada una son los de la ficha: https://www.cesteriaaparici.es/shop/asiento-de-enea-de-repuesto-1465

Si pide un asiento con otras medidas o con otra forma (trapezoidal, en L, con esquinas recortadas...), se le dice con amabilidad y sin rodeos que no se hacen a medida, y se le enseñan las medidas que hay por si alguna le encaja con su silla. Por ejemplo: «Te lo digo con sinceridad: los asientos de enea no los hacemos a medida, solo los tenemos en las medidas estándar de la web, que son cuadrados: 28 x 28, 30 x 30, 35 x 35 y 37 x 37 cm. Si alguna te encaja con tu silla, aquí los tienes: https://www.cesteriaaparici.es/shop/asiento-de-enea-de-repuesto-1465»

No se le manda al formulario de contacto, no se le pide email ni dirección para un presupuesto y no se pasa al equipo: no hay nada que presupuestar. Tampoco se le dice que «se puede mirar», que «depende de las unidades» o que «igual podemos hacer algo».

Si pregunta cuál le va mejor a su silla, se le dan las cuatro medidas para que las compare con su hueco; no se le asegura que una le vaya a encajar, porque eso solo lo puede ver él con su silla delante.
```

---

# Pendiente de confirmar con el cliente

**Casi todo resuelto el 20/10/2026**, con el Word «Lo que sabe el asistente» que
Cestería devolvió respondido (`docs/Cesteria-Aparici-lo-que-sabe-el-asistente.docx`).
Lo que contestaron y dónde está ahora:

| Tema | Respuesta | Dónde |
|---|---|---|
| Correo de presupuestos | comunicacion@ | `email_presupuestos` |
| Horario | L-X 9:00-16:30, J-V 9:00-14:00 (el de 9-13 era el de verano) | doc. 13 y prompt |
| Respuesta fuera de horario | sí: «el lunes» si es fin de semana | prompt |
| Plazos del resto de productos | no se hacen por encargo | doc. 26 |
| Cuero y tela propia | cada proyecto es único: a una persona | doc. 12 |
| Portes de profesionales | < 170 € sin IVA: 20 €; Baleares 35 € siempre; Canarias, Europa y voluminosos según volumen | docs. 7 y 21 |
| Correo de contacto | gestion@, correcto | doc. 2 |
| Plazo de reembolso | «está en la página de devoluciones», que no da días: se dice cómo funciona, sin plazo | doc. 4 |
| Garantía | lo mínimo que marque la ley (3 años) | doc. 4 |
| Año de fundación | 1950 | doc. 1 |
| Rejilla | seguida o en trozos según stock; descuento por rollo a profesionales | doc. 30 |
| Qué recomendar | leñeros: ovalado o rectangular cabe mejor la leña, pero a gusto, enseñar uno de cada; el resto, indiferente, «lo ideal lo que haya en stock» | doc. 19 y prompt |

Lo del stock tenía arreglo aunque ellos pensaban que no: Odoo da el precio y las
existencias de cada tamaño, y desde el 20/10 la ingesta los lee
(`n8n/workflows/README.md`, «Ingesta de catálogo»).

Queda esto:

1. **Cuándo empieza y acaba el horario de verano** (9:00-13:00). Sabemos que
   existe, no las fechas.

2. **El blog viejo contradice a la guía nueva en dos medidas.** El documento 16
   toma las medidas de `cesteriaaparici.es/tamanos-de-capazos` (la guía de
   2026, la oficial), pero el post del blog de 2025 sigue publicado: N°5
   32 x 8 x 17 (son 32 x 18 x 14) y N°9 55 de ancho (son 52). Conviene que lo
   borren o lo actualicen.

3. **El texto del botón de WhatsApp de la web** dice «Hola, quiero hablar
   contigo». El prompt ya sabe que no es pedir una persona, pero un texto neutro
   en Odoo («Hola, tengo una consulta») lo evita del todo.

4. **Su página de devoluciones tiene un hueco sin rellenar**: «se acepta como
   norma un margen de ± [X] cm (especificado en cada ficha de producto)». El bot
   no da ninguna cifra de margen; conviene que pongan la suya.

5. **Espejo de teca Savina Grande**: el resumen de la ficha dice «madera de
   teca» y el texto, «elaborado con rattan».

6. **21 fichas siguen sin descripción** (anexo del Word): de esas solo se sabe el
   nombre, el precio y, ahora, los tamaños y el stock.
