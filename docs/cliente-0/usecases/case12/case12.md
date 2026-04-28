# Case 12 — Horarios y precios

## SCENARIO

**Objetivo:** Responder consultas generales de horarios y precios sin inventar datos.

**Cuándo aplica:** El cliente pregunta por horarios de atención o precios de las máquinas. Es una consulta informativa: el bot saluda como asistente virtual de Ecolaundry y responde — el horario general es de 8:00 a 22:00 todos los días del año, con la excepción de L'Escala (7:00 a 23:00). Para precios, si el dato no está confirmado, el bot indica explícitamente que necesita revisarlo antes de confirmar el importe (no inventa valores).

**Scenario 12.1 — Happy Path: Horario:** El cliente pregunta el horario. El bot saluda y responde con el horario general más la excepción de L'Escala.

**Scenario 12.2 — Pregunta sobre precio:** El cliente pregunta el precio de una máquina. El bot saluda e indica que necesita revisarlo antes de confirmar el importe.

## ACCEPTANCE CRITERIA

### Scenario 12.1 — Happy Path: Horario

- El bot saluda como asistente virtual de Ecolaundry en la primera respuesta
- La respuesta indica horario general 8:00 a 22:00
- La respuesta menciona la excepción de L'Escala con horario 7:00 a 23:00
- El bot NO inventa horarios distintos
- El bot NO pregunta si es lavadora o secadora

### Scenario 12.2 — Pregunta sobre precio

- El bot saluda como asistente virtual de Ecolaundry en la primera respuesta
- El bot NO inventa el precio de la máquina
- La respuesta indica que necesita revisarlo antes de confirmar el importe
- El bot NO pregunta si es lavadora o secadora

---

## CONVERSATION — Case 12 — Scenario 12.1 — Horario (Happy Path)

**Usuario:** ¿Cuál es el horario?
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry, estoy aquí para ayudarte. El horario general de atención al público es de 8:00 a 22:00 todos los días del año. En L'Escala las máquinas se pueden utilizar de 7:00 a 23:00. Si me preguntas por el precio de una máquina concreta, tengo que revisarlo antes de confirmártelo.

---

## CONVERSATION — Case 12 — Scenario 12.2 — Pregunta sobre precio

**Usuario:** ¿Cuánto cuesta esta máquina?
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry, estoy aquí para ayudarte. El horario general de atención al público es de 8:00 a 22:00 todos los días del año. En L'Escala las máquinas se pueden utilizar de 7:00 a 23:00. Si me preguntas por el precio de una máquina concreta, tengo que revisarlo antes de confirmártelo.

## REPORT LLM

- No se detectaron criterios negativos.
