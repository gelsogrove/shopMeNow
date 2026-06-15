// i18n strings for the Real Estate Agencies landing page.
// Base language is Italian; the others mirror it 1:1.
// Positioning: ONE AI for any real estate agency.
// DemoRealEstate is only the running EXAMPLE — the product fits residential,
// commercial, vacation rentals, new builds, luxury, property management, etc.

export type RealEstateLang = "it" | "en" | "es" | "de"

export interface IndustryItem {
  icon: string
  label: string
}

export interface ProblemItem {
  num: string
  problem: string
  solutionTitle: string
  solutionDesc: string
  icon: string
}

export interface DataCard {
  icon: string
  title: string
  desc: string
}

export interface RealEstateCopy {
  // SEO
  seoTitle: string
  seoDesc: string
  seoKeys: string
  breadcrumb: string
  // Hero
  badge: string
  heroTitleTop: string
  heroTitleAccent: string
  heroSub: string
  cta: string
  ctaSub: string
  tryDemo: string
  // Property types (industries grid)
  industriesTitle: string
  industriesSub: string
  industries: IndustryItem[]
  industriesNote: string
  // Problems → solutions
  problemsTitle: string
  problemsSub: string
  problems: ProblemItem[]
  problemsBanner: string
  // Language barriers
  langBadge: string
  langTitle: string
  langTitleAccent: string
  langDesc: string
  langEvery: string // "every language in the world" — no fixed flag list
  // Listing references for the per-property data loader (kept country-neutral)
  listings: string[]
  // Acts & sells
  actsTitle: string
  actsTitleAccent: string
  actsDesc: string
  // Campaigns
  campaignsTitle: string
  campaignsTitleAccent: string
  campaignsDesc: string
  // Data control
  dataTitle: string
  dataTitleAccent: string
  dataCards: DataCard[]
  dataBanner: string
  // Property data loader (animated per-listing demo)
  loaderTitle: string
  loaderAccent: string
  loaderSub: string
  loaderLoading: string
  priceLabel: string
  surfaceLabel: string
  roomsLabel: string
  // Localized demo mock copy (so visuals always match the UI language)
  mockOperator: string
  mockReply: string // agent reply, in the local language
  mockQ1Local: string // local translation of the 1st Arabic message
  mockQ2Local: string // local translation of the 2nd Arabic message
  mockLiveLang: string // short code shown in the "AR ⇄ XX · live" pill
  actsBot: string
  actsCustomer1: string
  actsAi1: string
  actsAi2: string
  actsCustomer2: string
  actsPromoTitle: string
  actsPromoText: string
  actsPromoCard: string
  pushDate: string
  pushText: string
  // CTA
  ctaTitle: string
  ctaDesc: string
}

