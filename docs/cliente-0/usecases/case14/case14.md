# Case 14 — La lavadora muestra ALM DOOR

## SCENARIO

**Scenario 14.1 — Happy Path:** El cliente reporta `ALM DOOR` en la pantalla de la lavadora. El chatbot recoge localización, tipo y número de máquina, e indica al cliente que abra la puerta con cuidado, revise si hay alguna prenda atrapada y la cierre bien. El cliente confirma que el mensaje ha desaparecido y el caso se resuelve sin escalación.

**Scenario 14.2 — Escalation Path:** Mismo flujo hasta el intento de apertura/cierre. Si el cliente confirma que el mensaje `ALM DOOR` sigue apareciendo, el bot pide el nombre y escala a soporte humano. NO se pide al cliente repetir el intento.

## ACCEPTANCE CRITERIA

### Generales (ambos escenarios)

- El bot recoge la localización, el tipo de máquina (lavadora/secadora) y el número antes de proponer cualquier acción.
- Cuando el display es `ALM DOOR`, el bot indica explícitamente que el problema puede ser un cierre incorrecto o una prenda atrapada.
- El bot pide UN solo intento de apertura/cierre (no repetir el procedimiento).

### Scenario 14.1 — Happy Path (ALM DOOR resuelto)

- Tras dar la instrucción, el bot pregunta si el mensaje ha desaparecido.
- Cuando el cliente confirma "Sí", el bot cierra el caso con un mensaje positivo que contiene `perfecto`.
- En el Scenario 14.1 el bot NO debe escalar a operador.

### Scenario 14.2 — Escalation Path (ALM DOOR persiste)

- Si el cliente indica que el mensaje sigue apareciendo, el bot escala directamente a soporte humano sin pedir un segundo intento.
- Antes de escalar, el bot pregunta el nombre del cliente con la frase `¿Cómo te llamas?`.
- El mensaje de escalación contiene `operador` y la confirmación final contiene `brevedad` y `llamada telefónica`.
- En el Scenario 14.2 el bot NO debe cerrar el caso como resuelto.

## CONVERSATION — Case 14 — Scenario 14.1 — ALM DOOR (Happy Path)

**Usuario:** La lavadora no funciona y pone ALM DOOR
**Bot:** Tranquilo, te ayudo. ¿En qué lavandería estás?

**Usuario:** Goya
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 6
**Bot:** De acuerdo. Ese mensaje puede indicar un problema de cierre o que hay alguna prenda atrapada. Abre la puerta con cuidado, revisa si hay alguna prenda atrapada y vuelve a cerrarla bien.

**Usuario:** Ya lo he hecho
**Bot:** Perfecto. Dime, por favor, si el mensaje ha desaparecido.

**Usuario:** Sí, ya ha desaparecido
**Bot:** Perfecto, me alegro de que se haya resuelto. Si necesitas algo más, aquí estoy.

---

## CONVERSATION — Case 14 — Scenario 14.2 — ALM DOOR persiste (Escalation)

**Usuario:** La lavadora no funciona y pone ALM DOOR
**Bot:** Tranquilo, te ayudo. ¿En qué lavandería estás?

**Usuario:** Goya
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 6
**Bot:** De acuerdo. Ese mensaje puede indicar un problema de cierre o que hay alguna prenda atrapada. Abre la puerta con cuidado, revisa si hay alguna prenda atrapada y vuelve a cerrarla bien.

**Usuario:** Ya lo he hecho
**Bot:** Perfecto. Dime, por favor, si el mensaje ha desaparecido.

**Usuario:** No, sigue saliendo lo mismo
**Bot:** Gracias. Vamos a pasar tu caso a revisión para ayudarte de la manera más adecuada. ¿Cómo te llamas?

**Usuario:** Carlos
**Bot:** Gracias Carlos. Un operador se encargará de tu caso a la mayor brevedad posible. ¿Aceptas recibir una llamada telefónica por uno de nuestros agentes para ayudarte?

**👤 Human Support message**
Usuario Carlos en Goya ha reportado un problema con la lavadora número 6: el mensaje **ALM/DOOR** sigue apareciendo tras la comprobación de cierre/prenda atrapada.

## REPORT LLM

- No se detectaron criterios negativos.
