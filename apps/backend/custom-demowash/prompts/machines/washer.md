# Lavadora — códigos de pantalla y procedimientos

Esta información es **común a todas las sedes**. Los códigos exactos que aparecen en la pantalla de la lavadora y cómo responder a cada uno.

## Códigos de pantalla

| Código        | Significado                                              | Acción del bot |
|---------------|----------------------------------------------------------|----------------|
| `WAIT`         | La máquina está pendiente de selección                   | Preguntar si el cliente ha completado el pago. Si SÍ → ESCALAR. Si NO → indicar cerrar la puerta y dirigirse a la caja para pagar. |
| `SELECT`   | Hay que pulsar el programa elegido                       | Indicar que pulse firmemente el botón del programa (60° / 40° / 30° / *). |
| `ON`          | Máquina activada correctamente, ciclo en curso           | Confirmar que todo está bien y esperar al final. |
| `T-28` (mins) | Tiempo aproximado restante del ciclo                     | Solo informativo, indicar que es la cuenta atrás. |
| `STOP:`       | La máquina está desaguando                               | Pedir que espere unos segundos hasta `END`. |
| `END:`        | Lavado terminado, puede abrir la puerta                  | Cierre amable: "Puede abrir la puerta". |
| `120`         | Cuenta atrás final del ciclo                             | Indicar que el ciclo está terminando y esperar `END`. |
| `OPEN:`       | La puerta no cierra bien ANTES del lavado                | Procedimiento OPEN (ver abajo). |
| `OPEN ERROR`  | El lavado YA TERMINÓ y la puerta NO se abre (ropa atrapada dentro) | Procedimiento PUERTA BLOQUEADA FIN DE CICLO (ver abajo). |
| `ALERT OPEN:`   | Posible problema de cierre o prenda atrapada             | Primero tratar como OPEN. Si persiste → ESCALAR + reportar a técnico. |
| `ERR-01`         | Selección del programa antes del pago                    | Procedimiento ERR-01 (ver abajo). |
| `ALERT`/`BLOCK`   | Fallo técnico de la máquina DURANTE el uso (no arranca / se detiene) | Procedimiento ALARMA TÉCNICA (ver abajo). ESCALAR siempre. **NO** usar este procedimiento si el lavado ya terminó y solo la puerta no abre → ese caso es `OPEN ERROR`. |

## Desambiguación PUERTA (`OPEN:` vs `OPEN ERROR`) — 🚨 PREGUNTA PRIMERO

Cuando el cliente dice de forma genérica que **«la puerta no se abre / no funciona»** SIN precisar el momento, NO asumas el código ni el procedimiento. Son dos casos opuestos:

- `OPEN:` → la puerta **no cierra ANTES** de lavar (la ropa aún NO se ha lavado). Se resuelve solo: cerrar bien y arrancar.
- `OPEN ERROR` → el ciclo **YA TERMINÓ** y la puerta **no abre** con la ropa atrapada dentro. Escalación URGENTE para desbloqueo remoto; nunca cambiar de máquina ni repetir el ciclo.

**Pregunta de desambiguación (hazla antes de elegir procedimiento):**
> "Para ayudarte mejor: ¿el lavado ya ha terminado y tienes la ropa dentro, o aún no has podido empezar?"

- Responde "ya terminó / la ropa está dentro" → `OPEN ERROR` → Procedimiento PUERTA BLOQUEADA FIN DE CICLO.
- Responde "aún no / no cierra para empezar" → `OPEN:` → Procedimiento OPEN.

Si el cliente YA ha dejado claro el momento (p. ej. "ya terminó y no abre"), no repitas la pregunta. Solo después de saber el código correcto, cuando proceda escalar, llama a `query_machine_status` con ese código.

## Procedimiento OPEN

> "Abre la puerta con cuidado, revisa si hay alguna prenda atrapada en la goma y vuelve a cerrarla bien hasta que oigas el clic. ¿Ha desaparecido el mensaje?"

