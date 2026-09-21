# Base de conocimiento — Clínica Dental Muelas (demo)

Documentos curados para cargar en la pestaña **Conocimiento** del panel
(`/dashboard/<clientId>/conocimiento`).

**Este cliente es simulado.** No existe la clínica, ni la dirección, ni el
equipo. Todo está escrito para enseñar el producto a clínicas dentales reales, y
los precios están puestos con criterio de mercado para una población de unos
40.000 habitantes (Comunidad Valenciana, 2026), no copiados de ninguna clínica
concreta. Si un cliente potencial pregunta, es una demo y se dice que lo es.

Carga de una vez:

```
node scripts/cargar-conocimiento.js docs/conocimiento-clinica-dental-muelas.md "Clinica Dental Muelas" --aplicar
```

Y después, la batería de preguntas:

```
node scripts/probar-conocimiento.js "Clinica Dental Muelas" --bateria docs/preguntas-clinica-dental-muelas.txt
```

## Reglas que se han seguido al escribirlos

Las mismas que en la peluquería, más tres que son propias de una clínica:

- **Cada documento empieza por dos o tres formas coloquiales de preguntar lo que
  resuelve.** Un embedding busca el documento que *se parece* a la pregunta, y
  nadie escribe «tarifa de endodoncia»: escribe «cuanto cuesta matar el nervio».
- **Cada precio está en un solo documento, con su duración al lado.** Las
  duraciones coinciden con `docs/servicios-clinica-dental-muelas.csv`.
- **Casi todo lo caro pone «desde» y remite a la primera visita.** En una
  clínica el precio de un implante o de una ortodoncia depende de lo que se ve
  en la boca y en la radiografía. El bot da la referencia y lleva a la primera
  visita, que es gratis: esa es la conversión que busca la clínica.
- **Nada de diagnóstico.** Los documentos cuentan cómo trabaja la clínica y qué
  hacer mientras llega la cita, nunca qué tiene alguien ni qué tomar. Donde hay
  un síntoma, hay una cita o un «ve a urgencias».
- **Los casos graves están escritos con todas las letras** (hinchazón que baja
  al cuello, fiebre, no poder tragar, un golpe fuerte). Es el único sitio donde
  el bot tiene que ser tajante, y no puede depender de que lo improvise.

---

## 1. Quiénes somos — la clínica y qué hacemos

- **Categoría:** La empresa

```
¿Qué clínica sois? ¿Qué tratamientos hacéis? ¿Cuánto lleváis abiertos? ¿Sois una franquicia? ¿Ponéis bótox o ácido hialurónico en los labios?

Clínica Dental Muelas es una clínica dental de barrio, independiente (no somos franquicia ni cadena), abierta desde 2009. La dirige la Dra. Elena Ruiz.

Hacemos odontología general (revisiones, limpiezas, empastes, endodoncias, extracciones), cirugía oral e implantes, periodoncia (encías), prótesis y coronas, estética dental (blanqueamiento y carillas), ortodoncia con brackets y ortodoncia invisible, y odontopediatría (dentista para niños).

Trabajamos con escáner intraoral, así que para la mayoría de tratamientos no hace falta tomar moldes con pasta, y con radiografía digital, que da mucha menos radiación que la convencional. Para implantes tenemos TAC 3D en la propia clínica.

No hacemos medicina estética facial (ni ácido hialurónico ni bótox), ni sedación con anestesista.
```

---

## 2. Dónde estamos, horario y cómo pedir cita

- **Categoría:** La empresa

```
¿Dónde estáis? ¿Qué horario tenéis? ¿Abrís por la tarde? ¿Abrís los sábados? ¿Cómo pido cita?

Estamos en la avenida del País Valencià, 45, bajo, en el centro.

Horario:
- De lunes a jueves: de 9:00 a 14:00 y de 16:00 a 20:00.
- Viernes: de 9:00 a 14:00. Los viernes por la tarde está cerrado.
- Sábados, domingos y festivos: cerrado.

Cerramos a mediodía, de 14:00 a 16:00.

La cita se pide por este mismo WhatsApp, a cualquier hora, o en recepción. Trabajamos siempre con cita. Las urgencias se atienden el mismo día dentro del horario, con prioridad, aunque puede tocar esperar un rato.

Cerramos dos semanas en agosto y los festivos locales; se avisa con tiempo por aquí.
```

