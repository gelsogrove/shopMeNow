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
| `END:`        | Lavado terminado, puede abrir la puerta                  | Cierre amable, indicándole que ya puede abrir la puerta. |
| `120`         | Cuenta atrás final del ciclo                             | Indicar que el ciclo está terminando y esperar `END`. |
| `OPEN:`       | La puerta no cierra bien ANTES del lavado                | Procedimiento OPEN (ver abajo). |
| `OPEN ERROR`  | El lavado YA TERMINÓ y la puerta NO se abre (ropa atrapada dentro) | Procedimiento PUERTA BLOQUEADA FIN DE CICLO (ver abajo). |
| `ALERT OPEN:`   | Posible problema de cierre o prenda atrapada             | Primero tratar como OPEN. Si persiste → ESCALAR + reportar a técnico. |
| `ERR-01`         | Selección del programa antes del pago                    | Procedimiento ERR-01 (ver abajo). |
| `ALERT`/`BLOCK`   | Fallo técnico de la máquina DURANTE el uso (no arranca / se detiene) | Procedimiento ALARMA TÉCNICA (ver abajo). ESCALAR siempre. **NO** usar este procedimiento si el lavado ya terminó y solo la puerta no abre → ese caso es `OPEN ERROR`. |
| `DOOR` / `OPEN DOOR` | La puerta no cierra bien ANTES del lavado (equivalente a `OPEN:`), **siempre que la puerta se pueda abrir** | Procedimiento OPEN (ver abajo). Si el cliente dice que NO consigue abrir la puerta → es ropa atrapada → `OPEN ERROR` (ver "criterio decisivo" abajo). |

## Puerta: el criterio decisivo es si la puerta SE PUEDE ABRIR

Cuando el cliente dice de forma genérica que **«la puerta no se abre / no funciona»**, lo que decide el procedimiento **NO es el código de pantalla** (el cliente puede leerlo mal, y `OPEN` / `OPEN DOOR` son ambiguos), sino **si consigue abrir la puerta**:

- **La puerta NO se abre** (bloqueada, con la ropa dentro) → la ropa está atrapada → `OPEN ERROR` → **Procedimiento PUERTA BLOQUEADA FIN DE CICLO**. Aplica **pase lo que pase en la pantalla**, incluso si el cliente lee `OPEN` / `OPEN DOOR`: si la puerta no se abre, el Procedimiento OPEN (abrir y volver a cerrar) es imposible.
- **La puerta SÍ se abre pero no cierra / no engancha para arrancar** (la ropa aún NO se ha lavado) → `OPEN:` → **Procedimiento OPEN**.

Si no está claro cuál de los dos es, pregunta directamente: *"¿consigues abrir la puerta, o está bloqueada con la ropa dentro?"*. **No** te bases en "¿ha terminado el lavado?": un lavado "no terminado" con la ropa dentro y la puerta bloqueada es ropa atrapada (`OPEN ERROR`), no una puerta que no cierra para empezar.

Pide el código de pantalla solo como **confirmación secundaria**, nunca como criterio único. Una vez claro el caso, guárdalo con `remember({displayCode})` y aplica el procedimiento; vuelve a pedir el código si tras los intentos el cliente dice que sigue sin funcionar.

## Procedimiento OPEN

Indícale que abra la puerta con cuidado, revise si hay alguna prenda atrapada en la goma y la cierre bien hasta oír el clic; luego pregúntale si el mensaje ha desaparecido.

- Si dice que sí → pídele que seleccione de nuevo el programa. Cierre amable.
- Si dice que no → pídele que lo intente una vez más con un poco más de firmeza, asegurándose de que no haya nada atrapado.
- Si sigue sin cerrar → suele ser **sobrecarga**: explícale que a veces la puerta no cierra por exceso de ropa; pídele que saque algunas prendas, reparta bien la carga dentro del tambor y cierre de nuevo, y pregúntale si se ha cerrado. Si cierra → pídele que seleccione de nuevo el programa. Cierre amable. (Esto aplica solo a `OPEN:` — puerta que no cierra ANTES de lavar; NUNCA en `OPEN ERROR`, donde el ciclo ya terminó y la ropa está atrapada.)
- Si tras esos intentos (recolocar + reducir carga) sigue → ESCALAR (briefing: lavadora N de <sede> con OPEN persistente, cliente ya ha intentado cerrar y reducir la carga).

## Procedimiento PUERTA BLOQUEADA FIN DE CICLO (`OPEN ERROR`)

Caso DISTINTO de `OPEN:`. Aquí **el ciclo YA terminó** y la puerta no se abre, con la ropa atrapada dentro. NO se trata de reiniciar ni de cambiar de máquina ni de volver a lavar/secar — el ciclo ya terminó, solo hay que liberar la ropa.

> Este procedimiento es **idéntico para lavadora y secadora** (ver `dryer.md`). En la lavadora la ropa atrapada está mojada; en la secadora está seca — el trato es el mismo, no menciones el estado de la ropa salvo que el cliente lo haga.

1. Tranquiliza e indica esperar: explícale que, al terminar el ciclo, la puerta tarda unos minutos en desbloquearse por seguridad, y pregúntale cuánto hace que terminó.
2. Si han pasado **menos de 2-3 minutos** → pedir que espere un poco más y reintente.
3. Si han pasado **más de 2-3 minutos** (o ya esperó) → pídele que tire de la manija con firmeza, ya que a veces necesita un poco más de fuerza, y pregúntale si se ha abierto.
4. Si **se abre** → cierre amable.
5. Si **NO se abre** tras el intento → recoger location + número de máquina (si no se saben) → pedir el **nombre** → ESCALAR **con prioridad URGENTE** para desbloqueo remoto / técnico.
   - Briefing: **🚨 URGENTE** — máquina N de <sede> con `OPEN ERROR`, ciclo terminado, **puerta bloqueada con ropa atrapada dentro**, cliente no puede recuperar su ropa y ya intentó abrir. Solicita desbloqueo remoto inmediato o intervención técnica prioritaria.

**NUNCA** en este caso: ofrecer "cambia a otra máquina y lava/seca sin coste" (la ropa ya está procesada y atrapada), ni reiniciar el ciclo.

## Procedimiento ERR-01 (programa antes del pago)

Explícale que ha pulsado el programa antes de pagar y que hay que reiniciar. Guíale por estos pasos:
1. Cargar la ropa y cerrar bien la puerta.
2. Ir al tótem de pago, pagar y seleccionar el número de su máquina.
3. Volver a la máquina y pulsar el programa.
Luego pregúntale si arranca.

- Si dice que sí → cierre amable.
- Si dice que no → ESCALAR.

## Procedimiento ALARMA TÉCNICA (ALERT / BLOCK)

Explícale que la máquina ha detectado una incidencia y necesita revisión; pídele que pase su ropa a otra lavadora libre y te diga cuál ha elegido, e indícale que la activaréis en remoto para que pueda lavar sin coste adicional.

- Esperar a que el cliente diga la nueva máquina → `remember({machine: nueva, machineType: "washer"})`.
- ESCALAR siempre con briefing: lavadora N con ALERT/BLOCK, cliente pasa a máquina M.

## Procedimiento general "no arranca tras pagar"

Cuando el cliente dice "he pagado y no arranca" sin más contexto:
1. Pregunta location si no la sabes.
2. Pregunta número de máquina y tipo (washer).
3. Pregunta qué aparece exactamente en pantalla.
4. Aplica el procedimiento del código.

Si no hay código visible o la pantalla está apagada → ESCALAR (briefing: solicita activación remota).
