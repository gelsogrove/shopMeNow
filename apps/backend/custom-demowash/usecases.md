# laundroDemo Chatbot — Casos de Uso

Especificación funcional del chatbot multilingüe de laundroDemo. Cada caso documenta los criterios de aceptación y la conversación de referencia.

## Estructura

Cada caso principal (`## Caso N — ...`) contiene dos secciones:

1. **Overview** — 1-2 frases sintéticas: qué se prueba.
2. **Conversación** — diálogo canónico.

Las variantes adicionales se documentan como **sub-casos** (`### Caso N.1`, `### Caso N.2`, …) con solo el diálogo.

---

## Mundo laundroDemo

**6 lavanderías self-service**:

| Canonical | Ciudad | Dirección |
|---|---|---|
| Sants | Barcelona | C/ Sants 145 |
| Gràcia | Barcelona | C/ Gran de Gràcia 88 |
| Born | Barcelona | C/ Princesa 22 |
| Mar | Badalona | Av. del Mar 17 |
| Vilanova | Sitges | Pg. Vilanova 5 |
| Estació | Sant Cugat | Av. de l'Estació 30 |

"Barcelona" es pueblo ambiguo (3 lavanderías). Idiomas: es / ca / en / it / fr / pt. Default: es.

**Códigos de pantalla** (lavadora y secadora): `SELECT`, `CHOICE PROG`, `ERROR DOOR`, `ALARM`, `ALARM DOOR`, `ERR-001`, `T-28`, `STOP:`, `END:`, `ON`.

---

## Caso 1 — Multilingüe en vivo

**Overview** — El bot detecta el idioma del primer mensaje y responde en esa lengua durante toda la conversación. Soporta 6 idiomas: es / ca / en / it / fr / pt.

**Conversación** (catalán)

```
Client: Quin horari teniu?
Bot:    👋 Hola, sóc l'assistent virtual de laundroDemo. En quina bugaderia ets?

Client: Born.
Bot:    A Born (Barcelona), obrim de dilluns a dissabte de 8:00 a 23:00, i els diumenges de 9:00 a 22:00.
```

### Caso 1.1 — Italiano sin location → bot pregunta

```
Cliente: Quanto costa lavare la roba?
Bot:     👋 Ciao, sono l'assistente virtuale di laundroDemo. In quale lavanderia ti trovi?

Cliente: Vilanova.
Bot:     A Vilanova (Sitges), il prezzo della lavatrice è:
         • 8 kg → 5,50 €
         • 14 kg → 9,00 €

         Accettiamo carta, contanti e App laundroDemo.
```

### Caso 1.2 — Inglés (procedimiento estándar, no se pide sede)

```
Customer: How does it work?
Bot:      To use the washing machine follow these steps:

          1. Put your clothes in the machine and close the door firmly.
          2. Go to the payment terminal and select the machine number.
          3. Pay by card, cash or with the laundroDemo App.
          4. Return to the machine and select the program.
          5. When it's done, collect your clothes.

          Detergent and softener are dispensed automatically.
```

### Caso 1.3 — Cliente cambia de idioma a mitad de conversación

```
Cliente: Hola, ¿qué horarios tenéis?
Bot:     👋 Hola, soy el asistente virtual de laundroDemo. ¿En qué lavandería estás?

Client:  Sorry, can you switch to English? I'm at Born.
Bot:     Of course. At Born (Barcelona), we're open Monday to Saturday from 8:00 to 23:00, and Sundays from 9:00 to 22:00.
```

---

## Caso 2 — Precios

**Overview** — El bot devuelve el listado de precios correcto por sede. Los precios pueden variar entre lavanderías y Estació (Sant Cugat) ofrece además una lavadora XL de 18 kg que las demás no tienen.

**Conversación**

```
Cliente: ¿Cuánto cuesta?
Bot:     ¿En qué lavandería estás?

Cliente: Mar.
Bot:     En Mar (Badalona), estos son los precios:

         Lavadora
         • 8 kg → 5,50 €
         • 14 kg → 9,00 €

         Secadora
         • 12 min → 2,00 €
         • 24 min → 4,00 €
         • 36 min → 6,00 €

         Puedes pagar con tarjeta, efectivo o la App laundroDemo. ¿Te ayudo con algo más?
```

