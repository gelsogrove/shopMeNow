# Case 25 — El cliente está muy enfadado

## SCENARIO

**Scenario 25.1 — Calm and Continue:** El cliente expresa enojo o frustración. El chatbot mantiene un tono calmado y empático, reconoce el malestar y recoge los datos mínimos (localización, tipo de máquina) para proceder.

**Scenario 25.2 — Escalation Path:** El cliente continúa muy alterado, exige solución inmediata o se niega a colaborar. El chatbot escala manteniendo la calma.

## ACCEPTANCE CRITERIA

### Generales

- El bot reconoce el malestar del cliente sin minimizarlo.
- El bot mantiene un tono calmado en todo momento.
- El bot NO discute ni se defiende.

### Scenario 25.1 — Calm and Continue

- El bot prosigue el flujo normal de gathering.
- El cliente colabora.

### Scenario 25.2 — Escalation Path

- El cliente persiste en alteración o no colabora.
- Bot escala mencionando que un operador puede ayudarle mejor.

## CONVERSATION — Case 25 — Scenario 25.1 — Angry Client Cooperates

**Usuario:** ¡Esto siempre falla! ¡Quiero una solución ya!
**Bot:** Entiendo tu malestar y quiero ayudarte. Vamos a revisarlo lo antes posible. ¿En qué lavandería estás?

**Usuario:** Goya.
**Bot:** Gracias. Para poder ayudarte bien, necesito saber: ¿es una lavadora o una secadora?

**Usuario:** Lavadora.
**Bot:** Perfecto. ¿Qué número de lavadora?

**Usuario:** La 4.
**Bot:** Gracias. ¿Qué aparece exactamente en la pantalla?

---

## CONVERSATION — Case 25 — Scenario 25.2 — Persistent Angry Escalation

**Usuario:** ¡Esto es una vergüenza! ¡Quiero que me solucionéis esto AHORA!
**Bot:** Entiendo perfectamente tu frustración. Vamos a hacer todo lo posible para ayudarte cuanto antes. ¿En qué lavandería estás?

**Usuario:** ¡No te voy a contestar nada hasta que me solucionéis esto!
**Bot:** Te entiendo. Para poder ayudarte mejor, voy a pasar tu caso directamente a un operador. ¿Cómo te llamas?

**Usuario:** Joan.
**Bot:** Gracias Joan. Un operador se contactará contigo a la mayor brevedad posible para ayudarte. ¿Aceptas recibir una llamada telefónica?

**👤 Human Support message**
Usuario Joan reporta incidencia con tono muy alterado. No proporciona detalles. Requiere atención prioritaria de operador humano.

## REPORT LLM

- No se detectaron criterios negativos.
