# Case 19 — El cliente dice que el datáfono ha cobrado 10 € en Goya

## SCENARIO

**Scenario 19.1 — Escalation:** El cliente está en Goya y afirma que el datáfono le ha cobrado 10 €, importe que no es coherente con los precios habituales del local. El chatbot detecta la incoherencia y escala sin acusar al cliente.

## ACCEPTANCE CRITERIA

- El bot recoge contexto (servicio usado o no).
- El bot NO acusa al cliente de mentir.
- El bot escala citando "información que no coincide".
- Tono respetuoso.

## CONVERSATION — Case 19 — Scenario 19.1 — Goya 10€ Charge Discrepancy

**Usuario:** Estoy en Goya y el datáfono me ha cobrado 10 €.
**Bot:** Gracias por indicarlo. Vamos a revisarlo contigo. ¿Has podido usar el servicio?

**Usuario:** No.
**Bot:** De acuerdo. Hay una información que no coincide y necesitamos revisarla manualmente. ¿Cómo te llamas?

**Usuario:** Andreu.
**Bot:** Gracias Andreu. Un operador revisará tu caso a la mayor brevedad posible. ¿Aceptas recibir una llamada telefónica?

**👤 Human Support message**
Usuario Andreu en Goya reporta cobro de 10 € por datáfono y servicio no usado. Importe incoherente con precios del local. Requiere revisión manual de transacción.

## REPORT LLM

- No se detectaron criterios negativos.