### Caso 2.1 — Estació con lavadora XL

```
Cliente: ¿Precio de la lavadora en Sant Cugat?
Bot:     En Estació (Sant Cugat), el precio de la lavadora es:
         • 8 kg → 5,50 €
         • 14 kg → 9,00 €
         • XL 18 kg → 12,00 €

         Aceptamos tarjeta, efectivo y App laundroDemo.
```

---

## Caso 3 — Horarios

**Overview** — El bot responde con los horarios correctos según la sede. Los horarios varían entre lavanderías (Born abre hasta más tarde, Estació abre antes por proximidad a la estación de tren).

**Conversación**

```
Cliente: ¿Qué horarios tienen?
Bot:     ¿En qué lavandería estás?

Cliente: Sants.
Bot:     En Sants (Barcelona), abrimos todos los días de 8:00 a 22:00.
```

### Caso 3.1 — Pueblo ambiguo (Barcelona)

```
Cliente: ¿Qué horarios tenéis en Barcelona?
Bot:     En Barcelona tenemos tres lavanderías: Sants, Gràcia y Born. ¿Cuál te interesa?

Cliente: Born
Bot:     En Born (Barcelona), abrimos de 8:00 a 23:00 entre semana, y los domingos de 9:00 a 22:00.
```

---

## Caso 4 — Cómo funciona

**Overview** — El bot explica el proceso operativo paso a paso. El procedimiento es **idéntico en todas las sedes** (red en franquicia), por eso el bot no necesita preguntar dónde está el cliente.

**Conversación**

```
Cliente: ¿Cómo funciona la lavandería?
Bot:     Para usar la lavadora sigue estos pasos:

         1. Mete la ropa en la máquina y cierra bien la puerta.
         2. Acércate al tótem de pago y selecciona el número de la máquina.
         3. Paga con tarjeta, efectivo o App laundroDemo.
         4. Vuelve a la máquina y selecciona el programa.
         5. Cuando termine, recoge tu ropa.

         El detergente y el suavizante se dosifican automáticamente. ¡No hace falta que traigas nada!
```

### Caso 4.1 — Cómo funciona la secadora

```
Cliente: ¿Cómo se usa la secadora?
Bot:     Para usar la secadora sigue estos pasos:

         1. Mete la ropa ya lavada en la secadora y cierra la puerta.
         2. Acércate al tótem de pago, selecciona el número de la secadora y elige los minutos (12, 24 o 36).
         3. Paga con tarjeta, efectivo o App laundroDemo.
         4. La secadora arranca automáticamente.
         5. Cuando termine, recoge tu ropa seca.
```

---

## Caso 5 — La lavadora no arranca (ERROR DOOR)

**Overview** — Flujo de diagnóstico cuando la máquina muestra `ERROR DOOR` (puerta mal cerrada). El bot solicita location y número de máquina, guía al cliente paso a paso y escala a un operador si el problema persiste. El procedimiento es idéntico en todas las sedes.

**Conversación**

```
Cliente: La lavadora no arranca.
Bot:     Lo siento. ¿En qué lavandería estás?

Cliente: Sants.
Bot:     ¿Qué número de lavadora has seleccionado?

Cliente: La 4.
Bot:     ¿Qué aparece exactamente en la pantalla?

Cliente: ERROR DOOR.
Bot:     Tranquilo, vamos a resolverlo. La puerta no está bien cerrada.

         1. Abre la puerta con cuidado.
         2. Revisa que no haya ninguna prenda enganchada en la goma.
         3. Vuelve a cerrarla con un poco más de fuerza, hasta oír el clic.

         ¿La pantalla sigue mostrando ERROR DOOR?

Cliente: Ya no sale el mensaje, ha arrancado.
Bot:     ¡Perfecto! Que tengas un buen lavado. 👋
```

### Caso 5.1 — La puerta sigue bloqueada → escalación

```
Cliente: La lavadora 7 de Gràcia sigue con ERROR DOOR. Ya he abierto y cerrado la puerta dos veces, no hay nada atrapado.
Bot:     Lo siento. Intentemos una última cosa: cierra la puerta empujando con firmeza con las dos manos, hasta notar el clic claramente. ¿Ha desaparecido el mensaje?

Cliente: No, sigue igual.
Bot:     De acuerdo. Voy a avisar a un operador para que revise la máquina 7 de Gràcia (Barcelona). En unos minutos te contactará. Mientras tanto, te recomiendo cambiar tu ropa a otra lavadora. ¿Me confirmas tu nombre para el reporte?

Cliente: Pere Roca.
Bot:     Gracias Pere. Incidencia registrada.
```

