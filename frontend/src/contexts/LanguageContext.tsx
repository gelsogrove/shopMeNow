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
      "ShopMe porta l'e-commerce intelligente direttamente su WhatsApp. Il nostro agente AI comprende le esigenze dei clienti, consiglia prodotti e chiude vendite 24/7—tutto attraverso conversazioni naturali.",
    "hero.whyTitle": "Perché ShopMe?",

    // Features
    "features.pushNotifications": "Push Notifications",
    "features.pushNotifications.desc":
      "Invia campagne mirate e avvisi in tempo reale ai tuoi clienti via WhatsApp",
    "features.24x7": "24/7 Availability",
    "features.24x7.desc":
      "Non perdere mai una vendita—il tuo agente AI lavora 24 ore su 24",
    "features.multiLanguage": "Multi-Language Support",
    "features.multiLanguage.desc":
      "Servi i clienti nella loro lingua preferita automaticamente",
    "features.ecommerce": "Complete E-commerce Platform",
    "features.ecommerce.desc":
      "Gestisci prodotti, ordini, inventario e relazioni con i clienti in un unico posto",

    // News Section
    "news.title": "Ultimi Aggiornamenti e Funzionalità",
    "news.subtitle": "Rimani informato sugli ultimi miglioramenti di ShopMe",
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
    "news.3.title": "Gestione Team di Vendita",
    "news.3.category": "Gestione",
    "news.3.desc":
      "Presentiamo la potente funzionalità di Gestione Team di Vendita! Ora puoi assegnare agenti di vendita dedicati ai tuoi clienti per un'esperienza personalizzata. Ogni cliente può avere un rappresentante di riferimento che gestisce il suo account, costruisce relazioni durature e fornisce supporto su misura. Il sistema traccia automaticamente le performance di ogni agente, monitora le conversioni e genera report dettagliati sulle vendite per team. Perfetto per organizzare il tuo team commerciale, ottimizzare la distribuzione dei clienti e massimizzare i risultati di vendita!",
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
      "I primi €29 per provare la piattaforma li offriamo noi.",
    "pricing.basic.desc": "Per aziende in crescita",
    "pricing.premium.desc": "Per aziende consolidate",
    "pricing.enterprise.desc": "Per operazioni su larga scala",
    "pricing.usage.title":
      "Le seguenti tariffe a consumo sono aggiuntive e si applicano a tutti i piani",
    "pricing.usage.message": "per Messaggio",
    "pricing.usage.message.desc":
      "Dopo la quota gratuita (risposte alimentate da AI)",
    "pricing.usage.customer": "per Nuovo Cliente",
    "pricing.usage.customer.desc": "Ogni nuova registrazione cliente",
    "pricing.usage.order": "per Nuovo Ordine",
    "pricing.usage.order.desc": "Ogni ordine completato",
    "pricing.usage.push": "per Utente Push",
    "pricing.usage.push.desc": "Ogni messaggio promozionale inviato",
    "pricing.features.channels": "Canali WhatsApp",
    "pricing.features.channel": "Canale WhatsApp",
    "pricing.features.products": "Prodotti",
    "pricing.features.clients": "Clienti",
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
    "login.signin": "Accedi",
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

    // Forgot Password
    "forgotPassword.title": "Reimposta Password",
    "forgotPassword.subtitle": "Inserisci la tua email per reimpostare la password",
    "forgotPassword.email.placeholder": "admin@shop.me",
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

    // Privacy Policy
    "privacy.title": "Privacy Policy",
    "privacy.lastUpdate": "Ultimo aggiornamento",
    "privacy.intro": "ShopME si impegna a proteggere la tua privacy. Questa Privacy Policy spiega come raccogliamo, utilizziamo e proteggiamo i tuoi dati personali.",
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
    "privacy.contact.desc": "Per domande su questa Privacy Policy o sulle nostre pratiche di gestione dei dati, contattaci all'indirizzo privacy@shopme.com",

    // Terms of Service
    "terms.title": "Termini di Servizio",
    "terms.lastUpdate": "Ultimo aggiornamento",
    "terms.intro": "Benvenuto su ShopME. Utilizzando i nostri servizi, accetti di essere vincolato da questi Termini di Servizio.",
    "terms.acceptance.title": "1. Accettazione dei Termini",
    "terms.acceptance.desc": "Accedendo e utilizzando ShopME, accetti di essere vincolato da questi Termini di Servizio e dalla nostra Privacy Policy. Se non accetti questi termini, non utilizzare i nostri servizi.",
    "terms.services.title": "2. Descrizione dei Servizi",
    "terms.services.desc": "ShopME fornisce una piattaforma e-commerce integrata con WhatsApp che consente alle aziende di gestire prodotti, elaborare ordini e comunicare con i clienti tramite agenti AI.",
    "terms.account.title": "3. Account Utente",
    "terms.account.desc": "Devi creare un account per utilizzare ShopME. Sei responsabile di mantenere la sicurezza del tuo account e password. Devi avere almeno 18 anni per utilizzare i nostri servizi.",
    "terms.conduct.title": "4. Condotta dell'Utente",
    "terms.conduct.desc": "Accetti di non utilizzare ShopME per scopi illegali, di non violare i diritti di terzi e di rispettare tutte le leggi applicabili. Ci riserviamo il diritto di sospendere o terminare account che violano questi termini.",
    "terms.payment.title": "5. Pagamenti e Fatturazione",
    "terms.payment.desc": "I prezzi sono basati sul tuo piano di abbonamento e sull'utilizzo. I pagamenti vengono elaborati mensilmente. Puoi annullare l'abbonamento in qualsiasi momento, ma i rimborsi non sono disponibili per i periodi di servizio già fatturati.",
    "terms.ip.title": "6. Proprietà Intellettuale",
    "terms.ip.desc": "Tutti i contenuti e la tecnologia di ShopME sono di proprietà di ShopME o dei suoi licenziatari. Mantieni la proprietà dei tuoi contenuti, ma ci concedi una licenza per utilizzarli per fornire i nostri servizi.",
    "terms.termination.title": "7. Risoluzione",
    "terms.termination.desc": "Possiamo sospendere o terminare il tuo accesso a ShopME in qualsiasi momento per violazione di questi termini o per altri motivi legittimi. Puoi terminare il tuo account in qualsiasi momento dalle impostazioni del tuo account.",
    "terms.limitation.title": "8. Limitazione di Responsabilità",
    "terms.limitation.desc": "ShopME viene fornito 'così com'è'. Non forniamo garanzie di alcun tipo. La nostra responsabilità è limitata all'importo che hai pagato nell'ultimo mese.",
    "terms.changes.title": "9. Modifiche ai Termini",
    "terms.changes.desc": "Possiamo aggiornare questi termini periodicamente. Ti informeremo di modifiche significative via email o tramite notifica sulla piattaforma. L'utilizzo continuato costituisce accettazione dei termini aggiornati.",
    "terms.contact.title": "10. Contattaci",
    "terms.contact.desc": "Per domande su questi Termini di Servizio, contattaci all'indirizzo legal@shopme.com",
  },
  en: {
    // Header
    "header.tagline": "Talk to your customers through their favorite chat",

    // Hero Section
    "hero.title": "Create your AI agent for WhatsApp",
    "hero.subtitle":
      "ShopMe brings intelligent e-commerce directly to WhatsApp. Our AI agent understands customer needs, recommends products, and closes sales 24/7—all through natural conversations.",
    "hero.whyTitle": "Why ShopMe?",

    // Features
    "features.pushNotifications": "Push Notifications",
    "features.pushNotifications.desc":
      "Send targeted campaigns and real-time alerts to your customers via WhatsApp",
    "features.24x7": "24/7 Availability",
    "features.24x7.desc":
      "Never miss a sale—your AI agent works around the clock",
    "features.multiLanguage": "Multi-Language Support",
    "features.multiLanguage.desc":
      "Serve customers in their preferred language automatically",
    "features.ecommerce": "Complete E-commerce Platform",
    "features.ecommerce.desc":
      "Manage products, orders, inventory, and customer relationships in one place",

    // News Section
    "news.title": "Latest Updates and Features",
    "news.subtitle": "Stay informed about the latest ShopMe improvements",
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
      "We offer you the first €29 to test the platform.",
    "pricing.basic.desc": "For growing businesses",
    "pricing.premium.desc": "For established businesses",
    "pricing.enterprise.desc": "For large-scale operations",
    "pricing.usage.title":
      "The following usage-based fees are additional and apply to all plans",
    "pricing.usage.message": "per Message",
    "pricing.usage.message.desc": "After free quota (AI-powered responses)",
    "pricing.usage.customer": "per New Customer",
    "pricing.usage.customer.desc": "Each new customer registration",
    "pricing.usage.order": "per New Order",
    "pricing.usage.order.desc": "Each completed order",
    "pricing.usage.push": "per Push User",
    "pricing.usage.push.desc": "Each promotional message sent",
    "pricing.features.channels": "WhatsApp Channels",
    "pricing.features.channel": "WhatsApp Channel",
    "pricing.features.products": "Products",
    "pricing.features.clients": "Clients",
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
    "login.signin": "Sign In",
    "login.register": "Register",
    "login.welcomeBack": "Welcome Back",
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

    // Forgot Password
    "forgotPassword.title": "Reset Password",
    "forgotPassword.subtitle": "Enter your email to reset your password",
    "forgotPassword.email.placeholder": "admin@shop.me",
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

    // Privacy Policy
    "privacy.title": "Privacy Policy",
    "privacy.lastUpdate": "Last updated",
    "privacy.intro": "ShopME is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and protect your personal data.",
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
    "privacy.contact.desc": "For questions about this Privacy Policy or our data handling practices, contact us at privacy@shopme.com",

    // Terms of Service
    "terms.title": "Terms of Service",
    "terms.lastUpdate": "Last updated",
    "terms.intro": "Welcome to ShopME. By using our services, you agree to be bound by these Terms of Service.",
    "terms.acceptance.title": "1. Acceptance of Terms",
    "terms.acceptance.desc": "By accessing and using ShopME, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, do not use our services.",
    "terms.services.title": "2. Description of Services",
    "terms.services.desc": "ShopME provides a WhatsApp-integrated e-commerce platform that enables businesses to manage products, process orders, and communicate with customers through AI agents.",
    "terms.account.title": "3. User Accounts",
    "terms.account.desc": "You must create an account to use ShopME. You are responsible for maintaining the security of your account and password. You must be at least 18 years old to use our services.",
    "terms.conduct.title": "4. User Conduct",
    "terms.conduct.desc": "You agree not to use ShopME for illegal purposes, violate third-party rights, or breach any applicable laws. We reserve the right to suspend or terminate accounts that violate these terms.",
    "terms.payment.title": "5. Payment and Billing",
    "terms.payment.desc": "Pricing is based on your subscription plan and usage. Payments are processed monthly. You may cancel your subscription at any time, but refunds are not available for already billed service periods.",
    "terms.ip.title": "6. Intellectual Property",
    "terms.ip.desc": "All ShopME content and technology are owned by ShopME or its licensors. You retain ownership of your content but grant us a license to use it to provide our services.",
    "terms.termination.title": "7. Termination",
    "terms.termination.desc": "We may suspend or terminate your access to ShopME at any time for violation of these terms or other legitimate reasons. You may terminate your account at any time from your account settings.",
    "terms.limitation.title": "8. Limitation of Liability",
    "terms.limitation.desc": "ShopME is provided 'as is'. We make no warranties of any kind. Our liability is limited to the amount you paid in the last month.",
    "terms.changes.title": "9. Changes to Terms",
    "terms.changes.desc": "We may update these terms periodically. We will notify you of significant changes via email or platform notification. Continued use constitutes acceptance of updated terms.",
    "terms.contact.title": "10. Contact Us",
    "terms.contact.desc": "For questions about these Terms of Service, contact us at legal@shopme.com",
  },
  es: {
    // Header
    "header.tagline": "Habla con tus clientes a través de la sua chat favorita",

    // Hero Section
    "hero.title": "Crea tu agente AI para WhatsApp",
    "hero.subtitle":
      "ShopMe lleva el e-commerce inteligente directamente a WhatsApp. Nuestro agente de IA comprende las necesidades del cliente, recomienda productos y cierra ventas 24/7—todo a través de conversaciones naturales.",
    "hero.whyTitle": "¿Por qué ShopMe?",

    // Features
    "features.pushNotifications": "Push Notifications",
    "features.pushNotifications.desc":
      "Envía campañas dirigidas y alertas en tiempo real a tus clientes a través de WhatsApp",
    "features.24x7": "24/7 Availability",
    "features.24x7.desc":
      "Nunca pierdas una venta—tu agente de IA trabaja las 24 horas",
    "features.multiLanguage": "Multi-Language Support",
    "features.multiLanguage.desc":
      "Atiende a los clientes en su idioma preferido automáticamente",
    "features.ecommerce": "Complete E-commerce Platform",
    "features.ecommerce.desc":
      "Gestiona productos, pedidos, inventario y relaciones con clientes en un solo lugar",

    // News Section
    "news.title": "Últimas Actualizaciones y Funcionalidades",
    "news.subtitle": "Mantente informado sobre las últimas mejoras de ShopMe",
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
      "Te ofrecemos los primeros 29€ para probar la plataforma.",
    "pricing.basic.desc": "Para empresas en crecimiento",
    "pricing.premium.desc": "Para empresas consolidadas",
    "pricing.enterprise.desc": "Para operaciones a gran escala",
    "pricing.usage.title":
      "Las siguientes tarifas por uso son adicionales y se aplican a todos los planes",
    "pricing.usage.message": "por Mensaje",
    "pricing.usage.message.desc":
      "Después de la cuota gratuita (respuestas impulsadas por IA)",
    "pricing.usage.customer": "por Nuevo Cliente",
    "pricing.usage.customer.desc": "Cada nueva registro de cliente",
    "pricing.usage.order": "por Nuevo Pedido",
    "pricing.usage.order.desc": "Cada pedido completado",
    "pricing.usage.push": "por Usuario Push",
    "pricing.usage.push.desc": "Cada mensaje promocional enviado",
    "pricing.features.channels": "Canales WhatsApp",
    "pricing.features.channel": "Canal WhatsApp",
    "pricing.features.products": "Productos",
    "pricing.features.clients": "Clientes",
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
    "login.signin": "Iniciar Sesión",
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

    // Forgot Password
    "forgotPassword.title": "Restablecer Contraseña",
    "forgotPassword.subtitle": "Ingresa tu correo para restablecer tu contraseña",
    "forgotPassword.email.placeholder": "admin@shop.me",
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

    // Privacy Policy
    "privacy.title": "Política de Privacidad",
    "privacy.lastUpdate": "Última actualización",
    "privacy.intro": "ShopME se compromete a proteger su privacidad. Esta Política de Privacidad explica cómo recopilamos, usamos y protegemos sus datos personales.",
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
    "privacy.contact.desc": "Para preguntas sobre esta Política de Privacidad o nuestras prácticas de manejo de datos, contáctenos en privacy@shopme.com",

    // Terms of Service
    "terms.title": "Términos de Servicio",
    "terms.lastUpdate": "Última actualización",
    "terms.intro": "Bienvenido a ShopME. Al usar nuestros servicios, acepta estar sujeto a estos Términos de Servicio.",
    "terms.acceptance.title": "1. Aceptación de los Términos",
    "terms.acceptance.desc": "Al acceder y usar ShopME, acepta estar sujeto a estos Términos de Servicio y nuestra Política de Privacidad. Si no acepta estos términos, no use nuestros servicios.",
    "terms.services.title": "2. Descripción de Servicios",
    "terms.services.desc": "ShopME proporciona una plataforma de comercio electrónico integrada con WhatsApp que permite a las empresas gestionar productos, procesar pedidos y comunicarse con clientes a través de agentes de IA.",
    "terms.account.title": "3. Cuentas de Usuario",
    "terms.account.desc": "Debe crear una cuenta para usar ShopME. Es responsable de mantener la seguridad de su cuenta y contraseña. Debe tener al menos 18 años para usar nuestros servicios.",
    "terms.conduct.title": "4. Conducta del Usuario",
    "terms.conduct.desc": "Acepta no usar ShopME para propósitos ilegales, violar derechos de terceros o incumplir leyes aplicables. Nos reservamos el derecho de suspender o terminar cuentas que violen estos términos.",
    "terms.payment.title": "5. Pago y Facturación",
    "terms.payment.desc": "Los precios se basan en su plan de suscripción y uso. Los pagos se procesan mensualmente. Puede cancelar su suscripción en cualquier momento, pero los reembolsos no están disponibles para períodos de servicio ya facturados.",
    "terms.ip.title": "6. Propiedad Intelectual",
    "terms.ip.desc": "Todo el contenido y tecnología de ShopME son propiedad de ShopME o sus licenciantes. Conserva la propiedad de su contenido pero nos otorga una licencia para usarlo para proporcionar nuestros servicios.",
    "terms.termination.title": "7. Terminación",
    "terms.termination.desc": "Podemos suspender o terminar su acceso a ShopME en cualquier momento por violación de estos términos u otras razones legítimas. Puede terminar su cuenta en cualquier momento desde la configuración de su cuenta.",
    "terms.limitation.title": "8. Limitación de Responsabilidad",
    "terms.limitation.desc": "ShopME se proporciona 'tal cual'. No ofrecemos garantías de ningún tipo. Nuestra responsabilidad se limita a la cantidad que pagó en el último mes.",
    "terms.changes.title": "9. Cambios en los Términos",
    "terms.changes.desc": "Podemos actualizar estos términos periódicamente. Le notificaremos de cambios significativos por correo electrónico o notificación en la plataforma. El uso continuado constituye aceptación de los términos actualizados.",
    "terms.contact.title": "10. Contáctenos",
    "terms.contact.desc": "Para preguntas sobre estos Términos de Servicio, contáctenos en legal@shopme.com",
  },
  pt: {
    // Header
    "header.tagline": "Fale com seus clientes através do chat favorito deles",

    // Hero Section
    "hero.title": "Crie seu agente AI para WhatsApp",
    "hero.subtitle":
      "ShopMe traz e-commerce inteligente diretamente para o WhatsApp. Nosso agente de IA entende as necessidades do cliente, recomenda produtos e fecha vendas 24/7—tudo através de conversas naturais.",
    "hero.whyTitle": "Por que ShopMe?",

    // Features
    "features.pushNotifications": "Push Notifications",
    "features.pushNotifications.desc":
      "Envie campanhas direcionadas e alertas em tempo real para seus clientes via WhatsApp",
    "features.24x7": "24/7 Availability",
    "features.24x7.desc":
      "Nunca perca uma venda—seu agente de IA funciona 24 horas por dia",
    "features.multiLanguage": "Multi-Language Support",
    "features.multiLanguage.desc":
      "Atenda clientes em seu idioma preferido automaticamente",
    "features.ecommerce": "Complete E-commerce Platform",
    "features.ecommerce.desc":
      "Gerencie produtos, pedidos, estoque e relacionamento com clientes em um só lugar",

    // News Section
    "news.title": "Últimas Atualizações e Funcionalidades",
    "news.subtitle": "Fique informado sobre as últimas melhorias do ShopMe",
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
      "Oferecemos os primeiros €29 para testar a plataforma.",
    "pricing.basic.desc": "Para empresas em crescimento",
    "pricing.premium.desc": "Para empresas estabelecidas",
    "pricing.enterprise.desc": "Para operações em grande escala",
    "pricing.usage.title":
      "As seguintes taxas por uso são adicionais e se aplicam a todos os planos",
    "pricing.usage.message": "por Mensagem",
    "pricing.usage.message.desc":
      "Após a cota gratuita (respostas alimentadas por IA)",
    "pricing.usage.customer": "por Novo Cliente",
    "pricing.usage.customer.desc": "Cada novo registro de cliente",
    "pricing.usage.order": "por Novo Pedido",
    "pricing.usage.order.desc": "Cada pedido concluído",
    "pricing.usage.push": "por Usuário Push",
    "pricing.usage.push.desc": "Cada mensagem promocional enviada",
    "pricing.features.channels": "Canais WhatsApp",
    "pricing.features.channel": "Canal WhatsApp",
    "pricing.features.products": "Produtos",
    "pricing.features.clients": "Clientes",
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
    "login.signin": "Entrar",
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

    // Forgot Password
    "forgotPassword.title": "Redefinir Senha",
    "forgotPassword.subtitle": "Digite seu e-mail para redefinir sua senha",
    "forgotPassword.email.placeholder": "admin@shop.me",
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

    // Privacy Policy
    "privacy.title": "Política de Privacidade",
    "privacy.lastUpdate": "Última atualização",
    "privacy.intro": "ShopME está comprometido em proteger sua privacidade. Esta Política de Privacidade explica como coletamos, usamos e protegemos seus dados pessoais.",
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
    "privacy.contact.desc": "Para perguntas sobre esta Política de Privacidade ou nossas práticas de tratamento de dados, entre em contato conosco em privacy@shopme.com",

    // Terms of Service
    "terms.title": "Termos de Serviço",
    "terms.lastUpdate": "Última atualização",
    "terms.intro": "Bem-vindo ao ShopME. Ao usar nossos serviços, você concorda em estar vinculado a estes Termos de Serviço.",
    "terms.acceptance.title": "1. Aceitação dos Termos",
    "terms.acceptance.desc": "Ao acessar e usar o ShopME, você concorda em estar vinculado a estes Termos de Serviço e nossa Política de Privacidade. Se você não concorda com estes termos, não use nossos serviços.",
    "terms.services.title": "2. Descrição dos Serviços",
    "terms.services.desc": "ShopME fornece uma plataforma de comércio eletrônico integrada ao WhatsApp que permite às empresas gerenciar produtos, processar pedidos e se comunicar com clientes através de agentes de IA.",
    "terms.account.title": "3. Contas de Usuário",
    "terms.account.desc": "Você deve criar uma conta para usar o ShopME. Você é responsável por manter a segurança de sua conta e senha. Você deve ter pelo menos 18 anos para usar nossos serviços.",
    "terms.conduct.title": "4. Conduta do Usuário",
    "terms.conduct.desc": "Você concorda em não usar o ShopME para propósitos ilegais, violar direitos de terceiros ou descumprir leis aplicáveis. Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos.",
    "terms.payment.title": "5. Pagamento e Faturamento",
    "terms.payment.desc": "Os preços são baseados em seu plano de assinatura e uso. Os pagamentos são processados mensalmente. Você pode cancelar sua assinatura a qualquer momento, mas reembolsos não estão disponíveis para períodos de serviço já faturados.",
    "terms.ip.title": "6. Propriedade Intelectual",
    "terms.ip.desc": "Todo o conteúdo e tecnologia do ShopME são propriedade do ShopME ou de seus licenciadores. Você mantém a propriedade de seu conteúdo, mas nos concede uma licença para usá-lo para fornecer nossos serviços.",
    "terms.termination.title": "7. Rescisão",
    "terms.termination.desc": "Podemos suspender ou encerrar seu acesso ao ShopME a qualquer momento por violação destes termos ou outras razões legítimas. Você pode encerrar sua conta a qualquer momento nas configurações de sua conta.",
    "terms.limitation.title": "8. Limitação de Responsabilidade",
    "terms.limitation.desc": "ShopME é fornecido 'como está'. Não fazemos garantias de qualquer tipo. Nossa responsabilidade é limitada ao valor que você pagou no último mês.",
    "terms.changes.title": "9. Alterações nos Termos",
    "terms.changes.desc": "Podemos atualizar estes termos periodicamente. Notificaremos você de mudanças significativas por e-mail ou notificação na plataforma. O uso continuado constitui aceitação dos termos atualizados.",
    "terms.contact.title": "10. Entre em Contato",
    "terms.contact.desc": "Para perguntas sobre estes Termos de Serviço, entre em contato conosco em legal@shopme.com",
  },
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("language")
    return (saved as Language) || "it" // 🇮🇹 Default: Italiano
  })

  useEffect(() => {
    localStorage.setItem("language", language)
  }, [language])

  const setLanguage = (lang: Language) => {
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
