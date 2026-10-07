# Inmobiliaria Llaves — cliente de demostración

Cuarta demo sectorial, después de la peluquería, la clínica dental y la de
fisioterapia. Es la primera en la que **el bot no solo informa y da citas: busca
en una cartera**. Quien escribe dice qué busca (zona, precio, habitaciones,
garaje...), el bot le enseña lo que encaja, afina con preguntas y termina
concertando una **visita con el comercial**.

El nombre sigue la pauta de las otras («Mechas», «Muelas», «Masajes») y evita a
propósito palabras que la gente escribe al buscar: «Inmobiliaria Casas» haría
casar «casa» con cualquier saludo, la misma trampa que tuvo la fisioterapia
(`docs/demo-fisioterapia-masajes.md`, sección 3).

| Pieza | Archivo | Estado |
| --- | --- | --- |
| Cartera de 39 inmuebles | `docs/inmuebles-inmobiliaria-llaves.csv` | hecho |
| Dónde viven y cómo los busca el bot | `0025_inmuebles.sql`, `whatsapp-bot.json`, `scripts/cargar-inmuebles.js` | en producción desde el 05/10/2026 |
| Comerciales, horario y tipos de visita | `scripts/montar-demo-inmobiliaria.js`, `docs/servicios-inmobiliaria-llaves.csv` | montado el 06/10/2026 |
| Prompt, conocimiento (16 documentos) y batería de 67 preguntas | `docs/prompt-inmobiliaria-llaves.md`, `docs/conocimiento-inmobiliaria-llaves.md`, `docs/preguntas-inmobiliaria-llaves.txt` | cargados el 06/10/2026 |
| Número y tarjeta en la web | eSIM **+34 623 81 04 54** (`wa.me/34623810454`), nombre visible «Agencia Kivuk Demo Inmobiliaria»; tarjeta en `app/src/lib/web/demos.ts`, QR y tarjeta A6 en `docs/material-venta/demos/` | tarjeta hecha el 06/10/2026; falta el alta en Meta |

---

## 1. La cartera

**Inventada, pero calcada del mercado real.** Zonas, tipos y horquillas de
precio salen de las carteras publicadas en octubre de 2026 por tres
inmobiliarias de Ontinyent (Albiñana, Penadés y Kapitalia). Ninguna ficha es
copia de un anuncio: ni referencias, ni textos, ni fotos. Por tres motivos:

- la demo se va a enseñar precisamente a inmobiliarias de la zona, y ver sus
  pisos en «otra» agencia sería lo primero que comentaran;
- los textos y las fotos de un anuncio tienen dueño;
- un piso real se vende, y la demo quedaría enseñando algo que ya no existe.

25 en venta (referencias `101`–`125`) y 14 en alquiler (`201`–`214`). Números
cortos a propósito: por WhatsApp se escribe «el 104» antes que «PIS-0104».

| | Venta | Alquiler |
| --- | --- | --- |
| Pisos y áticos | 11, de 95.000 a 205.000 € | 6, de 500 a 1.050 €/mes |
| Casas de pueblo, adosado, casa de campo | 5, de 72.000 a 195.000 € | 1, 600 €/mes |
| Chalets | 5, de 240.000 a 560.000 € | 1, 1.300 €/mes |
| Locales, naves, oficinas | 3, de 85.000 a 320.000 € | 6, de 300 a 1.500 €/mes |
| Parcela | 1, 68.000 € | — |

Municipios: Ontinyent (la mayoría, en nueve zonas) y alrededores — Agullent,
Aielo de Malferit, Albaida, Bocairent, L'Olleria y Xàtiva.

### Casos puestos a propósito

La cartera no es un muestrario al azar: cada uno de estos sale en el guion.

