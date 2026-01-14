# shopME - Product Requirements Document (PRD)

> **Versione**: 2.1  
> **Ultimo aggiornamento**: 15 Dicembre 2025  
> **Autore**: Andrea Gelsomino  
> **Status**: In Development

---

## 📋 Indice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Problema / Oportunidad](#2-problema--oportunidad)
3. [Objetivos del Producto](#3-objetivos-del-producto)
4. [Scope (In / Out)](#4-scope-in--out)
5. [Usuarios Principales](#5-usuarios-principales)
6. [Casos de Uso](#6-casos-de-uso)
7. [User Stories](#7-user-stories)
8. [Requisitos Funcionales](#8-requisitos-funcionales)
9. [Requisitos No Funcionales](#9-requisitos-no-funcionales)
10. [Flujos UX](#10-flujos-ux)
11. [Criterios de Aceptación](#11-criterios-de-aceptación)
12. [KPIs / Success Metrics](#12-kpis--success-metrics)
13. [Riesgos + Mitigación](#13-riesgos--mitigación)
14. [Planificación + Prioridades](#14-planificación--prioridades)
15. [Architettura Tecnica](#15-architettura-tecnica)

---

## 1. Resumen Ejecutivo

### Qué es shopME

**shopME** (eChatbot) è una piattaforma e-commerce basata su WhatsApp con chatbot AI integrato. Permette alle aziende di vendere prodotti e gestire ordini direttamente tramite conversazioni WhatsApp, senza bisogno di un sito web tradizionale.

### Problema che Risolve

Le piccole e medie imprese faticano a:
- Gestire ordini su WhatsApp manualmente
- Rispondere ai clienti 24/7
- Scalare le vendite senza assumere personale
- Offrire un'esperienza multilingue

### Benefici Chiave

| Beneficio | Descrizione |
|-----------|-------------|
| 🤖 **Automazione 24/7** | Chatbot AI risponde automaticamente in qualsiasi lingua |
| 📱 **Nessun Sito Web** | I clienti ordinano direttamente su WhatsApp |
| 💰 **Pay-per-Use** | Paghi solo per i messaggi e ordini effettivi |
| 🌍 **Multilingua** | Supporto nativo per IT, EN, ES, PT via LLM |
| 📊 **Analytics** | Dashboard per monitorare vendite e performance |

---

## 2. Problema / Oportunidad

### Il Problema Attuale

1. **Gestione Manuale**: Le PMI rispondono manualmente a centinaia di messaggi WhatsApp al giorno
2. **Orari Limitati**: Perdono ordini fuori orario lavorativo
3. **Errori Umani**: Ordini sbagliati, prezzi errati, dimenticanze
4. **Scalabilità**: Non possono crescere senza assumere personale
5. **Barriera Linguistica**: Difficoltà a servire clienti internazionali

### L'Opportunità

- **3+ miliardi** di utenti WhatsApp nel mondo
- **175+ milioni** di persone contattano aziende su WhatsApp ogni giorno
- **PMI in Italia**: 4.4 milioni di imprese, la maggior parte usa WhatsApp informalmente
- **Trend**: Conversational Commerce in crescita del 25% annuo

### Soluzione Proposta

Una piattaforma SaaS che trasforma WhatsApp in un canale di vendita automatizzato con:
- Chatbot AI che capisce le richieste in linguaggio naturale
- Catalogo prodotti integrato
- Gestione ordini automatizzata
- Dashboard per il business owner

---

## 3. Objetivos del Producto

### Obiettivi Primari

| Obiettivo | KPI | Target |
|-----------|-----|--------|
| **Automatizzare vendite** | % ordini senza intervento umano | > 80% |
| **Ridurre tempi di risposta** | Tempo medio prima risposta | < 5 secondi |
| **Aumentare conversioni** | Ordini completati / Conversazioni | > 15% |
| **Soddisfazione cliente** | NPS Score | > 50 |

### Obiettivi Secondari

- Ridurre costi operativi del merchant del 60%
- Supportare 4+ lingue senza traduttori umani
- Scalare a 10.000+ messaggi/giorno per merchant
- Uptime 99.9%

---

## 4. Scope (In / Out)

### ✅ In Scope (MVP + Current Features)

| Area | Features Incluse |
|------|------------------|
| **Chatbot AI** | Router LLM, Product Search, Safety Agent, Translation Agent |
| **E-commerce** | Catalogo prodotti, Carrello, Ordini, Offerte |
| **Clienti** | Registrazione, Profilo, Storico ordini |
| **Pagamenti** | PayPal integration, Link di pagamento |
| **Billing** | Credit system, Plans (Trial/Basic/Premium/Enterprise) |
| **Team** | Multi-user workspace, Inviti, Ruoli |
| **Security** | 2FA, JWT, Workspace isolation |
| **Analytics** | Dashboard base, Usage tracking |
| **Storage** | Unified storage (Local dev / Cloudinary prod), Image upload, Cleanup scheduler |
| **Invoices** | PDF generation, Storage integration, Signed URLs |

### ❌ Out of Scope (Future / V2)

| Area | Motivo Esclusione |
|------|-------------------|
| **App Mobile Nativa** | Focus su web dashboard |
| **Integrazione Instagram/Messenger** | Solo WhatsApp per ora |
| **Marketplace Multi-Vendor** | Single-vendor per semplicità |
| **Spedizioni/Tracking** | Gestito esternamente dal merchant |
| **Inventory Management Avanzato** | Solo stock base |
| **CRM Completo** | Solo gestione clienti base |

---

## 5. Usuarios Principales

### 5.1 Business Owner (Merchant)

| Attributo | Descrizione |
|-----------|-------------|
| **Chi è** | Proprietario di piccola/media impresa |
| **Obiettivo** | Vendere prodotti su WhatsApp senza sforzo |
| **Pain Points** | Troppi messaggi, poco tempo, errori |
| **Canale** | Web dashboard (desktop/mobile) |

### 5.2 Operatore / Team Member

| Attributo | Descrizione |
|-----------|-------------|
| **Chi è** | Dipendente del merchant |
| **Obiettivo** | Gestire ordini e chat complesse |
| **Pain Points** | Passaggio tra più tool |
| **Canale** | Web dashboard |

### 5.3 Cliente Finale (End Customer)

| Attributo | Descrizione |
|-----------|-------------|
| **Chi è** | Consumatore che ordina su WhatsApp |
| **Obiettivo** | Ordinare facilmente senza app/sito |
| **Pain Points** | Risposte lente, difficoltà a trovare prodotti |
| **Canale** | WhatsApp |

### 5.4 Platform Admin

| Attributo | Descrizione |
|-----------|-------------|
| **Chi è** | Amministratore della piattaforma |
| **Obiettivo** | Monitorare e gestire tutti i workspace |
| **Pain Points** | Visibilità su problemi, billing |
| **Canale** | Backoffice admin |

---

## 6. Casos de Uso

### UC-001: Cliente ordina prodotto

```
Attore: Cliente Finale
Precondizioni: Il merchant ha configurato il catalogo
Trigger: Cliente scrive su WhatsApp

Flusso Principale:
1. Cliente scrive "Ciao, vorrei ordinare"
2. Chatbot risponde con benvenuto e chiede cosa cerca
3. Cliente chiede "Avete vino rosso?"
4. Chatbot mostra lista prodotti con prezzi
5. Cliente dice "Prendo 2 bottiglie del Chianti"
6. Chatbot aggiunge al carrello e chiede conferma
7. Cliente conferma
8. Chatbot genera link di pagamento
9. Cliente paga
10. Ordine confermato

Postcondizioni: Ordine creato, merchant notificato
```

### UC-002: Merchant configura catalogo

```
Attore: Business Owner
Precondizioni: Account creato e verificato
Trigger: Merchant accede a dashboard

Flusso Principale:
1. Merchant fa login (2FA)
2. Va su "Products"
3. Clicca "Add Product"
4. Compila nome, descrizione, prezzo, immagini
5. Assegna categoria e certificazioni
6. Salva

Postcondizioni: Prodotto disponibile per il chatbot
```

### UC-003: Operatore gestisce chat manuale

```
Attore: Operatore
Precondizioni: Chat assegnata a operatore
Trigger: Cliente richiede assistenza umana

Flusso Principale:
1. Chatbot riconosce richiesta complessa
2. Passa chat a operatore
3. Operatore riceve notifica
4. Apre chat in dashboard
5. Risponde al cliente
6. Risolve problema
7. Chiude chat

Postcondizioni: Cliente soddisfatto, chat archiviata
```

### UC-004: Owner ricarica credito

```
Attore: Business Owner
Precondizioni: Credito basso o esaurito
Trigger: Alert credito basso

Flusso Principale:
1. Owner va su "Billing"
2. Vede saldo attuale
3. Clicca "Recharge"
4. Sceglie importo (€20, €50, €100)
5. Paga con PayPal
6. Credito aggiornato

Postcondizioni: Chatbot riprende a funzionare
```

---

## 7. User Stories

### Chatbot & Conversazioni

| ID | User Story | Priority |
|----|------------|----------|
| US-001 | Come **cliente**, voglio chiedere informazioni sui prodotti in linguaggio naturale, per trovare ciò che cerco facilmente | MUST |
| US-002 | Come **cliente**, voglio aggiungere prodotti al carrello tramite chat, per ordinare senza uscire da WhatsApp | MUST |
| US-003 | Come **cliente**, voglio vedere il mio carrello e modificarlo, per controllare l'ordine prima di pagare | MUST |
| US-004 | Come **cliente**, voglio ricevere un link di pagamento sicuro, per completare l'acquisto | MUST |
| US-005 | Come **cliente**, voglio parlare in qualsiasi lingua, per essere capito dal chatbot | SHOULD |

### Gestione Prodotti

| ID | User Story | Priority |
|----|------------|----------|
| US-010 | Come **merchant**, voglio aggiungere prodotti con foto e descrizioni, per mostrare il mio catalogo | MUST |
| US-011 | Come **merchant**, voglio organizzare prodotti in categorie, per facilitare la ricerca | MUST |
| US-012 | Come **merchant**, voglio impostare offerte e sconti, per promuovere vendite | SHOULD |
| US-013 | Come **merchant**, voglio gestire lo stock, per evitare di vendere prodotti esauriti | SHOULD |

### Ordini & Pagamenti

| ID | User Story | Priority |
|----|------------|----------|
| US-020 | Come **merchant**, voglio vedere tutti gli ordini in una dashboard, per gestirli facilmente | MUST |
| US-021 | Come **merchant**, voglio ricevere notifiche per nuovi ordini, per rispondere rapidamente | MUST |
| US-022 | Come **cliente**, voglio vedere lo storico dei miei ordini, per riordinare facilmente | SHOULD |

### Billing & Subscription

| ID | User Story | Priority |
|----|------------|----------|
| US-030 | Come **owner**, voglio vedere il mio credito residuo, per sapere quando ricaricare | MUST |
| US-031 | Come **owner**, voglio ricaricare credito con PayPal, per continuare a usare il servizio | MUST |
| US-032 | Come **owner**, voglio mettere in pausa il servizio, per non pagare quando non lo uso | SHOULD |
| US-033 | Come **owner**, voglio vedere la fattura mensile, per controllare i costi | SHOULD |

### Team & Workspace

| ID | User Story | Priority |
|----|------------|----------|
| US-040 | Come **owner**, voglio invitare membri del team, per delegare la gestione | SHOULD |
| US-041 | Come **owner**, voglio assegnare ruoli diversi, per limitare accessi | SHOULD |

---

## 8. Requisitos Funcionales

### 8.1 Modulo Chatbot AI

| RF-ID | Requisito | Dettaglio |
|-------|-----------|-----------|
| RF-001 | Router LLM | Il sistema deve analizzare ogni messaggio e instradarlo all'agente corretto (Product, Order, FAQ, Human) |
| RF-002 | Product Search | Il chatbot deve cercare prodotti per nome, categoria, caratteristiche con fuzzy matching |
| RF-003 | Cart Management | Il chatbot deve permettere add/remove/update prodotti nel carrello via chat |
| RF-004 | Safety Agent | Ogni risposta deve essere validata per sicurezza prima dell'invio |
| RF-005 | Translation | Il sistema deve tradurre automaticamente nella lingua del cliente |
| RF-006 | Context Memory | Il chatbot deve ricordare il contesto della conversazione (10 min window) |

### 8.2 Modulo E-commerce

| RF-ID | Requisito | Dettaglio |
|-------|-----------|-----------|
| RF-010 | Product CRUD | Dashboard per create/read/update/delete prodotti con immagini multiple |
| RF-011 | Categories | Gestione categorie gerarchiche |
| RF-012 | Offers | Sistema offerte con date inizio/fine, % sconto |
| RF-013 | Stock | Tracking quantità disponibile per prodotto |
| RF-014 | Certifications | Tag personalizzabili (Bio, DOP, Vegan, etc.) |

### 8.3 Modulo Ordini

| RF-ID | Requisito | Dettaglio |
|-------|-----------|-----------|
| RF-020 | Order Creation | Creazione ordine da carrello con calcolo totale |
| RF-021 | Order Status | Stati: PENDING → CONFIRMED → SHIPPED → DELIVERED / CANCELLED |
| RF-022 | Payment Links | Generazione link PayPal per pagamento |
| RF-023 | Order History | Storico ordini per cliente con dettagli |

### 8.4 Modulo Billing

| RF-ID | Requisito | Dettaglio |
|-------|-----------|-----------|
| RF-030 | Credit System | Saldo credito per owner (non per workspace). Il credito è condiviso tra tutti i workspace dello stesso owner |
| RF-031 | Usage Tracking | Tracciamento messaggi WhatsApp (€0.10/msg), messaggi widget (€0.05/msg) e campagne push (€1.00/msg) per fatturazione. I costi vengono scalati dal credito dell'owner |
| RF-032 | Plans | 4 piani: FREE_TRIAL ($29 credito iniziale), BASIC (€29/mese), PREMIUM (€79/mese), ENTERPRISE (custom) |
| RF-033 | Recharge | Ricarica credito via PayPal (min €20, max €500). Pacchetti preconfigurati: €20, €50, €100, €200 |
| RF-034 | Invoices | Generazione fattura mensile con breakdown per workspace e tipo di utilizzo |
| RF-035 | Pause/Resume | Pausa immediata servizio (stop chatbot) senza cancellazione dati |
| RF-036 | Billing per Owner | Il billing è a livello di owner, non di workspace. Un owner con più workspace ha un unico saldo credito |

### 8.5 Modulo Channel Types (Feature 199)

| RF-ID | Requisito | Dettaglio |
|-------|-----------|-----------|
| RF-050 | E-commerce Channel | Canale con `sellsProductsAndServices=true`. Include: catalogo prodotti, carrello, ordini, offerte. Agenti attivi: 9 (inclusi PRODUCT_SEARCH, CART_MANAGEMENT, ORDER_TRACKING) |
| RF-051 | Informational Channel | Canale con `sellsProductsAndServices=false`. Solo FAQ e supporto informativo. Agenti attivi: 6 (esclusi agenti e-commerce) |
| RF-052 | Channel Configuration | Ogni workspace ha configurazioni dedicate: `hasSalesAgents`, `hasSuppliers`, `hasHumanSupport`, `toneOfVoice`, `botIdentityResponse` |
| RF-053 | Logo Channel | Ogni workspace può avere un logo personalizzato (`logoUrl`) mostrato nella lista canali |
| RF-054 | Channel Switching | L'owner può cambiare tipo canale (e-commerce ↔ info) dalla dashboard. Gli agenti vengono filtrati automaticamente |

### 8.6 Modulo Dynamic Prompt System

| RF-ID | Requisito | Dettaglio |
|-------|-----------|-----------|
| RF-060 | PromptBuilderService | Sistema che costruisce dinamicamente il prompt del Router Agent basandosi sulla configurazione del workspace |
| RF-061 | Variable Replacement | Sostituzione di variabili nel prompt: `{{products}}`, `{{categories}}`, `{{offers}}`, `{{services}}`, `{{faqs}}`, `{{certifications}}` |
| RF-062 | Context Injection | Il prompt include automaticamente: nome workspace, lingua, indirizzo, regole custom, identità bot |
| RF-063 | Agent Filtering | Gli agenti disponibili nel prompt dipendono da `sellsProductsAndServices`. Canali info non vedono agenti e-commerce |
| RF-064 | Variable Uniqueness | Ogni variabile grande (`{{products}}`, `{{offers}}`, etc.) può apparire al massimo UNA volta per prompt per evitare token overflow |
| RF-065 | Database-Driven | TUTTI i prompt vengono dalla tabella `AgentConfig`. Nessun prompt hardcoded nel codice |

### 8.7 Modulo Authentication

| RF-ID | Requisito | Dettaglio |
|-------|-----------|-----------|
| RF-040 | Login | Email/password con JWT |
| RF-041 | 2FA | TOTP obbligatorio con recovery codes |
| RF-042 | OAuth | Login con Google (optional) |
| RF-043 | Session | Validazione sessione con timeout |
| RF-044 | Workspace Isolation | Ogni query filtrata per workspaceId |
### 8.8 Modulo Storage Service

| RF-ID | Requisito | Dettaglio |
|-------|-----------|----------|
| RF-070 | Unified Interface | `IStorageService` interface comune per Local e Cloudinary |
| RF-071 | Auto-Switch | `getStorageService()` ritorna LocalAdapter in dev, CloudinaryAdapter in prod (basato su NODE_ENV) |
| RF-072 | Product Images | Upload immagini prodotti in `products/{workspaceId}/` con tracking `imageKey` |
| RF-073 | Service Images | Upload immagini servizi in `services/{workspaceId}/` con tracking `imageKey` |
| RF-074 | Workspace Logo | Upload logo workspace in `workspaces/{workspaceId}/` con tracking `logoKey` |
| RF-075 | Invoices | Upload fatture PDF in `invoices/{workspaceId}/` con signed URLs |
| RF-076 | Temp Files | File temporanei con lifecycle 24h auto-delete |
| RF-077 | Cleanup Scheduler | Job automatici per pulizia file orfani (03:00 daily) e temp files (hourly) |

### 8.9 Modulo Invoice Service

| RF-ID | Requisito | Dettaglio |
|-------|-----------|----------|
| RF-080 | PDF Generation | Generazione fattura PDF con pdfkit (logo, dettagli ordine, totali) |
| RF-081 | Storage Integration | Salvataggio fattura via Storage Service (Local o Cloudinary) |
| RF-082 | Signed URLs | URL firmati con scadenza per download sicuro (default 1h) |
| RF-083 | Order Integration | `invoiceUrl`, `invoiceKey`, `invoiceDate` salvati in Orders table |
| RF-084 | Cancelled Cleanup | Job scheduler elimina fatture ordini cancellati (04:00 daily) |
---

## 9. Requisitos No Funcionales

### 9.1 Performance

| NFR-ID | Requisito | Target |
|--------|-----------|--------|
| NFR-001 | Response Time (API) | < 200ms p95 |
| NFR-002 | Response Time (Chatbot) | < 3s per risposta LLM |
| NFR-003 | Throughput | 1000 req/min per workspace |
| NFR-004 | Database Queries | < 50ms p95 |

### 9.2 Scalabilità

| NFR-ID | Requisito | Target |
|--------|-----------|--------|
| NFR-010 | Concurrent Users | 10.000 per instance |
| NFR-011 | Messages/Day | 100.000 per workspace |
| NFR-012 | Storage | Auto-scaling su cloud |

### 9.3 Sicurezza

| NFR-ID | Requisito | Target |
|--------|-----------|--------|
| NFR-020 | Authentication | JWT + 2FA obbligatorio |
| NFR-021 | Authorization | Role-based (OWNER, ADMIN, MEMBER) |
| NFR-022 | Data Encryption | TLS 1.3 in transit, AES-256 at rest |
| NFR-023 | Workspace Isolation | 100% query filtrate |
| NFR-024 | Rate Limiting | 100 req/min per IP |
| NFR-025 | Audit Log | Tutte le azioni admin logggate |

### 9.4 Disponibilità

| NFR-ID | Requisito | Target |
|--------|-----------|--------|
| NFR-030 | Uptime | 99.9% (8.7h downtime/anno) |
| NFR-031 | Backup | Daily, retention 30 giorni |
| NFR-032 | Recovery | RTO < 4h, RPO < 1h |

### 9.5 Compatibilità

| NFR-ID | Requisito | Target |
|--------|-----------|--------|
| NFR-040 | Browsers | Chrome, Safari, Firefox, Edge (ultimi 2 anni) |
| NFR-041 | Mobile | Responsive design |
| NFR-042 | WhatsApp | Business API v18+ |

---

## 10. Flujos UX

### 10.1 Onboarding Merchant

```
[Landing Page]
     ↓
[Register] → Email, Password, Company Name
     ↓
[Verify Email] → Link in email
     ↓
[Setup 2FA] → Scan QR code
     ↓
[Create Workspace] → Name, Currency
     ↓
[Connect WhatsApp] → QR Code / API Key
     ↓
[Add First Product] → Guided wizard
     ↓
[Dashboard] ✓
```

### 10.2 Customer Purchase Flow

```
[WhatsApp Message] "Ciao"
     ↓
[Welcome] "Benvenuto! Cosa posso fare per te?"
     ↓
[Product Search] "Vorrei del vino rosso"
     ↓
[Show Results] Lista prodotti con prezzi
     ↓
[Add to Cart] "Prendo 2 Chianti"
     ↓
[Cart Confirm] "Carrello: 2x Chianti = €30. Confermi?"
     ↓
[Payment Link] "Ecco il link per pagare: [PayPal]"
     ↓
[Payment Complete] Webhook PayPal
     ↓
[Order Confirmed] "Ordine #123 confermato!"
```

### 10.3 Billing Flow

```
[Dashboard] → Billing Section
     ↓
[Current Balance] €15.50
     ↓
[Usage This Month] 150 messages, 5 orders
     ↓
[Recharge] → Select €50
     ↓
[PayPal Checkout]
     ↓
[Balance Updated] €65.50
```

---

## 11. Criterios de Aceptación

### AC-001: Chatbot risponde correttamente

```gherkin
GIVEN un cliente scrive "Avete prodotti bio?"
WHEN il messaggio è processato dal chatbot
THEN il chatbot risponde con lista prodotti con certificazione BIO
AND il tempo di risposta è < 5 secondi
AND la risposta è nella lingua del cliente
```

### AC-002: Ordine creato correttamente

```gherkin
GIVEN un carrello con 2 prodotti (€50 totale)
WHEN il cliente conferma l'ordine
THEN viene creato un ordine con status PENDING
AND viene generato un link di pagamento PayPal
AND il merchant riceve notifica
```

### AC-003: Credito scalato correttamente

```gherkin
GIVEN un owner con €20 di credito
WHEN il chatbot invia un messaggio WhatsApp (costo €0.10)
THEN il credito diventa €19.90
AND viene creata una transazione di tipo MESSAGE
```

### AC-004: Workspace isolation

```gherkin
GIVEN due workspace A e B con owner diversi
WHEN owner A richiede lista prodotti
THEN vede SOLO i prodotti del workspace A
AND non vede MAI i prodotti del workspace B
```

---

## 12. KPIs / Success Metrics

### Metriche di Business

| KPI | Descrizione | Target | Attuale |
|-----|-------------|--------|---------|
| **MRR** | Monthly Recurring Revenue | €10k | - |
| **Active Workspaces** | Workspace con attività negli ultimi 30gg | 100 | - |
| **Churn Rate** | % workspace disattivati/mese | < 5% | - |
| **ARPU** | Average Revenue Per User | €50/mese | - |

### Metriche di Prodotto

| KPI | Descrizione | Target | Attuale |
|-----|-------------|--------|---------|
| **Automation Rate** | % ordini senza intervento umano | > 80% | - |
| **Response Time** | Tempo medio risposta chatbot | < 3s | - |
| **Conversion Rate** | Ordini / Conversazioni | > 15% | - |
| **Error Rate** | % risposte chatbot errate | < 5% | - |

### Metriche Tecniche

| KPI | Descrizione | Target | Attuale |
|-----|-------------|--------|---------|
| **Uptime** | Disponibilità servizio | 99.9% | - |
| **API Latency** | p95 response time | < 200ms | - |
| **Error Rate** | % richieste fallite | < 0.1% | - |

---

## 13. Riesgos + Mitigación

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| **WhatsApp API changes** | Media | Alto | Abstraction layer, monitoring changelog |
| **LLM hallucinations** | Alta | Medio | Safety Agent, validation layer |
| **Cost overrun LLM** | Media | Medio | Rate limiting, caching, model switching |
| **Data breach** | Bassa | Alto | Encryption, audit, penetration test |
| **Scalability issues** | Media | Alto | Load testing, auto-scaling |
| **Competitor** | Alta | Medio | Feature velocity, customer success |

---

## 14. Planificación + Prioridades

### Priorità MoSCoW

| Priority | Features |
|----------|----------|
| **MUST** | Chatbot base, Products, Orders, Payments, Auth, Billing base |
| **SHOULD** | Multi-language, Offers, Team management, Analytics |
| **COULD** | Advanced analytics, Campaign automation, CRM integration |
| **WON'T** | Mobile app, Multi-channel (Instagram), Marketplace |

### Roadmap

| Quarter | Focus | Key Features |
|---------|-------|--------------|
| **Q4 2024** | Foundation | Core chatbot, Products, Orders, Basic billing |
| **Q1 2025** | Growth | Multi-language, Team features, Advanced billing |
| **Q2 2025** | Scale | Performance optimization, Enterprise features |
| **Q3 2025** | Expansion | New channels, Advanced analytics |

### Milestones Completati

- [x] Multi-agent LLM architecture (Feature 174)
- [x] 2FA Authentication (Feature 182)
- [x] Team Invitations (Feature 184)
- [x] Subscription Billing (Feature 185)
- [x] Scheduler Microservice (Feature 186)
- [x] Soft Delete (Feature 196)
- [x] Owner-based Billing (Feature 198)
- [x] Channel Wizard (Feature 199)
- [x] Storage Service (Local/Cloudinary) 
- [x] Invoice Generation (PDF)
- [x] Terraform Infrastructure
- [x] FAQ System Integration (January 2026) - Dynamic FAQ loading in CustomerSupportAgent
- [x] Price Visibility Control (Feature 174.2) - Hide prices for non-registered users

---

## 15. Architettura Tecnica

### Stack Tecnologico

| Layer | Tecnologia |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind + shadcn/ui |
| **Backend** | Node.js 18 + Express + Prisma ORM |
| **Database** | PostgreSQL |
| **AI** | OpenRouter (Claude, GPT-4) |
| **Auth** | JWT + TOTP (2FA) |
| **Payments** | PayPal API |
| **Messaging** | WhatsApp Business API |
| **Storage** | Local (dev) / Cloudinary (prod) |
| **PDF** | pdfkit |
| **Hosting** | Heroku |

### Struttura Monorepo

```
shopME/
├── apps/
│   ├── backend/         # API server (Express)
│   ├── frontend/        # Dashboard (React) - WIP
│   ├── backoffice/      # Admin panel (React)
│   └── scheduler/       # Cron jobs (Node)
├── packages/
│   └── database/        # Prisma schema (@echatbot/database)
├── docs/                # Documentation
│   ├── architecture/    # System design docs
│   ├── security/        # Security audits
│   ├── setup/           # Deployment guides
│   ├── prompts/         # LLM prompt templates
│   └── archived/        # Old specs & completed tasks
```

### Database Schema (Entità Principali)

```
User (Owner)
  ├── Workspaces (1:N)
  │     ├── Products (1:N)
  │     ├── Categories (1:N)
  │     ├── Customers (1:N)
  │     ├── Orders (1:N)
  │     └── AgentConfig (1:1)
  ├── CreditBalance
  ├── PlanType
  └── BillingTransactions (1:N)
```

---

## Appendice

### A. Glossario

| Termine | Definizione |
|---------|-------------|
| **Workspace** | Canale WhatsApp configurato (1 numero = 1 workspace) |
| **Owner** | Utente proprietario che paga per i workspace |
| **Agent** | Componente LLM specializzato (Router, Product, Safety, Translation) |
| **Credit** | Saldo prepagato per pagare i consumi |

### B. Documentation Reference

Tutta la documentazione attiva è in `/docs/`:

- `architecture/` - System design (billing, storage, multi-agent)
- `security/` - Security audits and reports
- `setup/` - Production deployment guides
- `prompts/` - LLM prompt templates
- `archived/specs/` - Historical feature specifications

---

*Documento generato e mantenuto dal team shopME. Per modifiche, aprire PR su GitHub.*
