## Índex

DemoWash és una xarxa de bugaderies self-service en franquícia amb 6 seus a Catalunya: **Eixample**, **Gràcia**, **Mataró**, **Rubí**, **Sant Cugat** i **Terrassa**.

Cada seu té els seus propis horaris, màquines, programes, preus i mètodes de pagament. El chatbot, abans de donar qualsevol dada operativa, sempre identifica la seu del client. Per als problemes tècnics demana les 4 dades una a una: **seu → tipus → número → pantalla**.

### La màquina té un problema
- [Missatge OPEN a la pantalla (porta no tancada bé)](#missatge-open)
- [Missatge ERR-01 a la pantalla (programa abans del pagament)](#missatge-err-01)
- [Missatge ALERT o BLOCK (avaria tècnica)](#missatge-alert-o-block)
- [La rentadora no arrenca després de pagar (pantalla apagada)](#no-arrenca-després-de-pagar)
- [La porta no es desbloqueja al final del cicle](#porta-no-es-desbloqueja)
- [L'assecadora no escalfa](#assecadora-no-escalfa)

### Pagaments i reembossaments
- [Doble càrrec amb la targeta](#doble-càrrec)
- [He pagat però la màquina no s'ha activat](#pagament-sense-activació)
- [Monedes de l'assecadora no sumen](#monedes-assecadora-no-sumen)
- [La roba ha sortit mal rentada (bruta, mullada, amb mala olor)](#roba-mal-rentada)
- [Vull la factura](#factura)

### Consells de rentat (FAQ universal)
- [A quina temperatura rento una camisa blanca tacada?](#camisa-blanca-tacada)
- [A quina temperatura rento els colors?](#temperatura-colors)
- [Tinc una taca de greix, com la trec?](#taca-de-greix)
- [He de portar el detergent?](#detergent-inclòs)
- [Puc rentar edredons i mantes?](#edredons-i-mantes)
- [Quant dura un rentat?](#durada-del-rentat)

### Dades per seu (franchising)
- [Quins són els horaris?](#horaris)
- [Quant costa rentar?](#preus)
- [Es pot pagar amb targeta?](#mètodes-de-pagament)
- [Quins programes té la rentadora?](#programes)
- [Com funciona la targeta de fidelització?](#targeta-de-fidelització)
- [Quant estalvio amb la targeta?](#estalvi-amb-la-targeta)
- [On és la bugaderia més propera?](#bugaderia-més-propera)

---

## Missatge OPEN

> Problema tècnic — flux seu → tipus → número → pantalla (1 dada per torn).

**Client:** La meva rentadora no arrenca.
**Bot:** Hola! 👋 Sóc l'assistent virtual de **Demowash**. En quina bugaderia ets?

**Client:** Eixample.
**Bot:** Rentadora o assecadora?

**Client:** Rentadora.
**Bot:** Quin número té la màquina?

**Client:** La 3.
**Bot:** Què veus a la pantalla?

**Client:** OPEN.
**Bot:** Obre la porta amb cura, revisa si hi ha alguna peça atrapada a la goma i torna-la a tancar bé fins a sentir el clic. Ha desaparegut el missatge?

**Client:** Sí, ha desaparegut.
**Bot:** Perfecte. Selecciona de nou el programa. Bon rentat! 👋

---

## Missatge ERR-01

**Client:** Sóc a Mataró, rentadora 6 amb ERR-01.
**Bot:** Has premut el programa abans de pagar. Tornem a començar:

1. Carrega la roba i tanca bé la porta.
2. Vés al tòtem de pagament, paga i selecciona el número de la teva màquina.
3. Torna a la màquina i prem el programa.

Digues-me si arrenca.

**Client:** Ara arrenca.
**Bot:** Perfecte! Bon rentat 👋

---

## Missatge ALERT o BLOCK

**Client:** Sant Cugat, rentadora 4, surt ALERT.
**Bot:** La màquina ha detectat una incidència i necessita revisió. Si us plau, canvia la roba a una altra rentadora lliure i digues-me quina has triat. L'activem en remot perquè puguis rentar sense cost addicional.

**Client:** Ara sóc a la rentadora 2.
**Bot:** Gràcies. Com et dius? Passo el cas a un operador per activar-te la 2 i registrar la incidència de la 4.

**Client:** Andrea.
**Bot:** He registrat la incidència, Andrea. Un operador et contactarà en uns minuts.

---

## No arrenca després de pagar

> Cas particular: la pantalla està apagada o no mostra cap codi — el bot escala directament perquè sense codi no hi ha procediment documentat.

**Client:** He pagat però la màquina no arrenca.
**Bot:** En quina bugaderia ets?

**Client:** Rubí.
**Bot:** Rentadora o assecadora?

**Client:** Rentadora.
**Bot:** Quin número té la màquina?

**Client:** La 3.
**Bot:** Què veus a la pantalla?

**Client:** Res, està apagada.
**Bot:** Entesos. Com et dius? Passo el cas a un operador per activar la màquina en remot.

**Client:** Marta.
**Bot:** He registrat la incidència, Marta. Un operador et contactarà en uns minuts.

---

## Porta no es desbloqueja

**Client:** La porta no s'obre, el rentat ja ha acabat.
**Bot:** Tranquil·la. Quan el cicle acaba, la porta tarda uns minuts a desbloquejar-se. Quan fa que ha acabat el rentat?

**Client:** Més de 5 minuts.
**Bot:** En quina bugaderia ets?

**Client:** Gràcia.
**Bot:** Quin número té la rentadora?

**Client:** La 2.
**Bot:** Com et dius? Passo el cas a un operador per desbloquejar la porta en remot.

**Client:** Luis.
**Bot:** He registrat la incidència, Luis. Un operador et contactarà en uns minuts.

---

## Assecadora no escalfa

**Client:** L'assecadora no escalfa, els minuts passen però la roba queda molla.
**Bot:** Em sap greu. En quina bugaderia ets?

**Client:** Terrassa.
**Bot:** Quin número té l'assecadora?

**Client:** La 5.
**Bot:** Com et dius? Passo el cas a un operador per reembossar el cicle i revisar la màquina.

**Client:** Anna.
**Bot:** He registrat la incidència, Anna. Un operador et contactarà en uns minuts.

---

## Doble càrrec

**Client:** M'heu cobrat dues vegades amb la targeta.
**Bot:** Em sap greu. En quina bugaderia ets?

**Client:** Eixample.
**Bot:** Quin número té la màquina?

**Client:** La 1.
**Bot:** Em pots dir els 4 últims dígits de la targeta i el teu nom? Passo el cas a un operador per verificar el doble càrrec.

**Client:** Targeta 8821, sóc el Jordi.
**Bot:** He registrat la incidència, Jordi. Un operador et contactarà en uns minuts.

---

## Pagament sense activació

**Client:** He pagat però la màquina no s'ha activat i vull el reembossament.
**Bot:** Em sap greu. En quina bugaderia ets?

**Client:** Mataró.
**Bot:** Rentadora o assecadora?

**Client:** Rentadora, la 6.
**Bot:** Com has pagat: efectiu, targeta de fidelització o targeta bancària?

**Client:** Targeta bancària, acaba en 4412.
**Bot:** Com et dius?

**Client:** Carla.
**Bot:** He registrat la incidència, Carla. Un operador et contactarà en uns minuts per processar el reembossament.

---

## Monedes assecadora no sumen

**Client:** He posat monedes a l'assecadora però els minuts no augmenten.
**Bot:** Em sap greu. En quina bugaderia ets?

**Client:** Rubí.
**Bot:** Quin número té l'assecadora?

**Client:** La 3.
**Bot:** Com et dius? Passo el cas a un operador per tornar els diners i revisar la màquina.

**Client:** Mireia.
**Bot:** He registrat la incidència, Mireia. Un operador et contactarà en uns minuts.

---

## Roba mal rentada

> El client reporta un resultat de servei defectuós (roba bruta després del cicle, encara mullada després de l'assecat complet, mala olor). El bot tracta el cas com una incidència de qualitat, recull seu + tipus + número de màquina + nom i passa el cas a un operador per valorar el reembossament. El bot **no decideix** el reembossament — això ho gestiona l'operador.

**Client:** La roba ha sortit bruta i fa mala olor després del rentat, vull un reembossament.
**Bot:** Em sap greu. En quina bugaderia ets?

**Client:** Eixample.
**Bot:** Rentadora o assecadora?

**Client:** Rentadora, la 3.
**Bot:** Com et dius?

**Client:** Marta.
**Bot:** He registrat la incidència, Marta. Un operador et contactarà en uns minuts per valorar el cas i el reembossament.

---

## Factura

> El bot demana les dades una a una (regla "una pregunta per torn"): raó social → import → data del servei → email → nota opcional.
>
> 🔒 **Dades sensibles fora del flux LLM**: raó social, CIF/NIF, adreça, email i altres dades personals NO s'envien al model d'IA (OpenAI/OpenRouter). El bot recull cada camp i el nostre codi el processa de manera determinista — les respostes d'aquests torns estan **cablejades al codi**, no generades pel LLM. D'aquesta manera les dades PII queden excloses del flux estàndard cap a la IA.

**Client:** Vull la factura del rentat.
**Bot:** Perfecte! Et preparo la factura. Quin és el nom de l'empresa o la raó social?

**Client:** Marta Ribas SL.
**Bot:** Gràcies. Quin és l'import que has pagat? (en euros)

**Client:** 8 €.
**Bot:** Perfecte. Quan vas usar el servei? (ex. avui, ahir, 29/05/2026)

**Client:** Avui.
**Bot:** Entesos. A quin correu et mando la factura?

**Client:** marta@example.com
**Bot:** Gràcies. Vols afegir una nota? (ex. CIF, codi client, referència) Si no, escriu "no".

**Client:** CIF B12345678.
**Bot:** Perfecte. He registrat la factura amb les dades: Marta Ribas SL, 8 €, avui, CIF B12345678. T'arribarà a marta@example.com en pocs minuts.

---

## Camisa blanca tacada

> FAQ universal — no depèn de la seu.

**Client:** Tinc una camisa blanca tacada, a quina temperatura la puc rentar per no malmetre-la?
**Bot:** Per a una camisa blanca amb taques:
- **Cotó resistent**: **40°C** (fins a 60°C si la taca és molt persistent)
- **Teixits delicats** (seda, llana, mescles fines): **30°C**

Per sobre dels 40°C en teixits delicats arrisques a fixar la taca. Selecciona el programa corresponent a la pantalla de la màquina — el detergent es dosifica automàticament.

---

## Temperatura colors

**Client:** A quina temperatura rento els colors?
**Bot:** Regla general per als colors:
- **Colors foscos / negres**: **30°C** (evita la pèrdua de color)
- **Colors clars**: **30-40°C**
- **Colors resistents amb taques**: fins a **40°C**

Mai rentis els colors per sobre dels 40°C la primera vegada: el color desprèn més quan és nou.

---

## Taca de greix

**Client:** Tinc una taca de greix a una camisa, com la trec?
**Bot:** Primer absorbeix l'excés amb paper de cuina sense fregar (fregar estén la taca). Després selecciona:
- **Cotó**: **60°C**
- **Sintètics o delicats**: **40°C**

El detergent Demowash inclou un component desgreixant que es dosifica automàticament.

---

## Detergent inclòs

**Client:** He de portar detergent?
**Bot:** No, no cal portar res! Les màquines Demowash **dosifiquen automàticament** detergent i suavitzant ecològics certificats, fets amb ingredients 100% naturals. Només has de portar la roba. 😊

---

## Edredons i mantes

**Client:** Puc rentar edredons i mantes?
**Bot:** Sí, pots! Aquests són els consells:

**Edredons i mantes de cotó o polièster resistent:**
- **Temperatura**: **40°C**
- **Capacitat**: utilitza una rentadora de **20 kg** per a edredons grans
- **Després del rentat**: assecadora a temperatura **alta o mitjana** per eliminar bé la humitat

**Edredons delicats o amb farciment sintètic:**
- **Temperatura**: **30°C**

**Consells**:
- No sobrecarreguis la màquina — l'edredó necessita espai per moure's bé
- Després del rentat l'edredó surt molt mullat: passa'l per l'**assecadora** per acabar

Si vols saber quines màquines grans hi ha i els preus exactes, digues-me en quina bugaderia ets. 😊

---

## Durada del rentat

**Client:** Quant dura un rentat?
**Bot:** La durada depèn del **programa** que triïs:

- **60°C** (molt calent): **50-55 minuts**
- **40°C** (calent): **45-50 minuts**
- **30°C** (tebi): **40-45 minuts**
- **Fred** (*): **35-40 minuts**

Són temps aproximats. Durant el cicle veuràs a la pantalla el compte enrere del temps restant (ex. `T-28` vol dir 28 minuts). 😊

---

## Horaris

> FAQ per seu — el bot demana només la seu.

**Client:** Quins són els horaris?
**Bot:** En quina bugaderia ets?

**Client:** Gràcia.
**Bot:** A **Gràcia** estem oberts de **7:00 a 23:00**, tots els dies.

---

## Preus

**Client:** Quant costa rentar?
**Bot:** En quina bugaderia ets?

**Client:** Eixample.
**Bot:** A **Eixample** aquests són els preus de rentadora:

| Núm. | Pes   | Fidelització | Efectiu |
|------|-------|--------------|---------|
| 1    | 20 kg | 7 €          | 8 €     |
| 2    | 20 kg | 7 €          | 8 €     |
| 3    | 10 kg | 4 €          | 4,50 €  |
| 4    | 10 kg | 4 €          | 4,50 €  |

Vols també els preus d'assecadora?

---

## Mètodes de pagament

**Client:** Es pot pagar amb targeta?
**Bot:** En quina bugaderia ets?

**Client:** Gràcia.
**Bot:** A **Gràcia** només s'accepta **targeta de crèdit/dèbit**. No hi ha efectiu ni targeta de fidelització en aquesta seu.

---

## Programes

**Client:** Quins programes té la rentadora?
**Bot:** En quina bugaderia ets?

**Client:** Eixample.
**Bot:** A **Eixample** la rentadora té 4 programes:

| Botó | Programa     | Temperatura |
|------|--------------|-------------|
| 1    | Molt calent  | 60°         |
| 2    | Calent       | 40°         |
| 3    | Tebi         | 30°         |
| 4    | Fred         | *           |

L'assecadora en té 3: alta, mitja i baixa temperatura.

---

## Targeta de fidelització

> El bot confirma si la seu del client accepta la targeta i mostra els preus reduïts. Per a l'activació, recàrrega o consulta del saldo redirigeix a l'equip de la bugaderia — són ells qui gestionen la targeta al local. El bot ho presenta com un servei del local, no com una limitació pròpia.

**Client:** Com funciona la targeta de fidelització?
**Bot:** Amb la targeta de fidelització pagues **menys** que amb efectiu o targeta bancària — el descompte s'aplica automàticament a cada rentat i assecat.

En quina bugaderia ets? Et confirmo si l'acceptem i et passo els preus.

**Client:** Eixample.
**Bot:** A **Eixample** sí, acceptem targeta de fidelització. Aquests són els preus:

| Màquina           | Capacitat | Fidelització |
|-------------------|-----------|--------------|
| Rentadora 1-2     | 20 kg     | 7 €          |
| Rentadora 3-4     | 10 kg     | 4 €          |
| Assecadora 5-6    | 20 kg     | 2,50 €       |

---

## Estalvi amb la targeta

> El bot necessita la seu per mostrar l'estalvi exacte — cada local té preus diferents.

**Client:** Quant estalvio amb la targeta?
**Bot:** Per dir-te l'estalvi exacte, en quina bugaderia ets?

**Client:** Rubí.
**Bot:** A **Rubí** l'estalvi amb la targeta de fidelització és:

**Rentadores**:
- Màquina 1 (10 kg): **0,50 € d'estalvi** (4,50 € amb targeta vs 5 € en efectiu)
- Màquina 2 (15 kg): **1 € d'estalvi** (6 € amb targeta vs 7 € en efectiu)
- Màquina 3 (20 kg): **1 € d'estalvi** (7 € amb targeta vs 8 € en efectiu)

**Assecadores** (màquines 4 i 5, 20 kg): **mateix preu** amb targeta o en efectiu (2 € / 15 min).

💡 Si fas servir la rentadora gran (màquina 3) habitualment, la targeta es paga sola en pocs usos. 😊

---

## Bugaderia més propera

**Client:** On és la bugaderia més propera?
**Bot:** En quina zona ets? Et passo les dades de la seu més còmoda.

**Client:** Sóc a Barcelona.
**Bot:** A Barcelona tenim dues seus Demowash:

1. **Eixample** — C/ Aragó 286, a prop de Passeig de Gràcia. Horari: 8:00 — 22:00
2. **Gràcia** — C/ Verdi 47, a prop de Plaça del Sol. Horari: 7:00 — 23:00

En quina de les dues ets, o quina t'interessa? 😊

---
