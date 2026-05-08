# Ecolaundry Chatbot -Usecases

Este documento reúne casos de conversación en español para configurar y probar el chatbot de Ecolaundry.

Cada caso incluye:
- objetivo
- cuándo aplica
- ejemplo de conversación
- resultado esperado
- cuándo escalar

Reglas generales para todos los casos:
- hacer una sola pregunta por turno
- identificar primero el local
- no diagnosticar sin saber qué aparece en pantalla cuando hay una incidencia de máquina
- no prometer compensaciones
- si el caso no encaja claramente, escalar a revisión

---

## Caso 1 — La lavadora no funciona y aparece PUSH PROG

**Objetivo:**  
Ayudar al cliente a iniciar el lavado cuando falta seleccionar el programa.

**Cuándo aplica:**  
El cliente ha pagado y la pantalla muestra `PUSH PROG`.

**Criterios de aceptación (caso completo):**
- Gather order: location → número de máquina → display. **No** se pregunta "¿has pagado?" como paso intermedio (PUSH PROG ya implica pago hecho).
- Sobre `displayState=PUSH`, el bot emite la lista canónica de 4 programas (60º / 40º / 30º / Frío) y cierra con un loopback ("dime si arranca").
- Closure positiva ("ahora funciona") → `mark_resolved` → `state.pendingClosure="resolved"`.
- Closure negativa ("sigue igual") → Phase B/C: el bot re-pide el código exacto antes de escalar (evita escalar por palabra ambigua). Vea Scenario 1.2.
- Variantes happy / escalación detalladas en Scenarios 1.1 y 1.2.

**Ejemplo de conversación:**

**Usuario:** La lavadora no funciona.  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. Te ayudo paso a paso. ¿En qué lavandería estás?

**Usuario:** Goya.  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 5.  
**Bot:** De acuerdo. ¿Qué aparece exactamente en la pantalla?

**Usuario:** PUSH PROG.  
**Bot:** Pulsa un botón de programa para iniciar el lavado.

Programas:
1. 60º (muy caliente) → ropa muy sucia, blanca o de trabajo
2. 40º (templado) → ropa normal (algodón, color)
3. 30º (suave) → ropa delicada o sintética
4. Frío → prendas muy delicadas (lana, seda, etc.)

Elige uno y púlsalo en la máquina. Después dime si la lavadora ha arrancado.

**Usuario:** Sí, ahora funciona.  
**Bot:** Perfecto, incidencia resuelta. Si vuelve a pasar o aparece otro mensaje en pantalla, dímelo y te sigo ayudando.

**Resultado esperado:**  
Incidencia resuelta.

**Escalar si:**  
- el cliente pulsa el programa y la máquina no responde
- el mensaje cambia a otro código no documentado

---

### Scenario 1.1 — PUSH PROG Happy Path

**Objetivo:** El cliente pulsa el programa y la lavadora arranca correctamente.

**Criterios de aceptación:**
- El bot recoge localización → número (sin paso intermedio "¿has pagado?").
- El bot da los 4 programas (60º, 40º, 30º, Frío) y cierra con la pregunta de loopback.
- Sobre confirmación "ahora funciona" → la respuesta contiene "perfecto" y ("resuelt" o "ya estaría").
- `state.pendingClosure === "resolved"` al final del flujo.

**Conversación:**

**Usuario:** La lavadora no funciona  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. Te ayudo paso a paso. ¿En qué lavandería estás?

**Usuario:** Goya  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 5  
**Bot:** De acuerdo. ¿Qué aparece exactamente en la pantalla?

**Usuario:** PUSH PROG  
**Bot:** Pulsa un botón de programa para iniciar el lavado.

Programas:
1. 60º (muy caliente) → ropa muy sucia, blanca o de trabajo
2. 40º (templado) → ropa normal (algodón, color)
3. 30º (suave) → ropa delicada o sintética
4. Frío → prendas muy delicadas (lana, seda, etc.)

Elige uno y púlsalo en la máquina. Después dime si la lavadora ha arrancado.

**Usuario:** Sí, ahora funciona  
**Bot:** Perfecto, incidencia resuelta. Si vuelve a pasar o aparece otro mensaje en pantalla, dímelo y te sigo ayudando.

---

### Scenario 1.2 — PUSH PROG Escalación: máquina no responde tras pulsar

**Objetivo:** El cliente pulsa el programa pero la máquina sigue sin
arrancar; el bot escala a soporte humano de manera uniforme con los
demás casos (Caso 5.2/5.3, Caso 7.2).

**Criterios de aceptación:**
- Tras la instrucción del programa, el cliente reporta que no responde ("he pulsado pero no responde", "sigue sin arrancar").
- El bot pide confirmación del display ("escribe el código exacto que ves") antes de escalar (Phase B re-ask, evita escalar por palabra ambigua).
- Sobre confirmación "PUSH PROG" → el bot escala con un mensaje que contiene "operador".
- Antes de cerrar, el bot pide el nombre del cliente.
- El mensaje final (tras `capture_customer_name`) contiene "desactivado".
- El resumen al operador contiene: nombre del cliente, location, número, "PUSH".

**Conversación:**

**Usuario:** La lavadora no funciona  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. ¿En qué lavandería estás?

**Usuario:** Goya  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 5  
**Bot:** De acuerdo. ¿Qué aparece en la pantalla?

**Usuario:** PUSH PROG  
**Bot:** Pulsa un botón de programa... [4 programmi] ...Después dime si la lavadora ha arrancado.

**Usuario:** He pulsado pero no responde  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** PUSH PROG  
**Bot:** ⚠️ Si nada ha funcionado, vamos a notificar al **operador** para que revise el caso. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias, Andrea. Un operador humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación. El chatbot será **desactivado**.

**👤 Human Support message** *(al operador)*  
Usuario Andrea en Goya ha pagado pero la lavadora número 5 no responde tras pulsar el programa. Pantalla muestra PUSH PROG. Requiere revisión manual.

---

## Caso 2 — La lavadora no funciona y aparece DOOR

**Objetivo:**  
Ayudar al cliente a cerrar correctamente la puerta.

**Cuándo aplica:**  
El cliente indica que en pantalla aparece `DOOR`.

**Criterios de aceptación (caso completo):**
- Gather order: location → número → display.
- Sobre `displayState=DOOR`, instrucción canónica: "abre y cierra la puerta hasta oír un clic, comprueba prendas atrapadas" + loopback ("dime si funciona").
- En el escalamiento final el handover summary debe mencionar la puerta (`puerta` / `DOOR`).
- Variantes happy / escalación detalladas en Scenarios 2.1 y 2.2.

**Ejemplo de conversación:**

**Usuario:** La lavadora no arranca.  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. Te ayudo. ¿En qué lavandería estás?

**Usuario:** Hortes.  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 2.  
**Bot:** De acuerdo. ¿Qué aparece exactamente en la pantalla?

**Usuario:** DOOR.  
**Bot:** Ese mensaje indica que la puerta no está bien cerrada. Ábrela y ciérrala bien, y vuelve a probar.

**Usuario:** Ahora sí funciona.  
**Bot:** Perfecto, ya estaría resuelto.

**Resultado esperado:**  
Incidencia resuelta.

**Escalar si:**  
- el mensaje `DOOR` sigue apareciendo
- el cliente repite el paso y no arranca

---

### Scenario 2.1 — DOOR Happy Path

**Objetivo:** El cliente confirma que la lavadora arranca tras cerrar bien la puerta.

**Criterios de aceptación:**
- El bot recoge localización y número de máquina antes de dar la instrucción DOOR.
- El bot indica que la puerta no está bien cerrada y pide abrirla y cerrarla firmemente.
- Después de la indicación, el bot pide al cliente confirmar si la máquina ha arrancado.
- El caso se cierra con un mensaje que contiene "perfecto" y "correctamente" o "comenzado".
- El bot NO escala a operador en este escenario.

**Conversación:**

**Usuario:** La lavadora no arranca  
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry, estoy aquí para ayudarte. ¿Qué aparece exactamente en la pantalla de la máquina?

**Usuario:** DOOR  
**Bot:** ¿En qué lavandería autoservicio estás?

**Usuario:** Hortes  
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 2  
**Bot:** La puerta no está cerrada correctamente. Ábrela y ciérrala firmemente. Después de intentarlo, házmelo saber si funciona.

**Usuario:** Sí  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

### Scenario 2.2 — DOOR Escalación: puerta bloqueada tras repetir el paso

**Objetivo:** El cliente cierra la puerta pero DOOR persiste. El bot re-pregunta el código y escala.

