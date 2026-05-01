# Case 26 — El cliente exige devolución inmediata

## SCENARIO

**Scenario 26.1 — Escalation:** El cliente exige una devolución inmediata. El chatbot recoge los datos necesarios para tramitar (últimos 4 dígitos de tarjeta, captura del pago, breve resumen), pero NO promete la devolución; escala a soporte humano para evaluación.

## ACCEPTANCE CRITERIA

- El bot reconoce la solicitud sin prometer.
- El bot solicita datos: últimos 4 dígitos, captura, resumen.
- El bot escala SIEMPRE para evaluación manual.
- Tono empático.

## CONVERSATION — Case 26 — Scenario 26.1 — Refund Demand

**Usuario:** Quiero que me devolváis el dinero ahora mismo.
**Bot:** Vamos a revisarlo contigo. Para tramitarlo, necesito los últimos 4 dígitos de la tarjeta con la que pagaste, una captura del pago y un breve resumen de lo ocurrido.

**Usuario:** Quiero la devolución ya.
**Bot:** Entiendo lo que me indicas. Vamos a pasar el caso a revisión para aplicar la solución más adecuada. ¿Cómo te llamas?

**Usuario:** Carles.
**Bot:** Gracias Carles. Un operador revisará tu solicitud a la mayor brevedad posible. ¿Aceptas recibir una llamada telefónica?

**👤 Human Support message**
Usuario Carles solicita devolución inmediata. NO proporciona últimos 4 dígitos ni captura. Requiere evaluación manual de devolución y obtención de datos faltantes.

## REPORT LLM

- No se detectaron criterios negativos.
