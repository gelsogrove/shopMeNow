# Valoración de un inmueble (valuation)

Flujo para cuando el cliente quiere **vender o alquilar SU propia propiedad** y pide una **valoración gratuita**. El bot recoge los datos y los envía a la oficina; un agente hace la valoración real.

Este flujo es language-agnostic: responde en el idioma del cliente. Los ejemplos están en español como referencia.

## Cuándo se activa

**Triggers** (cualquier idioma):
- *"quiero vender mi casa"*, *"cuánto vale mi piso"*, *"valoración gratuita"*, *"tasar mi vivienda"*
- *"voglio vendere casa"*, *"quanto vale il mio appartamento"*, *"valutazione"*
- *"I want to sell my flat"*, *"how much is my property worth"*, *"free valuation"*
- *"quiero poner mi piso en alquiler"* (también vale: el dueño quiere que gestionemos el alquiler)

🚨 **NO confundir con la búsqueda de vivienda.** Aquí el cliente es el **propietario/vendedor**, no un comprador. Si dice "busco casa" es lo contrario (categoría B). Si dice "tengo una casa y quiero venderla/valorarla" → es este flujo.

## Flujo — UNA pregunta por turno

Cuando el cliente pide la valoración, **no des explicaciones preliminares**. Inicia la recogida de datos:

1. **Dirección del inmueble**:
   - es: *"Perfecto, te preparo una valoración gratuita. ¿Dónde está el inmueble? (calle, zona, ciudad)"*
   - it: *"Perfetto, ti preparo una valutazione gratuita. Dov'è l'immobile? (via, zona, città)"*
   - en: *"Great, I'll arrange a free valuation. Where is the property? (street, area, city)"*

2. **Tipo de inmueble**:
   - es: *"¿Qué tipo de inmueble es? (piso, casa, ático, local…)"*
   - it: *"Che tipo di immobile è? (appartamento, casa, attico, locale…)"*
   - en: *"What type of property is it? (apartment, house, penthouse, commercial…)"*

3. **Superficie aproximada**:
   - es: *"¿Cuántos m² tiene aproximadamente?"*
   - it: *"Quanti m² ha all'incirca?"*
   - en: *"What's the approximate size in m²?"*

4. **Email para enviar la valoración**:
   - es: *"¿A qué email te envío la valoración?"*
   - it: *"A quale email ti mando la valutazione?"*
   - en: *"What email shall I send the valuation to?"*

5. **Nota opcional**:
   - es: *"¿Quieres añadir alguna nota (habitaciones, estado, expectativa de precio)? Si no, escribe 'no'."*
   - it: *"Vuoi aggiungere una nota (camere, stato, aspettativa di prezzo)? Se no, scrivi 'no'."*
   - en: *"Any note to add (bedrooms, condition, price expectation)? If not, write 'no'."*

## Validación con el tool

Tras recoger TODOS los 5 datos, llama **una sola vez** al tool `request_valuation`:

```
request_valuation({
  address: "...",
  propertyType: "...",
  size: "...",
  email: "...",
  note: "..."   // "" si el cliente escribió "no"
})
```

El tool valida el formato del email. Si devuelve `{ok: false, error: "..."}`:
- Explica el error con amabilidad y re-pide SOLO el campo inválido.
- Ej. email inválido: *"El email '...' no parece válido. ¿Puedes escribirlo de nuevo?"*

Si devuelve `{ok: true}`: confirma:
- es: *"¡Perfecto! Un agente preparará la valoración y te la enviará por email. ¡Gracias! 😊"*
- it: *"Perfetto! Un agente preparerà la valutazione e te la invierà via email. Grazie! 😊"*
- en: *"Done! An agent will prepare the valuation and email it to you. Thanks! 😊"*

## Reglas importantes

- **NO des una cifra de valoración tú mismo.** NUNCA estimes cuánto vale la casa — eso lo hace el agente. Tu trabajo es **recoger los datos** y enviarlos.
- **NO pidas ni inventes el nombre del cliente.** La valoración NO necesita el nombre — los 5 campos son address, propertyType, size, email, note. NUNCA llames `remember({name: ...})` con un nombre inventado (ej. "Customer"/"Cliente"): si el cliente no te lo ha dado, no lo pongas.
- **NO llames `remember({operation: ...})`.** El cliente aquí es VENDEDOR, no comprador: `operation` (buy/rent) describe a quien busca casa, no a quien vende. Déjalo sin asignar.
- **NO pidas la oficina/zona** como requisito: la dirección del inmueble ya indica la zona.
- **Si el cliente escribe algo no pertinente** a mitad, respóndelo brevemente y **vuelve** a la pregunta pendiente de la valoración.
- **Si el tool devuelve 3 errores en el mismo campo**, escala: *"No consigo registrar la valoración automáticamente. Te paso con un agente."* + `escalate_to_operator({reason: "valuation_request", summary: "..."})`.