**Criterios de aceptación:**
- Si DOOR persiste tras repetir el paso, el bot re-pregunta el código exacto del display.
- Cuando el cliente confirma que DOOR sigue, el bot anuncia escalación con un mensaje que contiene "operador" y menciona "puerta" o "DOOR".
- Antes de escalar, el bot pregunta el nombre del cliente.
- El mensaje de confirmación final contiene "desactivado".
- El resumen al operador contiene nombre, localización, número de máquina y estado DOOR.
- El bot NO cierra el caso como resuelto en este escenario.

**Conversación:**

**Usuario:** La lavadora no arranca  
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry, estoy aquí para ayudarte. ¿Qué aparece exactamente en la pantalla de la máquina?

**Usuario:** DOOR  
**Bot:** ¿En qué lavandería autoservicio estás?

**Usuario:** Hortes  
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 2  
**Bot:** La puerta no está cerrada correctamente. Ábrela y ciérrala firmemente. Después de intentarlo, házmelo saber si funciona.

**Usuario:** NO  
**Bot:** Por favor, escribe solo lo que ves en la pantalla, los números y las letras tal y como aparecen en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** DOOR  
**Bot:** ⚠️ La puerta sigue bloqueada incluso después de repetir los pasos. Esto indica un posible fallo mecánico en el cierre de la puerta. Tenemos que notificar al operador ahora para que revise la lavadora manualmente. ¿Cómo te llamas?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Un operador humano se encargará de tu caso. El chatbot será desactivado.

👤 **Human Support:** Usuario Carlos en Hortes — pantalla DOOR tras repetir cierre, lavadora número 2. Requiere revisión manual del cierre de puerta.

---

## Caso 3 — La lavadora no funciona y aparece SEL

**Objetivo:**  
Ayudar al cliente cuando la máquina está pendiente de selección.

**Cuándo aplica:**  
El cliente ha pagado y la pantalla muestra `SEL`.

**Criterios de aceptación (caso completo):**
- Gather order: location → número → display.
- Sobre `displayState=SEL`, instrucción canónica: "comprueba que has pulsado bien el número de la máquina en la central de pago" + loopback. Diferente del Caso 1 (no se enseñan programas).
- Variantes happy / escalación detalladas en Scenarios 3.1 y 3.2.

**Ejemplo de conversación:**

**Usuario:** He pagado pero la lavadora no empieza.  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. Te ayudo. ¿En qué lavandería estás?

**Usuario:** Pineda.  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 3.  
**Bot:** Perfecto. ¿Qué aparece exactamente en la pantalla?

**Usuario:** SEL.  
**Bot:** Ese mensaje indica que la máquina está pendiente de selección. Comprueba, por favor, que has pulsado bien el número de la máquina o el programa correspondiente.

**Usuario:** Ya lo he hecho y ahora sí funciona.  
**Bot:** Perfecto, incidencia resuelta.

**Resultado esperado:**  
Incidencia resuelta.

**Escalar si:**  
- el cliente ya ha repetido la selección y la máquina sigue sin responder

---

### Scenario 3.1 — SEL Happy Path

**Objetivo:** El cliente confirma que la máquina arranca tras seguir la instrucción.

**Criterios de aceptación:**
- El bot recoge localización y número de máquina antes de dar la instrucción.
- El bot da la instrucción SEL ("pendiente de selección", comprobar número o programa).
- El caso se cierra con un mensaje que contiene "perfecto" y "comenzado" o "correctamente".

**Conversación:**

**Usuario:** He pagado pero la lavadora no empieza  
**Bot:** ¡Hola! ¿En qué lavandería autoservicio te encuentras?

**Usuario:** Pineda  
**Bot:** ¿Qué número de lavadora es?

**Usuario:** La 3  
**Bot:** ¿Qué aparece exactamente en la pantalla?

**Usuario:** SEL  
**Bot:** Ese mensaje indica que la máquina está pendiente de selección. Comprueba, por favor, que has pulsado bien el número de la máquina en la central de pago. Una vez lo hayas hecho, dime si la máquina ha empezado a funcionar.

**Usuario:** Ahora sí funciona  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

### Scenario 3.2 — SEL Escalación: error persiste tras repetir selección

**Objetivo:** El cliente repite la selección pero la máquina sigue mostrando SEL. El bot pide el código exacto y escala.

**Criterios de aceptación:**
- Si el cliente dice que no arranca, el bot re-pregunta el código exacto del display.
- Cuando el cliente confirma que sigue siendo SEL, el bot menciona "SEL" y "operador" en el mensaje de escalación.
- Antes de escalar, el bot pregunta el nombre del cliente.
- El mensaje de confirmación final contiene la palabra "desactivado".
- El resumen al operador contiene nombre del cliente, location, número de máquina y "SEL".

**Conversación:**

**Usuario:** He pagado pero la lavadora no empieza  
**Bot:** ¡Hola! ¿En qué lavandería autoservicio te encuentras?

**Usuario:** Pineda  
**Bot:** ¿Qué número de lavadora es?

**Usuario:** La 3  
**Bot:** ¿Qué aparece exactamente en la pantalla?

**Usuario:** SEL  
**Bot:** Ese mensaje indica que la máquina está pendiente de selección. Comprueba, por favor, que has pulsado bien el número de la máquina en la central de pago. Una vez lo hayas hecho, dime si la máquina ha empezado a funcionar.

**Usuario:** Aun no arranca  
**Bot:** Por favor, escribe solo lo que ves en la pantalla, los números y las letras tal y como aparecen en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** SEL  
**Bot:** ⚠️ La pantalla sigue mostrando SEL incluso después de repetir la selección. Tenemos que notificar al operador ahora para que revise la lavadora manualmente. ¿Cómo te llamas?

**Usuario:** Luis  
**Bot:** Gracias Luis. Un operador humano se encargará de tu caso. El chatbot será desactivado.

👤 **Human Support:** Usuario Luis en Pineda — pantalla SEL tras repetir selección, lavadora número 3.

---

## Caso 4 — He pagado y no se ha activado, y la central no ha devuelto el cambio

**Objetivo:**  
Detectar un posible error de selección de máquina.

**Cuándo aplica:**  
El cliente ha pagado, la máquina no se activa y la central no ha devuelto el cambio.

**Criterios de aceptación (caso completo):**
- Gather order específico: location → tipo → número → ¿la central te ha devuelto el cambio? **No** se pregunta por display (este caso reemplaza el display por la pregunta del cambio).
- Respuesta "No" → instrucción canónica que contiene `número` + `central` ("marca bien el número de la máquina en la central"); pendingFlow avanza a `no-change-await-confirmation`.
- Respuesta "Sí + sigue sin arrancar" → escalación inmediata (la central hizo su parte, no es error de selección). Vea Scenario 4.2.
- Variantes happy / escalación detalladas en Scenarios 4.1 y 4.2.

**Ejemplo de conversación:**

**Usuario:** He pagado y no se ha activado.  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. ¿En qué local estás?

**Usuario:** Goya.  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora.  
**Bot:** Perfecto. ¿Qué número de máquina es?

**Usuario:** La 4.  
**Bot:** De acuerdo. ¿La central te ha devuelto el cambio?

**Usuario:** No.  
**Bot:** Es posible que no se haya marcado bien el número de la máquina. Mira si todavía aparece saldo en la central y pulsa correctamente el botón correspondiente.

**Usuario:** Sí, ahora ya se ha puesto en marcha.  
**Bot:** Perfecto, ya estaría resuelto.

**Resultado esperado:**  
Incidencia resuelta.

**Escalar si:**  
- el cliente sigue sin poder activarla
- aparece un código de pantalla no documentado

---

### Scenario 4.1 — No-change Happy Path

**Objetivo:** Tras la guía sobre marcar el número correcto, la máquina arranca.

**Criterios de aceptación:**
- El bot recoge localización → tipo → número antes de preguntar por el cambio.
- Sobre "No" al cambio → el bot da la instrucción canonica (revisa saldo en central + marca el número).
- Sobre confirmación de arranque → reply contiene "perfecto" y ("resuelt" o "ya estaría").
- `state.pendingClosure === "resolved"` al final del flujo.

**Conversación:**

**Usuario:** He pagado y no se ha activado  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. ¿En qué local estás?

**Usuario:** Goya  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** Perfecto. ¿Qué número de máquina es?

**Usuario:** La 4  
**Bot:** De acuerdo. ¿La central te ha devuelto el cambio?

**Usuario:** No  
**Bot:** Es posible que no se haya marcado bien el número de la máquina. Mira si todavía aparece saldo en la central y pulsa correctamente el botón correspondiente.