**Human Message enviado al operador:**

```
👤 Mensaje para el operador
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🕒 Fecha: 26/05/2026 18:42
📍 Sede: Gràcia (Barcelona)
🔢 Lavadora: 7
👤 Cliente: Pere Roca

🚨 Incidencia
La lavadora 7 muestra ERROR DOOR de forma persistente.
El cliente ha intentado abrir y cerrar la puerta varias veces
sin éxito. No hay prendas atrapadas en la goma.

✅ Acción sugerida
Revisar mecánicamente la goma y el cierre de la puerta.
Activar otra lavadora en remoto si el cliente la elige.
```

---

## Caso 6 — Ha saltado una alarma

**Overview** — Flujo de diagnóstico cuando la máquina muestra un código de alarma (`ALARM`, `ALARM DOOR` o `ERR-001`). Las alarmas técnicas (`ALARM`, `ALARM DOOR`) escalan siempre a un operador para activación remota; el código de secuencia (`ERR-001`, programa pulsado antes del pago) tiene resolución guiada.

**Conversación**

```
Cliente: Ha saltado una alarma.
Bot:     Lo siento. ¿En qué lavandería estás?

Cliente: Sants.
Bot:     ¿Es lavadora o secadora?

Cliente: Lavadora.
Bot:     ¿Qué número de máquina?

Cliente: La 7.
Bot:     ¿Qué código exacto aparece en la pantalla?

Cliente: Sale ALARM.
Bot:     Tranquilo, lo solucionamos. La lavadora 7 ha detectado un fallo técnico y necesita revisión. Por favor, cambia tu ropa a otra lavadora libre y dime cuál es.

Cliente: Paso a la 9.
Bot:     Perfecto. Aviso al operador para activar la lavadora 9 en remoto sin coste adicional. En unos minutos te contactará para confirmar.
```

**Human Message enviado al operador:**

```
👤 Mensaje para el operador
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🕒 Fecha: 26/05/2026 19:10
📍 Sede: Sants (Barcelona)
🔢 Lavadora afectada: 7 (con ALARM)
🔄 Lavadora alternativa: 9 (para activación remota)

🚨 Incidencia
La lavadora 7 muestra código ALARM (fallo técnico).
El cliente ha movido la ropa a la lavadora 9.

✅ Acción sugerida
1. Activar lavadora 9 en remoto sin coste para el cliente.
2. Marcar lavadora 7 fuera de servicio hasta revisión técnica.
```

### Caso 6.1 — ERR-001 (programa pulsado antes del pago)

```
Cliente: Sale ERR-001 en la lavadora 3 de Vilanova.
Bot:     `ERR-001` aparece cuando se pulsa el programa antes de completar el pago. Vamos a reiniciar:

         1. Carga la ropa y cierra bien la puerta.
         2. Ve al tótem de pago, paga y selecciona el número 3.
         3. Vuelve a la máquina y pulsa el programa.
         4. Dime si arranca.

Cliente: Listo, ahora ha arrancado.
Bot:     ¡Perfecto! Buen lavado. 👋
```

### Caso 6.2 — ALARM DOOR

```
Cliente: Sale ALARM DOOR en la lavadora 5 de Estació.
Bot:     `ALARM DOOR` indica un posible problema de cierre o una prenda atrapada. Abre la puerta con cuidado, revisa la goma y vuelve a cerrarla con firmeza. ¿Ha desaparecido el mensaje?

Cliente: He revisado, no hay nada atrapado y sigue igual.
Bot:     Lo siento. Aviso al técnico para revisar la máquina 5 de Estació (Sant Cugat). Cambia tu ropa a otra lavadora y dime cuál has elegido para activarla en remoto sin coste.

Cliente: Paso a la 7.
Bot:     Perfecto. Un operador activará la máquina 7 en breve.
```

---

## Caso 7 — No sale jabón en la máquina

