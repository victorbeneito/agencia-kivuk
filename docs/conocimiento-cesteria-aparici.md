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

Un proyecto a medida no se cierra por el chat, pero tampoco hay que mandar a nadie a otro sitio ni darle teléfonos: la atención personal es en esta misma conversación.

En cuanto alguien plantea un proyecto —unas cuantas unidades, una fecha, un local, una marca—, se pasa al equipo EN ESE MISMO MENSAJE, a la vez que se le piden los detalles que falten (qué pieza, cuántas unidades y para cuándo). No se espera a tenerlos para avisar: quien deja de contestar después de la primera pregunta se pierde entero, y un proyecto es justo lo que no se puede perder.

Si además es un profesional, se le indica el formulario de alta PRO, https://www.cesteriaaparici.es/formulario-b2b, que es por donde trabaja el equipo Business.

Y si prefiere hablar con la empresa directamente, en vez de esperar por aquí, el WhatsApp y teléfono de Cestería Aparici es el 633 67 81 92, el fijo el 96 236 03 33 y el correo gestion@cesteriaaparici.es. Es una alternativa que se le ofrece además de pasar la conversación al equipo, nunca en lugar de hacerlo.

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

Estas medidas son siempre aproximadas, y conviene decirlo de entrada: cada capazo se trenza a mano, así que es muy difícil encontrar dos exactamente iguales y puede haber unos centímetros de diferencia entre dos del mismo número. No es un fallo ni un descuido: es la diferencia entre una pieza hecha a mano y una fabricada en serie, y es lo que hace que cada capazo sea único. Se cuenta como lo que es, algo bueno, no como una pega ni pidiendo disculpas.

Las medidas de cada producto concreto están en su ficha de la web.
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

- Para la leña, junto a la chimenea: los leñeros de esparto. Los hay redondos, ovalados, con una o dos asas, con asa transversal y forrados de arpillera o yute. Van de unos 19 € a unos 103 €.
- Para la playa: los capazos de palma. Los tamaños que se llevan a la playa son el N°7, el N°8 y el N°9; el N°8 es el familiar y el N°9 el más grande.
- Para la compra o el mercado: capazos del N°6 al N°9, según lo que se quiera cargar.
- Como bolso de mano o de diario: capazos N°4, N°5 y N°6, y los bolsos de palma y de fibras naturales.
- Para la ropa: cestos con tapa y cestos grandes de fibra.
- Para mantas, revistas o almacenaje en el salón: cestos grandes, capazos N°8 y N°9, y el baúl.
- Para plantas y flores: maceteros de esparto, de pared o colgantes, y cestos redondos.
- Para servir o presentar en la mesa: bandejas de palma y de seagrass, y el menaje natural.
- Para regalo gourmet o de Navidad: las cestas de Navidad, que las hay de uno, dos y tres pisos.

Si lo que busca no encaja en ninguna de estas, o quiere una medida que no existe, se puede hacer a medida.
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

Atención telefónica prioritaria. Contacto directo con el equipo Business, asesoramiento en tiempo real y compromiso de respuesta en menos de 24 horas.

Logística adaptada. Entrega a pie de calle o premium en la estancia que se elija, envíos express en una selección de productos con seguimiento en tiempo real, y posibilidad de entrega única y montaje.

Diseños exclusivos. Posibilidad de fabricar productos a medida y de crear una colección propia para la marca del cliente.

Visibilidad para su marca. Presencia en la web de Aparici y difusión del proyecto en sus redes sociales, sujeto a aprobación.

Un proyecto con valores. Producto sostenible, hecho a mano, que contribuye a mantener viva la cultura artesanal.

Para darse de alta como profesional se rellena el formulario de la web, y el equipo Business se pone en contacto:
https://www.cesteriaaparici.es/formulario-b2b

Quien se registra recibe además un cupón del 5% adicional en su correo electrónico. Es el gancho para darse de alta: no es un descuento que el cliente ya tenga, es un cupón que le llega al correo después de registrarse. Por eso la forma de cerrar cualquier conversación con un profesional es siempre esta, con el enlace debajo: «Regístrate ahora y obtén en tu correo electrónico un cupón del 5% adicional».

El pedido mínimo para clientes profesionales es de 99 €.

Caso aparte: quien dice que YA tiene cuenta PRO y pregunta cuál es su descuento, su tarifa o sus condiciones. Eso no se puede consultar desde el chat, y es un cliente real esperando una cifra concreta, así que se le dice que se lo pasas al equipo Business para que le confirmen sus condiciones, y se pasa la conversación de verdad. No se le repite el discurso de las ventajas: eso ya lo tiene.
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

Para productos personalizados o hechos a medida, el pedido mínimo es de 50 unidades. Para el resto del catálogo, el pedido mínimo profesional es de 99 €.
```

---

# Pendiente de confirmar con el cliente

Resueltos el 03/08/2026 por el cliente: **horario** (9:00-13:00), **formas de
pago** (tarjeta, Bizum, PayPal y transferencia) e **IVA** (incluido para
particulares, excluido en la tarifa profesional). Están ya en los documentos 13
y 14.

Resueltos el 10/09/2026: **el fondo del capazo N°5** (18 cm, era una errata del
blog que se comió el 1), **el estado del pedido** (área de cliente → Mis
pedidos, y el correo de expedición para el seguimiento) y **Amazon** (sí venden,
pero sin dirigir a nadie allí). Están en los documentos 16, 17 y 18.

Queda esto:

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

8. **El blog viejo contradice a la guía nueva en dos medidas.** El documento 16
   toma ya las medidas de `cesteriaaparici.es/tamanos-de-capazos` (la guía de
   2026, que es la oficial). Pero el post del blog de 2025 sigue publicado y dice
   otra cosa en dos de los seis tamaños:

   | | Blog 2025 | Guía 2026 |
   |---|---|---|
   | N°5 | 32 x **8** x **17** | 32 x **18** x **14** |
   | N°9 | **55** x 28 x 35 | **52** x 28 x 35 |

   El 8 del N°5 es claramente una errata (se comieron el 1), pero el alto (17 vs
   14) y el ancho del N°9 (55 vs 52) son diferencias de verdad. Conviene que
   borren o actualicen el post viejo: mientras los dos estén en Google, un
   cliente puede leer una medida y que el bot le diga otra.
