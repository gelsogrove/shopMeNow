# Feature 204: Unregistered User Flow - Open Chat with Restricted Actions

## 📋 Overview

### Context
Attualmente il sistema blocca completamente gli utenti non registrati dopo 5 messaggi. Questo è troppo restrittivo e non permette di convertire potenziali clienti. 

### Change Request
Rimuovere il blocco sugli utenti non registrati e permettere loro di chattare liberamente, ma **BLOCCARE specifiche azioni** che richiedono registrazione (prezzi, ordini, carrello).

### Business Value
- Aumenta le conversioni: utenti possono esplorare prima di registrarsi
- Migliore UX: non blocchiamo bruscamente la conversazione
- Lead generation: raccogliamo più contatti tramite il flusso di registrazione guidato

---

## 🎯 Functional Requirements

### FR-1: Rimozione Blocco Messaggi Utenti Non Registrati
**MUST**: Rimuovere il limite di 5 messaggi per utenti non registrati (`MAX_UNREGISTERED_MESSAGES`)
- Gli utenti non registrati possono chattare illimitatamente
- Il rate limiting normale (15 msg/min per customer, 100 msg/min per workspace) rimane attivo

### FR-2: Azioni Permesse per Utenti Non Registrati
**MUST**: Gli utenti non registrati (`isActive = false`) possono:
- ✅ Fare domande generiche (FAQ, informazioni azienda)
- ✅ Cercare prodotti (per nome, categoria)
- ✅ Vedere lista prodotti (senza prezzi)
- ✅ Vedere categorie
- ✅ Vedere offerte (descrizione, senza sconto numerico)
- ✅ Vedere servizi (descrizione)
- ✅ Chiedere informazioni contatti/orari
- ✅ Chiedere "chi sei?" / informazioni chatbot

### FR-3: Azioni BLOCCATE per Utenti Non Registrati
**MUST**: Gli utenti non registrati (`isActive = false`) NON possono:
- ❌ Vedere PREZZI prodotti
- ❌ Aggiungere prodotti al CARRELLO
- ❌ Vedere il proprio CARRELLO
- ❌ Effettuare ORDINI
- ❌ Vedere storico ORDINI
- ❌ Aggiungere SERVIZI al carrello
- ❌ Modificare profilo/dati personali

### FR-4: Messaggio di Registrazione (Registration Prompt)
**MUST**: Quando un utente non registrato tenta un'azione bloccata:

```
Per offrirti un supporto più mirato ti chiediamo di registrarti:
👉 [LINK_REGISTRAZIONE]

Una volta registrato, il nostro staff ti personalizzerà gli sconti e ti abiliterà a questo servizio.

🔒 Privacy: I tuoi dati sono presenti nei nostri database e non verranno inviati a terzi per nessun motivo. Neanche i modelli di AI potranno vedere i tuoi dati personali perché li trattiamo esclusivamente con dei link sicuri.
```

**Note**:
- Il messaggio deve essere multilingua (it/en/es/pt/de/fr)
- Il link deve essere generato dinamicamente per workspace
- Il messaggio viene salvato nel DB (`workspace.registrationPromptMessage`)

### FR-5: Post-Registrazione - Utente in Attesa
**MUST**: Dopo che l'utente completa la registrazione:
1. L'utente viene impostato `isActive = false` (già così)
2. L'utente viene impostato `activeChatbot = false` (DISABILITA chat)
3. Viene inviato messaggio di conferma:

```
Ciao {{customerName}}, abbiamo registrato i tuoi dati!

Ti avviseremo il prima possibile quando il nostro servizio sarà attivo per te.
Nel frattempo la chat è disattivata.

Grazie per la pazienza! 🙏
```

**Note**:
- Messaggio salvato in `workspace.postRegistrationPendingMessage`
- Multilingua

### FR-6: Attivazione Utente da Admin
**MUST**: Quando admin attiva l'utente (`isActive = true`):
1. Viene automaticamente riattivato `activeChatbot = true`
2. Viene inviato messaggio di benvenuto:

```
Ciao {{customerName}}, abbiamo attivato il tuo utente! 🎉

Ora posso aiutarti con:
✅ Vedere prezzi e offerte personalizzate
✅ Gestire il tuo carrello
✅ Effettuare ordini
✅ Vedere lo storico ordini

Come ti posso aiutare oggi? Stai cercando qualche prodotto in particolare?
```

**Note**:
- Messaggio salvato in `workspace.userActivatedMessage`
- Multilingua
- Deve essere inviato via WhatsApp (aggiunto a queue)

---

## 🏗️ Architecture

### Componenti Impattati

#### 1. WhatsApp Webhook Controller
- **RIMUOVERE**: Blocco `MAX_UNREGISTERED_MESSAGES`
- **MANTENERE**: Rate limiting esistente
- **AGGIUNGERE**: Nessuna nuova logica (tutto gestito da ChatEngine)

#### 2. Chat Engine Service
- **AGGIUNGERE**: STEP 0.02 - Check `customer.isActive`
- **Se `isActive = false`**: Passare flag `isUnregistered: true` al flow
- **Intent Parser**: NON cambia (parse normale)
- **Response Builder**: Check `isUnregistered` per bloccare azioni

#### 3. Response Builder Service
- **AGGIUNGERE**: Logica di blocco per intent specifici quando `isUnregistered = true`
- **Intent bloccati**: `VIEW_PRICES`, `ADD_TO_CART`, `VIEW_CART`, `CREATE_ORDER`, `VIEW_ORDERS`, `ADD_SERVICE_TO_CART`

#### 4. LLM Formatter Service
- **AGGIUNGERE**: `formatRegistrationPrompt()` per messaggio di registrazione

#### 5. Database Schema (Prisma)
- **AGGIUNGERE** a Workspace:
  ```prisma
  registrationPromptMessage      Json?    // Messaggio quando tenta azione bloccata
  postRegistrationPendingMessage Json?    // Messaggio dopo registrazione (in attesa)
  userActivatedMessage           Json?    // Messaggio quando admin attiva utente
  ```

#### 6. Customers Controller
- **MODIFICARE**: `activateCustomer()` - Inviare messaggio di attivazione via WhatsApp

---

## 🔐 Security Considerations

### S-1: API Rate Limiting
**MUST**: Mantenere rate limiting esistente per prevenire abuse:
- 15 msg/min per customer
- 100 msg/min per workspace
- LLM token limits per richiesta

### S-2: Workspace Isolation
**MUST**: Tutti i check `isActive` devono includere `workspaceId` filter

### S-3: No Price Leakage
**MUST**: I prezzi NON devono MAI apparire in risposte a utenti non registrati
- Verificare che `loadProducts()` rispetti flag
- Verificare che LLM formatter non includa prezzi

### S-4: Registration Link Security
**MUST**: I link di registrazione devono essere:
- Generati con token time-limited (24h)
- Validati server-side
- Workspace-specific

---

## 📊 Non-Functional Requirements

### NFR-1: Performance
- Il check `isActive` non deve aggiungere > 5ms di latency
- Usare campo già presente in customer record (no query aggiuntiva)

### NFR-2: Observability
- Log ogni volta che un utente non registrato tenta azione bloccata
- Metriche: contatore `unregistered_blocked_actions` per tipo di azione

### NFR-3: Multilingual
- Tutti i messaggi devono supportare: it, en, es, pt, de, fr
- Default fallback: it

---

## 🧪 Test Requirements

### Unit Tests
1. `isUnregistered` flag propagation attraverso ChatEngine
2. Response Builder blocca correttamente intent specifici
3. LLM Formatter genera messaggio registrazione corretto
4. Multilingua per tutti i messaggi

### Integration Tests
1. Flow completo: utente non registrato → chiede prezzo → riceve prompt registrazione
2. Flow completo: utente si registra → riceve messaggio attesa
3. Flow completo: admin attiva → utente riceve messaggio benvenuto

### Security Tests
1. Verificare che prezzi NON appaiono in nessun caso per utenti non registrati
2. Rate limiting funziona per utenti non registrati
3. Registration link non può essere riutilizzato

---

## 📝 User Stories

