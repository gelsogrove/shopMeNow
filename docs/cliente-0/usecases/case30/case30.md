# Case 30 — Código no documentado en pantalla

## SCENARIO

**Scenario 30.1 — Escalation:** El cliente reporta un código en pantalla que no coincide con ninguno conocido (SEL, PUSH PROG, DOOR, ALM DOOR, 001, ALM, ALN). El chatbot recoge la localización y escala porque no puede diagnosticar un código desconocido.

## ACCEPTANCE CRITERIA

- El bot recoge la localización antes de escalar.
- El bot reconoce que el código NO coincide con casos documentados.
- El bot escala citando "necesita revisión manual".
- El bot NO inventa un diagnóstico.

## CONVERSATION — Case 30 — Scenario 30.1 — Undocumented Code

**Usuario:** En la pantalla sale ERR 52.
**Bot:** Gracias. ¿En qué lavandería estás?

**Usuario:** L'Escala.
**Bot:** De acuerdo. Ese código no coincide con un caso documentado y necesitamos revisarlo manualmente. ¿Cómo te llamas?

**Usuario:** Aina.
**Bot:** Gracias Aina. Un operador revisará tu caso a la mayor brevedad posible. ¿Aceptas recibir una llamada telefónica?

**👤 Human Support message**
Usuario Aina en L'Escala reporta código ERR 52 en pantalla. Código NO documentado. Requiere revisión técnica.

## REPORT LLM

- No se detectaron criterios negativos.
