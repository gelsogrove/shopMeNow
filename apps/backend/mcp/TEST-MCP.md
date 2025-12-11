# 🧪 MCP Test Client - Guida Completa ai Test

## 📋 Indice
1. [Setup e Prerequisiti](#setup-e-prerequisiti)
2. [Sintassi Comandi](#sintassi-comandi)
3. [PARTE 1: E-commerce = TRUE](#parte-1-e-commerce--true)
4. [PARTE 2: E-commerce = FALSE](#parte-2-e-commerce--false)
5. [Matrice Function Calls](#matrice-function-calls)

---

## Setup e Prerequisiti

### Avvio Backend
```bash
cd /Users/gelso/workspace/shopME
npm run dev
```

### Directory MCP
```bash
cd /Users/gelso/workspace/shopME/apps/backend/mcp
```

### Utenti Disponibili
| Utente | Lingua | Phone | Workspace |
|--------|--------|-------|-----------|
| Mario Rossi 🇮🇹 | IT | +390212345678 | BellItalia VIP (ecommerce=true) |
| John Smith 🇬🇧 | EN | +44123456789 | BellItalia VIP |
| Maria Garcia 🇪🇸 | ES | +34666777888 | BellItalia VIP |
| João Silva 🇵🇹 | PT | +351912345678 | BellItalia VIP |

---

## Sintassi Comandi

```bash
node mcp-test-client.js "<UTENTE>" "<MESSAGGIO>" [OPZIONI]
```

### Opzioni Disponibili
| Opzione | Descrizione |
|---------|-------------|
| `workspaceId=ID` | ID del workspace (default: cm9hjgq9v00014qk8fsdy4ujv) |
| `log=true` | Mostra log dettagliati del server |
| `exit-first-message=true` | Esce dopo la prima risposta (per test singoli) |
| `seed=true` | Esegue seed database prima del test |

### Esempio Base
```bash
node mcp-test-client.js "Mario Rossi" "cerco formaggi" exit-first-message=true log=true
```

### Esempio con WorkspaceId Personalizzato
```bash
node mcp-test-client.js "Mario Rossi" "cerco formaggi" workspaceId=cm9hjgq9v00014qk8fsdy4ujv exit-first-message=true log=true
```

---

# PARTE 1: E-commerce = TRUE

## 🔍 FLUSSO 1: Ricerca Prodotti con Raggruppamento

### Obiettivo
Testare il flusso completo: ricerca → raggruppamento (se >5 risultati) → selezione → dettagli → aggiungi al carrello

### Test 1.1: Ricerca Generica (molti risultati → raggruppamento)
```bash
node mcp-test-client.js "Mario Rossi" "cerco formaggi" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Router delega a `productSearchAgent`
- Se risultati > 5: raggruppa per categoria/caratteristica
- Mostra opzioni numerate: "1. Formaggi stagionati, 2. Formaggi freschi, ..."

**🔧 Function Calls Attese:**
1. `productSearchAgent` (query: "formaggi")

---

### Test 1.2: Selezione Categoria (continua flusso)
```bash
node mcp-test-client.js "Mario Rossi" "voglio vedere i formaggi stagionati" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Mostra prodotti filtrati per "stagionati"
- Se ancora > 5: ulteriore raggruppamento
- Se ≤ 5: mostra lista numerata prodotti

**🔧 Function Calls Attese:**
1. `productSearchAgent` (query: "formaggi stagionati")

---

### Test 1.3: Selezione Prodotto Specifico
```bash
node mcp-test-client.js "Mario Rossi" "voglio il numero 1" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Mostra TUTTI i dettagli del prodotto selezionato:
  - Nome, Descrizione, Prezzo
  - Peso, Origine, Certificazioni
  - Disponibilità
- Chiede: "Vuoi aggiungerlo al carrello?"

**🔧 Function Calls Attese:**
1. `productSearchAgent` (per recuperare dettagli prodotto)

---

### Test 1.4: Conferma Aggiunta Carrello
```bash
node mcp-test-client.js "Mario Rossi" "sì, aggiungilo" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Conferma aggiunta: "✅ Prodotto aggiunto al carrello!"
- Mostra riepilogo carrello
- Chiede: "Vuoi continuare lo shopping o procedere al checkout?"

**🔧 Function Calls Attese:**
1. `cartManagementAgent` (action: "add_to_cart")

---

## 🛒 FLUSSO 2: Gestione Carrello

### Test 2.1: Visualizza Carrello
```bash
node mcp-test-client.js "Mario Rossi" "mostra carrello" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Lista prodotti nel carrello con quantità e prezzi
- Totale parziale
- Opzioni: "Modifica quantità | Rimuovi | Checkout"

**🔧 Function Calls Attese:**
1. `cartManagementAgent` (action: "view_cart")

---

### Test 2.2: Modifica Quantità
```bash
node mcp-test-client.js "Mario Rossi" "metti 3 unità del primo prodotto" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Conferma modifica quantità
- Mostra nuovo totale

**🔧 Function Calls Attese:**
1. `cartManagementAgent` (action: "update_quantity")

---

### Test 2.3: Rimuovi dal Carrello
```bash
node mcp-test-client.js "Mario Rossi" "rimuovi il gorgonzola" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Conferma rimozione
- Mostra carrello aggiornato

**🔧 Function Calls Attese:**
1. `cartManagementAgent` (action: "remove_from_cart")

---

### Test 2.4: Svuota Carrello
```bash
node mcp-test-client.js "Mario Rossi" "svuota il carrello" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Chiede conferma: "Sei sicuro di voler svuotare il carrello?"

**🔧 Function Calls Attese:**
1. `cartManagementAgent` (action: "clear_cart" con conferma)

---

## 📦 FLUSSO 3: Ordini

### Test 3.1: Visualizza Ultimo Ordine
```bash
node mcp-test-client.js "Mario Rossi" "mostra ultimo ordine" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Dettagli ultimo ordine:
  - Codice ordine, Data
  - Prodotti ordinati
  - Stato spedizione
  - Link tracking (se disponibile)

**🔧 Function Calls Attese:**
1. `orderTrackingAgent` (action: "get_last_order")

---

### Test 3.2: Storico Ordini
```bash
node mcp-test-client.js "Mario Rossi" "mostra tutti i miei ordini" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Lista ordini con data e stato
- Opzione per vedere dettagli

**🔧 Function Calls Attese:**
1. `orderTrackingAgent` (action: "get_order_history")

---

### Test 3.3: Ripeti Ultimo Ordine
```bash
node mcp-test-client.js "Mario Rossi" "ripeti ultimo ordine" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Mostra contenuto ultimo ordine
- Chiede: "Vuoi confermare il ri-ordino?"

**🔧 Function Calls Attese:**
1. `orderTrackingAgent` (action: "get_last_order")
2. `cartManagementAgent` (action: "repeat_order")

---

### Test 3.4: Conferma Ripeti Ordine
```bash
node mcp-test-client.js "Mario Rossi" "sì, conferma" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Aggiunge tutti i prodotti al carrello
- Mostra riepilogo
- Chiede: "Vuoi procedere al checkout?"

**🔧 Function Calls Attese:**
1. `cartManagementAgent` (action: "add_items_from_order")

---

### Test 3.5: Dove è il Mio Ordine (Tracking)
```bash
node mcp-test-client.js "Mario Rossi" "dove è il mio ordine?" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Stato spedizione ultimo ordine
- Link tracking corriere
- Data prevista consegna

**🔧 Function Calls Attese:**
1. `orderTrackingAgent` (action: "track_order")

---

### Test 3.6: Richiedi Fattura
```bash
node mcp-test-client.js "Mario Rossi" "dammi la fattura dell'ultimo ordine" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Link per scaricare fattura PDF
- Oppure: "Fattura non ancora disponibile, sarà inviata via email"

**🔧 Function Calls Attese:**
1. `orderTrackingAgent` (action: "get_invoice")

---

## 👤 FLUSSO 4: Profilo e Supporto

### Test 4.1: Modifica Profilo
```bash
node mcp-test-client.js "Mario Rossi" "voglio modificare il mio profilo" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Link sicuro per modificare profilo
- Oppure: opzioni disponibili (indirizzo, telefono, email)

**🔧 Function Calls Attese:**
1. `profileManagementAgent` (action: "get_profile_link")

---

### Test 4.2: Contatta Operatore
```bash
node mcp-test-client.js "Mario Rossi" "voglio parlare con un operatore" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Conferma escalation: "Ti metto in contatto con un operatore"
- Info su tempi di attesa

**🔧 Function Calls Attese:**
1. `customerSupportAgent` (action: "contact_operator")

---

### Test 4.3: FAQ
```bash
node mcp-test-client.js "Mario Rossi" "quali sono i metodi di pagamento?" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Risposta da FAQ database
- Nessuna chiamata LLM se match esatto

**🔧 Function Calls Attese:**
- Nessuna (FAQ match) oppure
- `customerSupportAgent` se non trova FAQ

---

## 🧪 FLUSSO 5: Test Completo End-to-End

### Sequenza Completa (da eseguire in ordine)
```bash
# 1. Ricerca
node mcp-test-client.js "Mario Rossi" "cerco formaggi italiani" log=true exit-first-message=true

# 2. Seleziona categoria
node mcp-test-client.js "Mario Rossi" "voglio vedere i DOP" log=true exit-first-message=true

# 3. Seleziona prodotto
node mcp-test-client.js "Mario Rossi" "dammi dettagli del numero 2" log=true exit-first-message=true

# 4. Aggiungi al carrello
node mcp-test-client.js "Mario Rossi" "sì aggiungilo" log=true exit-first-message=true

# 5. Checkout
node mcp-test-client.js "Mario Rossi" "procedi al checkout" log=true exit-first-message=true
```

---

# PARTE 2: E-commerce = FALSE

> ⚠️ Per testare workspace NON e-commerce, usare workspace "BellItalia" (sellsProductsAndServices=false)

## 🎯 Comportamento Atteso

Quando `sellsProductsAndServices = false`:
- ❌ NO ricerca prodotti
- ❌ NO carrello
- ❌ NO ordini
- ✅ FAQ e supporto
- ✅ Contatto operatore
- ✅ Informazioni azienda

---

### Test 6.1: Tentativo Ricerca Prodotti (deve fallire elegantemente)
```bash
# Usare utente su workspace NON ecommerce
node mcp-test-client.js "Mario Rossi" "cerco prodotti" log=true exit-first-message=true
```

**📤 Aspettativa con ecommerce=false:**
- NON chiama `productSearchAgent`
- Risponde: "Non vendiamo prodotti direttamente. Posso aiutarti con informazioni sui nostri servizi?"

**🔧 Function Calls Attese:**
- Nessuna function call relativa a prodotti

---

### Test 6.2: Richiesta Informazioni (workspace informativo)
```bash
node mcp-test-client.js "Mario Rossi" "quali servizi offrite?" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Informazioni sui servizi dal database
- NO menzione di prodotti/carrello

**🔧 Function Calls Attese:**
1. `customerSupportAgent` (per info servizi)

---

### Test 6.3: Contatto Supporto (sempre disponibile)
```bash
node mcp-test-client.js "Mario Rossi" "ho bisogno di assistenza" log=true exit-first-message=true
```

**📤 Aspettativa:**
- Offre supporto
- Opzione contatto operatore

**🔧 Function Calls Attese:**
1. `customerSupportAgent`

---

# Matrice Function Calls

## Agents e Relative Functions

| Agent | Function | Descrizione | Ecommerce Only |
|-------|----------|-------------|----------------|
| **productSearchAgent** | `searchProducts` | Ricerca prodotti | ✅ |
| **productSearchAgent** | `getProductDetails` | Dettagli prodotto | ✅ |
| **productSearchAgent** | `groupProducts` | Raggruppa risultati | ✅ |
| **cartManagementAgent** | `addToCart` | Aggiungi al carrello | ✅ |
| **cartManagementAgent** | `removeFromCart` | Rimuovi dal carrello | ✅ |
| **cartManagementAgent** | `updateQuantity` | Modifica quantità | ✅ |
| **cartManagementAgent** | `viewCart` | Visualizza carrello | ✅ |
| **cartManagementAgent** | `clearCart` | Svuota carrello | ✅ |
| **cartManagementAgent** | `checkout` | Procedi al checkout | ✅ |
| **orderTrackingAgent** | `getOrderHistory` | Storico ordini | ✅ |
| **orderTrackingAgent** | `getLastOrder` | Ultimo ordine | ✅ |
| **orderTrackingAgent** | `trackOrder` | Tracking spedizione | ✅ |
| **orderTrackingAgent** | `repeatOrder` | Ripeti ordine | ✅ |
| **orderTrackingAgent** | `getInvoice` | Scarica fattura | ✅ |
| **customerSupportAgent** | `contactOperator` | Contatta operatore | ❌ |
| **customerSupportAgent** | `getFAQ` | Risposta FAQ | ❌ |
| **profileManagementAgent** | `getProfileLink` | Link modifica profilo | ❌ |
| **profileManagementAgent** | `updateNotifications` | Gestisci notifiche | ❌ |

---

## 🔄 Checklist Pre-Release

- [ ] Tutti i test PARTE 1 passano
- [ ] Tutti i test PARTE 2 passano
- [ ] Function calls corrette per ogni scenario
- [ ] Risposte tradotte nella lingua utente
- [ ] Nessun errore nei log
- [ ] Workspace isolation verificata
- [ ] customAiRules rispettate

---

## 🐛 Debug Tips

### Vedere Log Completi
```bash
node mcp-test-client.js "Mario Rossi" "messaggio" log=true
```

### Verificare Function Calls nel Log
Cercare nel terminale backend:
```
⚙️ LLM requested function: <function_name>
```

### Verificare Delegazione Agent
Cercare:
```
🔀 Delegation detected to: <AGENT_TYPE>
```

---

*Documento creato per Feature 200 - Prompt On-Demand Rendering*
*Ultimo aggiornamento: 2025-12-11*



quando c'e' un problmea devi sistemare i prompt
ma attenzione a qeuste regole 

- ogni commenti deve essere nel posto giusto giusto prompt e alla giusta lineea per esempio se e' un esempio non pu' essere nel router e dovra eessere magari sotti products and service agent reparto esempi 

- occhio agli esempi perche'poi vengoni riprodotti prefersico un placeOLder

- ricorcati che il router deve madnare messaggi chiari al sub llm per non avere messsaggi di conferma o sei sicuro di ..bla bla bla quando utente ha gia' dato la risposta

- attento a non essere forviante con altre CF attento a non fare confusioni tra le funzioni deve essere sempre chiaro lo scopo di una funzione

- fallo in ingles
- usa le varibili 
- ricordati che oggi partliamo di prodotti domani parleremo di macchine deve essere tutto generico placeholder
- ricordati che products deve riassumere sempre con intelleigenza quando ha piu di 5 prodotti
- ricordati che il customer support deve sempre avere un formato di risposta chiaro e distinto tra quando c'e' l'operatore e quando non c'e'
- ricordati che per il tono formato traduzione abbiamo un LLM apposta
- usa la best practise cercala online se necessario
- gioca con   temperatura modello  max token se necessaio ma calcola che prefersico sempre GPT-4o MIni e temperatura bassa
- 
