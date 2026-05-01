# Case 20 — El cliente dice que el datáfono ha cobrado 10 € en Pineda

## SCENARIO

**Scenario 20.1 — Escalation:** El cliente está en Pineda y afirma que el datáfono ha cobrado 10 €, importe incoherente. El chatbot detecta y escala sin confrontar.

## ACCEPTANCE CRITERIA

- El bot recoge contexto (servicio usado).
- El bot NO confronta.
- El bot escala citando información incoherente.

## CONVERSATION — Case 20 — Scenario 20.1 — Pineda 10€ Charge Discrepancy

**Usuario:** En Pineda me ha cobrado 10 €.
**Bot:** Gracias. Vamos a revisarlo. ¿Has podido lavar o secar la ropa?

**Usuario:** No.
**Bot:** De acuerdo. Hay una información que no coincide y necesitamos comprobarla manualmente. ¿Cómo te llamas?

**Usuario:** Marta.
**Bot:** Gracias Marta. Un operador revisará tu caso a la mayor brevedad posible. ¿Aceptas recibir una llamada telefónica?

**👤 Human Support message**
Usuario Marta en Pineda reporta cobro de 10 € por datáfono y servicio no usado. Importe incoherente. Requiere revisión manual.

## REPORT LLM

- No se detectaron criterios negativos.
