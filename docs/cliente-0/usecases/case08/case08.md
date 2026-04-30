# Case 8 — Tengo un código de importe menor

## SCENARIO

**Objetivo:** Ayudar al cliente a completar el proceso con un código y un pequeño importe pendiente.

**Cuándo aplica:** El cliente tiene un código válido (con letras delante) y solo le falta una pequeña parte del importe. El bot pide el código exacto, la lavandería, verifica si falta o sobra importe, da instrucciones para introducir el importe pendiente en la central y confirma la resolución. Una sola pregunta por turno.

**Scenario 8.1 — Happy Path:** El cliente tiene un código y le falta un pequeño importe. El bot recoge el código, la lavandería, verifica la situación del importe, da instrucciones para completar la operación y cierra el caso como resuelto.

**Scenario 8.2 — Escalación: no funciona tras introducir el importe:** El bot sigue el mismo flujo pero, tras dar las instrucciones, el cliente indica que la máquina sigue sin funcionar. El bot escala a soporte humano.

## ACCEPTANCE CRITERIA

### Generales

- El bot pide el código exacto (incluyendo letras si las hay) en la primera respuesta
- El bot pregunta la lavandería después de recibir el código
- El bot NO pregunta si es lavadora o secadora
- El bot NO escala de inmediato: primero da instrucciones para el importe pendiente

### Scenario 8.1 — Happy Path

- El bot pregunta si falta una pequeña parte o el código cubre un importe mayor
- El bot indica introducir el importe que falta en la central y no tocar nada más
- El mensaje final confirma resolución con "resuelta" o "perfecto"
- El bot NO escala

### Scenario 8.2 — Escalación: no funciona tras el paso indicado

- Cuando el cliente indica que sigue sin funcionar, el bot escala
- El mensaje de escalación contiene la palabra "operador"

---

## CONVERSATION — Case 8 — Scenario 8.1 — Código con importe pendiente (Happy Path)

**Usuario:** Tengo un código y no sé cómo usarlo.
**Bot:** ¡Hola! Soy el asistente virtual de la lavandería, estoy aquí para ayudarte. Te ayudo con el código. ¿Me dices el código exacto tal como lo ves, incluyendo letras si las hay?

**Usuario:** AB12345.
**Bot:** Gracias. ¿En qué lavandería lo quieres usar?

**Usuario:** Goya.
**Bot:** Perfecto. ¿Te falta una pequeña parte para completar el importe o el código cubre un importe mayor?

**Usuario:** Me falta un poco.
**Bot:** De acuerdo. Introduce en la central el importe que falta y no toques nada más. Después ponte delante de la máquina y dime si ya puedes continuar.

**Usuario:** Sí, ya funciona.
**Bot:** Perfecto, incidencia resuelta.

---

## CONVERSATION — Case 8 — Scenario 8.2 — Escalación: no funciona tras introducir el importe

**Usuario:** Tengo un código y no sé cómo usarlo.
**Bot:** ¡Hola! Soy el asistente virtual de la lavandería, estoy aquí para ayudarte. Te ayudo con el código. ¿Me dices el código exacto tal como lo ves, incluyendo letras si las hay?

**Usuario:** AB12345.
**Bot:** Gracias. ¿En qué lavandería lo quieres usar?

**Usuario:** Goya.
**Bot:** Perfecto. ¿Te falta una pequeña parte para completar el importe o el código cubre un importe mayor?

**Usuario:** Me falta un poco.
**Bot:** De acuerdo. Introduce en la central el importe que falta y no toques nada más. Después ponte delante de la máquina y dime si ya puedes continuar.

**Usuario:** No, sigue sin funcionar.
**Bot:** Entiendo. Voy a pasarte con un operador para que te ayude personalmente.

## REPORT LLM

- ❌ El bot pregunta si falta una pequeña parte o el código cubre un importe mayor
  > Por qué no se cumple: Deterministic rule evaluation marked this criterion as not satisfied.
  > Ejemplo: "¡Hola! Soy el asistente virtual de la lavandería, estoy aquí para ayudarte. Te ayudo con el código. ¿Me dices el código exacto tal como lo ves, incluyendo letras si las hay?"
