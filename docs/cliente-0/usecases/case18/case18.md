# Case 18 — El cliente da un código solo numérico y dice que no hay letras

## SCENARIO

**Scenario 18.1 — Escalation:** El cliente facilita un código compuesto solo por números y afirma que no hay letras delante. Esto es una incoherencia: los códigos válidos siempre tienen letras. El chatbot detecta la incoherencia y escala sin confrontar al cliente.

## ACCEPTANCE CRITERIA

- El bot pregunta si hay letras delante del número.
- El bot NO acusa al cliente de mentir.
- El bot escala citando la necesidad de revisión manual.
- Tono respetuoso y no confrontacional.

## CONVERSATION — Case 18 — Scenario 18.1 — Numeric-only Code

**Usuario:** Tengo un código: 23432023.
**Bot:** Gracias. ¿Ves alguna letra delante de los números?

**Usuario:** No.
**Bot:** De acuerdo. Hay una información que necesitamos revisar manualmente antes de continuar. ¿Cómo te llamas?

**Usuario:** Lucía.
**Bot:** Gracias Lucía. Un operador revisará tu caso a la mayor brevedad posible. ¿Aceptas recibir una llamada telefónica?

**👤 Human Support message**
Usuario Lucía facilita código numérico (23432023) sin letras delante. Incoherencia con códigos válidos esperados. Requiere revisión manual.

## REPORT LLM

- No se detectaron criterios negativos.
