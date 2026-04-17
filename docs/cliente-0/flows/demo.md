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
“Verifichiamo manualmente”

❗ NON promettere compensazioni
👉 dire: “Verificheremo e ti aiuteremo”

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

* macchina occupata (caso reale)
  → ciclo finito ma qualcuno non ha ritirato
  → azione:
  → togli la roba e mettila su un tavolo

👉 azione standard:

* pulire filtro
* aggiungere tempo
* se persiste → escalation

❗ NOTA DEMO
👉 risposta corta:
"Togli la roba e usa la macchina"
👉 niente spiegazioni lunghe

* danni ai capi (plastica, bruciato, macchie)
  → NON troubleshooting macchina
  → NON risolvere tecnicamente
  → risposta:
  "Mi dispiace, verifichiamo manualmente"

👉 sempre escalation
👉 niente spiegazioni su responsabilità nella demo

---

## 🧠 SUCCO DELLA DEMO (LA COSA IMPORTANTE) (LA COSA IMPORTANTE)

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

---

## 🧠 FLOWENGINE JSON (STRUTTURA REALE)

👉 SÌ: il cuore è un JSON
👉 il codice legge il JSON
👉 l’LLM NON decide i passaggi

---

### 🧺 Lavatrice (Flow JSON)

```json
{
  "flowId": "lavatrice_non_parte",
  "start": "step_display",
  "nodes": {
    "step_display": {
      "type": "QUESTION",
      "prompt": "Cosa vedi sul display? (SEL / PUSH PROG / DOOR / 001 / ALM)",
      "field": "display",
      "transitions": {
        "SEL": "sel",
        "PUSH PROG": "push",
        "DOOR": "door",
        "001": "errore",
        "ALM": "alarm"
      }
    },

    "sel": {
      "type": "ACTION",
      "response": "Seleziona il programma e riprova.",
      "next": "check"
    },

    "push": {
      "type": "ACTION",
      "response": "Premi il programma che vuoi.",
      "next": "check"
    },

    "door": {
      "type": "ACTION",
      "response": "Apri e chiudi bene la porta.",
      "next": "check"
    },

    "errore": {
      "type": "ESCALATE",
      "response": "Verifichiamo manualmente"
    },

    "alarm": {
      "type": "ESCALATE",
      "response": "La macchina segnala un problema"
    },

    "check": {
      "type": "CONFIRM",
      "prompt": "Ha funzionato? (sì / no)",
      "transitions": {
        "YES": "end",
        "NO": "escalate"
      }
    },

    "end": {
      "type": "END",
      "response": "Perfetto 👍"
    },

    "escalate": {
      "type": "ESCALATE",
      "response": "Verifichiamo manualmente"
    }
  }
}
```

---

### 🔥 Asciugatrice (Flow JSON)

```json
{
  "flowId": "asciugatrice_problema",
  "start": "step_problema",
  "nodes": {
    "step_problema": {
      "type": "QUESTION",
      "prompt": "Che problema hai? (bagnato / umido / non parte / altro)",
      "field": "problema",
      "transitions": {
        "bagnato": "troppo_bagnato",
        "umido": "umido",
        "non parte": "non_parte",
        "altro": "escalate"
      }
    },

    "troppo_bagnato": {
      "type": "ACTION",
      "response": "La roba è troppo bagnata. Rifai il lavaggio dividendo il carico.",
      "next": "check"
    },

    "umido": {
      "type": "ACTION",
      "response": "Distribuisci meglio i capi e aggiungi tempo.",
      "next": "check"
    },

    "non_parte": {
      "type": "QUESTION",
      "prompt": "Cosa vedi sul display?",
      "field": "display",
      "transitions": {
        "DOOR": "door",
        "ALM": "alarm",
        "default": "check"
      }
    },

    "door": {
      "type": "ACTION",
      "response": "Chiudi bene la porta.",
      "next": "check"
    },

    "alarm": {
      "type": "ESCALATE",
      "response": "C'è un allarme sulla macchina"
    },

    "check": {
      "type": "CONFIRM",
      "prompt": "Ha funzionato? (sì / no)",
      "transitions": {
        "YES": "end",
        "NO": "escalate"
      }
    },

    "end": {
      "type": "END",
      "response": "Perfetto 👍"
    },

    "escalate": {
      "type": "ESCALATE",
      "response": "Verifichiamo manualmente"
    }
  }
}
```

---

## 🧠 RUOLO DELL'LLM

👉 LLM legge il JSON e:

* fa le domande
* mostra le risposte
* gestisce il tono

❗ MA:
👉 NON decide i passaggi
👉 segue il JSON

---

## 💥 CORE IDEA

👉 FlowEngine = JSON
👉 Codice = interpreter
👉 LLM = interfaccia

🔥 Questo è il sistema

---

## 🧪 TEST (IMPORTANTI PER DEMO)

👉 Non testare solo il JSON
👉 testare: INPUT → DECISIONE → OUTPUT

### ✔️ Test lavatrice

* input: display = SEL → output: "Seleziona programma"
* input: display = PUSH PROG → output: "Premi programma"
* input: display = DOOR → output: "Chiudi porta"
* input: display = 001 → escalation
* input: display = ALM → escalation

### ✔️ Test asciugatrice

* input: problema = bagnato → "rifai lavaggio"
* input: problema = umido → "aggiungi tempo"
* input: display = DOOR → "chiudi porta"
* input: display = ALM → escalation

### ⚠️ Test reali (dal manuale)

👉 NON mettere tutto nel flow demo
👉 ma prevedere fallback

* filtro sporco → risposta: "pulisci filtro"
* rotazione / aspirazione → escalation
* allarmi non mappati → escalation

### 🎯 REGOLA DEMO

👉 risposte corte nel flow
👉 conoscenza lunga = fallback / LLM

Esempio:

* flow → "pulisci filtro"
* LLM (se serve) → spiega come farlo

---

## 🧠 FLOW vs ESCALATION (REGOLA CHIAVE DEMO)

### ✅ FLOWENGINE (gestito automaticamente)

* problemi display (SEL, PUSH PROG, DOOR)
* errori semplici di uso
* carico sbilanciato
* roba umida / troppo carico
* porta aperta

👉 output:

* 1 istruzione semplice

---

### 🚨 ESCALATION (umano)

* ALM / allarmi macchina
* errori sconosciuti
* problema non risolto dopo tentativo
* dati incoerenti (pagamento vs macchina)
* cliente arrabbiato
* codici strani

👉 output:
"Verifichiamo manualmente"

---

### 💥 ESCALATION IMMEDIATA (no flow)

* capi rovinati (bruciati, plastica, macchie)
* richiesta rimborso
* decisioni (compensazioni)

👉 output diretto:
"Mi dispiace, verifichiamo manualmente"

---

## ⚡ TAKEAWAY TEST

👉 Il sistema funziona se:

* stesso input → stessa decisione
* nessuna ambiguità
* fallback sempre previsto

🔥 demo = determinismo + controllo
