import { useState } from "react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import axios from "axios"
import { useLanguage } from "@/contexts/LanguageContext"
import { WidgetLoader } from "@/components/WidgetLoader"
import { ChatWidget } from "@/components/ChatWidget"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1"

// ─────────────────────────────────────────
// Survey translations (self-contained, not in global LanguageContext)
// ─────────────────────────────────────────
type Lang = "it" | "en" | "es" | "pt"

const QT: Record<Lang, Record<string, string>> = {
  it: {
    // Intro
    intro_title: "Aiutaci a capire le tue esigenze",
    intro_desc: "Rispondi a qualche domanda per aiutarci a capire come eChatbot può trasformare il tuo business. Il segreto di un buon chatbot è la qualità delle risposte: più capiamo il tuo contesto, meglio possiamo configurarlo per te. Parleremo di supporto clienti, marketing push, widget, vendite e molto altro.\nCirca 2 minuti — zero impegno.",
    intro_cta: "Avvia il survey →",
    back: "← Indietro",
    next: "Avanti →",
    almost: "Quasi fatto →",
    step_of: "Passo {current} di {total}",

    // Step 1: Human Support
    humanSupport_title: "Supporto Umano",
    humanSupport_q: "Uno dei punti di forza di eChatbot è il passaggio intelligente da AI a operatore umano — senza perdere il contesto della conversazione. Quando un cliente ha un problema complesso, l'agente AI trasferisce immediatamente la chat a un operatore che riceve una notifica WhatsApp con tutta la cronologia. Vorresti questa capacità integrata nel tuo chatbot?",
    humanSupport_opt1: "Sì, voglio il passaggio a operatore umano",
    humanSupport_opt2: "In parte, con supervisione selettiva",
    humanSupport_opt3: "L'automazione completa va bene",

    // Step 2: Push Marketing
    pushMarketing_title: "Marketing Push",
    pushMarketing_q: "Le campagne push su WhatsApp hanno tassi di apertura superiori al 90% — molto più alti di email o SMS. Con eChatbot puoi inviare messaggi promozionali mirati, avvisi di nuovi prodotti, offerte speciali e follow-up automatici ai tuoi clienti direttamente su WhatsApp. Saresti interessato a usare questo canale per riattivare clienti e aumentare le vendite?",
    pushMarketing_opt1: "Sì, voglio campagne push",
    pushMarketing_opt2: "Non per ora",

    // Step 3: Widget
    widget_title: "Chat Widget",
    widget_q: "Il Widget di eChatbot permette di integrare una chat intelligente direttamente nel tuo sito web, utilizzando lo stesso chatbot che hai configurato per WhatsApp. I visitanti possono iniziare una conversazione senza lasciare il sito e il chatbot risponde in tempo reale. La chat può poi spostarsi su WhatsApp per continuare anche offline. Hai un sito e vorresti aggiungere un widget di chat?",
    widget_opt1: "Sì, voglio il widget sul mio sito",
    widget_opt2: "Solo WhatsApp, senza widget",
    widget_opt3: "Entrambi — widget + WhatsApp",

    // Step 4: Sales Agents
    salesAgents_title: "Agenti di Vendita AI",
    salesAgents_q: "eChatbot offre agenti AI specializzati nel supporto alla vendita: guidano i clienti nella scelta dei prodotti, rispondono alle domande sul catalogo, gestiscono il carrello e aiutano a chiudere ordini direttamente in chat. Questi agenti sono addestrati con i tuoi dati e parlano in oltre 30 lingue. Saresti interessato ad avere agenti AI dedicati alle vendite?",
    salesAgents_opt1: "Sì, voglio agenti di vendita AI",
    salesAgents_opt2: "Un assistente AI generico va bene",
    salesAgents_opt3: "Non ho bisogno di vendita assistita",

    // Step 5: Ecommerce
    ecommerce_title: "E-Commerce",
    ecommerce_q: "eChatbot ha un motore e-commerce integrato che permette ai clienti di sfogliare il catalogo, aggiungere prodotti al carrello e completare gli ordini direttamente in chat — su WhatsApp o widget. Se hai già un negozio online o stai pianificando di avviarne uno, possiamo integrarlo o costruirne uno nuovo. La tua attività vende prodotti o servizi online?",
    ecommerce_opt1: "Sì, ho già un e-commerce",
    ecommerce_opt2: "No, non vendo online",
    ecommerce_opt3: "Sto pianificando di iniziare",

    // Step 6: Ecommerce Platform (conditional)
    ecommercePlatform_title: "Piattaforma E-Commerce",
    ecommercePlatform_q: "Ottimo! Lavoriamo con le principali piattaforme e-commerce. La sincronizzazione con eChatbot è automatica: qualsiasi modifica fatta sulla tua piattaforma si riflette immediatamente nel chatbot — catalogo, prezzi, disponibilità. Quale piattaforma stai usando?",
    ecommercePlatform_opt1: "WordPress / WooCommerce",
    ecommercePlatform_opt2: "PrestaShop",
    ecommercePlatform_opt3: "Magento / Adobe Commerce",
    ecommercePlatform_opt4: "Altra piattaforma",

    // Step 7: External integrations
    integrations_title: "Integrazioni Esterne",
    integrations_q: "Il tuo business utilizza sistemi esterni che potrebbero beneficiare dell'integrazione con eChatbot? Ad esempio: CRM (Salesforce, HubSpot), ERP, software di magazzino, sistemi di pagamento, piattaforme di marketing automation, o altri strumenti aziendali. L'integrazione permette di sincronizzare automaticamente dati, ordini e interazioni.",
    integrations_opt1: "Sì, ho sistemi da integrare",
    integrations_opt2: "Non uso sistemi esterni",
    integrations_opt3: "Non so, vorrei saperne di più",

    // Step 8: Privacy
    privacy_title: "Privacy e Sicurezza",
    privacy_q: "Comprendiamo che la privacy dei tuoi clienti è fondamentale. eChatbot è progettato con la privacy al centro: non inviamo mai dati sensibili dei clienti ai modelli AI. Le informazioni personali (contatti, ordini, pagamenti) rimangono sempre nel tuo database. Per le operazioni sensibili usiamo link con token temporizzati, accessibili solo dall'utente interessato.",
    privacy_opt1: "Sì, questo approccio mi convince",
    privacy_opt2: "Ho alcune domande sulla privacy",
    privacy_opt3: "Vorrei saperne di più",

    // Step 9: Interest rating
    interest_title: "Quanto sei interessato?",
    interest_q: "Onestamente, quanto sei interessato a eChatbot per la tua attività? Seleziona da 0 (per niente) a 5 (molto interessato).",

    // Step 10: Other (textarea)
    other_title: "Hai altro da aggiungere?",
    other_q: "C'è qualcosa di specifico che vorresti fare con un chatbot AI e che non abbiamo coperto? Un caso d'uso particolare, un'integrazione specifica, una funzionalità che hai in mente? Qualsiasi dettaglio ci aiuta a capire meglio come possiamo aiutarti.",
    other_placeholder: "Scrivi qui le tue idee o domande… (opzionale)",

    // Step 10: Contact consent
    contact_title: "Parliamo insieme",
    contact_q: "Grazie per aver completato il survey! Le tue risposte ci aiuteranno a costruire un chatbot su misura per te. Saresti disponibile per una breve chiamata con il nostro team? Ti mostreremmo una demo personalizzata e risponderemmo a tutte le tue domande — senza impegno.",
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
    noContact_desc: "Apprezziamo il tempo che hai dedicato a rispondere. Le tue risposte ci aiuteranno a migliorare eChatbot. Se cambi idea, siamo sempre disponibili — trovi il link di contatto nella homepage.",
    noContact_cta: "Torna alla homepage",

    // Header back link
    header_back: "← Torna alla homepage",
    header_brand: "eChatbot",

    // Try chatbot CTA
    try_chatbot: "Hai dubbi o domande? Prova il nostro chatbot su WhatsApp!",
    try_chatbot_button: "Chatta con noi",
  },

  en: {
    intro_title: "Help us understand your needs",
    intro_desc: "Answer a few questions to help us understand how eChatbot can transform your business. The secret to a great chatbot is quality responses: the more we understand your context, the better we can configure it for you. We'll cover customer support, push marketing, widget, sales, and more.\nAbout 2 minutes — no commitment.",
    intro_cta: "Start the survey →",
    back: "← Back",
    next: "Next →",
    almost: "Almost done →",
    step_of: "Step {current} of {total}",

    humanSupport_title: "Human Support",
    humanSupport_q: "One of eChatbot's strengths is the intelligent handoff from AI to a human agent — without losing conversation context. When a customer has a complex issue, the AI agent instantly transfers the chat to an operator who receives a WhatsApp notification with the full conversation history. Would you like this capability integrated into your chatbot?",
    humanSupport_opt1: "Yes, I want human handoff capability",
    humanSupport_opt2: "Partial automation with selective oversight",
    humanSupport_opt3: "Full automation works for me",

    pushMarketing_title: "Push Marketing",
    pushMarketing_q: "WhatsApp push campaigns have open rates above 90% — far higher than email or SMS. With eChatbot you can send targeted promotional messages, new product alerts, special offers, and automated follow-ups to your customers directly on WhatsApp, at the right moment. Would you be interested in using this channel to re-engage customers and boost sales?",
    pushMarketing_opt1: "Yes, I want push campaigns",
    pushMarketing_opt2: "Not right now",

    widget_title: "Chat Widget",
    widget_q: "eChatbot's Widget lets you integrate a smart chat directly into your website, using the same chatbot you've configured for WhatsApp. Visitors can start a conversation without leaving your site, and the chatbot responds in real time. The chat can then move to WhatsApp to continue even offline. Do you have a website and would you like to add a chat widget?",
    widget_opt1: "Yes, I want a widget on my website",
    widget_opt2: "WhatsApp only, no widget needed",
    widget_opt3: "Both — website widget + WhatsApp",

    salesAgents_title: "AI Sales Agents",
    salesAgents_q: "eChatbot offers AI agents specialised in sales support: they guide customers through product selection, answer catalog questions, manage the cart, and help close orders directly in chat. These agents are trained on your data and converse in over 30 languages. Would you be interested in having AI agents dedicated to driving sales?",
    salesAgents_opt1: "Yes, I want AI sales agents",
    salesAgents_opt2: "A general AI assistant is enough",
    salesAgents_opt3: "I don't need assisted sales",

    ecommerce_title: "E-Commerce",
    ecommerce_q: "eChatbot has a built-in e-commerce engine that lets customers browse the catalog, add products to cart, and complete orders directly in chat — on WhatsApp or the widget. If you already have an online store or are planning to launch one, we can integrate it or build a new one. Does your business sell products or services online?",
    ecommerce_opt1: "Yes, I already have an e-commerce",
    ecommerce_opt2: "No, I don't sell online",
    ecommerce_opt3: "I'm planning to start",

    ecommercePlatform_title: "E-Commerce Platform",
    ecommercePlatform_q: "Great! We work with all major e-commerce platforms. Synchronisation with eChatbot is automatic — any change made on your platform (catalog, prices, availability) is instantly reflected in the chatbot. Which platform are you using?",
    ecommercePlatform_opt1: "WordPress / WooCommerce",
    ecommercePlatform_opt2: "PrestaShop",
    ecommercePlatform_opt3: "Magento / Adobe Commerce",
    ecommercePlatform_opt4: "Other platform",

    // Step 7: External integrations
    integrations_title: "External Integrations",
    integrations_q: "Does your business use external systems that could benefit from integration with eChatbot? For example: CRM (Salesforce, HubSpot), ERP, warehouse software, payment systems, marketing automation platforms, or other business tools. Integration allows automatic synchronization of data, orders, and interactions.",
    integrations_opt1: "Yes, I have systems to integrate",
    integrations_opt2: "I don't use external systems",
    integrations_opt3: "I don't know, I'd like to learn more",

    // Step 8: Privacy
    privacy_q: "We understand that your customers' privacy is paramount. eChatbot is designed with privacy at its core: we never send sensitive customer data to AI models. Personal information (contacts, orders, payments) always stays in your database. For sensitive operations we use time-limited token links, accessible only by the specific user.",
    privacy_opt1: "Yes, this approach works for me",
    privacy_opt2: "I have some privacy concerns",
    privacy_opt3: "I'd like to know more",

    // Step 9: Interest rating
    interest_title: "How interested are you?",
    interest_q: "Honestly, how interested are you in eChatBot for your business? Select from 0 (not at all) to 5 (very interested).",

    // Step 10: Other (textarea)
    other_title: "Anything Else?",
    other_q: "Is there something specific you'd like to do with an AI chatbot that we haven't covered? A particular use case, a specific integration, a feature you have in mind? Any details help us better understand how we can help you.",
    other_placeholder: "Write your ideas or questions here… (optional)",

    contact_title: "Let's Talk",
    contact_q: "Thank you for completing the survey! Your answers will help us build a chatbot tailored to your needs. Would you be available for a brief call with our team? We'd show you a personalised demo and answer all your questions — no commitment required.",
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
    noContact_desc: "We appreciate the time you took to respond. Your answers will help us improve eChatbot. If you change your mind, we're always here — find the contact link on the homepage.",
    noContact_cta: "Back to homepage",

    header_back: "← Back to homepage",
    header_brand: "eChatbot",

    // Try chatbot CTA
    try_chatbot: "Have doubts or questions? Try our chatbot on WhatsApp!",
    try_chatbot_button: "Chat with us",
  },

  es: {
    intro_title: "Ayúdanos a entender tus necesidades",
    intro_desc: "Responde algunas preguntas para ayudarnos a entender cómo eChatbot puede transformar tu negocio. El secreto de un buen chatbot son las respuestas de calidad: cuanto más entendemos tu contexto, mejor podemos configurarlo. Hablaremos de soporte al cliente, marketing push, widget, ventas y mucho más.\nUnos 2 minutos — sin compromiso.",
    intro_cta: "Iniciar el survey →",
    back: "← Atrás",
    next: "Siguiente →",
    almost: "¡Ya casi! →",
    step_of: "Paso {current} de {total}",

    humanSupport_title: "Soporte Humano",
    humanSupport_q: "Una de las fortalezas de eChatbot es la transferencia inteligente de la IA a un agente humano — sin perder el contexto de la conversación. Cuando un cliente tiene un problema complejo, el agente de IA transfiere inmediatamente el chat a un operador que recibe una notificación de WhatsApp con todo el historial. ¿Te gustaría tener esta capacidad integrada en tu chatbot?",
    humanSupport_opt1: "Sí, quiero transferencias a operador humano",
    humanSupport_opt2: "Automatización parcial con supervisión selectiva",
    humanSupport_opt3: "La automatización completa me funciona",

    pushMarketing_title: "Marketing Push",
    pushMarketing_q: "Las campañas push de WhatsApp tienen tasas de apertura superiores al 90% — mucho más que el correo o los SMS. Con eChatbot puedes enviar mensajes promocionales dirigidos, alertas de nuevos productos, ofertas especiales y seguimientos automatizados a tus clientes directamente en WhatsApp. ¿Te interesaría usar este canal para reactivar clientes y aumentar las ventas?",
    pushMarketing_opt1: "Sí, quiero campañas push",
    pushMarketing_opt2: "Por ahora no",

    widget_title: "Widget de Chat",
    widget_q: "El Widget de eChatbot permite integrar un chat inteligente directamente en tu sitio web, utilizando el mismo chatbot que has configurado para WhatsApp. Los visitantes pueden iniciar una conversación sin salir del sitio y el chatbot responde en tiempo real. El chat puede luego trasladarse a WhatsApp para continuar incluso offline. ¿Tienes un sitio web y te gustaría añadir un widget de chat?",
    widget_opt1: "Sí, quiero el widget en mi web",
    widget_opt2: "Solo WhatsApp, sin widget",
    widget_opt3: "Ambos — widget + WhatsApp",

    salesAgents_title: "Agentes de Ventas IA",
    salesAgents_q: "eChatbot ofrece agentes de IA especializados en soporte de ventas: guían a los clientes en la selección de productos, responden preguntas del catálogo, gestionan el carrito y ayudan a cerrar pedidos directamente en el chat. Estos agentes están entrenados con tus datos y conversan en más de 30 idiomas. ¿Te interesaría tener agentes de IA dedicados a impulsar las ventas?",
    salesAgents_opt1: "Sí, quiero agentes de ventas IA",
    salesAgents_opt2: "Un asistente IA general es suficiente",
    salesAgents_opt3: "No necesito ventas asistidas",

    ecommerce_title: "E-Commerce",
    ecommerce_q: "eChatbot tiene un motor de e-commerce integrado que permite a los clientes explorar el catálogo, añadir productos al carrito y completar pedidos directamente en el chat — en WhatsApp o en el widget. Si ya tienes una tienda online o estás planeando crear una, podemos integrarla o construir una nueva. ¿Tu negocio vende productos o servicios online?",
    ecommerce_opt1: "Sí, ya tengo un e-commerce",
    ecommerce_opt2: "No, no vendo online",
    ecommerce_opt3: "Estoy planeando empezar",

    ecommercePlatform_title: "Plataforma E-Commerce",
    ecommercePlatform_q: "¡Genial! Trabajamos con todas las principales plataformas. La sincronización con eChatbot es automática — cualquier cambio en tu plataforma (catálogo, precios, disponibilidad) se refleja instantáneamente en el chatbot. ¿Qué plataforma estás usando?",
    ecommercePlatform_opt1: "WordPress / WooCommerce",
    ecommercePlatform_opt2: "PrestaShop",
    ecommercePlatform_opt3: "Magento / Adobe Commerce",
    ecommercePlatform_opt4: "Otra plataforma",

    // Step 7: External integrations
    integrations_title: "Integraciones Externas",
    integrations_q: "¿Tu negocio utiliza sistemas externos que podrían beneficiarse de la integración con eChatbot? Por ejemplo: CRM (Salesforce, HubSpot), ERP, software de almacén, sistemas de pago, plataformas de automatización de marketing, u otras herramientas empresariales. La integración permite sincronizar automáticamente datos, pedidos e interacciones.",
    integrations_opt1: "Sí, tengo sistemas para integrar",
    integrations_opt2: "No uso sistemas externos",
    integrations_opt3: "No lo sé, me gustaría saber más",

    // Step 8: Privacy
    privacy_q: "Entendemos que la privacidad de tus clientes es fundamental. eChatbot está diseñado con la privacidad en el centro: nunca enviamos datos sensibles de los clientes a los modelos de IA. La información personal (contactos, pedidos, pagos) siempre permanece en tu base de datos. Para operaciones sensibles usamos enlaces con tokens de tiempo limitado, accesibles solo por el usuario en cuestión.",
    privacy_opt1: "Sí, este enfoque me convence",
    privacy_opt2: "Tengo algunas dudas sobre privacidad",
    privacy_opt3: "Me gustaría saber más",

    // Step 9: Interest rating
    interest_title: "¿Cuánto te interesa?",
    interest_q: "Honestamente, ¿cuánto te interesa eChatBot para tu negocio? Selecciona de 0 (nada) a 5 (muy interesado).",

    // Step 10: Other (textarea)
    other_title: "¿Algo más?",
    other_q: "¿Hay algo específico que quisieras hacer con un chatbot de IA y que no hayamos cubierto? ¿Un caso de uso particular, una integración específica, una función que tengas en mente? Cualquier detalle nos ayuda a entender mejor cómo podemos ayudarte.",
    other_placeholder: "Escribe tus ideas o preguntas aquí… (opcional)",

    contact_title: "Hablemos",
    contact_q: "¡Gracias por completar el survey! Tus respuestas nos ayudarán a crear un chatbot a medida para tus necesidades. ¿Estarías disponible para una breve llamada con nuestro equipo? Te mostraríamos una demo personalizada y responderíamos todas tus preguntas — sin ningún compromiso.",
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

    header_back: "← Volver a la página principal",
    header_brand: "eChatbot",

    // Try chatbot CTA
    try_chatbot: "¿Tienes dudas o preguntas? ¡Prueba nuestro chatbot en WhatsApp!",
    try_chatbot_button: "Chatea con nosotros",
  },

  pt: {
    intro_title: "Ajude-nos a entender suas necessidades",
    intro_desc: "Responda algumas perguntas para nos ajudar a entender como o eChatbot pode transformar o seu negócio. O segredo de um bom chatbot são as respostas de qualidade: quanto mais entendemos o seu contexto, melhor podemos configurá-lo. Falaremos sobre atendimento ao cliente, marketing push, widget, vendas e muito mais.\nCerca de 2 minutos — sem compromisso.",
    intro_cta: "Iniciar o survey →",
    back: "← Voltar",
    next: "Próximo →",
    almost: "Quase lá →",
    step_of: "Passo {current} de {total}",

    humanSupport_title: "Suporte Humano",
    humanSupport_q: "Um dos pontos fortes do eChatbot é a transferência inteligente da IA para um agente humano — sem perder o contexto da conversa. Quando um cliente tem um problema complexo, o agente de IA transfere imediatamente o chat para um operador que recebe uma notificação no WhatsApp com todo o histórico. Gostaria de ter essa capacidade integrada no seu chatbot?",
    humanSupport_opt1: "Sim, quero transferência para operador humano",
    humanSupport_opt2: "Automação parcial com supervisão seletiva",
    humanSupport_opt3: "Automação completa está ótimo para mim",

    pushMarketing_title: "Marketing Push",
    pushMarketing_q: "As campanhas push do WhatsApp têm taxas de abertura superiores a 90% — muito mais do que e-mail ou SMS. Com o eChatbot você pode enviar mensagens promocionais direcionadas, alertas de novos produtos, ofertas especiais e follow-ups automatizados para os seus clientes diretamente no WhatsApp. Você teria interesse em usar este canal para reengajar clientes e aumentar as vendas?",
    pushMarketing_opt1: "Sim, quero campanhas push",
    pushMarketing_opt2: "Por enquanto não",

    widget_title: "Widget de Chat",
    widget_q: "O Widget do eChatbot permite integrar um chat inteligente diretamente no seu site, utilizando o mesmo chatbot que você configurou para o WhatsApp. Os visitantes podem iniciar uma conversa sem sair do site e o chatbot responde em tempo real. O chat pode depois migrar para o WhatsApp para continuar mesmo offline. Você tem um site e gostaria de adicionar um widget de chat?",
    widget_opt1: "Sim, quero o widget no meu site",
    widget_opt2: "Somente WhatsApp, sem widget",
    widget_opt3: "Ambos — widget + WhatsApp",

    salesAgents_title: "Agentes de Vendas IA",
    salesAgents_q: "O eChatbot oferece agentes de IA especializados em suporte a vendas: guiam os clientes na escolha de produtos, respondem perguntas do catálogo, gerenciam o carrinho e ajudam a fechar pedidos diretamente no chat. Esses agentes são treinados com os seus dados e conversam em mais de 30 idiomas. Você teria interesse em ter agentes de IA dedicados a impulsionar as vendas?",
    salesAgents_opt1: "Sim, quero agentes de vendas IA",
    salesAgents_opt2: "Um assistente de IA geral é suficiente",
    salesAgents_opt3: "Não preciso de vendas assistidas",

    ecommerce_title: "E-Commerce",
    ecommerce_q: "O eChatbot tem um motor de e-commerce integrado que permite aos clientes navegar no catálogo, adicionar produtos ao carrinho e concluir pedidos diretamente no chat — no WhatsApp ou no widget. Se você já tem uma loja online ou está planejando criar uma, podemos integrá-la ou criar uma nova. O seu negócio vende produtos ou serviços online?",
    ecommerce_opt1: "Sim, já tenho um e-commerce",
    ecommerce_opt2: "Não, não vendo online",
    ecommerce_opt3: "Estou planejando começar",

    ecommercePlatform_title: "Plataforma E-Commerce",
    ecommercePlatform_q: "Ótimo! Trabalhamos com todas as principais plataformas. A sincronização com o eChatbot é automática — qualquer alteração na sua plataforma (catálogo, preços, disponibilidade) é refletida instantaneamente no chatbot. Qual plataforma você está usando?",
    ecommercePlatform_opt1: "WordPress / WooCommerce",
    ecommercePlatform_opt2: "PrestaShop",
    ecommercePlatform_opt3: "Magento / Adobe Commerce",
    ecommercePlatform_opt4: "Outra plataforma",

    // Step 7: External integrations
    integrations_title: "Integrações Externas",
    integrations_q: "O seu negócio utiliza sistemas externos que poderiam se beneficiar da integração com o eChatbot? Por exemplo: CRM (Salesforce, HubSpot), ERP, software de estoque, sistemas de pagamento, plataformas de automação de marketing, ou outras ferramentas empresariais. A integração permite sincronizar automaticamente dados, pedidos e interações.",
    integrations_opt1: "Sim, tenho sistemas para integrar",
    integrations_opt2: "Não uso sistemas externos",
    integrations_opt3: "Não sei, gostaria de saber mais",

    // Step 8: Privacy
    privacy_q: "Entendemos que a privacidade dos seus clientes é fundamental. O eChatbot foi desenvolvido com a privacidade no centro: nunca enviamos dados sensíveis dos clientes para modelos de IA. As informações pessoais (contatos, pedidos, pagamentos) sempre ficam no seu banco de dados. Para operações sensíveis usamos links com tokens temporários, acessíveis apenas pelo usuário em questão.",
    privacy_opt1: "Sim, essa abordagem me convence",
    privacy_opt2: "Tenho algumas dúvidas sobre privacidade",
    privacy_opt3: "Gostaria de saber mais",

    // Step 9: Interest rating
    interest_title: "Quanto você está interessado?",
    interest_q: "Honestamente, quanto você está interessado no eChatBot para o seu negócio? Selecione de 0 (nada) a 5 (muito interessado).",

    // Step 10: Other (textarea)
    other_title: "Algo mais?",
    other_q: "Há algo específico que você gostaria de fazer com um chatbot de IA e que não cobrimos? Um caso de uso particular, uma integração específica, uma funcionalidade que você tem em mente? Qualquer detalhe nos ajuda a entender melhor como podemos ajudá-lo.",
    other_placeholder: "Escreva suas ideias ou perguntas aqui… (opcional)",

    contact_title: "Vamos Conversar",
    contact_q: "Obrigado por completar o survey! As suas respostas nos ajudarão a criar um chatbot sob medida para as suas necessidades. Você estaria disponível para uma breve ligação com a nossa equipe? Mostraríamos uma demo personalizada e responderíamos a todas as suas dúvidas — sem nenhum compromisso.",
    contact_opt1: "Sim, por favor me contactem!",
    contact_opt2: "Não, mas obrigado pelas informações",

    form_title: "Como podemos entrar em contato?",
    form_desc: "Deixe seus dados e entraremos em contato em até 24 horas para organizar uma demo personalizada.",
    form_fullName: "Nome completo *",
    form_email: "Email *",
    form_phone: "Telefone",
    form_company: "Empresa",
    form_submit: "Enviar →",
    form_submitting: "Enviando…",
    form_error: "Algo deu errado. Por favor, tente novamente.",

    success_title: "Obrigado!",
    success_desc: "Recebemos as suas respostas. Nossa equipe entrará em contato em breve para uma demo personalizada do eChatbot.",
    success_cta: "Voltar para a página inicial",

    noContact_title: "Muito obrigado!",
    noContact_desc: "Apreciamos o tempo que dedicou para responder. As suas respostas nos ajudarão a melhorar o eChatbot. Se mudar de ideia, estamos sempre disponíveis.",
    noContact_cta: "Voltar para a página inicial",

    header_back: "← Voltar para a página inicial",
    header_brand: "eChatbot",

    // Try chatbot CTA
    try_chatbot: "Tem dúvidas ou perguntas? Experimente nosso chatbot no WhatsApp!",
    try_chatbot_button: "Converse conosco",
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
  type: "radio" | "textarea" | "stars"
  options?: StepOption[]
  image?: string // Optional image URL for the step
  /** If provided, this step is only shown when the condition is met */
  showWhen?: (answers: Record<string, string>) => boolean
}

function buildSteps(T: Record<string, string>): StepDef[] {
  return [
    {
      id: "stepHumanSupport",
      icon: "🤝",
      titleKey: "humanSupport_title",
      questionKey: "humanSupport_q",
      type: "radio",
      image: "/survey-1.png",
      options: [
        { value: "yes_handoff", label: T.humanSupport_opt1, emoji: "🤝" },
        { value: "partial", label: T.humanSupport_opt2, emoji: "⚖️" },
        { value: "full_auto", label: T.humanSupport_opt3, emoji: "🤖" },
      ],
    },
    {
      id: "stepPushMarketing",
      icon: "📣",
      titleKey: "pushMarketing_title",
      questionKey: "pushMarketing_q",
      type: "radio",
      image: "https://www.echatbot.ai/push.png",
      options: [
        { value: "yes", label: T.pushMarketing_opt1, emoji: "📣" },
        { value: "no", label: T.pushMarketing_opt2, emoji: "⏸️" },
      ],
    },
    {
      id: "stepWidget",
      icon: "🌐",
      titleKey: "widget_title",
      questionKey: "widget_q",
      type: "radio",
      image: "https://www.echatbot.ai/demo.png",
      options: [
        { value: "yes_widget", label: T.widget_opt1, emoji: "🌐" },
        { value: "whatsapp_only", label: T.widget_opt2, emoji: "💬" },
        { value: "both", label: T.widget_opt3, emoji: "🔀" },
      ],
    },
    {
      id: "stepSalesAgents",
      icon: "🛍️",
      titleKey: "salesAgents_title",
      questionKey: "salesAgents_q",
      type: "radio",
      image: "/survey-agent.png",
      options: [
        { value: "yes", label: T.salesAgents_opt1, emoji: "🛍️" },
        { value: "general", label: T.salesAgents_opt2, emoji: "🤖" },
        { value: "no", label: T.salesAgents_opt3, emoji: "⏸️" },
      ],
    },
    {
      id: "stepEcommerce",
      icon: "🛒",
      titleKey: "ecommerce_title",
      questionKey: "ecommerce_q",
      type: "radio",
      image: "/survey-ecommerce.png",
      options: [
        { value: "yes", label: T.ecommerce_opt1, emoji: "🛒" },
        { value: "no", label: T.ecommerce_opt2, emoji: "🏪" },
        { value: "planning", label: T.ecommerce_opt3, emoji: "🚀" },
      ],
    },
    {
      id: "stepEcommercePlatform",
      icon: "🔧",
      titleKey: "ecommercePlatform_title",
      questionKey: "ecommercePlatform_q",
      type: "radio",
      image: "https://www.echatbot.ai/demo.png",
      showWhen: (answers) => answers.stepEcommerce === "yes",
      options: [
        { value: "wordpress", label: T.ecommercePlatform_opt1, emoji: "🔵" },
        { value: "prestashop", label: T.ecommercePlatform_opt2, emoji: "🟣" },
        { value: "magento", label: T.ecommercePlatform_opt3, emoji: "🟠" },
        { value: "other", label: T.ecommercePlatform_opt4, emoji: "🔧" },
      ],
    },
    {
      id: "stepIntegrations",
      icon: "🔗",
      titleKey: "integrations_title",
      questionKey: "integrations_q",
      type: "radio",
      image: "https://www.echatbot.ai/CRM.png",
      options: [
        { value: "yes", label: T.integrations_opt1, emoji: "🔗" },
        { value: "no", label: T.integrations_opt2, emoji: "📦" },
        { value: "learn_more", label: T.integrations_opt3, emoji: "🎓" },
      ],
    },
    {
      id: "stepPrivacy",
      icon: "🔒",
      titleKey: "privacy_title",
      questionKey: "privacy_q",
      type: "radio",
      image: "https://www.echatbot.ai/privacy.png",
      options: [
        { value: "ok", label: T.privacy_opt1, emoji: "🔒" },
        { value: "concerns", label: T.privacy_opt2, emoji: "🤔" },
        { value: "need_info", label: T.privacy_opt3, emoji: "📚" },
      ],
    },
    {
      id: "stepInterest",
      icon: "⭐",
      titleKey: "interest_title",
      questionKey: "interest_q",
      type: "stars",
      image: "/survey-interest.png",
    },
    {
      id: "stepOther",
      icon: "💭",
      titleKey: "other_title",
      questionKey: "other_q",
      type: "textarea",
      image: "/survery-altro.png",
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
  const lang = (["it", "en", "es", "pt"].includes(language) ? language : "en") as Lang
  const T = QT[lang]

  type View = "intro" | "steps" | "contact_form" | "success" | "no_contact"
  const [view, setView] = useState<View>("intro")
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [answers, setAnswers] = useState<Record<string, string>>({})
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
      submitAnswers(false, { fullName: "", email: "", phone: "", company: "" })
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
      await axios.post(`${API_BASE}/questionnaire`, {
        ...contactData,
        ...answers,
        wantsContact,
      })
      setView("success")
    } catch {
      setSubmitError(T.form_error)
      setIsSubmitting(false)
    }
  }

  const canProceed = step && (step.type === "textarea"
    ? true // textarea is optional
    : step.type === "stars"
    ? !!answers[step.id] // stars must be selected
    : !!answers[step.id])

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, rgba(248,250,252,0.97) 0%, rgba(236,253,245,0.95) 50%, rgba(240,253,244,0.97) 100%)",
      }}
    >
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="eChatbot" className="w-12 h-12" />
            <span className="text-xl font-bold text-green-600">{T.header_brand}</span>
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-slate-600 hover:text-green-600 transition-colors"
          >
            {T.header_back}
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)] px-4 py-12">
        <div className="w-full max-w-[712px]">

          {/* ── INTRO ── */}
          {view === "intro" && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-2xl shadow-xl overflow-hidden"
            >
              {/* Top banner */}
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-8 text-white text-center">
                <h1 className="text-3xl font-bold">{T.intro_title}</h1>
              </div>

              {/* Body */}
              <div className="p-10">
                {/* Full-width intro image */}
                <div className="-mx-10 -mt-10 mb-8">
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
                  <div className="hidden w-full h-48 bg-gradient-to-br from-green-50 to-emerald-100 border-b border-emerald-200 items-center justify-center">
                    <span className="text-4xl opacity-30">🖼️</span>
                  </div>
                </div>

                <p className="text-slate-600 mb-8 leading-relaxed" style={{ fontSize: "1.15rem", whiteSpace: "pre-line" }}>
                  {T.intro_desc}
                </p>

                <Button
                  size="lg"
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-7 text-xl rounded-xl shadow-lg"
                  onClick={() => {
                    setView("steps")
                    setCurrentStep(0)
                  }}
                >
                  {T.intro_cta}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── STEPS ── */}
          {view === "steps" && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              {/* Progress bar */}
              <div className="h-1.5 bg-slate-100">
                <motion.div
                  className="h-full bg-green-500"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <div className="p-8">
                {/* Step counter */}
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {stepLabel()}
                  </span>
                  <div className="flex gap-1">
                    {activeSteps.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 w-5 rounded-full transition-colors ${
                          i <= currentStep ? "bg-green-500" : "bg-slate-200"
                        }`}
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
                      <div className="-mx-8 -mt-0 mb-6">
                        <img
                          src={step.image}
                          alt={T[step.titleKey]}
                          className="w-full h-52 object-cover"
                        />
                      </div>
                    ) : (
                      <div className="-mx-8 mb-6 w-[calc(100%+4rem)] h-52 bg-gradient-to-br from-green-50 to-emerald-100 border-b border-dashed border-emerald-200 flex items-center justify-center">
                        <span className="text-4xl opacity-30">🖼️</span>
                      </div>
                    )}

                    {/* Icon + Title */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-4xl">{step.icon}</span>
                      <h2 className="text-xl font-bold text-slate-900">{T[step.titleKey]}</h2>
                    </div>
                    <p className="text-slate-500 mb-6 leading-relaxed" style={{ fontSize: "1.15rem" }}>{T[step.questionKey]}</p>

                    {/* Radio options */}
                    {step.type === "radio" && step.options && (
                      <div className="space-y-3">
                        {step.options.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              handleAnswer(step.id, opt.value)
                              // Auto-advance radio selections after a short delay
                              setTimeout(() => {
                                if (currentStep < totalSteps - 1) {
                                  setDirection(1)
                                  setCurrentStep((s) => s + 1)
                                } else {
                                  submitAnswers(false, { fullName: "", email: "", phone: "", company: "" })
                                }
                              }, 300)
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                              answers[step.id] === opt.value
                                ? "border-green-500 bg-green-50 text-green-800"
                                : "border-slate-200 hover:border-green-300 text-slate-700"
                            }`}
                          >
                            <span className="text-xl">{opt.emoji}</span>
                            <span className="font-medium text-sm">{opt.label}</span>
                            {answers[step.id] === opt.value && (
                              <span className="ml-auto text-green-600">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Stars rating */}
                    {step.type === "stars" && (
                      <div className="flex justify-center gap-2 my-6">
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
                                  submitAnswers(false, { fullName: "", email: "", phone: "", company: "" })
                                }
                              }, 350)
                            }}
                            className="group relative transition-transform hover:scale-110"
                          >
                            <svg
                              className={`w-12 h-12 ${
                                answers[step.id] !== undefined && parseInt(answers[step.id]) >= star
                                  ? "text-yellow-400 fill-yellow-400"
                                  : "text-slate-300 fill-none hover:text-yellow-200"
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
                            <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-slate-500 font-medium">
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
                        className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:border-green-500 focus:outline-none resize-none transition-colors"
                      />
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Nav buttons */}
                <div className="flex gap-3 mt-8">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="flex-1 border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    {T.back}
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="flex-2 bg-green-600 hover:bg-green-700 text-white px-8"
                  >
                    {currentStep < totalSteps - 1 ? T.next : T.almost}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── CONTACT FORM ── */}
          {view === "contact_form" && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-2xl shadow-xl p-8"
            >
              <div className="text-5xl mb-3">👤</div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">{T.form_title}</h2>
              <p className="text-slate-500 mb-6 text-sm">{T.form_desc}</p>

              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    {T.form_fullName}
                  </label>
                  <Input
                    placeholder="John Smith"
                    value={contact.fullName}
                    onChange={(e) => setContact((c) => ({ ...c, fullName: e.target.value }))}
                    required
                    className="border-slate-200 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    {T.form_email}
                  </label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={contact.email}
                    onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                    required
                    className="border-slate-200 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    {T.form_phone}
                  </label>
                  <Input
                    type="tel"
                    placeholder="+39 333 1234567"
                    value={contact.phone}
                    onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                    className="border-slate-200 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    {T.form_company}
                  </label>
                  <Input
                    placeholder="Acme Inc."
                    value={contact.company}
                    onChange={(e) => setContact((c) => ({ ...c, company: e.target.value }))}
                    className="border-slate-200 focus:border-green-500"
                  />
                </div>

                {submitError && <p className="text-red-500 text-sm">{submitError}</p>}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setView("steps"); setCurrentStep(totalSteps - 1) }}
                    className="flex-1 border-slate-200 text-slate-600"
                  >
                    {T.back}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !contact.fullName.trim() || !contact.email.trim()}
                    className="flex-2 bg-green-600 hover:bg-green-700 text-white px-8 disabled:opacity-40"
                  >
                    {isSubmitting ? T.form_submitting : T.form_submit}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ── SUCCESS (with contact) ── */}
          {view === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-2xl shadow-xl p-10 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <span className="text-4xl">✅</span>
              </motion.div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">{T.success_title}</h2>
              <p className="text-slate-500 mb-8 leading-relaxed">{T.success_desc}</p>

              <Link to="/">
                <Button className="bg-green-600 hover:bg-green-700 text-white px-8">
                  {T.success_cta}
                </Button>
              </Link>
            </motion.div>
          )}

          {/* ── NO CONTACT THANK YOU ── */}
          {view === "no_contact" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-2xl shadow-xl p-10 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <span className="text-4xl">🙏</span>
              </motion.div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">{T.noContact_title}</h2>
              <p className="text-slate-500 mb-8 leading-relaxed">{T.noContact_desc}</p>

              <Link to="/">
                <Button className="bg-green-600 hover:bg-green-700 text-white px-8">
                  {T.noContact_cta}
                </Button>
              </Link>
            </motion.div>
          )}
        </div>
      </div>
      
      {/* Widget Loader + Floating Chat Widget */}
      <WidgetLoader />
      <ChatWidget workspaceId="echatbot-hq-support" position="bottom-right" logoUrl="/logo.png" />
    </div>
  )
}