---

## 3. El equipo — quién es quién y qué días viene cada uno

- **Categoría:** La empresa

```
¿Quién trabaja en la clínica? ¿Quién pone los implantes? ¿Quién lleva la ortodoncia? ¿Puedo pedir con la doctora Elena? ¿Qué días viene el ortodoncista?

Somos cuatro:

- Dra. Elena Ruiz. Odontóloga general y directora de la clínica. Hace revisiones, empastes, endodoncias, extracciones sencillas, coronas, prótesis, blanqueamientos, carillas y férulas de descarga. También ve a niños. Está de lunes a viernes por la mañana y las tardes de lunes, martes y jueves.
- Dr. Javier Soler. Cirujano oral e implantólogo. Pone los implantes, saca las muelas del juicio y lleva las encías (periodoncia). También hace revisiones y urgencias. Pasa consulta los lunes y miércoles todo el día y los viernes por la mañana.
- Dra. Marta Ibáñez. Ortodoncista y odontopediatra. Lleva los brackets, la ortodoncia invisible y a los niños. Viene los martes por la tarde y los jueves todo el día.
- Carla. Higienista dental. Hace las limpiezas, los selladores de los niños y las sesiones de blanqueamiento, y colabora en la periodoncia. Está de lunes a viernes por la mañana y las tardes de martes, miércoles y jueves.

Se puede pedir con una persona concreta al reservar. Las limpiezas las hace siempre Carla; los implantes y las muelas del juicio, el Dr. Javier; y la ortodoncia, la Dra. Marta.
```

---

## 4. Primera visita gratuita — qué incluye y qué traer

- **Categoría:** Preguntas frecuentes

```
¿La primera visita es gratis? ¿Cuánto cuesta la primera consulta? ¿Qué me hacéis la primera vez? ¿Me dais presupuesto? Es la primera vez que voy, ¿qué tengo que llevar?

La primera visita es gratuita y sin compromiso. Dura unos 30 minutos.

Incluye:
- Una revisión completa de dientes y encías.
- La radiografía panorámica, si hace falta para el diagnóstico (también gratis en esta visita).
- El plan de tratamiento explicado, con el presupuesto por escrito y sus opciones.

No se hace ningún tratamiento ese día salvo que sea una urgencia. Te llevas el presupuesto a casa y decides con calma.

Qué traer:
- DNI.
- La lista de medicamentos que tomas, si tomas alguno. Es muy importante si tomas anticoagulantes (Sintrom, Adiro...), medicación para los huesos o para la tensión.
- Informes médicos si tienes alguna enfermedad (diabetes, problemas de corazón, alergias).
- Radiografías recientes de otro dentista, si las tienes.

Los precios que damos por aquí son orientativos: el presupuesto exacto de cada caso sale de esta primera visita.
```

---

## 5. Revisión, limpieza y radiografías — precios

- **Categoría:** Productos

```
¿Cuánto cuesta una limpieza? ¿Qué precio tiene la revisión? ¿Cada cuánto hay que hacerse una limpieza? ¿La limpieza duele? ¿Cuánto vale una radiografía?

- Limpieza dental (higiene y retirada de sarro): 50 € (45 minutos).
- Revisión: 25 € (30 minutos).
- Revisión y limpieza en la misma cita: 50 €, es decir, la revisión sale gratis (1 hora).
- Radiografía panorámica: 30 €. Gratis en la primera visita.
- Radiografía pequeña de un diente: 10 €.
- Aplicación de flúor en adultos: 20 €.

La limpieza la hace Carla, nuestra higienista, y al terminar la revisa la dentista.

Lo recomendable es una revisión con limpieza cada 6 meses, o una vez al año si la boca está sana y no se acumula mucho sarro.

La limpieza no suele doler. Puede notarse algo de sensibilidad si hay mucho sarro o las encías están inflamadas; si alguien es muy sensible, se puede poner anestesia en la zona. Si las encías sangran mucho o hay bolsas, puede que lo que haga falta sea una limpieza profunda (periodoncia), que se explica en su apartado.
```

