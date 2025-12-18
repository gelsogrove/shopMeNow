import React, { createContext, useContext, useEffect, useState } from "react"

type Language = "it" | "en" | "es" | "pt"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
)

const translations = {
  it: {
    // Header
    "header.tagline":
      "Parla con i tuoi clienti attraverso la loro chat preferita",

    // Hero Section
    "hero.title": "Crea il tuo agente AI per WhatsApp",
    "hero.subtitle":
      "Porta un personal shopper dentro WhatsApp. eChatbot ascolta, qualifica, propone bundle, invia pagamenti e aggiorna i clienti senza mai uscire dalla chat.",
    "hero.whyTitle": "Perché eChatbot?",
    "hero.useCasesTitle": "Flussi pensati per il tuo team",
    "hero.useCases.sales.title": "Team commerciali",
    "hero.useCases.sales.desc":
      "Qualifica i lead, suggerisci assortimenti, invia link di pagamento e chiudi ordini in pochi minuti.",
    "hero.useCases.support.title": "Customer care",
    "hero.useCases.support.desc":
      "Filtra le FAQ, passa la conversazione all'operatore con tutto il contesto e registra ogni interazione.",
    "hero.useCases.ops.title": "Operazioni & logistica",
    "hero.useCases.ops.desc":
      "Sincronizza inventario, segui le fasi di evasione e invia aggiornamenti di trasporto in automatico.",

    // Features
    "features.pushNotifications": "Push Notifications",
    "features.pushNotifications.desc":
      "Campagne automatiche, follow-up e alert ordine via WhatsApp",
    "features.24x7": "24/7 Availability",
    "features.24x7.desc":
      "Un concierge che risponde, passa all'operatore e chiude ordini 24/7",
    "features.multiLanguage": "Multi-Language",
    "features.multiLanguage.desc":
      "Rispondi in oltre 30 lingue con traduzioni native e tono locale",
    "features.ecommerce": "E-commerce Platform",
    "features.ecommerce.desc":
      "Gestisci catalogo, inventario, ordini e clienti da un'unica control room",
    "features.analytics": "Analytics",
    "features.analytics.desc": "Monitora vendite e performance",

    // News Section
    "news.title": "Ultimi Aggiornamenti e Funzionalità",
    "news.subtitle": "Rimani informato sugli ultimi miglioramenti di eChatbot",
    "news.1.date": "15 Ottobre 2025",
    "news.1.title": "Supporto Multilingua",
    "news.1.category": "Lingue",
    "news.1.desc":
      "Siamo entusiasti di annunciare il supporto multilingua avanzato sulla nostra piattaforma! Comunica con i tuoi clienti in italiano, inglese, spagnolo e portoghese. Il nostro chatbot AI è stato addestrato per comprendere e rispondere naturalmente in più lingue, rilevando automaticamente la lingua preferita del cliente e mantenendo la stessa esperienza conversazionale di alta qualità in tutte le lingue. Espandi la tua attività a livello globale con una comunicazione multilingue senza interruzioni!",
    "news.2.date": "8 Ottobre 2025",
    "news.2.title": "Analisi Ricerca Prodotti",
    "news.2.category": "Analisi",
    "news.2.desc":
      "Presentiamo la nuova funzionalità di Analisi Ricerca Prodotti! Ora puoi analizzare quali prodotti i tuoi clienti cercano più frequentemente. Questa potente intuizione ti aiuta a comprendere la domanda dei clienti, ottimizzare il tuo inventario e identificare i prodotti di tendenza. Il dashboard di analisi fornisce grafici e report dettagliati che mostrano i modelli di ricerca, le parole chiave popolari e i tassi di conversione.",
    "news.3.date": "28 Settembre 2025",
    "news.3.title": "Orchestrazione Sell Agents",
    "news.3.category": "Sales Agents",
    "news.3.desc":
      "Abbiamo introdotto un orchestratore multi-agent per il team di Sell Agents! Configura agenti specializzati (catalogo, carrello, pagamenti, supporto umano) che collaborano nella stessa conversazione WhatsApp. eChatbot assegna automaticamente il compito all'agente giusto, condivide il contesto e registra i passaggi. Così ogni cliente parla sempre con il professionista più adatto e il tuo team chiude più velocemente.",
    "news.4.date": "20 Settembre 2025",
    "news.4.title": "Invia Notifiche Push",
    "news.4.category": "Marketing",
    "news.4.desc":
      "Lancia campagne di marketing mirate con la nostra nuova funzionalità di Notifiche Push! Invia messaggi promozionali, offerte speciali e aggiornamenti direttamente ai tuoi clienti tramite WhatsApp. Crea campagne con messaggi personalizzati, programma gli invii per il momento ottimale e traccia i tassi di consegna e il coinvolgimento dei clienti. Perfetto per annunciare nuovi prodotti, vendite flash o aggiornamenti importanti per mantenere i tuoi clienti informati e coinvolti.",

    // Pricing
    "pricing.title": "Scegli il Tuo Piano",
    "pricing.subtitle": "Inizia gratis e scala mentre cresci",
    "pricing.free.desc": "Per testare la piattaforma",
    "pricing.free.creditDesc":
      "I primi €19 per provare la piattaforma li offriamo noi.",
    "pricing.basic.desc": "Per aziende in crescita",
    "pricing.premium.desc": "Per aziende consolidate",
    "pricing.enterprise.desc": "Per operazioni su larga scala",
    "pricing.usage.title":
      "Le seguenti tariffe a consumo sono aggiuntive e si applicano a tutti i piani",
    "pricing.usage.message": "per Messaggio",
    "pricing.usage.message.desc":
      "Scalato dal tuo credito (risposte AI)",
    "pricing.usage.customer": "per Nuovo Cliente",
    "pricing.usage.customer.desc": "Ogni nuova registrazione cliente",
    "pricing.usage.push": "per messaggio Push",
    "pricing.usage.push.desc": "Ogni messaggio promozionale inviato",
    "pricing.features.channels": "Canali WhatsApp",
    "pricing.features.channel": "Canale WhatsApp",
    "pricing.features.products": "Prodotti",
    "pricing.features.clients": "Clienti/Leads",
    "pricing.features.support": "Supporto",
    "pricing.features.analytics": "Analisi e Report Avanzati",
    "pricing.features.branding": "Personalizzazione Brand",
    "pricing.features.integration": "Integrazione con CRM / database",
    "pricing.features.unlimited": "Illimitati",
    "pricing.features.upto": "Fino a",
    "pricing.features.priority": "Supporto Prioritario 24/7",
    "pricing.button.start": "Inizia",
    "pricing.button.startWithCredit": "Inizia con il tuo Credito",
    "pricing.button.contact": "Contatta Vendite",
    "pricing.simulator.button": "Calcola il Tuo Costo Mensile",
    "pricing.simulator.description":
      "Scopri quanto spenderesti in base al tuo uso reale",
    "pricing.simulator.title": "Simulatore di Prezzo",
    "pricing.simulator.subtitle":
      "Configura il tuo uso mensile e scopri il costo stimato",
    "pricing.simulator.totalProducts": "Quanti prodotti hai?",
    "pricing.simulator.totalProducts.help":
      "📦 Il numero di prodotti nel tuo catalogo",
    "pricing.simulator.totalCustomers": "Quanti clienti hai in totale?",
    "pricing.simulator.totalCustomers.help":
      "📊 Questo numero aiuta a suggerire valori realistici per messaggi, nuovi clienti e supporto",
    "pricing.simulator.channels": "Quanti canali WhatsApp vuoi creare?",
    "pricing.simulator.messages": "Ipotesi di messaggi al mese",
    "pricing.simulator.newCustomers": "Ipotesi di nuovi clienti al mese",
    "pricing.simulator.newOrders": "Ipotesi di nuovi ordini al mese",
    "pricing.simulator.pushCampaigns": "Messaggi Pubblicitari al mese",
    "pricing.simulator.extras": "Extra",
    "pricing.simulator.branding": "Personalizzazione Brand",
    "pricing.simulator.branding.desc": "Il tuo logo e colori",
    "pricing.simulator.dedicatedServer": "Server Dedicato",
    "pricing.simulator.dedicatedServer.desc": "Dominio personalizzato",
    "pricing.simulator.summary": "Riepilogo",
    "pricing.simulator.plan": "Piano",
    "pricing.simulator.usageCosts": "Costi per Uso",
    "pricing.simulator.monthlyTotal": "Totale Mensile",
    "pricing.simulator.estimated": "stimato",
    "pricing.simulator.transparent":
      "💡 Costi trasparenti basati sul consumo reale",
    "pricing.simulator.suggestion": "💡 Suggerimento",
    "pricing.simulator.suggestion.messages": "~30% dei clienti",
    "pricing.simulator.suggestion.newCustomers": "~10% crescita",
    "pricing.simulator.suggestion.pushCampaigns": "campagne/mese",
    "pricing.simulator.price.perPushMessage": "per messaggio pubblicitario",
    "pricing.simulator.cta.free": "Inizia Prova Gratuita",
    "pricing.simulator.cta.plan": "Scegli",

    // Billing Section
    "billing.pageTitle": "Subscription & Credit",
    "billing.pageDescription": "Manage your subscription and credit",
    "billing.sectionTitle": "Subscription & Credit",
    "billing.sectionDescription": "Manage your subscription and credit",
    "billing.yourPlan": "Your Plan",
    "billing.availableCredit": "Available Credit",
    "billing.lowCredit": "Low Credit",
    "billing.lowCreditWarning": "Low credit! Recharge to avoid interruptions.",
    "billing.daysRemaining": "days remaining in trial",
    "billing.trialExpired": "Trial Expired",
    "billing.trialExpiredWarning": "Trial expired! Choose a plan to continue.",
    "billing.trialExpiredMessage": "Your trial period has expired",
    "billing.trialExpiredAction": "Choose a plan to continue using eChatbot",
    "billing.choosePlan": "Choose a Plan",
    "billing.clickToManage": "Click to manage billing",
    "billing.rechargeCredit": "Recharge Credit",
    "billing.planDetails": "Plan Details",
    "billing.subscription": "Subscription",
    "billing.free": "Free",
    "billing.perMonth": "/month",
    "billing.messageCost": "Message cost",
    "billing.orderCost": "Order cost",
    "billing.nextRenewal": "Next renewal",
    "billing.upgradePlan": "Upgrade Plan",
    "billing.usage": "Usage",
    "billing.usageDescription": "Limits of your {plan} plan",
    "billing.products": "Products",
    "billing.customers": "Customers",
    "billing.channels": "Channels",
    "billing.transactionHistory": "Transaction History",
    "billing.rechargeTitle": "Recharge Credit",
    "billing.rechargeDescription": "Select an amount or enter a custom amount (min €10, max €1000)",
    "billing.customAmount": "Custom amount",
    "billing.processing": "Processing...",
    "billing.recharge": "Recharge",
    "billing.upgradeTitle": "Upgrade Plan",
    "billing.upgradeDescription": "Choose a plan that better suits your needs",
    "billing.currentPlan": "Current Plan",
    "billing.upgrade": "Upgrade",
    "billing.upgrading": "Upgrading...",
    "billing.historyTitle": "Transaction History",
    "billing.historyDescription": "Recent transactions of your account",
    "billing.noTransactions": "No transactions yet",
    "billing.loadMore": "Load More",
    "billing.transactionTypes.MESSAGE": "Message",
    "billing.transactionTypes.PUSH_NOTIFICATION": "Push Notification",
    "billing.transactionTypes.RECHARGE": "Recharge",
    "billing.transactionTypes.MONTHLY_FEE": "Monthly Fee",
    "billing.transactionTypes.UPGRADE_FEE": "Upgrade Fee",
    "billing.transactionTypes.ADJUSTMENT": "Adjustment",
    "billing.transactionTypes.INITIAL_CREDIT": "Initial Credit",

    // Contact
    "contact.title": "Pronto per Iniziare?",
    "contact.subtitle":
      "Unisciti a migliaia di aziende che vendono già su WhatsApp",
    "contact.cta": "Inizia la Prova Gratuita",

    // Footer
    "footer.tagline": "Trasforma WhatsApp nel tuo negozio online",
    "footer.company": "Azienda",
    "footer.about": "Chi Siamo",
    "footer.careers": "Carriere",
    "footer.contact": "Contattaci",
    "footer.support": "Supporto",
    "footer.docs": "Documentazione",
    "footer.help": "Centro Assistenza",
    "footer.legal": "Legale",
    "footer.privacy": "Privacy Policy",
    "footer.terms": "Termini di Servizio",
    "footer.rights": "Tutti i diritti riservati",

    // Login
    "login.title": "Accedi al tuo account",
    "login.email": "Email",
    "login.password": "Password",
    "login.forgot": "Password dimenticata?",
    "login.button": "Accedi",
    "login.noAccount": "Non hai un account?",
    "login.signup": "Registrati",
    "login.signin": "Login",
    "login.register": "Registrati",
    "login.welcomeBack": "Bentornato",
    "login.forgotPassword": "Password dimenticata?",
    "login.signingIn": "Accesso in corso...",
    "login.orContinueWith": "Oppure continua con",

    // Register
    "register.createAccount": "Crea Account",
    "register.passwordHint": "Min 8 caratteri, maiuscola, minuscola, numero, carattere speciale",
    "register.creatingAccount": "Creazione account...",
    "register.gdprAccept": "Accetto la",
    "register.privacyPolicy": "Privacy Policy",
    "register.and": "e i",
    "register.termsOfService": "Termini di Servizio",

    // Form
    "form.email": "Email",
    "form.password": "Password",
    "form.firstName": "Nome",
    "form.lastName": "Cognome",
    "form.confirmPassword": "Conferma Password",
    "form.error.invalidEmail": "Indirizzo email non valido",

    // Forgot Password
    "forgotPassword.title": "Reimposta Password",
    "forgotPassword.subtitle": "Inserisci la tua email per reimpostare la password",
    "forgotPassword.email.placeholder": "admin@echatbot.ai",
    "forgotPassword.button": "Reimposta Password",
    "forgotPassword.backToLogin": "Torna al Login",
    "forgotPassword.success": "Se questa email è registrata, riceverai le istruzioni per reimpostare la password. Controlla la tua casella di posta e segui il link per reimpostare la password.",
    "forgotPassword.error": "Si è verificato un errore",

    // Reset Password
    "resetPassword.title": "Reimposta Password",
    "resetPassword.subtitle": "Inserisci la tua nuova password",
    "resetPassword.newPassword": "Nuova Password",
    "resetPassword.newPassword.placeholder": "Inserisci la nuova password",
    "resetPassword.confirmPassword": "Conferma Password",
    "resetPassword.confirmPassword.placeholder": "Conferma la nuova password",
    "resetPassword.button": "Reimposta Password",
    "resetPassword.button.loading": "Reimpostazione...",
    "resetPassword.success": "Password reimpostata con successo! Reindirizzamento al login...",
    "resetPassword.invalidLink": "Link di Reimpostazione Non Valido",
    "resetPassword.invalidLink.desc": "Il link di reimpostazione password non è valido o è scaduto",
    "resetPassword.requestNew": "Richiedi un nuovo link di reimpostazione",
    "resetPassword.error.mismatch": "Le password non corrispondono",
    "resetPassword.error.minLength": "La password deve essere di almeno 8 caratteri",
    "resetPassword.error.strength": "La password deve contenere almeno una lettera maiuscola, una lettera minuscola, un numero e un carattere speciale",

    // Auth Errors
    "auth.error.invalid6DigitCode": "Inserisci un codice valido a 6 cifre",
    "auth.error.invalidRecoveryCode": "Inserisci un codice di recupero valido",
    "auth.error.invalidVerificationLink": "Link di verifica non valido. Effettua nuovamente il login.",
    "auth.error.accountLocked": "Account bloccato a causa di troppi tentativi falliti",
    "auth.error.invalidCode": "Codice di verifica non valido",

    // Setup 2FA Page
    "setup2fa.title": "Configura l'Autenticazione a Due Fattori",
    "setup2fa.scanDescription": "Scansiona il codice QR con la tua app di autenticazione",
    "setup2fa.useAuthenticatorApp": "Usa un'app di autenticazione",
    "setup2fa.recommended": "Consigliato: Google Authenticator, Microsoft Authenticator o Authy",
    "setup2fa.howToSetup": "Come configurare:",
    "setup2fa.step1": "Apri la tua app di autenticazione",
    "setup2fa.step2": "Tocca \"+\" o \"Aggiungi account\"",
    "setup2fa.step3": "Scansiona questo codice QR",
    "setup2fa.step4": "Inserisci il codice a 6 cifre qui sotto",
    "setup2fa.scannedButton": "Ho scansionato il codice",
    "setup2fa.verifyTitle": "Verifica la Configurazione",
    "setup2fa.verifyDescription": "Inserisci il codice a 6 cifre dalla tua app di autenticazione",
    "setup2fa.verificationCode": "Codice di Verifica",
    "setup2fa.codeRefreshes": "Il codice si aggiorna ogni 30 secondi. Inserisci il codice corrente dalla tua app.",
    "setup2fa.verifying": "Verificando...",
    "setup2fa.verifyAndContinue": "Verifica e Continua",
    "setup2fa.backToQR": "Torna al Codice QR",
    "setup2fa.saveRecoveryTitle": "Salva i Tuoi Codici di Recupero",
    "setup2fa.saveRecoveryDescription": "Conserva questi codici in un luogo sicuro. Ti serviranno per accedere al tuo account se perdi il dispositivo di autenticazione.",
    "setup2fa.important": "Importante!",
    "setup2fa.recoveryCodeWarning": "Ogni codice di recupero può essere usato solo una volta. Dopo l'uso, il codice sarà invalidato.",
    "setup2fa.copyCodes": "Copia Codici",
    "setup2fa.copied": "Copiato!",
    "setup2fa.download": "Scarica",
    "setup2fa.savedContinue": "Ho Salvato i Miei Codici - Continua",
    "setup2fa.stepScan": "Scansiona",
    "setup2fa.stepVerify": "Verifica",
    "setup2fa.stepSaveCodes": "Salva Codici",
    "setup2fa.skipLogin": "Salta e accedi più tardi",

    // Privacy Policy
    "privacy.title": "Privacy Policy",
    "privacy.lastUpdate": "Ultimo aggiornamento",
    "privacy.intro": "eChatbot si impegna a proteggere la tua privacy. Questa Privacy Policy spiega come raccogliamo, utilizziamo e proteggiamo i tuoi dati personali.",
    "privacy.collection.title": "1. Informazioni che Raccogliamo",
    "privacy.collection.desc": "Raccogliamo informazioni che ci fornisci direttamente, inclusi nome, email, numero di telefono e dettagli commerciali quando crei un account o utilizzi i nostri servizi.",
    "privacy.usage.title": "2. Come Utilizziamo le Tue Informazioni",
    "privacy.usage.desc": "Utilizziamo le tue informazioni per fornire e migliorare i nostri servizi, elaborare transazioni, inviare comunicazioni importanti e personalizzare la tua esperienza.",
    "privacy.sharing.title": "3. Condivisione delle Informazioni",
    "privacy.sharing.desc": "Non vendiamo i tuoi dati personali. Possiamo condividere informazioni con fornitori di servizi fidati che ci aiutano a gestire la nostra piattaforma, sempre in conformità con questa policy.",
    "privacy.security.title": "4. Sicurezza dei Dati",
    "privacy.security.desc": "Implementiamo misure di sicurezza standard del settore per proteggere i tuoi dati personali da accesso non autorizzato, alterazione o divulgazione.",
    "privacy.rights.title": "5. I Tuoi Diritti",
    "privacy.rights.desc": "Hai il diritto di accedere, correggere o eliminare i tuoi dati personali. Puoi anche opporti a determinati trattamenti dei dati o richiedere la portabilità dei dati.",
    "privacy.cookies.title": "6. Cookie e Tecnologie di Tracciamento",
    "privacy.cookies.desc": "Utilizziamo cookie e tecnologie simili per migliorare la tua esperienza, analizzare l'utilizzo e personalizzare i contenuti. Puoi gestire le preferenze dei cookie nelle impostazioni del browser.",
    "privacy.contact.title": "7. Contattaci",
    "privacy.contact.desc": "Per domande su questa Privacy Policy o sulle nostre pratiche di gestione dei dati, contattaci all'indirizzo privacy@echatbot.ai",

    // Terms of Service
    "terms.title": "Termini di Servizio",
    "terms.lastUpdate": "Ultimo aggiornamento",
    "terms.intro": "Benvenuto su eChatbot. Utilizzando i nostri servizi, accetti di essere vincolato da questi Termini di Servizio.",
    "terms.acceptance.title": "1. Accettazione dei Termini",
    "terms.acceptance.desc": "Accedendo e utilizzando eChatbot, accetti di essere vincolato da questi Termini di Servizio e dalla nostra Privacy Policy. Se non accetti questi termini, non utilizzare i nostri servizi.",
    "terms.services.title": "2. Descrizione dei Servizi",
    "terms.services.desc": "eChatbot fornisce una piattaforma e-commerce integrata con WhatsApp che consente alle aziende di gestire prodotti, elaborare ordini e comunicare con i clienti tramite agenti AI.",
    "terms.account.title": "3. Account Utente",
    "terms.account.desc": "Devi creare un account per utilizzare eChatbot. Sei responsabile di mantenere la sicurezza del tuo account e password. Devi avere almeno 18 anni per utilizzare i nostri servizi.",
    "terms.conduct.title": "4. Condotta dell'Utente",
    "terms.conduct.desc": "Accetti di non utilizzare eChatbot per scopi illegali, di non violare i diritti di terzi e di rispettare tutte le leggi applicabili. Ci riserviamo il diritto di sospendere o terminare account che violano questi termini.",
    "terms.payment.title": "5. Pagamenti e Fatturazione",
    "terms.payment.desc": "I prezzi sono basati sul tuo piano di abbonamento e sull'utilizzo. I pagamenti vengono elaborati mensilmente. Puoi annullare l'abbonamento in qualsiasi momento, ma i rimborsi non sono disponibili per i periodi di servizio già fatturati.",
    "terms.ip.title": "6. Proprietà Intellettuale",
    "terms.ip.desc": "Tutti i contenuti e la tecnologia di eChatbot sono di proprietà di eChatbot o dei suoi licenziatari. Mantieni la proprietà dei tuoi contenuti, ma ci concedi una licenza per utilizzarli per fornire i nostri servizi.",
    "terms.termination.title": "7. Risoluzione",
    "terms.termination.desc": "Possiamo sospendere o terminare il tuo accesso a eChatbot in qualsiasi momento per violazione di questi termini o per altri motivi legittimi. Puoi terminare il tuo account in qualsiasi momento dalle impostazioni del tuo account.",
    "terms.limitation.title": "8. Limitazione di Responsabilità",
    "terms.limitation.desc": "eChatbot viene fornito 'così com'è'. Non forniamo garanzie di alcun tipo. La nostra responsabilità è limitata all'importo che hai pagato nell'ultimo mese.",
    "terms.changes.title": "9. Modifiche ai Termini",
    "terms.changes.desc": "Possiamo aggiornare questi termini periodicamente. Ti informeremo di modifiche significative via email o tramite notifica sulla piattaforma. L'utilizzo continuato costituisce accettazione dei termini aggiornati.",
    "terms.contact.title": "10. Contattaci",
    "terms.contact.desc": "Per domande su questi Termini di Servizio, contattaci all'indirizzo legal@echatbot.ai",
  },
  en: {
    // Header
    "header.tagline": "Talk to your customers through their favorite chat",

    // Hero Section
    "hero.title": "Is the way to sell changing?",
    "hero.subtitle":
      "Bring a personal shopper into WhatsApp. eChatbot listens, qualifies, recommends bundles, pushes payments, and keeps customers updated without leaving the chat.",
    "hero.whyTitle": "Why eChatbot?",
    "hero.useCasesTitle": "Tailored workflows for your team",
    "hero.useCases.sales.title": "Sales teams",
    "hero.useCases.sales.desc":
      "Qualify leads, recommend assortments, send payment links, and close orders in minutes.",
    "hero.useCases.support.title": "Customer support",
    "hero.useCases.support.desc":
      "Triage FAQs, escalate to humans with full context, and keep every conversation logged.",
    "hero.useCases.ops.title": "Operations & logistics",
    "hero.useCases.ops.desc":
      "Sync inventory, follow fulfillment steps, and trigger transport updates automatically.",

    // Features
    "features.pushNotifications": "Push Notifications",
    "features.pushNotifications.desc": "Automated drops, re-engagement flows, and order alerts delivered on WhatsApp",
    "features.24x7": "24/7 Availability",
    "features.24x7.desc": "A concierge that never sleeps—resolves FAQs, escalates to humans, and closes orders around the clock",
    "features.multiLanguage": "Multi-Language",
    "features.multiLanguage.desc": "Respond instantly in 30+ languages with native-sounding translations and local phrasing",
    "features.ecommerce": "E-commerce Platform",
    "features.ecommerce.desc": "Control catalog, inventory, orders, and customer timelines from a single WhatsApp-ready dashboard",
    "features.analytics": "Analytics",
    "features.analytics.desc": "Monitor sales and performance",

    // News Section
    "news.title": "Latest Updates and Features",
    "news.subtitle": "Stay informed about the latest eChatbot improvements",
    "news.1.date": "October 15, 2025",
    "news.1.title": "Multilanguage Support",
    "news.1.category": "Languages",
    "news.1.desc":
      "We're excited to announce enhanced multilanguage support on our platform! Communicate with your customers in Italian, English, Spanish, and Portuguese. Our AI chatbot has been trained to understand and respond naturally in multiple languages, automatically detecting the customer's preferred language and maintaining the same high-quality conversational experience across all languages. Expand your business globally with seamless multilingual communication!",
    "news.2.date": "October 5, 2025",
    "news.2.title": "Product Search Analytics",
    "news.2.category": "Analytics",
    "news.2.desc":
      "Introducing the new Product Search Analytics feature! Now you can analyze which products your customers search for most frequently. This powerful insight helps you understand customer demand, optimize your inventory, and identify trending products. The analytics dashboard provides detailed charts and reports showing search patterns, popular keywords, and conversion rates.",
    "news.3.date": "September 28, 2025",
    "news.3.title": "Sell Agents Team Orchestration",
    "news.3.category": "Sales Agents",
    "news.3.desc":
      "Meet our multi-agent orchestrator for Sales Teams! Configure dedicated agents for catalog discovery, cart management, checkout, and human assistance. eChatbot routes each customer request to the right specialist, shares context between agents, and logs the entire workflow. Your customers always talk to the best-suited expert while your team focuses on closing more deals.",
    "news.4.date": "September 20, 2025",
    "news.4.title": "Send Push Notifications",
    "news.4.category": "Marketing",
    "news.4.desc":
      "Launch targeted marketing campaigns with our new Push Notifications feature! Send promotional messages, special offers, and updates directly to your customers via WhatsApp. Create campaigns with custom messages, schedule sends for optimal timing, and track delivery rates and customer engagement. Perfect for announcing new products, flash sales, or important updates to keep your customers informed and engaged.",

    // Pricing
    "pricing.title": "Choose Your Plan",
    "pricing.subtitle": "Start free and scale as you grow",
    "pricing.free.desc": "For testing the platform",
    "pricing.free.creditDesc":
      "We offer you the first €19 to test the platform.",
    "pricing.basic.desc": "For growing businesses",
    "pricing.premium.desc": "For established businesses",
    "pricing.enterprise.desc": "For large-scale operations",
    "pricing.usage.title":
      "The following usage-based fees are additional and apply to all plans",
    "pricing.usage.message": "per Message",
    "pricing.usage.message.desc": "Deducted from your credit (AI responses)",
    "pricing.usage.customer": "per New Customer",
    "pricing.usage.customer.desc": "Each new customer registration",
    "pricing.usage.order": "per New Order",
    "pricing.usage.order.desc": "Each completed order",
    "pricing.usage.push": "per Push message",
    "pricing.usage.push.desc": "Each promotional message sent",
    "pricing.features.channels": "WhatsApp Channels",
    "pricing.features.channel": "WhatsApp Channel",
    "pricing.features.products": "Products",
    "pricing.features.clients": "Customers/Leads",
    "pricing.features.support": "Support",
    "pricing.features.analytics": "Advanced Analytics & Reports",
    "pricing.features.branding": "Custom Branding",
    "pricing.features.integration": "Integration with CRM / database",
    "pricing.features.unlimited": "Unlimited",
    "pricing.features.upto": "Up to",
    "pricing.features.priority": "24/7 Priority Support",
    "pricing.button.start": "Start",
    "pricing.button.startWithCredit": "Start with your Credit",
    "pricing.button.contact": "Contact Sales",
    "pricing.simulator.button": "Calculate Your Monthly Cost",
    "pricing.simulator.description":
      "Discover what you would spend based on your actual usage",
    "pricing.simulator.title": "Pricing Simulator",
    "pricing.simulator.subtitle":
      "Configure your monthly usage and discover the estimated cost",
    "pricing.simulator.totalProducts": "How many products do you have?",
    "pricing.simulator.totalProducts.help":
      "📦 The number of products in your catalog",
    "pricing.simulator.totalCustomers":
      "How many customers do you have in total?",
    "pricing.simulator.totalCustomers.help":
      "📊 This number helps suggest realistic values for messages, new customers and support",
    "pricing.simulator.channels":
      "How many WhatsApp channels do you want to create?",
    "pricing.simulator.messages": "Estimated messages per month",
    "pricing.simulator.newCustomers": "Estimated new customers per month",
    "pricing.simulator.newOrders": "Estimated new orders per month",
    "pricing.simulator.pushCampaigns": "Advertising Messages per month",
    "pricing.simulator.extras": "Extras",
    "pricing.simulator.branding": "Brand Customization",
    "pricing.simulator.branding.desc": "Your logo and colors",
    "pricing.simulator.dedicatedServer": "Dedicated Server",
    "pricing.simulator.dedicatedServer.desc": "Custom domain",
    "pricing.simulator.summary": "Summary",
    "pricing.simulator.plan": "Plan",
    "pricing.simulator.usageCosts": "Usage Costs",
    "pricing.simulator.monthlyTotal": "Monthly Total",
    "pricing.simulator.estimated": "estimated",
    "pricing.simulator.transparent":
      "💡 Transparent costs based on actual consumption",
    "pricing.simulator.suggestion": "💡 Suggestion",
    "pricing.simulator.suggestion.messages": "~30% of customers",
    "pricing.simulator.suggestion.newCustomers": "~10% growth",
    "pricing.simulator.suggestion.pushCampaigns": "campaigns/month",
    "pricing.simulator.price.perPushMessage": "per advertising message",
    "pricing.simulator.cta.free": "Start Free Trial",
    "pricing.simulator.cta.plan": "Choose",

    // Billing Section
    "billing.pageTitle": "Subscription & Credit",
    "billing.pageDescription": "Manage your subscription and credit",
    "billing.sectionTitle": "Subscription & Credit",
    "billing.sectionDescription": "Manage your subscription and credit",
    "billing.yourPlan": "Your Plan",
    "billing.availableCredit": "Available Credit",
    "billing.lowCredit": "Low Credit",
    "billing.lowCreditWarning": "Low credit! Recharge to avoid interruptions.",
    "billing.daysRemaining": "days remaining in trial",
    "billing.trialExpired": "Trial Expired",
    "billing.trialExpiredWarning": "Trial expired! Choose a plan to continue.",
    "billing.trialExpiredMessage": "Your trial period has expired",
    "billing.trialExpiredAction": "Choose a plan to continue using eChatbot",
    "billing.choosePlan": "Choose a Plan",
    "billing.clickToManage": "Click to manage billing",
    "billing.rechargeCredit": "Recharge Credit",
    "billing.planDetails": "Plan Details",
    "billing.subscription": "Subscription",
    "billing.free": "Free",
    "billing.perMonth": "/month",
    "billing.messageCost": "Message cost",
    "billing.orderCost": "Order cost",
    "billing.nextRenewal": "Next renewal",
    "billing.upgradePlan": "Upgrade Plan",
    "billing.usage": "Usage",
    "billing.usageDescription": "Limits of your {plan} plan",
    "billing.products": "Products",
    "billing.customers": "Customers",
    "billing.channels": "Channels",
    "billing.transactionHistory": "Transaction History",
    "billing.rechargeTitle": "Recharge Credit",
    "billing.rechargeDescription": "Select an amount or enter a custom amount (min €10, max €1000)",
    "billing.customAmount": "Custom amount",
    "billing.processing": "Processing...",
    "billing.recharge": "Recharge",
    "billing.upgradeTitle": "Upgrade Plan",
    "billing.upgradeDescription": "Choose a plan that better suits your needs",
    "billing.currentPlan": "Current Plan",
    "billing.upgrade": "Upgrade",
    "billing.upgrading": "Upgrading...",
    "billing.historyTitle": "Transaction History",
    "billing.historyDescription": "Recent transactions of your account",
    "billing.noTransactions": "No transactions yet",
    "billing.loadMore": "Load More",
    "billing.transactionTypes.MESSAGE": "Message",
    "billing.transactionTypes.PUSH_NOTIFICATION": "Push Notification",
    "billing.transactionTypes.RECHARGE": "Recharge",
    "billing.transactionTypes.MONTHLY_FEE": "Monthly Fee",
    "billing.transactionTypes.UPGRADE_FEE": "Upgrade Fee",
    "billing.transactionTypes.ADJUSTMENT": "Adjustment",
    "billing.transactionTypes.INITIAL_CREDIT": "Initial Credit",

    // Contact
    "contact.title": "Ready to Get Started?",
    "contact.subtitle":
      "Join thousands of businesses already selling on WhatsApp",
    "contact.cta": "Start Free Trial",

    // Footer
    "footer.tagline": "Transform WhatsApp into your online store",
    "footer.company": "Company",
    "footer.about": "About Us",
    "footer.careers": "Careers",
    "footer.contact": "Contact Us",
    "footer.support": "Support",
    "footer.docs": "Documentation",
    "footer.help": "Help Center",
    "footer.legal": "Legal",
    "footer.privacy": "Privacy Policy",
    "footer.terms": "Terms of Service",
    "footer.rights": "All rights reserved",

    // Login
    "login.title": "Sign in to your account",
    "login.email": "Email",
    "login.password": "Password",
    "login.forgot": "Forgot password?",
    "login.button": "Sign In",
    "login.noAccount": "Don't have an account?",
    "login.signup": "Sign up",
    "login.signin": "Login",
    "login.register": "Register",
    "login.welcomeBack": "Login",
    "login.forgotPassword": "Forgot password?",
    "login.signingIn": "Signing in...",
    "login.orContinueWith": "Or continue with",

    // Register
    "register.createAccount": "Create Account",
    "register.passwordHint": "Min 8 characters, uppercase, lowercase, number, special char",
    "register.creatingAccount": "Creating account...",
    "register.gdprAccept": "I accept the",
    "register.privacyPolicy": "Privacy Policy",
    "register.and": "and",
    "register.termsOfService": "Terms of Service",

    // Form
    "form.email": "Email",
    "form.password": "Password",
    "form.firstName": "First Name",
    "form.lastName": "Last Name",
    "form.confirmPassword": "Confirm Password",
    "form.error.invalidEmail": "Invalid email address",

    // Forgot Password
    "forgotPassword.title": "Reset Password",
    "forgotPassword.subtitle": "Enter your email to reset your password",
    "forgotPassword.email.placeholder": "admin@echatbot.ai",
    "forgotPassword.button": "Reset Password",
    "forgotPassword.backToLogin": "Back to Login",
    "forgotPassword.success": "If this email is registered, password reset instructions have been sent to your inbox. Please check your email and follow the link to reset your password.",
    "resetPassword.error": "An error occurred",

    // Reset Password
    "resetPassword.title": "Reset Password",
    "resetPassword.subtitle": "Enter your new password",
    "resetPassword.newPassword": "New Password",
    "resetPassword.newPassword.placeholder": "Enter new password",
    "resetPassword.confirmPassword": "Confirm Password",
    "resetPassword.confirmPassword.placeholder": "Confirm new password",
    "resetPassword.button": "Reset Password",
    "resetPassword.button.loading": "Resetting...",
    "resetPassword.success": "Password reset successful! Redirecting to login...",
    "resetPassword.invalidLink": "Invalid Reset Link",
    "resetPassword.invalidLink.desc": "The password reset link is invalid or has expired",
    "resetPassword.requestNew": "Request a new reset link",
    "resetPassword.error.mismatch": "Passwords do not match",
    "resetPassword.error.minLength": "Password must be at least 8 characters",
    "resetPassword.error.strength": "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character",

    // Auth Errors
    "auth.error.invalid6DigitCode": "Please enter a valid 6-digit code",
    "auth.error.invalidRecoveryCode": "Please enter a valid recovery code",
    "auth.error.invalidVerificationLink": "Invalid verification link. Please login again.",
    "auth.error.accountLocked": "Account locked due to too many failed attempts",
    "auth.error.invalidCode": "Invalid verification code",

    // Setup 2FA Page
    "setup2fa.title": "Setup Two-Factor Authentication",
    "setup2fa.scanDescription": "Scan the QR code with your authenticator app",
    "setup2fa.useAuthenticatorApp": "Use an authenticator app",
    "setup2fa.recommended": "Recommended: Google Authenticator, Microsoft Authenticator, or Authy",
    "setup2fa.howToSetup": "How to setup:",
    "setup2fa.step1": "Open your authenticator app",
    "setup2fa.step2": "Tap \"+\" or \"Add account\"",
    "setup2fa.step3": "Scan this QR code",
    "setup2fa.step4": "Enter the 6-digit code below",
    "setup2fa.scannedButton": "I've scanned the code",
    "setup2fa.verifyTitle": "Verify Your Setup",
    "setup2fa.verifyDescription": "Enter the 6-digit code from your authenticator app",
    "setup2fa.verificationCode": "Verification Code",
    "setup2fa.codeRefreshes": "The code refreshes every 30 seconds. Enter the current code from your app.",
    "setup2fa.verifying": "Verifying...",
    "setup2fa.verifyAndContinue": "Verify and Continue",
    "setup2fa.backToQR": "Back to QR Code",
    "setup2fa.saveRecoveryTitle": "Save Your Recovery Codes",
    "setup2fa.saveRecoveryDescription": "Store these codes in a safe place. You'll need them to access your account if you lose your authenticator device.",
    "setup2fa.important": "Important!",
    "setup2fa.recoveryCodeWarning": "Each recovery code can only be used once. After using a code, it will be invalidated.",
    "setup2fa.copyCodes": "Copy Codes",
    "setup2fa.copied": "Copied!",
    "setup2fa.download": "Download",
    "setup2fa.savedContinue": "I've Saved My Codes - Continue",
    "setup2fa.stepScan": "Scan",
    "setup2fa.stepVerify": "Verify",
    "setup2fa.stepSaveCodes": "Save Codes",
    "setup2fa.skipLogin": "Skip and login later",

    // Privacy Policy
    "privacy.title": "Privacy Policy",
    "privacy.lastUpdate": "Last updated",
    "privacy.intro": "eChatbot is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and protect your personal data.",
    "privacy.collection.title": "1. Information We Collect",
    "privacy.collection.desc": "We collect information you provide directly to us, including name, email, phone number, and business details when you create an account or use our services.",
    "privacy.usage.title": "2. How We Use Your Information",
    "privacy.usage.desc": "We use your information to provide and improve our services, process transactions, send important communications, and personalize your experience.",
    "privacy.sharing.title": "3. Information Sharing",
    "privacy.sharing.desc": "We do not sell your personal data. We may share information with trusted service providers who help us operate our platform, always in compliance with this policy.",
    "privacy.security.title": "4. Data Security",
    "privacy.security.desc": "We implement industry-standard security measures to protect your personal data from unauthorized access, alteration, or disclosure.",
    "privacy.rights.title": "5. Your Rights",
    "privacy.rights.desc": "You have the right to access, correct, or delete your personal data. You can also object to certain data processing or request data portability.",
    "privacy.cookies.title": "6. Cookies and Tracking Technologies",
    "privacy.cookies.desc": "We use cookies and similar technologies to improve your experience, analyze usage, and personalize content. You can manage cookie preferences in your browser settings.",
    "privacy.contact.title": "7. Contact Us",
    "privacy.contact.desc": "For questions about this Privacy Policy or our data handling practices, contact us at privacy@echatbot.ai",

    // Terms of Service
    "terms.title": "Terms of Service",
    "terms.lastUpdate": "Last updated",
    "terms.intro": "Welcome to eChatbot. By using our services, you agree to be bound by these Terms of Service.",
    "terms.acceptance.title": "1. Acceptance of Terms",
    "terms.acceptance.desc": "By accessing and using eChatbot, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, do not use our services.",
    "terms.services.title": "2. Description of Services",
    "terms.services.desc": "eChatbot provides a WhatsApp-integrated e-commerce platform that enables businesses to manage products, process orders, and communicate with customers through AI agents.",
    "terms.account.title": "3. User Accounts",
    "terms.account.desc": "You must create an account to use eChatbot. You are responsible for maintaining the security of your account and password. You must be at least 18 years old to use our services.",
    "terms.conduct.title": "4. User Conduct",
    "terms.conduct.desc": "You agree not to use eChatbot for illegal purposes, violate third-party rights, or breach any applicable laws. We reserve the right to suspend or terminate accounts that violate these terms.",
    "terms.payment.title": "5. Payment and Billing",
    "terms.payment.desc": "Pricing is based on your subscription plan and usage. Payments are processed monthly. You may cancel your subscription at any time, but refunds are not available for already billed service periods.",
    "terms.ip.title": "6. Intellectual Property",
    "terms.ip.desc": "All eChatbot content and technology are owned by eChatbot or its licensors. You retain ownership of your content but grant us a license to use it to provide our services.",
    "terms.termination.title": "7. Termination",
    "terms.termination.desc": "We may suspend or terminate your access to eChatbot at any time for violation of these terms or other legitimate reasons. You may terminate your account at any time from your account settings.",
    "terms.limitation.title": "8. Limitation of Liability",
    "terms.limitation.desc": "eChatbot is provided 'as is'. We make no warranties of any kind. Our liability is limited to the amount you paid in the last month.",
    "terms.changes.title": "9. Changes to Terms",
    "terms.changes.desc": "We may update these terms periodically. We will notify you of significant changes via email or platform notification. Continued use constitutes acceptance of updated terms.",
    "terms.contact.title": "10. Contact Us",
    "terms.contact.desc": "For questions about these Terms of Service, contact us at legal@echatbot.ai",
  },
  es: {
    // Header
    "header.tagline": "Habla con tus clientes a través de la sua chat favorita",

    // Hero Section
    "hero.title": "Crea tu agente AI para WhatsApp",
    "hero.subtitle":
      "Lleva un personal shopper a WhatsApp. eChatbot escucha, califica, sugiere combos, envía pagos y mantiene al cliente informado sin salir del chat.",
    "hero.whyTitle": "¿Por qué eChatbot?",
    "hero.useCasesTitle": "Workflows para tu equipo",
    "hero.useCases.sales.title": "Equipos comerciales",
    "hero.useCases.sales.desc":
      "Califica leads, propone surtidos, envía enlaces de pago y cierra pedidos en minutos.",
    "hero.useCases.support.title": "Soporte al cliente",
    "hero.useCases.support.desc":
      "Filtra las preguntas frecuentes, escala al humano con todo el contexto y registra cada conversación.",
    "hero.useCases.ops.title": "Operaciones y logística",
    "hero.useCases.ops.desc":
      "Sincroniza inventario, sigue las etapas de fulfillment y envía actualizaciones de transporte automáticamente.",

    // Features
    "features.pushNotifications": "Push Notifications",
    "features.pushNotifications.desc":
      "Campañas automatizadas, reactivaciones y alertas de pedido vía WhatsApp",
    "features.24x7": "24/7 Availability",
    "features.24x7.desc":
      "Un concierge que nunca duerme: resuelve FAQs, escala a humanos y cierra pedidos todo el día",
    "features.multiLanguage": "Multi-Language",
    "features.multiLanguage.desc":
      "Responde al instante en más de 30 idiomas con traducciones naturales y tono local",
    "features.ecommerce": "E-commerce Platform",
    "features.ecommerce.desc":
      "Controla catálogo, inventario, pedidos y clientes desde un panel único listo para WhatsApp",
    "features.analytics": "Analytics",
    "features.analytics.desc": "Monitorea ventas y rendimiento",

    // News Section
    "news.title": "Últimas Actualizaciones y Funcionalidades",
    "news.subtitle": "Mantente informado sobre las últimas mejoras de eChatbot",
    "news.1.date": "15 de Octubre de 2025",
    "news.1.title": "Soporte Multiidioma",
    "news.1.category": "Idiomas",
    "news.1.desc":
      "¡Nos complace anunciar el soporte multiidioma mejorado en nuestra plataforma! Comunícate con tus clientes en italiano, inglés, español y portugués. Nuestro chatbot de IA ha sido entrenado para comprender y responder naturalmente en múltiples idiomas, detectando automáticamente el idioma preferido del cliente y manteniendo la misma experiencia conversacional de alta calidad en todos los idiomas. ¡Expande tu negocio globalmente con comunicación multilingüe sin interrupciones!",
    "news.2.date": "8 de Octubre de 2025",
    "news.2.title": "Análisis de Búsqueda de Productos",
    "news.2.category": "Análisis",
    "news.2.desc":
      "¡Presentamos nuestra nueva función de Análisis de Búsqueda de Productos! Ahora puedes analizar qué productos buscan tus clientes con más frecuencia. Esta poderosa información te ayuda a comprender la demanda del cliente, optimizar tu inventario e identificar productos en tendencia. El panel de análisis proporciona gráficos e informes detallados que muestran patrones de búsqueda, palabras clave populares y tasas de conversión.",
    "news.3.date": "28 de Septiembre de 2025",
    "news.3.title": "Orquestación de Sell Agents",
    "news.3.category": "Agentes de Venta",
    "news.3.desc":
      "Estrenamos un orquestador multiagente para tu equipo comercial. Define agentes especializados para catálogo, carrito, pagos y soporte humano, y deja que eChatbot derive cada conversación al experto correcto. Todo el contexto viaja con el cliente, las tareas quedan registradas y cada paso se asigna al profesional indicado. Resultado: procesos más rápidos y clientes mejor atendidos.",
    "news.4.date": "20 de Septiembre de 2025",
    "news.4.title": "Enviar Notificaciones Push",
    "news.4.category": "Marketing",
    "news.4.desc":
      "¡Lanza campañas de marketing dirigidas con nuestra nueva función de Notificaciones Push! Envía mensajes promocionales, ofertas especiales y actualizaciones directamente a tus clientes a través de WhatsApp. Crea campañas con mensajes personalizados, programa envíos para el momento óptimo y rastrea las tasas de entrega y el compromiso del cliente. Perfecto para anunciar nuevos productos, ventas flash o actualizaciones importantes para mantener a tus clientes informados y comprometidos.",

    // Pricing
    "pricing.title": "Elige Tu Plan",
    "pricing.subtitle": "Comienza gratis y escala mientras creces",
    "pricing.free.desc": "Para probar la plataforma",
    "pricing.free.creditDesc":
      "Te ofrecemos los primeros 19€ para probar la plataforma.",
    "pricing.basic.desc": "Para empresas en crecimiento",
    "pricing.premium.desc": "Para empresas consolidadas",
    "pricing.enterprise.desc": "Para operaciones a gran escala",
    "pricing.usage.title":
      "Las siguientes tarifas por uso son adicionales y se aplican a todos los planes",
    "pricing.usage.message": "por Mensaje",
    "pricing.usage.message.desc":
      "Descontado de tu crédito (respuestas IA)",
    "pricing.usage.customer": "por Nuevo Cliente",
    "pricing.usage.customer.desc": "Cada nueva registro de cliente",
    "pricing.usage.order": "por Nuevo Pedido",
    "pricing.usage.order.desc": "Cada pedido completado",
    "pricing.usage.push": "por mensaje de Push",
    "pricing.usage.push.desc": "Cada mensaje promocional enviado",
    "pricing.features.channels": "Canales WhatsApp",
    "pricing.features.channel": "Canal WhatsApp",
    "pricing.features.products": "Productos",
    "pricing.features.clients": "Clientes/Leads",
    "pricing.features.support": "Soporte",
    "pricing.features.analytics": "Análisis y Reportes Avanzados",
    "pricing.features.branding": "Personalización de Marca",
    "pricing.features.integration": "Integración con CRM / base de datos",
    "pricing.features.unlimited": "Ilimitados",
    "pricing.features.upto": "Hasta",
    "pricing.features.priority": "Soporte Prioritario 24/7",
    "pricing.button.start": "Comenzar",
    "pricing.button.startWithCredit": "Empieza con tu Crédito",
    "pricing.button.contact": "Contactar Ventas",
    "pricing.simulator.button": "Calcula tu Costo Mensual",
    "pricing.simulator.description":
      "Descubre cuánto gastarías según tu uso real",
    "pricing.simulator.title": "Simulador de Precios",
    "pricing.simulator.subtitle":
      "Configura tu uso mensual y descubre el costo estimado",
    "pricing.simulator.totalProducts": "¿Cuántos productos tienes?",
    "pricing.simulator.totalProducts.help":
      "📦 El número de productos en tu catálogo",
    "pricing.simulator.totalCustomers": "¿Cuántos clientes tienes en total?",
    "pricing.simulator.totalCustomers.help":
      "📊 Este número ayuda a sugerir valores realistas para mensajes, nuevos clientes y soporte",
    "pricing.simulator.channels": "¿Cuántos canales de WhatsApp quieres crear?",
    "pricing.simulator.messages": "Estimación de mensajes por mes",
    "pricing.simulator.newCustomers": "Estimación de nuevos clientes por mes",
    "pricing.simulator.newOrders": "Estimación de nuevos pedidos por mes",
    "pricing.simulator.pushCampaigns": "Mensajes Publicitarios por mes",
    "pricing.simulator.extras": "Extras",
    "pricing.simulator.branding": "Personalización de Marca",
    "pricing.simulator.branding.desc": "Tu logo y colores",
    "pricing.simulator.dedicatedServer": "Servidor Dedicado",
    "pricing.simulator.dedicatedServer.desc": "Dominio personalizado",
    "pricing.simulator.summary": "Resumen",
    "pricing.simulator.plan": "Plan",
    "pricing.simulator.usageCosts": "Costos por Uso",
    "pricing.simulator.monthlyTotal": "Total Mensual",
    "pricing.simulator.estimated": "estimado",
    "pricing.simulator.transparent":
      "💡 Costos transparentes basados en consumo real",
    "pricing.simulator.suggestion": "💡 Sugerencia",
    "pricing.simulator.suggestion.messages": "~30% de los clientes",
    "pricing.simulator.suggestion.newCustomers": "~10% crecimiento",
    "pricing.simulator.suggestion.pushCampaigns": "campañas/mes",
    "pricing.simulator.price.perPushMessage": "por mensaje publicitario",
    "pricing.simulator.cta.free": "Iniciar Prueba Gratuita",
    "pricing.simulator.cta.plan": "Elegir",

    // Contact
    "contact.title": "¿Listo para Comenzar?",
    "contact.subtitle": "Únete a miles de empresas que ya venden en WhatsApp",
    "contact.cta": "Empezar Prueba Gratuita",

    // Footer
    "footer.tagline": "Transforma WhatsApp en tu tienda online",
    "footer.company": "Empresa",
    "footer.about": "Sobre Nosotros",
    "footer.careers": "Carreras",
    "footer.contact": "Contáctanos",
    "footer.support": "Soporte",
    "footer.docs": "Documentación",
    "footer.help": "Centro de Ayuda",
    "footer.legal": "Legal",
    "footer.privacy": "Política de Privacidad",
    "footer.terms": "Términos de Servicio",
    "footer.rights": "Todos los derechos reservados",

    // Login
    "login.title": "Inicia sesión en tu cuenta",
    "login.email": "Correo electrónico",
    "login.password": "Contraseña",
    "login.forgot": "¿Olvidaste tu contraseña?",
    "login.button": "Iniciar Sesión",
    "login.noAccount": "¿No tienes una cuenta?",
    "login.signup": "Regístrate",
    "login.signin": "Login",
    "login.register": "Registrarse",
    "login.welcomeBack": "Bienvenido de Nuevo",
    "login.forgotPassword": "¿Olvidaste tu contraseña?",
    "login.signingIn": "Iniciando sesión...",
    "login.orContinueWith": "O continúa con",

    // Register
    "register.createAccount": "Crear Cuenta",
    "register.passwordHint": "Mín 8 caracteres, mayúscula, minúscula, número, carácter especial",
    "register.creatingAccount": "Creando cuenta...",
    "register.gdprAccept": "Acepto la",
    "register.privacyPolicy": "Política de Privacidad",
    "register.and": "y los",
    "register.termsOfService": "Términos de Servicio",

    // Form
    "form.email": "Correo electrónico",
    "form.password": "Contraseña",
    "form.firstName": "Nombre",
    "form.lastName": "Apellido",
    "form.confirmPassword": "Confirmar Contraseña",
    "form.error.invalidEmail": "Dirección de correo electrónico no válida",

    // Forgot Password
    "forgotPassword.title": "Restablecer Contraseña",
    "forgotPassword.subtitle": "Ingresa tu correo para restablecer tu contraseña",
    "forgotPassword.email.placeholder": "admin@echatbot.ai",
    "forgotPassword.button": "Restablecer Contraseña",
    "forgotPassword.backToLogin": "Volver al Inicio de Sesión",
    "forgotPassword.success": "Si este correo está registrado, se han enviado instrucciones de restablecimiento de contraseña a tu bandeja de entrada. Por favor revisa tu correo y sigue el enlace para restablecer tu contraseña.",
    "forgotPassword.error": "Ocurrió un error",

    // Reset Password
    "resetPassword.title": "Restablecer Contraseña",
    "resetPassword.subtitle": "Ingresa tu nueva contraseña",
    "resetPassword.newPassword": "Nueva Contraseña",
    "resetPassword.newPassword.placeholder": "Ingresa nueva contraseña",
    "resetPassword.confirmPassword": "Confirmar Contraseña",
    "resetPassword.confirmPassword.placeholder": "Confirma nueva contraseña",
    "resetPassword.button": "Restablecer Contraseña",
    "resetPassword.button.loading": "Restableciendo...",
    "resetPassword.success": "¡Contraseña restablecida con éxito! Redirigiendo al inicio de sesión...",
    "resetPassword.invalidLink": "Enlace de Restablecimiento Inválido",
    "resetPassword.invalidLink.desc": "El enlace de restablecimiento de contraseña es inválido o ha expirado",
    "resetPassword.requestNew": "Solicitar un nuevo enlace de restablecimiento",
    "resetPassword.error.mismatch": "Las contraseñas no coinciden",
    "resetPassword.error.minLength": "La contraseña debe tener al menos 8 caracteres",
    "resetPassword.error.strength": "La contraseña debe contener al menos una letra mayúscula, una letra minúscula, un número y un carácter especial",

    // Auth Errors
    "auth.error.invalid6DigitCode": "Por favor ingrese un código válido de 6 dígitos",
    "auth.error.invalidRecoveryCode": "Por favor ingrese un código de recuperación válido",
    "auth.error.invalidVerificationLink": "Enlace de verificación inválido. Por favor inicie sesión nuevamente.",
    "auth.error.accountLocked": "Cuenta bloqueada debido a demasiados intentos fallidos",
    "auth.error.invalidCode": "Código de verificación inválido",

    // Setup 2FA Page
    "setup2fa.title": "Configurar Autenticación de Dos Factores",
    "setup2fa.scanDescription": "Escanea el código QR con tu app de autenticación",
    "setup2fa.useAuthenticatorApp": "Usa una app de autenticación",
    "setup2fa.recommended": "Recomendado: Google Authenticator, Microsoft Authenticator o Authy",
    "setup2fa.howToSetup": "Cómo configurar:",
    "setup2fa.step1": "Abre tu app de autenticación",
    "setup2fa.step2": "Toca \"+\" o \"Agregar cuenta\"",
    "setup2fa.step3": "Escanea este código QR",
    "setup2fa.step4": "Ingresa el código de 6 dígitos abajo",
    "setup2fa.scannedButton": "He escaneado el código",
    "setup2fa.verifyTitle": "Verifica Tu Configuración",
    "setup2fa.verifyDescription": "Ingresa el código de 6 dígitos de tu app de autenticación",
    "setup2fa.verificationCode": "Código de Verificación",
    "setup2fa.codeRefreshes": "El código se actualiza cada 30 segundos. Ingresa el código actual de tu app.",
    "setup2fa.verifying": "Verificando...",
    "setup2fa.verifyAndContinue": "Verificar y Continuar",
    "setup2fa.backToQR": "Volver al Código QR",
    "setup2fa.saveRecoveryTitle": "Guarda Tus Códigos de Recuperación",
    "setup2fa.saveRecoveryDescription": "Guarda estos códigos en un lugar seguro. Los necesitarás para acceder a tu cuenta si pierdes tu dispositivo de autenticación.",
    "setup2fa.important": "¡Importante!",
    "setup2fa.recoveryCodeWarning": "Cada código de recuperación solo puede usarse una vez. Después de usarlo, será invalidado.",
    "setup2fa.copyCodes": "Copiar Códigos",
    "setup2fa.copied": "¡Copiado!",
    "setup2fa.download": "Descargar",
    "setup2fa.savedContinue": "He Guardado Mis Códigos - Continuar",
    "setup2fa.stepScan": "Escanear",
    "setup2fa.stepVerify": "Verificar",
    "setup2fa.stepSaveCodes": "Guardar Códigos",
    "setup2fa.skipLogin": "Saltar e iniciar sesión después",

    // Privacy Policy
    "privacy.title": "Política de Privacidad",
    "privacy.lastUpdate": "Última actualización",
    "privacy.intro": "eChatbot se compromete a proteger su privacidad. Esta Política de Privacidad explica cómo recopilamos, usamos y protegemos sus datos personales.",
    "privacy.collection.title": "1. Información que Recopilamos",
    "privacy.collection.desc": "Recopilamos información que nos proporciona directamente, incluyendo nombre, correo electrónico, número de teléfono y detalles comerciales cuando crea una cuenta o usa nuestros servicios.",
    "privacy.usage.title": "2. Cómo Usamos Su Información",
    "privacy.usage.desc": "Usamos su información para proporcionar y mejorar nuestros servicios, procesar transacciones, enviar comunicaciones importantes y personalizar su experiencia.",
    "privacy.sharing.title": "3. Compartir Información",
    "privacy.sharing.desc": "No vendemos sus datos personales. Podemos compartir información con proveedores de servicios confiables que nos ayudan a operar nuestra plataforma, siempre en cumplimiento con esta política.",
    "privacy.security.title": "4. Seguridad de Datos",
    "privacy.security.desc": "Implementamos medidas de seguridad estándar de la industria para proteger sus datos personales del acceso no autorizado, alteración o divulgación.",
    "privacy.rights.title": "5. Sus Derechos",
    "privacy.rights.desc": "Tiene derecho a acceder, corregir o eliminar sus datos personales. También puede oponerse a cierto procesamiento de datos o solicitar portabilidad de datos.",
    "privacy.cookies.title": "6. Cookies y Tecnologías de Seguimiento",
    "privacy.cookies.desc": "Usamos cookies y tecnologías similares para mejorar su experiencia, analizar el uso y personalizar el contenido. Puede gestionar las preferencias de cookies en la configuración de su navegador.",
    "privacy.contact.title": "7. Contáctenos",
    "privacy.contact.desc": "Para preguntas sobre esta Política de Privacidad o nuestras prácticas de manejo de datos, contáctenos en privacy@echatbot.ai",

    // Terms of Service
    "terms.title": "Términos de Servicio",
    "terms.lastUpdate": "Última actualización",
    "terms.intro": "Bienvenido a eChatbot. Al usar nuestros servicios, acepta estar sujeto a estos Términos de Servicio.",
    "terms.acceptance.title": "1. Aceptación de los Términos",
    "terms.acceptance.desc": "Al acceder y usar eChatbot, acepta estar sujeto a estos Términos de Servicio y nuestra Política de Privacidad. Si no acepta estos términos, no use nuestros servicios.",
    "terms.services.title": "2. Descripción de Servicios",
    "terms.services.desc": "eChatbot proporciona una plataforma de comercio electrónico integrada con WhatsApp que permite a las empresas gestionar productos, procesar pedidos y comunicarse con clientes a través de agentes de IA.",
    "terms.account.title": "3. Cuentas de Usuario",
    "terms.account.desc": "Debe crear una cuenta para usar eChatbot. Es responsable de mantener la seguridad de su cuenta y contraseña. Debe tener al menos 18 años para usar nuestros servicios.",
    "terms.conduct.title": "4. Conducta del Usuario",
    "terms.conduct.desc": "Acepta no usar eChatbot para propósitos ilegales, violar derechos de terceros o incumplir leyes aplicables. Nos reservamos el derecho de suspender o terminar cuentas que violen estos términos.",
    "terms.payment.title": "5. Pago y Facturación",
    "terms.payment.desc": "Los precios se basan en su plan de suscripción y uso. Los pagos se procesan mensualmente. Puede cancelar su suscripción en cualquier momento, pero los reembolsos no están disponibles para períodos de servicio ya facturados.",
    "terms.ip.title": "6. Propiedad Intelectual",
    "terms.ip.desc": "Todo el contenido y tecnología de eChatbot son propiedad de eChatbot o sus licenciantes. Conserva la propiedad de su contenido pero nos otorga una licencia para usarlo para proporcionar nuestros servicios.",
    "terms.termination.title": "7. Terminación",
    "terms.termination.desc": "Podemos suspender o terminar su acceso a eChatbot en cualquier momento por violación de estos términos u otras razones legítimas. Puede terminar su cuenta en cualquier momento desde la configuración de su cuenta.",
    "terms.limitation.title": "8. Limitación de Responsabilidad",
    "terms.limitation.desc": "eChatbot se proporciona 'tal cual'. No ofrecemos garantías de ningún tipo. Nuestra responsabilidad se limita a la cantidad que pagó en el último mes.",
    "terms.changes.title": "9. Cambios en los Términos",
    "terms.changes.desc": "Podemos actualizar estos términos periódicamente. Le notificaremos de cambios significativos por correo electrónico o notificación en la plataforma. El uso continuado constituye aceptación de los términos actualizados.",
    "terms.contact.title": "10. Contáctenos",
    "terms.contact.desc": "Para preguntas sobre estos Términos de Servicio, contáctenos en legal@echatbot.ai",
  },
  pt: {
    // Header
    "header.tagline": "Fale com seus clientes através do chat favorito deles",

    // Hero Section
    "hero.title": "Crie seu agente AI para WhatsApp",
    "hero.subtitle":
      "Leve um personal shopper para o WhatsApp. eChatbot escuta, qualifica, sugere combos, envia pagamentos e mantém o cliente atualizado sem sair da conversa.",
    "hero.whyTitle": "Por que eChatbot?",
    "hero.useCasesTitle": "Fluxos feitos para o seu time",
    "hero.useCases.sales.title": "Times comerciais",
    "hero.useCases.sales.desc":
      "Qualifique leads, sugira sortimentos, envie links de pagamento e feche pedidos em minutos.",
    "hero.useCases.support.title": "Atendimento ao cliente",
    "hero.useCases.support.desc":
      "Filtre FAQs, escale para humanos com todo o contexto e registre cada interação.",
    "hero.useCases.ops.title": "Operações e logística",
    "hero.useCases.ops.desc":
      "Sincronize estoque, acompanhe o fulfillment e envie atualizações de transporte automaticamente.",

    // Features
    "features.pushNotifications": "Push Notifications",
    "features.pushNotifications.desc":
      "Campanhas automatizadas, reengajamentos e alertas de pedido via WhatsApp",
    "features.24x7": "24/7 Availability",
    "features.24x7.desc":
      "Um concierge que nunca dorme: resolve dúvidas, encaminha para humanos e fecha pedidos 24/7",
    "features.multiLanguage": "Multi-Language",
    "features.multiLanguage.desc":
      "Responda instantaneamente em mais de 30 idiomas com traduções naturais e tom local",
    "features.ecommerce": "E-commerce Platform",
    "features.ecommerce.desc":
      "Controle catálogo, estoque, pedidos e clientes em um único painel pronto para WhatsApp",
    "features.analytics": "Analytics",
    "features.analytics.desc": "Monitore vendas e desempenho",

    // News Section
    "news.title": "Últimas Atualizações e Funcionalidades",
    "news.subtitle": "Fique informado sobre as últimas melhorias do eChatbot",
    "news.1.date": "15 de Outubro de 2025",
    "news.1.title": "Suporte Multilíngue",
    "news.1.category": "Idiomas",
    "news.1.desc":
      "Estamos entusiasmados em anunciar o suporte multilíngue aprimorado em nossa plataforma! Comunique-se com seus clientes em italiano, inglês, espanhol e português. Nosso chatbot de IA foi treinado para entender e responder naturalmente em vários idiomas, detectando automaticamente o idioma preferido do cliente e mantendo a mesma experiência conversacional de alta qualidade em todos os idiomas. Expanda seu negócio globalmente com comunicação multilíngue perfeita!",
    "news.2.date": "8 de Outubro de 2025",
    "news.2.title": "Análise de Busca de Produtos",
    "news.2.category": "Análise",
    "news.2.desc":
      "Apresentando nossa nova funcionalidade de Análise de Busca de Produtos! Agora você pode analisar quais produtos seus clientes estão procurando com mais frequência. Esta poderosa percepção ajuda você a entender a demanda do cliente, otimizar seu estoque e identificar produtos em tendência. O painel de análise fornece gráficos e relatórios detalhados mostrando padrões de busca, palavras-chave populares e taxas de conversão.",
    "news.3.date": "28 de Setembro de 2025",
    "news.3.title": "Orquestração de Sell Agents",
    "news.3.category": "Agentes de Venda",
    "news.3.desc":
      "Acabamos de lançar um orquestrador multiagente para o time comercial! Configure agentes dedicados para catálogo, carrinho, checkout e suporte humano, enquanto o eChatbot direciona cada conversa para o especialista certo. O contexto circula entre os agentes, tudo fica registrado e o cliente recebe o atendimento mais qualificado em cada etapa do funil.",
    "news.4.date": "20 de Setembro de 2025",
    "news.4.title": "Enviar Notificações Push",
    "news.4.category": "Marketing",
    "news.4.desc":
      "Lance campanhas de marketing direcionadas com nossa nova funcionalidade de Notificações Push! Envie mensagens promocionais, ofertas especiais e atualizações diretamente para seus clientes via WhatsApp. Crie campanhas com mensagens personalizadas, agende envios para o momento ideal e rastreie taxas de entrega e engajamento do cliente. Perfeito para anunciar novos produtos, vendas relâmpago ou atualizações importantes para manter seus clientes informados e engajados.",

    // Pricing
    "pricing.title": "Escolha Seu Plano",
    "pricing.subtitle": "Comece grátis e escale conforme você cresce",
    "pricing.free.desc": "Para testar a plataforma",
    "pricing.free.creditDesc":
      "Oferecemos os primeiros €19 para testar a plataforma.",
    "pricing.basic.desc": "Para empresas em crescimento",
    "pricing.premium.desc": "Para empresas estabelecidas",
    "pricing.enterprise.desc": "Para operações em grande escala",
    "pricing.usage.title":
      "As seguintes taxas por uso são adicionais e se aplicam a todos os planos",
    "pricing.usage.message": "por Mensagem",
    "pricing.usage.message.desc":
      "Descontado do seu crédito (respostas IA)",
    "pricing.usage.customer": "por Novo Cliente",
    "pricing.usage.customer.desc": "Cada novo registro de cliente",
    "pricing.usage.order": "por Novo Pedido",
    "pricing.usage.order.desc": "Cada pedido concluído",
    "pricing.usage.push": "por mensagem de Push",
    "pricing.usage.push.desc": "Cada mensagem promocional enviada",
    "pricing.features.channels": "Canais WhatsApp",
    "pricing.features.channel": "Canal WhatsApp",
    "pricing.features.products": "Produtos",
    "pricing.features.clients": "Clientes/Leads",
    "pricing.features.support": "Suporte",
    "pricing.features.analytics": "Análises e Relatórios Avançados",
    "pricing.features.branding": "Personalização de Marca",
    "pricing.features.integration": "Integração com CRM / banco de dados",
    "pricing.features.unlimited": "Ilimitados",
    "pricing.features.upto": "Até",
    "pricing.features.priority": "Suporte Prioritário 24/7",
    "pricing.button.start": "Começar",
    "pricing.button.startWithCredit": "Comece com seu Crédito",
    "pricing.button.contact": "Contatar Vendas",
    "pricing.simulator.button": "Calcule seu Custo Mensal",
    "pricing.simulator.description":
      "Descubra quanto você gastaria com base no seu uso real",
    "pricing.simulator.title": "Simulador de Preços",
    "pricing.simulator.subtitle":
      "Configure seu uso mensal e descubra o custo estimado",
    "pricing.simulator.totalProducts": "Quantos produtos você tem?",
    "pricing.simulator.totalProducts.help":
      "📦 O número de produtos no seu catálogo",
    "pricing.simulator.totalCustomers": "Quantos clientes você tem no total?",
    "pricing.simulator.totalCustomers.help":
      "📊 Este número ajuda a sugerir valores realistas para mensagens, novos clientes e suporte",
    "pricing.simulator.channels": "Quantos canais WhatsApp você quer criar?",
    "pricing.simulator.messages": "Estimativa de mensagens por mês",
    "pricing.simulator.newCustomers": "Estimativa de novos clientes por mês",
    "pricing.simulator.newOrders": "Estimativa de novos pedidos por mês",
    "pricing.simulator.pushCampaigns": "Mensagens Publicitárias por mês",
    "pricing.simulator.humanSupport": "Suporte Humano por mês",
    "pricing.simulator.extras": "Extras",
    "pricing.simulator.branding": "Personalização de Marca",
    "pricing.simulator.branding.desc": "Seu logo e cores",
    "pricing.simulator.dedicatedServer": "Servidor Dedicado",
    "pricing.simulator.dedicatedServer.desc": "Domínio personalizado",
    "pricing.simulator.summary": "Resumo",
    "pricing.simulator.plan": "Plano",
    "pricing.simulator.usageCosts": "Custos por Uso",
    "pricing.simulator.monthlyTotal": "Total Mensal",
    "pricing.simulator.estimated": "estimado",
    "pricing.simulator.transparent":
      "💡 Custos transparentes baseados no consumo real",
    "pricing.simulator.suggestion": "💡 Sugestão",
    "pricing.simulator.suggestion.messages": "~30% dos clientes",
    "pricing.simulator.suggestion.newCustomers": "~10% crescimento",
    "pricing.simulator.suggestion.pushCampaigns": "campanhas/mês",
    "pricing.simulator.price.perPushMessage": "por mensagem publicitária",
    "pricing.simulator.cta.free": "Iniciar Teste Gratuito",
    "pricing.simulator.cta.plan": "Escolher",

    // Contact
    "contact.title": "Pronto para Começar?",
    "contact.subtitle":
      "Junte-se a milhares de empresas que já vendem no WhatsApp",
    "contact.cta": "Começar Teste Gratuito",

    // Footer
    "footer.tagline": "Transforme o WhatsApp em sua loja online",
    "footer.company": "Empresa",
    "footer.about": "Sobre Nós",
    "footer.careers": "Carreiras",
    "footer.contact": "Fale Conosco",
    "footer.support": "Suporte",
    "footer.docs": "Documentação",
    "footer.help": "Centro de Ajuda",
    "footer.legal": "Legal",
    "footer.privacy": "Política de Privacidade",
    "footer.terms": "Termos de Serviço",
    "footer.rights": "Todos os direitos reservados",

    // Login
    "login.title": "Entre na sua conta",
    "login.email": "E-mail",
    "login.password": "Senha",
    "login.forgot": "Esqueceu a senha?",
    "login.button": "Entrar",
    "login.noAccount": "Não tem uma conta?",
    "login.signup": "Cadastre-se",
    "login.signin": "Login",
    "login.register": "Cadastrar",
    "login.welcomeBack": "Bem-vindo de Volta",
    "login.forgotPassword": "Esqueceu a senha?",
    "login.signingIn": "Entrando...",
    "login.orContinueWith": "Ou continue com",

    // Register
    "register.createAccount": "Criar Conta",
    "register.passwordHint": "Mín 8 caracteres, maiúscula, minúscula, número, caractere especial",
    "register.creatingAccount": "Criando conta...",
    "register.gdprAccept": "Aceito a",
    "register.privacyPolicy": "Política de Privacidade",
    "register.and": "e os",
    "register.termsOfService": "Termos de Serviço",

    // Form
    "form.email": "E-mail",
    "form.password": "Senha",
    "form.firstName": "Nome",
    "form.lastName": "Sobrenome",
    "form.confirmPassword": "Confirmar Senha",
    "form.error.invalidEmail": "Endereço de e-mail inválido",

    // Forgot Password
    "forgotPassword.title": "Redefinir Senha",
    "forgotPassword.subtitle": "Digite seu e-mail para redefinir sua senha",
    "forgotPassword.email.placeholder": "admin@echatbot.ai",
    "forgotPassword.button": "Redefinir Senha",
    "forgotPassword.backToLogin": "Voltar ao Login",
    "forgotPassword.success": "Se este e-mail estiver registrado, instruções de redefinição de senha foram enviadas para sua caixa de entrada. Por favor, verifique seu e-mail e siga o link para redefinir sua senha.",
    "forgotPassword.error": "Ocorreu um erro",

    // Reset Password
    "resetPassword.title": "Redefinir Senha",
    "resetPassword.subtitle": "Digite sua nova senha",
    "resetPassword.newPassword": "Nova Senha",
    "resetPassword.newPassword.placeholder": "Digite nova senha",
    "resetPassword.confirmPassword": "Confirmar Senha",
    "resetPassword.confirmPassword.placeholder": "Confirme nova senha",
    "resetPassword.button": "Redefinir Senha",
    "resetPassword.button.loading": "Redefinindo...",
    "resetPassword.success": "Senha redefinida com sucesso! Redirecionando para o login...",
    "resetPassword.invalidLink": "Link de Redefinição Inválido",
    "resetPassword.invalidLink.desc": "O link de redefinição de senha é inválido ou expirou",
    "resetPassword.requestNew": "Solicitar um novo link de redefinição",
    "resetPassword.error.mismatch": "As senhas não correspondem",
    "resetPassword.error.minLength": "A senha deve ter pelo menos 8 caracteres",
    "resetPassword.error.strength": "A senha deve conter pelo menos uma letra maiúscula, uma letra minúscula, um número e um caractere especial",

    // Auth Errors
    "auth.error.invalid6DigitCode": "Por favor insira um código válido de 6 dígitos",
    "auth.error.invalidRecoveryCode": "Por favor insira um código de recuperação válido",
    "auth.error.invalidVerificationLink": "Link de verificação inválido. Por favor faça login novamente.",
    "auth.error.accountLocked": "Conta bloqueada devido a muitas tentativas falhadas",
    "auth.error.invalidCode": "Código de verificação inválido",

    // Setup 2FA Page
    "setup2fa.title": "Configurar Autenticação de Dois Fatores",
    "setup2fa.scanDescription": "Escaneie o código QR com seu app de autenticação",
    "setup2fa.useAuthenticatorApp": "Use um app de autenticação",
    "setup2fa.recommended": "Recomendado: Google Authenticator, Microsoft Authenticator ou Authy",
    "setup2fa.howToSetup": "Como configurar:",
    "setup2fa.step1": "Abra seu app de autenticação",
    "setup2fa.step2": "Toque em \"+\" ou \"Adicionar conta\"",
    "setup2fa.step3": "Escaneie este código QR",
    "setup2fa.step4": "Digite o código de 6 dígitos abaixo",
    "setup2fa.scannedButton": "Eu escaneei o código",
    "setup2fa.verifyTitle": "Verifique Sua Configuração",
    "setup2fa.verifyDescription": "Digite o código de 6 dígitos do seu app de autenticação",
    "setup2fa.verificationCode": "Código de Verificação",
    "setup2fa.codeRefreshes": "O código se atualiza a cada 30 segundos. Digite o código atual do seu app.",
    "setup2fa.verifying": "Verificando...",
    "setup2fa.verifyAndContinue": "Verificar e Continuar",
    "setup2fa.backToQR": "Voltar ao Código QR",
    "setup2fa.saveRecoveryTitle": "Salve Seus Códigos de Recuperação",
    "setup2fa.saveRecoveryDescription": "Guarde estes códigos em um lugar seguro. Você precisará deles para acessar sua conta se perder seu dispositivo de autenticação.",
    "setup2fa.important": "Importante!",
    "setup2fa.recoveryCodeWarning": "Cada código de recuperação só pode ser usado uma vez. Após o uso, o código será invalidado.",
    "setup2fa.copyCodes": "Copiar Códigos",
    "setup2fa.copied": "Copiado!",
    "setup2fa.download": "Baixar",
    "setup2fa.savedContinue": "Salvei Meus Códigos - Continuar",
    "setup2fa.stepScan": "Escanear",
    "setup2fa.stepVerify": "Verificar",
    "setup2fa.stepSaveCodes": "Salvar Códigos",
    "setup2fa.skipLogin": "Pular e fazer login depois",

    // Privacy Policy
    "privacy.title": "Política de Privacidade",
    "privacy.lastUpdate": "Última atualização",
    "privacy.intro": "eChatbot está comprometido em proteger sua privacidade. Esta Política de Privacidade explica como coletamos, usamos e protegemos seus dados pessoais.",
    "privacy.collection.title": "1. Informações que Coletamos",
    "privacy.collection.desc": "Coletamos informações que você nos fornece diretamente, incluindo nome, e-mail, número de telefone e detalhes comerciais quando você cria uma conta ou usa nossos serviços.",
    "privacy.usage.title": "2. Como Usamos Suas Informações",
    "privacy.usage.desc": "Usamos suas informações para fornecer e melhorar nossos serviços, processar transações, enviar comunicações importantes e personalizar sua experiência.",
    "privacy.sharing.title": "3. Compartilhamento de Informações",
    "privacy.sharing.desc": "Não vendemos seus dados pessoais. Podemos compartilhar informações com provedores de serviços confiáveis que nos ajudam a operar nossa plataforma, sempre em conformidade com esta política.",
    "privacy.security.title": "4. Segurança de Dados",
    "privacy.security.desc": "Implementamos medidas de segurança padrão da indústria para proteger seus dados pessoais de acesso não autorizado, alteração ou divulgação.",
    "privacy.rights.title": "5. Seus Direitos",
    "privacy.rights.desc": "Você tem o direito de acessar, corrigir ou excluir seus dados pessoais. Você também pode se opor a certo processamento de dados ou solicitar portabilidade de dados.",
    "privacy.cookies.title": "6. Cookies e Tecnologias de Rastreamento",
    "privacy.cookies.desc": "Usamos cookies e tecnologias semelhantes para melhorar sua experiência, analisar o uso e personalizar o conteúdo. Você pode gerenciar as preferências de cookies nas configurações do seu navegador.",
    "privacy.contact.title": "7. Entre em Contato",
    "privacy.contact.desc": "Para perguntas sobre esta Política de Privacidade ou nossas práticas de tratamento de dados, entre em contato conosco em privacy@echatbot.ai",

    // Terms of Service
    "terms.title": "Termos de Serviço",
    "terms.lastUpdate": "Última atualização",
    "terms.intro": "Bem-vindo ao eChatbot. Ao usar nossos serviços, você concorda em estar vinculado a estes Termos de Serviço.",
    "terms.acceptance.title": "1. Aceitação dos Termos",
    "terms.acceptance.desc": "Ao acessar e usar o eChatbot, você concorda em estar vinculado a estes Termos de Serviço e nossa Política de Privacidade. Se você não concorda com estes termos, não use nossos serviços.",
    "terms.services.title": "2. Descrição dos Serviços",
    "terms.services.desc": "eChatbot fornece uma plataforma de comércio eletrônico integrada ao WhatsApp que permite às empresas gerenciar produtos, processar pedidos e se comunicar com clientes através de agentes de IA.",
    "terms.account.title": "3. Contas de Usuário",
    "terms.account.desc": "Você deve criar uma conta para usar o eChatbot. Você é responsável por manter a segurança de sua conta e senha. Você deve ter pelo menos 18 anos para usar nossos serviços.",
    "terms.conduct.title": "4. Conduta do Usuário",
    "terms.conduct.desc": "Você concorda em não usar o eChatbot para propósitos ilegais, violar direitos de terceiros ou descumprir leis aplicáveis. Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos.",
    "terms.payment.title": "5. Pagamento e Faturamento",
    "terms.payment.desc": "Os preços são baseados em seu plano de assinatura e uso. Os pagamentos são processados mensalmente. Você pode cancelar sua assinatura a qualquer momento, mas reembolsos não estão disponíveis para períodos de serviço já faturados.",
    "terms.ip.title": "6. Propriedade Intelectual",
    "terms.ip.desc": "Todo o conteúdo e tecnologia do eChatbot são propriedade do eChatbot ou de seus licenciadores. Você mantém a propriedade de seu conteúdo, mas nos concede uma licença para usá-lo para fornecer nossos serviços.",
    "terms.termination.title": "7. Rescisão",
    "terms.termination.desc": "Podemos suspender ou encerrar seu acesso ao eChatbot a qualquer momento por violação destes termos ou outras razões legítimas. Você pode encerrar sua conta a qualquer momento nas configurações de sua conta.",
    "terms.limitation.title": "8. Limitação de Responsabilidade",
    "terms.limitation.desc": "eChatbot é fornecido 'como está'. Não fazemos garantias de qualquer tipo. Nossa responsabilidade é limitada ao valor que você pagou no último mês.",
    "terms.changes.title": "9. Alterações nos Termos",
    "terms.changes.desc": "Podemos atualizar estes termos periodicamente. Notificaremos você de mudanças significativas por e-mail ou notificação na plataforma. O uso continuado constitui aceitação dos termos atualizados.",
    "terms.contact.title": "10. Entre em Contato",
    "terms.contact.desc": "Para perguntas sobre estes Termos de Serviço, entre em contato conosco em legal@echatbot.ai",
  },
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // 1. Check localStorage first
    const saved = localStorage.getItem("language")
    if (saved && ["it", "en", "es", "pt"].includes(saved)) {
      return saved as Language
    }
    
    // 2. Detect browser language
    const browserLang = navigator.language.split('-')[0].toLowerCase()
    const langMap: Record<string, Language> = {
      'it': 'it',
      'en': 'en', 
      'es': 'es',
      'pt': 'pt',
      // Common variants
      'italiano': 'it',
      'english': 'en',
      'español': 'es',
      'português': 'pt',
    }
    
    return langMap[browserLang] || 'en' // Default to English if browser lang not supported
  })

  useEffect(() => {
    localStorage.setItem("language", language)
    // Force re-render of entire app when language changes
    document.documentElement.lang = language
  }, [language])

  const setLanguage = (lang: Language) => {
    // Save to localStorage FIRST
    localStorage.setItem("language", lang)
    // Then update state (this triggers useEffect which will re-render all components)
    setLanguageState(lang)
  }

  const t = (key: string): string => {
    return translations[language][key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
