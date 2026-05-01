# Case 32 — El cliente mezcla incidencia de máquina y pago

## SCENARIO

**Scenario 32.1 — Reconduce to Machine Flow:** El cliente mezcla problema técnico con problema de cobro. El chatbot reconduce el caso al flujo correcto: primero verifica si el servicio se completó, luego revisa qué aparece en pantalla.

**Scenario 32.2 — Escalation Path:** Si el relato sigue siendo confuso o hay incoherencia de importe, el chatbot escala.

## ACCEPTANCE CRITERIA

### Generales

- El bot ordena el caso paso a paso.
- El bot recoge localización primero.
- El bot pregunta si se completó el servicio.
- El bot pregunta qué aparece en pantalla si la incidencia es técnica.

### Scenario 32.1 — Reconduce

- Bot reconduce al flujo de diagnóstico de pantalla.
- Cliente colabora.

### Scenario 32.2 — Escalation

- Si relato sigue confuso o incoherencias de importe → escalación.

## CONVERSATION — Case 32 — Scenario 32.1 — Reconduce to Machine Flow

**Usuario:** He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro.
**Bot:** Vamos a ordenarlo paso a paso. ¿En qué lavandería estás?

**Usuario:** Pineda.
**Bot:** Gracias. Primero necesito saber si has podido usar finalmente la máquina.

**Usuario:** No.
**Bot:** De acuerdo. Entonces vamos a revisar primero qué aparece exactamente en la pantalla. ¿Qué ves?

**Usuario:** Pone DOOR.
**Bot:** Perfecto. Ese mensaje suele indicar que la puerta no se ha cerrado bien. Cierra la puerta firmemente y dime si arranca.

---

## CONVERSATION — Case 32 — Scenario 32.2 — Confused Narrative Escalation

**Usuario:** He pagado dos veces, creo, pero no sé, y la máquina no funciona pero quizás sí, no estoy seguro.
**Bot:** Vamos a ordenarlo paso a paso. ¿En qué lavandería estás?

**Usuario:** Goya, creo. O Pineda. No me acuerdo.
**Bot:** Para poder ayudarte bien, necesito que estés seguro de en qué lavandería estás.

**Usuario:** No me acuerdo.
**Bot:** De acuerdo. Vamos a pasar tu caso a revisión manual para poder ayudarte mejor. ¿Cómo te llamas?

**Usuario:** Roger.
**Bot:** Gracias Roger. Un operador revisará tu caso a la mayor brevedad posible. ¿Aceptas recibir una llamada telefónica?

**👤 Human Support message**
Usuario Roger reporta relato muy confuso: posibles dos pagos, máquina con funcionamiento incierto, localización no recordada. Requiere investigación manual.

## REPORT LLM

- No se detectaron criterios negativos.
