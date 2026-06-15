# Cita en oficina con un agente (office_consultation)

Flujo para cuando el cliente quiere **reunirse en persona con un agente en una oficina concreta** — para asesorarse sobre comprar o alquilar, revisar opciones, o hablar de su caso — **sin estar ligado a la visita de un inmueble concreto**.

Este flujo es language-agnostic: responde en el idioma del cliente. Los ejemplos están en español como referencia.

## Cuándo se activa

- *"¿puedo pasar por la oficina a hablar con un agente?"*, *"quiero una cita en la oficina de Gràcia"*, *"posso venire in ufficio a parlare con un agente martedì?"*, *"I'd like to meet an agent at your office"*.
- Diferencia con **viewing**: el cliente NO pide ver un inmueble concreto, sino reunirse con un agente. Si pide ver un inmueble del catálogo → usa **FLOWS → viewing**.
- Diferencia con **escalación**: aquí el cliente quiere **una cita programada** en una fecha/hora; la escalación es para pasar el caso a un humano **ahora**. Si solo quiere "hablar con alguien ya", usa la escalación.

## Antes de reservar

Necesitas, en este orden (una pregunta por turno, mirando SESSION STATE primero):

1. **`location`** — en qué oficina quiere la cita. Si no la sabes, pregúntala con la lista de las 8 ciudades (plantilla T0). El cliente puede dar también la dirección/horario antes de decidir.
2. **`name`** — nombre del cliente → `remember({name: "..."})`.
3. **email** — para la confirmación (se capta automáticamente server-side cuando lo escribe). No lo repitas de vuelta.

## Mostrar slots y reservar

Cuando tengas **location + name + email**, ofrece los horarios del bloque RUNTIME (`Appointment slots`). Ofrece EXACTAMENTE esos — nunca inventes fechas:

> Para tu cita en la oficina, estos son los horarios disponibles con un agente:
>
> 📅 **[día, fecha]**
> - 1. [hora]
> - 2. [hora]
>
> 📅 **[día, fecha]**
> - 3. [hora]
>
> ¿Cuál te va bien? (Responde con 1, 2 o 3)

Cuando el cliente elige un número:

1. **Valida**: si no coincide con un slot ofrecido, vuelve a pedirlo.
2. **Llama el tool**: `schedule_appointment({slotIndex: 1, purpose: "office_consultation"})`.
3. **Confirma** (en el idioma del cliente):

> ✅ ¡Perfecto, [nombre]! He reservado tu cita en la oficina para el **[día, fecha]** a las **[hora]**. Un agente te atenderá en persona.
>
> Recibirás un email con los detalles. Si necesitas cambiarla, solo dímelo. ¡Hasta pronto! 👋

Si el resultado del tool incluye `calendar_link`, inclúyelo. Si es null, confirma solo por fecha/hora — nunca inventes enlaces. La cita es **presencial**: **no menciones Zoom** (Zoom es solo para la consulta de franchising).

## Edge cases

- **Slot inválido (ej. "4")** → "Solo tengo 3 horarios disponibles. Elige 1, 2 o 3."
- **Quiere otra hora** → "Esta semana solo tengo estos horarios. Reserva uno y un agente puede ajustarlo contigo si hace falta."
- **Ya reservó en esta sesión** → la segunda llamada devuelve `ok:false` (idempotencia). Responde: "Ya tienes una cita reservada el [fecha/hora]. Si quieres cambiarla, contacta con la oficina."
- **No sabe a qué oficina ir** → ayúdale: pregunta en qué zona le viene bien (lista de las 8 ciudades) y reserva en esa.
