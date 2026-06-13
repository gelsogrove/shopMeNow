import { useState } from "react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { GlowCard } from "@/components/ui/glow-card"
import { GreenCtaButton } from "@/components/ui/green-cta-button"
import { Input } from "@/components/ui/input"
import axios from "axios"
import { useLanguage } from "@/contexts/LanguageContext"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SEO } from "@/components/SEO"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1"

// ─────────────────────────────────────────
// Survey translations (self-contained, not in global LanguageContext)
// ─────────────────────────────────────────
type Lang = "it" | "en" | "es" | "de"

const QT: Record<Lang, Record<string, string>> = {
  it: {
    // Intro
    intro_title: "Aiutaci a costruire il chatbot perfetto per te",
    intro_desc: "Il segreto di un buon chatbot è la qualità delle risposte. Rispondi a qualche domanda sulle tue esigenze — supporto umano, marketing push, widget, vendite, e-commerce e privacy — e ti mostreremo come eChatbot può fare la differenza.\nCirca 2 minuti, zero impegno.",
    intro_cta: "Avvia il survey →",
    back: "← Indietro",
    next: "Avanti →",
    almost: "Quasi fatto →",
    step_of: "Passo {current} di {total}",

    // Step 0: Industry
    industry_title: "Il tuo settore",
    industry_q: "In quale settore opera la tua attività? Ci aiuta a capire subito il contesto e personalizzare al meglio la demo per te.",
    industry_opt1: "Immobiliare",
    industry_opt2: "Alimentare & Ristorazione",
    industry_opt3: "Medico & Sanitario",
    industry_opt4: "Bellezza & Benessere",
    industry_opt5: "Formazione",
    industry_opt6: "Turismo",
    industry_opt7: "Moda",
    industry_opt8: "Fitness",
    industry_opt9: "Trasporti",
    industry_opt10: "Legale",
    industry_opt11: "Altro",
    industry_other_placeholder: "Specifica il tuo settore…",

    // Step 0: Main Goal
    goal_title: "Obiettivo principale",
    goal_q: "Qual è il tuo obiettivo principale con un chatbot? Questo ci permette di mostrarti subito le funzionalità più rilevanti per te.",
    goal_opt1: "Ridurre le richieste di supporto clienti",
    goal_opt2: "Generare e qualificare lead",
    goal_opt3: "Aumentare le vendite online",
    goal_opt4: "Gestire prenotazioni e appuntamenti",
    goal_opt5: "Inviare comunicazioni e promemoria ai clienti",

    // Step 1: Human Support
    humanSupport_title: "Supporto Umano",
    humanSupport_q: "Uno dei punti di forza di eChatbot è il passaggio intelligente da AI a operatore umano, senza perdere il contesto della conversazione. Quando un cliente ha un problema complesso, l'agente AI trasferisce immediatamente la chat a un operatore che riceve una notifica WhatsApp con tutta la cronologia. Vorresti questa capacità integrata nel tuo chatbot?",
    humanSupport_opt1: "Sì, voglio il passaggio a operatore umano",
    humanSupport_opt2: "L'automazione completa va bene",

    // Step 2: Push Marketing
    pushMarketing_title: "Marketing Push",
    pushMarketing_q: "Le notifiche push su WhatsApp hanno un tasso di apertura superiore al 90%. Ma la vera differenza è la personalizzazione intelligente: l'IA invia solo ciò che ogni cliente vuole davvero ricevere. Se per esempio un cliente cerca un monolocale a Barcellona, riceverà solo nuovi annunci nella sua zona o aggiornamenti di prezzo su immobili simili, mai messaggi irrilevanti. Zero spam, massima rilevanza.",
    pushMarketing_opt1: "Sì, sono interessato",
    pushMarketing_opt2: "Magari in un secondo momento",
    pushMarketing_opt3: "Non mi interessa",

    // Step: Reminders & Scheduling
    reminders_title: "Promemoria e Appuntamenti",
    reminders_q: "Devi impostare dei promemoria ai tuoi clienti? Come scadenze di pagamento, riunioni o appuntamenti? Grazie alla feature di scheduling di eChatbot puoi automatizzare invii mirati su WhatsApp nel momento giusto, per ogni cliente.",
    reminders_opt1: "Sì, mi interessa",
    reminders_opt2: "No, non mi interessa",

    // Step: Demo request — closing ask. "Sì" → vogliamo inviargli la demo.
    demo_title: "Prova la nostra demo",
    demo_q: "Vuoi che ti inviamo una demo per testare il nostro prodotto? Ti manderemo le credenziali di accesso via email, così potrai provare eChatbot in prima persona.",
    demo_opt1: "Sì, inviatemi la demo",
    demo_opt2: "No, per ora no",

    // Step 3: Widget
    widget_title: "Chat Widget",
    widget_q: "Il Widget di eChatbot permette di integrare una chat intelligente direttamente nel tuo sito web, utilizzando lo stesso chatbot che hai configurato per WhatsApp. I visitanti possono iniziare una conversazione senza lasciare il sito e il chatbot risponde in tempo reale.",
    widget_opt1: "Sì, voglio il widget sul mio sito",
    widget_opt2: "Solo WhatsApp, senza widget",
    widget_opt3: "Entrambi: widget + WhatsApp",

    // Step 2 (moved): Sales Team
    salesAgents_title: "Team di Vendita",
    salesAgents_q: "eChatbot ti permette di creare un vero team di vendita digitale: puoi registrare i tuoi collaboratori come agenti di vendita, ognuno con il proprio profilo e area di competenza. Quando un cliente è pronto all'acquisto o ha bisogno di assistenza personalizzata, l'IA passa la chat direttamente all'agente giusto del tuo staff, che riceve una notifica istantanea e interviene in tempo reale, con tutta la cronologia della conversazione. Questa funzionalità è pensata per le aziende con un team commerciale. Hai collaboratori dedicati alle vendite?",
    salesAgents_opt1: "Sì, ho un team di vendita",
    salesAgents_opt2: "No, gestisco tutto in autonomia",

    // Step 5: Ecommerce
    ecommerce_title: "E-Commerce",
    ecommerce_q: "eChatbot ha un motore e-commerce integrato che permette ai clienti di sfogliare il catalogo, aggiungere prodotti al carrello e completare gli ordini direttamente in chat, su WhatsApp o widget. Se hai già un negozio online o stai pianificando di avviarne uno, possiamo integrarlo o costruirne uno nuovo. La tua attività vende prodotti o servizi online?",
    ecommerce_opt1: "Sì, ho già un e-commerce",
    ecommerce_opt2: "No, non vendo online",
    ecommerce_opt3: "Sto pianificando di iniziare",

    // Step 6: Ecommerce Platform (conditional)
    ecommercePlatform_title: "Piattaforma E-Commerce",
    ecommercePlatform_q: "Ottimo! eChatbot si integra con le principali piattaforme e-commerce: possiamo importare il catalogo prodotti, i prezzi e la disponibilità per renderli accessibili al chatbot. Quale piattaforma stai usando?",
    ecommercePlatform_opt1: "WordPress / WooCommerce",
    ecommercePlatform_opt2: "PrestaShop",
    ecommercePlatform_opt3: "Magento / Adobe Commerce",
    ecommercePlatform_opt4: "Altra piattaforma",

    // Step 7: External integrations
    integrations_title: "Integrazioni Esterne (RAG)",
    integrations_q: "Il tuo business usa sistemi esterni come CRM (Salesforce, HubSpot), ERP, software gestionale o altri strumenti aziendali? eChatbot può integrarsi con questi sistemi tramite sviluppo personalizzato: importiamo e mappiamo i tuoi dati in modo che il chatbot abbia sempre le informazioni aggiornate.",
    integrations_opt1: "Sì, ho sistemi da integrare",
    integrations_opt2: "Non uso sistemi esterni",

    // Step 8: Privacy
    privacy_title: "Privacy e Sicurezza",
    privacy_q: "Comprendiamo che la privacy dei tuoi clienti è fondamentale. eChatbot è progettato con la privacy al centro: non inviamo mai dati sensibili dei clienti ai modelli AI. Le informazioni personali (contatti, ordini, pagamenti) rimangono sempre nel tuo database. Per le operazioni sensibili usiamo link con token temporizzati, accessibili solo dall'utente interessato.",
    privacy_opt1: "Sì, mi convince",
    privacy_opt2: "Ho ancora dei dubbi",

    // Step 9: On-Premise
    onPremise_title: "Service On-Premise",
    onPremise_q: "eChatbot è disponibile anche in modalità on-premise: l'intera piattaforma, backend, database e motore AI, viene installata direttamente sui server del cliente o nella sua infrastruttura cloud privata. Questa soluzione è ideale per aziende con requisiti di conformità avanzati (settore bancario, sanitario, legale o governativo), politiche IT rigide, o semplicemente per chi vuole piena indipendenza e controllo senza dipendere da servizi esterni.",
    onPremise_opt1: "Sì, mi interessa",
    onPremise_opt2: "Il servizio cloud su eChatbot.AI è abbastanza",
    onPremise_opt3: "Magari più avanti",

    // Step 10: Interest rating
    interest_title: "Quanto sei interessato?",
    interest_q: "Onestamente, quanto sei interessato a eChatbot per la tua attività? Seleziona da 0 (per niente) a 5 (molto interessato).\n\nSe selezioni 0, non ti chiediamo nessun dato personale. Se sei interessato, ti mostreremo una breve form di contatto — ci permetteremo di contattarti nei prossimi giorni per capire come possiamo aiutarci a vicenda.",

    // Step 10: Other (textarea)
    other_title: "Ci siamo quasi!",
    other_q: "Abbiamo capito! Costruiremo un chatbot AI su misura per il tuo business. C'è qualcos'altro che vorresti comunicarci? Un'integrazione specifica, una funzionalità che hai in mente, un caso d'uso particolare? Qualsiasi dettaglio ci aiuta a creare qualcosa di davvero utile per te.",
    other_placeholder: "Scrivi qui le tue idee o domande… (opzionale)",

    // Step 10: Contact consent
    contact_title: "Parliamo insieme",
    contact_q: "Grazie per aver completato il survey! Le tue risposte ci aiuteranno a costruire un chatbot su misura per te. Saresti disponibile per una breve chiamata con il nostro team? Ti mostreremmo una demo personalizzata e risponderemmo a tutte le tue domande, senza impegno.",
    contact_opt1: "Sì, contattatemi!",
    contact_opt2: "No, ma grazie per le informazioni",

    // Contact form
    form_title: "Come ti contatto?",
    form_desc: "Lascia i tuoi dati e ti contatteremo entro 24 ore per organizzare una demo personalizzata.",
    form_fullName: "Nome e Cognome *",
    form_email: "Email *",
    form_phone: "Telefono",
    form_company: "Azienda",
    form_submit: "Invia →",
    form_submitting: "Invio in corso…",
    form_error: "Qualcosa è andato storto. Riprova.",

    // Success
    success_title: "Grazie!",
    success_desc: "Abbiamo ricevuto le tue risposte. Il nostro team ti contatterà presto per una demo personalizzata di eChatbot.",
    success_cta: "Torna alla homepage",

    // No-contact thank you
    noContact_title: "Grazie mille!",
    noContact_desc: "Apprezziamo il tempo che hai dedicato a rispondere. Le tue risposte ci aiuteranno a migliorare eChatbot. Se cambi idea, siamo sempre disponibili, trovi il link di contatto nella homepage.",
    noContact_cta: "Torna alla homepage",

    // Try chatbot CTA
    try_chatbot: "Hai dubbi o domande? Prova il nostro chatbot su WhatsApp!",
    try_chatbot_button: "Chatta con noi",
  },

  en: {
    intro_title: "Help us build the perfect chatbot for you",
    intro_desc: "The secret to a great chatbot is the quality of its answers. Answer a few questions about your needs — human support, push marketing, widget, sales, e-commerce and privacy — and we'll show you how eChatbot can make the difference.\nAbout 2 minutes, no commitment.",
    intro_cta: "Start the survey →",
    back: "← Back",
    next: "Next →",
    almost: "Almost done →",
    step_of: "Step {current} of {total}",

    industry_title: "Your industry",
    industry_q: "Which industry does your business operate in? This helps us understand your context straight away and tailor the demo for you.",
    industry_opt1: "Real Estate",
    industry_opt2: "Food & Hospitality",
    industry_opt3: "Medical & Healthcare",
    industry_opt4: "Beauty & Wellness",
    industry_opt5: "Education & Training",
    industry_opt6: "Tourism",
    industry_opt7: "Fashion",
    industry_opt8: "Fitness",
    industry_opt9: "Transport",
    industry_opt10: "Legal",
    industry_opt11: "Other",
    industry_other_placeholder: "Specify your industry…",

    goal_title: "Main objective",
    goal_q: "What is your main goal with a chatbot? This lets us show you the most relevant features straight away.",
    goal_opt1: "Reduce customer support requests",
    goal_opt2: "Generate and qualify leads",
    goal_opt3: "Increase online sales",
    goal_opt4: "Manage bookings and appointments",
    goal_opt5: "Send communications and reminders to customers",

    humanSupport_title: "Human Support",
    humanSupport_q: "One of eChatbot's strengths is the intelligent handoff from AI to a human agent, without losing conversation context. When a customer has a complex issue, the AI agent instantly transfers the chat to an operator who receives a WhatsApp notification with the full conversation history. Would you like this capability integrated into your chatbot?",
    humanSupport_opt1: "Yes, I want human handoff capability",
    humanSupport_opt2: "Full automation works for me",

    pushMarketing_title: "Push Marketing",
    pushMarketing_q: "WhatsApp push notifications have an open rate above 90%. But the real difference is intelligent personalization: the AI sends only what each customer genuinely wants to receive. If for example a customer is looking for a studio flat in Barcelona, they'll only get new listings in their area or price drops on similar properties, never irrelevant messages. Zero spam, maximum relevance.",
    pushMarketing_opt1: "Yes, I'm interested",
    pushMarketing_opt2: "Maybe later",
    pushMarketing_opt3: "Not interested",

    reminders_title: "Reminders & Appointments",
    reminders_q: "Do you need to set reminders for your customers? Such as payment deadlines, meetings or appointments? With eChatbot's scheduling feature you can automate targeted WhatsApp messages at exactly the right moment, for each individual customer.",
    reminders_opt1: "Yes, I'm interested",
    reminders_opt2: "No, not interested",

    // Step: Demo request — closing ask. "Yes" → we want to send them the demo.
    demo_title: "Try our demo",
    demo_q: "Want us to send you a demo to test our product? We'll email you the access credentials so you can try eChatbot first-hand.",
    demo_opt1: "Yes, send me the demo",
    demo_opt2: "No, not for now",

    widget_title: "Chat Widget",
    widget_q: "eChatbot's Widget lets you integrate a smart chat directly into your website, using the same chatbot you've configured for WhatsApp. Visitors can start a conversation without leaving your site, and the chatbot responds in real time.",
    widget_opt1: "Yes, I want a widget on my website",
    widget_opt2: "WhatsApp only, no widget needed",
    widget_opt3: "Both: website widget + WhatsApp",

    salesAgents_title: "Sales Team",
    salesAgents_q: "eChatbot lets you build a real digital sales team: you can register your team members as sales agents, each with their own profile and area of expertise. When a customer is ready to buy or needs personalised assistance, the AI hands off the chat directly to the right agent on your staff, who gets an instant notification and steps in with the full conversation history. This feature is designed for businesses with a commercial team. Do you have staff dedicated to sales?",
    salesAgents_opt1: "Yes, I have a sales team",
    salesAgents_opt2: "No, I handle everything myself",

    ecommerce_title: "E-Commerce",
    ecommerce_q: "eChatbot has a built-in e-commerce engine that lets customers browse the catalog, add products to cart, and complete orders directly in chat, on WhatsApp or the widget. If you already have an online store or are planning to launch one, we can integrate it or build a new one. Does your business sell products or services online?",
    ecommerce_opt1: "Yes, I already have an e-commerce",
    ecommerce_opt2: "No, I don't sell online",
    ecommerce_opt3: "I'm planning to start",

    ecommercePlatform_title: "E-Commerce Platform",
    ecommercePlatform_q: "Great! eChatbot integrates with all major e-commerce platforms: we can import your product catalog, prices, and availability to make them accessible to the chatbot. Which platform are you using?",
    ecommercePlatform_opt1: "WordPress / WooCommerce",
    ecommercePlatform_opt2: "PrestaShop",
    ecommercePlatform_opt3: "Magento / Adobe Commerce",
    ecommercePlatform_opt4: "Other platform",

    // Step 7: External integrations
    integrations_title: "External Integrations (RAG)",
    integrations_q: "Does your business use external systems such as a CRM (Salesforce, HubSpot), ERP, management software, or other business tools? eChatbot can integrate with these systems through custom development: we import and map your data so the chatbot always has up-to-date information.",
    integrations_opt1: "Yes, I have systems to integrate",
    integrations_opt2: "I don't use external systems",

    // Step 8: Privacy
    privacy_title: "Privacy and Security",
    privacy_q: "We understand that your customers' privacy is paramount. eChatbot is designed with privacy at its core: we never send sensitive customer data to AI models. Personal information (contacts, orders, payments) always stays in your database. For sensitive operations we use time-limited token links, accessible only by the specific user.",
    privacy_opt1: "Yes, I'm convinced",
    privacy_opt2: "I still have some doubts",

    // Step 9: On-Premise
    onPremise_title: "Service On-Premise",
    onPremise_q: "eChatbot is also available as an on-premise solution: the entire platform, backend, database, and AI engine, is installed directly on the client's servers or private cloud infrastructure. This is ideal for organisations with strict compliance requirements (banking, healthcare, legal, or government sectors), rigid IT policies, or anyone who wants complete independence from external services.",
    onPremise_opt1: "Yes, I'm interested",
    onPremise_opt2: "The cloud service on eChatbot.AI is enough",
    onPremise_opt3: "Maybe later",

    // Step 10: Interest rating
    interest_title: "How interested are you?",
    interest_q: "Honestly, how interested are you in eChatBot for your business? Select from 0 (not at all) to 5 (very interested).\n\nIf you select 0, we won't ask for any personal data. If you are interested, we'll show you a short contact form — we'll reach out in the coming days to see how we can help each other.",

    // Step 10: Other (textarea)
    other_title: "Almost There!",
    other_q: "Got it! We'll build a custom AI chatbot tailored to your business. Is there anything else you'd like to tell us? A specific integration, a feature you have in mind, a particular use case? Any detail helps us create something truly useful for you.",
    other_placeholder: "Write your ideas or questions here… (optional)",

    contact_title: "Let's Talk",
    contact_q: "Thank you for completing the survey! Your answers will help us build a chatbot tailored to your needs. Would you be available for a brief call with our team? We'd show you a personalised demo and answer all your questions, no commitment required.",
    contact_opt1: "Yes, please contact me!",
    contact_opt2: "No, but thank you for the information",

    form_title: "How can we reach you?",
    form_desc: "Leave your details and we'll get back to you within 24 hours to arrange a personalised demo.",
    form_fullName: "Full Name *",
    form_email: "Email *",
    form_phone: "Phone",
    form_company: "Company",
    form_submit: "Submit →",
    form_submitting: "Sending…",
    form_error: "Something went wrong. Please try again.",

    success_title: "Thank you!",
    success_desc: "We've received your answers. Our team will contact you shortly for a personalised eChatbot demo.",
    success_cta: "Back to homepage",

    noContact_title: "Thank you so much!",
    noContact_desc: "We appreciate the time you took to respond. Your answers will help us improve eChatbot. If you change your mind, we're always here, find the contact link on the homepage.",
    noContact_cta: "Back to homepage",

    // Try chatbot CTA
    try_chatbot: "Have doubts or questions? Try our chatbot on WhatsApp!",
    try_chatbot_button: "Chat with us",
  },

  es: {
    intro_title: "Ayúdanos a construir el chatbot perfecto para ti",
    intro_desc: "El secreto de un buen chatbot es la calidad de sus respuestas. Responde a algunas preguntas sobre tus necesidades — soporte humano, marketing push, widget, ventas, e-commerce y privacidad — y te mostraremos cómo eChatbot puede marcar la diferencia.\nUnos 2 minutos, sin compromiso.",
    intro_cta: "Iniciar el survey →",
    back: "← Atrás",
    next: "Siguiente →",
    almost: "¡Ya casi! →",
    step_of: "Paso {current} de {total}",

    industry_title: "Tu sector",
    industry_q: "¿en qué sector opera tu negocio? Nos ayuda a entender el contexto de inmediato y a personalizar la demo para ti.",
    industry_opt1: "Inmobiliario",
    industry_opt2: "Alimentación & Hostelería",
    industry_opt3: "Médico & Salud",
    industry_opt4: "Belleza & Bienestar",
    industry_opt5: "Formación",
    industry_opt6: "Turismo",
    industry_opt7: "Moda",
    industry_opt8: "Fitness",
    industry_opt9: "Transporte",
    industry_opt10: "Legal",
    industry_opt11: "Otro",
    industry_other_placeholder: "Especifica tu sector…",

    goal_title: "Objetivo principal",
    goal_q: "¿Cuál es tu objetivo principal con un chatbot? Esto nos permite mostrarte de inmediato las funciones más relevantes para ti.",
    goal_opt1: "Reducir las solicitudes de soporte al cliente",
    goal_opt2: "Generar y calificar leads",
    goal_opt3: "Aumentar las ventas online",
    goal_opt4: "Gestionar reservas y citas",
    goal_opt5: "Enviar comunicaciones y recordatorios a clientes",

    humanSupport_title: "Soporte Humano",
    humanSupport_q: "Una de las fortalezas de eChatbot es la transferencia inteligente de la IA a un agente humano, sin perder el contexto de la conversación. Cuando un cliente tiene un problema complejo, el agente de IA transfiere inmediatamente el chat a un operador que recibe una notificación de WhatsApp con todo el historial. ¿Te gustaría tener esta capacidad integrada en tu chatbot?",
    humanSupport_opt1: "Sí, quiero transferencias a operador humano",
    humanSupport_opt2: "La automatización completa me funciona",

    pushMarketing_title: "Marketing Push",
    pushMarketing_q: "Las notificaciones push de WhatsApp tienen una tasa de apertura superior al 90%. Pero la verdadera diferencia es la personalización inteligente: la IA se encarga de enviar solo lo que cada cliente realmente quiere recibir. Si por ejemplo un cliente busca un estudio en Barcelona, solo recibirá nuevos anuncios en su zona o cambios de precio en propiedades similares, nunca mensajes irrelevantes. Cero spam, máxima relevancia.",
    pushMarketing_opt1: "Sí, estoy interesado",
    pushMarketing_opt2: "Quizás más adelante",
    pushMarketing_opt3: "No me interesa",

    reminders_title: "Recordatorios y Citas",
    reminders_q: "¿Necesitas configurar recordatorios para tus clientes? ¿Como vencimientos de pagos, reuniones o citas? Con la función de scheduling de eChatbot puedes automatizar envíos dirigidos por WhatsApp en el momento adecuado, para cada cliente.",
    reminders_opt1: "Sí, me interesa",
    reminders_opt2: "No, no me interesa",

    // Step: Demo request — closing ask. "Sí" → queremos enviarle la demo.
    demo_title: "Prueba nuestra demo",
    demo_q: "¿Quieres que te enviemos una demo para probar nuestro producto? Te mandaremos las credenciales de acceso por email para que pruebes eChatbot en primera persona.",
    demo_opt1: "Sí, envíame la demo",
    demo_opt2: "No, por ahora no",

    widget_title: "Widget de Chat",
    widget_q: "El Widget de eChatbot permite integrar un chat inteligente directamente en tu sitio web, utilizando el mismo chatbot que has configurado para WhatsApp. Los visitantes pueden iniciar una conversación sin salir del sitio y el chatbot responde en tiempo real.",
    widget_opt1: "Sí, quiero el widget en mi web",
    widget_opt2: "Solo WhatsApp, sin widget",
    widget_opt3: "Ambos: widget + WhatsApp",

    salesAgents_title: "Equipo de Ventas",
    salesAgents_q: "eChatbot te permite crear un verdadero equipo de ventas digital: puedes registrar a tus colaboradores como agentes de ventas, cada uno con su perfil y área de especialización. Cuando un cliente está listo para comprar o necesita asistencia personalizada, la IA transfiere el chat directamente al agente adecuado de tu equipo, que recibe una notificación instantánea e interviene con el historial completo de la conversación. Esta funcionalidad está diseñada para empresas con un equipo comercial. ¿Tienes colaboradores dedicados a las ventas?",
    salesAgents_opt1: "Sí, tengo un equipo de ventas",
    salesAgents_opt2: "No, lo gestiono todo yo solo",

    ecommerce_title: "E-Commerce",
    ecommerce_q: "eChatbot tiene un motor de e-commerce integrado que permite a los clientes explorar el catálogo, añadir productos al carrito y completar pedidos directamente en el chat, en WhatsApp o en el widget. Si ya tienes una tienda online o estás planeando crear una, podemos integrarla o construir una nueva. ¿Tu negocio vende productos o servicios online?",
    ecommerce_opt1: "Sí, ya tengo un e-commerce",
    ecommerce_opt2: "No, no vendo online",
    ecommerce_opt3: "Estoy planeando empezar",

    ecommercePlatform_title: "Plataforma E-Commerce",
    ecommercePlatform_q: "¡Genial! eChatbot se integra con todas las principales plataformas de e-commerce: podemos importar tu catálogo de productos, precios y disponibilidad para que el chatbot los tenga accesibles. ¿Qué plataforma estás usando?",
    ecommercePlatform_opt1: "WordPress / WooCommerce",
    ecommercePlatform_opt2: "PrestaShop",
    ecommercePlatform_opt3: "Magento / Adobe Commerce",
    ecommercePlatform_opt4: "Otra plataforma",

    // Step 7: External integrations
    integrations_title: "Integraciones Externas (RAG)",
    integrations_q: "¿Tu negocio utiliza sistemas externos como un CRM (Salesforce, HubSpot), ERP, software de gestión u otras herramientas empresariales? eChatbot puede integrarse con estos sistemas mediante desarrollo personalizado: importamos y mapeamos tus datos para que el chatbot siempre tenga la información actualizada.",
    integrations_opt1: "Sí, tengo sistemas para integrar",
    integrations_opt2: "No uso sistemas externos",

    // Step 8: Privacy
    privacy_title: "Privacidad y Seguridad",
    privacy_q: "Entendemos que la privacidad de tus clientes es fundamental. eChatbot está diseñado con la privacidad en el centro: nunca enviamos datos sensibles de los clientes a los modelos de IA. La información personal (contactos, pedidos, pagos) siempre permanece en tu base de datos. Para operaciones sensibles usamos enlaces con tokens de tiempo limitado, accesibles solo por el usuario en cuestión.",
    privacy_opt1: "Sí, me convence",
    privacy_opt2: "Todavía tengo dudas",

    // Step 9: On-Premise
    onPremise_title: "Service On-Premise",
    onPremise_q: "eChatbot también está disponible como solución on-premise: toda la plataforma, backend, base de datos y motor de IA, se instala directamente en los servidores del cliente o infraestructura cloud privada. Es ideal para organizaciones con requisitos de cumplimiento estrictos (sector bancario, sanitario, legal o gubernamental), políticas TI rígidas, o para quienes quieren independencia total de servicios externos.",
    onPremise_opt1: "Sí, me interesa",
    onPremise_opt2: "El servicio cloud en eChatbot.AI es suficiente",
    onPremise_opt3: "Quizás más adelante",

    // Step 10: Interest rating
    interest_title: "¿Cuánto te interesa?",
    interest_q: "Honestamente, ¿cuánto te interesa eChatBot para tu negocio? Selecciona de 0 (nada) a 5 (muy interesado).\n\nSi seleccionas 0, no te pediremos ningún dato personal. Si estás interesado, te mostraremos un breve formulario de contacto — nos pondremos en contacto contigo en los próximos días para ver cómo podemos ayudarnos mutuamente.",

    // Step 10: Other (textarea)
    other_title: "¡Ya casi!",
    other_q: "¡Entendido! Crearemos un chatbot de IA a medida para tu negocio. ¿Hay algo más que quisieras comunicarnos? Una integración específica, una función que tengas en mente, un caso de uso particular. Cualquier detalle nos ayuda a crear algo realmente útil para ti.",
    other_placeholder: "Escribe tus ideas o preguntas aquí… (opcional)",

    contact_title: "Hablemos",
    contact_q: "¡Gracias por completar el survey! Tus respuestas nos ayudarán a crear un chatbot a medida para tus necesidades. ¿Estarías disponible para una breve llamada con nuestro equipo? Te mostraríamos una demo personalizada y responderíamos todas tus preguntas, sin ningún compromiso.",
    contact_opt1: "¡Sí, contactadme!",
    contact_opt2: "No, pero gracias por la información",

    form_title: "¿Cómo podemos contactarte?",
    form_desc: "Deja tus datos y te responderemos en menos de 24 horas para organizar una demo personalizada.",
    form_fullName: "Nombre completo *",
    form_email: "Email *",
    form_phone: "Teléfono",
    form_company: "Empresa",
    form_submit: "Enviar →",
    form_submitting: "Enviando…",
    form_error: "Algo salió mal. Por favor, inténtalo de nuevo.",

    success_title: "¡Gracias!",
    success_desc: "Hemos recibido tus respuestas. Nuestro equipo te contactará pronto para una demo personalizada de eChatbot.",
    success_cta: "Volver a la página principal",

    noContact_title: "¡Muchas gracias!",
    noContact_desc: "Apreciamos el tiempo que dedicaste a responder. Tus respuestas nos ayudarán a mejorar eChatbot. Si cambias de opinión, siempre estamos disponibles.",
    noContact_cta: "Volver a la página principal",

    // Try chatbot CTA
    try_chatbot: "¿Tienes dudas o preguntas? ¡Prueba nuestro chatbot en WhatsApp!",
    try_chatbot_button: "Chatea con nosotros",
  },

  de: {
    intro_title: "Hilf uns, den perfekten Chatbot für dich zu bauen",
    intro_desc: "Das Geheimnis eines guten Chatbots ist die Qualität der Antworten. Beantworte ein paar Fragen zu deinen Anforderungen — menschlicher Support, Push-Marketing, Widget, Vertrieb, E-Commerce und Datenschutz — und wir zeigen dir, wie eChatbot den Unterschied macht.\nEtwa 2 Minuten, völlig unverbindlich.",
    intro_cta: "Survey starten →",
    back: "← Zurück",
    next: "Weiter →",
    almost: "Fast geschafft →",
    step_of: "Schritt {current} von {total}",

    industry_title: "Deine Branche",
    industry_q: "In welcher Branche ist dein Unternehmen tätig? Das hilft uns, deinen Kontext sofort zu verstehen und die Demo für dich anzupassen.",
    industry_opt1: "Immobilien",
    industry_opt2: "Lebensmittel & Gastronomie",
    industry_opt3: "Medizin & Gesundheit",
    industry_opt4: "Beauty & Wellness",
    industry_opt5: "Bildung & Weiterbildung",
    industry_opt6: "Tourismus",
    industry_opt7: "Mode",
    industry_opt8: "Fitness",
    industry_opt9: "Transport",
    industry_opt10: "Recht",
    industry_opt11: "Andere",
    industry_other_placeholder: "Gib deine Branche an…",

    goal_title: "Hauptziel",
    goal_q: "Was ist dein Hauptziel mit einem Chatbot? So können wir dir sofort die relevantesten Funktionen zeigen.",
    goal_opt1: "Kundensupport-Anfragen reduzieren",
    goal_opt2: "Leads generieren und qualifizieren",
    goal_opt3: "Online-Verkäufe steigern",
    goal_opt4: "Buchungen und Termine verwalten",
    goal_opt5: "Mitteilungen und Erinnerungen an Kunden senden",

    humanSupport_title: "Menschlicher Support",
    humanSupport_q: "Eine der Stärken von eChatbot ist die intelligente Übergabe von der KI an einen menschlichen Agenten, ohne den Gesprächskontext zu verlieren. Wenn ein Kunde ein komplexes Anliegen hat, übergibt der KI-Agent den Chat sofort an einen Mitarbeiter, der eine WhatsApp-Benachrichtigung mit dem gesamten Gesprächsverlauf erhält. Möchtest du diese Funktion in deinen Chatbot integrieren?",
    humanSupport_opt1: "Ja, ich möchte die Übergabe an einen menschlichen Agenten",
    humanSupport_opt2: "Vollständige Automatisierung reicht mir",

    pushMarketing_title: "Push-Marketing",
    pushMarketing_q: "WhatsApp-Push-Benachrichtigungen haben eine Öffnungsrate von über 90%. Aber der echte Unterschied ist die intelligente Personalisierung: Die KI sorgt dafür, dass nur das gesendet wird, was jeder Kunde wirklich erhalten möchte. Sucht ein Kunde zum Beispiel ein Studio-Apartment in Barcelona, erhält er nur neue Angebote in seiner Gegend oder Preissenkungen bei ähnlichen Objekten, niemals irrelevante Nachrichten. Null Spam, maximale Relevanz.",
    pushMarketing_opt1: "Ja, ich bin interessiert",
    pushMarketing_opt2: "Vielleicht später",
    pushMarketing_opt3: "Kein Interesse",

    reminders_title: "Erinnerungen & Termine",
    reminders_q: "Musst du Erinnerungen für deine Kunden einrichten? Zum Beispiel Zahlungsfristen, Meetings oder Termine? Mit der Scheduling-Funktion von eChatbot kannst du gezielte WhatsApp-Nachrichten genau im richtigen Moment automatisieren, für jeden einzelnen Kunden.",
    reminders_opt1: "Ja, ich bin interessiert",
    reminders_opt2: "Nein, kein Interesse",

    // Step: Demo request — closing ask. "Ja" → wir wollen die Demo senden.
    demo_title: "Teste unsere Demo",
    demo_q: "Möchtest du, dass wir dir eine Demo senden, um unser Produkt zu testen? Wir schicken dir die Zugangsdaten per E-Mail, damit du eChatbot selbst ausprobieren kannst.",
    demo_opt1: "Ja, schickt mir die Demo",
    demo_opt2: "Nein, im Moment nicht",

    widget_title: "Chat-Widget",
    widget_q: "Das Widget von eChatbot ermöglicht es dir, einen smarten Chat direkt in deine Website einzubinden — mit demselben Chatbot, den du für WhatsApp konfiguriert hast. Besucher können eine Unterhaltung starten, ohne deine Seite zu verlassen, und der Chatbot antwortet in Echtzeit.",
    widget_opt1: "Ja, ich möchte ein Widget auf meiner Website",
    widget_opt2: "Nur WhatsApp, kein Widget nötig",
    widget_opt3: "Beides: Website-Widget + WhatsApp",

    salesAgents_title: "Vertriebsteam",
    salesAgents_q: "Mit eChatbot kannst du ein echtes digitales Vertriebsteam aufbauen: Du kannst deine Mitarbeiter als Vertriebsagenten registrieren, jeder mit eigenem Profil und Fachgebiet. Wenn ein Kunde kaufbereit ist oder persönliche Unterstützung braucht, übergibt die KI den Chat direkt an den passenden Agenten in deinem Team, der eine sofortige Benachrichtigung erhält und mit dem gesamten Gesprächsverlauf einsteigt. Diese Funktion ist für Unternehmen mit einem Vertriebsteam gedacht. Hast du Mitarbeiter, die sich um den Vertrieb kümmern?",
    salesAgents_opt1: "Ja, ich habe ein Vertriebsteam",
    salesAgents_opt2: "Nein, ich mache alles selbst",

    ecommerce_title: "E-Commerce",
    ecommerce_q: "eChatbot hat eine integrierte E-Commerce-Engine, mit der Kunden den Katalog durchstöbern, Produkte in den Warenkorb legen und Bestellungen direkt im Chat abschließen können — auf WhatsApp oder im Widget. Wenn du bereits einen Online-Shop hast oder planst, einen zu starten, können wir ihn integrieren oder einen neuen aufbauen. Verkauft dein Unternehmen Produkte oder Dienstleistungen online?",
    ecommerce_opt1: "Ja, ich habe bereits einen E-Commerce",
    ecommerce_opt2: "Nein, ich verkaufe nicht online",
    ecommerce_opt3: "Ich plane, damit zu starten",

    ecommercePlatform_title: "E-Commerce-Plattform",
    ecommercePlatform_q: "Super! eChatbot lässt sich mit allen wichtigen E-Commerce-Plattformen integrieren: Wir können deinen Produktkatalog, Preise und Verfügbarkeiten importieren, damit der Chatbot darauf zugreifen kann. Welche Plattform nutzt du?",
    ecommercePlatform_opt1: "WordPress / WooCommerce",
    ecommercePlatform_opt2: "PrestaShop",
    ecommercePlatform_opt3: "Magento / Adobe Commerce",
    ecommercePlatform_opt4: "Andere Plattform",

    // Step 7: External integrations
    integrations_title: "Externe Integrationen (RAG)",
    integrations_q: "Nutzt dein Unternehmen externe Systeme wie ein CRM (Salesforce, HubSpot), ERP, eine Verwaltungssoftware oder andere Business-Tools? eChatbot kann sich durch individuelle Entwicklung mit diesen Systemen integrieren: Wir importieren und ordnen deine Daten zu, damit der Chatbot immer aktuelle Informationen hat.",
    integrations_opt1: "Ja, ich habe Systeme zum Integrieren",
    integrations_opt2: "Ich nutze keine externen Systeme",

    // Step 8: Privacy
    privacy_title: "Datenschutz & Sicherheit",
    privacy_q: "Wir wissen, dass der Datenschutz deiner Kunden entscheidend ist. eChatbot ist mit Datenschutz im Kern entwickelt: Wir senden niemals sensible Kundendaten an KI-Modelle. Persönliche Informationen (Kontakte, Bestellungen, Zahlungen) bleiben immer in deiner Datenbank. Für sensible Vorgänge nutzen wir zeitlich begrenzte Token-Links, auf die nur der jeweilige Nutzer zugreifen kann.",
    privacy_opt1: "Ja, das überzeugt mich",
    privacy_opt2: "Ich habe noch ein paar Zweifel",

    // Step 9: On-Premise
    onPremise_title: "Service On-Premise",
    onPremise_q: "eChatbot ist auch als On-Premise-Lösung verfügbar: Die gesamte Plattform, Backend, Datenbank und KI-Engine, wird direkt auf den Servern des Kunden oder in einer privaten Cloud-Infrastruktur installiert. Ideal für Organisationen mit strengen Compliance-Anforderungen (Banken-, Gesundheits-, Rechts- oder Behördensektor), strikten IT-Richtlinien oder für alle, die völlige Unabhängigkeit von externen Diensten wünschen.",
    onPremise_opt1: "Ja, ich bin interessiert",
    onPremise_opt2: "Der Cloud-Service auf eChatbot.AI reicht aus",
    onPremise_opt3: "Vielleicht später",

    // Step 10: Interest rating
    interest_title: "Wie interessiert bist du?",
    interest_q: "Ganz ehrlich, wie interessiert bist du an eChatBot für dein Unternehmen? Wähle von 0 (gar nicht) bis 5 (sehr interessiert).\n\nWenn du 0 wählst, fragen wir dich nach keinen persönlichen Daten. Wenn du interessiert bist, zeigen wir dir ein kurzes Kontaktformular — wir melden uns in den nächsten Tagen, um zu sehen, wie wir einander helfen können.",

    // Step 10: Other (textarea)
    other_title: "Fast geschafft!",
    other_q: "Verstanden! Wir bauen einen maßgeschneiderten KI-Chatbot für dein Unternehmen. Gibt es noch etwas, das du uns mitteilen möchtest? Eine bestimmte Integration, eine Funktion, die du im Kopf hast, ein besonderer Anwendungsfall? Jedes Detail hilft uns, etwas wirklich Nützliches für dich zu schaffen.",
    other_placeholder: "Schreibe deine Ideen oder Fragen hier… (optional)",

    contact_title: "Lass uns reden",
    contact_q: "Danke, dass du den Survey ausgefüllt hast! Deine Antworten helfen uns, einen Chatbot ganz nach deinen Bedürfnissen zu bauen. Hättest du Zeit für ein kurzes Gespräch mit unserem Team? Wir würden dir eine persönliche Demo zeigen und alle deine Fragen beantworten, völlig unverbindlich.",
    contact_opt1: "Ja, bitte kontaktiert mich!",
    contact_opt2: "Nein, aber danke für die Informationen",

    form_title: "Wie können wir dich erreichen?",
    form_desc: "Hinterlasse deine Daten und wir melden uns innerhalb von 24 Stunden, um eine persönliche Demo zu vereinbaren.",
    form_fullName: "Vor- und Nachname *",
    form_email: "E-Mail *",
    form_phone: "Telefon",
    form_company: "Unternehmen",
    form_submit: "Senden →",
    form_submitting: "Wird gesendet…",
    form_error: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",

    success_title: "Danke!",
    success_desc: "Wir haben deine Antworten erhalten. Unser Team meldet sich in Kürze bei dir für eine persönliche eChatbot-Demo.",
    success_cta: "Zurück zur Startseite",

    noContact_title: "Vielen Dank!",
    noContact_desc: "Wir schätzen die Zeit, die du dir zum Antworten genommen hast. Deine Antworten helfen uns, eChatbot zu verbessern. Wenn du es dir anders überlegst, sind wir immer für dich da.",
    noContact_cta: "Zurück zur Startseite",

    // Try chatbot CTA
    try_chatbot: "Hast du Zweifel oder Fragen? Teste unseren Chatbot auf WhatsApp!",
    try_chatbot_button: "Chatte mit uns",
  },
}