**Overview** — Flujo cuando el cliente reporta que la lavadora ha funcionado pero no ha dispensado detergente o suavizante. El bot tranquiliza, explica que el dispensador automático puede estar vacío o atascado, y escala a un operador para reposición.

**Conversación**

```
Cliente: La lavadora ha funcionado pero la ropa ha salido sin jabón, todavía huele a sucia.
Bot:     Lo siento mucho. ¿En qué lavandería estás?

Cliente: Mar.
Bot:     ¿Qué número de lavadora has usado?

Cliente: La 6.
Bot:     Entendido. En laundroDemo el detergente y el suavizante se dispensan automáticamente; si la ropa ha salido sin jabón, lo más probable es que el dispensador esté vacío o atascado.

         Vamos a relanzar tu lavado sin coste adicional. Vuelve a meter la ropa en la lavadora 6 de Mar (Badalona) y cierra la puerta. Aviso a un operador para que active el nuevo ciclo en remoto. ¿Me confirmas tu nombre?

Cliente: Adrià Camps.
Bot:     Gracias Adrià. Incidencia registrada. Un operador relanzará el ciclo en unos minutos y revisará el dispensador.
```

**Human Message enviado al operador:**

```
👤 Mensaje para el operador
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🕒 Fecha: 26/05/2026 16:30
📍 Sede: Mar (Badalona)
🔢 Lavadora: 6
👤 Cliente: Adrià Camps

🚨 Incidencia
El ciclo de lavado en la lavadora 6 ha terminado sin dispensar
jabón. La ropa sigue oliendo a sucia. Posible dispensador vacío
o atascado.

✅ Acción sugerida
1. Relanzar el ciclo en remoto sin coste para el cliente.
2. Revisar el dispensador de detergente y suavizante de la lavadora 6.
```

---

## Caso 8 — La centrifugadora no ha arrancado

**Overview** — Flujo cuando el cliente reporta que el lavado ha terminado pero la ropa ha salido empapada porque el centrifugado final no se ha activado. El bot diagnostica si hay un problema de carga desequilibrada (causa más común) y guía al cliente a relanzar el centrifugado; si persiste, escala.

**Conversación**

```
Cliente: La lavadora ha terminado pero la ropa ha salido empapada, no ha centrifugado.
Bot:     Lo siento. ¿En qué lavandería estás?

Cliente: Gràcia.
Bot:     ¿Qué número de lavadora has usado?

Cliente: La 4.
Bot:     Entendido, lavadora 4 en Gràcia (Barcelona). Lo más habitual es que la carga estuviera desequilibrada y la máquina haya saltado el centrifugado por seguridad. Vamos a relanzar:

         1. Abre la puerta de la lavadora 4 y redistribuye la ropa para repartir bien el peso.
         2. Cierra la puerta.
         3. Selecciona un programa corto (30º) y arráncalo. Esta vez sí centrifugará.

         ¿Te ha funcionado?

Cliente: Sí, ahora ha centrifugado bien.
Bot:     ¡Perfecto! Buen día. 👋
```

### Caso 8.1 — La centrifugadora sigue sin funcionar → escalación

```
Cliente: He redistribuido la ropa y relanzado en la lavadora 4 de Gràcia, pero sigue saliendo empapada.
Bot:     Lo siento, parece un problema técnico de la máquina. Aviso a un operador para revisar la lavadora 4 de Gràcia (Barcelona) y compensarte por el inconveniente. ¿Me confirmas tu nombre?

Cliente: Núria Vives.
Bot:     Gracias Núria. Incidencia registrada. Un operador te contactará en breve.
```

**Human Message enviado al operador:**

```
👤 Mensaje para el operador
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🕒 Fecha: 26/05/2026 17:45
📍 Sede: Gràcia (Barcelona)
🔢 Lavadora: 4
👤 Cliente: Núria Vives

🚨 Incidencia
La lavadora 4 no centrifuga. El cliente ya ha redistribuido
la ropa y relanzado un programa corto sin éxito.
Posible fallo técnico de la centrifugadora.

✅ Acción sugerida
1. Contactar al cliente para coordinar compensación.
2. Revisar técnicamente la centrifugadora de la lavadora 4.
```

---

## Caso 9 — He pagado y la máquina no se ha activado