### US-1: Utente Non Registrato Esplora Prodotti
**Come** utente non registrato  
**Voglio** poter cercare e vedere i prodotti  
**Per** decidere se registrarmi  

**Acceptance Criteria**:
- Posso cercare "pasta"
- Vedo lista prodotti CON nome, descrizione, immagine
- NON vedo prezzi (mostra "Registrati per vedere il prezzo")
- Posso continuare a chattare senza limiti

### US-2: Utente Non Registrato Tenta Ordine
**Come** utente non registrato  
**Voglio** capire perché non posso ordinare  
**Per** decidere se registrarmi  

**Acceptance Criteria**:
- Chiedo "voglio ordinare la pasta"
- Ricevo messaggio con link registrazione
- Messaggio spiega privacy policy
- Messaggio è nella mia lingua

### US-3: Admin Attiva Nuovo Utente
**Come** admin  
**Voglio** attivare un utente appena registrato  
**Per** abilitarlo al servizio completo  

**Acceptance Criteria**:
- Click su "Attiva" nella lista clienti
- Utente riceve messaggio WhatsApp automatico
- Utente può subito vedere prezzi e ordinare

---

## 🚨 Breaking Changes

### BC-1: Rimozione MAX_UNREGISTERED_MESSAGES
- **Impatto**: Gli utenti non registrati potranno chattare illimitatamente
- **Mitigazione**: Rate limiting esistente previene abuse
- **Monitoraggio**: Alert se un utente non registrato supera 50 msg/giorno

### BC-2: Nuovo Campo isUnregistered nel ChatEngine
- **Impatto**: Tutti i servizi devono gestire questo flag
- **Mitigazione**: Default `false` per backward compatibility

---

## 📅 Implementation Phases

### Phase 1: Database & Config (Day 1)
- [ ] Aggiungere campi Workspace al schema Prisma
- [ ] Migration
- [ ] Seed con messaggi default multilingua
- [ ] Update seed.ts per BellItalia

### Phase 2: Chat Engine Changes (Day 1-2)
- [ ] Rimuovere MAX_UNREGISTERED_MESSAGES da webhook
- [ ] Aggiungere STEP 0.02 per check isActive
- [ ] Propagare flag isUnregistered

### Phase 3: Response Builder (Day 2)
- [ ] Implementare blocco intent per utenti non registrati
- [ ] Implementare REGISTRATION_REQUIRED response type
- [ ] Test unitari

### Phase 4: LLM Formatter (Day 2)
- [ ] Implementare formatRegistrationPrompt()
- [ ] Supporto multilingua
- [ ] Test unitari

### Phase 5: Admin Activation Flow (Day 3)
- [ ] Modificare activateCustomer() in controller
- [ ] Aggiungere invio messaggio WhatsApp
- [ ] Test integrazione

### Phase 6: Testing & QA (Day 3-4)
- [ ] Test E2E completi
- [ ] Security audit
- [ ] Performance testing

---

## 📎 Appendix

### A1: Intent Mapping per Blocco

| Intent | Bloccato per Non Registrati | Alternativa |
|--------|----------------------------|-------------|
| SHOW_PRODUCTS | ❌ No (permesso) | - |
| SHOW_CATEGORIES | ❌ No (permesso) | - |
| SEARCH_PRODUCTS | ❌ No (permesso) | Mostra senza prezzi |
| VIEW_PRICES | ✅ SÌ | Registration prompt |
| ADD_TO_CART | ✅ SÌ | Registration prompt |
| VIEW_CART | ✅ SÌ | Registration prompt |
| CREATE_ORDER | ✅ SÌ | Registration prompt |
| CHECKOUT | ✅ SÌ | Registration prompt |
| VIEW_ORDERS | ✅ SÌ | Registration prompt |
| VIEW_ORDER_DETAILS | ✅ SÌ | Registration prompt |
| ADD_SERVICE | ✅ SÌ | Registration prompt |
| GREETING | ❌ No (permesso) | - |
| FAQ | ❌ No (permesso) | - |
| CUSTOMER_SUPPORT | ❌ No (permesso) | - |

### A2: Messaggi Multilingua (Default)