// ─────────────────────────────────────────
// Step definitions
// ─────────────────────────────────────────
interface StepOption {
  value: string
  label: string
  emoji: string
}

interface StepDef {
  id: string
  icon: string
  titleKey: string
  questionKey: string
  type: "radio" | "multi" | "textarea" | "stars" | "select"
  options?: StepOption[]
  image?: string // Optional image URL for the step
  /** If provided, this step is only shown when the condition is met */
  showWhen?: (answers: Record<string, string | string[]>) => boolean
}

function buildSteps(T: Record<string, string>): StepDef[] {
  return [
    // ── 1. Settore ──────────────────────────────────────────────────────
    {
      id: "stepIndustry",
      icon: "🏢",
      titleKey: "industry_title",
      questionKey: "industry_q",
      type: "select",
      image: "/survey.png",
      options: [
        { value: "real_estate", label: T.industry_opt1, emoji: "🏠" },
        { value: "food", label: T.industry_opt2, emoji: "🍽️" },
        { value: "medical", label: T.industry_opt3, emoji: "🏥" },
        { value: "beauty_wellness", label: T.industry_opt4, emoji: "💅" },
        { value: "education", label: T.industry_opt5, emoji: "🎓" },
        { value: "tourism", label: T.industry_opt6, emoji: "🌍" },
        { value: "fashion", label: T.industry_opt7, emoji: "👗" },
        { value: "fitness", label: T.industry_opt8, emoji: "💪" },
        { value: "transport", label: T.industry_opt9, emoji: "🚗" },
        { value: "legal", label: T.industry_opt10, emoji: "⚖️" },
        { value: "other", label: T.industry_opt11, emoji: "🔧" },
      ],
    },
    // ── 2. Obiettivo principale ─────────────────────────────────────────
    {
      id: "stepGoal",
      icon: "🎯",
      titleKey: "goal_title",
      questionKey: "goal_q",
      type: "multi",
      image: "/booking.png",
      options: [
        { value: "support", label: T.goal_opt1, emoji: "💬" },
        { value: "leads", label: T.goal_opt2, emoji: "🎯" },
        { value: "sales", label: T.goal_opt3, emoji: "🛍️" },
        { value: "bookings", label: T.goal_opt4, emoji: "📅" },
        { value: "communications", label: T.goal_opt5, emoji: "📢" },
      ],
    },
    // ── 3. Widget ───────────────────────────────────────────────────────
    {
      id: "stepWidget",
      icon: "🌐",
      titleKey: "widget_title",
      questionKey: "widget_q",
      type: "radio",
      image: "/surver-widget.png",
      options: [
        { value: "yes_widget", label: T.widget_opt1, emoji: "🌐" },
        { value: "whatsapp_only", label: T.widget_opt2, emoji: "💬" },
        { value: "both", label: T.widget_opt3, emoji: "🔀" },
      ],
    },
    // ── 4. Supporto Umano ───────────────────────────────────────────────
    {
      id: "stepHumanSupport",
      icon: "🤝",
      titleKey: "humanSupport_title",
      questionKey: "humanSupport_q",
      type: "radio",
      image: "/survey-support.png",
      options: [
        { value: "yes_handoff", label: T.humanSupport_opt1, emoji: "✅" },
        { value: "full_auto", label: T.humanSupport_opt2, emoji: "❌" },
      ],
    },
    // ── 5. Team di Vendita ──────────────────────────────────────────────
    {
      id: "stepSalesAgents",
      icon: "👥",
      titleKey: "salesAgents_title",
      questionKey: "salesAgents_q",
      type: "radio",
      image: "/survey-agent.png",
      showWhen: (answers) => {
        const v = answers.stepHumanSupport
        return v === "yes_handoff" || (Array.isArray(v) && v.includes("yes_handoff"))
      },
      options: [
        { value: "yes", label: T.salesAgents_opt1, emoji: "✅" },
        { value: "no", label: T.salesAgents_opt2, emoji: "❌" },
      ],
    },
    // ── 6. E-Commerce ───────────────────────────────────────────────────
    {
      id: "stepEcommerce",
      icon: "🛒",
      titleKey: "ecommerce_title",
      questionKey: "ecommerce_q",
      type: "radio",
      image: "/survey-ecommerce.png",
      options: [
        { value: "yes", label: T.ecommerce_opt1, emoji: "✅" },
        { value: "no", label: T.ecommerce_opt2, emoji: "❌" },
        { value: "planning", label: T.ecommerce_opt3, emoji: "🚀" },
      ],
    },
    // ── 6b. Piattaforma (condizionale) ──────────────────────────────────
    {
      id: "stepEcommercePlatform",
      icon: "🔧",
      titleKey: "ecommercePlatform_title",
      questionKey: "ecommercePlatform_q",
      type: "radio",
      image: "/survey-ecommerce.png",
      showWhen: (answers) => {
        const v = answers.stepEcommerce
        return v === "yes" || (Array.isArray(v) && v.includes("yes"))
      },
      options: [
        { value: "wordpress", label: T.ecommercePlatform_opt1, emoji: "🔵" },
        { value: "prestashop", label: T.ecommercePlatform_opt2, emoji: "🟣" },
        { value: "magento", label: T.ecommercePlatform_opt3, emoji: "🟠" },
        { value: "other", label: T.ecommercePlatform_opt4, emoji: "🔧" },
      ],
    },
    // ── 7. Marketing Push ───────────────────────────────────────────────
    {
      id: "stepPushMarketing",
      icon: "📣",
      titleKey: "pushMarketing_title",
      questionKey: "pushMarketing_q",
      type: "radio",
      image: "/survey-push.png",
      options: [
        { value: "yes", label: T.pushMarketing_opt1, emoji: "✅" },
        { value: "maybe", label: T.pushMarketing_opt2, emoji: "🕐" },
        { value: "no", label: T.pushMarketing_opt3, emoji: "❌" },
      ],
    },
    // ── 8. Promemoria ───────────────────────────────────────────────────
    {
      id: "stepReminders",
      icon: "⏰",
      titleKey: "reminders_title",
      questionKey: "reminders_q",
      type: "radio",
      image: "/survey-push.png",
      options: [
        { value: "yes", label: T.reminders_opt1, emoji: "✅" },
        { value: "no", label: T.reminders_opt2, emoji: "❌" },
      ],
    },
    // ── 9. Integrazioni (RAG) ───────────────────────────────────────────
    {
      id: "stepIntegrations",
      icon: "🔗",
      titleKey: "integrations_title",
      questionKey: "integrations_q",
      type: "radio",
      image: "/survery-crm.png",
      options: [
        { value: "yes", label: T.integrations_opt1, emoji: "✅" },
        { value: "no", label: T.integrations_opt2, emoji: "❌" },
      ],
    },
    // ── 10. Privacy ─────────────────────────────────────────────────────
    {
      id: "stepPrivacy",
      icon: "🔒",
      titleKey: "privacy_title",
      questionKey: "privacy_q",
      type: "radio",
      image: "/survery-secuiry.png",
      options: [
        { value: "ok", label: T.privacy_opt1, emoji: "✅" },
        { value: "concerns", label: T.privacy_opt2, emoji: "❌" },
      ],
    },
    // ── 11. On-Premise ──────────────────────────────────────────────────
    {
      id: "stepOnPremise",
      icon: "🏢",
      titleKey: "onPremise_title",
      questionKey: "onPremise_q",
      type: "radio",
      image: "/survery-crm.png",
      options: [
        { value: "yes", label: T.onPremise_opt1, emoji: "✅" },
        { value: "interested", label: T.onPremise_opt2, emoji: "🔍" },
        { value: "cloud", label: T.onPremise_opt3, emoji: "☁️" },
      ],
    },
    // ── 12. Altro ───────────────────────────────────────────────────────
    {
      id: "stepOther",
      icon: "💭",
      titleKey: "other_title",
      questionKey: "other_q",
      type: "textarea",
      image: "/survery-altro.png",
    },
    // ── 13. Demo request ────────────────────────────────────────────────
    // Closing ask before the interest rating. A "yes" tells us the lead
    // wants demo access; we read answers.stepDemo on the submitted survey
    // and mail the credentials manually after qualifying.
    {
      id: "stepDemo",
      icon: "🚀",
      titleKey: "demo_title",
      questionKey: "demo_q",
      type: "radio",
      image: "/demo.png",
      options: [
        { value: "yes", label: T.demo_opt1, emoji: "✅" },
        { value: "no", label: T.demo_opt2, emoji: "❌" },
      ],
    },
    // ── 14. Interesse ───────────────────────────────────────────────────
    {
      id: "stepInterest",
      icon: "⭐",
      titleKey: "interest_title",
      questionKey: "interest_q",
      type: "stars",
      image: "/survery-start.png",
    },
  ]
}