**Overview** — Flujo cuando el cliente afirma haber pagado pero la máquina no ha arrancado. El bot pide location, número de máquina y diagnóstico de la pantalla, identifica la causa (selección pendiente, programa no pulsado) y escala si la activación remota no es posible.

**Conversación**

```
Cliente: He pagado y la lavadora no se ha activado.
Bot:     Lo siento. ¿En qué lavandería estás?

Cliente: Born.
Bot:     ¿Qué número de lavadora has seleccionado?

Cliente: La 6.
Bot:     ¿Qué aparece en la pantalla?

Cliente: Sale SELECT.
Bot:     `SELECT` significa que la máquina está esperando a que selecciones el número en el tótem. Vuelve al tótem y pulsa el número 6.

Cliente: Hecho. Ahora pone CHOICE PROG.
Bot:     ¡Perfecto! Ya sólo falta elegir el programa (60º, 40º, 30º o FRÍO) y pulsar el botón en la máquina. ¿Arranca?

Cliente: Sí, gracias.
Bot:     ¡Genial! Buen lavado. 👋
```

### Caso 9.1 — Activación remota necesaria

```
Cliente: He pagado en Mar máquina 4, me ha devuelto el cambio pero la lavadora no arranca y la pantalla está apagada.
Bot:     Voy a pedir activación remota para la máquina 4 de Mar (Badalona). Un operador la pondrá en marcha en unos minutos. Si la máquina no arranca tras 5 minutos, vuelve a escribirme.
```

### Caso 9.2 — No arranca tras varios intentos → escalación

```
Cliente: He pagado en Estació, máquina 8, sale CHOICE PROG.
Bot:     Sólo falta elegir el programa (60º, 40º, 30º o FRÍO) y pulsar el botón en la máquina. ¿Arranca?

Cliente: He pulsado 40º pero sigue mostrando CHOICE PROG.
Bot:     Prueba a pulsar el botón con un poco más de firmeza, hasta notar el clic. ¿Arranca ahora?

Cliente: Nada, sigue igual.
Bot:     Lo siento. Aviso a un operador para que active la máquina 8 de Estació (Sant Cugat) en remoto. ¿Me confirmas tu nombre para el reporte?

Cliente: Marta Vidal.
Bot:     Gracias Marta. Incidencia registrada. Un operador te contactará en breve.
```

**Human Message enviado al operador:**

```
👤 Mensaje para el operador
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🕒 Fecha: 26/05/2026 14:50
📍 Sede: Estació (Sant Cugat)
🔢 Lavadora: 8
👤 Cliente: Marta Vidal

🚨 Incidencia
El cliente ha pagado y pulsado el programa (40º) varias veces,
pero la lavadora 8 sigue mostrando CHOICE PROG sin arrancar.
Posible fallo del botón de programa o de la electrónica.

✅ Acción sugerida
1. Activar lavadora 8 en remoto.
2. Revisar el botón de programa de la lavadora 8.
```

---

## Caso 10 — La máquina no devuelve el cambio

**Overview** — Flujo cuando el cliente paga en efectivo y el tótem no le devuelve el cambio correcto. Este caso siempre escala a un operador porque implica una incidencia económica que el bot no puede resolver de forma autónoma.

**Conversación**

```
Cliente: La máquina no me ha devuelto el cambio.
Bot:     Lo siento mucho. Para ayudarte necesito algunos datos. ¿En qué lavandería estás?

Cliente: Sants.
Bot:     ¿Cuánto has introducido y cuánto deberías haber recibido de cambio?

Cliente: He metido 10 € y el lavado cuesta 5,50 €, no me ha devuelto los 4,50 €.
Bot:     Entendido. Una diferencia de 4,50 € en Sants (Barcelona). Esto no lo puedo resolver yo desde el chat, voy a avisar a un operador para que te devuelva el importe. Te contactarán en breve. ¿Me confirmas tu nombre para el reporte?

Cliente: Carla Méndez.
Bot:     Gracias Carla. He registrado la incidencia. Un operador te contactará en unos minutos.
```

**Human Message enviado al operador:**

