# Case 17 — El cliente no sabe qué aparece en pantalla

## SCENARIO

**Scenario 17.1 — Photo Path:** El cliente no sabe leer o ver bien la pantalla de la máquina. El chatbot recoge localización y tipo de máquina, solicita una foto de la pantalla, y si el cliente la envía, continúa el diagnóstico con la imagen.

**Scenario 17.2 — Escalation Path:** El cliente no puede hacer una foto de la pantalla. El chatbot escala el caso a soporte humano sin solicitar intentos adicionales.

## ACCEPTANCE CRITERIA

### Generales (ambos escenarios)

- El bot recoge localización y tipo de máquina (lavadora/secadora).
- El bot mantiene un tono tranquilo ("Tranquilo, lo revisamos juntos").
- El bot ofrece foto como opción antes de escalar.

### Scenario 17.1 — Photo Path

- El bot solicita: "Si puedes, envíame una foto de la pantalla."
- El cliente envía foto.
- El bot continúa el diagnóstico (no escalado).

### Scenario 17.2 — Escalation Path

- El cliente indica que no puede hacer foto.
- El bot escala directamente sin insistir.
- Mensaje de escalación contiene `revisión`, `manual`.

## CONVERSATION — Case 17 — Scenario 17.1 — Photo Provided

**Usuario:** La máquina no va, pero no sé qué pone.
**Bot:** Tranquilo, lo revisamos juntos. ¿En qué lavandería estás?

**Usuario:** Hortes.
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora.
**Bot:** Perfecto. Si puedes, envíame una foto de la pantalla. Si no, lo pasamos a revisión.

**Usuario:** [Foto de pantalla con SEL]
**Bot:** Gracias. Veo que en la pantalla aparece SEL. Esto significa que el programa está seleccionado pero la máquina no ha arrancado aún. Presiona el botón de programa para iniciar el lavado.

---

## CONVERSATION — Case 17 — Scenario 17.2 — No Photo Available

**Usuario:** La máquina no va, pero no sé qué pone.
**Bot:** Tranquilo, lo revisamos juntos. ¿En qué lavandería estás?

**Usuario:** Hortes.
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora.
**Bot:** Perfecto. Si puedes, envíame una foto de la pantalla. Si no, lo pasamos a revisión.

**Usuario:** No puedo hacer la foto.
**Bot:** De acuerdo. Vamos a revisarlo manualmente para poder ayudarte. ¿Cómo te llamas?

**Usuario:** Josep.
**Bot:** Gracias Josep. Un operador se encargará de tu caso a la mayor brevedad posible. ¿Aceptas recibir una llamada telefónica?

**👤 Human Support message**
Usuario Josep en Hortes reporta que la lavadora no funciona pero no puede ver qué aparece en pantalla. Requiere revisión visual manual.

## REPORT LLM

- No se detectaron criterios negativos.
