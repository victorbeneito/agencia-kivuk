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

La dirección es: Polígono Industrial Serrans IV, Carrer del plástic 3, nave 3C, 46812 Aielo de Malferit (Valencia, España). Allí está el taller y el almacén, y también se puede recoger un pedido en persona si se ha acordado antes.
```

---

## 3. Envíos para particulares — coste, plazos y zonas

- **Categoría:** Envíos
- **URL de origen:** https://www.cesteriaaparici.es/envios

```
Los envíos de Cestería Aparici para clientes particulares cuestan 4,99 € en la Península. El envío es gratuito a partir de 80 € de compra.

A Baleares el envío cuesta 25 €. A Canarias hay que consultar condiciones y tarifas antes de comprar, porque el precio varía. A Ceuta y Melilla no se realizan entregas.

Los plazos dependen del tamaño del paquete:

Los paquetes pequeños, de hasta 10 kg y con medidas de hasta 70x45x40 cm, se entregan en 24 a 48 horas en días laborables. Los lleva CTT Express.

Los paquetes grandes, de más de 10 kg o que superen esas medidas, tardan entre 3 y 14 días laborables en la Península. Los lleva CBL Logística. A Baleares van con Trasmediterránea o Rhenus.

Cuando el pedido sale, se envía un correo electrónico con el seguimiento para poder consultar dónde está.

También se puede recoger el pedido en el almacén de Aielo de Malferit (Valencia).
```

---

## 4. Devoluciones y cambios para particulares

- **Categoría:** Devoluciones
- **URL de origen:** https://www.cesteriaaparici.es/cambios-y-devoluciones

```
Un cliente particular tiene 14 días naturales desde que recibe el pedido para devolverlo sin coste de recogida. Pasados esos 14 días, todavía se admite la devolución hasta un máximo de 30 días naturales desde la recepción, pero entonces el cliente asume 11 € de transporte si es Península o 25 € si es Baleares. Más allá de los 30 días ya no se aceptan devoluciones.

En Baleares el coste de recogida es de 25 € en todos los casos, también dentro de los primeros 14 días.

En cualquier devolución, el importe del envío original de 4,99 € no se reembolsa.

Para que se acepte, el producto tiene que estar en perfectas condiciones y en su embalaje original.

Para tramitarla hay que rellenar el formulario de devoluciones de la web indicando nombre, correo electrónico, número de pedido, una descripción del problema y la dirección donde hay que recoger el paquete.

Una vez el producto llega a las instalaciones y se comprueba su estado, se hace el reembolso descontando los gastos que correspondan.
```

---

## 5. Productos que no admiten devolución

- **Categoría:** Devoluciones
- **URL de origen:** https://www.cesteriaaparici.es/cambios-y-devoluciones

```
Hay productos de Cestería Aparici que no se pueden devolver ni cambiar en ningún caso:

- Los productos personalizados, es decir, cualquier pieza hecha a medida o con iniciales, logotipo o acabado propio del cliente.
- La materia prima.
- Los productos con acabados especiales.
- Los productos de OUTLET.
- Los productos comprados en promociones como Black Friday.

Esto no afecta a los casos de defecto de fabricación, error en el envío o daño durante el transporte, que se resuelven igualmente.
```

---

## 6. Devoluciones para clientes profesionales

- **Categoría:** Devoluciones
- **URL de origen:** https://www.cesteriaaparici.es/cambios-y-devoluciones

```
Para clientes profesionales, es decir, compras B2B con cuenta PRO, no se aceptan cambios ni devoluciones por cambio de opinión.

Sí se resuelven los casos de defecto de fabricación, error en el envío o daño durante el transporte. Estas incidencias hay que notificarlas en las primeras 24 a 48 horas desde que se recibe la mercancía.

El plazo máximo para cualquier reclamación de este tipo es de 7 días naturales desde la recepción del pedido.

Los productos excluidos son los mismos que para particulares: personalizados, materia prima, acabados especiales y outlet.
```

---

## 7. Comprar como profesional (B2B)

- **Categoría:** Envíos
- **URL de origen:** https://www.cesteriaaparici.es/envios

```
Cestería Aparici vende también a profesionales: tiendas, hoteles, restaurantes, decoradores y empresas. Para ello hay que crear una cuenta PRO a través del formulario de profesionales de la web.