```
👤 Mensaje para el operador
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🕒 Fecha: 26/05/2026 12:15
📍 Sede: Sants (Barcelona)
👤 Cliente: Carla Méndez
💰 Incidencia económica

🚨 Incidencia
El tótem no ha devuelto el cambio correcto.
• Importe introducido: 10 €
• Importe del lavado: 5,50 €
• Diferencia adeudada al cliente: 4,50 €

✅ Acción sugerida
Contactar al cliente para devolver 4,50 €.
Revisar la caja del tótem (posible falta de monedas o atasco).
```

---

## Caso 11 — Doble cobro

**Overview** — Flujo cuando el cliente afirma que se le ha cobrado dos veces el mismo servicio. El bot recoge los datos estructurados (sede, completitud del servicio, últimos 4 dígitos de tarjeta, captura del cargo) y escala con un resumen completo. Si el servicio se completó, se envía el formulario de reembolso.

**Conversación**

```
Cliente: Me ha cobrado dos veces.
Bot:     Lo siento mucho. Vamos a revisarlo paso a paso. ¿En qué lavandería estás?

Cliente: Vilanova.
Bot:     Gracias. ¿Has completado el servicio (la ropa ya está lavada) o no llegaste a usar la máquina?

Cliente: Sí, ya he lavado.
Bot:     Entendido. ¿Me indicas los últimos 4 dígitos de la tarjeta con la que pagaste?

Cliente: 4523.
Bot:     Perfecto. Por último, ¿puedes pasarme una captura del cargo en tu banco o app?

Cliente: Te paso la captura.
Bot:     Gracias. Como has completado el servicio, te paso el formulario de reembolso:

         👉 https://laundrodemo.demo/refund

         Rellénalo con los datos y la captura. He avisado al operador del caso (Vilanova, tarjeta ****4523), te contactará en cuanto reciba el formulario.
```

### Caso 11.1 — Servicio no completado

```
Cliente: He pagado dos veces en Sants pero no he llegado a lavar.
Bot:     Entendido. Si no has completado el servicio, la próxima vez antes de volver a pagar contáctanos por aquí: te ayudamos al momento y evitamos el cargo doble.

         Para gestionar el reembolso de los 2 pagos: necesito los últimos 4 dígitos de la tarjeta y la captura del cargo. Te paso luego al operador.
```

---

## Caso 12 — Cambio de tema en mitad de un flujo

**Overview** — Durante un diagnóstico técnico el cliente puede preguntar por orarios o precios y el bot responde, manteniendo abierta la posibilidad de retomar el flujo anterior si el cliente lo desea.

**Conversación**

```
Cliente: Me ha cobrado dos veces.
Bot:     Lo siento mucho. ¿En qué lavandería estás?

Cliente: En Born. Antes de seguir, ¿qué precio tiene la lavadora aquí?
Bot:     En Born (Barcelona), la lavadora cuesta 5,50 € (8 kg) o 9,00 € (14 kg). ¿Seguimos con el doble cobro?

Cliente: Sí, ya he completado el servicio.
Bot:     Entendido. ¿Me pasas los últimos 4 dígitos de la tarjeta y una captura del cargo para que el operador revise el caso?
```

### Caso 12.1 — Cliente abandona el flujo anterior

```
Cliente: Sale ALARM DOOR en la máquina 5 de Gràcia.
Bot:     `ALARM DOOR` indica un posible problema de cierre. Abre la puerta y revisa que no haya nada atrapado en la goma. ¿Ha desaparecido el mensaje?

Cliente: Olvídalo, ¿cuánto cuesta la secadora?
Bot:     En Gràcia (Barcelona), el precio de la secadora es:
         • 12 min → 2,00 €
         • 24 min → 4,00 €
         • 36 min → 6,00 €

         Aceptamos tarjeta, efectivo y App laundroDemo.
```

---

## Caso 13 — Quiero la factura

**Overview** — Flujo de solicitud de factura. El bot recoge los datos fiscales paso a paso (razón social, dirección, observaciones) y los guarda en el perfil del cliente para futuras facturas.

**Conversación**

```
Cliente: Quiero la factura del lavado.
Bot:     Por supuesto. Para emitirla necesito algunos datos fiscales. ¿Cuál es la razón social o tu nombre fiscal?

Cliente: Tintorería Soler SL.
Bot:     Gracias. ¿Dirección de facturación?

Cliente: C/ Aragón 145, 08015 Barcelona.
Bot:     Perfecto. ¿Alguna observación que quieras añadir (CIF, código de cliente, referencia)?

Cliente: CIF B12345678.
Bot:     Datos registrados:
         • Razón social: Tintorería Soler SL
         • Dirección: C/ Aragón 145, 08015 Barcelona
         • Observación: CIF B12345678

         Un operador emitirá la factura y te la enviará por email. La próxima vez no tendrás que repetir estos datos.
```

