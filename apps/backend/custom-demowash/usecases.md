### La máquina tiene un problema

- [La lavadora no arranca](#la-lavadora-no-arranca)
- [La lavadora muestra ERR-01](#la-lavadora-muestra-err-01)
- [La lavadora muestra ALERT o BLOCK](#la-lavadora-muestra-alert-o-block)
- [He pagado pero la máquina no arranca](#he-pagado-pero-la-máquina-no-arranca)
- [La puerta no se abre, el lavado ya terminó](#la-puerta-no-se-abre-el-lavado-ya-terminó)
- [La secadora no calienta](#la-secadora-no-calienta)

### Pagos y reembolsos

- [Me habéis cobrado dos veces con la tarjeta](#me-habéis-cobrado-dos-veces-con-la-tarjeta)
- [He pagado pero la máquina no se ha activado, quiero el reembolso](#he-pagado-pero-la-máquina-no-se-ha-activado-quiero-el-reembolso)
- [He puesto monedas en la secadora pero no añade minutos](#he-puesto-monedas-en-la-secadora-pero-no-añade-minutos)
- [La ropa ha salido sucia y huele mal, quiero un reembolso](#la-ropa-ha-salido-sucia-y-huele-mal-quiero-un-reembolso)
- [Quiero la factura del lavado](#quiero-la-factura-del-lavado)

### Consejos de lavado

- [Tengo una camisa blanca manchada, ¿a qué temperatura la puedo lavar?](#tengo-una-camisa-blanca-manchada-a-qué-temperatura-la-puedo-lavar)
- [¿A qué temperatura lavo los colores?](#a-qué-temperatura-lavo-los-colores)
- [Tengo una mancha de grasa, ¿cómo la quito?](#tengo-una-mancha-de-grasa-cómo-la-quito)
- [¿Tengo que traer detergente?](#tengo-que-traer-detergente)
- [¿Puedo lavar edredones y mantas?](#puedo-lavar-edredones-y-mantas)
- [¿Cuánto dura un lavado?](#cuánto-dura-un-lavado)

### Datos por sede

- [¿Cuáles son los horarios?](#cuáles-son-los-horarios)
- [¿Cuánto cuesta lavar?](#cuánto-cuesta-lavar)
- [¿Se puede pagar con tarjeta?](#se-puede-pagar-con-tarjeta)
- [¿Qué programas tiene la lavadora?](#qué-programas-tiene-la-lavadora)
- [¿Cómo funciona la tarjeta de fidelización?](#cómo-funciona-la-tarjeta-de-fidelización)
- [¿Cuánto ahorro con la tarjeta?](#cuánto-ahorro-con-la-tarjeta)
- [¿Dónde está la lavandería más cercana?](#dónde-está-la-lavandería-más-cercana)

---

## La lavadora no arranca

> Pantalla `OPEN` (la puerta no cierra ANTES de lavar). Si tras recolocar la ropa el mensaje persiste, suele ser **sobrecarga**: sugerir sacar algunas prendas y repartir la carga antes de escalar. (Esto NO aplica a `OPEN ERROR`, donde el ciclo ya terminó.)

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

## La lavadora muestra ERR-01

**Cliente:** Estoy en Mataró, lavadora 6 con ERR-01.

**Bot:** Has pulsado el programa antes de pagar. Vamos a reiniciar:

1. Carga la ropa y cierra bien la puerta.
2. Ve al tótem de pago, paga y selecciona el número de tu máquina.
3. Vuelve a la máquina y pulsa el programa.

Dime si arranca.

**Cliente:** Ahora sí arranca.

**Bot:** ¡Perfecto! Buen lavado 👋

---

## La lavadora muestra ALERT o BLOCK

**Cliente:** Sant Cugat, lavadora 4, sale ALERT.

**Bot:** La máquina ha detectado una incidencia y necesita revisión. Por favor, cambia tu ropa a otra lavadora libre y dime cuál has elegido. Vamos a activarla en remoto para que puedas lavar sin coste adicional.

**Cliente:** Ahora estoy en la lavadora 2.

**Bot:** Gracias. ¿Cómo te llamas? Paso el caso a un operador para activarte la máquina 2 y registrar la incidencia de la 4.

**Cliente:** Andrea.

**Bot:** He registrado la incidencia, Andrea. Un operador te contactará en unos minutos. El chatbot queda en espera del soporte humano.

---

## He pagado pero la máquina no arranca

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

**Bot:** He registrado la incidencia, Marta. Un operador te contactará en unos minutos. El chatbot queda en espera del soporte humano.

---

## La puerta no se abre, el lavado ya terminó

> Pantalla típica: `OPEN ERROR`. Distinto de `OPEN:` (puerta que no cierra ANTES del lavado). Aquí la ropa ya está lavada y atrapada dentro: nunca se ofrece cambiar de máquina ni volver a lavar.
>
> 🚨 Desambiguación: si el cliente solo dice «no se abre» sin precisar, PREGUNTA primero si el ciclo ya terminó con la ropa dentro: sí → `OPEN ERROR`; aún no / no cierra para empezar → `OPEN:`.

**Cliente:** La puerta no se abre, el lavado ya ha terminado.

**Bot:** Tranquila. Cuando el ciclo termina, la puerta tarda unos minutos en desbloquearse. ¿Cuánto hace que terminó el lavado?

**Cliente:** Más de 5 minutos.

**Bot:** Tira de la manija con firmeza, a veces necesita un poco más de fuerza. ¿Se ha abierto?

**Cliente:** No, sigue bloqueada.

**Bot:** ¿En qué lavandería estás?

**Cliente:** Gràcia.

**Bot:** ¿Qué número tiene la lavadora?

**Cliente:** La 2.

**Bot:** ¿Cómo te llamas? Paso el caso a un operador para desbloquear la puerta en remoto.

**Cliente:** Luis.

**Bot:** He registrado la incidencia, Luis. Un operador te contactará en unos minutos. El chatbot queda en espera del soporte humano.

---

## La secadora no calienta

**Cliente:** La secadora no calienta, los minutos pasan pero la ropa sigue mojada.

**Bot:** Lo siento. ¿En qué lavandería estás?

**Cliente:** Terrassa.

**Bot:** ¿Qué número tiene la secadora?

**Cliente:** La 5.

**Bot:** ¿Cómo te llamas? Paso el caso a un operador para reembolsar el ciclo y revisar la máquina.

**Cliente:** Anna.

**Bot:** He registrado la incidencia, Anna. Un operador te contactará en unos minutos. El chatbot queda en espera del soporte humano.

---

## Me habéis cobrado dos veces con la tarjeta

**Cliente:** Me habéis cobrado dos veces con la tarjeta.

**Bot:** Lo siento. ¿En qué lavandería estás?

**Cliente:** Eixample.

**Bot:** ¿Qué número tiene la máquina?

**Cliente:** La 1.

**Bot:** ¿Me dices las últimas 4 cifras de la tarjeta y tu nombre? Paso el caso a un operador para verificar el doble cobro.

**Cliente:** Tarjeta 8821, soy Jordi.

**Bot:** He registrado la incidencia, Jordi. Un operador te contactará en unos minutos. El chatbot queda en espera del soporte humano.

---

## He pagado pero la máquina no se ha activado, quiero el reembolso

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

## He puesto monedas en la secadora pero no añade minutos

**Cliente:** He puesto monedas en la secadora pero los minutos no aumentan.

**Bot:** Lo siento. ¿En qué lavandería estás?

**Cliente:** Rubí.

**Bot:** ¿Qué número tiene la secadora?

**Cliente:** La 3.

**Bot:** ¿Cómo te llamas? Paso el caso a un operador para devolverte el dinero y revisar la máquina.

**Cliente:** Mireia.

**Bot:** He registrado la incidencia, Mireia. Un operador te contactará en unos minutos. El chatbot queda en espera del soporte humano.

---

## La ropa ha salido sucia y huele mal, quiero un reembolso

**Cliente:** La ropa ha salido sucia y huele mal después del lavado, quiero un reembolso.

**Bot:** Lo siento. ¿En qué lavandería estás?

**Cliente:** Eixample.

**Bot:** ¿Lavadora o secadora?

**Cliente:** Lavadora, la 3.

**Bot:** ¿Cómo te llamas?

**Cliente:** Marta.

**Bot:** He registrado la incidencia, Marta. Un operador te contactará en unos minutos para valorar el caso y el reembolso.

---

## Quiero la factura del lavado

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

## Tengo una camisa blanca manchada, ¿a qué temperatura la puedo lavar?

**Cliente:** Tengo una camisa blanca manchada, ¿a qué temperatura la puedo lavar para no estropearla?

**Bot:** Para una camisa blanca con manchas:

- **Algodón resistente**: 40°C (hasta 60°C si la mancha es muy persistente)
- **Tejidos delicados** (seda, lana, mezclas finas): 30°C

Por encima de 40°C en tejidos delicados arriesgas a fijar la mancha. Selecciona el programa correspondiente en el display de la máquina — el detergente se dosifica automáticamente.

---

## ¿A qué temperatura lavo los colores?

**Cliente:** ¿A qué temperatura lavo los colores?

**Bot:** Regla general para colores:

- **Colores oscuros / negros**: 30°C (evita la pérdida de color)
- **Colores claros**: 30-40°C
- **Colores resistentes con manchas**: hasta 40°C

Nunca laves los colores por encima de 40°C la primera vez: el color suelta más cuando es nuevo.

---

## Tengo una mancha de grasa, ¿cómo la quito?

**Cliente:** Tengo una mancha de grasa en una camisa, ¿cómo la quito?

**Bot:** Primero absorbe el exceso con papel de cocina sin frotar (frotar extiende la mancha). Después selecciona:

- **Algodón**: 60°C
- **Sintéticos o delicados**: 40°C

El detergente Demowash incluye un componente desengrasante que se dosifica automáticamente.

---

## ¿Tengo que traer detergente?

**Cliente:** ¿Tengo que traer detergente?

**Bot:** ¡No, no hace falta traer nada! Las máquinas Demowash **dosifican automáticamente** detergente y suavizante ecológicos certificados, elaborados con ingredientes 100% naturales. Solo tienes que traer la ropa. 😊

---

## ¿Puedo lavar edredones y mantas?

**Cliente:** ¿Puedo lavar edredones y mantas?

**Bot:** ¡Sí, puedes lavarlos! Estos son los consejos:

Edredones y mantas en algodón o poliéster resistente:

- Temperatura: 40°C
- Capacidad: usa una lavadora de 20 kg para edredones grandes
- Después del lavado: secadora a temperatura alta o media para eliminar bien la humedad

Edredones delicados o con relleno sintético:

- Temperatura: 30°C

Consejos:

- No sobrecargues la máquina — el edredón necesita espacio para moverse bien
- Tras el lavado el edredón sale muy mojado: pasa por secadora para terminar

Si quieres saber qué máquinas grandes hay y los precios exactos, dime en qué lavandería estás. 😊

---

## ¿Cuánto dura un lavado?

**Cliente:** ¿Cuánto dura un lavado?

**Bot:** La duración depende del programa que elijas:

- 60°C (muy caliente): 50-55 minutos
- 40°C (caliente): 45-50 minutos
- 30°C (templado): 40-45 minutos
- Frío (*): 35-40 minutos

Son tiempos aproximados. Durante el ciclo verás en la pantalla la cuenta atrás del tiempo restante (por ejemplo `T-28` significa 28 minutos). 😊

---

## ¿Cuáles son los horarios?

**Cliente:** ¿Cuáles son los horarios?

**Bot:** ¿En qué lavandería estás?

**Cliente:** Gràcia.

**Bot:** En **Gràcia** estamos abiertos de **7:00 a 23:00**, todos los días.

---

## ¿Cuánto cuesta lavar?

**Cliente:** ¿Cuánto cuesta lavar?

**Bot:** ¿En qué lavandería estás?

**Cliente:** Eixample.

**Bot:** En **Eixample** estos son los precios de lavadora:

- Máquina 1 (20 kg): 7 € con fidelización / 8 € en efectivo
- Máquina 2 (20 kg): 7 € con fidelización / 8 € en efectivo
- Máquina 3 (10 kg): 4 € con fidelización / 4,50 € en efectivo
- Máquina 4 (10 kg): 4 € con fidelización / 4,50 € en efectivo

¿Quieres también los precios de secadora?

---

## ¿Se puede pagar con tarjeta?

**Cliente:** ¿Se puede pagar con tarjeta?

**Bot:** ¿En qué lavandería estás?

**Cliente:** Gràcia.

**Bot:** En **Gràcia** solo se acepta **tarjeta de crédito/débito**. No hay efectivo ni tarjeta de fidelización en esta sede.

---

## ¿Qué programas tiene la lavadora?

**Cliente:** ¿Qué programas tiene la lavadora?

**Bot:** ¿En qué lavandería estás?

**Cliente:** Eixample.

**Bot:** En **Eixample** la lavadora tiene 4 programas:

- Botón 1 — Muy caliente — 60°C
- Botón 2 — Caliente — 40°C
- Botón 3 — Templado — 30°C
- Botón 4 — Frío — (*)

La secadora tiene 3: alta, media y baja temperatura.

---

## ¿Cómo funciona la tarjeta de fidelización?

**Cliente:** ¿Cómo funciona la tarjeta de fidelización?

**Bot:** Con la tarjeta de fidelización pagas **menos** que con efectivo o tarjeta bancaria — el descuento se aplica automáticamente en cada lavado y secado.

¿En qué lavandería estás? Te confirmo si la aceptamos allí y te paso los precios.

**Cliente:** Eixample.

**Bot:** En **Eixample** sí, aceptamos tarjeta de fidelización. Estos son los precios:

- Lavadora 1-2 (20 kg): 7 €
- Lavadora 3-4 (10 kg): 4 €
- Secadora 5-6 (20 kg): 2,50 €

---

## ¿Cuánto ahorro con la tarjeta?

**Cliente:** ¿Cuánto ahorro con la tarjeta?

**Bot:** Para decirte el ahorro exacto, ¿en qué lavandería estás?

**Cliente:** Rubí.

**Bot:** En **Rubí** el ahorro con la tarjeta de fidelización es:

Lavadoras:

- Máquina 1 (10 kg): 0,50 € de ahorro (4,50 € con tarjeta vs 5 € en efectivo)
- Máquina 2 (15 kg): 1 € de ahorro (6 € con tarjeta vs 7 € en efectivo)
- Máquina 3 (20 kg): 1 € de ahorro (7 € con tarjeta vs 8 € en efectivo)

Secadoras (máquinas 4 y 5, 20 kg): mismo precio con tarjeta o en efectivo (2 € / 15 min).

💡 Si usas la lavadora grande (máquina 3) habitualmente, la tarjeta se amortiza en pocos usos. 😊

---

## ¿Dónde está la lavandería más cercana?

**Cliente:** ¿Dónde está la lavandería más cercana?

**Bot:** ¿En qué zona estás? Te paso los datos de la sede más cómoda.

**Cliente:** Estoy en Barcelona.

**Bot:** En Barcelona tenemos dos sedes Demowash:

1. **Eixample** — C/ Aragó 286, cerca de Passeig de Gràcia. Horario: 8:00 — 22:00
2. **Gràcia** — C/ Verdi 47, cerca de Plaça del Sol. Horario: 7:00 — 23:00

¿En cuál de las dos estás, o cuál te interesa? 😊

---
