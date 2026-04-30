# Case 6 — Me han cobrado dos veces pero he podido usar el servicio

## SCENARIO

**Objetivo:** Recoger los datos mínimos para revisión y devolución.

**Cuándo aplica:** El cliente informa que ha habido un doble cobro con tarjeta, pero sí ha podido completar el servicio de lavado o secado. El bot no escala de inmediato: recoge los datos necesarios de forma ordenada y prepara el caso para revisión manual. El flujo consiste en identificar primero la lavandería, confirmar que el servicio se completó, recoger el relato paso a paso, los últimos cuatro dígitos de la tarjeta y una captura del pago. Una vez recogidos todos los datos, el bot confirma al cliente que el caso será revisado y le indica cómo evitar la incidencia en el futuro.

**Scenario 6.1 — Happy Path:** El cliente reporta un doble cobro con tarjeta habiendo podido lavar. El bot recoge la localización, confirma que el servicio se completó, solicita el relato paso a paso, los últimos cuatro dígitos de la tarjeta y la captura del pago. El cliente proporciona todos los datos y el caso queda preparado para revisión sin escalación.

**Scenario 6.2 — Escalación: cliente muy molesto que exige atención humana:** El cliente indica desde el primer mensaje que está muy enfadado y quiere hablar con una persona. El bot recoge el nombre y escala inmediatamente sin pasar por el flujo de recogida de datos.

**Scenario 6.3 — Escalación: relato inconsistente o importe no cuadra:** El bot inicia el flujo estándar de doble cobro. Al recoger el relato, el cliente proporciona información inconsistente (número de cobros no definido, importe que no cuadra con el local). El bot detecta la incoherencia, pide el nombre y escala a soporte humano para revisión manual.

## ACCEPTANCE CRITERIA

### Generales (todos los escenarios)

- El bot NO escala de inmediato al detectar un doble cobro
- El bot recoge la localización antes de cualquier otra información (excepto si el cliente ya está muy molesto y exige atención humana)
- El bot NO pregunta el tipo ni el número de máquina en este caso (no es un problema técnico de la máquina)

### Scenario 6.1 — Happy Path

- El bot pregunta en qué lavandería está el cliente sin mencionar el doble cobro en el saludo
- El bot pregunta si ha podido completar el lavado o secado
- El bot pregunta si es posible que el cliente haya pasado varias veces la tarjeta por el datáfono
- El bot solicita los últimos 4 dígitos de la tarjeta
- El bot solicita una captura del pago
- Una vez recogidos todos los datos, el bot confirma que el caso será revisado y enviará el formulario de devolución
- El mensaje final NO contiene "operador" ni "llamada telefónica" (NO debe escalar)
- El bot NO escala a operador en el sentido de transferir la conversación

### Scenario 6.2 — Escalación: cliente muy molesto

- Si el cliente indica que está muy molesto y exige hablar con una persona, el bot escala inmediatamente
- Antes de escalar, el bot pregunta el nombre del cliente junto con el mensaje de escalación
- El mensaje de escalación contiene la palabra "operador"
- El mensaje de confirmación final contiene "brevedad" y "llamada telefónica"
- El bot NO continúa recogiendo datos de revisión

### Scenario 6.3 — Escalación: relato inconsistente

- El bot recoge la localización antes de escalar (sigue el flujo estándar hasta detectar la incoherencia)
- Cuando el relato es inconsistente o el importe no cuadra, el bot escala
- Antes de escalar, el bot pregunta el nombre del cliente junto con el mensaje de escalación
- El mensaje de escalación contiene la palabra "operador"
- El mensaje de confirmación final contiene "brevedad" y "llamada telefónica"
- El bot NO continúa solicitando más datos (dígitos, captura)

---

## CONVERSATION — Case 6 — Scenario 6.1 — Doble cobro, servicio completado (Happy Path)

**Usuario:** Me habéis cobrado dos veces con la tarjeta.
**Bot:** ¡Hola! Soy el asistente virtual de la lavandería y estoy aquí para ayudarte. ¿En qué lavandería te encuentras?

**Usuario:** Goya
**Bot:** ¿Pudiste completar el lavado o secado?

**Usuario:** Sí
**Bot:** Explícame, por favor, paso a paso qué has hecho desde que has entrado.

**Usuario:** He pagado, no iba y volví a pasar la tarjeta.
**Bot:** ¿Cuáles son los últimos 4 dígitos de la tarjeta con la que pagaste?

**Usuario:** 4821
**Bot:** ¿Tienes una captura de pantalla del pago o comprobante?

**Usuario:** Vale
**Bot:** Hemos recibido toda la información necesaria. ¿Como te llamas?

**Usuario:** Goya
**Bot:** Tranquilo, Goya. Hemos recibido toda la información necesaria para tu caso. Vamos a revisar tu situación y te enviaremos un formulario de reembolso. Para la próxima vez, te recomendamos contactar con soporte antes de volver a pagar. ¡Gracias por tu comprensión!

---

## CONVERSATION — Case 6 — Scenario 6.2 — Doble cobro: cliente muy molesto que exige atención humana

**Usuario:** Me habéis cobrado dos veces, estoy muy enfadado y quiero hablar con un operador ahora mismo.
**Bot:** ⚠️ Necesitamos derivar tu caso a un operador para revisarlo. ¿Como te llamas?

**Usuario:** María
**Bot:** Gracias María, Un operador humano se encargará de tu caso en la máxima brevedad posible. ¿Aceptas recibir una llamada telefónica por uno de nuestros agentes para que pueda ayudarte ahora?

**👤 Human Support message**
Usuario María en ubicación no identificada ha reportado un doble cobro.

---

## CONVERSATION — Case 6 — Scenario 6.3 — Doble cobro: relato inconsistente o importe no cuadra

**Usuario:** Me habéis cobrado dos veces con la tarjeta.
**Bot:** ¡Hola! Soy el asistente virtual de la lavandería y estoy aquí para ayudarte. ¿En qué lavandería te encuentras?

**Usuario:** Goya
**Bot:** ¿Pudiste completar el lavado o secado?

**Usuario:** Sí
**Bot:** Explícame, por favor, paso a paso qué has hecho desde que has entrado.

**Usuario:** No sé exactamente, creo que me han cobrado tres o cuatro veces, el importe no me cuadra.
**Bot:** ⚠️ Necesitamos derivar tu caso a un operador para revisarlo. ¿Como te llamas?

**Usuario:** Carlos
**Bot:** Gracias Carlos, Un operador humano se encargará de tu caso en la máxima brevedad posible. ¿Aceptas recibir una llamada telefónica por uno de nuestros agentes para que pueda ayudarte ahora?

**👤 Human Support message**
Usuario Carlos en Goya ha reportado un doble cobro.

## REPORT LLM

- No se detectaron criterios negativos.