**Usuario:** Sí, ahora ya se ha puesto en marcha  
**Bot:** Perfecto, ya estaría resuelto.

---

### Scenario 4.2 — No-change Escalación: cambio devuelto pero máquina no arranca

**Objetivo:** Si la central devolvió el cambio pero la máquina sigue sin
arrancar, el bot escala uniformemente con los demás casos.

**Criterios de aceptación:**
- Sobre "Sí" al cambio → la máquina sí cobró pero no arrancó. El bot
  escala con un mensaje que contiene "operador".
- Antes de cerrar, el bot pide el nombre del cliente.
- El mensaje final (tras `capture_customer_name`) contiene "desactivado".
- El resumen al operador contiene: nombre, location, número, "lavadora".

**Conversación:**

**Usuario:** He pagado y no se ha activado  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. ¿En qué local estás?

**Usuario:** Goya  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Qué número de máquina es?

**Usuario:** La 4  
**Bot:** ¿La central te ha devuelto el cambio?

**Usuario:** Sí, pero la máquina no arranca  
**Bot:** Vamos a revisar tu caso manualmente. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias, Andrea. Un **operador** humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación. El chatbot será **desactivado**.

**👤 Human Support message** *(al operador)*  
Usuario Andrea en Goya ha pagado pero la lavadora número 4 no se ha activado tras corregir el número en la central. Requiere revisión manual.

---

## Caso 5 — Error AL001

**Objetivo:**  
Explicar el motivo del error y corregir la secuencia de uso.

**Cuándo aplica:**  
El cliente indica que aparece `AL001`.

**Criterios de aceptación (caso completo):**
- Reconocimiento robusto del código: el extractor acepta `AL001`, `AL 001`, `ALM 001`, `alarm 001`, `alarma 001` (variantes naturales del cliente, normalizadas a `AL001`).
- Tras location + tipo + número, el bot emite la **secuencia de 6 pasos** del flow `al001-sequence-error` (declarativo en `json/display-flows.json`).
- Closure positiva ("ya funciona") → resolved con la respuesta canónica de cierre.
- Phase B/C: si tras los 6 pasos sigue saliendo AL001 o el cliente no entiende, re-pide código exacto y luego escala.
- Variantes happy / escalación detalladas en Scenarios 5.1, 5.2 y 5.3.

**Ejemplo de conversación:**

**Usuario:** Me sale AL001.  
**Bot:** Tranquilo, te ayudo. ¿En qué lavandería estás?

**Usuario:** L’Escala.  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora.  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 3.  
**Bot:** De acuerdo. Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. Antes de avisar a asistencia, vamos a verificar juntos la secuencia correcta. Por favor sigue estos pasos en este orden:

1. Carga la lavadora
2. Cierra la puerta
3. Dirígete a la central de pago y paga
4. Selecciona el número de máquina y recoge el cambio si toca
5. Dirígete a la máquina seleccionada y elige el programa
6. Avísame si funciona

**Usuario:** Ya funciona, gracias.  
**Bot:** Perfecto, incidencia resuelta.

**Si el cliente indica que NO funciona tras seguir los 6 pasos:**

**Bot:** Entendido, en ese caso voy a avisar a asistencia. ¿Me puedes decir tu nombre, por favor?

**Usuario:** Marco Rossi.  
**Bot:** Gracias, Marco. Aviso a asistencia con tus datos y el detalle de la incidencia. Te contactarán lo antes posible.

**Resultado esperado:**  
El bot identifica que el problema está en la secuencia de uso, guía al cliente con los 6 pasos en el orden correcto, y solo si el cliente confirma que no funciona pide el nombre y escala a asistencia.

**Escalar si (tras pedir el nombre):**  
- el cliente confirma que el error persiste después de seguir los 6 pasos en orden
- el cliente no puede seguir las instrucciones
- aparece otro código de pantalla diferente tras el reintento

---

### Scenario 5.1 — AL001 Happy Path

**Objetivo:** Explicar el motivo del error y corregir la secuencia de uso. El cliente confirma que funciona.

**Criterios de aceptación:**
- El bot recoge localización, tipo de máquina y número antes de dar la instrucción.
- El caso se cierra con un mensaje que contiene "perfecto" y "comenzado" o "correctamente".

**Conversación:**

**Usuario:** Me sale AL001  
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry. ¿En qué lavandería autoservicio te encuentras?

**Usuario:** L'Escala  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 3  
**Bot:** **AL001** significa un error de secuencia. Reinicia el proceso completo: 1. Paga. 2. Selecciona la máquina. 3. Pulsa el programa. 4. Cierra la puerta. 5. Avísame si funciona.

**Usuario:** Sí, ya funciona  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

### Scenario 5.2 — AL001 Escalación: cliente no puede seguir instrucciones

**Objetivo:** El cliente no entiende cómo aplicar la secuencia. El bot escala.

**Criterios de aceptación:**
- Si el cliente indica que no puede seguir las instrucciones, el bot escala a soporte humano.
- Antes de escalar, el bot pregunta el nombre del cliente.
- El mensaje de escalación contiene la palabra "operador".
- El mensaje de confirmación final contiene la palabra "desactivado".

**Conversación:**

**Usuario:** Me sale AL001  
**Bot:** ¡Hola! ¿En qué lavandería autoservicio te encuentras?

**Usuario:** L'Escala  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 3  
**Bot:** **AL001** significa un error de secuencia. [instrucciones de secuencia]

**Usuario:** No entiendo cómo hacerlo  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** AL001  
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador para que revise el caso y la posible compensación. ¿Cómo te llamas?

**Usuario:** María  
**Bot:** Gracias María. Un operador humano se encargará de tu caso. El chatbot será desactivado.

👤 **Human Support:** Usuario María en L'Escala — problema técnico lavadora número 3. Pantalla: AL001.

---

### Scenario 5.3 — AL001 Escalación: error persiste tras reinicio correcto

**Objetivo:** El cliente ha seguido la secuencia correctamente pero AL001 persiste. El bot confirma el código y escala.

**Criterios de aceptación:**
- Si el cliente dice que ha seguido los pasos pero el error persiste, el bot vuelve a preguntar el código exacto del display.
- Cuando el cliente confirma que sigue siendo AL001, el bot escala a soporte humano.
- Antes de escalar, el bot pregunta el nombre del cliente.
- El mensaje de escalación contiene la palabra "operador".
- El mensaje de confirmación final contiene la palabra "desactivado".

**Conversación:**

**Usuario:** Me sale AL001  
**Bot:** ¡Hola! ¿En qué lavandería autoservicio te encuentras?

**Usuario:** L'Escala  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 3  
**Bot:** **AL001** significa un error de secuencia. [instrucciones de secuencia]

**Usuario:** Lo he hecho bien pero sigue saliendo  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** AL001  
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador para que revise el caso y la posible compensación. ¿Cómo te llamas?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Un operador humano se encargará de tu caso. El chatbot será desactivado.

👤 **Human Support:** Usuario Carlos en L'Escala — problema técnico lavadora número 3. Pantalla: AL001.

---

## Caso 6 — Me han cobrado dos veces pero he podido usar el servicio

**Objetivo:**  
Recoger los datos mínimos para revisión y devolución.

**Cuándo aplica:**  
El cliente dice que ha habido doble cobro, pero sí ha podido lavar o secar.

**Criterios de aceptación (caso completo):**
- Gather específico (no es problema técnico): location → ¿has podido lavar/secar? → relato paso a paso (con sugerencia "datáfono") → últimos 4 dígitos de tarjeta → captura del pago + nombre.
- Cierre tras nombre: mensaje de confirmación con `formulario` / `devolución` (NO con `desactivado`, no es escalación de máquina).
- Resumen al operador contiene: nombre, location, "doble cobro", relato del cliente.
- Vías de escalación inmediata: cliente muy enfadado + "operador" (Scenario 6.2), relato contradictorio (Scenario 6.3 → cae a Caso 28 detector).
- Variantes detalladas en Scenarios 6.1, 6.2 y 6.3.

**Ejemplo de conversación:**

**Usuario:** Me habéis cobrado dos veces con la tarjeta.  
**Bot:** Lo revisamos contigo. ¿En qué lavandería estás?

**Usuario:** Goya.  
**Bot:** Gracias. ¿Has podido lavar o secar la ropa?

**Usuario:** Sí.  
**Bot:** De acuerdo. Explícame, por favor, paso a paso qué has hecho desde que has entrado.

