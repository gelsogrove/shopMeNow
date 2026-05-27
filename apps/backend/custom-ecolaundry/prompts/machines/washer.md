# Lavadora — códigos de pantalla y procedimientos

Esta información es **común a todas las sedes**. Los códigos exactos que aparecen en la pantalla de la lavadora y cómo responder a cada uno.

## Códigos de pantalla

| Código        | Significado                                              | Acción del bot |
|---------------|----------------------------------------------------------|----------------|
| `SEL`         | La máquina está pendiente de selección                   | Preguntar si el cliente ha completado el pago. Si SÍ → ESCALAR. Si NO → indicar cerrar la puerta y dirigirse a la caja para pagar. |
| `PUSH PROG`   | Hay que pulsar el programa elegido                       | Indicar que pulse firmemente el botón del programa (60° / 40° / 30° / *). |
| `ON`          | Máquina activada correctamente, ciclo en curso           | Confirmar que todo está bien y esperar al final. |
| `T-28` (mins) | Tiempo aproximado restante del ciclo                     | Solo informativo, indicar que es la cuenta atrás. |
| `STOP:`       | La máquina está desaguando                               | Pedir que espere unos segundos hasta `END`. |
| `END:`        | Lavado terminado, puede abrir la puerta                  | Cierre amable: "Puede abrir la puerta". |
| `120`         | Cuenta atrás final del ciclo                             | Indicar que el ciclo está terminando y esperar `END`. |
| `DOOR:`       | La puerta no está bien cerrada                           | Procedimiento DOOR (ver abajo). |
| `ALM DOOR:`   | Posible problema de cierre o prenda atrapada             | Primero tratar como DOOR. Si persiste → ESCALAR + reportar a técnico. |
| `001`         | Selección del programa antes del pago                    | Procedimiento 001 (ver abajo). |
| `ALM`/`ALN`   | Fallo técnico de la máquina                              | Procedimiento ALARMA TÉCNICA (ver abajo). ESCALAR siempre. |

## Procedimiento DOOR

> "Abre la puerta con cuidado, revisa si hay alguna prenda atrapada en la goma y vuelve a cerrarla bien hasta que oigas el clic. ¿Ha desaparecido el mensaje?"

- Si dice que sí → "Selecciona de nuevo el programa". Cierre amable.
- Si dice que no → "Inténtalo una vez más con un poco más de firmeza, asegurándote de que no haya nada atrapado."
- Si tras 2 intentos sigue → ESCALAR (briefing: lavadora N de <sede> con DOOR persistente, cliente ya ha intentado cerrar 2 veces).

## Procedimiento 001 (programa antes del pago)

> "Has pulsado el programa antes de pagar. Vamos a reiniciar:
> 1. Carga la ropa y cierra bien la puerta.
> 2. Ve al tótem de pago, paga y selecciona el número de tu máquina.
> 3. Vuelve a la máquina y pulsa el programa.
> Dime si arranca."

- Si dice que sí → cierre amable.
- Si dice que no → ESCALAR.

## Procedimiento ALARMA TÉCNICA (ALM / ALN)

> "La máquina ha detectado una incidencia y necesita revisión. Por favor, cambia tu ropa a otra lavadora libre y dime cuál has elegido. Vamos a activarla en remoto para que puedas lavar sin coste adicional."

- Esperar a que el cliente diga la nueva máquina → `remember({machine: nueva, machineType: "washer"})`.
- ESCALAR siempre con briefing: lavadora N con ALM/ALN, cliente pasa a máquina M.

## Procedimiento general "no arranca tras pagar"

Cuando el cliente dice "he pagado y no arranca" sin más contexto:
1. Pregunta location si no la sabes.
2. Pregunta número de máquina y tipo (washer).
3. Pregunta qué aparece exactamente en pantalla.
4. Aplica el procedimiento del código.

Si no hay código visible o la pantalla está apagada → ESCALAR (briefing: solicita activación remota).
