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
| Dónde viven y cómo los busca el bot | `0025_inmuebles.sql`, `whatsapp-bot.json`, `scripts/cargar-inmuebles.js` | hecho, sin desplegar |
| Comerciales, horario y tipos de visita | `scripts/montar-demo-inmobiliaria.js` | pendiente |
| Prompt, conocimiento y batería de preguntas | `docs/prompt-…`, `docs/conocimiento-…` | pendiente |
| Número y tarjeta en la web | eSIM + `app/src/lib/web/demos.ts` | pendiente |

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

### Lo que falta para un cliente de verdad

- **Gestionar la cartera desde el panel.** Hoy entra por CSV. A la demo le
  basta; una inmobiliaria real da de alta y vende pisos cada semana.
- **Fotos.** Las fichas llevan `url`, pero la demo no tiene fotos (son
  inventadas). Enseñar la foto por WhatsApp sería lo siguiente que se pide.
- **Apuntar la búsqueda de quien no encuentra nada**, para avisarle cuando
  entre algo así. Hoy el bot lo ofrece y la conversación queda en la bandeja.