// ─────────────────────────────────────────
// Slide animation variants
// ─────────────────────────────────────────
const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -60 : 60, opacity: 0 }),
}

// ─────────────────────────────────────────
// Main component
// ─────────────────────────────────────────
export default function QuestionnairePage() {
  const { language } = useLanguage()
  const lang = (["it", "en", "es", "de"].includes(language) ? language : "en") as Lang
  const T = QT[lang]

  type View = "intro" | "steps" | "contact_form" | "success" | "no_contact"
  const [view, setView] = useState<View>("intro")
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [industryOtherText, setIndustryOtherText] = useState("")
  const [contact, setContact] = useState({ fullName: "", email: "", phone: "", company: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  // Rebuild steps when language or answers change (for conditional step)
  const allSteps = buildSteps(T)
  const activeSteps = allSteps.filter((s) => !s.showWhen || s.showWhen(answers))
  const totalSteps = activeSteps.length
  const step = activeSteps[currentStep]
  const progress = ((currentStep + 1) / totalSteps) * 100

  function stepLabel() {
    return T.step_of
      .replace("{current}", String(currentStep + 1))
      .replace("{total}", String(totalSteps))
  }

  // ─── Navigation ───────────────────────────
  function handleNext() {
    if (currentStep < totalSteps - 1) {
      setDirection(1)
      setCurrentStep((s) => s + 1)
    } else {
      // Last step is stepInterest (stars): show contact form only if rating >= 2
      const interestValue = answers["stepInterest"]
      if (interestValue && parseInt(String(interestValue)) >= 2) {
        setView("contact_form")
      } else {
        submitAnswers(false, { fullName: "", email: "", phone: "", company: "" })
      }
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setDirection(-1)
      setCurrentStep((s) => s - 1)
    } else {
      setView("intro")
    }
  }

  function handleAnswer(stepId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [stepId]: value }))
  }

  function handleMultiAnswer(stepId: string, value: string) {
    setAnswers((prev) => {
      const current = prev[stepId]
      const arr = Array.isArray(current) ? current : current ? [current as string] : []
      const idx = arr.indexOf(value)
      const next = idx >= 0 ? arr.filter((v) => v !== value) : [...arr, value]
      return { ...prev, [stepId]: next }
    })
  }

  // ─── Submit ───────────────────────────────
  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contact.fullName.trim() || !contact.email.trim()) return
    await submitAnswers(true, contact)
  }

  async function submitAnswers(
    wantsContact: boolean,
    contactData: { fullName: string; email: string; phone: string; company: string }
  ) {
    setIsSubmitting(true)
    setSubmitError("")
    try {
      const finalAnswers = { ...answers }
      if (finalAnswers.stepIndustry === "other" && industryOtherText.trim()) {
        finalAnswers.stepIndustry = industryOtherText.trim()
      }
      // Serialize arrays to comma-separated strings for the API
      const serialized: Record<string, string> = {}
      Object.keys(finalAnswers).forEach((key) => {
        const val = finalAnswers[key]
        serialized[key] = Array.isArray(val) ? val.join(",") : (val as string)
      })
      await axios.post(`${API_BASE}/questionnaire`, {
        ...contactData,
        ...serialized,
        wantsContact,
        lang,
      })
      setView(wantsContact ? "success" : "no_contact")
    } catch {
      if (!wantsContact) {
        // User said "no thanks" — don't show an error, just navigate away
        setView("no_contact")
      } else {
        setSubmitError(T.form_error)
        setIsSubmitting(false)
      }
    }
  }

  const canProceed = step && (step.type === "textarea"
    ? true // textarea is optional
    : step.type === "stars"
    ? !!answers[step.id] // stars must be selected
    : step.type === "multi"
    ? Array.isArray(answers[step.id]) ? (answers[step.id] as string[]).length > 0 : !!answers[step.id]
    : !!answers[step.id]) // radio + select

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-200">
      <SEO
        title={
          ({
            it: "Survey - Costruiamo insieme il chatbot perfetto",
            en: "Survey - Let's build the perfect chatbot together",
            es: "Survey - Construyamos juntos el chatbot perfecto",
            de: "Survey - Lass uns gemeinsam den perfekten Chatbot bauen",
          } as Record<string, string>)[lang] ||
          "Survey - Let's build the perfect chatbot together"
        }
        description={
          ({
            it: "Rispondi a qualche domanda sulle tue esigenze e ti mostriamo come eChatbot può trasformare il tuo business su WhatsApp. Circa 2 minuti, zero impegno.",
            en: "Answer a few questions about your needs and we'll show how eChatbot can transform your business on WhatsApp. About 2 minutes, no commitment.",
            es: "Responde unas preguntas sobre tus necesidades y te mostramos cómo eChatbot puede transformar tu negocio en WhatsApp. Unos 2 minutos, sin compromiso.",
            de: "Beantworte ein paar Fragen zu deinen Anforderungen und wir zeigen dir, wie eChatbot dein Geschäft auf WhatsApp verändern kann. Etwa 2 Minuten, völlig unverbindlich.",
          } as Record<string, string>)[lang] ||
          "Answer a few questions about your needs and we'll show how eChatbot can transform your business on WhatsApp."
        }
        keywords="echatbot survey, chatbot whatsapp survey, valutazione chatbot, demo chatbot whatsapp"
        url="/survey"
      />
      {/* Header — shared site header for visual continuity with the rest of the site */}
      <SiteHeader />

      {/* Content. The shared header is taller (~70px) than the old custom one,
          so the min-height offset is recalibrated to keep cards clear of it. */}
      <div className="flex items-start sm:items-center justify-center min-h-[calc(100vh-70px)] px-3 sm:px-4 py-6 sm:py-12">
        <div className="w-full max-w-[727px]">

          {/* ── INTRO ── */}
          {view === "intro" && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <GlowCard innerClassName="overflow-hidden">
                {/* Body */}
                <div className="p-5 sm:p-10">
                  {/* Full-width intro image */}
                  <div className="-mx-5 sm:-mx-10 mb-8">
                    <img
                      src="/survey.png"
                      alt="eChatbot survey"
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        const el = e.currentTarget
                        el.style.display = "none"
                        const next = el.nextElementSibling as HTMLElement | null
                        if (next) next.style.display = "flex"
                      }}
                    />
                    <div className="hidden w-full h-48 bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-b border-white/10 items-center justify-center">
                      <span className="text-4xl opacity-30">🖼️</span>
                    </div>
                  </div>

                  {/* Title — inside the card, no solid green banner */}
                  <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">{T.intro_title}</h1>

                  <p className="text-slate-300 mb-8 leading-relaxed" style={{ fontSize: "1.15rem", whiteSpace: "pre-line" }}>
                    {T.intro_desc}
                  </p>

                  <GreenCtaButton
                    icon="📋"
                    className="w-full"
                    onClick={() => {
                      setView("steps")
                      setCurrentStep(0)
                    }}
                  >
                    {T.intro_cta}
                  </GreenCtaButton>
                </div>
              </GlowCard>
            </motion.div>
          )}

          {/* ── STEPS ── */}
          {view === "steps" && (
            <GlowCard innerClassName="overflow-hidden">
              {/* Progress bar */}
              <div className="h-1.5 bg-white/10">
                <motion.div
                  className="h-full"
                  style={{ background: "#25D366" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <div className="p-4 sm:p-8">
                {/* Step counter */}
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {stepLabel()}
                  </span>
                  <div className="flex gap-1">
                    {activeSteps.map((_, i) => (
                      <div
                        key={i}
                        className="h-1.5 w-5 rounded-full transition-colors"
                        style={{ background: i <= currentStep ? "#25D366" : "rgba(255,255,255,0.1)" }}
                      />
                    ))}
                  </div>
                </div>

                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={step.id}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25 }}
                  >
                    {/* Image (if available) or placeholder — full bleed */}
                    {step.image ? (
                      <div className="-mx-4 sm:-mx-8 mb-6">
                        <img
                          src={step.image}
                          alt={T[step.titleKey]}
                          className="w-full h-44 sm:h-52 object-cover"
                        />
                      </div>
                    ) : (
                      <div className="-mx-4 sm:-mx-8 mb-6 w-[calc(100%+2rem)] sm:w-[calc(100%+4rem)] h-44 sm:h-52 bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-b border-dashed border-white/10 flex items-center justify-center">
                        <span className="text-4xl opacity-30">🖼️</span>
                      </div>
                    )}

                    {/* Icon + Title */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-4xl">{step.icon}</span>
                      <h2 className="text-xl font-bold text-white">{T[step.titleKey]}</h2>
                    </div>
                    <p className="text-slate-400 mb-6 leading-relaxed" style={{ fontSize: "1.15rem", whiteSpace: "pre-line" }}>{T[step.questionKey]}</p>

                    {/* Radio options (single choice, auto-advance) */}
                    {step.type === "radio" && step.options && (
                      <div className="space-y-3">
                        {step.options.map((opt) => {
                          const selected = answers[step.id] === opt.value
                          return (
                            <button
                              key={opt.value}
                              onClick={() => {
                                handleAnswer(step.id, opt.value)
                                setTimeout(() => handleNext(), 250)
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all ${
                                selected
                                  ? "border-[#25D366]/60 bg-[#25D366]/[0.08] text-white"
                                  : "border-white/10 bg-slate-900/40 hover:border-white/20 text-slate-200"
                              }`}
                            >
                              <span
                                className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  selected ? "bg-[#25D366] border-[#25D366]" : "border-white/20"
                                }`}
                              >
                                {selected && <span className="w-2 h-2 rounded-full bg-white" />}
                              </span>
                              <span className="text-xl">{opt.emoji}</span>
                              <span className="font-medium text-sm">{opt.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Multi-select options (checkboxes — only stepGoal) */}
                    {step.type === "multi" && step.options && (
                      <div className="space-y-3">
                        {step.options.map((opt) => {
                          const currentVal = answers[step.id]
                          const selected = Array.isArray(currentVal)
                            ? currentVal.includes(opt.value)
                            : currentVal === opt.value
                          return (
                            <button
                              key={opt.value}
                              onClick={() => handleMultiAnswer(step.id, opt.value)}
                              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all ${
                                selected
                                  ? "border-[#25D366]/60 bg-[#25D366]/[0.08] text-white"
                                  : "border-white/10 bg-slate-900/40 hover:border-white/20 text-slate-200"
                              }`}
                            >
                              <span
                                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  selected ? "bg-[#25D366] border-[#25D366]" : "border-white/20"
                                }`}
                              >
                                {selected && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                              <span className="text-xl">{opt.emoji}</span>
                              <span className="font-medium text-sm">{opt.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Select dropdown (industry) */}
                    {step.type === "select" && step.options && (
                      <div className="space-y-3">
                        <select
                          value={answers[step.id] || ""}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === "other") {
                              handleAnswer(step.id, "other")
                              setIndustryOtherText("")
                            } else {
                              handleAnswer(step.id, val)
                              setIndustryOtherText("")
                            }
                          }}
                          className="w-full border-2 border-white/10 rounded-xl px-4 py-3.5 text-sm text-slate-100 focus:border-[#25D366] focus:outline-none transition-colors bg-slate-900/60 appearance-none cursor-pointer"
                        >
                          <option value="" disabled>
                            — Select… —
                          </option>
                          {step.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.emoji} {opt.label}
                            </option>
                          ))}
                        </select>
                        {answers[step.id] === "other" && (
                          <input
                            type="text"
                            placeholder={T.industry_other_placeholder || "Specify your industry…"}
                            value={industryOtherText}
                            onChange={(e) => setIndustryOtherText(e.target.value)}
                            className="w-full border-2 border-white/10 bg-slate-900/60 rounded-xl px-4 py-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#25D366] focus:outline-none transition-colors"
                            autoFocus
                          />
                        )}
                      </div>
                    )}

                    {/* Stars rating */}
                    {step.type === "stars" && (
                      <div className="flex justify-center gap-1 sm:gap-2 my-6">
                        {[0, 1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => {
                              handleAnswer(step.id, star.toString())
                              // Auto-advance after selecting a star
                              setTimeout(() => {
                                if (currentStep < totalSteps - 1) {
                                  setDirection(1)
                                  setCurrentStep((s) => s + 1)
                                } else {
                                  // Last step (stepInterest): show contact form if rating >= 2, else submit directly
                                  if (star >= 2) {
                                    setView("contact_form")
                                  } else {
                                    submitAnswers(false, { fullName: "", email: "", phone: "", company: "" })
                                  }
                                }
                              }, 350)
                            }}
                            className="group relative transition-transform hover:scale-110"
                          >
                            <svg
                              className={`w-9 h-9 sm:w-12 sm:h-12 ${
                                answers[step.id] !== undefined && parseInt(String(answers[step.id])) >= star
                                  ? "text-yellow-400 fill-yellow-400"
                                  : "text-slate-600 fill-none hover:text-yellow-200"
                              } transition-colors`}
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                              />
                            </svg>
                            <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-slate-400 font-medium">
                              {star}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Textarea */}
                    {step.type === "textarea" && (
                      <textarea
                        rows={4}
                        placeholder={T.other_placeholder}
                        value={answers[step.id] || ""}
                        onChange={(e) => handleAnswer(step.id, e.target.value)}
                        className="w-full border-2 border-white/10 bg-slate-900/60 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#25D366] focus:outline-none resize-none transition-colors"
                      />
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Nav buttons */}
                <div className="flex gap-3 mt-8">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="flex-1 border-white/10 bg-transparent text-slate-300 hover:bg-white/5"
                  >
                    {T.back}
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="flex-[2] text-white px-8"
                    style={{ background: "#25D366" }}
                  >
                    {currentStep < totalSteps - 1 ? T.next : T.almost}
                  </Button>
                </div>
              </div>
            </GlowCard>
          )}

          {/* ── CONTACT FORM ── */}
          {view === "contact_form" && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <GlowCard innerClassName="p-5 sm:p-8">
              <div className="text-5xl mb-3">👤</div>
              <h2 className="text-2xl font-bold text-white mb-1">{T.form_title}</h2>
              <p className="text-slate-400 mb-6 text-sm">{T.form_desc}</p>

              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {T.form_fullName}
                  </label>
                  <Input
                    placeholder="John Smith"
                    value={contact.fullName}
                    onChange={(e) => setContact((c) => ({ ...c, fullName: e.target.value }))}
                    required
                    className="bg-slate-900/60 border-white/10 text-slate-100 placeholder:text-slate-500 focus:border-[#25D366]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {T.form_email}
                  </label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={contact.email}
                    onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                    required
                    className="bg-slate-900/60 border-white/10 text-slate-100 placeholder:text-slate-500 focus:border-[#25D366]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {T.form_phone}
                  </label>
                  <Input
                    type="tel"
                    placeholder="+39 333 1234567"
                    value={contact.phone}
                    onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                    className="bg-slate-900/60 border-white/10 text-slate-100 placeholder:text-slate-500 focus:border-[#25D366]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {T.form_company}
                  </label>
                  <Input
                    placeholder="Acme Inc."
                    value={contact.company}
                    onChange={(e) => setContact((c) => ({ ...c, company: e.target.value }))}
                    className="bg-slate-900/60 border-white/10 text-slate-100 placeholder:text-slate-500 focus:border-[#25D366]"
                  />
                </div>

                {submitError && <p className="text-red-500 text-sm">{submitError}</p>}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setView("steps"); setCurrentStep(totalSteps - 1) }}
                    className="sm:flex-1 border-white/10 bg-transparent text-slate-300 hover:bg-white/5"
                  >
                    {T.back}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => submitAnswers(false, { fullName: "", email: "", phone: "", company: "" })}
                    className="sm:flex-1 border-[#25D366]/40 bg-transparent text-[#25D366] hover:bg-[#25D366]/10"
                  >
                    {T.contact_opt2}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !contact.fullName.trim() || !contact.email.trim()}
                    className="sm:flex-[2] text-white px-8 disabled:opacity-40"
                    style={{ background: "#25D366" }}
                  >
                    {isSubmitting ? T.form_submitting : T.form_submit}
                  </Button>
                </div>
              </form>
              </GlowCard>
            </motion.div>
          )}

          {/* ── SUCCESS (with contact) ── */}
          {view === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <GlowCard innerClassName="p-10 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-20 h-20 bg-[#25D366]/15 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <span className="text-4xl">✅</span>
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">{T.success_title}</h2>
              <p className="text-slate-400 mb-8 leading-relaxed">{T.success_desc}</p>

              <Link to="/">
                <Button className="text-white px-8" style={{ background: "#25D366" }}>
                  {T.success_cta}
                </Button>
              </Link>
              </GlowCard>
            </motion.div>
          )}

          {/* ── NO CONTACT THANK YOU ── */}
          {view === "no_contact" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <GlowCard innerClassName="p-10 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-20 h-20 bg-blue-400/15 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <span className="text-4xl">🙏</span>
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">{T.noContact_title}</h2>
              <p className="text-slate-400 mb-8 leading-relaxed">{T.noContact_desc}</p>

              <Link to="/">
                <Button className="text-white px-8" style={{ background: "#25D366" }}>
                  {T.noContact_cta}
                </Button>
              </Link>
              </GlowCard>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