---

## 6. Urgencias y dolor de muelas — cómo se atienden

- **Categoría:** Preguntas frecuentes

```
Me duele una muela, ¿me podéis ver hoy? ¿Atendéis urgencias? Se me ha roto un diente. Se me ha caído un empaste. Tengo la cara hinchada. ¿Cuánto cuesta la urgencia?

Sí, atendemos urgencias el mismo día dentro del horario de la clínica. Cada día se guardan huecos para urgencias, y se da prioridad al dolor fuerte, a la hinchazón y a los golpes.

- Consulta de urgencia: 40 € (30 minutos). Si el tratamiento se hace aquí, esos 40 € se descuentan.

En la urgencia se quita el dolor o se resuelve lo inmediato (por ejemplo, una obturación provisional o abrir un diente infectado) y se explica qué tratamiento hace falta después.

Mientras llega la cita:
- Si se ha roto un diente o se ha caído un empaste, guarda el trozo si lo encuentras y evita masticar por ese lado.
- Si se ha caído una corona o una funda, guárdala: muchas veces se puede volver a cementar.
- Frío por fuera de la cara, nunca calor, si hay hinchazón.
- No te pongas una aspirina sobre la encía: quema la mucosa.
- Sobre qué tomar para el dolor, sigue lo que ya te haya indicado tu médico o pregunta en la farmacia; por WhatsApp no pautamos medicación.

Fuera del horario de la clínica no hay servicio de urgencias propio: mira el apartado de casos graves y fuera de horario.
```

---

## 7. Casos graves, fuera de horario y diente arrancado por un golpe

- **Categoría:** Preguntas frecuentes

```
Es de noche y tengo mucho dolor, ¿qué hago? ¿Tenéis urgencias el fin de semana? Tengo la cara muy hinchada y fiebre. Mi hijo se ha dado un golpe y se le ha salido un diente.

Fuera del horario de la clínica (tardes de viernes, fines de semana y festivos) no tenemos servicio de urgencias. Puedes escribir por aquí y te damos cita en cuanto abramos.

Hay que ir a URGENCIAS DEL HOSPITAL o llamar al 112, sin esperar a la clínica, si:
- La hinchazón crece deprisa, cierra el ojo o baja hacia el cuello.
- Hay fiebre alta junto con la hinchazón.
- Cuesta tragar o respirar.
- Ha habido un golpe fuerte en la cara o en la mandíbula, o una herida que no para de sangrar tras 30 minutos apretando una gasa.

Si un golpe ha arrancado un diente definitivo entero (no uno de leche):
- Cógelo por la corona, la parte blanca; no toques la raíz.
- Si está sucio, enjuágalo unos segundos con leche o suero, sin frotar.
- Guárdalo en leche o en suero fisiológico (o dentro de la boca, junto a la mejilla, si es un adulto).
- Ven a la clínica o a urgencias en menos de una hora: cuanto antes, más posibilidades de salvarlo.

Si el diente es de leche, no se vuelve a colocar, pero conviene que lo vea la dentista para revisar que no se ha dañado el definitivo.
```

---

## 8. Empastes y endodoncias — precios y cómo son

- **Categoría:** Productos