| Caso | Inmueble | Lo que tiene que hacer el bot |
| --- | --- | --- |
| Se pasa un poco del presupuesto | `104`, 152.000 € para quien dice «hasta 150.000» | Enseñarlo avisando de que se pasa, no esconderlo |
| Reservado | `116`, chalet en la Ombria | No ofrecerlo nunca |
| Un pero que hay que decir | `110`, ático **sin ascensor** | Decirlo antes de que lo descubra en la visita |
| No hay nada | chalet en alquiler por menos de 1.300 €, vivienda en Xàtiva | Decir que no lo hay y ofrecer apuntar la búsqueda |
| Cerca del campus | `103` y `202` (El Llombo) | Saber que «cerca de la universidad» es El Llombo |
| Vivienda frente a negocio | locales y naves | No mezclar un local con quien busca piso |

### Columnas

| Columna | Qué lleva |
| --- | --- |
| `ref` | Número corto, único |
| `operacion` | `venta` o `alquiler` |
| `tipo` | piso, ático, casa de pueblo, adosado, casa de campo, chalet, local, nave, oficina, parcela |
| `municipio`, `zona` | La zona con el nombre que se usa allí (`Sant Josep`); los alias («San José») son cosa del buscador |
| `precio` | Euros; en alquiler, al mes |
| `habitaciones`, `banos`, `m2`, `m2_parcela` | Vacíos cuando no aplican (un local no tiene habitaciones) |
| `estado` | a reformar, para actualizar, buen estado, reformado, obra nueva |
| `situacion` | `disponible` o `reservado` |
| `extras` | Separados por `\|`: ascensor, garaje, terraza, piscina, amueblado... |
| `descripcion` | Una frase, sin comas (el CSV se parte por comas, como los de servicios) |

## 2. Cómo busca el bot

La explicación técnica está en `n8n/workflows/README.md`, sección «Cartera de
inmuebles». En corto: la IA apunta lo que pide la persona, la base decide qué
encaja y el código escribe la lista. El bot no puede ofrecer un piso que no
existe ni cambiarle el precio a uno que sí.

Así le llega a quien pide «piso de 3 habitaciones en Ontinyent, hasta 150.000»:

```
Tengo 2 que encajan con lo que buscas:

*Ref. 105* · Piso en Sant Rafel (Ontinyent)
129.000 € · 3 hab. · 2 baños · 105 m²
Ascensor y terraza.
Terraza de 15 m² muy soleada y dos baños completos.

*Ref. 102* · Piso en Sant Josep (Ontinyent)
118.000 € · 3 hab. · 1 baño · 95 m² · para actualizar
Ascensor y balcón.
Tres habitaciones amplias y exterior; cocina y baño para poner al día.

Y este se acerca, por si te encaja:

*Ref. 104* · Piso en el centro de Ontinyent
152.000 € · 3 hab. · 2 baños · 112 m²
Ascensor, garaje y trastero.
Plaza de garaje y trastero incluidos en pleno centro.
_Se pasa 2.000 € de lo que me dijiste._

¿Te gustaría ver alguno? Dime la referencia y te busco hueco para la visita con el comercial.
```

### Para ponerlo en marcha

1. Aplicar `supabase/migrations/0025_inmuebles.sql` en el SQL Editor de
   Supabase.
2. En el servidor: `git pull` y
   `node scripts/desplegar-workflow.js n8n/workflows/whatsapp-bot.json --aplicar`.
   El orden importa poco: sin la migración, el nodo de la cartera falla en
   silencio y el bot contesta como siempre.
3. Con el cliente ya montado (paso 3): activar el módulo «Cartera de inmuebles»
   en su configuración y
   `node scripts/cargar-inmuebles.js docs/inmuebles-inmobiliaria-llaves.csv "Inmobiliaria Llaves" --aplicar`.

## 3. Los comerciales y las visitas

Montado el 06/10/2026: **`Inmobiliaria Llaves`**, id
`bb2fc58a-f27a-43fe-9405-f10464e690cb`, con los módulos WhatsApp, agenda e
inmuebles y los 39 inmuebles cargados (38 disponibles y el reservado).

