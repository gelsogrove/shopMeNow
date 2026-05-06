# Regole di hardcoding — ecolaundry

**Owner**: Andrea
**Last updated**: 2026-05-02
**Stato**: vincolante, da rispettare in tutti i refactoring futuri.

---

## Premessa

Andrea: *"non dico che non voglio usarle [le regex hardcoded]. Però devono essere mirate. Non possiamo mettere tutte le frasi e combinazioni del mondo con regex."*

Tradotto in regole operative: l'hardcoding è uno **strumento chirurgico**, non un riempitivo. Ogni regex in `*.ts` deve giustificare la propria esistenza contro il LLM. Quando una regex tenta di coprire "tutte le frasi possibili", quella regex va rimossa e affidata al LLM.

---

## Le 5 regole

### 1. Hardcode SOLO token enumerati e deterministici

**Sempre OK** (hardcode):
- Codici display delle macchine: `SEL`, `PUSH`, `DOOR`, `ALM/E`, `AL001`, `END`, `BLANK`
- Numeri puri: `^\d{1,3}$` (numero macchina)
- Yes/No in nodi di scelta del flow engine: il flow engine ha bisogno di transizioni deterministiche
- Reset esplicito: `/reset`, `/exit`
- Comandi WhatsApp di sistema (se mai serviranno)

Questi sono **enumerati dal dominio**, non da pattern linguistici. Sono codici, non frasi.

### 2. NON hardcodare frasi / intent linguistici

**Mai OK** (delegare al LLM):
- Cambio argomento ("ah no aspetta", "anzi", "ho cambiato idea")
- Conferma di aver risolto ("ora va", "ha funzionato", "è partita", "ya arrancó", "ora parte")
- Tono arrabbiato / frustrato (ne abbiamo già uno hardcoded: `hasAngryToneIntent` — è da rimuovere in Step B)
- Richiesta di operatore umano ("voglio parlare con qualcuno", "passami un umano", "operador")
- FAQ libera ("a che ora aprite?", "quanto costa?", "come pago?")
- Riconoscere che il cliente sta cambiando macchina mentre parlava di un'altra

Per questi: il **Router LLM** o **Specialist LLM** decidono. Mai regex.

### 3. Whitelist: max 1 detector regex per intent linguistico

Quando un intent **deve** essere intercettato deterministicamente prima di chiamare il Router LLM (esempio: `displayUnreadable` per saltare la richiesta di display), si scrive **un solo detector** con queste vincoli:

- **Una sola regex per ogni lingua supportata** (es: `hasDisplayUnreadableIntent` ha 3 regex separate per es/it/en, una linea per lingua, NON una regex enorme che cerca di matchare tutto)
- **Caratteri di word boundary**: mai `\b` davanti/dietro a caratteri non-ASCII (`é`, `ó`, `ñ`, `à`). Usare `(?:^|\\s)` e `(?:\\s|$|[.,!?¿¡])` come boundary.
- **Test unitario obbligatorio**: ogni detector hardcoded ha un test in `__tests__/` che verifica almeno 5 frasi positive e 3 negative per lingua.
- **Documentato in HARDCODING_INVENTORY.md** con motivazione.

### 4. Le risposte deterministiche stanno SOLO in `localization.ts`

Niente `reply: 'frase in spagnolo'` direttamente in `chatbot.ts` o nelle phases.

Pattern OBBLIGATORIO:
```ts
// localization.ts
const TRANSLATIONS = {
  myKey: { es: '...', it: '...', ca: '...', en: '...', pt: '...', fr: '...' }
}

// chatbot.ts (o phases/*)
return { reply: t('myKey', state.language), ... }
```

Se manca anche solo una traduzione per una delle 6 lingue, il PR viene rifiutato. CI check da scrivere in Step C.

Eccezione: stringhe in **debug log** o in **escalation summary per operatore** possono restare in inglese (sono interne).

### 5. Le frasi che cambiano ogni mese stanno in JSON, non in TS

Frasi business che possono cambiare per scelta del cliente (testo della FAQ "come comprare la tessera", testo dello step `case_push`, ecc.) **non vivono in TS**. Stanno in:

- `json/faqs.json` (FAQ base)
- `json/locations.json` `faqOverrides` / `flowOverrides` (override per location)
- `json/lavatrice_hs60xx.json` / `json/asciugatrice_ed340.json` (passi del flow)