Las condiciones para profesionales son distintas a las de particulares:

El pedido mínimo es de 99 €.

Los gastos de gestión y portes son de 20 €, y el envío es gratuito a partir de 170 € en la Península. A Baleares el envío cuesta 35 €.

Si se prefiere recoger el pedido en el almacén de Aielo de Malferit, hay 10 € de gastos de gestión, que también son gratuitos a partir de 170 €.
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
Los capazos de palma de Aparici tienen dos versiones, Clásico y Basic, y la diferencia no es solo el precio.

El capazo Clásico lleva una selección de palma más minuciosa y asas de piel de más calidad, más finas y de tacto suave. En la boca lleva un doble bordón, un remate reforzado que le da firmeza, evita que el capazo vuelque y alarga bastante su vida útil. Es el que eligen las marcas de lujo cuando lo quieren como complemento de mujer. Hay tamaños desde 4 hasta 9 vueltas.

El capazo Basic usa una palma a propósito menos homogénea y asas más gruesas, lo que le da un aire más rústico y una sensación de robustez. El remate de arriba es simple. Está en los tamaños más habituales: 7, 8 y 9 vueltas. Es la opción más asequible, y sigue siendo un capazo auténtico y duradero.

Los dos modelos se hacen con asa corta de mano y con asa larga de bandolera.

En resumen: si se busca una pieza de vestir, con un acabado más fino y que dure muchos veranos, el Clásico. Si se busca un buen capazo de playa o de diario sin gastar de más, el Basic.
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

Para pedir un proyecto a medida hay que contactar directamente con la empresa, por teléfono en el 96 236 03 33 o el 633 67 81 92, o por correo a gestion@cesteriaaparici.es. Los profesionales pueden hacerlo también creando su cuenta PRO en la web.

Sobre cómo funciona un encargo a medida: el presupuesto que se entrega tiene una validez de 30 días. Para empezar a fabricar se pide un anticipo de entre el 50 % y el 80 % del importe, que no es reembolsable, porque la pieza se fabrica expresamente para ese cliente. Por el mismo motivo, un producto personalizado no admite devolución ni cambio una vez hecho.
```

---

## 13. Horario de atención

- **Categoría:** La empresa
- **URL de origen:** *(confirmado por el cliente, 03/08/2026)*

```
El horario de atención de Cestería Aparici es de 9:00 a 13:00.

Fuera de ese horario se puede escribir igualmente por WhatsApp o al correo gestion@cesteriaaparici.es, y se responde en cuanto se abre.

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

# Pendiente de confirmar con el cliente

Resueltos el 03/08/2026 por el cliente: **horario** (9:00-13:00), **formas de
pago** (tarjeta, Bizum, PayPal y transferencia) e **IVA** (incluido para
particulares, excluido en la tarifa profesional). Están ya en los documentos 13
y 14. Queda esto:

1. **Qué días cubre el horario de 9 a 13.** El cliente ha dado la franja pero no
   los días. Si abren sábados, o si el horario cambia fuera de verano, el bot lo
   dirá mal. Es una pregunta de treinta segundos.

2. **Qué correo debe dar el bot.** En la web aparecen `gestion@cesteriaaparici.es`
   y `comunicacion@cesteriaaparici.es`. Se ha usado `gestion@` por ser el de
   gestión de pedidos; conviene confirmarlo.

3. **Canarias.** La web dice «consultar condiciones y tarifas». ¿Hay una tarifa
   concreta que pueda dar el bot, o debe pasar siempre a una persona?

4. **Plazo de reembolso.** Se dice que se reembolsa tras comprobar el producto,
   pero no en cuántos días. Es lo primero que pregunta quien ha devuelto algo.

5. **Garantía.** No aparece en las condiciones. Se aplica la legal de 3 años del
   Real Decreto 7/2021, pero conviene que lo confirmen antes de que el bot lo diga.

6. **¿Se puede visitar el taller?** La dirección es un polígono industrial. Si no
   hay tienda abierta al público, el bot no debe invitar a nadie a presentarse
   allí sin avisar.

7. **Cuándo pasar a una persona.** Un pedido perdido, una reclamación o un
   proyecto grande no los debe cerrar un bot. Hay que decidir el criterio y a
   qué teléfono o correo deriva.