```
¿Cuánto cuesta un empaste? ¿Qué precio tiene una endodoncia? ¿Cuánto cuesta matar el nervio? ¿La endodoncia duele? ¿Cuánto se tarda en hacer un empaste?

Empastes (obturaciones del color del diente, de composite):
- Empaste pequeño o mediano: 55 € (45 minutos).
- Empaste grande o reconstrucción de un diente: 75 € (45 minutos).

Endodoncia (tratamiento de conductos, lo que se conoce como «matar el nervio»):
- Diente de una raíz (incisivos y caninos): 170 € (1 hora y media).
- Premolar: 220 € (1 hora y media).
- Muela: 280 € (1 hora y media; alguna vez hace falta una segunda sesión).

Después de una endodoncia, el diente se reconstruye con un empaste grande (75 €), y en las muelas muchas veces se recomienda una corona, porque un diente endodonciado es más frágil.

Tanto el empaste como la endodoncia se hacen con anestesia local, así que no duelen durante el tratamiento. Es normal notar el diente algo sensible unos días después.

Qué tratamiento necesita un diente (un empaste, una endodoncia o sacarlo) lo decide la dentista en consulta, con radiografía.
```

---

## 9. Extracciones y muelas del juicio

- **Categoría:** Productos

```
¿Cuánto cuesta sacar una muela? ¿Qué precio tiene quitar la muela del juicio? ¿Me duermen para sacar la muela del juicio? ¿Cuánto se tarda?

- Extracción sencilla: 55 € (30 minutos).
- Extracción de muela del juicio: desde 110 € (1 hora). Si está metida en el hueso o hace falta cirugía, desde 180 €; se sabe con la radiografía.

Las muelas del juicio las saca el Dr. Javier Soler, cirujano oral.

Se hacen con anestesia local: se nota presión, pero no dolor. No hacemos sedación ni anestesia general; si un caso la necesitara, se deriva a un hospital.

Antes de sacar un diente se valora siempre si se puede salvar. Y si se va a sacar uno que habrá que reponer, se explica en ese momento qué opciones hay (implante, puente o prótesis).

Los cuidados de después están en su apartado propio.
```

---

## 10. Implantes dentales — precio y cómo es el proceso

- **Categoría:** Productos

```
¿Cuánto cuesta un implante? ¿Cuánto vale un implante con la corona? ¿Cuánto se tarda en poner un implante? ¿Duele? ¿Tenéis implantes de carga inmediata? ¿Cuántos años duran?

Precio por diente:
- Implante de titanio, con la cirugía: 850 €.
- Corona de porcelana sobre el implante: 450 €.
- En total, un diente con implante: 1.300 €.
- Estudio con TAC 3D antes de la cirugía: 60 €, que se descuentan si se hace el implante.

Si falta hueso y hay que regenerarlo, o para rehabilitaciones de toda la boca (dentadura fija sobre implantes), el precio se da tras el estudio.

Cómo es el proceso:
1. Primera visita gratuita y estudio con TAC 3D, para ver si hay hueso suficiente.
2. Cirugía: se coloca el implante con anestesia local (1 hora y media). No duele durante la intervención; los días siguientes hay molestias y algo de hinchazón, que se controlan.
3. Espera de 3 a 4 meses para que el implante se una al hueso. Mientras, si es un diente visible, se pone uno provisional para no ir sin diente.
4. Se coloca la corona definitiva.

La carga inmediata (salir con el diente fijo el mismo día) es posible en algunos casos, cuando el hueso lo permite; se decide en el estudio.

Los implantes los coloca el Dr. Javier Soler. La marca que usamos da garantía de por vida sobre el implante, y la clínica da 5 años de garantía sobre la corona, siempre que se hagan las revisiones anuales.

Un implante no se reserva directamente por aquí: primero hace falta la primera visita y el estudio.
```

---

## 11. Coronas, puentes, prótesis y dentaduras

- **Categoría:** Productos

