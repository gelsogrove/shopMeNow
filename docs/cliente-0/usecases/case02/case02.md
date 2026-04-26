# Case 2 — La lavadora no funciona y aparece DOOR

## SCENARIO

**Scenario 2.1 — Happy Path:** El cliente reporta que la lavadora no arranca y el display indica DOOR. El chatbot recoge los datos mínimos de incidencia (localización y número de máquina), explica que DOOR indica puerta mal cerrada, pide abrir/cerrar correctamente y reintentar. El cliente confirma que ahora funciona y el caso se resuelve sin escalación.

**Scenario 2.2 — Escalation Path:** El flujo es el mismo hasta la indicación de cerrar bien la puerta y volver a probar. Si el mensaje DOOR persiste o la lavadora no arranca tras repetir el paso, el chatbot pide el nombre del cliente y escala a soporte humano con resumen.

## ACCEPTANCE CRITERIA

### Generales (ambos escenarios)

- El primer mensaje contiene un saludo de bienvenida con tono cálido
- Todas las respuestas del bot deben estar en el mismo idioma del cliente (nunca en inglés ni en otro idioma)
- Si el problema es técnico de lavadora, solicita qué aparece en la pantalla antes de proponer pasos de solución
- Cuando el display es DOOR, pregunta localización antes de proponer la solución
- Cuando el display es DOOR, pregunta número de máquina antes de proponer la solución

### Scenario 2.1 — Happy Path (DOOR resuelto)

- Cuando el display es DOOR, el bot indica explícitamente que la puerta no está bien cerrada y pide abrir/cerrar bien hasta oír un clic
- Después de la indicación, el bot pide al cliente que confirme si la máquina ha arrancado
- Cuando el cliente confirma "Sí", el bot cierra el caso con un mensaje positivo que contiene "perfecto" y "arrancado"
- En el Scenario 2.1 el bot NO debe escalar a operador

### Scenario 2.2 — Escalation Path (DOOR persiste)

- Si DOOR persiste tras repetir el paso, el bot pregunta de nuevo el código exacto del display
- Cuando el cliente confirma que DOOR sigue, el bot anuncia escalación con un mensaje que contiene "operador" y menciona explícitamente "puerta" o "DOOR"
- Antes de escalar, el bot pregunta el nombre del cliente con la frase "¿Cómo te llamas?"
- Tras confirmar la escalación, el bot informa explícitamente al cliente: "El chatbot será desactivado."
- El mensaje final al operador (Human Support message) resume nombre, localización, número de máquina y estado del display DOOR
- En el Scenario 2.2 el bot NO debe cerrar el caso como resuelto

---

## CONVERSATION — Case 2 — Scenario 2.1 — DOOR (Happy Path)

**Usuario:** La lavadora no arranca
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry y estoy aquí para ayudarte. ¿Qué aparece en la pantalla de tu lavadora?

**Usuario:** DOOR
**Bot:** ¿En qué lavandería autoservicio estás? Dime el pueblo y la calle.

**Usuario:** Hortes
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** 2
**Bot:** La puerta no está cerrada correctamente. Ábrela y ciérrala firmemente hasta que escuches un clic. Después de intentarlo, házmelo saber si funciona.

**Usuario:** Sí
**Bot:** ✅ Perfecto. La lavadora ha arrancado correctamente.

---

## CONVERSATION — Case 2 — Scenario 2.2 — DOOR (Escalation Path)

**Usuario:** La lavadora no arranca
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry y estoy aquí para ayudarte. ¿Qué aparece en la pantalla de tu lavadora?

**Usuario:** DOOR
**Bot:** ¿En qué lavandería autoservicio estás? Dime el pueblo y la calle.

**Usuario:** Hortes
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** 2
**Bot:** La puerta no está cerrada correctamente. Ábrela y ciérrala firmemente hasta que escuches un clic. Después de intentarlo, házmelo saber si funciona.

**Usuario:** NO
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** DOOR
**Bot:** ⚠️ La puerta sigue bloqueada incluso después de repetir los pasos. Esto indica un posible fallo mecánico en el cierre de la puerta. Estoy notificando al operador ahora para que revise la lavadora manualmente.

¿Como te llamas?

**Usuario:** Carlos
**Bot:** Gracias Carlos, Un operador humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación. El chatbot será desactivado.

**👤 Human Support message**
Usuario Carlos en Hortes ha reportado un problema técnico por la lavadora número 2. El cliente seleccionó el programa pero La lavadora no arranca. la pantalla muestra: DOOR.

## REPORT LLM

- ❌ Cuando el cliente confirma "Sí", el bot cierra el caso con un mensaje positivo que contiene "perfecto" y "arrancado"
  > Por qué no se cumple: Heuristic/LLM evaluation marked this criterion as not satisfied.
  > Ejemplo: "✅ Perfecto. La lavadora ha arrancado correctamente."
- ❌ Antes de escalar, el bot pregunta el nombre del cliente con la frase "¿Cómo te llamas?"
  > Por qué no se cumple: Heuristic/LLM evaluation marked this criterion as not satisfied.
  > Ejemplo: "Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes."
- ❌ Tras confirmar la escalación, el bot informa explícitamente al cliente: "El chatbot será desactivado."
  > Por qué no se cumple: Heuristic/LLM evaluation marked this criterion as not satisfied.
  > Ejemplo: "Gracias Carlos, Un operador humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación. El chatbot será desactivado. **👤 Human Support message** Usuario Carlos en Hortes ha reportado un p"