**Usuario:** He pagado, no iba y volví a pasar la tarjeta.  
**Bot:** Gracias. Para revisarlo bien, necesito los últimos 4 dígitos de la tarjeta.

**Usuario:** 4821.  
**Bot:** Perfecto. Ahora necesito una captura del pago.

**Usuario:** Vale.  
**Bot:** Gracias. Con esos datos podremos revisarlo y enviarte el formulario de devolución. La próxima vez, antes de volver a pagar, contacta con nosotros y te ayudaremos al momento.

**Resultado esperado:**  
Datos recogidos y caso preparado para revisión.

**Escalar si:**  
- el importe no cuadra con el local
- el relato es confuso
- el cliente está muy molesto

---

### Scenario 6.1 — Doble cobro, servicio completado (Happy Path)

**Objetivo:** El cliente aporta todos los datos; el caso queda preparado para revisión sin escalación en vivo.

**Criterios de aceptación:**
- El bot pregunta la localización antes de cualquier otra información.
- El bot NO pregunta tipo ni número de máquina (no es un problema técnico de la máquina).
- El bot pregunta si el cliente pudo completar el lavado o secado.
- El bot solicita el relato paso a paso, incluyendo la sugerencia de si pasó la tarjeta varias veces por el datáfono.
- El bot solicita los últimos 4 dígitos de la tarjeta.
- El bot solicita una captura del pago.
- El bot pregunta el nombre del cliente.
- El mensaje de cierre tras el nombre confirma la revisión y el formulario de devolución.
- El mensaje final NO contiene "operador" ni "desactivado".

**Conversación:**

**Usuario:** Me habéis cobrado dos veces con la tarjeta.  
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry y estoy aquí para ayudarte. ¿En qué lavandería te encuentras? (indica la ciudad y la calle)

**Usuario:** Goya  
**Bot:** ¿Pudiste completar el lavado o secado?

**Usuario:** Sí  
**Bot:** De acuerdo. ¿Podrías explicarme, por favor, paso a paso qué has hecho desde que has entrado? ¿Es posible que hayas pasado varias veces la tarjeta por el datáfono?

**Usuario:** He pagado, no iba y volví a pasar la tarjeta.  
**Bot:** ¡Gracias! Para revisarlo bien, ¿podrías indicarme los últimos 4 dígitos de la tarjeta?

**Usuario:** 4821  
**Bot:** ¡Perfecto! ¿Podrías enviarme una captura del pago? Con esos datos podremos revisarlo y enviarte el formulario de devolución. La próxima vez, antes de volver a pagar, contáctanos y te ayudamos al momento. ¿Cómo te llamas?

**Usuario:** Goya  
**Bot:** Tranquilo/a, Goya. Hemos recibido toda la información necesaria para tu caso. Vamos a revisar tu situación y te enviaremos un formulario de reembolso. Si necesitas algo más, aquí estoy para ayudarte.

---

### Scenario 6.2 — Escalación: cliente muy molesto que exige atención humana

**Objetivo:** El cliente indica que está muy enfadado y quiere hablar con una persona. El bot escala inmediatamente.

**Criterios de aceptación:**
- Si el cliente indica que está muy molesto y exige hablar con una persona, el bot escala inmediatamente.
- Antes de escalar, el bot pregunta el nombre del cliente junto con el mensaje de escalación.
- El mensaje de escalación contiene la palabra "operador".
- El mensaje de confirmación final contiene la palabra "desactivado".
- El bot NO continúa recogiendo datos de revisión.

**Conversación:**

**Usuario:** Me habéis cobrado dos veces, estoy muy enfadado y quiero hablar con un operador ahora mismo.  
**Bot:** ⚠️ Necesitamos derivar tu caso a un operador para revisarlo. ¿Cómo te llamas?

**Usuario:** María  
**Bot:** Gracias María. Un operador humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación. El chatbot será desactivado.

👤 **Human Support:** Usuario María en ubicación no identificada ha reportado un doble cobro con tarjeta.

---

### Scenario 6.3 — Escalación: relato inconsistente o importe no cuadra

**Objetivo:** El relato del cliente tiene inconsistencias. El bot escala sin solicitar más datos.

**Criterios de aceptación:**
- El bot sigue el flujo estándar hasta solicitar el relato.
- Cuando el relato es inconsistente (no sé exactamente, importe no cuadra), el bot escala.
- Antes de escalar, el bot pregunta el nombre del cliente junto con el mensaje de escalación.
- El mensaje de escalación contiene la palabra "operador".
- El mensaje de confirmación final contiene la palabra "desactivado".
- El bot NO continúa solicitando dígitos de tarjeta ni captura.

**Conversación:**

**Usuario:** Me habéis cobrado dos veces con la tarjeta.  
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry y estoy aquí para ayudarte. ¿En qué lavandería te encuentras?

**Usuario:** Goya  
**Bot:** ¿Pudiste completar el lavado o secado?

**Usuario:** Sí  
**Bot:** De acuerdo. ¿Podrías explicarme paso a paso qué has hecho desde que has entrado?

**Usuario:** No sé exactamente, creo que me han cobrado tres o cuatro veces, el importe no me cuadra.  
**Bot:** ⚠️ Necesitamos derivar tu caso a un operador para revisarlo. ¿Cómo te llamas?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Un operador humano se encargará de tu caso. El chatbot será desactivado.

👤 **Human Support:** Usuario Carlos en Goya ha reportado un doble cobro con tarjeta.

---

## Caso 7 — He pagado pero no he podido usar el servicio

**Objetivo:**  
Comprobar si la central devolvió el cambio y reconducir al flujo correcto.

**Cuándo aplica:**  
El cliente pagó, pero no llegó a usar la máquina.

**Criterios de aceptación (caso completo):**
- Gather order: location → tipo → número → ¿la central te ha devuelto el cambio?
- Reconducción de flujo: si el cliente, en lugar de responder yes/no a la pregunta del cambio, responde con un código de display (ej. `PUSH PROG`), el LLM lo reconoce y reenruta hacia el flujo de display correspondiente.
- Cuando el flow de display da resultado positivo → resolved.
- Cuando "no responde" tras la instrucción → Phase B/C escalada con resumen al operador que contiene `PUSH` / display relevante.
- Variantes happy / escalación detalladas en Scenarios 7.1 y 7.2.

**Ejemplo de conversación:**

**Usuario:** He pagado y no he podido usar la máquina.  
**Bot:** Te ayudo a revisarlo. ¿En qué lavandería estás?

**Usuario:** Pineda.  
**Bot:** Gracias. ¿La central te ha devuelto el cambio?

**Usuario:** Sí.  
**Bot:** De acuerdo. ¿Qué aparece exactamente en la pantalla de la máquina?

**Usuario:** PUSH PROG.  
**Bot:** Perfecto. Pulsa ahora el programa que quieras usar y dime si la máquina responde.

**Usuario:** Ahora sí.  
**Bot:** Perfecto, ya estaría resuelto.

**Resultado esperado:**  
Resolución o redirección al flujo de pantalla.

**Escalar si:**  
- tras seguir el paso, la máquina no responde
- el cliente no sabe leer la pantalla y no puede enviar foto

---

### Scenario 7.1 — Pagado sin usar, resuelto vía pantalla PUSH PROG (Happy Path)

**Objetivo:** El cliente pagó pero no pudo usar la máquina. Tras recoger tipo y número, el bot detecta PUSH PROG como respuesta a la pregunta del cambio y guía la selección de programa. El cliente confirma que la lavadora arranca.

**Criterios de aceptación:**
- El bot recoge localización, tipo de máquina y número antes de preguntar por el cambio.
- El bot reconoce que "PUSH PROG" es un código de pantalla aunque el cliente lo dé como respuesta a la pregunta del cambio.
- El caso se cierra con un mensaje que contiene "perfecto" o "comenzado".

**Conversación:**

**Usuario:** He pagado y no he podido usar la máquina.  
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry. ¿En qué lavandería autoservicio te encuentras?

**Usuario:** Pineda  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 5  
**Bot:** ¿La central ha devuelto el cambio?

**Usuario:** PUSH PROG  
**Bot:** Presiona un botón de programa para iniciar el lavado. Programas: 60º Molt calent → ropa muy sucia; 40º Calent → ropa normal; 30º Temperat → ropa delicada; Frío → prendas muy delicadas. Después avísame si funciona.

**Usuario:** Ahora sí  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

### Scenario 7.2 — Pagado sin usar, máquina no responde tras paso indicado (Escalación)

**Objetivo:** El cliente pagó y la pantalla mostraba PUSH PROG, pero tras pulsar el programa la máquina no arranca. El bot re-pregunta el código, el cliente describe el bloqueo, y el bot escala.

