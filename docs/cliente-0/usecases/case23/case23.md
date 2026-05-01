# Case 23 — En Alemanya no se puede pagar con tarjeta

## SCENARIO

**Scenario 23.1 — Escalation:** El cliente está en Alemanya y no puede pagar con tarjeta. El chatbot reconoce que se trata de una incidencia operativa/técnica del local y escala sin pedirle que reintente.

## ACCEPTANCE CRITERIA

- El bot confirma localización Alemanya.
- El bot reconoce incidencia técnica de pago.
- Escalación sin reintento.

## CONVERSATION — Case 23 — Scenario 23.1

**Usuario:** No puedo pagar con tarjeta.
**Bot:** Te ayudo. ¿En qué lavandería estás?

**Usuario:** Alemanya.
**Bot:** Gracias. Vamos a revisarlo manualmente porque esa incidencia puede requerir soporte técnico. ¿Cómo te llamas?

**Usuario:** Marc.
**Bot:** Gracias Marc. Un operador se encargará de tu caso a la mayor brevedad posible. ¿Aceptas recibir una llamada telefónica?

**👤 Human Support message**
Usuario Marc en Alemanya reporta incidencia de pago: no puede usar tarjeta. Requiere soporte técnico.

## REPORT LLM

- No se detectaron criterios negativos.
