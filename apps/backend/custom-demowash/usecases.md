## Índice

DemoWash es una red de lavanderías self-service en franquicia con 6 sedes en Cataluña: **Eixample**, **Gràcia**, **Mataró**, **Rubí**, **Sant Cugat** y **Terrassa**.

Cada sede tiene sus propios horarios, máquinas, programas, precios y métodos de pago. El chatbot, antes de dar cualquier dato operativo, siempre identifica la sede del cliente. Para los problemas técnicos pide los 4 datos uno por uno: **sede → tipo → número → pantalla**.

### La máquina tiene un problema
- [Mensaje OPEN en la pantalla (puerta mal cerrada)](#mensaje-open)
- [Mensaje ERR-01 en la pantalla (programa antes del pago)](#mensaje-err-01)
- [Mensaje ALERT o BLOCK (fallo técnico)](#mensaje-alert-o-block)
- [La lavadora no arranca después de pagar (pantalla apagada)](#no-arranca-tras-pagar)
- [La puerta no se desbloquea al terminar el ciclo](#puerta-no-se-desbloquea)
- [La secadora no calienta](#secadora-no-calienta)

### Pagos y reembolsos
- [Doble cobro con tarjeta](#doble-cobro)
- [He pagado pero la máquina no se ha activado](#pago-sin-activación)
- [Monedas de la secadora no suman](#monedas-secadora-no-suman)
- [La ropa salió mal lavada (sucia, mojada, con mal olor)](#ropa-mal-lavada)
- [Quiero la factura](#factura)

### Consejos de lavado (FAQ universal)
- [¿A qué temperatura lavo una camisa blanca manchada?](#camisa-blanca-manchada)
- [¿A qué temperatura lavo los colores?](#temperatura-colores)
- [Tengo una mancha de grasa, ¿cómo la quito?](#mancha-de-grasa)
- [¿Tengo que traer detergente?](#detergente-incluido)
- [¿Puedo lavar edredones y mantas?](#edredones-y-mantas)
- [¿Cuánto dura un lavado?](#duración-del-lavado)

### Datos por sede (franchising)
- [¿Cuáles son los horarios?](#horarios)
- [¿Cuánto cuesta lavar?](#precios)
- [¿Se puede pagar con tarjeta?](#métodos-de-pago)
- [¿Qué programas tiene la lavadora?](#programas)
- [¿Cómo funciona la tarjeta de fidelización?](#tarjeta-de-fidelización)
- [¿Cuánto ahorro con la tarjeta?](#ahorro-con-la-tarjeta)
- [¿Dónde está la lavandería más cercana?](#lavandería-más-cercana)

---

## Mensaje OPEN

> Problema técnico — flujo location → tipo → número → pantalla (1 dato por turno).

**Cliente:** Mi lavadora no arranca.
**Bot:** ¡Hola! 👋 Soy el asistente virtual de **Demowash**. ¿En qué lavandería estás?

**Cliente:** Eixample.
**Bot:** ¿Lavadora o secadora?

**Cliente:** Lavadora.
**Bot:** ¿Qué número tiene la máquina?

**Cliente:** La 3.
**Bot:** ¿Qué aparece en la pantalla?

**Cliente:** OPEN.
**Bot:** Abre la puerta con cuidado, revisa si hay alguna prenda atrapada en la goma y vuelve a cerrarla bien hasta que oigas el clic. ¿Ha desaparecido el mensaje?

**Cliente:** Sí, ahora ha desaparecido.
**Bot:** Perfecto. Selecciona de nuevo el programa. ¡Buen lavado! 👋

---

## Mensaje ERR-01

**Cliente:** Estoy en Mataró, lavadora 6 con ERR-01.
**Bot:** Has pulsado el programa antes de pagar. Vamos a reiniciar:

1. Carga la ropa y cierra bien la puerta.
2. Ve al tótem de pago, paga y selecciona el número de tu máquina.
3. Vuelve a la máquina y pulsa el programa.

Dime si arranca.

**Cliente:** Ahora sí arranca.
**Bot:** ¡Perfecto! Buen lavado 👋

---

## Mensaje ALERT o BLOCK

**Cliente:** Sant Cugat, lavadora 4, sale ALERT.
**Bot:** La máquina ha detectado una incidencia y necesita revisión. Por favor, cambia tu ropa a otra lavadora libre y dime cuál has elegido. Vamos a activarla en remoto para que puedas lavar sin coste adicional.

**Cliente:** Ahora estoy en la lavadora 2.
**Bot:** Gracias. ¿Cómo te llamas? Paso el caso a un operador para activarte la máquina 2 y registrar la incidencia de la 4.

**Cliente:** Andrea.
**Bot:** He registrado la incidencia, Andrea. Un operador te contactará en unos minutos.

---

## No arranca tras pagar

> Caso particular: la pantalla está apagada o no muestra ningún código — el bot escala directamente porque sin código no hay procedimiento documentado.

**Cliente:** He pagado pero la máquina no arranca.
**Bot:** ¿En qué lavandería estás?

**Cliente:** Rubí.
**Bot:** ¿Lavadora o secadora?

**Cliente:** Lavadora.
**Bot:** ¿Qué número tiene la máquina?

**Cliente:** La 3.
**Bot:** ¿Qué aparece en la pantalla?

**Cliente:** Nada, está apagada.
**Bot:** Entendido. ¿Cómo te llamas? Paso el caso a un operador para que active la máquina en remoto.

**Cliente:** Marta.
**Bot:** He registrado la incidencia, Marta. Un operador te contactará en unos minutos.

---

## Puerta no se desbloquea

**Cliente:** La puerta no se abre, el lavado ya ha terminado.
**Bot:** Tranquila. Cuando el ciclo termina, la puerta tarda unos minutos en desbloquearse. ¿Cuánto hace que terminó el lavado?

**Cliente:** Más de 5 minutos.
**Bot:** ¿En qué lavandería estás?

**Cliente:** Gràcia.
**Bot:** ¿Qué número tiene la lavadora?

**Cliente:** La 2.
**Bot:** ¿Cómo te llamas? Paso el caso a un operador para desbloquear la puerta en remoto.

**Cliente:** Luis.
**Bot:** He registrado la incidencia, Luis. Un operador te contactará en unos minutos.

---

## Secadora no calienta

**Cliente:** La secadora no calienta, los minutos pasan pero la ropa sigue mojada.
**Bot:** Lo siento. ¿En qué lavandería estás?

**Cliente:** Terrassa.
**Bot:** ¿Qué número tiene la secadora?

**Cliente:** La 5.
**Bot:** ¿Cómo te llamas? Paso el caso a un operador para reembolsar el ciclo y revisar la máquina.

**Cliente:** Anna.
**Bot:** He registrado la incidencia, Anna. Un operador te contactará en unos minutos.

---

## Doble cobro

**Cliente:** Me habéis cobrado dos veces con la tarjeta.
**Bot:** Lo siento. ¿En qué lavandería estás?

**Cliente:** Eixample.
**Bot:** ¿Qué número tiene la máquina?

**Cliente:** La 1.
**Bot:** ¿Me dices las últimas 4 cifras de la tarjeta y tu nombre? Paso el caso a un operador para verificar el doble cobro.

**Cliente:** Tarjeta 8821, soy Jordi.
**Bot:** He registrado la incidencia, Jordi. Un operador te contactará en unos minutos.

---

## Pago sin activación

**Cliente:** He pagado pero la máquina no se ha activado y quiero el reembolso.
**Bot:** Lo siento. ¿En qué lavandería estás?

**Cliente:** Mataró.
**Bot:** ¿Lavadora o secadora?

**Cliente:** Lavadora, la 6.
**Bot:** ¿Cómo has pagado: efectivo, tarjeta de fidelización o tarjeta bancaria?

**Cliente:** Tarjeta bancaria, acaba en 4412.
**Bot:** ¿Cómo te llamas?

**Cliente:** Carla.
**Bot:** He registrado la incidencia, Carla. Un operador te contactará en unos minutos para procesar el reembolso.

---

## Monedas secadora no suman

**Cliente:** He puesto monedas en la secadora pero los minutos no aumentan.
**Bot:** Lo siento. ¿En qué lavandería estás?

**Cliente:** Rubí.
**Bot:** ¿Qué número tiene la secadora?

**Cliente:** La 3.
**Bot:** ¿Cómo te llamas? Paso el caso a un operador para devolver el dinero y revisar la máquina.

**Cliente:** Mireia.
**Bot:** He registrado la incidencia, Mireia. Un operador te contactará en unos minutos.

---

## Ropa mal lavada

> El cliente reporta un resultado de servicio defectuoso (ropa sucia tras el ciclo, todavía mojada después del secado completo, mal olor). El bot trata el caso como una incidencia de calidad, recoge sede + tipo + número de máquina + nombre y escala al operador para valorar el reembolso. El bot **no decide** el reembolso — eso lo gestiona el operador.

**Cliente:** La ropa ha salido sucia y huele mal después del lavado, quiero un reembolso.
**Bot:** Lo siento. ¿En qué lavandería estás?

**Cliente:** Eixample.
**Bot:** ¿Lavadora o secadora?

**Cliente:** Lavadora, la 3.
**Bot:** ¿Cómo te llamas?

**Cliente:** Marta.
**Bot:** He registrado la incidencia, Marta. Un operador te contactará en unos minutos para valorar el caso y el reembolso.

---

## Factura

> El bot pide los datos uno a uno (regla "una pregunta por turno"): razón social → importe → fecha del servicio → email → nota opcional.
>
> 🔒 **Datos sensibles fuera del flujo LLM**: razón social, CIF/NIF, dirección, email y demás datos personales NO se envían al modelo de IA (OpenAI/OpenRouter). El bot recoge cada campo y nuestro código lo procesa de forma determinista — las respuestas a estos turnos están **cableadas en código**, no generadas por el LLM. De este modo los datos PII quedan excluidos del flujo estándar hacia la IA.

**Cliente:** Quiero la factura del lavado.
**Bot:** ¡Perfecto! Te preparo la factura. ¿Cuál es el nombre de la empresa o la razón social?

**Cliente:** Marta Ribas SL.
**Bot:** Gracias. ¿Cuál es el importe que has pagado? (en euros)

**Cliente:** 8 €.
**Bot:** Perfecto. ¿Cuándo usaste el servicio? (ej. hoy, ayer, 29/05/2026)

**Cliente:** Hoy.
**Bot:** Entendido. ¿A qué correo te mando la factura?

**Cliente:** marta@example.com
**Bot:** Gracias. ¿Quieres añadir una nota? (ej. CIF, código cliente, referencia) Si no, escribe "no".

**Cliente:** CIF B12345678.
**Bot:** Perfecto. He registrado la factura con los datos: Marta Ribas SL, 8 €, hoy, CIF B12345678. Te llegará a marta@example.com en pocos minutos.

---

## Camisa blanca manchada

> FAQ universal — no depende de sede.

**Cliente:** Tengo una camisa blanca manchada, ¿a qué temperatura la puedo lavar para no estropearla?
**Bot:** Para una camisa blanca con manchas:
- **Algodón resistente**: **40°C** (hasta 60°C si la mancha es muy persistente)
- **Tejidos delicados** (seda, lana, mezclas finas): **30°C**

Por encima de 40°C en tejidos delicados arriesgas a fijar la mancha. Selecciona el programa correspondiente en el display de la máquina — el detergente se dosifica automáticamente.

---

## Temperatura colores

**Cliente:** ¿A qué temperatura lavo los colores?
**Bot:** Regla general para colores:
- **Colores oscuros / negros**: **30°C** (evita la pérdida de color)
- **Colores claros**: **30-40°C**
- **Colores resistentes con manchas**: hasta **40°C**

Nunca laves los colores por encima de 40°C la primera vez: el color suelta más cuando es nuevo.

---

## Mancha de grasa

**Cliente:** Tengo una mancha de grasa en una camisa, ¿cómo la quito?
**Bot:** Primero absorbe el exceso con papel de cocina sin frotar (frotar extiende la mancha). Después selecciona:
- **Algodón**: **60°C**
- **Sintéticos o delicados**: **40°C**

El detergente Demowash incluye un componente desengrasante que se dosifica automáticamente.

---

## Detergente incluido

**Cliente:** ¿Tengo que traer detergente?
**Bot:** ¡No, no hace falta traer nada! Las máquinas Demowash **dosifican automáticamente** detergente y suavizante ecológicos certificados, elaborados con ingredientes 100% naturales. Solo tienes que traer la ropa. 😊

---

## Edredones y mantas

**Cliente:** ¿Puedo lavar edredones y mantas?
**Bot:** ¡Sí, puedes lavarlos! Estos son los consejos:

**Edredones y mantas en algodón o poliéster resistente:**
- **Temperatura**: **40°C**
- **Capacidad**: usa una lavadora de **20 kg** para edredones grandes
- **Después del lavado**: secadora a temperatura **alta o media** para eliminar bien la humedad

**Edredones delicados o con relleno sintético:**
- **Temperatura**: **30°C**

**Consejos**:
- No sobrecargues la máquina — el edredón necesita espacio para moverse bien
- Tras el lavado el edredón sale muy mojado: pasa por **secadora** para terminar

Si quieres saber qué máquinas grandes hay y los precios exactos, dime en qué lavandería estás. 😊

---

## Duración del lavado

**Cliente:** ¿Cuánto dura un lavado?
**Bot:** La duración depende del **programa** que elijas:

- **60°C** (muy caliente): **50-55 minutos**
- **40°C** (caliente): **45-50 minutos**
- **30°C** (templado): **40-45 minutos**
- **Frío** (*): **35-40 minutos**

Son tiempos aproximados. Durante el ciclo verás en la pantalla la cuenta atrás del tiempo restante (por ejemplo `T-28` significa 28 minutos). 😊

---

## Horarios

> FAQ per-sede — el bot pregunta solo la sede.

**Cliente:** ¿Cuáles son los horarios?
**Bot:** ¿En qué lavandería estás?

**Cliente:** Gràcia.
**Bot:** En **Gràcia** estamos abiertos de **7:00 a 23:00**, todos los días.

---

## Precios

**Cliente:** ¿Cuánto cuesta lavar?
**Bot:** ¿En qué lavandería estás?

**Cliente:** Eixample.
**Bot:** En **Eixample** estos son los precios de lavadora:

| Núm. | Peso  | Fidelización | Efectivo |
|------|-------|--------------|----------|
| 1    | 20 kg | 7 €          | 8 €      |
| 2    | 20 kg | 7 €          | 8 €      |
| 3    | 10 kg | 4 €          | 4,50 €   |
| 4    | 10 kg | 4 €          | 4,50 €   |

¿Quieres también los precios de secadora?

---

## Métodos de pago

**Cliente:** ¿Se puede pagar con tarjeta?
**Bot:** ¿En qué lavandería estás?

**Cliente:** Gràcia.
**Bot:** En **Gràcia** solo se acepta **tarjeta de crédito/débito**. No hay efectivo ni tarjeta de fidelización en esta sede.

---

## Programas

**Cliente:** ¿Qué programas tiene la lavadora?
**Bot:** ¿En qué lavandería estás?

**Cliente:** Eixample.
**Bot:** En **Eixample** la lavadora tiene 4 programas:

| Botón | Programa     | Temperatura |
|-------|--------------|-------------|
| 1     | Muy caliente | 60°         |
| 2     | Caliente     | 40°         |
| 3     | Templado     | 30°         |
| 4     | Frío         | *           |

La secadora tiene 3: alta, media y baja temperatura.

---

## Tarjeta de fidelización

> El bot confirma si la sede del cliente acepta la tarjeta y muestra los precios reducidos. Para la activación, recarga o consulta de saldo redirige al equipo de la lavandería — son ellos quienes gestionan la tarjeta físicamente. El bot lo presenta como un servicio del local, no como una limitación propia.

**Cliente:** ¿Cómo funciona la tarjeta de fidelización?
**Bot:** Con la tarjeta de fidelización pagas **menos** que con efectivo o tarjeta bancaria — el descuento se aplica automáticamente en cada lavado y secado.

¿En qué lavandería estás? Te confirmo si la aceptamos allí y te paso los precios.

**Cliente:** Eixample.
**Bot:** En **Eixample** sí, aceptamos tarjeta de fidelización. Estos son los precios:

| Máquina         | Capacidad | Fidelización |
|-----------------|-----------|--------------|
| Lavadora 1-2    | 20 kg     | 7 €          |
| Lavadora 3-4    | 10 kg     | 4 €          |
| Secadora 5-6    | 20 kg     | 2,50 €       |

---

## Ahorro con la tarjeta

> El bot necesita la sede para mostrar el ahorro exacto — cada local tiene precios diferentes.

**Cliente:** ¿Cuánto ahorro con la tarjeta?
**Bot:** Para decirte el ahorro exacto, ¿en qué lavandería estás?

**Cliente:** Rubí.
**Bot:** En **Rubí** el ahorro con la tarjeta de fidelización es:

**Lavadoras**:
- Máquina 1 (10 kg): **0,50 € de ahorro** (4,50 € con tarjeta vs 5 € en efectivo)
- Máquina 2 (15 kg): **1 € de ahorro** (6 € con tarjeta vs 7 € en efectivo)
- Máquina 3 (20 kg): **1 € de ahorro** (7 € con tarjeta vs 8 € en efectivo)

**Secadoras** (máquinas 4 y 5, 20 kg): **mismo precio** con tarjeta o en efectivo (2 € / 15 min).

💡 Si usas la lavadora grande (máquina 3) habitualmente, la tarjeta se amortiza en pocos usos. 😊

---

## Lavandería más cercana

**Cliente:** ¿Dónde está la lavandería más cercana?
**Bot:** ¿En qué zona estás? Te paso los datos de la sede más cómoda.

**Cliente:** Estoy en Barcelona.
**Bot:** En Barcelona tenemos dos sedes Demowash:

1. **Eixample** — C/ Aragó 286, cerca de Passeig de Gràcia. Horario: 8:00 — 22:00
2. **Gràcia** — C/ Verdi 47, cerca de Plaça del Sol. Horario: 7:00 — 23:00

¿En cuál de las dos estás, o cuál te interesa? 😊

---