**Criterios de aceptación:**
- El bot recoge localización, tipo y número antes de preguntar por el cambio.
- Tras la instrucción, si la máquina no arranca el bot pide el código exacto de pantalla.
- El bot escala indicando el operador y pregunta el nombre.
- El mensaje de confirmación final contiene "desactivado".
- El resumen al operador contiene el nombre del cliente, la localización, el número de máquina y el código de pantalla.

**Conversación:**

**Usuario:** He pagado y no he podido usar la máquina.  
**Bot:** ¡Hola! ¿En qué lavandería autoservicio te encuentras?

**Usuario:** Pineda  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 5  
**Bot:** ¿La central ha devuelto el cambio?

**Usuario:** PUSH PROG  
**Bot:** Presiona un botón de programa para iniciar el lavado. [programas] Después avísame.

**Usuario:** no arranca  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** se ha bloqueado  
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador para que revise el caso y la posible compensación. ¿Cómo te llamas?

**Usuario:** Luis  
**Bot:** Gracias Luis. Un operador humano se encargará de tu caso. El chatbot será desactivado.

👤 **Human Support:** Usuario Luis en Pineda ha efectuado el pago por la lavadora número 5. El cliente seleccionó el programa pero se ha bloqueado. La pantalla muestra: PUSH.

---

## Caso 8 — Tengo un código de descuento

**Objetivo:**  
Validar el formato del código del cliente y, si es correcto, recoger los
datos necesarios y derivar al operador para la activación remota de la
máquina.

**Cuándo aplica:**  
El cliente tiene un código de descuento (formato: 3 letras + fecha
DDMMYY + importe, ej. `SAU2904266`).

**Criterios de aceptación (caso completo):**
- Validación del formato `^[A-Z]{3}\d{6,7}$` antes de seguir. Códigos solo numéricos sin letras → cae a Caso 18 (incoherencia).
- Cuando el formato es válido: el bot recoge nombre + location + número de máquina + estado de la puerta, en este orden.
- El resumen al operador contiene los datos parseados (`letras`, `fechaIso`, `importe`) + la máquina + el estado de puerta, para activación remota.
- Cuando el formato no encaja: escalación con "código no reconocido, requiere revisión manual" — sin discutir con el cliente.
- Variantes detalladas en Scenarios 8.1 y 8.2.

**Ejemplo de conversación:**

**Usuario:** Tengo un código y no sé cómo usarlo.  
**Bot:** Te ayudo. ¿Podrías indicarme, por favor, el código exacto tal como lo ves, incluyendo letras si las hay?

**Usuario:** SAU2904266.  
**Bot:** ¡Gracias! ¿Cuál es tu nombre?

**Usuario:** Andrea.  
**Bot:** ¿En qué pueblo / lavandería quieres usarlo?

**Usuario:** Goya.  
**Bot:** ¿Qué número de máquina deseas usar?

**Usuario:** 5.  
**Bot:** ¿La tienes cargada y con la puerta cerrada?

**Usuario:** Sí.  
**Bot:** Dame un minuto, hacemos las comprobaciones correspondientes. Si el código es correcto, te activaremos la máquina. 🙂  
*(seguido del resumen al operador con código parseado, fecha ISO, importe y datos máquina)*

**Notas de comportamiento:**

- Formato esperado: `^[A-Z]{3}\d{6}\d+$` → 3 letras (`SAU`) + 6 dígitos
  fecha DDMMYY (`290426` → `2026-04-29`) + importe en dígitos (`6`).
- Si el formato **no encaja**, el bot escala directamente con motivo
  "código con formato no reconocido" sin seguir recogiendo datos.
- Si la lavandería o el número de máquina ya están en el contexto, el
  bot omite esas preguntas.
- El operador valida el código y activa remotamente la máquina; tras la
  activación responde manualmente al cliente con un mensaje del tipo
  *"La máquina ya está activada, ¿ya funciona?"* (no es enviado por el
  bot).

**Resultado esperado:**  
Datos completos en manos del operador, listos para validación + activación remota.

**Escalar si:**  
- el código no encaja con el formato esperado
- el cliente dice que solo hay números y no hay letras delante

---

### Scenario 8.1 — Código: Happy Path (bot pide solo el código)

**Objetivo:** El bot reconoce el intent del código y pide el código exacto sin mezclar otras preguntas.

**Criterios de aceptación:**
- El bot saluda como asistente virtual de Ecolaundry en la primera respuesta.
- La respuesta menciona la palabra "código".
- El bot pide SOLO el código (no pregunta también por la lavandería en el mismo turno).
- El bot NO pregunta si es lavadora o secadora.
- El bot NO pregunta qué aparece en la pantalla.
- El bot NO escala a operador.

**Conversación:**

**Usuario:** Tengo un código y no sé cómo usarlo.  
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry, estoy aquí para ayudarte. Te ayudo con el código. ¿Me dices el código exacto tal como lo ves, incluyendo letras si las hay?

---

### Scenario 8.2 — Código: Variante (misma respuesta canned)

**Objetivo:** Variante del mismo trigger, misma respuesta del bot.

**Criterios de aceptación:**
- El bot saluda como asistente virtual de Ecolaundry en la primera respuesta.
- La respuesta menciona la palabra "código".
- El bot NO pregunta si es lavadora o secadora.

**Conversación:**

**Usuario:** Tengo un código de descuento, ¿cómo lo uso?  
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry, estoy aquí para ayudarte. Te ayudo con el código. ¿Me dices el código exacto tal como lo ves, incluyendo letras si las hay?

---

## Caso 9 — Quiero una factura

**Objetivo:**  
Recoger interactivamente todos los datos necesarios para emitir la factura
y derivar el caso al operador con un resumen completo.

**Cuándo aplica:**  
El cliente pide factura.

**Criterios de aceptación (caso completo):**
- Gather order de 8 pasos: lavandería → tipo → razón social → dirección → CIF → fecha (acepta "hoy" / "ayer" → ISO) → email → nombre.
- Si location y/o tipo ya están en sticky state (de un turno anterior), el bot **omite** esos pasos y empieza directamente desde razón social.
- Validación rigurosa de email (formato `algo@dominio.tld`): si no es válido → re-ask hasta que lo sea, **sin avanzar** al paso del nombre.
- El reply final tras nombre contiene: nombre, email válido, "human support" trigger.
- El resumen al operador contiene **todos** los campos billing (razón social, dirección, CIF, fecha ISO, email, nombre).
- Variantes happy / email-retry detalladas en Scenarios 9.1 y 9.2.

**Ejemplo de conversación:**

**Usuario:** Quiero una factura.  
**Bot:** Claro, te ayudo con la factura. 🙂 ¿En qué lavandería estuviste?

**Usuario:** Goya.  
**Bot:** Gracias. ¿Utilizaste lavadora o secadora?

**Usuario:** Lavadora.  
**Bot:** Perfecto. ¿Me indicas la razón social?

**Usuario:** ACME SL.  
**Bot:** ¿Y la dirección?

**Usuario:** Calle Mayor 1, Madrid.  
**Bot:** ¿Cuál es tu CIF/NIF/NIE?

**Usuario:** B12345678.  
**Bot:** ¿Qué día utilizaste el servicio? (puedes decirme "hoy", "ayer" o una fecha)

**Usuario:** Ayer.  
**Bot:** ¿A qué correo electrónico te enviamos la factura?

**Usuario:** ana.  
**Bot:** El correo no parece válido. ¿Puedes escribírmelo de nuevo, por favor?

**Usuario:** ana@example.com.  
**Bot:** Por último, ¿cuál es tu nombre?

**Usuario:** Andrea.  
**Bot:** Gracias Andrea, te enviaremos pronto la factura del 2026-05-05 a tu correo: ana@example.com. 🙂  
*(seguido del resumen al operador con todos los datos recogidos)*

**Notas de comportamiento:**

- Si la lavandería o el tipo de máquina ya están en el contexto de la
  conversación (porque el cliente los ha mencionado antes), el bot omite
  esas preguntas y pasa directamente a la razón social.
- El email se valida: si no tiene formato `algo@dominio.tld` el bot vuelve
  a preguntarlo hasta recibir uno válido (no se avanza sin email).
- Las fechas relativas ("hoy", "ayer", "anteayer", "oggi", "ieri",
  "today", "yesterday", "hier"…) se normalizan a ISO `YYYY-MM-DD`. Si el
  cliente escribe texto libre se conserva tal cual y se pasa al operador.

