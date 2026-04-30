# Case 3 — La lavadora no funciona y aparece SEL

## SCENARIO

**Scenario 3.1 — Happy Path:** El cliente ha pagado pero la lavadora no arranca y el display muestra SEL. El chatbot recoge localización y número de máquina, explica que SEL significa que la máquina está pendiente de selección y pide al cliente comprobar que ha pulsado bien el número de la máquina en la central de pago. El cliente repite la selección, la lavadora arranca y el caso se cierra sin escalación.

**Scenario 3.2 — Escalation Path:** El flujo es el mismo hasta la indicación de repetir la selección. Si el display sigue mostrando SEL después de que el cliente vuelve a pulsar, el chatbot pide el nombre del cliente y escala a soporte humano con un resumen que incluye localización, número de máquina y estado del display SEL.

## ACCEPTANCE CRITERIA

### Generales (ambos escenarios)

- El primer mensaje contiene un saludo de bienvenida con tono cálido
- Todas las respuestas del bot deben estar en el mismo idioma del cliente (nunca en inglés ni en otro idioma)
- Antes de proponer la solución SEL, el bot pregunta localización y número de máquina
- Cuando el display es SEL, el bot indica explícitamente que la máquina está pendiente de selección
- Cuando el display es SEL, el bot pide al cliente comprobar que ha pulsado bien el número de la máquina en la central de pago

### Scenario 3.1 — Happy Path (SEL resuelto)

- Después de recibir el número de la lavadora, el bot debe responder exactamente con esta frase: "Ese mensaje indica que la máquina está pendiente de selección. Comprueba, por favor, que has pulsado bien el número de la máquina en la central de pago."
- El caso tiene que solucionarse.
- En el Scenario 3.1 el bot NO debe escalar a operador

### Scenario 3.2 — Escalation Path  

- Si SEL persiste tras repetir la selección, el bot pregunta de nuevo el código exacto del display
- Cuando el cliente confirma que SEL sigue, el bot anuncia escalación con un mensaje que contiene "operador" y menciona explícitamente "SEL"
- Antes de escalar, el bot pregunta el nombre del cliente con la frase "¿Cómo te llamas?"
- El mensaje final al operador (Human Support message) resume nombre, localización, número de máquina y estado del display SEL
- En el Scenario 3.2 el bot NO debe cerrar el caso como resuelto

---

## CONVERSATION — Case 3 — Scenario 3.1 — SEL (Happy Path)

**Usuario:** He pagado pero la lavadora no empieza
**Bot:** ¡Hola! Soy el asistente virtual de la lavandería, estoy aquí para ayudarte. ¿Qué aparece exactamente en la pantalla de la máquina?

**Usuario:** SEL
**Bot:** ¿En qué pueblo está la lavandería autoservicio?

**Usuario:** Pineda
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** 3
**Bot:** Ese mensaje indica que la máquina está pendiente de selección. Comprueba, por favor, que has pulsado bien el número de la máquina en la central de pago.

**Usuario:** Sí, ahora funciona
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

## CONVERSATION — Case 3 — Scenario 3.2 — SEL (Escalation Path)

**Usuario:** He pagado pero la lavadora no empieza
**Bot:** ¡Hola! Soy el asistente virtual de la lavandería, estoy aquí para ayudarte. ¿Qué aparece exactamente en la pantalla de la máquina?

**Usuario:** SEL
**Bot:** ¿En qué pueblo está la lavandería autoservicio?

**Usuario:** Pineda
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** 3
**Bot:** Ese mensaje indica que la máquina está pendiente de selección. Comprueba, por favor, que has pulsado bien el número de la máquina en la central de pago.

**Usuario:** Aun no arranca
**Bot:** Por favor, escribe solo lo que ves en la pantalla, los números y las letras tal y como aparecen en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** SEL
**Bot:** ⚠️ La pantalla sigue mostrando SEL incluso después de repetir la selección. Tenemos que notificar al operador ahora para que revise la lavadora manualmente. Por favor, espera un momento mientras gestionamos esto.

¿Como te llamas?

**Usuario:** Carlos
**Bot:** Gracias Carlos, Un operador humano se encargará de tu caso en la máxima brevedad posible. ¿Aceptas recibir una llamada telefónica por uno de nuestros agentes para que pueda ayudarte ahora?

**👤 Human Support message**
Usuario Carlos en Pineda ha reportado un problema técnico por la lavadora número 3. El cliente seleccionó el programa pero He pagado pero la lavadora no empieza. la pantalla muestra: SEL.

## REPORT LLM

- No se detectaron criterios negativos.