```json
{
  "registrationPromptMessage": {
    "it": "Per offrirti un supporto più mirato ti chiediamo di registrarti:\n👉 {{registrationLink}}\n\nUna volta registrato, il nostro staff ti personalizzerà gli sconti e ti abiliterà a questo servizio.\n\n🔒 Privacy: I tuoi dati sono presenti nei nostri database e non verranno inviati a terzi per nessun motivo. Neanche i modelli di AI potranno vedere i tuoi dati personali perché li trattiamo esclusivamente con dei link sicuri.",
    "en": "To offer you more personalized support, please register:\n👉 {{registrationLink}}\n\nOnce registered, our staff will customize your discounts and enable this service for you.\n\n🔒 Privacy: Your data is stored in our databases and will not be shared with third parties. Even AI models cannot see your personal data because we handle it exclusively through secure links.",
    "es": "Para ofrecerte un soporte más personalizado, te pedimos que te registres:\n👉 {{registrationLink}}\n\nUna vez registrado, nuestro equipo personalizará tus descuentos y habilitará este servicio para ti.\n\n🔒 Privacidad: Tus datos están en nuestras bases de datos y no se compartirán con terceros. Ni siquiera los modelos de IA pueden ver tus datos personales porque los tratamos exclusivamente con enlaces seguros.",
    "pt": "Para oferecer um suporte mais personalizado, pedimos que se registe:\n👉 {{registrationLink}}\n\nApós o registo, a nossa equipa personalizará os seus descontos e ativará este serviço para si.\n\n🔒 Privacidade: Os seus dados estão nas nossas bases de dados e não serão partilhados com terceiros. Nem os modelos de IA podem ver os seus dados pessoais porque os tratamos exclusivamente através de links seguros.",
    "de": "Um dir einen persönlicheren Support zu bieten, bitten wir dich, dich zu registrieren:\n👉 {{registrationLink}}\n\nNach der Registrierung wird unser Team deine Rabatte anpassen und diesen Service für dich aktivieren.\n\n🔒 Datenschutz: Deine Daten sind in unseren Datenbanken gespeichert und werden nicht an Dritte weitergegeben. Selbst KI-Modelle können deine persönlichen Daten nicht sehen, da wir sie ausschließlich über sichere Links verarbeiten.",
    "fr": "Pour t'offrir un support plus personnalisé, nous te demandons de t'inscrire:\n👉 {{registrationLink}}\n\nUne fois inscrit, notre équipe personnalisera tes réductions et activera ce service pour toi.\n\n🔒 Confidentialité: Tes données sont stockées dans nos bases de données et ne seront pas partagées avec des tiers. Même les modèles d'IA ne peuvent pas voir tes données personnelles car nous les traitons exclusivement via des liens sécurisés."
  },
  "postRegistrationPendingMessage": {
    "it": "Ciao {{customerName}}, abbiamo registrato i tuoi dati!\n\nTi avviseremo il prima possibile quando il nostro servizio sarà attivo per te.\nNel frattempo la chat è disattivata.\n\nGrazie per la pazienza! 🙏",
    "en": "Hi {{customerName}}, we have registered your data!\n\nWe will notify you as soon as possible when our service is active for you.\nIn the meantime, the chat is disabled.\n\nThank you for your patience! 🙏",
    "es": "Hola {{customerName}}, hemos registrado tus datos!\n\nTe avisaremos lo antes posible cuando nuestro servicio esté activo para ti.\nMientras tanto, el chat está desactivado.\n\n¡Gracias por tu paciencia! 🙏",
    "pt": "Olá {{customerName}}, registrámos os seus dados!\n\nVamos notificá-lo assim que possível quando o nosso serviço estiver ativo para si.\nEntretanto, o chat está desativado.\n\nObrigado pela paciência! 🙏",
    "de": "Hallo {{customerName}}, wir haben deine Daten registriert!\n\nWir werden dich so schnell wie möglich benachrichtigen, wenn unser Service für dich aktiv ist.\nIn der Zwischenzeit ist der Chat deaktiviert.\n\nDanke für deine Geduld! 🙏",
    "fr": "Bonjour {{customerName}}, nous avons enregistré vos données!\n\nNous vous informerons dès que possible lorsque notre service sera actif pour vous.\nEn attendant, le chat est désactivé.\n\nMerci pour votre patience! 🙏"
  },
  "userActivatedMessage": {
    "it": "Ciao {{customerName}}, abbiamo attivato il tuo utente! 🎉\n\nOra posso aiutarti con:\n✅ Vedere prezzi e offerte personalizzate\n✅ Gestire il tuo carrello\n✅ Effettuare ordini\n✅ Vedere lo storico ordini\n\nCome ti posso aiutare oggi? Stai cercando qualche prodotto in particolare?",
    "en": "Hi {{customerName}}, we have activated your account! 🎉\n\nNow I can help you with:\n✅ View prices and personalized offers\n✅ Manage your cart\n✅ Place orders\n✅ View order history\n\nHow can I help you today? Are you looking for any particular product?",
    "es": "Hola {{customerName}}, hemos activado tu usuario! 🎉\n\nAhora puedo ayudarte con:\n✅ Ver precios y ofertas personalizadas\n✅ Gestionar tu carrito\n✅ Realizar pedidos\n✅ Ver historial de pedidos\n\n¿Cómo puedo ayudarte hoy? ¿Estás buscando algún producto en particular?",
    "pt": "Olá {{customerName}}, ativámos a sua conta! 🎉\n\nAgora posso ajudá-lo com:\n✅ Ver preços e ofertas personalizadas\n✅ Gerir o seu carrinho\n✅ Fazer encomendas\n✅ Ver histórico de encomendas\n\nComo posso ajudá-lo hoje? Está à procura de algum produto em particular?",
    "de": "Hallo {{customerName}}, wir haben dein Konto aktiviert! 🎉\n\nJetzt kann ich dir helfen mit:\n✅ Preise und personalisierte Angebote ansehen\n✅ Deinen Warenkorb verwalten\n✅ Bestellungen aufgeben\n✅ Bestellhistorie ansehen\n\nWie kann ich dir heute helfen? Suchst du nach einem bestimmten Produkt?",
    "fr": "Bonjour {{customerName}}, nous avons activé votre compte! 🎉\n\nMaintenant je peux vous aider avec:\n✅ Voir les prix et offres personnalisées\n✅ Gérer votre panier\n✅ Passer des commandes\n✅ Voir l'historique des commandes\n\nComment puis-je vous aider aujourd'hui? Cherchez-vous un produit en particulier?"
  }
}
```