### Caso 13.1 — Datos ya guardados

```
Cliente: Necesito factura.
Bot:     Tienes los siguientes datos guardados:

         • Razón social: Tintorería Soler SL
         • Dirección: C/ Aragón 145, 08015 Barcelona
         • Observación: CIF B12345678

         ¿Los confirmo así o quieres modificar algo?

Cliente: Confírmalos.
Bot:     Perfecto. Un operador emitirá la factura y te la enviará por email.
```

---

## Caso 14 — Tarjeta de fidelización

**Overview** — Flujo de compra y recarga de la tarjeta de fidelización. La tarjeta cuesta 20 € en efectivo y **solo es válida en la sede donde se ha comprado** (no funciona en otras lavanderías laundroDemo).

**Conversación**

```
Cliente: Quiero comprar una tarjeta de fidelización.
Bot:     La tarjeta de fidelización cuesta 20 € en efectivo y solo funciona en la lavandería donde se compra. ¿En qué lavandería estás?

Cliente: Mar.
Bot:     Perfecto. En Mar (Badalona), pulsa el segundo botón en el lado derecho del tótem de pago, introduce los 20 € en monedas y la máquina te entregará la tarjeta. La podrás usar solo aquí en Mar.
```

### Caso 14.1 — Recarga de la tarjeta

```
Cliente: Quiero recargar mi tarjeta en Sants.
Bot:     En Sants (Barcelona), para recargar la tarjeta introdúcela en el tótem de pago y sigue las instrucciones de la pantalla. Si aparece algún mensaje extraño, dímelo y lo revisamos.
```

### Caso 14.2 — Tarjeta comprada en otra sede

```
Cliente: Tengo la tarjeta de Vilanova, ¿la puedo usar en Born?
Bot:     ⚠️ La tarjeta comprada en Vilanova (Sitges) solo funciona en esa lavandería. No es válida aquí en Born (Barcelona). Si necesitas una tarjeta para esta sede, puedes comprarla aquí mismo con 20 € en efectivo.
```

### Caso 14.3 — Tarjeta de otra cadena

```
Cliente: Tengo una tarjeta de la lavandería de Tarragona, ¿vale aquí?
Bot:     Lo siento, las tarjetas laundroDemo solo funcionan en nuestras 6 sedes (Barcelona, Badalona, Sitges y Sant Cugat). Si la tarjeta es de otra cadena, no es compatible.

         Si quieres una tarjeta laundroDemo, puedes comprarla en el tótem de pago: cuesta 20 € en efectivo y será válida solo en esta sede.
```

---

## Caso 15 — Mensaje al operador (Human Message)

**Overview** — Cuando una incidencia se escala, el bot genera un **briefing estructurado** que se envía al operador humano por email (y opcionalmente WhatsApp). El briefing contiene toda la información relevante recopilada durante la conversación, en el idioma configurado por la sede (por defecto español), independientemente del idioma del cliente.
**Conversación visible al cliente**

```
Cliente: Sigue sin arrancar la lavadora 7 de Sants, ya he probado todo.
Bot:     Lo siento. Voy a avisar a un operador para que active manualmente la máquina o te ayude con el cambio a otra. ¿Me confirmas tu nombre para el reporte?

Cliente: Laura Méndez.
Bot:     Gracias Laura. He registrado la incidencia. Un operador te contactará en unos minutos. 👋
```

**Briefing que recibe el operador** (email / WhatsApp)

```
👤 Mensaje para el operador
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🕒 Fecha: 26/05/2026 18:42
📍 Sede: Sants (Barcelona)
🔢 Máquina: 7
👤 Cliente: Laura Méndez
📞 Teléfono: +34 612 345 678

🚨 Incidencia
La lavadora 7 no arranca tras varios intentos.
La cliente confirma haber probado todo lo indicado por el bot
sin éxito. La pantalla muestra ERROR DOOR repetidamente.

📋 Resumen de la conversación
• Cliente reporta máquina 7 no arranca.
• Pantalla muestra ERROR DOOR.
• Cliente ha probado las instrucciones del bot sin éxito.
• Solicitada activación remota o cambio a otra lavadora.

✅ Acción sugerida
Activar máquina 7 en remoto o asistir al cambio de lavadora.
Posible revisión técnica de la goma de la puerta.
```

