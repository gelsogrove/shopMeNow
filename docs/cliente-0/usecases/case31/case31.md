# Case 31 — El cliente no indica local

## SCENARIO

**Scenario 31.1 — Retry Path:** El cliente explica el problema pero no dice en qué lavandería está, o no la sabe. El chatbot insiste en obtener la localización como dato mínimo antes de proceder con el diagnóstico.

**Scenario 31.2 — Escalation Path:** El cliente no puede o se niega a identificar el local. El chatbot escala sin poder diagnosticar.

## ACCEPTANCE CRITERIA

### Generales

- El bot NO diagnostica sin localización confirmada.
- El bot pregunta explícitamente por la lavandería.

### Scenario 31.1 — Retry (Cliente identifica local)

- Cliente finalmente proporciona localización.
- Bot continúa con el flujo normal (tipo, número, etc.).

### Scenario 31.2 — Escalation (Cliente no puede/no quiere indicar)

- Cliente no puede o se niega a indicar localización.
- Bot escala sin poder proceder.

## CONVERSATION — Case 31 — Scenario 31.1 — Client Identifies Location

**Usuario:** La secadora no funciona.
**Bot:** Hola, soy el asistente virtual de Ecolaundry. Te ayudo. ¿En qué lavandería estás?

**Usuario:** No lo sé.
**Bot:** Para poder ayudarte, necesito saber primero en qué lavandería estás exactamente.

**Usuario:** Vale, estoy en Goya.
**Bot:** Perfecto. ¿Qué número de secadora es?

**Usuario:** La 3.
**Bot:** Gracias. ¿Qué aparece exactamente en la pantalla?

---

## CONVERSATION — Case 31 — Scenario 31.2 — Client Cannot Identify Location

**Usuario:** La máquina no va.
**Bot:** Hola, soy el asistente virtual de Ecolaundry. Te ayudo. ¿En qué lavandería estás?

**Usuario:** No lo sé, no reconozco el local.
**Bot:** Para poder ayudarte, necesito saber dónde estás. ¿Hay algún cartel o nombre visible en la puerta?

**Usuario:** No veo nada claro.
**Bot:** De acuerdo. Sin poder identificar la lavandería no puedo ayudarte directamente. Vamos a pasar tu caso a revisión. ¿Cómo te llamas?

**Usuario:** Tomás.
**Bot:** Gracias Tomás. Un operador se contactará contigo a la mayor brevedad posible para poder ayudarte. ¿Aceptas recibir una llamada telefónica?

## REPORT LLM

- No se detectaron criterios negativos.