```bash
node scripts/montar-demo-inmobiliaria.js --aplicar
node scripts/cargar-inmuebles.js docs/inmuebles-inmobiliaria-llaves.csv "Inmobiliaria Llaves" --aplicar
```

Idempotentes los dos, como en las otras demos: sirven también para devolverla a
su estado de fábrica.

La oficina abre de lunes a viernes de 9:30 a 13:30 y de 16:30 a 20:00, y el
sábado de 10:00 a 13:30, que es cuando más visitas se piden.

| | Lunes | Martes | Miércoles | Jueves | Viernes | Sábado |
| --- | --- | --- | --- | --- | --- | --- |
| **Marta** (venta, valoraciones) | mañana y tarde | mañana y tarde | mañana | mañana y tarde | mañana y tarde | 10-13:30 |
| **Javier** (alquiler) | tarde | mañana y tarde | tarde | mañana y tarde | tarde | 10-13:30 |
| **Sergio** (locales, naves, oficinas) | mañana y tarde | mañana | mañana y tarde | mañana | mañana | |

| Cita | Duración | Quién |
| --- | --- | --- |
| Visita a vivienda en venta | 45 min | Marta, Sergio |
| Visita a vivienda en alquiler | 30 min | Javier, Marta |
| Visita a local o nave | 45 min | Sergio |
| Valoración gratuita de vivienda | 60 min | Marta |
| Cita en la oficina | 30 min | los tres |

La **valoración gratuita** está a propósito. A una inmobiliaria le cuesta más
conseguir pisos que venderlos: que el bot recoja «quiero vender mi casa,
¿cuánto vale?» y le dé cita a Marta es probablemente lo que más le va a llamar
la atención.

Los alias no llevan «inmobiliaria» ni «llaves», que están en el nombre del
negocio (la trampa de la fisioterapia), ni un «visita» a secas, que no dice de
qué tipo es.

Comprobado contra la agenda de producción: «quiero ver el piso» → visita de
venta; «me gustaría ver el local» → visita de local, solo mañanas y el miércoles
por la tarde (Sergio); «quiero vender mi casa, ¿cuánto vale?» → valoración, el
miércoles solo por la mañana (Marta).

**Fallo encontrado por el camino.** La agenda calculaba la lista de citas
reservables (`catalogo`), pero `Respuesta del motor` (`agenda-api.json`) copia
la respuesta campo a campo y ese no lo copiaba. Del 11/09 al 06/10/2026, ningún
bot vio la lista «SERVICIOS QUE SE PUEDEN RESERVAR» que monta `Preparar
contexto`. Arreglado, con su prueba en `nodos.prueba.js`. Al desplegarlo, las
otras tres demos también empiezan a verla, que es como estaban diseñadas.

## 4. El prompt, el conocimiento y las pruebas

```bash
node scripts/cargar-prompt.js docs/prompt-inmobiliaria-llaves.md "Inmobiliaria Llaves" --aplicar
node scripts/cargar-conocimiento.js docs/conocimiento-inmobiliaria-llaves.md "Inmobiliaria Llaves" --aplicar
node scripts/probar-conocimiento.js "Inmobiliaria Llaves" --bateria docs/preguntas-inmobiliaria-llaves.txt
```

**La batería, contra la búsqueda real:** de las 62 preguntas con respuesta,
todas traen el documento bueno entre los cinco que recibe el bot, y la gran
mayoría en primer lugar. Dos cosas se arreglaron por el camino:

- «¿Pago comisión por alquilar?» traía primero el documento para
  **propietarios**, que dice «los honorarios se acuerdan contigo». Un inquilino
  podía entender que le cobran, cuando por ley no paga nada. En vez de pelear
  el orden, ese documento dice ahora también que el inquilino no paga, y el de
  comprar, que el comprador tampoco: lo que salga primero ya trae la respuesta
  buena.
