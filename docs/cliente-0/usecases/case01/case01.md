# Case 1 — La lavadora no funciona y aparece PUSH PROG

## SCENARIO

**Scenario 1.1 — Happy Path:** El cliente dice que la lavadora no funciona. El chatbot responde con tono cálido y una frase de tranquilidad, pregunta qué muestra el display, y recoge localización y número de máquina. El display indica PUSH PROG (pago completado), así que el chatbot muestra los programas disponibles. El cliente selecciona uno y la máquina arranca correctamente. El caso se resuelve sin escalación.

**Case 1 — Escalation Path:** El flujo es idéntico hasta la selección del programa. Tras intentarlo, la máquina sigue sin arrancar. El chatbot vuelve a preguntar por el display, el cliente indica que sigue igual, y el chatbot recoge el nombre del usuario y escala el caso al operador con un resumen del problema.

## ACCEPTANCE CRITERIA

- El primer mensaje contiene un mensaje de bienvenida
- Saluda con tono cálido y añade una frase de tranquilidad en el primer mensaje
- Si el display indica pago completo (PUSH/Pr) o problema técnico (DOOR, ALM, AL001, pantalla en blanco), pide localización y número de máquina; si el tipo no está claro, lo pide en ese momento
- No propone soluciones antes de conocer el display
- Cuando el display es PUSH, muestra los programas de la lavadora (60° muy caliente, 40° caliente, 30° templado, frío) para que el cliente pueda seleccionar
- Escala a soporte humano haciendo un resumen del problema
- Pregunta el nombre del usuario antes de escalar
- Pregunta la localización
- No pregunta el tipo de máquina porque ya es explícito en el mensaje del usuario
- Pregunta el número de máquina

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
**Bot:** Perfecto. La lavadora ha comenzado correctamente.

---

## CONVERSATION — Case 1 — Escalation Path

**Usuario:** Hola, la lavadora no funciona
**Bot:** Hola, soy el asistente virtual de Ecolaundry y estoy aquí para ayudarte. ¿Qué aparece en la pantalla de la lavadora?

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
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora.

**Usuario:** se ha blcoqueada la pantalla
**Bot:** ¿Como te llamas?

**Usuario:** Carlos
**Bot:** Un humano se encargará de tu caso, Carlos. Por favor, espera un momento mientras revisan tu solicitud. El chatbot ya no estará disponible para esta conversación. Gracias por tu paciencia.

**Human Support message**
Usuario Carlos en Goya ha ha efectuado el pago por la lavadora número 5. El cliente seleccionó el programa pero pantalla bloqueada. la pantalla muestra: PUSH.

## REPORT LLM

- ✅ El primer mensaje contiene un mensaje de bienvenida
- ✅ Saluda con tono cálido y añade una frase de tranquilidad en el primer mensaje
- ✅ Si el display indica pago completo (PUSH/Pr) o problema técnico (DOOR, ALM, AL001, pantalla en blanco), pide localización y número de máquina; si el tipo no está claro, lo pide en ese momento
- ✅ No propone soluciones antes de conocer el display
- ✅ Cuando el display es PUSH, muestra los programas de la lavadora (60° muy caliente, 40° caliente, 30° templado, frío) para que el cliente pueda seleccionar
- ✅ Escala a soporte humano haciendo un resumen del problema
- ✅ Pregunta el nombre del usuario antes de escalar
- ✅ Pregunta la localización
- ✅ No pregunta el tipo de máquina porque ya es explícito en el mensaje del usuario
- ✅ Pregunta el número de máquina
