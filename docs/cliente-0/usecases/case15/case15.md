# Case 15 — La máquina muestra 001

## SCENARIO

**Scenario 15.1 — Escalation:** El cliente reporta que en la pantalla aparece el código 001. El chatbot recoge la localización, explica brevemente qué significa el código (selección de programa antes del pago sin reinicio del estado), y escala el caso a soporte humano sin pedir al cliente que realice acciones adicionales.

## ACCEPTANCE CRITERIA

### Generales

- El bot recoge la localización antes de proceder.
- El bot explica brevemente qué significa el código 001.
- El bot escala sin pedir manipulaciones adicionales al cliente.
- El bot mantiene un tono tranquilo y calmado.

### Scenario 15.1 — Escalation (001 requiere revisión)

- Tras explicar el código, el bot responde que necesita revisión manual.
- El bot pregunta el nombre del cliente con la frase `¿Cómo te llamas?`.
- El mensaje de escalación contiene `operador`, `revisión` y `brevedad`.
- El bot NO intenta resolver el problema automáticamente.

## CONVERSATION — Case 15 — Scenario 15.1 — 001 (Escalation)

**Usuario:** En la pantalla sale 001.
**Bot:** Gracias. ¿En qué lavandería estás?

**Usuario:** Pineda.
**Bot:** De acuerdo. Ese mensaje puede aparecer cuando el programa se ha seleccionado antes del pago y el estado no se ha reiniciado correctamente. Vamos a revisarlo manualmente para ayudarte de la mejor manera posible. ¿Cómo te llamas?

**Usuario:** María.
**Bot:** Gracias María. Un operador se encargará de tu caso a la mayor brevedad posible. ¿Aceptas recibir una llamada telefónica por uno de nuestros agentes para ayudarte?

**👤 Human Support message**
Usuario María en Pineda ha reportado un código 001 en pantalla. El código indica selección de programa antes del pago sin reinicio de estado. Requiere revisión manual.

## REPORT LLM

- No se detectaron criterios negativos.
