# Per-Location Overrides

## Why this exists

Ecolaundry opera varias lavanderías que comparten el mismo modelo de máquina y el mismo flujo base, pero **cada una tiene reglas y diferencias propias**: horarios distintos, presencia o ausencia de tarjeta de fidelidad, central con o sin botones, problemas conocidos con la tarjeta o con los minutos de la secadora, importes anómalos que disparan escalation, instrucciones específicas (p. ej. el cliente debe limpiar él mismo el filtro de la secadora).

Si modeláramos cada lavandería con un LLM dedicado, multiplicaríamos los prompts, fragmentaríamos la lógica y perderíamos la coherencia del tono. La solución elegida es **un único LLM** alimentado con un **contexto de override** específico para la ubicación activa, leído desde un archivo de configuración.

## File location

```
apps/backend/custom-client-0/json/locations.json
```

Cargado por el demo runner al inicio. Cuando el Router extrae `state.location`, el sistema busca `locations[state.location]` y, si existe, lo inyecta como `ACTIVE LOCATION CONTEXT` en los system prompts del Specialist y de Conversation History.

## Identifier convention — Pueblo + Calle

El cliente debe identificar la lavandería con **pueblo y calle**, no con un nombre comercial. La pregunta inicial del Router/History debe ser:

> ¿En qué pueblo y calle estás exactamente?

Cada entrada de `locations.json` declara:

- `pueblo` — la ciudad o municipio (ej. Madrid, Pineda de Mar)
- `calle` — la vía (ej. Calle Goya)
- `displayName` — la forma humana corta usada en los mensajes al cliente (ej. "Calle Goya (Madrid)")

La clave del objeto en `locations` puede ser una abreviatura usable internamente (ej. `Goya`, `Alemanya`) y debe coincidir con lo que el Router extrae como `location`.

## Override types

Cada entrada de `locations[<key>]` puede declarar uno o varios bloques. Todos son opcionales: lo que no está sobrescrito se hereda del comportamiento base.

### `metadata`
Hechos estáticos sobre el local que el LLM puede leer para responder preguntas y adaptar instrucciones, sin necesidad de un texto fijo. Ejemplos:

- `hours`: `"8:00-22:00"` o `"7:00-23:00"`
- `centralType`: `"buttons"`
- `cardUnitPrice`: `"7€"`, `"8€"`
- `returnsChangeCoins`: `true | false`
- `loyaltyCard`: `true | false`
- `dryerFilterSelfService`: `true | false`
- `cardPaymentUnreliable`: `true | false`
- `ajaxRestartPossible`: `true | false`
- `dryerMinutesIncreaseIssue`: `true | false`
- `selfStartMachine`: `true | false`

Es libre y extensible: si una nueva diferencia aparece, se añade un campo aquí y el LLM lo usa porque está en el contexto.

### `faqOverrides`
Mapa `{ faqKey: stringOverride }`. Cuando el Router decide responder una FAQ y la ubicación activa tiene un override para esa misma `faqKey` (clave que existe en `faqs.json`), Conversation History debe usar la versión local en lugar de la base. Ejemplo:

```json
"faqOverrides": {
  "openingHours": "En L'Escala, las máquinas se pueden utilizar de 7:00 a 23:00.",
  "loyaltyCard": "L'Escala no dispone de tarjeta de fidelidad."
}
```

### `flowOverrides`
Mapa `{ "flowFile.flowId.stepId": { prompt?: string, ... } }`. Cuando el Flow Engine renderiza un nodo, antes de mostrarlo verifica si hay un override para ese path y, si existe, hace merge superficial. Ejemplo:

```json
"flowOverrides": {
  "asciugatrice_ed340.non_parte.filter_warning": {
    "prompt": "Recuerda que en este local el cliente debe limpiar el filtro de la secadora abriendo el cajón."
  }
}
```

Permite cambiar el texto de un paso del flujo sin duplicar el flujo entero.

### `escalationRules`
Array de reglas `{ id, trigger, action, reason }`:

- `id` — identificador único de la regla (ej. `datafono-10eur-anomaly`)
- `trigger` — descripción en lenguaje natural de la condición que dispara la regla (el LLM evalúa si se cumple, no hay regex)
- `action` — qué hacer: `"escalate"`, `"suggest_coins_or_escalate"`, o cualquier acción documentada
- `reason` — motivo interno; se registra en el log y puede aparecer en `escalationReason`

El Specialist LLM recibe estas reglas en el contexto y, cuando la conversación cumple un trigger, devuelve la `action` correspondiente. **Nunca** se evalúa con regex sobre el mensaje; siempre vía LLM.

## Runtime injection contract

Cuando hay una `state.location` que coincide con una entrada de `locations.json`, los prompts de Specialist y Conversation History reciben un bloque al inicio del system prompt:

```
ACTIVE LOCATION CONTEXT:
<location override JSON>

INSTRUCTIONS:
- Apply faqOverrides verbatim when the customer asks a matching FAQ.
- Apply flowOverrides when the Flow Engine renders the matching step.
- Trigger escalationRules when the conversation matches a rule's trigger description.
- Use metadata to adapt answers about hours, change, prices, etc.
- Anti-hardcode: do not branch on location name in code or prompts; read from this context.
```

Si no hay override para la ubicación (porque el cliente está en una nueva o porque la `location` aún no se ha extraído), el LLM trabaja con el comportamiento base.

## How the LLM Uses Location Context

When the Router extracts `state.location` (e.g., `"Goya"`), the system does this:

1. **Load override**: Looks up `locations.json["Goya"]`
2. **Build context**: Calls `buildLocationContext()` in demo.ts, which formats the override as:
   ```
   ACTIVE LOCATION CONTEXT:
   {
     "pueblo": "Madrid",
     "calle": "Calle Goya",
     "displayName": "Calle Goya (Madrid)",
     "metadata": { ... },
     "faqOverrides": { ... },
     ...
   }
   
   INSTRUCTIONS:
   - Apply faqOverrides verbatim when the customer asks a matching FAQ.
   - Apply flowOverrides when the Flow Engine renders the matching step.
   - Trigger escalationRules when the conversation matches a rule's trigger description.
   - Use metadata to adapt answers about hours, change, prices, etc.
   - Anti-hardcode: do not branch on location name in code or prompts; read from this context.
   ```
3. **Inject into prompts**: The Specialist and Conversation History LLMs receive this block at the START of their system prompts (see lines 1986-1992 and 2347-2348 in demo.ts)
4. **LLM reasoning**: The LLM has ONE intelligence, but its behavior varies because the prompt context changes per location
   - Same troubleshooting logic, different answers based on location metadata
   - Same FAQ base, but location-specific overrides when present
   - Same flow, but location-specific step prompts when present

**Example**: When customer at Goya asks "how do I use the loyalty card?":
- Specialist/History receives the Goya override in context
- Reads `faqOverrides.loyaltyCard` = location-specific answer
- Returns that answer instead of the base FAQ answer
- Same LLM, one-context-per-location, no hardcoding

## Adding a new location

1. Añadir una nueva entrada en `locations.json` con al menos `pueblo`, `calle`, `displayName`.
2. Si tiene diferencias, declarar `metadata`, `faqOverrides`, `flowOverrides` o `escalationRules`.
3. Añadir el nuevo nombre de ubicación a KNOWN_LOCATIONS en demo.ts (línea ~381)
4. Verificar que el Router pueda extraer correctamente la `location` con el nuevo nombre
5. No añadir lógica condicional por nombre de ubicación en el código; toda la diferenciación vive en `locations.json`

## Anti-patterns

- ❌ Hardcodear "Goya" o "L'Escala" en el código TypeScript o en los prompts (ej. `if (location === "Goya")`).
- ❌ Crear un LLM/agent dedicado por lavandería.
- ❌ Duplicar `lavatrice_hs60xx.json` o `asciugatrice_ed340.json` por local.
- ❌ Reescribir las FAQ base con condicionales por ubicación dentro de `faqs.json`.
- ❌ Usar regex sobre el mensaje del cliente para detectar condiciones de `escalationRules`.