**Resultado esperado:**  
Datos completos en manos del operador, cliente avisado del envío.

**Escalar si:**  
- el cliente plantea una excepción no contemplada

---

### Scenario 9.1 — Factura Happy Path

**Objetivo:** Recogida completa de los 8 datos de facturación con email
válido al primer intento, cierre con el riepilogo + despedida personalizada.

**Criterios de aceptación:**
- El bot pregunta los 8 campos en orden: lavandería, tipo, razón social,
  dirección, CIF/NIF/NIE, fecha, email, nombre.
- Si la lavandería o el tipo de máquina ya están en sticky state, los
  steps 1-2 se saltan y se pregunta directamente la razón social.
- El email se valida (`algo@dominio.tld`) ANTES de pedir el nombre.
- Sobre nombre dado → reply contiene el nombre del cliente, el email y
  la fecha (raw o ISO).
- El handover summary al operador contiene: razón social, dirección,
  CIF, fecha, email.

**Conversación:**

**Usuario:** Quiero una factura  
**Bot:** Claro, te ayudo con la factura. ¿En qué lavandería estuviste?

**Usuario:** Goya  
**Bot:** Gracias. ¿Utilizaste lavadora o secadora?

**Usuario:** Lavadora  
**Bot:** Perfecto. ¿Me indicas la razón social?

**Usuario:** ACME SL  
**Bot:** ¿Y la dirección?

**Usuario:** Calle Mayor 1, Madrid  
**Bot:** ¿Cuál es tu CIF/NIF/NIE?

**Usuario:** B12345678  
**Bot:** ¿Qué día utilizaste el servicio? (puedes decirme "hoy", "ayer" o una fecha)

**Usuario:** Ayer  
**Bot:** ¿A qué correo electrónico te enviamos la factura?

**Usuario:** ana@example.com  
**Bot:** Por último, ¿cuál es tu nombre?

**Usuario:** Andrea  
**Bot:** Gracias Andrea, te enviaremos pronto la factura del 2026-05-07 a tu correo: ana@example.com.

**👤 Human Support message** *(al operador)*  
Usuario Andrea ha solicitado factura. Datos: razón social ACME SL; dirección Calle Mayor 1, Madrid; CIF B12345678; fecha 2026-05-07; máquina lavadora; email ana@example.com.

---

### Scenario 9.2 — Factura: email inválido → re-ask hasta que sea válido

**Objetivo:** Si el cliente escribe un email mal formado, el bot vuelve a
pedirlo en el mismo step sin avanzar al nombre. La validación se aplica
hasta que el formato es correcto.

**Criterios de aceptación:**
- Sobre email mal formado (e.g. "ana", "ana@dominio", "abc") → reply
  contiene "no parece válido" o equivalente y vuelve a pedir el correo.
- El bot NO avanza al step "nombre" hasta recibir un email con formato
  `algo@dominio.tld`.
- Sobre email válido al segundo intento → continúa al nombre y luego
  al cierre canónico.

**Conversación:**

**Usuario:** Quiero una factura  
**Bot:** Claro, te ayudo con la factura. ¿En qué lavandería estuviste?

**Usuario:** Goya  
**Bot:** Gracias. ¿Utilizaste lavadora o secadora?

**Usuario:** Lavadora  
**Bot:** Perfecto. ¿Me indicas la razón social?

**Usuario:** ACME SL  
**Bot:** ¿Y la dirección?

**Usuario:** Calle Mayor 1, Madrid  
**Bot:** ¿Cuál es tu CIF/NIF/NIE?

**Usuario:** B12345678  
**Bot:** ¿Qué día utilizaste el servicio?

**Usuario:** Ayer  
**Bot:** ¿A qué correo electrónico te enviamos la factura?

**Usuario:** ana  
**Bot:** El correo no parece válido. ¿Puedes escribírmelo de nuevo, por favor?

**Usuario:** ana@example.com  
**Bot:** Por último, ¿cuál es tu nombre?

**Usuario:** Andrea  
**Bot:** Gracias Andrea, te enviaremos pronto la factura del 2026-05-07 a tu correo: ana@example.com.

---

## Caso 10 — Cómo comprar la tarjeta de fidelización

**Objetivo:**  
Explicar compra y limitación de uso de la tarjeta.

**Cuándo aplica:**  
El cliente quiere adquirir una tarjeta.

**Ejemplo de conversación:**

**Usuario:** ¿Cómo consigo la tarjeta de fidelización?  
**Bot:** La tarjeta de fidelización se compra con 20 € en efectivo y solo funciona en la tienda donde se ha comprado.

**Usuario:** Estoy en Goya.  
**Bot:** Perfecto. En Goya, en la central de botones, debes pulsar el segundo botón de la línea de la derecha.

**Usuario:** Entendido.  
**Bot:** Perfecto.

**Resultado esperado:**  
Consulta cerrada.

**Escalar si:**  
- el cliente describe una central distinta o una situación no documentada

---

## Caso 11 — Cómo recargar la tarjeta de fidelización

**Objetivo:**  
Explicar la recarga de forma simple.

**Cuándo aplica:**  
El cliente ya tiene tarjeta y quiere recargarla.

**Ejemplo de conversación:**

**Usuario:** ¿Cómo recargo la tarjeta?  
**Bot:** Introduce la tarjeta y sigue las instrucciones de la central.

**Usuario:** Vale.  
**Bot:** Perfecto. Si al hacerlo aparece algún mensaje extraño, dímelo y lo revisamos.

**Resultado esperado:**  
Consulta cerrada.

**Escalar si:**  
- aparece un error no documentado
- la central no responde

---

## Caso 12 — Horarios y precios

**Objetivo:**  
Responder consultas generales sin inventar datos.

**Cuándo aplica:**  
El cliente pregunta por horarios o precios.

**Ejemplo de conversación A — Horario general**

**Usuario:** ¿Cuál es el horario?  
**Bot:** El horario general de atención al público es de 8:00 a 22:00 cada día del año.

**Ejemplo de conversación B — Excepción de L’Escala**

**Usuario:** ¿Y en L’Escala?  
**Bot:** En L’Escala, las máquinas se pueden utilizar de 7:00 a 23:00.

**Ejemplo de conversación C — Precio no confirmado**

**Usuario:** ¿Cuánto cuesta esta máquina?  
**Bot:** Tengo que revisarlo antes de confirmarte ese importe.

**Ejemplo de conversación D — Cliente escribe en otro idioma (input)**

El tenant Ecolaundry corre en **ES** (todas las respuestas en español),
pero los clientes pueden escribir en cualquiera de las 6 lenguas
soportadas. El bot debe reconocer la pregunta de horarios y responder.

**Usuario (IT):** ciao  
**Bot:** Hola, soy el asistente virtual de la lavandería. Cuéntame, ¿en qué te ayudo? 🙂

**Usuario (IT):** che orari avete?  
**Bot:** El horario general de atención al público es de 8:00 a 22:00 cada día del año.

(equivalente para EN/FR/PT/CA: el bot SIEMPRE responde en ES, pero el
input multilingüe es reconocido por `HORARIOS_TOPIC` y `PRECIO_TOPIC` en
[`utils/guards/hours-and-pricing.ts`](../utils/guards/hours-and-pricing.ts).)

**Resultado esperado:**  
Consulta informativa resuelta o derivada correctamente.

**Escalar si:**  
- el precio no está confirmado
- el cliente pide una excepción o una tarifa no documentada

---

## Caso 13 — Escalado por código de alarma o incoherencia

**Objetivo:**  
Escalar sin confrontar al cliente, recopilando los datos mínimos para el operador.

**Cuándo aplica:**  
Aparece `ALM`, `ALN`, `001`, un código no documentado, o hay incoherencias en el relato o en el importe.

**Ejemplo de conversación:**

**Usuario:** He pagado y ahora sale ALN.  
**Bot:** Hola, soy el asistente virtual de la lavandería. Tranquilo, te ayudo. ¿Dónde está la lavandería?

**Usuario:** Goya.  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora.  
**Bot:** Perfecto. ¿Qué número de lavadora es?

**Usuario:** La 5.  
**Bot:** El código ALN requiere revisión manual. Pasaremos tu caso a revisión para ayudarte de la manera más adecuada. ¿Cómo te llamas?

**Usuario:** Andrea.  
**Bot:** Hemos pasado tu caso a revisión. Un operador se pondrá en contacto contigo para ayudarte. Gracias por tu paciencia, Andrea.

**Resultado esperado:**  
Caso escalado correctamente con los datos mínimos (local + tipo + número + display).