```
¿Cuánto cuesta una funda? ¿Qué precio tiene una corona? ¿Hacéis dentaduras postizas? ¿Cuánto vale una dentadura? Se me ha roto la dentadura, ¿me la arregláis?

Coronas (fundas):
- Corona de zirconio (la más estética y resistente): 390 € (45 minutos por cita; hacen falta dos o tres citas).
- Corona de metal-porcelana: 290 €.
- Puente: se presupuesta según los dientes que abarque.

Prótesis removibles (de quitar y poner):
- Dentadura completa, por arcada (arriba o abajo): 650 € (45 minutos por cita; unas cuatro o cinco citas en total).
- Prótesis parcial de resina: 450 €.
- Prótesis esquelética (con estructura metálica, más fina y estable): 650 €.
- Reparación de una dentadura: desde 45 €. Si es sencilla, se intenta tenerla el mismo día.
- Rebase (ajustar una dentadura que se ha quedado floja): 90 €.

Con el escáner intraoral la mayoría de coronas se hacen sin moldes de pasta.

Si una dentadura hace daño o se mueve, no hace falta aguantarse: se ajusta. Y si molesta mucho llevarla, se puede estudiar sujetarla con implantes.
```

---

## 12. Estética dental — blanqueamiento y carillas

- **Categoría:** Productos

```
¿Cuánto cuesta un blanqueamiento? ¿Hacéis blanqueamiento dental? ¿Cuánto dura? ¿Qué precio tienen las carillas? ¿El blanqueamiento estropea los dientes?

Blanqueamiento:
- Blanqueamiento en clínica: 290 € (1 hora y media, en una sesión).
- Blanqueamiento en casa con férulas a medida: 190 € (se usan unas dos semanas).
- Blanqueamiento combinado (clínica + casa), el de mejor resultado: 350 €.

Antes de blanquear se hace una revisión y, si hace falta, una limpieza: no se puede blanquear sobre caries o con las encías inflamadas.

El blanqueamiento no estropea el esmalte cuando lo controla la clínica. Puede dar sensibilidad unos días. El resultado dura entre uno y tres años, según lo que se fume y se tome café, té o vino. Las fundas, los empastes y las carillas no blanquean: se quedan del color que tienen.

Carillas:
- Carilla de composite: 140 € por diente (1 hora por cita).
- Carilla de porcelana: 380 € por diente (dos o tres citas).

Las carillas sirven para cambiar el color, la forma o pequeñas separaciones de los dientes de delante. Si un caso es para carillas, para blanqueamiento o para ortodoncia se ve en la primera visita.
```

---

## 13. Encías — periodoncia, sangrado y limpieza profunda

- **Categoría:** Productos

```
Me sangran las encías, ¿es normal? ¿Qué es la piorrea? ¿Cuánto cuesta un curetaje? ¿Qué es una limpieza profunda? Se me mueven los dientes.

Que las encías sangren al cepillarse no es normal: suele ser el primer aviso de gingivitis (encías inflamadas) y, si va a más, de periodontitis, lo que se conocía como piorrea. Si se deja, el diente acaba perdiendo el hueso que lo sujeta y se mueve. Conviene pedir una revisión.

Precios:
- Estudio periodontal (medición de las encías): 40 €, que se descuentan si se hace el tratamiento.
- Raspado y alisado radicular (curetaje o limpieza profunda): 70 € por cuadrante. Se suelen hacer dos cuadrantes por cita (1 hora), con anestesia local.
- Mantenimiento periodontal (cada 3 a 6 meses después del tratamiento): 60 €.

La periodoncia la lleva el Dr. Javier Soler con Carla, la higienista.

Si se mueven los dientes, hay mal sabor de boca continuo o las encías se retraen, hay que venir cuanto antes: la periodontitis no duele hasta que está avanzada.
```

---

## 14. Ortodoncia — brackets y ortodoncia invisible

- **Categoría:** Productos

