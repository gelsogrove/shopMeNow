# 🧺 CANVAS — DEMO LAVANDERIA (KEY POINTS)

## 🎯 OBIETTIVO DEMO

👉 Dimostrare: dato un problema → il sistema prende la decisione giusta

---

## 🧩 CASI DA MOSTRARE

* lavatrice non funziona
* asciugatrice non funziona
* pagato ma non parte
* errori (ALM / 001)
* codici

---

## 🔄 FLOW BASE

1. chiedi locale
2. chiedi macchina (lavatrice / asciugatrice)
3. chiedi numero
4. chiedi cosa è successo
5. chiedi display

❗ NON diagnosticare senza display
❗ UNA domanda alla volta

---

## 📺 STATI DISPLAY

* SEL
* PUSH PROG
* DOOR
* 001
* ALM

---

## 🎯 DECISIONE

* SEL → seleziona programma
* PUSH PROG → premi programma
* DOOR → chiudi porta
* 001 → errore sequenza
* ALM → escalation

---

## 💳 CONTROLLO PAGAMENTO (solo se rilevante)

* ha pagato?
* metodo (cash / carta / codice)
* la central ha restituito il cambio?

👉 serve per capire errori di selezione

---

## 🚨 ESCALATION

👉 quando:

* non risolto
* errore sconosciuto
* dati incoerenti

Messaggio:
"Verifichiamo manualmente"

❗ NON promettere compensazioni
👉 dire: "Verificheremo e ti aiuteremo"

---

## 🔁 LOOP

👉 dopo risposta:

* "Ha funzionato?"
* sì → fine
* no → escalation

---

## 🗣️ STILE BOT

* breve
* tranquillo
* 1 istruzione per volta
* niente spiegazioni lunghe

---

## 🧺 PROGRAMMI (FAQ — NON CORE DEMO)

👉 Serve solo per domande tipo: "che programma uso?"

Lavatrice:

* 60° → molto sporco / bianco
* 40° → quotidiano / colori
* 30° → delicato / sintetici
* freddo → molto delicato

Asciugatrice:

* alta → asciugamani / cotone
* media → coperte / misti
* bassa → delicati / sintetici

❗ NON entra nel flow di troubleshooting
👉 è solo risposta FAQ

---

## ⚠️ CASI REALI IMPORTANTI (DA NON DIMENTICARE)

👉 derivati dal manuale reale

### Lavatrice

* STOP premuto
  → il lavaggio viene annullato
  → serve ripagare per ripartire

* EXTRA attivo (luce fissa)
  → manca credito aggiuntivo
  → o disattivare EXTRA o pagare differenza

* END + bAL
  → carico sbilanciato
  → dividere il carico e rilavare

* ALM (tipi principali)
  → ALM/A (acqua)
  → ALM/E (scarico)
  → ALM/door (porta)
  → ALM/VAr (tecnico)

👉 azione standard:

* premere STOP breve → reset
* se continua → usare altra macchina + escalation

### Asciugatrice

* ropa troppo bagnata (non centrifugata)
  → NON è problema della secadora
  → rifare lavaggio con carico diviso

* ropa ancora umida dopo ciclo
  → troppo carico o mal distribuita
  → stendere meglio + aggiungere tempo

* STOP durante ciclo
  → conferma richiesta
  → può perdere il ciclo

* allarmi secadora
  → filtro sporco (più comune)
  → problemi rotazione / aspirazione

👉 azione standard:

* pulire filtro
* aggiungere tempo
* se persiste → escalation

---

## 🧠 SUCCO DELLA DEMO (LA COSA IMPORTANTE)

👉 Non stai mostrando un chatbot
👉 Stai mostrando un sistema decisionale

Flusso reale:

1. input utente (es: "non parte")
2. raccolta dati guidata (locale, macchina, numero, display)
3. decisione deterministica (FlowEngine)
4. 1 istruzione chiara
5. verifica risultato
6. fallback → escalation

💥 Differenza chiave:

* NON risponde a caso
* NON salta step
* NON inventa

👉 segue sempre:
INPUT → CLASSIFICAZIONE → AZIONE

---

## ⚡ TL;DR

👉 input: locale + macchina + display
👉 output: 1 istruzione
👉 se non funziona → escalation

---

## 🚀 DEMO SETUP

UI → payload → chatbot → FlowEngine

👉 UI serve solo per partire più veloce
👉 il valore è nella decisione