**Escalar si:**  
- siempre, en este tipo de códigos o incoherencias


 

## Caso 14 — La lavadora muestra ALM DOOR

**Objetivo:**  
Gestionar correctamente un problema de cierre o una posible prenda atrapada antes de escalar.

**Cuándo aplica:**  
El cliente indica que en pantalla aparece `ALM DOOR`.

**Ejemplo de conversación:**

**Usuario:** La lavadora no funciona y pone ALM DOOR.  
**Bot:** Tranquilo, te ayudo. ¿En qué lavandería estás?

**Usuario:** Goya.  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 6.  
**Bot:** De acuerdo. Ese mensaje puede indicar un problema de cierre o que hay alguna pieza atrapada. Abre la puerta con cuidado, revisa si hay alguna prenda atrapada y vuelve a cerrarla bien.

**Usuario:** Ya lo he hecho.  
**Bot:** Perfecto. Dime, por favor, si el mensaje ha desaparecido.

**Usuario:** No.  
**Bot:** Gracias. Vamos a pasar tu caso a revisión para ayudarte de la manera más adecuada.

**Resultado esperado:**  
Escalado correcto si el mensaje no desaparece.

**Escalar si:**  
- el mensaje no desaparece
- el cliente no puede realizar la comprobación
- la puerta sigue bloqueada

---

## Caso 15 — La máquina muestra 001

**Objetivo:**  
Reconocer un caso que debe escalarse siempre.

**Cuándo aplica:**  
El cliente indica que aparece `001`.

**Ejemplo de conversación:**

**Usuario:** En la pantalla sale 001.  
**Bot:** Gracias. ¿En qué lavandería estás?

**Usuario:** Pineda.  
**Bot:** De acuerdo. Ese mensaje puede aparecer cuando el programa se ha seleccionado antes del pago y el estado no se ha reiniciado correctamente.

**Usuario:** ¿Qué hago?  
**Bot:** Vamos a revisarlo manualmente para ayudarte de la mejor manera posible.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre

---

## Caso 16 — La máquina muestra ALM, ALN o un código de alarma similar

**Objetivo:**  
Detectar una alarma de máquina y escalar sin hacer manipular más al cliente, recopilando los datos mínimos para el operador.

**Cuándo aplica:**  
El cliente indica `ALM`, `ALN`, `ALN A`, `ALN N` o un código de alarma similar.

**Ejemplo de conversación:**

**Usuario:** La secadora pone ALN.  
**Bot:** Hola, soy el asistente virtual de la lavandería. Tranquilo, te ayudo. ¿Dónde está la lavandería?

**Usuario:** Alemanya.  
**Bot:** Gracias. ¿Qué número de secadora es?

**Usuario:** La 4.  
**Bot:** El código ALN requiere revisión manual. Pasaremos tu caso a revisión para ayudarte de la manera más adecuada. ¿Cómo te llamas?

**Usuario:** Andrea.  
**Bot:** Hemos pasado tu caso a revisión. Un operador se pondrá en contacto contigo para ayudarte. Gracias por tu paciencia, Andrea.

**Resultado esperado:**  
Caso escalado correctamente con los datos mínimos (local + tipo + número + display).

**Escalar si:**  
- siempre

---

## Caso 17 — El cliente no sabe qué aparece en pantalla

**Objetivo:**  
Escalar cuando no se puede obtener el estado de pantalla.

**Cuándo aplica:**  
El cliente no sabe leer el display o no ve bien la pantalla.

**Nota de implementación:** la subida de fotos NO está soportada hoy. Sin
información del display el bot no puede dar instrucciones recuperables, así
que escala directamente tras location + tipo. Si en el futuro se habilita
el upload de fotos, este caso pasará por un paso intermedio de petición.

**Ejemplo de conversación:**

**Usuario:** La máquina no va, pero no sé qué pone.  
**Bot:** Tranquilo, lo revisamos juntos. ¿En qué lavandería estás?

**Usuario:** Hortes.  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora.  
**Bot:** De acuerdo. Vamos a revisarlo manualmente para poder ayudarte. ¿Cómo te llamas?

**Usuario:** Andrea.  
**Bot:** Pasamos tu caso a revisión. Un operador se pondrá en contacto contigo, gracias por la paciencia, Andrea.

**Resultado esperado:**  
Caso escalado tras recoger location + tipo de máquina, sin paso de foto.

**Escalar si:**  
- siempre, cuando el cliente no puede leer la pantalla

---

## Caso 18 — El cliente da un código solo numérico y dice que no hay letras

**Objetivo:**  
Detectar una incoherencia sin confrontar al cliente.

**Cuándo aplica:**  
El cliente facilita un código compuesto solo por números y afirma que no tiene letras delante.

**Ejemplo de conversación:**

**Usuario:** Tengo un código: 23432023.  
**Bot:** Gracias. ¿Ves alguna letra delante de los números?

**Usuario:** No.  
**Bot:** De acuerdo. Hay una información que necesitamos revisar manualmente antes de continuar.

**Usuario:** ¿Por qué?  
**Bot:** Para comprobarlo bien y ayudarte correctamente, vamos a pasarlo a revisión.

**Resultado esperado:**  
Caso escalado sin confrontación.

**Escalar si:**  
- siempre en este caso

---

## Caso 19 — El cliente dice que el datáfono ha cobrado 10 € en Goya

**Objetivo:**  
Detectar una incoherencia de importe sin acusar al cliente.

**Cuándo aplica:**  
El cliente está en Goya y afirma que el datáfono ha cobrado 10 €.

**Ejemplo de conversación:**

**Usuario:** Estoy en Goya y el datáfono me ha cobrado 10 €.  
**Bot:** Gracias por indicarlo. Vamos a revisarlo contigo. ¿Has podido usar el servicio?

**Usuario:** No.  
**Bot:** De acuerdo. Hay una información que no coincide y necesitamos revisarla manualmente.

**Usuario:** Vale.  
**Bot:** Pasaremos tu caso a revisión para ayudarte de la manera más adecuada.

**Resultado esperado:**  
Caso escalado por importe incoherente.

**Escalar si:**  
- siempre en este caso

---

## Caso 20 — El cliente dice que el datáfono ha cobrado 10 € en Pineda

**Objetivo:**  
Detectar una incoherencia de importe sin confrontar.

**Cuándo aplica:**  
El cliente está en Pineda y afirma que el datáfono ha cobrado 10 €.

**Ejemplo de conversación:**

**Usuario:** En Pineda me ha cobrado 10 €.  
**Bot:** Gracias. Vamos a revisarlo. ¿Has podido lavar o secar la ropa?

**Usuario:** No.  
**Bot:** De acuerdo. Hay una información que no coincide y necesitamos comprobarla manualmente.

**Usuario:** Vale.  
**Bot:** Lo pasaremos a revisión para poder ayudarte correctamente.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre en este caso

---

## Caso 21 — En Alemanya se han añadido monedas a la secadora y no se han sumado minutos

**Objetivo:**  
Identificar una incidencia habitual del local y escalarla correctamente.

**Cuándo aplica:**  
El cliente está en Alemanya, usa secadora y dice que ha añadido tiempo pero no se han sumado minutos.

**Ejemplo de conversación:**

**Usuario:** He puesto más dinero en la secadora y no suma minutos.  
**Bot:** Gracias. ¿Estás en la lavandería Alemanya?

**Usuario:** Sí.  
**Bot:** De acuerdo. Esa incidencia necesita revisión para poder comprobarla correctamente.

**Usuario:** ¿No se puede arreglar ahora?  
**Bot:** Vamos a pasarlo a revisión para ayudarte de la manera más adecuada.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre en este caso

---

## Caso 22 — En Pineda se han añadido monedas a la secadora y no se han sumado minutos

**Objetivo:**  
Identificar una incidencia habitual del local y escalar.

**Cuándo aplica:**  
El cliente está en Pineda y los minutos añadidos no se reflejan.

**Ejemplo de conversación:**

**Usuario:** He añadido tiempo a la secadora y no lo ha sumado.  
**Bot:** Gracias. ¿Estás en Pineda?

**Usuario:** Sí.  
**Bot:** De acuerdo. Vamos a revisarlo manualmente para ayudarte correctamente.

**Usuario:** Vale.  
**Bot:** Gracias. Pasaremos tu caso a revisión.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre en este caso

---

## Caso 23 — En Alemanya no se puede pagar con tarjeta

**Objetivo:**  
Reconocer una incidencia operativa del local y derivarla.

**Cuándo aplica:**  
El cliente indica que está en Alemanya y no puede pagar con tarjeta.

**Ejemplo de conversación:**

