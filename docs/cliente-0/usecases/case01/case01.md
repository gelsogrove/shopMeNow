# Case 1 — La lavadora no funciona y aparece PUSH PROG

## SCENARIO

**Scenario 1.1 — Happy Path:** El cliente dice que la lavadora no funciona. El chatbot responde con tono cálido y una frase de tranquilidad, pregunta qué muestra el display, y recoge localización y número de máquina. El display indica PUSH PROG (pago completado), así que el chatbot muestra los programas disponibles. El cliente selecciona uno y la máquina arranca correctamente. El caso se resuelve sin escalación.

**Case 1 — Escalation Path:** El flujo es idéntico hasta la selección del programa. Tras intentarlo, la máquina sigue sin arrancar. El chatbot vuelve a preguntar por el display, el cliente indica que sigue igual, y el chatbot recoge el nombre del usuario y escala el caso al operador con un resumen del problema.

## ACCEPTANCE CRITERIA

### Generales (ambos escenarios)

- El primer mensaje contiene un mensaje de bienvenida con tono cálido y una frase de tranquilidad
- Todas las respuestas del bot deben estar en el mismo idioma del cliente (si el cliente escribe en español, el bot responde en español; nunca en inglés ni en otro idioma)
- No propone soluciones antes de conocer el display
- Pregunta la localización antes de proponer cualquier acción técnica
- Pregunta el número de máquina antes de proponer cualquier acción técnica
- No pregunta el tipo de máquina cuando el cliente ya dijo "lavadora"

### Scenario 1.1 — Happy Path (PUSH PROG resuelto)

- Cuando el display es PUSH/Pr, el bot muestra los cuatro programas de la lavadora con sus temperaturas: 60° (muy caliente), 40° (caliente), 30° (templado) y frío
- Después de mostrar los programas, el bot debe pedir confirmación al cliente de que la máquina ha arrancado
- Cuando el cliente confirma que la lavadora funciona, el bot cierra el caso con un mensaje positivo que contiene "perfecto" y "correctamente"
- En el Scenario 1.1 el bot NO debe escalar a operador

### Scenario 1.2 — Escalation Path (PUSH PROG persiste)

- Si tras seleccionar el programa la máquina sigue sin arrancar, el bot vuelve a preguntar por el código exacto de la pantalla antes de escalar
- Antes de escalar el bot debe preguntar el nombre del cliente con la frase "¿Cómo te llamas?"
- El bot escala a un operador humano e informa explícitamente al cliente con un mensaje que contiene "operador"
- Tras confirmar la escalación, el bot informa explícitamente al cliente: "El chatbot será desactivado."
- El mensaje final al operador (Human Support message) debe resumir: nombre del cliente, localización y número de máquina
- En el Scenario 1.2 el bot NO debe cerrar el caso como resuelto

---

## CONVERSATION — Case 1 — Scenario 1.1 — Lavadora PUSH PROG (Happy Path)

**Usuario:** La lavadora no funciona
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry y estoy aquí para ayudarte. ¿Qué aparece en la pantalla de tu lavadora?

**Usuario:** PUSH PROG
**Bot:** ¿En qué lavandería autoservicio estás? Dime el pueblo y la calle.

**Usuario:** Goya
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** 5
**Bot:** Presiona un botón de programa para iniciar el lavado.

Programas:
60º Molt calent -> ropa muy sucia, blanca o de trabajo
40º Calent -> ropa normal (algodón, color)
30º Temperat -> ropa delicada o sintética
Frío -> prendas muy delicadas (lana, seda, etc.)

Después de intentarlo, házmelo saber si funciona.

**Usuario:** Sí, ahora funciona
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

## CONVERSATION — Case 1 — Escalation Path

**Usuario:** Hola, la lavadora no funciona
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry y estoy aquí para ayudarte. ¿Qué aparece en la pantalla de la lavadora?

**Usuario:** pone PUSH PROG
**Bot:** ¿En qué lavandería autoservicio estás? Dime el pueblo y la calle.

**Usuario:** Goya
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** 5
**Bot:** Presiona un botón de programa para iniciar el lavado.

Programas:
60º Molt calent -> ropa muy sucia, blanca o de trabajo
40º Calent -> ropa normal (algodón, color)
30º Temperat -> ropa delicada o sintética
Frío -> prendas muy delicadas (lana, seda, etc.)

Después de intentarlo, házmelo saber si funciona.

**Usuario:** no arranca
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** se ha bloqueada la pantalla
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Estoy notificando al operador para que revise el caso y la posible compensación.

¿Como te llamas?

**Usuario:** Carlos
**Bot:** Gracias Carlos, Un operador humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación. El chatbot será desactivado.

**👤 Human Support message**
Usuario Carlos en Goya ha efectuado el pago por la lavadora número 5. El cliente seleccionó el programa pero se ha bloqueada la pantalla. la pantalla muestra: PUSH.

## REPORT LLM

- ❌ En el Scenario 1.2 el bot NO debe cerrar el caso como resuelto
  > Por qué no se cumple: Deterministic rule evaluation marked this criterion as not satisfied.
  > Ejemplo: "Gracias Carlos, Un operador humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación. El chatbot será desactivado. **👤 Human Support message** Usuario Carlos en Goya ha efectuado el pag"