```
¿Cuánto cuestan los brackets? ¿Qué precio tiene la ortodoncia invisible? ¿Hacéis Invisalign? ¿Cuánto dura una ortodoncia? ¿Se puede poner ortodoncia de mayor? ¿Se puede pagar a plazos?

- Estudio de ortodoncia (fotos, escáner y radiografías): 60 € (45 minutos). Se descuentan si se empieza el tratamiento.
- Brackets metálicos: 1.900 € el tratamiento completo.
- Brackets estéticos (de zafiro, transparentes): 2.400 €.
- Ortodoncia invisible (alineadores transparentes): desde 3.200 €. El precio exacto depende del número de alineadores que haga falta.

El precio incluye todas las revisiones mensuales (unos 20 minutos cada una) y el primer juego de retenedores al terminar.

Se puede pagar a plazos sin intereses: por ejemplo, los brackets metálicos desde 80 € al mes. Los detalles de la financiación están en el apartado de pagos.

Un tratamiento dura normalmente entre 12 y 24 meses, según el caso.

La ortodoncia se puede hacer a cualquier edad: cada vez hay más adultos. En niños, la primera revisión de ortodoncia se recomienda hacia los 7 años, aunque no siempre haga falta tratar tan pronto.

La ortodoncia la lleva la Dra. Marta Ibáñez, que pasa consulta los martes por la tarde y los jueves todo el día.

Si llevas brackets y se ha soltado uno o pincha un alambre, escribe por aquí: normalmente se arregla en una revisión corta. Mientras, un poco de cera de ortodoncia sobre el alambre evita que roce.
```

---

## 15. Niños — dentista infantil, selladores y primera visita

- **Categoría:** Productos

```
¿Atendéis a niños? ¿A qué edad hay que llevar al niño al dentista? ¿Cuánto cuesta la revisión de un niño? ¿Qué son los selladores? A mi hijo le ha salido una caries en un diente de leche.

Sí. A los niños los ven la Dra. Marta Ibáñez (odontopediatra) y la Dra. Elena Ruiz.

- Revisión infantil: gratis hasta los 14 años (30 minutos).
- Selladores de fisuras: 25 € por muela (30 minutos la cita). Protegen las muelas definitivas de las caries y se suelen poner entre los 6 y los 12 años.
- Aplicación de flúor: 20 €.
- Empaste en un diente de leche: 40 €.

La primera visita al dentista se recomienda al salir el primer diente o, como tarde, al cumplir el año. Después, una revisión cada 6 meses.

Los dientes de leche también se tratan: si una caries llega al nervio de un diente de leche, puede doler e infectar y afectar al diente definitivo que está debajo.

Las primeras visitas las hacemos sin prisas, para que el niño se acostumbre: si un día no hay manera, se vuelve otro día. Las tardes de martes y jueves son las mejores para no faltar al colegio.
```

---

## 16. Bruxismo y férula de descarga

- **Categoría:** Productos

```
Aprieto los dientes por la noche, ¿qué hago? ¿Cuánto cuesta una férula de descarga? Me duele la mandíbula al despertarme. Rechino los dientes.

Apretar o rechinar los dientes (bruxismo) suele pasar de noche y sin darse cuenta. Las señales típicas: dolor de mandíbula o de cabeza al despertar, dientes desgastados o sensibles, y chasquidos al abrir la boca.

- Férula de descarga a medida: 250 €. La toma de medidas con escáner dura 30 minutos, y la férula se entrega y se ajusta en otra cita, aproximadamente a la semana.
- Ajuste o revisión de la férula durante el primer año: incluido.

La férula protege los dientes del desgaste y descansa la musculatura. Las de farmacia no son a medida y pueden empeorar la mordida.

Si hay dolor fuerte en la articulación o la boca se bloquea, hay que decirlo al pedir la cita.
```

---

## 17. Precios orientativos, financiación y formas de pago

- **Categoría:** Pagos

```
¿Se puede pagar a plazos? ¿Tenéis financiación? ¿Aceptáis tarjeta? ¿Hay que pagar por adelantado? ¿El presupuesto es cerrado?

Formas de pago: efectivo, tarjeta y Bizum.

Cómo se paga:
- Revisiones, limpiezas, empastes y urgencias: al terminar la cita.
- Tratamientos largos (implantes, prótesis, ortodoncia): por fases, a medida que se hacen. No se paga el tratamiento entero por adelantado.

Financiación:
- Hasta 12 meses sin intereses en tratamientos de más de 600 €.
- Plazos más largos, con intereses, a través de una financiera y sujetos a su aprobación. Se tramita en la clínica en el momento.

Los precios que se dan por aquí son orientativos. El presupuesto que se entrega en la primera visita es por escrito, cerrado para el tratamiento que describe y válido 6 meses. Si durante el tratamiento apareciera algo nuevo, se explica y se presupuesta antes de hacerlo.

Se da factura siempre, que es lo que piden los seguros de reembolso y lo que sirve para la declaración de la renta cuando corresponda.
```