**Usuario:** No puedo pagar con tarjeta.  
**Bot:** Te ayudo. ¿En qué lavandería estás?

**Usuario:** Alemanya.  
**Bot:** Gracias. Vamos a revisarlo manualmente porque esa incidencia puede requerir soporte técnico.

**Usuario:** Vale.  
**Bot:** Pasaremos tu caso a revisión para poder ayudarte.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre en este caso

---

## Caso 24 — En Hortes no se puede pagar con tarjeta

**Objetivo:**  
Reconocer una incidencia operativa del local y derivarla.

**Cuándo aplica:**  
El cliente indica que está en Hortes y no puede pagar con tarjeta.

**Ejemplo de conversación:**

**Usuario:** La tarjeta no funciona para pagar.  
**Bot:** Gracias. ¿Estás en Hortes?

**Usuario:** Sí.  
**Bot:** De acuerdo. Vamos a revisar la incidencia manualmente para ayudarte correctamente.

**Usuario:** Vale.  
**Bot:** Pasaremos tu caso a revisión.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre en este caso

---

## Caso 25 — El cliente está muy enfadado

**Objetivo:**  
Mantener un tono calmado y no discutir.

**Cuándo aplica:**  
El cliente usa un tono agresivo, exigente o muy molesto.

**Ejemplo de conversación:**

**Usuario:** ¡Esto siempre falla! ¡Quiero una solución ya!  
**Bot:** Entiendo tu malestar y quiero ayudarte. Vamos a revisarlo lo antes posible. ¿En qué lavandería estás?

**Usuario:** Goya.  
**Bot:** Gracias. Para poder ayudarte bien, necesito una información básica primero. ¿Es una lavadora o una secadora?

**Resultado esperado:**  
El bot mantiene la calma y recoge datos mínimos.

**Escalar si:**  
- el cliente continúa muy alterado
- exige una solución inmediata no automática
- se niega a colaborar

---

## Caso 26 — El cliente exige devolución inmediata

**Objetivo:**  
Recoger datos sin prometer una devolución automática.

**Cuándo aplica:**  
El cliente pide devolución inmediata.

**Ejemplo de conversación:**

**Usuario:** Quiero que me devolváis el dinero ahora mismo.  
**Bot:** Vamos a revisarlo contigo. Para tramitarlo, necesito los últimos 4 dígitos de la tarjeta, una captura del pago y un breve resumen de lo ocurrido.

**Usuario:** Quiero la devolución ya.  
**Bot:** Entiendo lo que me indicas. Vamos a pasar el caso a revisión para aplicar la solución más adecuada.

**Resultado esperado:**  
Caso escalado sin prometer devolución.

**Escalar si:**  
- siempre que exija devolución inmediata
- si falta información
- si la incidencia es compleja

---

## Caso 27 — El cliente pide una compensación concreta

**Objetivo:**  
No prometer compensaciones no automatizadas.

**Cuándo aplica:**  
El cliente exige una secadora gratis, una lavadora gratis, un código nuevo o cualquier compensación concreta.

**Ejemplo de conversación:**

**Usuario:** Quiero una secadora gratis por las molestias.  
**Bot:** Vamos a revisar tu caso para ayudarte con la solución más adecuada.

**Usuario:** Pero quiero que me lo confirmes ya.  
**Bot:** No puedo confirmarlo directamente desde aquí. Vamos a pasarlo a revisión para que se valore correctamente.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre que haya que decidir compensación
- si se solicita activación gratuita
- si se solicita un código nuevo

---

## Caso 28 — Relato contradictorio en un doble cobro

**Objetivo:**  
Detectar incoherencia y escalar sin discutir.

**Cuándo aplica:**  
El cliente mezcla versiones incompatibles de lo ocurrido.

**Ejemplo de conversación:**

**Usuario:** Me cobró dos veces, aunque creo que también pagué en efectivo, pero no sé si llegó a arrancar.  
**Bot:** Gracias. Vamos a revisarlo contigo. ¿Has podido finalmente usar el servicio?

**Usuario:** No lo sé bien.  
**Bot:** De acuerdo. Para comprobarlo bien, vamos a revisar el caso manualmente.

**Usuario:** Vale.  
**Bot:** Gracias. Pasaremos tu caso a revisión.

**Resultado esperado:**  
Caso escalado por relato confuso.

**Escalar si:**  
- siempre que el relato sea contradictorio o muy confuso

---

## Caso 29 — El cliente menciona cámaras o revisión técnica

**Objetivo:**  
No prometer una comprobación directa desde el bot y derivar correctamente.

**Cuándo aplica:**  
El cliente menciona cámaras, AJAX o soporte técnico.

**Ejemplo de conversación:**

**Usuario:** Mirad las cámaras porque yo he pagado.  
**Bot:** Gracias por indicarlo. Vamos a revisar tu caso manualmente para poder comprobarlo bien.

**Usuario:** Vale.  
**Bot:** Lo pasaremos a revisión para ayudarte correctamente.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre que implique cámaras
- siempre que implique AJAX
- siempre que implique revisión técnica

---

## Caso 30 — Código no documentado en pantalla

**Objetivo:**  
Escalar cuando el mensaje no coincide con ningún caso conocido.

**Cuándo aplica:**  
El cliente da un código distinto de `SEL`, `PUSH PROG`, `DOOR`, `ALM DOOR`, `001`, `ALM`, `ALN`.

**Ejemplo de conversación:**

**Usuario:** En la pantalla sale ERR 52.  
**Bot:** Gracias. ¿En qué lavandería estás?

**Usuario:** L’Escala.  
**Bot:** De acuerdo. Ese código no coincide con un caso documentado y necesitamos revisarlo manualmente.

**Usuario:** Entendido.  
**Bot:** Pasaremos tu caso a revisión para ayudarte de la manera más adecuada.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre en códigos no documentados

---

## Caso 31 — El cliente no indica local

**Objetivo:**  
Evitar diagnosticar sin el dato mínimo más importante.

**Cuándo aplica:**  
El cliente explica el problema pero no dice en qué lavandería está.

**Ejemplo de conversación:**

**Usuario:** La secadora no funciona.  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. Te ayudo. ¿En qué lavandería estás?

**Usuario:** No lo sé.  
**Bot:** Para poder ayudarte, necesito saber primero en qué lavandería estás exactamente.

**Usuario:** Vale, estoy en Goya.  
**Bot:** Perfecto. ¿Qué número de secadora es?

**Resultado esperado:**  
El bot no diagnostica hasta identificar el local.

**Escalar si:**  
- el cliente no puede identificar el local
- el cliente se niega a indicarlo

---

## Caso 32 — El cliente mezcla incidencia de máquina y pago

**Objetivo:**  
Reconducir el caso al flujo correcto sin perder ningún dato que el cliente
adelante (ej. el número de máquina).

**Cuándo aplica:**  
El cliente mezcla el problema técnico con el problema de cobro y suele
adelantar respuestas (números, "lavadora", etc.) antes de que el bot las
pida explícitamente.

**Ejemplo de conversación:**

**Usuario:** He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro.  
**Bot:** Hola, soy el asistente virtual de la lavandería. Tranquilo, te ayudo. ¿En qué lavandería estás ahora mismo?

**Usuario:** Pineda.  
**Bot:** ¿Podrías indicarme, por favor, si es una lavadora o una secadora? 🙂

**Usuario:** Lavadora 3.  
**Bot:** Cuéntame, por favor, ¿qué aparece exactamente en la pantalla? 🙂

**Resultado esperado:**  
El bot reconduce el caso al flujo adecuado siguiendo el canonical question
order: Step 2 = tipo, Step 3 = número, una pregunta por turno. Si el
cliente adelanta el número, `autoExtractFacts` lo captura y el guard
sequencial evita la re-ask.

**Comportamiento garantizado por código (no por prompt):**  
- L3 `autoExtractFacts` captura `machineNumber` aunque venga sin
  `machineType` (whole-message digit cuando hay `location`).
- L4 `guardForceMachineType` (`utils/guards/location.ts`) pide siempre
  SOLO el tipo (i18n key `machineType`). El número lo pide el turno
  siguiente `guardForceMachineNumber`. La separación está pinneada por
  `__tests__/unit/force-machine-type.test.ts`.
- Si el cliente adelanta el número (`"3"`), `autoExtractFacts` lo guarda
  y el guard pide solo el tipo en el turno siguiente — ninguna re-ask
  awkward del número.

**Escalar si:**  
- el relato sigue siendo confuso
- el cliente no sabe confirmar qué ocurrió
- hay incoherencia de importe