### Caso 15.1 — Briefing tras doble cobro

Conversación visible al cliente:

```
Cliente: Me ha cobrado dos veces en Vilanova.
Bot:     Lo siento mucho. ¿Has completado el servicio y me puedes pasar los últimos 4 dígitos de la tarjeta y una captura del cargo?

Cliente: Sí, he lavado. Tarjeta ****4523, te paso la captura.
Bot:     Gracias Carla. He registrado la incidencia y te paso el formulario de reembolso:
         👉 https://laundrodemo.demo/refund

         Un operador te contactará en cuanto reciba el formulario.
```

Briefing al operador:

```
👤 Mensaje para el operador
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🕒 Fecha: 26/05/2026 17:15
📍 Sede: Vilanova (Sitges)
👤 Cliente: Carla Soler
📞 Teléfono: +34 654 987 654
💳 Tarjeta: ****4523

🚨 Incidencia
Doble cobro confirmado por la cliente. Importe: 5,50 € × 2.
Servicio completado.

📋 Resumen de la conversación
• Cliente reporta cargo duplicado en Vilanova.
• Servicio completado correctamente.
• Tarjeta acabada en 4523, captura del cargo recibida.
• Cliente ha rellenado el formulario de reembolso.

✅ Acción sugerida
Revisar el segundo cargo de 5,50 € en la cuenta del TPV de Vilanova.
Tramitar reembolso vía formulario recibido.
```

### Caso 15.2 — Briefing con cliente en inglés

Conversación visible (en inglés):

```
Customer: My washing machine is broken at Born, machine 6.
Bot:      Sorry to hear that. Let me escalate to an operator. Can I confirm your name?

Customer: John Smith.
Bot:      Thanks John. An operator will contact you shortly.
```

Briefing al operador (siempre en `es` según configuración):

```
👤 Mensaje para el operador
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🕒 Fecha: 26/05/2026 19:03
📍 Sede: Born (Barcelona)
🔢 Máquina: 6
👤 Cliente: John Smith
🌐 Idioma de la conversación: Inglés

🚨 Incidencia
La lavadora 6 de Born presenta una avería según el cliente.
No se ha aportado código de pantalla.

✅ Acción sugerida
Contactar al cliente en inglés y diagnosticar el problema.
```

---

## Caso 16 — Escenario no contemplado (cierre de la demo)

**Overview** — Cuando el cliente formula una pregunta o pide una funcionalidad que no está prevista en ninguno de los casos documentados de esta demo, el bot reconoce el límite con honestidad y deja la puerta abierta a ampliar la cobertura en una versión definitiva adaptada al negocio real del cliente.

**Conversación**

```
Cliente: ¿Puedo reservar una lavadora con antelación para esta tarde?
Bot:     Aún no hemos contemplado este escenario. Esta es una demo que incluye los casos de uso que ves al lado del chat; en una versión definitiva adaptada a vuestra realidad podemos añadir muchos otros escenarios (reservas, programación, gestión de turnos, etc.) según vuestras necesidades.
```

### Caso 16.1 — Pregunta sobre suscripciones / planes

```
Cliente: ¿Tenéis algún plan mensual o suscripción para lavar varias veces a la semana?
Bot:     Aún no hemos contemplado este escenario. Esta es una demo enfocada en los casos de uso que aparecen al lado del chat. En una versión definitiva podemos incluir planes de suscripción, paquetes y descuentos personalizados según vuestro modelo de negocio.
```

### Caso 16.2 — Cliente en italiano

```
Cliente: Posso prenotare il ritiro della biancheria a domicilio?
Bot:     Non abbiamo ancora previsto questo scenario. Questa è una demo che include i casi d'uso che vedi a lato della chat; in una versione definitiva possiamo aggiungere molti altri scenari (ritiro a domicilio, consegna, gestione abbonamenti, ecc.) in base alle vostre esigenze.
```
