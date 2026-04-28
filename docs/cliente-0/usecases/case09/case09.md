# Case 9 — Quiero una factura

## SCENARIO

**Objetivo:** Dar una instrucción cerrada y clara al cliente que solicita factura, sin entrar en troubleshooting técnico.

**Cuándo aplica:** El cliente solicita una factura por el servicio utilizado. Es una consulta informativa cerrada: el bot saluda como asistente virtual de Ecolaundry y proporciona el correo `olga@alberwaz.net` y el listado completo de información que el cliente debe enviar (razón social, email, lavandería utilizada, CIF/NIF, dirección, fecha de uso, máquinas utilizadas y observaciones).

**Scenario 9.1 — Happy Path:** El cliente pide una factura. El bot saluda, da el correo y la lista completa de datos en una sola respuesta.

## ACCEPTANCE CRITERIA

### Scenario 9.1 — Happy Path

- El bot saluda como asistente virtual de Ecolaundry en la primera respuesta
- La respuesta contiene el correo `olga@alberwaz.net`
- La respuesta menciona los datos requeridos: razón social, CIF/NIF, dirección, fecha de uso
- El bot NO pregunta si es lavadora o secadora
- El bot NO escala a operador

---

## CONVERSATION — Case 9 — Scenario 9.1 — Solicitud de factura (Happy Path)

**Usuario:** Quiero una factura.
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry, estoy aquí para ayudarte. Para obtener tu factura, debes enviar un correo a olga@alberwaz.net con esta información: razón social, email, lavandería utilizada, CIF/NIF, dirección, fecha de uso, máquinas utilizadas y observaciones.

## REPORT LLM

- No se detectaron criterios negativos.
