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
import { SiteFooter } from "@/components/layout/SiteFooter"
import { SEO } from "@/components/SEO"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1"

// ─────────────────────────────────────────
// Survey translations (self-contained, not in global LanguageContext)
// ─────────────────────────────────────────
type Lang = "it" | "en" | "es" | "de"

const QT: Record<Lang, Record<string, string>> = {
  it: {
    // Intro
    intro_title: "Aiutateci a costruire l'assistente giusto per voi",
    intro_desc: "Rispondete a qualche domanda sul vostro territorio e su cosa vi chiedono i turisti: vi mostriamo come l'assistente lavorerebbe per voi.\nDue minuti, senza impegno.",
    intro_cta: "Inizia il questionario →",
    back: "← Indietro",
    next: "Avanti →",
    almost: "Quasi fatto →",
    step_of: "Passo {current} di {total}",

    // Step 1: Chi siete
    org_title: "Chi siete",
    org_q: "Che tipo di ente rappresentate? Ci serve per capire con chi stiamo parlando e tarare l'esempio sul vostro caso.",
    org_opt1: "Pro Loco",
    org_opt2: "Consorzio turistico",
    org_opt3: "Ufficio IAT / Info point",
    org_opt4: "Comune o Unione di Comuni",
    org_opt5: "Altro ente del territorio",
    org_other_placeholder: "Specificate il vostro ente…",

    // Step 2: Stagionalità
    season_title: "Quando arrivano i turisti",
    season_q: "In che periodi dell'anno avete più affluenza? L'assistente è utile soprattutto nei picchi, quando allo sportello c'è la fila.",
    season_opt1: "Estate",
    season_opt2: "Inverno (neve)",
    season_opt3: "Primavera e autunno",
    season_opt4: "Tutto l'anno, senza grandi picchi",

    // Step 3: Le domande di ogni giorno
    questions_title: "Le domande di ogni giorno",
    questions_q: "Quali domande vi arrivano più spesso, allo sportello o al telefono? Sono esattamente quelle a cui l'assistente può rispondere al posto vostro, con quello che avete caricato voi.",
    questions_opt1: "Dove mangiare (anche celiaci, vegetariani)",
    questions_opt2: "Che escursioni si possono fare",
    questions_opt3: "Che eventi ci sono questa settimana",
    questions_opt4: "Orari e aperture (impianti, musei, uffici)",
    questions_opt5: "Dove dormire",
    questions_opt6: "Prodotti tipici e artigianato",
    questions_opt7: "Come arrivare e come muoversi",
    questions_opt8: "Meteo e condizioni dei sentieri",

    // Step 4: Lingue
    languages_title: "In quante lingue vi scrivono",
    languages_q: "I vostri contenuti li scrivete una volta sola: alla traduzione pensa l'assistente. Quali lingue vi servono davvero?",
    languages_opt1: "Italiano",
    languages_opt2: "Inglese",
    languages_opt3: "Tedesco",
    languages_opt4: "Francese",
    languages_opt5: "Spagnolo",
    languages_opt6: "Altre lingue",

    // Step 5: Fuori orario
    afterHours_title: "Quando l'ufficio è chiuso",
    afterHours_q: "Alle sette di sera, di domenica, a ferragosto: le domande arrivano lo stesso, ma non trovano nessuno. Quanto è un problema per voi?",
    afterHours_opt1: "Sì, ci perdiamo parecchie richieste",
    afterHours_opt2: "Capita, ma non spesso",
    afterHours_opt3: "No, il nostro orario copre bene",

    // Step 6: I contenuti che avete
    content_title: "Cosa avete già pronto",
    content_q: "L'assistente risponde solo con quello che caricate voi: se un dato non c'è, lo dice invece di inventarlo. Che materiale avete già a disposizione?",
    content_opt1: "Elenchi di hotel, B&B e ristoranti",
    content_opt2: "Schede di escursioni e sentieri",
    content_opt3: "Calendario eventi e sagre",
    content_opt4: "Foto e video del territorio",
    content_opt5: "Brochure e materiale cartaceo",
    content_opt6: "Poco o niente di organizzato",

    // Step 7: Chi aggiorna
    updates_title: "Chi tiene aggiornate le informazioni",
    updates_q: "Un orario che cambia, un albergo nuovo, la sagra di settembre: si scrivono nel pannello e l'assistente lo sa subito. Chi se ne occuperebbe da voi?",
    updates_opt1: "C'è una persona dedicata",
    updates_opt2: "Ce ne occupiamo a turno, in più persone",
    updates_opt3: "Nessuno di preciso, è il nostro problema",

    // Step 8: Supporto umano
    humanSupport_title: "Quando serve una persona",
    humanSupport_q: "Per le domande a cui l'assistente non sa rispondere, la conversazione può passare a voi: ricevete una notifica su WhatsApp con tutta la cronologia, e rispondete voi. Vi servirebbe?",
    humanSupport_opt1: "Sì, vogliamo poter intervenire",
    humanSupport_opt2: "No, ci basta l'assistente da solo",

    // Step 9: Notifiche push
    push_title: "Notifiche push ai turisti",
    push_q: "La sagra di sabato, la strada chiusa, il concerto in piazza: un messaggio che parte solo agli ospiti che hanno dato il consenso, revocabile sempre. Vi interessa?",
    push_opt1: "Sì, molto",
    push_opt2: "Forse, più avanti",
    push_opt3: "No, non ci serve",

    // Step 10: Sponsorizzazioni
    revenue_title: "Far sponsorizzare gli esercenti",
    revenue_q: "Un albergo, un ristorante o un noleggio possono sponsorizzarsi sul vostro canale, con un messaggio che arriva ai turisti che hanno dato il consenso. Voi decidete il prezzo, il sistema tiene il conto del numero di invii fatti. Per molti uffici basta a coprire il costo del servizio.",
    revenue_opt1: "Sì, ci interessa come entrata",
    revenue_opt2: "Interessante, ma da valutare",
    revenue_opt3: "No, non fa per noi",

    // Step 11: Privacy
    privacy_title: "Privacy e dati dei turisti",
    privacy_q: "I dati dei vostri turisti restano vostri. Nessun dato sensibile finisce a terzi o ai modelli AI, le notifiche partono solo a chi ha dato il consenso, e quel consenso si revoca in qualsiasi momento con una parola.",
    privacy_opt1: "Sì, ci convince",
    privacy_opt2: "Abbiamo ancora qualche dubbio",

    // Step 12: Altro
    other_title: "Ci siamo quasi!",
    other_q: "C'è qualcos'altro che vorreste dirci? Una particolarità del vostro territorio, una cosa che vi chiedono e che non abbiamo elencato, un'esigenza specifica. Ogni dettaglio ci aiuta a costruire qualcosa che vi sia davvero utile.",
    other_placeholder: "Scrivete qui le vostre idee o domande… (facoltativo)",

    // Step 13: Demo
    demo_title: "Provate la demo",
    demo_q: "Volete che vi inviamo una demo da provare? Vi mandiamo le credenziali di accesso via email, così vedete l'assistente al lavoro sul vostro territorio.",
    demo_opt1: "Sì, inviatecela",
    demo_opt2: "No, per ora no",

    // Step 14: Interesse
    interest_title: "Quanto vi interessa?",
    interest_q: "Onestamente, quanto vi interessa un assistente così per il vostro ufficio? Da 0 (per niente) a 5 (molto interessati).\n\nSe scegliete 0 non vi chiediamo nessun dato. Se siete interessati vi mostriamo una breve form di contatto.",

    // Contact form
    form_title: "Come vi contattiamo?",
    form_desc: "Lasciate i vostri dati e vi ricontattiamo entro 24 ore per mostrarvi l'assistente al lavoro.",
    form_fullName: "Nome e Cognome *",
    form_email: "Email *",
    form_phone: "Telefono",
    form_company: "Ente / Pro Loco",
    form_submit: "Invia →",
    form_submitting: "Invio in corso…",
    form_error: "Qualcosa è andato storto. Riprovate.",

    // Success
    success_title: "Grazie!",
    success_desc: "Abbiamo ricevuto le vostre risposte. Vi ricontattiamo presto per mostrarvi l'assistente al lavoro sul vostro territorio.",
    success_cta: "Torna alla homepage",

    // No-contact thank you
    noContact_title: "Grazie mille!",
    noContact_desc: "Apprezziamo il tempo che ci avete dedicato. Le vostre risposte ci aiutano a costruire un assistente migliore per gli uffici turistici. Se cambiate idea, trovate il link di contatto in homepage.",
    noContact_cta: "Torna alla homepage",

    // Try chatbot CTA
    try_chatbot: "Avete dubbi o domande? Provate il nostro assistente su WhatsApp!",
    try_chatbot_button: "Scrivici",
  },

  en: {
    intro_title: "Help us build the right assistant for you",
    intro_desc: "Answer a few questions about your area and what visitors ask you, and we'll show you how the assistant would work for you.\nTwo minutes, no commitment.",
    intro_cta: "Start the survey →",
    back: "← Back",
    next: "Next →",
    almost: "Almost done →",
    step_of: "Step {current} of {total}",

    org_title: "Who you are",
    org_q: "What kind of organisation do you represent? It helps us understand who we're talking to and tailor the example to your case.",
    org_opt1: "Tourist office / Pro Loco",
    org_opt2: "Tourism consortium",
    org_opt3: "Visitor centre / Info point",
    org_opt4: "Municipality or group of municipalities",
    org_opt5: "Another local organisation",
    org_other_placeholder: "Tell us what kind of organisation…",

    season_title: "When visitors arrive",
    season_q: "Which times of year are busiest for you? The assistant helps most during the peaks, when there's a queue at the desk.",
    season_opt1: "Summer",
    season_opt2: "Winter (snow season)",
    season_opt3: "Spring and autumn",
    season_opt4: "All year round, no big peaks",

    questions_title: "The questions you get every day",
    questions_q: "Which questions come up most often, at the desk or on the phone? These are exactly the ones the assistant can answer for you, using what you loaded yourself.",
    questions_opt1: "Where to eat (including coeliac, vegetarian)",
    questions_opt2: "What hikes and excursions are possible",
    questions_opt3: "What's on this week",
    questions_opt4: "Opening times (lifts, museums, offices)",
    questions_opt5: "Where to stay",
    questions_opt6: "Local produce and crafts",
    questions_opt7: "How to get here and get around",
    questions_opt8: "Weather and trail conditions",

    languages_title: "How many languages you get written in",
    languages_q: "You write your content once: the assistant handles the translation. Which languages do you actually need?",
    languages_opt1: "Italian",
    languages_opt2: "English",
    languages_opt3: "German",
    languages_opt4: "French",
    languages_opt5: "Spanish",
    languages_opt6: "Other languages",

    afterHours_title: "When the office is closed",
    afterHours_q: "Seven in the evening, Sundays, mid-August: the questions still arrive, but nobody is there. How much of a problem is that for you?",
    afterHours_opt1: "Yes, we lose quite a few enquiries",
    afterHours_opt2: "It happens, but not often",
    afterHours_opt3: "No, our opening hours cover it well",

    content_title: "What you already have",
    content_q: "The assistant answers only with what you load: if something isn't there, it says so rather than inventing it. What material do you already have?",
    content_opt1: "Lists of hotels, B&Bs and restaurants",
    content_opt2: "Hike and trail descriptions",
    content_opt3: "Events and festivals calendar",
    content_opt4: "Photos and video of the area",
    content_opt5: "Brochures and printed material",
    content_opt6: "Little or nothing organised",

    updates_title: "Who keeps the information current",
    updates_q: "A changed opening time, a new hotel, September's festival: you write them in the panel and the assistant knows straight away. Who would handle that on your side?",
    updates_opt1: "There's one person dedicated to it",
    updates_opt2: "Several of us take turns",
    updates_opt3: "Nobody in particular — that's our problem",

    humanSupport_title: "When a person is needed",
    humanSupport_q: "For questions the assistant can't answer, the conversation can be handed to you: you get a WhatsApp notification with the full history, and you reply yourself. Would you want that?",
    humanSupport_opt1: "Yes, we want to be able to step in",
    humanSupport_opt2: "No, the assistant alone is enough",

    push_title: "Push notifications to visitors",
    push_q: "Saturday's festival, the closed road, the concert in the square: a message that goes only to guests who opted in, and they can opt out any time. Interested?",
    push_opt1: "Yes, very",
    push_opt2: "Maybe, later on",
    push_opt3: "No, we don't need it",

    revenue_title: "Letting local businesses sponsor themselves",
    revenue_q: "A hotel, a restaurant or an equipment rental can sponsor themselves on your channel, with a message that reaches visitors who opted in. You set the price, the system keeps count of how many messages have been sent. For many offices that alone covers the cost of the service.",
    revenue_opt1: "Yes, that interests us as income",
    revenue_opt2: "Interesting, but we'd need to think about it",
    revenue_opt3: "No, not for us",

    privacy_title: "Privacy and visitor data",
    privacy_q: "Your visitors' data stays yours. No sensitive data goes to third parties or to AI models, notifications go only to those who opted in, and that consent can be withdrawn at any time with a single word.",
    privacy_opt1: "Yes, that works for us",
    privacy_opt2: "We still have some doubts",

    other_title: "Almost there!",
    other_q: "Is there anything else you'd like to tell us? Something particular about your area, a question you get that we haven't listed, a specific need. Any detail helps us build something genuinely useful for you.",
    other_placeholder: "Write your ideas or questions here… (optional)",

    demo_title: "Try the demo",
    demo_q: "Would you like us to send you a demo to try? We'll email you the access credentials, so you can see the assistant at work on your own area.",
    demo_opt1: "Yes, send it to us",
    demo_opt2: "No, not for now",

    interest_title: "How interested are you?",
    interest_q: "Honestly, how interested are you in an assistant like this for your office? From 0 (not at all) to 5 (very interested).\n\nIf you pick 0 we won't ask for any details. If you're interested, we'll show you a short contact form.",

    form_title: "How can we reach you?",
    form_desc: "Leave your details and we'll get back to you within 24 hours to show you the assistant at work.",
    form_fullName: "Full Name *",
    form_email: "Email *",
    form_phone: "Phone",
    form_company: "Organisation",
    form_submit: "Submit →",
    form_submitting: "Sending…",
    form_error: "Something went wrong. Please try again.",

    success_title: "Thank you!",
    success_desc: "We've received your answers. We'll be in touch shortly to show you the assistant at work on your own area.",
    success_cta: "Back to homepage",

    noContact_title: "Thank you so much!",
    noContact_desc: "We appreciate the time you took to answer. Your answers help us build a better assistant for tourist offices. If you change your mind, the contact link is on the homepage.",
    noContact_cta: "Back to homepage",

    try_chatbot: "Questions or doubts? Try our assistant on WhatsApp!",
    try_chatbot_button: "Message us",
  },

  es: {
    intro_title: "Ayudadnos a construir el asistente adecuado para vosotros",
    intro_desc: "Responded a unas preguntas sobre vuestro territorio y sobre lo que os preguntan los turistas: os mostramos cómo trabajaría el asistente para vosotros.\nDos minutos, sin compromiso.",
    intro_cta: "Empezar el cuestionario →",
    back: "← Atrás",
    next: "Siguiente →",
    almost: "¡Ya casi! →",
    step_of: "Paso {current} de {total}",

    org_title: "Quiénes sois",
    org_q: "¿Qué tipo de entidad representáis? Nos ayuda a saber con quién hablamos y a adaptar el ejemplo a vuestro caso.",
    org_opt1: "Oficina de Turismo",
    org_opt2: "Patronato o consorcio turístico",
    org_opt3: "Punto de información al visitante",
    org_opt4: "Ayuntamiento o mancomunidad",
    org_opt5: "Otra entidad del territorio",
    org_other_placeholder: "Indicad vuestra entidad…",

    season_title: "Cuándo llegan los turistas",
    season_q: "¿En qué épocas del año tenéis más afluencia? El asistente ayuda sobre todo en los picos, cuando hay cola en el mostrador.",
    season_opt1: "Verano",
    season_opt2: "Invierno (nieve)",
    season_opt3: "Primavera y otoño",
    season_opt4: "Todo el año, sin grandes picos",

    questions_title: "Las preguntas de cada día",
    questions_q: "¿Qué preguntas os llegan más a menudo, en el mostrador o por teléfono? Son exactamente las que el asistente puede responder por vosotros, con lo que hayáis cargado.",
    questions_opt1: "Dónde comer (también celíacos, vegetarianos)",
    questions_opt2: "Qué excursiones se pueden hacer",
    questions_opt3: "Qué eventos hay esta semana",
    questions_opt4: "Horarios (remontes, museos, oficinas)",
    questions_opt5: "Dónde dormir",
    questions_opt6: "Productos típicos y artesanía",
    questions_opt7: "Cómo llegar y cómo moverse",
    questions_opt8: "Meteorología y estado de los senderos",

    languages_title: "En cuántos idiomas os escriben",
    languages_q: "Vuestros contenidos los escribís una sola vez: de la traducción se encarga el asistente. ¿Qué idiomas necesitáis de verdad?",
    languages_opt1: "Italiano",
    languages_opt2: "Inglés",
    languages_opt3: "Alemán",
    languages_opt4: "Francés",
    languages_opt5: "Español",
    languages_opt6: "Otros idiomas",

    afterHours_title: "Cuando la oficina está cerrada",
    afterHours_q: "A las siete de la tarde, en domingo, en pleno agosto: las preguntas llegan igual, pero no hay nadie. ¿Cuánto os afecta?",
    afterHours_opt1: "Sí, perdemos bastantes consultas",
    afterHours_opt2: "Pasa, pero no a menudo",
    afterHours_opt3: "No, nuestro horario lo cubre bien",

    content_title: "Qué tenéis ya preparado",
    content_q: "El asistente responde solo con lo que cargáis vosotros: si un dato no está, lo dice en vez de inventarlo. ¿Qué material tenéis ya?",
    content_opt1: "Listados de hoteles, casas rurales y restaurantes",
    content_opt2: "Fichas de excursiones y senderos",
    content_opt3: "Calendario de eventos y fiestas",
    content_opt4: "Fotos y vídeos del territorio",
    content_opt5: "Folletos y material impreso",
    content_opt6: "Poco o nada organizado",

    updates_title: "Quién mantiene la información al día",
    updates_q: "Un horario que cambia, un hotel nuevo, la fiesta de septiembre: se escriben en el panel y el asistente lo sabe al momento. ¿Quién se encargaría?",
    updates_opt1: "Hay una persona dedicada",
    updates_opt2: "Nos turnamos entre varios",
    updates_opt3: "Nadie en concreto, ese es nuestro problema",

    humanSupport_title: "Cuando hace falta una persona",
    humanSupport_q: "Para las preguntas que el asistente no sabe responder, la conversación puede pasar a vosotros: recibís una notificación en WhatsApp con todo el historial y respondéis vosotros. ¿Os haría falta?",
    humanSupport_opt1: "Sí, queremos poder intervenir",
    humanSupport_opt2: "No, nos basta el asistente solo",

    push_title: "Notificaciones push a los turistas",
    push_q: "La fiesta del sábado, la carretera cortada, el concierto en la plaza: un mensaje que sale solo a quienes dieron su consentimiento, revocable siempre. ¿Os interesa?",
    push_opt1: "Sí, mucho",
    push_opt2: "Quizá más adelante",
    push_opt3: "No, no nos hace falta",

    revenue_title: "Que los negocios se patrocinen",
    revenue_q: "Un hotel, un restaurante o un alquiler de material pueden patrocinarse en vuestro canal, con un mensaje que llega a los turistas que dieron su consentimiento. Vosotros ponéis el precio, el sistema lleva la cuenta del número de envíos realizados. A muchas oficinas eso ya les cubre el coste del servicio.",
    revenue_opt1: "Sí, nos interesa como ingreso",
    revenue_opt2: "Interesante, pero hay que valorarlo",
    revenue_opt3: "No, no es para nosotros",

    privacy_title: "Privacidad y datos de los turistas",
    privacy_q: "Los datos de vuestros turistas siguen siendo vuestros. Ningún dato sensible acaba en terceros ni en los modelos de IA, las notificaciones salen solo a quien dio su consentimiento, y ese consentimiento se revoca en cualquier momento con una palabra.",
    privacy_opt1: "Sí, nos convence",
    privacy_opt2: "Todavía tenemos alguna duda",

    other_title: "¡Ya casi estamos!",
    other_q: "¿Hay algo más que queráis contarnos? Una particularidad de vuestro territorio, algo que os preguntan y que no hemos listado, una necesidad concreta. Cualquier detalle nos ayuda a construir algo realmente útil.",
    other_placeholder: "Escribid aquí vuestras ideas o preguntas… (opcional)",

    demo_title: "Probad la demo",
    demo_q: "¿Queréis que os enviemos una demo para probar? Os mandamos las credenciales de acceso por email, así veis el asistente trabajando sobre vuestro territorio.",
    demo_opt1: "Sí, enviádnosla",
    demo_opt2: "No, por ahora no",

    interest_title: "¿Cuánto os interesa?",
    interest_q: "Sinceramente, ¿cuánto os interesa un asistente así para vuestra oficina? De 0 (nada) a 5 (mucho).\n\nSi elegís 0 no os pedimos ningún dato. Si os interesa, os mostramos un breve formulario de contacto.",

    form_title: "¿Cómo os contactamos?",
    form_desc: "Dejadnos vuestros datos y os escribimos en 24 horas para enseñaros el asistente en funcionamiento.",
    form_fullName: "Nombre y Apellidos *",
    form_email: "Email *",
    form_phone: "Teléfono",
    form_company: "Entidad",
    form_submit: "Enviar →",
    form_submitting: "Enviando…",
    form_error: "Algo ha salido mal. Inténtalo de nuevo.",

    success_title: "¡Gracias!",
    success_desc: "Hemos recibido vuestras respuestas. Os escribimos pronto para enseñaros el asistente trabajando sobre vuestro territorio.",
    success_cta: "Volver a la página principal",

    noContact_title: "¡Muchas gracias!",
    noContact_desc: "Agradecemos el tiempo que nos habéis dedicado. Vuestras respuestas nos ayudan a construir un asistente mejor para las oficinas de turismo. Si cambiáis de idea, el enlace de contacto está en la página principal.",
    noContact_cta: "Volver a la página principal",

    try_chatbot: "¿Dudas o preguntas? ¡Probad nuestro asistente en WhatsApp!",
    try_chatbot_button: "Escribidnos",
  },

  de: {
    intro_title: "Helfen Sie uns, den passenden Assistenten für Sie zu bauen",
    intro_desc: "Beantworten Sie ein paar Fragen zu Ihrer Region und dazu, was Gäste Sie fragen: Wir zeigen Ihnen, wie der Assistent für Sie arbeiten würde.\nZwei Minuten, unverbindlich.",
    intro_cta: "Fragebogen starten →",
    back: "← Zurück",
    next: "Weiter →",
    almost: "Fast geschafft →",
    step_of: "Schritt {current} von {total}",

    org_title: "Wer Sie sind",
    org_q: "Welche Art von Einrichtung vertreten Sie? Das hilft uns zu verstehen, mit wem wir sprechen, und das Beispiel auf Ihren Fall zuzuschneiden.",
    org_opt1: "Tourismusbüro",
    org_opt2: "Tourismusverband",
    org_opt3: "Infopoint / Besucherzentrum",
    org_opt4: "Gemeinde oder Gemeindeverbund",
    org_opt5: "Andere Einrichtung der Region",
    org_other_placeholder: "Beschreiben Sie Ihre Einrichtung…",

    season_title: "Wann die Gäste kommen",
    season_q: "In welchen Zeiten des Jahres haben Sie den meisten Andrang? Der Assistent hilft vor allem in den Spitzenzeiten, wenn am Schalter Schlange steht.",
    season_opt1: "Sommer",
    season_opt2: "Winter (Schnee)",
    season_opt3: "Frühling und Herbst",
    season_opt4: "Ganzjährig, ohne große Spitzen",

    questions_title: "Die Fragen von jedem Tag",
    questions_q: "Welche Fragen kommen am häufigsten, am Schalter oder am Telefon? Genau die kann der Assistent für Sie beantworten — mit dem, was Sie selbst hinterlegt haben.",
    questions_opt1: "Wo man essen kann (auch glutenfrei, vegetarisch)",
    questions_opt2: "Welche Wanderungen möglich sind",
    questions_opt3: "Welche Veranstaltungen diese Woche laufen",
    questions_opt4: "Öffnungszeiten (Lifte, Museen, Ämter)",
    questions_opt5: "Wo man übernachten kann",
    questions_opt6: "Regionale Produkte und Handwerk",
    questions_opt7: "Anreise und Mobilität vor Ort",
    questions_opt8: "Wetter und Zustand der Wege",

    languages_title: "In wie vielen Sprachen man Ihnen schreibt",
    languages_q: "Ihre Inhalte schreiben Sie nur einmal: Um die Übersetzung kümmert sich der Assistent. Welche Sprachen brauchen Sie wirklich?",
    languages_opt1: "Italienisch",
    languages_opt2: "Englisch",
    languages_opt3: "Deutsch",
    languages_opt4: "Französisch",
    languages_opt5: "Spanisch",
    languages_opt6: "Weitere Sprachen",

    afterHours_title: "Wenn das Büro geschlossen ist",
    afterHours_q: "Um sieben Uhr abends, sonntags, Mitte August: Die Fragen kommen trotzdem, aber niemand ist da. Wie sehr ist das ein Problem für Sie?",
    afterHours_opt1: "Ja, uns gehen einige Anfragen verloren",
    afterHours_opt2: "Kommt vor, aber nicht oft",
    afterHours_opt3: "Nein, unsere Öffnungszeiten decken das gut ab",

    content_title: "Was Sie bereits haben",
    content_q: "Der Assistent antwortet nur mit dem, was Sie hinterlegen: Fehlt eine Information, sagt er das, statt sie zu erfinden. Welches Material haben Sie schon?",
    content_opt1: "Listen von Hotels, Pensionen und Restaurants",
    content_opt2: "Beschreibungen von Wanderungen und Wegen",
    content_opt3: "Veranstaltungs- und Festkalender",
    content_opt4: "Fotos und Videos der Region",
    content_opt5: "Broschüren und gedrucktes Material",
    content_opt6: "Wenig oder nichts Geordnetes",

    updates_title: "Wer die Informationen aktuell hält",
    updates_q: "Eine geänderte Öffnungszeit, ein neues Hotel, das Fest im September: Sie schreiben es ins Panel und der Assistent weiß es sofort. Wer würde das bei Ihnen übernehmen?",
    updates_opt1: "Es gibt eine zuständige Person",
    updates_opt2: "Wir wechseln uns zu mehreren ab",
    updates_opt3: "Niemand konkret — das ist unser Problem",

    humanSupport_title: "Wenn ein Mensch gebraucht wird",
    humanSupport_q: "Bei Fragen, die der Assistent nicht beantworten kann, kann das Gespräch an Sie übergeben werden: Sie erhalten eine WhatsApp-Benachrichtigung mit dem gesamten Verlauf und antworten selbst. Wäre das für Sie wichtig?",
    humanSupport_opt1: "Ja, wir wollen eingreifen können",
    humanSupport_opt2: "Nein, der Assistent allein genügt uns",

    push_title: "Push-Nachrichten an Gäste",
    push_q: "Das Fest am Samstag, die gesperrte Straße, das Konzert auf dem Platz: eine Nachricht nur an Gäste mit Einwilligung, jederzeit widerrufbar. Interessiert Sie das?",
    push_opt1: "Ja, sehr",
    push_opt2: "Vielleicht später",
    push_opt3: "Nein, brauchen wir nicht",

    revenue_title: "Betriebe präsentieren sich auf Ihrem Kanal",
    revenue_q: "Ein Hotel, ein Restaurant oder ein Materialverleih können sich auf Ihrem Kanal präsentieren, mit einer Nachricht an Gäste mit Einwilligung. Sie legen den Preis fest, das System zählt mit, wie viele Nachrichten gesendet wurden. Vielen Büros deckt das bereits die Kosten des Dienstes.",
    revenue_opt1: "Ja, das interessiert uns als Einnahme",
    revenue_opt2: "Interessant, müssten wir prüfen",
    revenue_opt3: "Nein, nichts für uns",

    privacy_title: "Datenschutz und Gästedaten",
    privacy_q: "Die Daten Ihrer Gäste bleiben Ihre. Keine sensiblen Daten gehen an Dritte oder an KI-Modelle, Benachrichtigungen gehen nur an Personen mit Einwilligung, und diese Einwilligung lässt sich jederzeit mit einem Wort widerrufen.",
    privacy_opt1: "Ja, das überzeugt uns",
    privacy_opt2: "Wir haben noch Zweifel",

    other_title: "Fast geschafft!",
    other_q: "Gibt es noch etwas, das Sie uns sagen möchten? Eine Besonderheit Ihrer Region, eine Frage, die Sie bekommen und die wir nicht aufgeführt haben, ein besonderer Bedarf. Jedes Detail hilft uns, etwas wirklich Nützliches zu bauen.",
    other_placeholder: "Schreiben Sie hier Ihre Ideen oder Fragen… (optional)",

    demo_title: "Testen Sie die Demo",
    demo_q: "Sollen wir Ihnen eine Demo zum Ausprobieren schicken? Wir senden Ihnen die Zugangsdaten per E-Mail, damit Sie den Assistenten auf Ihre Region angewendet sehen.",
    demo_opt1: "Ja, schicken Sie sie uns",
    demo_opt2: "Nein, vorerst nicht",

    interest_title: "Wie interessiert sind Sie?",
    interest_q: "Ehrlich gefragt: Wie interessiert sind Sie an so einem Assistenten für Ihr Büro? Von 0 (gar nicht) bis 5 (sehr interessiert).\n\nBei 0 fragen wir Sie nach keinerlei Daten. Bei Interesse zeigen wir Ihnen ein kurzes Kontaktformular.",

    form_title: "Wie erreichen wir Sie?",
    form_desc: "Hinterlassen Sie Ihre Daten und wir melden uns innerhalb von 24 Stunden, um Ihnen den Assistenten im Einsatz zu zeigen.",
    form_fullName: "Vor- und Nachname *",
    form_email: "E-Mail *",
    form_phone: "Telefon",
    form_company: "Einrichtung",
    form_submit: "Senden →",
    form_submitting: "Wird gesendet…",
    form_error: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",

    success_title: "Danke!",
    success_desc: "Wir haben Ihre Antworten erhalten. Wir melden uns in Kürze, um Ihnen den Assistenten auf Ihre Region angewendet zu zeigen.",
    success_cta: "Zurück zur Startseite",

    noContact_title: "Vielen Dank!",
    noContact_desc: "Wir schätzen die Zeit, die Sie sich genommen haben. Ihre Antworten helfen uns, einen besseren Assistenten für Tourismusbüros zu bauen. Falls Sie es sich anders überlegen, finden Sie den Kontaktlink auf der Startseite.",
    noContact_cta: "Zurück zur Startseite",

    try_chatbot: "Fragen oder Zweifel? Testen Sie unseren Assistenten auf WhatsApp!",
    try_chatbot_button: "Schreiben Sie uns",
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
    // ── 1. Chi siete ────────────────────────────────────────────────────
    {
      id: "stepOrg",
      icon: "🏛️",
      titleKey: "org_title",
      questionKey: "org_q",
      type: "select",
      image: "/survey.png",
      options: [
        { value: "pro_loco", label: T.org_opt1, emoji: "🏛️" },
        { value: "consorzio", label: T.org_opt2, emoji: "🤝" },
        { value: "iat", label: T.org_opt3, emoji: "ℹ️" },
        { value: "comune", label: T.org_opt4, emoji: "🏢" },
        { value: "other", label: T.org_opt5, emoji: "🔧" },
      ],
    },
    // ── 2. Stagionalità ─────────────────────────────────────────────────
    {
      id: "stepSeason",
      icon: "📅",
      titleKey: "season_title",
      questionKey: "season_q",
      type: "multi",
      image: "/booking.png",
      options: [
        { value: "summer", label: T.season_opt1, emoji: "☀️" },
        { value: "winter", label: T.season_opt2, emoji: "❄️" },
        { value: "shoulder", label: T.season_opt3, emoji: "🍂" },
        { value: "year_round", label: T.season_opt4, emoji: "🔁" },
      ],
    },
    // ── 3. Le domande di ogni giorno ────────────────────────────────────
    // Multi-select: these map directly onto the content types the assistant
    // is loaded with, so the answers tell us what to seed first.
    {
      id: "stepQuestions",
      icon: "❓",
      titleKey: "questions_title",
      questionKey: "questions_q",
      type: "multi",
      image: "/survey-support.png",
      options: [
        { value: "eating", label: T.questions_opt1, emoji: "🍽️" },
        { value: "hikes", label: T.questions_opt2, emoji: "🥾" },
        { value: "events", label: T.questions_opt3, emoji: "🎪" },
        { value: "opening_hours", label: T.questions_opt4, emoji: "🕐" },
        { value: "sleeping", label: T.questions_opt5, emoji: "🛏️" },
        { value: "local_produce", label: T.questions_opt6, emoji: "🧀" },
        { value: "getting_around", label: T.questions_opt7, emoji: "🚌" },
        { value: "weather_trails", label: T.questions_opt8, emoji: "🌦️" },
      ],
    },
    // ── 4. Lingue ───────────────────────────────────────────────────────
    {
      id: "stepLanguages",
      icon: "🌍",
      titleKey: "languages_title",
      questionKey: "languages_q",
      type: "multi",
      image: "/survey.png",
      options: [
        { value: "it", label: T.languages_opt1, emoji: "🇮🇹" },
        { value: "en", label: T.languages_opt2, emoji: "🇬🇧" },
        { value: "de", label: T.languages_opt3, emoji: "🇩🇪" },
        { value: "fr", label: T.languages_opt4, emoji: "🇫🇷" },
        { value: "es", label: T.languages_opt5, emoji: "🇪🇸" },
        { value: "other", label: T.languages_opt6, emoji: "🗣️" },
      ],
    },
    // ── 5. Fuori orario ─────────────────────────────────────────────────
    {
      id: "stepAfterHours",
      icon: "🌙",
      titleKey: "afterHours_title",
      questionKey: "afterHours_q",
      type: "radio",
      image: "/survey-support.png",
      options: [
        { value: "yes_losing", label: T.afterHours_opt1, emoji: "✅" },
        { value: "sometimes", label: T.afterHours_opt2, emoji: "🕐" },
        { value: "covered", label: T.afterHours_opt3, emoji: "❌" },
      ],
    },
    // ── 6. I contenuti che avete ────────────────────────────────────────
    {
      id: "stepContent",
      icon: "📚",
      titleKey: "content_title",
      questionKey: "content_q",
      type: "multi",
      image: "/survery-altro.png",
      options: [
        { value: "accommodation", label: T.content_opt1, emoji: "🏨" },
        { value: "trails", label: T.content_opt2, emoji: "🥾" },
        { value: "events_calendar", label: T.content_opt3, emoji: "📅" },
        { value: "media", label: T.content_opt4, emoji: "📷" },
        { value: "print", label: T.content_opt5, emoji: "📄" },
        { value: "nothing", label: T.content_opt6, emoji: "🤷" },
      ],
    },
    // ── 7. Chi aggiorna ─────────────────────────────────────────────────
    {
      id: "stepUpdates",
      icon: "✍️",
      titleKey: "updates_title",
      questionKey: "updates_q",
      type: "radio",
      image: "/survery-crm.png",
      options: [
        { value: "dedicated", label: T.updates_opt1, emoji: "👤" },
        { value: "shared", label: T.updates_opt2, emoji: "👥" },
        { value: "nobody", label: T.updates_opt3, emoji: "🤷" },
      ],
    },
    // ── 8. Supporto umano ───────────────────────────────────────────────
    {
      id: "stepHumanSupport",
      icon: "🤝",
      titleKey: "humanSupport_title",
      questionKey: "humanSupport_q",
      type: "radio",
      image: "/survey-agent.png",
      options: [
        { value: "yes_handoff", label: T.humanSupport_opt1, emoji: "✅" },
        { value: "full_auto", label: T.humanSupport_opt2, emoji: "❌" },
      ],
    },
    // ── 9. Notifiche push ───────────────────────────────────────────────
    {
      id: "stepPush",
      icon: "📣",
      titleKey: "push_title",
      questionKey: "push_q",
      type: "radio",
      image: "/survey-push.png",
      options: [
        { value: "yes", label: T.push_opt1, emoji: "✅" },
        { value: "maybe", label: T.push_opt2, emoji: "🕐" },
        { value: "no", label: T.push_opt3, emoji: "❌" },
      ],
    },
    // ── 10. Sponsorizzazioni degli esercenti ────────────────────────────
    // Only shown to offices open to push: without consented push there is
    // no channel for a sponsored message to travel on.
    {
      id: "stepRevenue",
      icon: "💶",
      titleKey: "revenue_title",
      questionKey: "revenue_q",
      type: "radio",
      image: "/survey-ecommerce.png",
      showWhen: (answers) => {
        const v = answers.stepPush
        return v === "yes" || v === "maybe"
      },
      options: [
        { value: "yes", label: T.revenue_opt1, emoji: "✅" },
        { value: "maybe", label: T.revenue_opt2, emoji: "🕐" },
        { value: "no", label: T.revenue_opt3, emoji: "❌" },
      ],
    },
    // ── 11. Privacy ─────────────────────────────────────────────────────
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
    // ── 12. Altro ───────────────────────────────────────────────────────
    {
      id: "stepOther",
      icon: "💭",
      titleKey: "other_title",
      questionKey: "other_q",
      type: "textarea",
      image: "/survery-altro.png",
    },
    // ── 13. Demo ────────────────────────────────────────────────────────
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

      <SiteFooter language={lang as any} />
    </div>
  )
}