- «¿Dónde están las naves?» no encontraba nada útil: el documento de locales
  dice ahora en qué polígonos están.

**Conversaciones de punta a punta, antes de activar el número.** Se pasaron
conversaciones enteras por el código real de los nodos (`Preparar contexto`,
`Decidir acción`, `Respuesta con inmuebles`, `Respuesta final`), con los datos
de Supabase, la agenda de producción y gpt-4o, sin reservar nada. Salió bien la
búsqueda y el afinado, el 116 reservado, «apuntadme» (avisa al equipo), la
valoración en Agullent, las fotos (avisa al equipo), «¿esto es un bot?» y la
respuesta legal sobre la comisión del alquiler; y la visita se pide con
`motivo` «Ref. 105 · piso en Sant Rafel (Ontinyent)». Lo que salió mal y se
corrigió:

| Visto | Arreglo |
| --- | --- |
| «Me gustaría verlo el sábado por la mañana» → «te reservo una visita para el sábado», sin hora y sin cita | El prompt prohíbe dar una visita por hecha y pide las horas libres de ese día |
| Copió literalmente las horas del ejemplo del prompt | Ejemplo con huecos genéricos (`<primera hora>`) |
| «Busco casa, tengo 200 mil» → preguntaba qué tipo de casa en vez de buscar | «Una casa» = todos los tipos de casa; sin zona, todas |
| Se presentó en valenciano a quien escribía en castellano | Idioma del último mensaje, dicho explícitamente |
| Entradillas encima de la lista («Estoy buscando opciones…») | Filtro frase a frase en `Respuesta con inmuebles` |

**Primera prueba por WhatsApp (06/10/2026): parecía un bucle.** «Vivienda en San
José, comprar» → las dos de Sant Josep y una de La Vila de relleno; «tengo
150.000, ¿algo mejor?» → las mismas tres; «me has dado las mismas, ¿no tienes
nada más?» → las mismas tres. En Sant Josep no hay más, pero la búsqueda no
sabía qué se había enseñado ya. Arreglado con la migración `0026` y en el bot
(detalle en `n8n/workflows/README.md`): no repite, no rellena con otras zonas,
las ofrece con su número y, si dice que sí, busca sin la zona. Repetida la
misma conversación con gpt-4o, sale así:

1. «Comprar» → 101 y 102. *«Es todo lo que tengo en Sant Josep. En otras zonas
   de Ontinyent tengo 12 más con lo que buscas. ¿Te los enseño?»*
2. «Tenía 150.000» → *«En Sant Josep no tengo más aparte de los que ya te he
   enseñado. En otras zonas de Ontinyent tengo 3 más con lo que buscas.
   ¿Te los enseño?»*
3. «Sí, enséñamelos» → 103, 105 y 112, *«aparte de los que ya te he enseñado»*.
4. «¿No tienes nada más?» → nada más que cumpla; enseña el 104 y el 110
   avisando de cuánto se pasan.

Por el camino salió otro tropiezo de la IA: «vivienda» lo traducía como los
tipos de casa y **sin pisos**. Ahora ve los tipos separados en «de vivienda» y
«para negocio o suelo».

**Límite conocido:** las fichas y los cierres del sistema van en castellano
aunque la persona escriba en valenciano. El bot conversa en su idioma, pero la
lista no.

### Lo que falta para un cliente de verdad

- **Gestionar la cartera desde el panel.** Hoy entra por CSV. A la demo le
  basta; una inmobiliaria real da de alta y vende pisos cada semana.
- **Fotos.** Las fichas llevan `url`, pero la demo no tiene fotos (son
  inventadas). Enseñar la foto por WhatsApp sería lo siguiente que se pide.
- **Apuntar la búsqueda de quien no encuentra nada**, para avisarle cuando
  entre algo así. Hoy el bot lo ofrece y la conversación queda en la bandeja.
