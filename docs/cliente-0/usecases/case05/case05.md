# Case 5 — Error AL001

## SCENARIO

**Objetivo:** Explicar el motivo del error y corregir la secuencia de uso.

**Cuándo aplica:** El cliente reporta que aparece AL001 en la pantalla de la lavadora. AL001 indica un error de secuencia: el cliente ha pulsado el programa antes de completar el pago o ha seguido un orden incorrecto en los pasos.

**Scenario 5.1 — Happy Path:** El cliente reporta AL001. El bot recoge localización, tipo y número de máquina, explica que AL001 es un error de secuencia y guía al cliente para reiniciar el proceso en el orden correcto. El cliente confirma que la lavadora ha arrancado y el caso se cierra sin escalación.

**Scenario 5.2 — Escalación: el cliente no puede seguir las instrucciones:** Igual que 5.1 hasta que el bot da las instrucciones. El cliente indica que no entiende cómo hacerlo. El bot pide el nombre y escala a soporte humano.

**Scenario 5.3 — Escalación: el error persiste tras repetir la secuencia:** El cliente sigue las instrucciones correctamente pero AL001 sigue apareciendo. El bot vuelve a preguntar el código exacto del display, confirma que sigue siendo AL001 y escala a soporte humano.

## ACCEPTANCE CRITERIA

### Generales (todos los escenarios)

- El bot recoge la localización antes de proponer cualquier acción
- El bot pregunta el tipo de máquina (lavadora/secadora) y el número de la misma

### Scenario 5.1 — Happy Path

- El bot explica los pasos correctos: pagar, seleccionar máquina, pulsar programa, cerrar puerta
- El caso se cierra con un mensaje positivo que contiene "perfecto" y "comenzado" o "correctamente"

### Scenario 5.2 — Escalación: cliente no puede seguir instrucciones

- Si el cliente indica que no puede seguir las instrucciones, el bot escala a soporte humano
- Antes de escalar, el bot pregunta el nombre del cliente
- El mensaje de escalación contiene la palabra "operador"
- El mensaje de confirmación final contiene la palabra "desactivado"

### Scenario 5.3 — Escalación: error persiste

- Si el cliente dice que ha seguido los pasos pero el error persiste, el bot vuelve a preguntar el código exacto del display
- Cuando el cliente confirma que sigue siendo AL001, el bot escala a soporte humano
- Antes de escalar, el bot pregunta el nombre del cliente
- El mensaje de escalación contiene la palabra "operador"
- El mensaje de confirmación final contiene la palabra "desactivado"

---

## CONVERSATION — Case 5 — Scenario 5.1 — AL001 (Happy Path)

**Usuario:** Me sale AL001
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry. ¿En qué lavandería autoservicio te encuentras? (indica la ciudad y la calle)

**Usuario:** L'Escala
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 3
**Bot:** **AL001** significa un error de secuencia.

Reinicia el proceso completo:
1. Paga.
2. Selecciona la máquina.
3. Pulsa el programa.
4. Cierra la puerta.
5. Avísame si funciona.

**Usuario:** Sí, ya funciona
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

## CONVERSATION — Case 5 — Scenario 5.2 — AL001 Escalación: cliente no puede seguir instrucciones

**Usuario:** Me sale AL001
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry. ¿En qué lavandería autoservicio te encuentras? Por favor, indícame la ciudad y la calle para poder ayudarte mejor.

**Usuario:** L'Escala
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 3
**Bot:** **AL001** significa un error de secuencia.

Reinicia el proceso completo:
1. Paga.
2. Selecciona la máquina.
3. Pulsa el programa.
4. Cierra la puerta.
5. Avísame si funciona.

**Usuario:** No entiendo cómo hacerlo
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** AL001
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador para que revise el caso y la posible compensación.

¿Como te llamas?

**Usuario:** María
**Bot:** Gracias María, Un operador humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación. El chatbot será desactivado.

**👤 Human Support message**
Usuario María en L'Escala ha reportado un problema técnico por la lavadora número 3. El cliente seleccionó el programa pero problema técnico. la pantalla muestra: AL001.

---

## CONVERSATION — Case 5 — Scenario 5.3 — AL001 Escalación: error persiste tras reinicio correcto

**Usuario:** Me sale AL001
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry. Para poder ayudarte mejor, ¿en qué lavandería autoservicio te encuentras? (indica la ciudad y la calle).

**Usuario:** L'Escala
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** Lavadora
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 3
**Bot:** **AL001** significa un error de secuencia.

Reinicia el proceso completo:
1. Paga.
2. Selecciona la máquina.
3. Pulsa el programa.
4. Cierra la puerta.
5. Avísame si funciona.

**Usuario:** Lo he hecho bien pero sigue saliendo
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** AL001
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador para que revise el caso y la posible compensación.

¿Como te llamas?

**Usuario:** Carlos
**Bot:** Gracias Carlos, Un operador humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación. El chatbot será desactivado.

**👤 Human Support message**
Usuario Carlos en L'Escala ha reportado un problema técnico por la lavadora número 3. El cliente seleccionó el programa pero sigue saliendo. la pantalla muestra: AL001.

## REPORT LLM

- No se detectaron criterios negativos.