---

## 18. Seguros dentales y mutuas

- **Categoría:** Pagos

```
¿Trabajáis con Sanitas? ¿Aceptáis mi seguro? ¿Sois de alguna mutua? ¿Me cubre el seguro? ¿Estáis concertados con Adeslas o DKV?

No estamos concertados con ninguna aseguradora ni mutua: somos una clínica privada independiente.

Si tu seguro es de reembolso (te devuelve una parte de lo que pagas en cualquier dentista), te damos la factura detallada que te pidan para reclamarlo.

Qué te cubre tu póliza en concreto lo sabe tu aseguradora; nosotros no podemos consultarlo.
```

---

## 19. Cancelar, cambiar la cita y llegar tarde

- **Categoría:** Preguntas frecuentes

```
¿Puedo anular la cita? ¿Cómo cambio la hora? ¿Qué pasa si llego tarde? ¿Cobráis por cancelar? No puedo ir mañana.

Cambiar o anular una cita no cuesta nada. Pedimos avisar con al menos 24 horas, y con 48 horas en cirugías e implantes, porque esa hora se prepara con antelación y otro paciente la puede aprovechar.

Si llegas tarde, se hace lo que dé tiempo sin retrasar al siguiente paciente. Con más de 15 minutos de retraso puede que haya que cambiar la cita de día.

Si alguien falta dos veces sin avisar, para las siguientes citas largas se pide una señal que se descuenta del tratamiento.

Los cambios y las anulaciones los gestiona recepción: escribe por aquí y te lo cambian.
```

---

## 20. Miedo al dentista y anestesia

- **Categoría:** Preguntas frecuentes

```
Me da mucho miedo el dentista. ¿Duele? ¿Me vais a poner anestesia? ¿Hacéis sedación? Tengo pánico a las agujas.

Es mucho más frecuente de lo que parece, y no pasa nada por decirlo. Si lo avisas al pedir la cita, se tiene en cuenta: se reserva algo más de tiempo, se explica cada paso antes de hacerlo y se para cuando lo pidas.

Todos los tratamientos que pueden molestar se hacen con anestesia local, y antes del pinchazo se pone un gel anestésico en la encía para que no se note.

No hacemos sedación con anestesista en la clínica. Si en algún caso fuera necesaria, se explica dónde se puede hacer.

Si lo prefieres, la primera visita puede ser solo para conocernos y hablar: es gratis y no se hace nada que no quieras.
```

---

## 21. Embarazo, medicación y enfermedades

- **Categoría:** Preguntas frecuentes

```
Estoy embarazada, ¿puedo ir al dentista? ¿Me puedo hacer una limpieza embarazada? Tomo Sintrom, ¿me podéis sacar una muela? Soy diabético. Soy alérgico a la anestesia.

Embarazo: las revisiones y las limpiezas se pueden hacer y son recomendables, porque en el embarazo las encías se inflaman con más facilidad. Los tratamientos que no son urgentes se suelen dejar para el segundo trimestre, y las radiografías se evitan salvo que sean necesarias. Dilo siempre al pedir la cita, y coméntalo también con tu matrona o tu ginecólogo.

Medicación: hay que decir siempre qué medicamentos tomas, sobre todo anticoagulantes o antiagregantes (Sintrom, Adiro, Xarelto y similares), medicación para la osteoporosis y tratamientos de quimioterapia. Nunca dejes un medicamento por tu cuenta para venir al dentista: si hay que ajustar algo, lo hablamos con tu médico.

Enfermedades: diabetes, problemas de corazón, marcapasos o hipertensión no impiden el tratamiento, pero hay que saberlo antes para organizarlo.

Alergias: si eres alérgico a algún anestésico, al látex o a algún antibiótico, dilo al reservar. Si tienes un informe de alergias, tráelo.

Todo esto lo valora el dentista en consulta; por WhatsApp no podemos decir si un tratamiento concreto es adecuado para ti.
```