In TS: solo riferimenti a chiavi (es. `case_push`, `displayWasher`).

---

## Inventario hardcoded attuale (al 2026-05-02)

Da consolidare in `HARDCODING_INVENTORY.md` durante Step A.

### Detector linguistici hardcoded che ci sono oggi

| Funzione | File | Lingue | Note |
|---|---|---|---|
| `hasDiscountCodeIntent` | `utils/faq-intents.ts` | es/it/ca/en | OK, FAQ deterministica |
| `hasInvoiceRequestIntent` | `utils/faq-intents.ts` | es/it/ca/en | OK, FAQ deterministica |
| `hasBuyLoyaltyCardIntent` | `utils/faq-intents.ts` | es/it/ca/en | OK |
| `hasRechargeLoyaltyCardIntent` | `utils/faq-intents.ts` | es/it/ca/en | OK |
| `hasHoursOrPricesIntent` | `utils/faq-intents.ts` | es/it/ca/en | OK |
| `hasAlarmCodeIntent` | `utils/faq-intents.ts` | tutte (codice puro) | OK, codici enumerati |
| `hasDoubleChargeConcern` | `utils/intent.ts` | es/it/en | OK ma da review |
| `hasNoFoamConcern` | `utils/intent.ts` | es/it | OK |
| `hasTroubleshootingIntent` | `utils/intent.ts` | es/it/en | DA REMOVE in Step B (l'agent capisce da contesto) |
| `hasOperationalContextIntent` | `utils/intent.ts` | es/it/en | DA REMOVE in Step B |
| `hasAngryToneIntent` | `utils/intent.ts` | es | DA REMOVE in Step B (tono lo gestisce LLM) |
| `hasMixedIncidentIntent` | `utils/intent.ts` | es | DA REMOVE in Step B |
| `hasUnknownLocationIntent` | `utils/intent.ts` | es/it/en | DA REMOVE in Step B |
| `hasDisplayUnreadableIntent` | `utils/intent.ts` | es/it/en | DA REMOVE in Step B |
| `hasNoPhotoIntent` | `utils/intent.ts` | es/it/en | DA REMOVE in Step B |
| `parseExplicitPaymentSignal` | `utils/message-parsing.ts` | tutte | OK (yes/no boolean + payment context) |
| `parseServiceCompletedAnswer` | `utils/message-parsing.ts` | tutte | OK |
| `parsePaymentProofProvided` | `utils/intent.ts` | tutte | OK |
| `extractDisplayState` | `utils/intent.ts` | tutte | OK (codici enumerati) |
| `extractUnknownDisplayCode` | `utils/intent.ts` | tutte | OK (pattern codice) |
| `extractLast4CardDigits` | `utils/intent.ts` | tutte | OK |
| `KNOWN_LOCATIONS` array | `utils/message-parsing.ts` | n/a | DA SPOSTARE in `locations.json` runtime |

### Risposte hardcoded fuori da `localization.ts`

Nessuna dopo lo Step A2 (le 14 trovate il 2026-05-02 sono state migrate). Da verificare al termine dello Step A con un grep.

---

## Workflow per aggiungere un nuovo intent

Quando si vuole aggiungere un detector hardcoded:

1. **Chiediti**: il Router LLM può classificarlo? Se sì, FERMATI. Aggiungi solo un esempio nel prompt `router.txt`.
2. Se NO (ad es. costo troppo alto, latency, intent ad alto rischio escalation):
   - Crea il detector in `utils/intent.ts` o `utils/faq-intents.ts`
   - Una regex per lingua, max 1 linea ognuna
   - Test unitario in `__tests__/intent.spec.ts`
   - Aggiorna `HARDCODING_INVENTORY.md`
   - PR con motivazione esplicita: perché LLM non basta?

---

## Workflow per aggiungere una nuova risposta deterministica

1. Apri `utils/localization.ts`
2. Aggiungi la chiave a `TRANSLATIONS` con TUTTE e 6 le lingue
3. Usa `t(key, state.language)` nel chiamante
4. Se la frase è un'istruzione tecnica del flow, NO: va in JSON, non in TS

---

## Cosa cancellare in Step B

Tutti i detector marcati "DA REMOVE in Step B" qui sopra. Saranno assorbiti dall'LLM agent. Da rimuovere uno alla volta, ogni rimozione coperta da test che la sostituisce verifica semantica.