### A3: Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    UNREGISTERED USER FLOW                           │
└─────────────────────────────────────────────────────────────────────┘

                         ┌──────────────┐
                         │  New Message │
                         └──────┬───────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Customer exists?      │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
              ┌─────────┐            ┌─────────────┐
              │   YES   │            │     NO      │
              └────┬────┘            └──────┬──────┘
                   │                        │
                   ▼                        ▼
          ┌────────────────┐      ┌───────────────────┐
          │ isActive=true? │      │ Create temp       │
          └───────┬────────┘      │ customer + send   │
                  │               │ welcome message   │
        ┌─────────┴─────────┐     └───────────────────┘
        │                   │
        ▼                   ▼
  ┌──────────┐       ┌──────────────┐
  │   YES    │       │     NO       │
  │ (Active) │       │(Unregistered)│
  └────┬─────┘       └──────┬───────┘
       │                    │
       ▼                    ▼
  ┌──────────┐      ┌───────────────────┐
  │ FULL     │      │ Parse Intent      │
  │ ACCESS   │      └────────┬──────────┘
  └──────────┘               │
                             ▼
                   ┌─────────────────────┐
                   │ Is blocked intent?  │
                   │ (price/cart/order)  │
                   └──────────┬──────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
              ┌──────────┐       ┌──────────────────┐
              │   NO     │       │      YES         │
              │ (Allow)  │       │ (Blocked)        │
              └────┬─────┘       └────────┬─────────┘
                   │                      │
                   ▼                      ▼
           ┌──────────────┐    ┌─────────────────────┐
           │ Normal LLM   │    │ Return Registration │
           │ Processing   │    │ Prompt Message      │
           └──────────────┘    └─────────────────────┘
```