---

## 22. Cuidados después de una extracción o de un implante

- **Categoría:** Preguntas frecuentes

```
Me han sacado una muela, ¿qué puedo comer? ¿Cuándo me puedo enjuagar? ¿Es normal que sangre? Me pusieron un implante ayer y está hinchado. ¿Puedo fumar?

Después de sacar una muela o de poner un implante:
- Muerde la gasa 30 minutos. Un poco de sangre en la saliva las primeras horas es normal.
- No comas hasta que se pase la anestesia, para no morderte. Ese día, comida blanda y templada o fría, y masticando por el otro lado.
- Las primeras 24 horas, nada de enjuagues fuertes ni de escupir con fuerza, y no uses pajita: el coágulo tiene que quedarse en su sitio.
- Frío por fuera de la cara a ratos las primeras 48 horas.
- No fumes al menos 48 horas; mejor, una semana. Es lo que más complica la curación.
- Cepíllate el resto de la boca con normalidad, con cuidado en la zona.
- Toma solo lo que te haya indicado el dentista.

Es normal algo de hinchazón y molestias los dos o tres primeros días.

Avisa por aquí si el dolor va a más a partir del tercer día, si hay mal sabor o mal olor en la herida, o si sangra mucho y no para apretando una gasa. Si hay fiebre alta, la hinchazón baja al cuello o cuesta tragar, ve a urgencias del hospital.
```

---

## 23. Aparcamiento, accesibilidad e idiomas

- **Categoría:** Preguntas frecuentes

```
¿Dónde aparco? ¿Hay parking cerca? ¿Se puede entrar en silla de ruedas? ¿Habláis valenciano? ¿Habláis inglés? ¿Puedo ir con mi hijo pequeño?

La clínica está en un bajo, sin escalones, y es accesible en silla de ruedas y con carrito. El baño también está adaptado.

Para aparcar hay un aparcamiento público a dos minutos andando y zona azul en la misma avenida.

Atendemos en castellano y en valenciano, y la Dra. Elena Ruiz también en inglés.

Se puede venir con niños pequeños aunque la cita sea para un adulto; hay una zona de espera con cuentos. Durante el tratamiento, eso sí, conviene que alguien se quede con ellos.
```

---

# Pendiente de confirmar

Nada de lo de arriba es real: **todo el documento es material de demostración.**
Esta sección existe para dejar claro qué habría que preguntarle a una clínica de
verdad antes de reutilizar estos documentos con ella, porque son justo los datos
que cambian de una clínica a otra y que no se pueden suponer:

- **Los precios y si la primera visita es gratis.** En este sector varían mucho
  entre poblaciones y entre clínicas independientes y cadenas. Nunca se carga
  una tarifa que la clínica no haya confirmado.
- **Las duraciones reales**, que son las que dan los huecos de la agenda.
- **Quién hace qué y qué días viene cada especialista.** En una clínica real
  los especialistas (implantólogo, ortodoncista) suelen venir días sueltos, y es
  lo primero que hay que rellenar con ellos.
- **Las aseguradoras**: muchas clínicas sí están concertadas con alguna, y
  entonces el documento 18 cambia entero.
- **La financiación**: plazos, entidad y a partir de qué importe.
- **Las garantías** de implantes, coronas y prótesis.
- **Si la clínica está adherida a algún programa público de atención dental
  infantil**, que cambia lo que paga una familia.
- **Los textos sobre urgencias y cuidados**: los de aquí son los habituales,
  pero cada clínica tiene sus propias instrucciones postoperatorias y debe
  revisarlas su dentista antes de que las diga el bot.