export const REAL_ESTATE_I18N: Record<RealEstateLang, RealEstateCopy> = {
  it: {
    seoTitle: "Chatbot WhatsApp per Agenzie Immobiliari - eChatbot",
    seoDesc:
      "Un'unica AI su WhatsApp per la tua agenzia immobiliare. Risponde 24/7, qualifica i lead, traduce in tempo reale, prenota le visite e passa all'agente. Per immobili residenziali, commerciali, case vacanza e nuove costruzioni.",
    seoKeys:
      "chatbot immobiliare, whatsapp agenzia immobiliare, assistente ia immobiliare, lead immobiliari whatsapp, prenotazione visite immobiliari, crm immobiliare whatsapp",
    breadcrumb: "Agenzie Immobiliari",
    badge: "Per Agenzie Immobiliari",
    heroTitleTop: "Una sola AI per la tua agenzia immobiliare.",
    heroTitleAccent: "Ogni immobile, la risposta giusta.",
    heroSub:
      "Un'unica AI su WhatsApp per la tua agenzia: risponde 24/7, qualifica i potenziali clienti, traduce in tempo reale, prenota le visite e passa all'agente quando serve. Tu governi tutto da un solo pannello.",
    cta: "Parliamone",
    ctaSub: "Demo su misura, nessun impegno",
    tryDemo: "Prova la nostra demo →",
    industriesTitle: "Una soluzione, ogni tipo di immobile",
    industriesSub:
      "L'esempio che vedi è DemoRealEstate, un'agenzia immobiliare. Ma la stessa AI lavora con qualsiasi tipologia di immobile.",
    industries: [
      { icon: "🏠", label: "Residenziale" },
      { icon: "🏢", label: "Commerciale" },
      { icon: "🏖️", label: "Case vacanza" },
      { icon: "🏗️", label: "Nuove costruzioni" },
      { icon: "💎", label: "Lusso" },
      { icon: "🔑", label: "Affitti & gestione" },
      { icon: "🏬", label: "Uffici" },
      { icon: "🌳", label: "Terreni" },
    ],
    industriesNote: "…e ogni altra tipologia di immobile.",
    problemsTitle: "Abbiamo individuato alcuni dettagli",
    problemsSub: "che potrebbero dare una svolta alla tua agenzia.",
    problems: [
      {
        num: "1",
        icon: "whatsapp",
        problem: "Richieste sugli immobili che arrivano a ogni ora, anche di sera e nei weekend, e restano senza risposta?",
        solutionTitle: "Supporto 24/7",
        solutionDesc:
          "L'assistente risponde da solo alla maggior parte delle richieste su WhatsApp e qualifica il contatto. L'agente interviene solo quando serve, con un riassunto già pronto: immobile, budget ed esigenze.",
      },
      {
        num: "2",
        icon: "translate",
        problem: "Acquirenti e investitori stranieri che non parlano la tua lingua?",
        solutionTitle: "Traduzione in tempo reale",
        solutionDesc:
          "Il cliente scrive nella sua lingua, tu rispondi nella tua. La conversazione si traduce in entrambe le direzioni, all'istante. Zero barriere con i clienti internazionali.",
      },
      {
        num: "3",
        icon: "megaphone",
        problem: "Nessun modo semplice per avvisare i clienti interessati di un nuovo immobile o di un ribasso di prezzo?",
        solutionTitle: "Campagne e avvisi su WhatsApp",
        solutionDesc:
          "Invii i nuovi immobili in linea con le ricerche dei clienti direttamente sul loro telefono. Il canale di supporto diventa un canale che genera visite e vendite.",
      },
      {
        num: "4",
        icon: "pin",
        problem: "Ogni immobile ha prezzo, metratura, caratteristiche e disponibilità diversi ed è difficile dare risposte sempre corrette?",
        solutionTitle: "Risposte precise per ogni immobile",
        solutionDesc:
          "L'AI riconosce di quale immobile parla il cliente e risponde con i dati corretti: prezzo, superficie, locali e disponibilità di quella proprietà.",
      },
      {
        num: "5",
        icon: "bot",
        problem: "Troppe cose da gestire insieme: rispondere, qualificare, prenotare visite, seguire i clienti?",
        solutionTitle: "Un'AI che orchestra tutto",
        solutionDesc:
          "Non è solo un chatbot: è un'AI su misura che risponde, prenota le visite, invia schede, foto e video, traduce, passa all'agente e, soprattutto, si connette al tuo CRM.",
      },
    ],
    problemsBanner: "Una sola soluzione: meno lavoro, lead seguiti, più visite e vendite.",
    langBadge: "Traduzione in tempo reale",
    langTitle: "Senza barriere",
    langTitleAccent: "linguistiche.",
    langDesc:
      "I tuoi clienti scrivono nella loro lingua, i tuoi agenti rispondono nella propria. Ogni messaggio si traduce in entrambe le direzioni, in tempo reale — la stessa AI multilingue, dall'investitore straniero al cliente locale.",
    listings: ["Rif. A-102", "Rif. B-204", "Rif. C-087", "Rif. D-311"],
    actsTitle: "Non risponde soltanto:",
    actsTitleAccent: "agisce e vende.",
    actsDesc:
      "Il cliente chiede di vedere un immobile. L'AI controlla il calendario dell'agente, prenota la visita e conferma. E nella stessa conversazione propone la consulenza mutuo.",
    campaignsTitle: "Trasforma gli avvisi",
    campaignsTitleAccent: "in visite.",
    campaignsDesc:
      "Con un clic invii una campagna ai clienti su WhatsApp: un nuovo immobile in linea con la loro ricerca, un ribasso di prezzo o un open house. Il canale di supporto diventa il tuo miglior strumento di marketing.",
    dataTitle: "I tuoi dati,",
    dataTitleAccent: "sotto il tuo controllo.",
    dataCards: [
      {
        icon: "shield",
        title: "Sicurezza dei dati",
        desc:
          "L'AI dialoga in modo naturale, ma non è sempre attiva. Quando si devono raccogliere dati personali, il sistema passa automaticamente da modalità AI a un flusso controllato da regole predefinite. I dati sensibili non vengono mai inviati a servizi AI esterni.",
      },
      {
        icon: "server",
        title: "On-premise: tutto in casa tua",
        desc:
          "Il sistema si installa sui tuoi server. Tutto il software gira dentro l'azienda, che mantiene il controllo totale di conversazioni e informazioni, senza che i dati passino da terzi.",
      },
      {
        icon: "expand",
        title: "Ampliabile alle tue esigenze",
        desc:
          "Le funzionalità crescono con te: nuove integrazioni, connessione ai tuoi sistemi e funzioni autonome, in base a ciò che l'agenzia richiede in ogni momento.",
      },
      {
        icon: "together",
        title: "Un progetto costruito insieme",
        desc:
          "Non ti adatti a un prodotto rigido: costruiamo il sistema attorno alla tua realtà. Addestriamo l'AI sui tuoi casi reali e la affiniamo nel tempo, sull'esperienza con i clienti.",
      },
    ],
    dataBanner: "Su misura. Sicuro, tuo, pensato per la tua agenzia.",
    langEvery: "Parla ogni lingua del mondo, in automatico.",
    loaderTitle: "Carica i dati giusti,",
    loaderAccent: "per ogni immobile.",
    loaderSub:
      "L'AI riconosce di quale immobile parla il cliente e carica al volo i suoi dati: prezzo, superficie e numero di locali. Niente più risposte sbagliate.",
    loaderLoading: "Carico i dati dell'immobile…",
    priceLabel: "Prezzo",
    surfaceLabel: "Superficie",
    roomsLabel: "Locali",
    mockOperator: "AGENTE",
    mockReply: "Ciao! Sì, il trilocale in centro è disponibile. Vuoi prenotare una visita?",
    mockQ1Local: "Il trilocale in centro è ancora disponibile?",
    mockQ2Local: "Grazie! Posso visitarlo?",
    mockLiveLang: "IT",
    actsBot: "DemoRealEstate Bot",
    actsCustomer1: "Vorrei visitare l'appartamento in Via Roma. È ancora disponibile?",
    actsAi1: "Sì, è disponibile! Sto controllando il calendario dell'agente. Un momento, per favore.",
    actsAi2:
      "Fatto! Visita prenotata per sabato alle 11:00 con Marco. Riceverai un promemoria.",
    actsCustomer2: "Perfetto, grazie! 🙌",
    actsPromoTitle: "🎉 ANCHE PER TE!",
    actsPromoText:
      "Scopri la nostra consulenza mutuo gratuita e trova il finanziamento giusto per il tuo acquisto.",
    actsPromoCard: "DemoRealEstate · Consulenza mutuo",
    pushDate: "Martedì, 14 maggio",
    pushText:
      "Nuovo sul mercato! 🏡 Trilocale con terrazzo nella tua zona di ricerca, €245.000. Vuoi prenotare una visita? Rispondi qui! ⭐",
    ctaTitle: "Ne parliamo?",
    ctaDesc:
      "Ti mostriamo come gestire tutta l'agenzia con un'unica AI. Demo su misura per la tua attività, nessun impegno.",
  },

  en: {
    seoTitle: "WhatsApp Chatbot for Real Estate Agencies - eChatbot",
    seoDesc:
      "One AI on WhatsApp for your real estate agency. Answers 24/7, qualifies leads, translates in real time, books viewings and hands off to an agent. For residential, commercial, vacation rentals and new builds.",
    seoKeys:
      "real estate chatbot, whatsapp real estate agency, real estate ai assistant, real estate leads whatsapp, property viewing booking, real estate crm whatsapp",
    breadcrumb: "Real Estate Agencies",
    badge: "For Real Estate Agencies",
    heroTitleTop: "One AI for your real estate agency.",
    heroTitleAccent: "Every property, the right answer.",
    heroSub:
      "One AI on WhatsApp for your agency: answers 24/7, qualifies prospects, translates in real time, books viewings and hands off to an agent when needed. You run everything from a single panel.",
    cta: "Let's Talk",
    ctaSub: "Tailored demo, no commitment",
    tryDemo: "Try our demo →",
    industriesTitle: "One solution, every type of property",
    industriesSub:
      "The example you see is DemoRealEstate, a real estate agency. But the same AI works for any type of property.",
    industries: [
      { icon: "🏠", label: "Residential" },
      { icon: "🏢", label: "Commercial" },
      { icon: "🏖️", label: "Vacation rentals" },
      { icon: "🏗️", label: "New builds" },
      { icon: "💎", label: "Luxury" },
      { icon: "🔑", label: "Rentals & management" },
      { icon: "🏬", label: "Offices" },
      { icon: "🌳", label: "Land" },
    ],
    industriesNote: "…and any other type of property.",
    problemsTitle: "We spotted a few details",
    problemsSub: "that could turn your agency around.",
    problems: [
      {
        num: "1",
        icon: "whatsapp",
        problem: "Property inquiries arriving at any hour — evenings, weekends — and going unanswered?",
        solutionTitle: "24/7 support",
        solutionDesc:
          "The assistant handles most inquiries on its own over WhatsApp and qualifies the contact. The agent steps in only when needed, with a ready-made summary: property, budget and needs.",
      },
      {
        num: "2",
        icon: "translate",
        problem: "Foreign buyers and investors who don't speak your language?",
        solutionTitle: "Real-time translation",
        solutionDesc:
          "The customer writes in their language, you reply in yours. The conversation is translated both ways, instantly. Zero barriers with international clients.",
      },
      {
        num: "3",
        icon: "megaphone",
        problem: "No easy way to alert interested clients about a new listing or a price drop?",
        solutionTitle: "WhatsApp campaigns & alerts",
        solutionDesc:
          "Send new listings that match each client's search straight to their phone. The same support channel becomes a channel that generates viewings and sales.",
      },
      {
        num: "4",
        icon: "pin",
        problem: "Every property has its own price, size, features and availability, and accurate answers get hard?",
        solutionTitle: "Accurate answers per property",
        solutionDesc:
          "The AI detects which property the customer is asking about and replies with the correct data: price, surface, rooms and availability of that listing.",
      },
      {
        num: "5",
        icon: "bot",
        problem: "Too much to handle at once: replying, qualifying, booking viewings, following up?",
        solutionTitle: "One AI that orchestrates it all",
        solutionDesc:
          "It's not just a chatbot: it's a tailored AI that answers, books viewings, sends listing sheets, photos and videos, translates, escalates to an agent and — above all — connects to your CRM.",
      },
    ],
    problemsBanner: "One single solution: less work, leads cared for, more viewings and sales.",
    langBadge: "Real-time translation",
    langTitle: "No language",
    langTitleAccent: "barriers.",
    langDesc:
      "Your customers write in their language, your agents reply in theirs. Every message is translated both ways, in real time — the same multilingual AI, from foreign investors to local clients.",
    listings: ["Ref. A-102", "Ref. B-204", "Ref. C-087", "Ref. D-311"],
    actsTitle: "It doesn't just reply:",
    actsTitleAccent: "it acts and sells.",
    actsDesc:
      "The customer asks to see a property. The AI checks the agent's calendar, books the viewing and confirms. And in the same conversation it offers a mortgage consultation.",
    campaignsTitle: "Turn alerts",
    campaignsTitleAccent: "into viewings.",
    campaignsDesc:
      "With one click you send a campaign to your clients on WhatsApp: a new listing matching their search, a price drop or an open house. The support channel becomes your best marketing tool.",
    dataTitle: "Your data,",
    dataTitleAccent: "under your control.",
    dataCards: [
      {
        icon: "shield",
        title: "Data security",
        desc:
          "The AI talks naturally, but it's not always active. As soon as personal data has to be collected, the system automatically switches from AI mode to a flow controlled by predefined rules. Sensitive data is never sent to external AI services.",
      },
      {
        icon: "server",
        title: "On-premise: all in your house",
        desc:
          "The system installs on your servers. All software runs inside the company, which keeps full control of conversations and information, without data passing through third parties.",
      },
      {
        icon: "expand",
        title: "Scales to your needs",
        desc:
          "Features grow with you: new integrations, connection to your systems and autonomous functions, based on what the agency needs at any moment.",
      },
      {
        icon: "together",
        title: "A project we build together",
        desc:
          "You don't adapt to a rigid product: we build the system around your reality. We train the AI on your real cases and refine it over time, based on experience with your customers.",
      },
    ],
    dataBanner: "Made to measure. Secure, yours, built for your agency.",
    langEvery: "Speaks every language in the world, automatically.",
    loaderTitle: "It loads the right data,",
    loaderAccent: "for every property.",
    loaderSub:
      "The AI detects which property the customer is asking about and loads its data on the fly: price, surface and number of rooms. No more wrong answers.",
    loaderLoading: "Loading property data…",
    priceLabel: "Price",
    surfaceLabel: "Surface",
    roomsLabel: "Rooms",
    mockOperator: "AGENT",
    mockReply: "Hi! Yes, the downtown 3-room apartment is available. Want to book a viewing?",
    mockQ1Local: "Is the downtown 3-room apartment still available?",
    mockQ2Local: "Thanks! Can I visit it?",
    mockLiveLang: "EN",
    actsBot: "DemoRealEstate Bot",
    actsCustomer1: "I'd like to visit the apartment on Via Roma. Is it still available?",
    actsAi1: "Yes, it's available! I'm checking the agent's calendar. One moment, please.",
    actsAi2:
      "Done! Viewing booked for Saturday at 11:00 with Marco. You'll get a reminder.",
    actsCustomer2: "Perfect, thanks! 🙌",
    actsPromoTitle: "🎉 ALSO FOR YOU!",
    actsPromoText:
      "Discover our free mortgage consultation and find the right financing for your purchase.",
    actsPromoCard: "DemoRealEstate · Mortgage advisor",
    pushDate: "Tuesday, May 14",
    pushText:
      "New on the market! 🏡 3-room apartment with terrace in your search zone, €245,000. Want to book a viewing? Reply here! ⭐",
    ctaTitle: "Shall we talk?",
    ctaDesc:
      "We'll show you how to run the whole agency with a single AI. Demo tailored to your business, no commitment.",
  },

  es: {
    seoTitle: "Chatbot WhatsApp para Agencias Inmobiliarias - eChatbot",
    seoDesc:
      "Una sola IA en WhatsApp para tu agencia inmobiliaria. Responde 24/7, cualifica los leads, traduce en tiempo real, agenda las visitas y pasa al agente. Para inmuebles residenciales, comerciales, casas vacacionales y obra nueva.",
    seoKeys:
      "chatbot inmobiliario, whatsapp agencia inmobiliaria, asistente ia inmobiliaria, leads inmobiliarios whatsapp, agendar visitas inmobiliarias, crm inmobiliario whatsapp",
    breadcrumb: "Agencias Inmobiliarias",
    badge: "Para Agencias Inmobiliarias",
    heroTitleTop: "Una sola IA para tu agencia inmobiliaria.",
    heroTitleAccent: "Cada inmueble, la respuesta correcta.",
    heroSub:
      "Una sola IA en WhatsApp para tu agencia: responde 24/7, cualifica a los interesados, traduce en tiempo real, agenda las visitas y pasa al agente cuando hace falta. Tú lo gobiernas todo desde un único panel.",
    cta: "Hablemos",
    ctaSub: "Demo a medida, sin compromiso",
    tryDemo: "Prueba nuestra demo →",
    industriesTitle: "Una solución, cada tipo de inmueble",
    industriesSub:
      "El ejemplo que ves es DemoRealEstate, una agencia inmobiliaria. Pero la misma IA funciona con cualquier tipo de inmueble.",
    industries: [
      { icon: "🏠", label: "Residencial" },
      { icon: "🏢", label: "Comercial" },
      { icon: "🏖️", label: "Casas vacacionales" },
      { icon: "🏗️", label: "Obra nueva" },
      { icon: "💎", label: "Lujo" },
      { icon: "🔑", label: "Alquiler & gestión" },
      { icon: "🏬", label: "Oficinas" },
      { icon: "🌳", label: "Terrenos" },
    ],
    industriesNote: "…y cualquier otro tipo de inmueble.",
    problemsTitle: "Hemos identificado algunos detalles",
    problemsSub: "que podrían dar una vuelta a tu agencia.",
    problems: [
      {
        num: "1",
        icon: "whatsapp",
        problem: "¿Consultas sobre inmuebles que llegan a cualquier hora, también de noche y los fines de semana, y se quedan sin respuesta?",
        solutionTitle: "Soporte 24/7",
        solutionDesc:
          "El asistente responde solo a la mayoría de las consultas en WhatsApp y cualifica el contacto. El agente interviene únicamente cuando hace falta, con un resumen ya preparado: inmueble, presupuesto y necesidades.",
      },
      {
        num: "2",
        icon: "translate",
        problem: "¿Compradores e inversores extranjeros que no hablan tu idioma?",
        solutionTitle: "Traducción en tiempo real",
        solutionDesc:
          "El cliente escribe en su idioma, tú respondes en el tuyo. La conversación se traduce en ambas direcciones, al instante. Cero barreras con los clientes internacionales.",
      },
      {
        num: "3",
        icon: "megaphone",
        problem: "¿Sin forma sencilla de avisar a los clientes interesados de un nuevo inmueble o de una bajada de precio?",
        solutionTitle: "Campañas y avisos por WhatsApp",
        solutionDesc:
          "Envía los nuevos inmuebles que encajan con la búsqueda de cada cliente directamente a su móvil. El mismo canal de soporte se convierte en un canal que genera visitas y ventas.",
      },
      {
        num: "4",
        icon: "pin",
        problem: "¿Cada inmueble tiene su propio precio, superficie, características y disponibilidad y dar respuestas correctas se complica?",
        solutionTitle: "Respuestas precisas por inmueble",
        solutionDesc:
          "La IA identifica de qué inmueble habla el cliente y responde con los datos correctos: precio, superficie, habitaciones y disponibilidad de ese inmueble.",
      },
      {
        num: "5",
        icon: "bot",
        problem: "¿Demasiadas cosas que gestionar a la vez: responder, cualificar, agendar visitas, hacer seguimiento?",
        solutionTitle: "Una IA que lo orquesta todo",
        solutionDesc:
          "No es solo un chatbot: es una IA hecha a medida que contesta, agenda las visitas, envía fichas, fotos y vídeos, traduce, escala a un agente y, sobre todo, se conecta a tu CRM.",
      },
    ],
    problemsBanner: "Una sola solución: menos trabajo, leads atendidos, más visitas y ventas.",
    langBadge: "Traducción en tiempo real",
    langTitle: "Sin barreras",
    langTitleAccent: "de idioma.",
    langDesc:
      "Tus clientes escriben en su idioma, tus agentes responden en el suyo. Cada mensaje se traduce en ambas direcciones, en tiempo real — la misma IA multilingüe, del inversor extranjero al cliente local.",
    listings: ["Ref. A-102", "Ref. B-204", "Ref. C-087", "Ref. D-311"],
    actsTitle: "No solo responde:",
    actsTitleAccent: "actúa y vende.",
    actsDesc:
      "El cliente pide ver un inmueble. La IA consulta el calendario del agente, agenda la visita y confirma. Y en la misma conversación ofrece la asesoría hipotecaria.",
    campaignsTitle: "Convierte los avisos",
    campaignsTitleAccent: "en visitas.",
    campaignsDesc:
      "Con un clic envías una campaña a tus clientes por WhatsApp: un nuevo inmueble que encaja con su búsqueda, una bajada de precio o un open house. El canal de soporte se convierte en tu mejor herramienta de marketing.",
    dataTitle: "Tus datos,",
    dataTitleAccent: "bajo tu control.",
    dataCards: [
      {
        icon: "shield",
        title: "Seguridad de los datos",
        desc:
          "La IA dialoga de forma natural, pero no está siempre activa. En cuanto hay que recoger datos personales, el sistema pasa automáticamente de modo IA a un flujo controlado por reglas predefinidas. Los datos sensibles nunca se envían a servicios de IA externos.",
      },
      {
        icon: "server",
        title: "On-premise: todo en tu casa",
        desc:
          "El sistema se instala en vuestros servidores. Todo el software corre dentro de la empresa, que mantiene el control total de las conversaciones y de la información, sin que los datos pasen por terceros.",
      },
      {
        icon: "expand",
        title: "Ampliable a tus necesidades",
        desc:
          "Las funcionalidades crecen contigo: nuevas integraciones, conexión con tus sistemas y funciones autónomas, según lo que la agencia necesite en cada momento.",
      },
      {
        icon: "together",
        title: "Un proyecto que construimos juntos",
        desc:
          "No te adaptas a un producto rígido: construimos el sistema en torno a vuestra realidad. Entrenamos la IA con vuestros casos reales y la afinamos con el tiempo, sobre la experiencia con los clientes.",
      },
    ],
    dataBanner: "Hecho a tu medida. Seguro, tuyo, y pensado para tu agencia.",
    langEvery: "Habla todos los idiomas del mundo, en automático.",
    loaderTitle: "Carga los datos correctos,",
    loaderAccent: "para cada inmueble.",
    loaderSub:
      "La IA identifica de qué inmueble habla el cliente y carga al vuelo sus datos: precio, superficie y número de habitaciones. Se acabaron las respuestas equivocadas.",
    loaderLoading: "Cargando los datos del inmueble…",
    priceLabel: "Precio",
    surfaceLabel: "Superficie",
    roomsLabel: "Habitaciones",
    mockOperator: "AGENTE",
    mockReply: "¡Hola! Sí, el piso de 3 habitaciones en el centro está disponible. ¿Quieres agendar una visita?",
    mockQ1Local: "¿El piso de 3 habitaciones en el centro sigue disponible?",
    mockQ2Local: "¡Gracias! ¿Puedo visitarlo?",
    mockLiveLang: "ES",
    actsBot: "DemoRealEstate Bot",
    actsCustomer1: "Me gustaría visitar el piso de Via Roma. ¿Sigue disponible?",
    actsAi1: "¡Sí, está disponible! Estoy consultando el calendario del agente. Un momento, por favor.",
    actsAi2:
      "¡Hecho! Visita agendada para el sábado a las 11:00 con Marco. Recibirás un recordatorio.",
    actsCustomer2: "¡Perfecto, gracias! 🙌",
    actsPromoTitle: "🎉 ¡TAMBIÉN PARA TI!",
    actsPromoText:
      "Descubre nuestra asesoría hipotecaria gratuita y encuentra la financiación adecuada para tu compra.",
    actsPromoCard: "DemoRealEstate · Asesor hipotecario",
    pushDate: "Martes, 14 de mayo",
    pushText:
      "¡Nuevo en el mercado! 🏡 Piso de 3 habitaciones con terraza en tu zona de búsqueda, 245.000 €. ¿Quieres agendar una visita? ¡Responde aquí! ⭐",
    ctaTitle: "¿Lo hablamos?",
    ctaDesc:
      "Te mostramos cómo gestionar toda la agencia con una sola IA. Demo a medida para tu negocio, sin compromiso.",
  },

  de: {
    seoTitle: "WhatsApp-Chatbot für Immobilienagenturen - eChatbot",
    seoDesc:
      "Eine einzige KI auf WhatsApp für deine Immobilienagentur. Antwortet 24/7, qualifiziert Leads, übersetzt in Echtzeit, bucht Besichtigungen und übergibt an einen Makler. Für Wohn-, Gewerbeimmobilien, Ferienwohnungen und Neubauten.",
    seoKeys:
      "immobilien chatbot, whatsapp immobilienagentur, ki assistent immobilien, immobilien leads whatsapp, besichtigung buchen immobilien, immobilien crm whatsapp",
    breadcrumb: "Immobilienagenturen",
    badge: "Für Immobilienagenturen",
    heroTitleTop: "Eine einzige KI für deine Immobilienagentur.",
    heroTitleAccent: "Jede Immobilie, die richtige Antwort.",
    heroSub:
      "Eine einzige KI auf WhatsApp für deine Agentur: antwortet 24/7, qualifiziert Interessenten, übersetzt in Echtzeit, bucht Besichtigungen und übergibt bei Bedarf an einen Makler. Du steuerst alles über ein einziges Panel.",
    cta: "Sprechen wir darüber",
    ctaSub: "Maßgeschneiderte Demo, unverbindlich",
    tryDemo: "Demo ausprobieren →",
    industriesTitle: "Eine Lösung, jede Art von Immobilie",
    industriesSub:
      "Das Beispiel, das du siehst, ist DemoRealEstate, eine Immobilienagentur. Aber dieselbe KI funktioniert für jede Art von Immobilie.",
    industries: [
      { icon: "🏠", label: "Wohnimmobilien" },
      { icon: "🏢", label: "Gewerbe" },
      { icon: "🏖️", label: "Ferienwohnungen" },
      { icon: "🏗️", label: "Neubauten" },
      { icon: "💎", label: "Luxus" },
      { icon: "🔑", label: "Vermietung & Verwaltung" },
      { icon: "🏬", label: "Büros" },
      { icon: "🌳", label: "Grundstücke" },
    ],
    industriesNote: "…und jede andere Art von Immobilie.",
    problemsTitle: "Wir haben ein paar Details entdeckt",
    problemsSub: "die deiner Agentur eine Wende geben könnten.",
    problems: [
      {
        num: "1",
        icon: "whatsapp",
        problem: "Immobilienanfragen, die zu jeder Stunde eintreffen — abends, am Wochenende — und unbeantwortet bleiben?",
        solutionTitle: "Support 24/7",
        solutionDesc:
          "Der Assistent beantwortet die meisten Anfragen auf WhatsApp von selbst und qualifiziert den Kontakt. Der Makler greift nur ein, wenn es nötig ist, mit einer fertigen Zusammenfassung: Immobilie, Budget und Bedürfnisse.",
      },
      {
        num: "2",
        icon: "translate",
        problem: "Ausländische Käufer und Investoren, die deine Sprache nicht sprechen?",
        solutionTitle: "Übersetzung in Echtzeit",
        solutionDesc:
          "Der Kunde schreibt in seiner Sprache, du antwortest in deiner. Das Gespräch wird in beide Richtungen übersetzt, sofort. Null Barrieren mit internationalen Kunden.",
      },
      {
        num: "3",
        icon: "megaphone",
        problem: "Keine einfache Möglichkeit, interessierte Kunden über eine neue Immobilie oder eine Preissenkung zu informieren?",
        solutionTitle: "Kampagnen & Hinweise per WhatsApp",
        solutionDesc:
          "Sende neue Immobilien, die zur Suche jedes Kunden passen, direkt auf sein Handy. Derselbe Support-Kanal wird zu einem Kanal, der Besichtigungen und Verkäufe generiert.",
      },
      {
        num: "4",
        icon: "pin",
        problem: "Jede Immobilie hat eigenen Preis, Größe, Ausstattung und Verfügbarkeit, und korrekte Antworten werden schwierig?",
        solutionTitle: "Präzise Antworten pro Immobilie",
        solutionDesc:
          "Die KI erkennt, nach welcher Immobilie der Kunde fragt, und antwortet mit den korrekten Daten: Preis, Fläche, Zimmer und Verfügbarkeit dieser Immobilie.",
      },
      {
        num: "5",
        icon: "bot",
        problem: "Zu viel auf einmal zu bewältigen: antworten, qualifizieren, Besichtigungen buchen, nachfassen?",
        solutionTitle: "Eine KI, die alles orchestriert",
        solutionDesc:
          "Es ist nicht nur ein Chatbot: Es ist eine maßgeschneiderte KI, die antwortet, Besichtigungen bucht, Exposés, Fotos und Videos verschickt, übersetzt, an einen Makler eskaliert und sich vor allem mit deinem CRM verbindet.",
      },
    ],
    problemsBanner: "Eine einzige Lösung: weniger Arbeit, betreute Leads, mehr Besichtigungen und Verkäufe.",
    langBadge: "Übersetzung in Echtzeit",
    langTitle: "Ohne Sprach-",
    langTitleAccent: "barrieren.",
    langDesc:
      "Deine Kunden schreiben in ihrer Sprache, deine Makler antworten in ihrer. Jede Nachricht wird in beide Richtungen übersetzt, in Echtzeit — dieselbe mehrsprachige KI, vom ausländischen Investor bis zum lokalen Kunden.",
    listings: ["Ref. A-102", "Ref. B-204", "Ref. C-087", "Ref. D-311"],
    actsTitle: "Sie antwortet nicht nur:",
    actsTitleAccent: "sie handelt und verkauft.",
    actsDesc:
      "Der Kunde möchte eine Immobilie besichtigen. Die KI prüft den Kalender des Maklers, bucht die Besichtigung und bestätigt. Und im selben Gespräch bietet sie eine Finanzierungsberatung an.",
    campaignsTitle: "Verwandle Hinweise",
    campaignsTitleAccent: "in Besichtigungen.",
    campaignsDesc:
      "Mit einem Klick sendest du eine Kampagne an deine Kunden auf WhatsApp: eine neue Immobilie passend zu ihrer Suche, eine Preissenkung oder ein Open House. Der Support-Kanal wird zu deinem besten Marketing-Werkzeug.",
    dataTitle: "Deine Daten,",
    dataTitleAccent: "unter deiner Kontrolle.",
    dataCards: [
      {
        icon: "shield",
        title: "Datensicherheit",
        desc:
          "Die KI kommuniziert auf natürliche Weise, ist aber nicht immer aktiv. Sobald personenbezogene Daten erfasst werden müssen, wechselt das System automatisch vom KI-Modus zu einem durch vordefinierte Regeln gesteuerten Ablauf. Sensible Daten werden niemals an externe KI-Dienste gesendet.",
      },
      {
        icon: "server",
        title: "On-Premise: alles bei dir im Haus",
        desc:
          "Das System wird auf deinen Servern installiert. Die gesamte Software läuft innerhalb des Unternehmens, das die volle Kontrolle über Gespräche und Informationen behält, ohne dass Daten durch Dritte laufen.",
      },
      {
        icon: "expand",
        title: "Erweiterbar nach deinen Bedürfnissen",
        desc:
          "Die Funktionen wachsen mit dir: neue Integrationen, Anbindung an deine Systeme und autonome Funktionen, je nachdem, was die Agentur in jedem Moment braucht.",
      },
      {
        icon: "together",
        title: "Ein Projekt, das wir gemeinsam aufbauen",
        desc:
          "Du passt dich nicht an ein starres Produkt an: Wir bauen das System rund um deine Realität. Wir trainieren die KI mit deinen echten Fällen und verfeinern sie im Laufe der Zeit, basierend auf der Erfahrung mit deinen Kunden.",
      },
    ],
    dataBanner: "Maßgeschneidert. Sicher, deins, gemacht für deine Agentur.",
    langEvery: "Spricht jede Sprache der Welt, automatisch.",
    loaderTitle: "Sie lädt die richtigen Daten,",
    loaderAccent: "für jede Immobilie.",
    loaderSub:
      "Die KI erkennt, nach welcher Immobilie der Kunde fragt, und lädt im Nu ihre Daten: Preis, Fläche und Anzahl der Zimmer. Schluss mit falschen Antworten.",
    loaderLoading: "Lade die Immobiliendaten…",
    priceLabel: "Preis",
    surfaceLabel: "Fläche",
    roomsLabel: "Zimmer",
    mockOperator: "MAKLER",
    mockReply: "Hallo! Ja, die 3-Zimmer-Wohnung im Zentrum ist verfügbar. Möchtest du eine Besichtigung buchen?",
    mockQ1Local: "Ist die 3-Zimmer-Wohnung im Zentrum noch verfügbar?",
    mockQ2Local: "Danke! Kann ich sie besichtigen?",
    mockLiveLang: "DE",
    actsBot: "DemoRealEstate Bot",
    actsCustomer1: "Ich würde gern die Wohnung in der Via Roma besichtigen. Ist sie noch verfügbar?",
    actsAi1: "Ja, sie ist verfügbar! Ich prüfe gerade den Kalender des Maklers. Einen Moment, bitte.",
    actsAi2:
      "Erledigt! Besichtigung für Samstag um 11:00 Uhr mit Marco gebucht. Du erhältst eine Erinnerung.",
    actsCustomer2: "Perfekt, danke! 🙌",
    actsPromoTitle: "🎉 AUCH FÜR DICH!",
    actsPromoText:
      "Entdecke unsere kostenlose Finanzierungsberatung und finde die passende Finanzierung für deinen Kauf.",
    actsPromoCard: "DemoRealEstate · Finanzierungsberater",
    pushDate: "Dienstag, 14. Mai",
    pushText:
      "Neu auf dem Markt! 🏡 3-Zimmer-Wohnung mit Terrasse in deiner Suchzone, 245.000 €. Möchtest du eine Besichtigung buchen? Antworte hier! ⭐",
    ctaTitle: "Sprechen wir darüber?",
    ctaDesc:
      "Wir zeigen dir, wie du die gesamte Agentur mit einer einzigen KI steuerst. Maßgeschneiderte Demo für dein Geschäft, unverbindlich.",
  },
}
