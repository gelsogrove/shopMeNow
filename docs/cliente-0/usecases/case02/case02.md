# Case 2 — La lavadora no funciona y aparece DOOR

## SCENARIO

**Scenario 2.1 — Happy Path:** El cliente reporta que la lavadora no arranca y el display indica DOOR. El chatbot recoge los datos mínimos de incidencia (localización y número de máquina), explica que DOOR indica puerta mal cerrada, pide abrir/cerrar correctamente y reintentar. El cliente confirma que ahora funciona y el caso se resuelve sin escalación.

**Scenario 2.2 — Escalation Path:** El flujo es el mismo hasta la indicación de cerrar bien la puerta y volver a probar. Si el mensaje DOOR persiste o la lavadora no arranca tras repetir el paso, el chatbot pide el nombre del cliente y escala a soporte humano con resumen.

## ACCEPTANCE CRITERIA

- Si el problema es técnico de lavadora, solicita qué aparece en la pantalla antes de proponer pasos de solución
- Cuando el display es DOOR, pregunta localización
- Cuando el display es DOOR, pregunta número de máquina
- Cuando el display es DOOR, indica explícitamente que la puerta no está bien cerrada y pide abrir/cerrar bien antes de reintentar
- Después de indicar una acción técnica, pide explícitamente que el cliente confirme si funcionó
- No escala en el primer intento de solución DOOR si el cliente confirma que ya funciona
- Si DOOR persiste o no arranca tras repetir el paso, escala a soporte humano
- Antes de escalar, pregunta el nombre del cliente
- El mensaje al operador resume localización, número de máquina y estado del display

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
**Bot:** Perfecto. La lavadora ha arrancado correctamente.

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
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es diferente de antes.

**Usuario:** DOOR
**Bot:** ⚠️ La puerta sigue bloqueada incluso después de repetir los pasos. Esto indica un posible fallo mecánico en el cierre de la puerta. Estoy notificando al operador ahora para que revise la lavadora manualmente.

¿Como te llamas?

**Usuario:** Carlos
**Bot:** Un operador humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación. Gracias por tu paciencia.

**Human Support message**
Usuario Carlos en Hortes ha reportado un problema técnico por la lavadora número 2. El cliente seleccionó el programa pero La lavadora no arranca. la pantalla muestra: DOOR.

## REPORT LLM

- ✅ Si el problema es técnico de lavadora, solicita qué aparece en la pantalla antes de proponer pasos de solución
- ✅ Cuando el display es DOOR, pregunta localización
- ✅ Cuando el display es DOOR, pregunta número de máquina
- ✅ Cuando el display es DOOR, indica explícitamente que la puerta no está bien cerrada y pide abrir/cerrar bien antes de reintentar
- ✅ Después de indicar una acción técnica, pide explícitamente que el cliente confirme si funcionó
- ✅ No escala en el primer intento de solución DOOR si el cliente confirma que ya funciona
- ✅ Si DOOR persiste o no arranca tras repetir el paso, escala a soporte humano
- ✅ Antes de escalar, pregunta el nombre del cliente
- ✅ El mensaje al operador resume localización, número de máquina y estado del display
