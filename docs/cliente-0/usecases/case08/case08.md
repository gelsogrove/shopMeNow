# Case 8 — Tengo un código

## SCENARIO

**Objetivo:** Reconocer que el cliente quiere usar un código (descuento, cupón, prepago) y darle la primera instrucción de forma directa sin entrar en troubleshooting técnico.

**Cuándo aplica:** El cliente menciona que tiene un código y necesita ayuda para usarlo. Es una consulta informativa one-shot: el bot saluda como asistente virtual de Ecolaundry, reconoce el intent del código y pide el código exacto (incluyendo letras si las hay) en una única respuesta canned. NO formula preguntas de troubleshooting técnico (lavadora/secadora, número de máquina, contenido de la pantalla) porque el caso no es un problema de máquina sino una consulta sobre uso de un código. Tampoco mezcla la pregunta del código con la de la lavandería — una sola pregunta por turno.

**Scenario 8.1 — Happy Path:** El cliente menciona "tengo un código y no sé cómo usarlo". El bot saluda, reconoce el intent y pide el código exacto en una única respuesta.

**Scenario 8.2 — Variante:** Misma intención del cliente, misma respuesta canned del bot.

## ACCEPTANCE CRITERIA

### Scenario 8.1 — Happy Path

- El bot saluda como asistente virtual de Ecolaundry en la primera respuesta
- La respuesta menciona la palabra "código"
- En la primera respuesta el bot pide SOLO el código (no pregunta también por la lavandería en el mismo turno)
- El bot NO pregunta si es lavadora o secadora
- El bot NO pregunta qué aparece en la pantalla
- El bot NO escala a operador

### Scenario 8.2 — Variante

- El bot saluda como asistente virtual de Ecolaundry en la primera respuesta
- La respuesta menciona la palabra "código"
- El bot NO pregunta si es lavadora o secadora

---

## CONVERSATION — Case 8 — Scenario 8.1 — Código + importe pendiente (Happy Path)

**Usuario:** Tengo un código y no sé cómo usarlo.
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry, estoy aquí para ayudarte. Te ayudo con el código. ¿Me dices el código exacto tal como lo ves, incluyendo letras si las hay?

---

## CONVERSATION — Case 8 — Scenario 8.2 — Variante

**Usuario:** Tengo un código y no sé cómo usarlo.
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry, estoy aquí para ayudarte. Te ayudo con el código. ¿Me dices el código exacto tal como lo ves, incluyendo letras si las hay?