- Si dice que sí → "Selecciona de nuevo el programa". Cierre amable.
- Si dice que no → "Inténtalo una vez más con un poco más de firmeza, asegurándote de que no haya nada atrapado."
- Si sigue sin cerrar → suele ser **sobrecarga**: "A veces la puerta no cierra porque hay demasiada ropa. Saca algunas prendas y reparte bien la carga dentro del tambor, luego cierra la puerta. ¿Se ha cerrado?" Si cierra → "Selecciona de nuevo el programa". Cierre amable. (Esto aplica solo a `OPEN:` — puerta que no cierra ANTES de lavar; NUNCA en `OPEN ERROR`, donde el ciclo ya terminó y la ropa está atrapada.)
- Si tras esos intentos (recolocar + reducir carga) sigue → ESCALAR (briefing: lavadora N de <sede> con OPEN persistente, cliente ya ha intentado cerrar y reducir la carga).

## Procedimiento PUERTA BLOQUEADA FIN DE CICLO (`OPEN ERROR`)

Caso DISTINTO de `OPEN:`. Aquí **el ciclo YA terminó** y la puerta no se abre, con la ropa atrapada dentro. NO se trata de reiniciar ni de cambiar de máquina ni de volver a lavar/secar — el ciclo ya terminó, solo hay que liberar la ropa.

> Este procedimiento es **idéntico para lavadora y secadora** (ver `dryer.md`). En la lavadora la ropa atrapada está mojada; en la secadora está seca — el trato es el mismo, no menciones el estado de la ropa salvo que el cliente lo haga.

1. Tranquiliza e indica esperar: cuando el ciclo termina, la puerta tarda unos minutos en desbloquearse por seguridad. Pregunta cuánto hace que terminó.
   > "Tranquila. Al terminar el ciclo la puerta tarda unos minutos en desbloquearse. ¿Cuánto hace que terminó?"
2. Si han pasado **menos de 2-3 minutos** → pedir que espere un poco más y reintente.
3. Si han pasado **más de 2-3 minutos** (o ya esperó) → pedir un intento de apertura firme:
   > "Tira de la manija con firmeza, a veces necesita un poco más de fuerza. ¿Se ha abierto?"
4. Si **se abre** → cierre amable.
5. Si **NO se abre** tras el intento → recoger location + número de máquina (si no se saben) → pedir el **nombre** → ESCALAR **con prioridad URGENTE** para desbloqueo remoto / técnico.
   - Briefing: **🚨 URGENTE** — máquina N de <sede> con `OPEN ERROR`, ciclo terminado, **puerta bloqueada con ropa atrapada dentro**, cliente no puede recuperar su ropa y ya intentó abrir. Solicita desbloqueo remoto inmediato o intervención técnica prioritaria.

**NUNCA** en este caso: ofrecer "cambia a otra máquina y lava/seca sin coste" (la ropa ya está procesada y atrapada), ni reiniciar el ciclo.

## Procedimiento ERR-01 (programa antes del pago)

> "Has pulsado el programa antes de pagar. Vamos a reiniciar:
> 1. Carga la ropa y cierra bien la puerta.
> 2. Ve al tótem de pago, paga y selecciona el número de tu máquina.
> 3. Vuelve a la máquina y pulsa el programa.
> Dime si arranca."

- Si dice que sí → cierre amable.
- Si dice que no → ESCALAR.

## Procedimiento ALARMA TÉCNICA (ALERT / BLOCK)

> "La máquina ha detectado una incidencia y necesita revisión. Por favor, cambia tu ropa a otra lavadora libre y dime cuál has elegido. Vamos a activarla en remoto para que puedas lavar sin coste adicional."

- Esperar a que el cliente diga la nueva máquina → `remember({machine: nueva, machineType: "washer"})`.
- ESCALAR siempre con briefing: lavadora N con ALERT/BLOCK, cliente pasa a máquina M.

## Procedimiento general "no arranca tras pagar"

Cuando el cliente dice "he pagado y no arranca" sin más contexto:
1. Pregunta location si no la sabes.
2. Pregunta número de máquina y tipo (washer).
3. Pregunta qué aparece exactamente en pantalla.
4. Aplica el procedimiento del código.

Si no hay código visible o la pantalla está apagada → ESCALAR (briefing: solicita activación remota).
