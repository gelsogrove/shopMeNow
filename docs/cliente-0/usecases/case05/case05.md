# Case 5 — Error AL001

## SCENARIO

**Objetivo:** Explicar el motivo del error y corregir la secuencia de uso.

**Cuándo aplica:** El cliente reporta que aparece AL001 en la pantalla de la lavadora. AL001 indica un error de secuencia: el cliente ha pulsado el programa antes de completar el pago o ha seguido un orden incorrecto en los pasos.

**Scenario 5.1 — Happy Path:** El cliente reporta AL001. El bot recoge localización, tipo y número de máquina, explica que AL001 es un error de secuencia y guía al cliente para reiniciar el proceso en el orden correcto. El cliente confirma que la lavadora ha arrancado y el caso se cierra sin escalación.

**Scenario 5.2 — Escalación: el cliente no puede seguir las instrucciones:** Igual que 5.1 hasta que el bot da las instrucciones. El cliente indica que no entiende cómo hacerlo. El bot pide el nombre y escala a soporte humano.

**Scenario 5.3 — Escalación: el error persiste tras repetir la secuencia:** El cliente sigue las instrucciones correctamente pero AL001 sigue apareciendo. El bot vuelve a preguntar el código exacto del display, confirma que sigue siendo AL001 y escala a soporte humano.

## ACCEPTANCE CRITERIA

### Generales (todos los escenarios)

- El bot NO pregunta qué aparece en el display (el cliente ya indicó AL001 en su primer mensaje)
- El bot recoge la localización antes de proponer cualquier acción
- El bot pregunta el tipo de máquina (lavadora/secadora) y el número de la misma
- El bot identifica AL001 como un error de secuencia e indica que hay que reiniciar el proceso en el orden correcto

### Scenario 5.1 — Happy Path

- El bot explica los pasos correctos: pagar, seleccionar máquina, pulsar programa, cerrar puerta
- Después de dar las instrucciones, el bot pide confirmación de que la máquina ha arrancado
- El caso se cierra con un mensaje positivo que contiene "perfecto" y "comenzado" o "correctamente"
- El bot NO escala a operador

### Scenario 5.2 — Escalación: cliente no puede seguir instrucciones

- Si el cliente indica que no puede seguir las instrucciones, el bot escala a soporte humano
- Antes de escalar, el bot pregunta el nombre del cliente
- El mensaje de escalación contiene la palabra "operador"
- El mensaje de confirmación final contiene la palabra "desactivado"
- El bot NO cierra el caso como resuelto

### Scenario 5.3 — Escalación: error persiste

- Si el cliente dice que ha seguido los pasos pero el error persiste, el bot vuelve a preguntar el código exacto del display
- Cuando el cliente confirma que sigue siendo AL001, el bot escala a soporte humano
- Antes de escalar, el bot pregunta el nombre del cliente
- El mensaje de escalación contiene la palabra "operador"
- El mensaje de confirmación final contiene la palabra "desactivado"
- El bot NO cierra el caso como resuelto

---

## CONVERSATION — Scenario 5.1 — Happy Path

**Usuario:** Me sale AL001
**Bot:** Tranquilo, te ayudo. ¿En qué lavandería estás?

**Usuario:** L'Escala
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** 3
**Bot:** AL001 indica un error de secuencia. Reinicia el proceso en este orden: 1. Paga. 2. Selecciona el número de máquina. 3. Pulsa el botón de programa. 4. Cierra la puerta. Dime si funciona.

**Usuario:** Sí, ya funciona
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

## CONVERSATION — Scenario 5.2 — Escalación: cliente no puede seguir instrucciones

**Usuario:** Me sale AL001
**Bot:** Tranquilo, te ayudo. ¿En qué lavandería estás?

**Usuario:** L'Escala
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** 3
**Bot:** AL001 indica un error de secuencia. Reinicia el proceso en este orden: 1. Paga. 2. Selecciona el número de máquina. 3. Pulsa el botón de programa. 4. Cierra la puerta. Dime si funciona.

**Usuario:** No entiendo cómo hacerlo
**Bot:** ⚠️ Vamos a pedir ayuda a un operador para que te guíe directamente. ¿Cómo te llamas?

**Usuario:** María
**Bot:** Gracias María, Un operador humano se encargará de tu caso. Por favor, espera un momento. El chatbot será desactivado.

**👤 Human Support message**
Cliente María en L'Escala: lavadora número 3 muestra AL001. El cliente no ha podido seguir las instrucciones de reinicio de secuencia.

---

## CONVERSATION — Scenario 5.3 — Escalación: error persiste

**Usuario:** Me sale AL001
**Bot:** Tranquilo, te ayudo. ¿En qué lavandería estás?

**Usuario:** L'Escala
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** 3
**Bot:** AL001 indica un error de secuencia. Reinicia el proceso en este orden: 1. Paga. 2. Selecciona el número de máquina. 3. Pulsa el botón de programa. 4. Cierra la puerta. Dime si funciona.

**Usuario:** Lo he hecho bien pero sigue saliendo
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** AL001
**Bot:** ⚠️ La pantalla sigue mostrando AL001 después de repetir la secuencia correctamente. Tenemos que notificar al operador para que revise la lavadora manualmente. ¿Cómo te llamas?

**Usuario:** Carlos
**Bot:** Gracias Carlos, Un operador humano se encargará de tu caso. Por favor, espera un momento. El chatbot será desactivado.

**👤 Human Support message**
Cliente Carlos en L'Escala: lavadora número 3 sigue mostrando AL001 tras repetir la secuencia completa correctamente.
