export type HomeLang = "it" | "en" | "es" | "de" | "fr" | "ca"

/**
 * Copy for the tourist-office landing page, in the six languages the app
 * supports (Andrea, 2026-09-14: "traduci sempre in lingua").
 *
 * 🚨 "PRO LOCO" IS AN ITALIAN WORD AND IS NOT TRANSLATED LITERALLY.
 * Every country has the same institution under its own name, and an office in
 * Girona or Innsbruck would not recognise itself in "Pro Loco":
 *
 *   it  Pro Loco e Consorzi turistici
 *   es  Oficinas de Turismo y Patronatos
 *   ca  Oficines de Turisme i Consorcis
 *   fr  Offices de Tourisme et Syndicats d'Initiative
 *   de  Tourismusverbände und Tourismusbüros
 *   en  Tourist Offices and Visitor Centres
 *
 * Italian is the default (`fallback`), because the product is sold here first.
 */
export interface HomeCopy {
  audience: string
  navPricing: string
  navDemo: string
  navContact: string
  eyebrow: string
  slogan1: string
  slogan2: string
  lede: string
  chipMulti: string
  chip24: string
  chipFaq: string
  chipPush: string
  chipMix: string
  loginTitle: string
  loginSub: string
  email: string
  password: string
  loginCta: string
  loginLoading: string
  forgot: string
  orDivider: string
  errBadCredentials: string
  errGeneric: string
  benefitsTitle: string
  benefitsSub: string
  benefits: Array<{ title: string; body: string }>
  contentTitle: string
  contentBody1: string
  contentBody2: string
  contentTypes: string[]
  pricingTitle: string
  pricingSub: string
  revenueEyebrow: string
  revenueTitle: string
  revenueBody1: string
  revenueBody2: string
  revenueSteps: Array<{ t: string; d: string }>
  retentionEyebrow: string
  retentionTitle: string
  retentionBody1: string
  retentionBody2: string
  retentionSteps: Array<{ t: string; d: string }>
  faqTitle: string
  faqItems: Array<{ q: string; a: string }>
  galleryTitle: string
  gallerySubtitle: string
  closingBody: string
  demoTitle: string
  demoSub: string
  demoOpen: string
  surveyEyebrow: string
  surveyTitle: string
  surveyBody: string
  surveyCta: string
  privacyBadge: string
  privacyTitle: string
  privacyBody: string
  privacyCta: string
  ctaBand: string
  ctaBandBtn: string
  footTagline: string
  footResources: string
  footLegal: string
  footPrivacy: string
  footTerms: string
  footer: string
}

const it: HomeCopy = {
  galleryTitle: "Il vostro territorio, com'è davvero",
  gallerySubtitle: "Ogni scheda può portarsi dietro le sue foto: il turista vede il posto prima di arrivarci.",
  audience: "per Pro Loco e Consorzi",
  navPricing: "Prezzi",
  navDemo: "Demo",
  navContact: "Contattaci",
  eyebrow: "Solo per uffici turistici",
  slogan1: "Il vostro territorio risponde",
  slogan2: "su WhatsApp",
  lede: "Un assistente che incrocia il meteo, le esigenze del turista e le informazioni del territorio per assisterlo durante tutta la vacanza, 24 ore su 24, nella sua lingua madre, direttamente su WhatsApp.",
  chipMulti: "Multilingua",
  chip24: "24 ore su 24",
  chipFaq: "Le solite domande",
  chipPush: "Notifiche push",
  chipMix: "Meteo, eventi e preferenze",
  loginTitle: "Accedi al tuo canale",
  loginSub: "Gestisci contenuti, notifiche e conversazioni.",
  email: "Email",
  password: "Password",
  loginCta: "Accedi",
  loginLoading: "Accesso in corso...",
  forgot: "Password dimenticata?",
  orDivider: "oppure",
  errBadCredentials: "Email o password non corretti.",
  errGeneric: "Accesso non riuscito. Riprova fra poco.",
  benefitsTitle: "Cosa cambia per i vostri turisti — e per chi risponde in ufficio",
  benefitsSub: "Sono molteplici i vantaggi: ve ne elenchiamo alcuni qui sotto.",
  benefits: [
    { title: "Ogni turista nella sua lingua", body: "Un tedesco scrive in tedesco, un francese in francese. Voi scrivete i contenuti una volta sola: alla traduzione pensa l'assistente." },
    { title: "Nessuno aspetta il suo turno", body: "Cento turisti possono chiedere nello stesso momento, ognuno riceve la sua risposta. Allo sportello, invece, si fa la fila." },
    { title: "Messaggio di benvenuto", body: "Chi scrive per la prima volta viene accolto, non interrogato. L'assistente si presenta e capisce di cosa ha bisogno." },
    { title: "Foto e video, non solo testo", body: "Una cascata si capisce meglio vedendola. Ogni luogo può portarsi dietro le sue immagini e i suoi video." },
    { title: "Risponde di domenica", body: "E il sabato, e a ferragosto, e alle undici di sera. Quando l'ufficio è chiuso le domande arrivano lo stesso — e trovano risposta." },
    { title: "Notifiche push", body: "La sagra di sabato, la strada chiusa, il concerto in piazza: solo ai turisti che hanno dato il consenso, revocabile sempre." },
  ],
  contentTitle: "Tutto il territorio in tasca",
  contentBody1: "Un albergo nuovo, un orario che cambia, la sagra di settembre: lo scrivete nel pannello e l'assistente lo sa subito. Senza chiamare nessuno.",
  contentBody2: "E risponde solo con quello che avete caricato voi. Se un dato non c'è, lo dice: non allucina.",
  contentTypes: ["Hotel e B&B", "Ristoranti e agriturismi", "Escursioni e rifugi", "Sagre ed eventi", "Prodotti tipici", "Borghi e punti panoramici", "Castelli e chiese", "Cenni storici", "Strutture sportive", "Numeri utili"],
  pricingTitle: "Prezzi chiari, nessuna sorpresa",
  pricingSub: "Il canone copre il servizio. I consumi si pagano a parte, solo quando li usate.",
  revenueEyebrow: "Modello economico",
  revenueTitle: "Gli esercenti possono sponsorizzarsi sul canale",
  revenueBody1: "Un albergo, un ristorante, un noleggio attrezzature — per esempio — possono sponsorizzarsi sul vostro canale, con un messaggio che arriva ai turisti che hanno dato il consenso. Voi decidete il prezzo, il sistema tiene il conto del numero di invii fatti.",
  revenueBody2: "Per molti uffici turistici basta a coprire il costo del servizio. Quello che arriva dopo è guadagno.",
  retentionEyebrow: "Il messaggio giusto, al momento giusto",
  retentionTitle: "Mentre sono qui, e quando saranno tornati a casa.",
  retentionBody1: "Il visitatore che vi ha scritto una volta è il contatto più prezioso che avete: sa dov'è, si è trovato bene, e vi ha lasciato il numero. Durante la vacanza gli arriva quello che gli serve adesso; dopo, quello che lo riporta qui.",
  retentionBody2: "Prima di Natale, di Pasqua o dell'estate riceve le vostre offerte per la prossima vacanza — ma solo se ha dato il consenso, e con un NO che basta scrivere per non riceverne più.",
  retentionSteps: [
    { t: "Durante il soggiorno", d: "Meteo che cambia, un evento di stasera, una sagra spostata per pioggia: arriva l'avviso a chi è in paese in quel momento. Nessuno in ufficio deve premere niente." },
    { t: "Prima delle feste", d: "Finita la vacanza, il contatto resta. Qualche settimana prima di Natale, Pasqua o dell'estate riceve offerte ed eventi della prossima stagione — il periodo in cui si decide davvero dove andare." },
    { t: "Sempre con il consenso", d: "Il consenso viene chiesto in chat, e basta scrivere NO per smettere di ricevere. Prima di ogni invio il sistema controlla anche di non ripetere una cosa già detta da un'altra iniziativa." },
  ],
  faqTitle: "Le domande che ci fanno sempre",
  faqItems: [
    { q: "Serve un numero WhatsApp nuovo?", a: "No, si può usare il numero che avete già, purché non sia collegato all'app WhatsApp su un telefono. Se preferite tenere separato il numero dell'ufficio, ne attiviamo uno dedicato: decidete voi." },
    { q: "Chi aggiorna le informazioni?", a: "Le aggiornate voi, da un pannello che si usa come un foglio di calcolo: si apre la scheda dell'evento, si cambia l'orario, si salva. Nessuno deve toccare codice e non serve chiamarci per una modifica." },
    { q: "E se l'assistente non sa rispondere?", a: "Lo dice, invece di inventare. Se la domanda esce dal catalogo — o se la persona chiede di parlare con qualcuno — la conversazione passa a un operatore vero, che la vede e risponde dal pannello." },
    { q: "Quanto ci vuole per partire?", a: "Dipende quasi solo da quanto materiale avete già pronto. Con un elenco di eventi e strutture da importare si parte in pochi giorni; se il catalogo va costruito da zero, serve qualche settimana di raccolta dati." },
    { q: "I dati dei turisti dove finiscono?", a: "Restano vostri. I contatti e le conversazioni sono nel vostro spazio, separati da quelli di ogni altro ente, e la gestione è conforme al GDPR. Non vengono usati per addestrare modelli né ceduti a terzi." },
    { q: "Funziona anche se non siamo in montagna?", a: "Sì. L'assistente non sa niente della montagna in particolare: sa quello che c'è nel vostro catalogo. Mare, città d'arte, lago o borgo cambiano le schede, non il funzionamento." },
  ],
  revenueSteps: [
    { t: "L'esercente compra un pacchetto", d: "Dieci, cinquanta, cento messaggi. Decidete voi il prezzo." },
    { t: "Prepara il suo messaggio", d: "Testo e foto della sua offerta, che approvate prima dell'invio." },
    { t: "Parte solo a chi ha acconsentito", d: "E ogni invio scala dal suo pacchetto, senza che dobbiate contare nulla." },
  ],
  closingBody: "Allo sportello e al telefono, spesso mentre c'è la fila. Da adesso l'assistente risponde per voi — con quello che avete caricato, nella lingua di chi chiede.",
  demoTitle: "Provate la demo — provare per credere! 🙂",
  demoSub: "Semplicemente scansionate il codice QR e scrivete nella chat quello che vi chiederebbe un turista di questa località.",
  demoOpen: "Aprilo su WhatsApp",
  surveyEyebrow: "Questionario",
  surveyTitle: "Aiutateci a costruire l'assistente giusto per voi",
  surveyBody: "Rispondete a qualche domanda sul vostro territorio e su cosa vi chiedono i turisti: vi mostriamo come l'assistente lavorerebbe per voi. Due minuti, senza impegno.",
  surveyCta: "Inizia il questionario →",
  privacyBadge: "Conforme al GDPR",
  privacyTitle: "Privacy by design",
  privacyBody: "I dati dei vostri turisti restano vostri. Nessun dato sensibile finisce a terzi o ai modelli AI, le notifiche partono solo a chi ha dato il consenso, e quel consenso si può revocare in qualsiasi momento con una parola.",
  privacyCta: "Come funziona",
  ctaBand: "Ci farebbe piacere conoscervi e capire le vostre esigenze: ogni territorio ha le sue, e le domande che vi arrivano non sono quelle di nessun altro. Scriveteci, senza impegno.",
  ctaBandBtn: "Contattateci",
  footTagline: "Assistenza su WhatsApp per Pro Loco e Consorzi turistici.",
  footResources: "Risorse",
  footLegal: "Legale",
  footPrivacy: "Privacy",
  footTerms: "Termini",
  footer: "eChatbot — assistenza su WhatsApp per Pro Loco e Consorzi turistici.",
}

const en: HomeCopy = {
  galleryTitle: "Your region, as it really is",
  gallerySubtitle: "Every entry can carry its own photos: the visitor sees the place before they get there.",
  audience: "for Tourist Offices",
  navPricing: "Pricing",
  navDemo: "Demo",
  navContact: "Contact us",
  eyebrow: "Only for tourist information offices",
  slogan1: "Your region answers",
  slogan2: "on WhatsApp",
  lede: "An assistant that combines the weather, each guest's own needs and your local knowledge to help them throughout their holiday — around the clock, in their own language, straight on WhatsApp.",
  chipMulti: "Every language",
  chip24: "24 hours a day",
  chipFaq: "The usual questions",
  chipPush: "Push notifications",
  chipMix: "Weather, events, preferences",
  loginTitle: "Sign in to your channel",
  loginSub: "Manage content, notifications and conversations.",
  email: "Email",
  password: "Password",
  loginCta: "Sign in",
  loginLoading: "Signing in...",
  forgot: "Forgot your password?",
  orDivider: "or",
  errBadCredentials: "Incorrect email or password.",
  errGeneric: "Sign-in failed. Please try again shortly.",
  benefitsTitle: "What changes for your visitors",
  benefitsSub: "And for whoever answers the same questions every day at the desk.",
  benefits: [
    { title: "Every visitor in their language", body: "A German writes in German, a Frenchman in French. You write the content once: the assistant handles the translation." },
    { title: "Nobody waits their turn", body: "A hundred visitors can ask at the same moment and each gets their own answer. At the desk, they queue." },
    { title: "Welcome message", body: "First-time visitors are welcomed, not interrogated. The assistant introduces itself and works out what they need." },
    { title: "Photos and video, not just text", body: "A waterfall makes more sense once you see it. Every place can carry its own images and videos." },
    { title: "It answers on Sundays", body: "And Saturdays, and mid-August, and at eleven at night. When the office is closed the questions still arrive — and they still get answered." },
    { title: "Push notifications", body: "Saturday's festival, the closed road, the concert in the square: only to visitors who opted in, and they can opt out any time." },
  ],
  contentTitle: "The whole region, in your pocket",
  contentBody1: "A new hotel, a changed opening time, September's festival: you write it in the panel and the assistant knows it straight away. Without calling anyone.",
  contentBody2: "And it answers only with what you loaded. If something is not there, it says so instead of inventing it. A name, a number or a time that is not in your records is removed from the reply before it is sent.",
  contentTypes: ["Hotels and B&Bs", "Restaurants and farm stays", "Hikes and mountain huts", "Festivals and events", "Local produce", "Villages and viewpoints", "Castles and churches", "Local history", "Sports facilities", "Useful numbers"],
  pricingTitle: "Clear pricing, no surprises",
  pricingSub: "The subscription covers the service. Usage is billed separately, only when you use it.",
  revenueEyebrow: "The business model",
  revenueTitle: "Local businesses can sponsor themselves on the channel",
  revenueBody1: "A hotel, a restaurant, an equipment rental — for example — can sponsor themselves on your channel, with a message that reaches visitors who opted in. You set the price, the system keeps count of how many messages have been sent.",
  revenueBody2: "For many tourist offices it covers the cost of the service. What comes after that is income.",
  retentionEyebrow: "The right message, at the right moment",
  retentionTitle: "While they are here, and once they are back home.",
  retentionBody1: "A visitor who has written to you once is the most valuable contact you have: they know the place, they enjoyed it, and they left you their number. During the holiday they get what they need right now; afterwards, what brings them back.",
  retentionBody2: "Before Christmas, Easter or the summer they get your offers for the next holiday — but only if they gave their consent, and a single NO is enough to stop them.",
  retentionSteps: [
    { t: "During the stay", d: "Changing weather, tonight's event, a festival moved because of rain: the alert reaches whoever is in the village at that moment. Nobody in the office has to press anything." },
    { t: "Before the holidays", d: "Once the holiday is over, the contact remains. A few weeks before Christmas, Easter or the summer they get offers and events for the coming season — the moment people actually decide where to go." },
    { t: "Always with consent", d: "Consent is asked for in the chat, and writing NO is enough to stop receiving. Before each send the system also checks it is not repeating something another campaign has already said." },
  ],
  faqTitle: "The questions we always get",
  faqItems: [
    { q: "Do we need a new WhatsApp number?", a: "No, you can use the number you already have, as long as it isn't tied to the WhatsApp app on a phone. If you'd rather keep the office number separate, we activate a dedicated one: your call." },
    { q: "Who updates the information?", a: "You do, from a panel that works like a spreadsheet: open the event, change the time, save. Nobody has to touch code, and you don't need to call us for an edit." },
    { q: "What if the assistant doesn't know the answer?", a: "It says so instead of inventing one. If the question falls outside the catalogue — or the person asks to speak to somebody — the conversation is handed to a real operator, who sees it and replies from the panel." },
    { q: "How long before we're live?", a: "It depends almost entirely on how much material you already have. With a list of events and venues to import you're live in a few days; if the catalogue has to be built from scratch, allow a few weeks of data gathering." },
    { q: "Where does visitor data end up?", a: "It stays yours. Contacts and conversations sit in your own space, separate from every other organisation, and handling is GDPR-compliant. It is never used to train models or passed to third parties." },
    { q: "Does it work if we're not a mountain destination?", a: "Yes. The assistant knows nothing about mountains in particular: it knows what is in your catalogue. Seaside, art city, lake or village changes the entries, not how it works." },
  ],
  revenueSteps: [
    { t: "The business buys a bundle", d: "Ten, fifty, a hundred messages. You set the price." },
    { t: "They prepare their message", d: "Text and a photo of their offer, which you approve before it goes out." },
    { t: "It only reaches those who opted in", d: "And each send comes off their bundle, with nothing for you to count." },
  ],
  closingBody: "At the desk and on the phone, usually with a queue waiting. From now on the assistant answers for you — from what you loaded, in the language they asked in.",
  demoTitle: "Try the demo",
  demoSub: "Scan the code and ask it whatever a visitor would ask you.",
  demoOpen: "Open it on WhatsApp",
  surveyEyebrow: "Survey",
  surveyTitle: "Help us build the right assistant for you",
  surveyBody: "Answer a few questions about your area and what visitors ask you, and we'll show you how the assistant would work for you. Two minutes, no commitment.",
  surveyCta: "Start the survey →",
  privacyBadge: "GDPR compliant",
  privacyTitle: "Privacy by design",
  privacyBody: "Your visitors' data stays yours. No sensitive data reaches third parties or AI models, notifications only go to those who opted in, and that consent can be withdrawn at any time with a single word.",
  privacyCta: "How it works",
  ctaBand: "We'd like to get to know you and understand what you need: every area is different, and the questions you get are nobody else's. Write to us, no commitment.",
  ctaBandBtn: "Contact us",
  footTagline: "WhatsApp assistance for tourist offices and consortia.",
  footResources: "Resources",
  footLegal: "Legal",
  footPrivacy: "Privacy",
  footTerms: "Terms",
  footer: "eChatbot — WhatsApp assistance for tourist offices and visitor centres.",
}

const es: HomeCopy = {
  galleryTitle: "Vuestro territorio, tal y como es",
  gallerySubtitle: "Cada ficha puede llevar sus fotos: el visitante ve el sitio antes de llegar.",
  audience: "para Oficinas de Turismo",
  navPricing: "Precios",
  navDemo: "Demo",
  navContact: "Contacto",
  eyebrow: "Solo para oficinas de turismo",
  slogan1: "Vuestro territorio responde",
  slogan2: "por WhatsApp",
  lede: "Un asistente que cruza el tiempo, las necesidades del huésped y la información del territorio para acompañarlo durante toda su estancia, 24 horas al día, en su idioma materno, directamente en WhatsApp.",
  chipMulti: "Todos los idiomas",
  chip24: "24 horas al día",
  chipFaq: "Las preguntas de siempre",
  chipPush: "Notificaciones push",
  chipMix: "Tiempo, eventos y preferencias",
  loginTitle: "Accede a tu canal",
  loginSub: "Gestiona contenidos, notificaciones y conversaciones.",
  email: "Email",
  password: "Contraseña",
  loginCta: "Acceder",
  loginLoading: "Accediendo...",
  forgot: "¿Has olvidado la contraseña?",
  orDivider: "o",
  errBadCredentials: "Email o contraseña incorrectos.",
  errGeneric: "No se ha podido acceder. Inténtalo de nuevo en un momento.",
  benefitsTitle: "Qué cambia para vuestros visitantes",
  benefitsSub: "Y para quien responde cada día a las mismas preguntas en la oficina.",
  benefits: [
    { title: "Cada visitante en su idioma", body: "Un alemán escribe en alemán, un francés en francés. Vosotros escribís el contenido una sola vez: de la traducción se encarga el asistente." },
    { title: "Nadie espera su turno", body: "Cien turistas pueden preguntar a la vez y cada uno recibe su respuesta. En el mostrador, en cambio, se hace cola." },
    { title: "Mensaje de bienvenida", body: "A quien escribe por primera vez se le acoge, no se le interroga. El asistente se presenta y entiende qué necesita." },
    { title: "Fotos y vídeo, no solo texto", body: "Una cascada se entiende mejor viéndola. Cada lugar puede llevar consigo sus imágenes y sus vídeos." },
    { title: "Responde en domingo", body: "Y el sábado, y en agosto, y a las once de la noche. Con la oficina cerrada las preguntas llegan igual — y encuentran respuesta." },
    { title: "Notificaciones push", body: "La fiesta del sábado, la carretera cortada, el concierto en la plaza: solo a quienes dieron su consentimiento, revocable siempre." },
  ],
  contentTitle: "Todo el territorio, en el bolsillo",
  contentBody1: "Un hotel nuevo, un horario que cambia, la fiesta de septiembre: lo escribís en el panel y el asistente lo sabe al momento. Sin llamar a nadie.",
  contentBody2: "Y responde solo con lo que habéis cargado. Si un dato no está, lo dice: no se lo inventa. Un nombre, un número o un horario que no esté en vuestras fichas se elimina de la respuesta antes de enviarla.",
  contentTypes: ["Hoteles y casas rurales", "Restaurantes y agroturismos", "Rutas y refugios", "Fiestas y eventos", "Productos típicos", "Pueblos y miradores", "Castillos e iglesias", "Historia local", "Instalaciones deportivas", "Teléfonos útiles"],
  pricingTitle: "Precios claros, sin sorpresas",
  pricingSub: "La cuota cubre el servicio. El consumo se paga aparte, solo cuando se usa.",
  revenueEyebrow: "Modelo económico",
  revenueTitle: "Los negocios pueden patrocinarse en el canal",
  revenueBody1: "Un hotel, un restaurante, un alquiler de material — por ejemplo — pueden patrocinarse en vuestro canal, con un mensaje que llega a los turistas que dieron su consentimiento. Vosotros ponéis el precio, el sistema lleva la cuenta del número de envíos realizados.",
  revenueBody2: "Para muchas oficinas de turismo basta para cubrir el coste del servicio. Lo que llega después es ganancia.",
  retentionEyebrow: "El mensaje justo, en el momento justo",
  retentionTitle: "Mientras están aquí, y cuando ya han vuelto a casa.",
  retentionBody1: "El visitante que os ha escrito una vez es el contacto más valioso que tenéis: conoce el lugar, se encontró a gusto y os dejó su número. Durante las vacaciones recibe lo que necesita ahora; después, lo que lo trae de vuelta.",
  retentionBody2: "Antes de Navidad, de Semana Santa o del verano recibe vuestras ofertas para las próximas vacaciones — pero solo si dio su consentimiento, y con un NO basta para dejar de recibirlas.",
  retentionSteps: [
    { t: "Durante la estancia", d: "Un cambio de tiempo, un evento de esta noche, una fiesta aplazada por lluvia: el aviso llega a quien está en el pueblo en ese momento. Nadie en la oficina tiene que pulsar nada." },
    { t: "Antes de las fiestas", d: "Acabadas las vacaciones, el contacto se queda. Unas semanas antes de Navidad, Semana Santa o el verano recibe ofertas y eventos de la próxima temporada — cuando de verdad se decide adónde ir." },
    { t: "Siempre con consentimiento", d: "El consentimiento se pide en el chat, y basta escribir NO para dejar de recibir. Antes de cada envío el sistema comprueba además que no repite algo que ya dijo otra campaña." },
  ],
  faqTitle: "Las preguntas que siempre nos hacen",
  faqItems: [
    { q: "¿Hace falta un número de WhatsApp nuevo?", a: "No, se puede usar el número que ya tenéis, siempre que no esté vinculado a la app de WhatsApp en un teléfono. Si preferís mantener aparte el número de la oficina, activamos uno dedicado: lo decidís vosotros." },
    { q: "¿Quién actualiza la información?", a: "La actualizáis vosotros, desde un panel que se usa como una hoja de cálculo: se abre la ficha del evento, se cambia el horario, se guarda. Nadie tiene que tocar código ni hace falta llamarnos para un cambio." },
    { q: "¿Y si el asistente no sabe responder?", a: "Lo dice, en vez de inventar. Si la pregunta se sale del catálogo — o la persona pide hablar con alguien — la conversación pasa a un operador real, que la ve y responde desde el panel." },
    { q: "¿Cuánto se tarda en empezar?", a: "Depende casi solo del material que ya tengáis. Con un listado de eventos y alojamientos por importar se empieza en pocos días; si el catálogo hay que construirlo de cero, harán falta unas semanas de recogida de datos." },
    { q: "¿Dónde acaban los datos de los turistas?", a: "Siguen siendo vuestros. Los contactos y las conversaciones están en vuestro espacio, separados de los de cualquier otra entidad, y la gestión cumple el RGPD. No se usan para entrenar modelos ni se ceden a terceros." },
    { q: "¿Funciona si no estamos en la montaña?", a: "Sí. El asistente no sabe nada de la montaña en particular: sabe lo que hay en vuestro catálogo. Costa, ciudad de arte, lago o pueblo cambian las fichas, no el funcionamiento." },
  ],
  revenueSteps: [
    { t: "El negocio compra un paquete", d: "Diez, cincuenta, cien mensajes. El precio lo ponéis vosotros." },
    { t: "Prepara su mensaje", d: "Texto y foto de su oferta, que aprobáis antes del envío." },
    { t: "Solo llega a quien dio su consentimiento", d: "Y cada envío se descuenta de su paquete, sin que tengáis que contar nada." },
  ],
  closingBody: "En el mostrador y por teléfono, casi siempre con cola esperando. A partir de ahora responde el asistente — con lo que habéis cargado, en el idioma de quien pregunta.",
  demoTitle: "Probad la demo",
  demoSub: "Escanead el código y preguntadle lo que os preguntaría un turista.",
  demoOpen: "Abrir en WhatsApp",
  surveyEyebrow: "Cuestionario",
  surveyTitle: "Ayudadnos a construir el asistente adecuado para vosotros",
  surveyBody: "Responded a unas preguntas sobre vuestro territorio y sobre lo que os preguntan los turistas: os mostramos cómo trabajaría el asistente para vosotros. Dos minutos, sin compromiso.",
  surveyCta: "Empezar el cuestionario →",
  privacyBadge: "Conforme al RGPD",
  privacyTitle: "Privacy by design",
  privacyBody: "Los datos de vuestros turistas siguen siendo vuestros. Ningún dato sensible llega a terceros ni a modelos de IA, las notificaciones solo se envían a quien dio su consentimiento, y ese consentimiento se puede revocar en cualquier momento.",
  privacyCta: "Cómo funciona",
  ctaBand: "Nos gustaría conoceros y entender vuestras necesidades: cada territorio tiene las suyas, y las preguntas que os llegan no son las de nadie más. Escribidnos, sin compromiso.",
  ctaBandBtn: "Contactadnos",
  footTagline: "Asistencia en WhatsApp para oficinas de turismo y consorcios.",
  footResources: "Recursos",
  footLegal: "Legal",
  footPrivacy: "Privacidad",
  footTerms: "Términos",
  footer: "eChatbot — asistencia por WhatsApp para oficinas de turismo y patronatos.",
}

const ca: HomeCopy = {
  ...es,
  galleryTitle: "El vostre territori, tal com és",
  gallerySubtitle: "Cada fitxa pot portar les seves fotos: el visitant veu el lloc abans d'arribar-hi.",
  audience: "per a Oficines de Turisme",
  navPricing: "Preus",
  navDemo: "Demo",
  navContact: "Contacte",
  eyebrow: "Només per a oficines de turisme",
  slogan1: "El vostre territori respon",
  slogan2: "per WhatsApp",
  lede: "Un assistent que creua el temps, les necessitats de l'hoste i la informació del territori per acompanyar-lo durant tota l'estada, 24 hores al dia, en la seva llengua materna, directament a WhatsApp.",
  chipMulti: "Totes les llengües",
  chip24: "24 hores al dia",
  chipFaq: "Les preguntes de sempre",
  chipPush: "Notificacions push",
  chipMix: "Temps, esdeveniments, preferències",
  loginTitle: "Accedeix al teu canal",
  loginSub: "Gestiona continguts, notificacions i converses.",
  email: "Correu electrònic",
  password: "Contrasenya",
  loginCta: "Accedeix",
  loginLoading: "Accedint...",
  forgot: "Has oblidat la contrasenya?",
  orDivider: "o",
  errBadCredentials: "Correu o contrasenya incorrectes.",
  errGeneric: "No s'ha pogut accedir. Torna-ho a provar d'aquí a una estona.",
  benefitsTitle: "Què canvia per als vostres visitants",
  benefitsSub: "I per a qui respon cada dia les mateixes preguntes a l'oficina.",
  benefits: [
    { title: "Cada visitant en la seva llengua", body: "Un alemany escriu en alemany, un francès en francès. Vosaltres escriviu el contingut una sola vegada: de la traducció se n'encarrega l'assistent." },
    { title: "Ningú espera el seu torn", body: "Cent turistes poden preguntar alhora i cadascun rep la seva resposta. Al taulell, en canvi, es fa cua." },
    { title: "Missatge de benvinguda", body: "A qui escriu per primera vegada se l'acull, no se l'interroga. L'assistent es presenta i entén què necessita." },
    { title: "Fotos i vídeo, no només text", body: "Una cascada s'entén millor veient-la. Cada lloc pot portar amb ell les seves imatges i els seus vídeos." },
    { title: "Respon en diumenge", body: "I el dissabte, i a l'agost, i a les onze de la nit. Amb l'oficina tancada les preguntes arriben igualment — i troben resposta." },
    { title: "Notificacions push", body: "La festa de dissabte, la carretera tallada, el concert a la plaça: només a qui hi ha donat el consentiment, revocable sempre." },
  ],
  contentTitle: "Tot el territori, a la butxaca",
  contentBody1: "Un hotel nou, un horari que canvia, la festa de setembre: ho escriviu al tauler i l'assistent ho sap de seguida. Sense trucar a ningú.",
  contentBody2: "I respon només amb allò que heu carregat. Si una dada no hi és, ho diu: no se la inventa. Un nom, un número o un horari que no sigui a les vostres fitxes s'elimina de la resposta abans d'enviar-la.",
  contentTypes: ["Hotels i cases rurals", "Restaurants i agroturismes", "Rutes i refugis", "Festes i esdeveniments", "Productes típics", "Pobles i miradors", "Castells i esglésies", "Història local", "Instal·lacions esportives", "Telèfons útils"],
  pricingTitle: "Preus clars, sense sorpreses",
  pricingSub: "La quota cobreix el servei. El consum es paga a part, només quan es fa servir.",
  revenueEyebrow: "Model econòmic",
  revenueTitle: "Els negocis poden patrocinar-se al canal",
  revenueBody1: "Un hotel, un restaurant, un lloguer de material — per exemple — es poden patrocinar al vostre canal, amb un missatge que arriba als turistes que hi han donat el consentiment. Vosaltres poseu el preu, el sistema porta el compte del nombre d'enviaments fets.",
  revenueBody2: "Per a moltes oficines de turisme n'hi ha prou per cobrir el cost del servei. El que arriba després és guany.",
  retentionEyebrow: "El missatge just, en el moment just",
  retentionTitle: "Mentre són aquí, i quan ja han tornat a casa.",
  retentionBody1: "El visitant que us ha escrit un cop és el contacte més valuós que teniu: coneix el lloc, s'hi va trobar bé i us ha deixat el número. Durant les vacances rep el que necessita ara; després, el que el fa tornar.",
  retentionBody2: "Abans de Nadal, de Setmana Santa o de l'estiu rep les vostres ofertes per a les pròximes vacances — però només si hi ha donat el consentiment, i amb un NO n'hi ha prou per deixar de rebre'n.",
  retentionSteps: [
    { t: "Durant l'estada", d: "Un canvi de temps, un acte d'aquesta nit, una festa ajornada per pluja: l'avís arriba a qui és al poble en aquell moment. Ningú de l'oficina ha de prémer res." },
    { t: "Abans de les festes", d: "Acabades les vacances, el contacte es queda. Unes setmanes abans de Nadal, Setmana Santa o l'estiu rep ofertes i actes de la pròxima temporada — quan de debò es decideix on anar." },
    { t: "Sempre amb consentiment", d: "El consentiment es demana al xat, i n'hi ha prou d'escriure NO per deixar de rebre. Abans de cada enviament el sistema comprova també que no repeteix una cosa que ja ha dit una altra iniciativa." },
  ],
  faqTitle: "Les preguntes que ens fan sempre",
  faqItems: [
    { q: "Cal un número de WhatsApp nou?", a: "No, es pot fer servir el número que ja teniu, sempre que no estigui vinculat a l'app de WhatsApp en un telèfon. Si preferiu mantenir a part el número de l'oficina, n'activem un de dedicat: ho decidiu vosaltres." },
    { q: "Qui actualitza la informació?", a: "L'actualitzeu vosaltres, des d'un panell que es fa servir com un full de càlcul: s'obre la fitxa de l'acte, es canvia l'horari, es desa. Ningú no ha de tocar codi ni cal trucar-nos per un canvi." },
    { q: "I si l'assistent no sap respondre?", a: "Ho diu, en comptes d'inventar-s'ho. Si la pregunta surt del catàleg — o la persona demana parlar amb algú — la conversa passa a un operador real, que la veu i respon des del panell." },
    { q: "Quant es triga a començar?", a: "Depèn gairebé només del material que ja tingueu. Amb un llistat d'actes i allotjaments per importar es comença en pocs dies; si el catàleg s'ha de construir de zero, calen unes setmanes de recollida de dades." },
    { q: "On acaben les dades dels turistes?", a: "Continuen sent vostres. Els contactes i les converses són al vostre espai, separats dels de qualsevol altra entitat, i la gestió compleix el RGPD. No s'usen per entrenar models ni es cedeixen a tercers." },
    { q: "Funciona si no som a la muntanya?", a: "Sí. L'assistent no sap res de la muntanya en particular: sap el que hi ha al vostre catàleg. Costa, ciutat d'art, llac o poble canvien les fitxes, no el funcionament." },
  ],
  revenueSteps: [
    { t: "El negoci compra un paquet", d: "Deu, cinquanta, cent missatges. El preu el poseu vosaltres." },
    { t: "Prepara el seu missatge", d: "Text i foto de la seva oferta, que aproveu abans de l'enviament." },
    { t: "Només arriba a qui hi ha consentit", d: "I cada enviament es descompta del seu paquet, sense que hàgiu de comptar res." },
  ],
  closingBody: "Al taulell i per telèfon, gairebé sempre amb cua esperant. A partir d'ara respon l'assistent — amb el que heu carregat, en la llengua de qui pregunta.",
  demoTitle: "Proveu la demo",
  demoSub: "Escanegeu el codi i pregunteu-li el que us preguntaria un turista.",
  demoOpen: "Obrir a WhatsApp",
  surveyEyebrow: "Qüestionari",
  surveyTitle: "Ajudeu-nos a construir l'assistent adequat per a vosaltres",
  surveyBody: "Responeu unes preguntes sobre el vostre territori i sobre què us pregunten els turistes: us mostrem com treballaria l'assistent per a vosaltres. Dos minuts, sense compromís.",
  surveyCta: "Comença el qüestionari →",
  privacyBadge: "Compleix el RGPD",
  privacyTitle: "Privacy by design",
  privacyBody: "Les dades dels vostres turistes continuen sent vostres. Cap dada sensible arriba a tercers ni a models d'IA, les notificacions només s'envien a qui hi ha donat el consentiment, i es pot revocar en qualsevol moment.",
  privacyCta: "Com funciona",
  ctaBand: "Ens agradaria conèixer-vos i entendre les vostres necessitats: cada territori té les seves, i les preguntes que us arriben no són les de ningú més. Escriviu-nos, sense compromís.",
  ctaBandBtn: "Contacteu-nos",
  footTagline: "Assistència a WhatsApp per a oficines de turisme i consorcis.",
  footResources: "Recursos",
  footLegal: "Legal",
  footPrivacy: "Privadesa",
  footTerms: "Termes",
  footer: "eChatbot — assistència per WhatsApp per a oficines de turisme i consorcis.",
}

const fr: HomeCopy = {
  galleryTitle: "Votre territoire, tel qu'il est",
  gallerySubtitle: "Chaque fiche peut porter ses photos : le visiteur voit le lieu avant d'y arriver.",
  audience: "pour Offices de Tourisme",
  navPricing: "Tarifs",
  navDemo: "Démo",
  navContact: "Contact",
  eyebrow: "Uniquement pour les offices de tourisme",
  slogan1: "Votre territoire répond",
  slogan2: "sur WhatsApp",
  lede: "Un assistant qui croise la météo, les envies de chaque visiteur et les informations du territoire pour l'accompagner tout au long de son séjour, 24 heures sur 24, dans sa langue maternelle, directement sur WhatsApp.",
  chipMulti: "Toutes les langues",
  chip24: "24 heures sur 24",
  chipFaq: "Les questions habituelles",
  chipPush: "Notifications push",
  chipMix: "Météo, événements, préférences",
  loginTitle: "Connectez-vous à votre canal",
  loginSub: "Gérez contenus, notifications et conversations.",
  email: "Email",
  password: "Mot de passe",
  loginCta: "Se connecter",
  loginLoading: "Connexion...",
  forgot: "Mot de passe oublié ?",
  orDivider: "ou",
  errBadCredentials: "Email ou mot de passe incorrects.",
  errGeneric: "Connexion impossible. Réessayez dans un instant.",
  benefitsTitle: "Ce qui change pour vos visiteurs",
  benefitsSub: "Et pour celui qui, au guichet, répond chaque jour aux mêmes questions.",
  benefits: [
    { title: "Chaque visiteur dans sa langue", body: "Un Allemand écrit en allemand, un Français en français. Vous rédigez le contenu une seule fois : l'assistant s'occupe de la traduction." },
    { title: "Personne n'attend son tour", body: "Cent visiteurs peuvent demander en même temps, chacun reçoit sa réponse. Au guichet, on fait la queue." },
    { title: "Message de bienvenue", body: "Celui qui écrit pour la première fois est accueilli, pas interrogé. L'assistant se présente et comprend ce dont il a besoin." },
    { title: "Photos et vidéos, pas que du texte", body: "Une cascade se comprend mieux en la voyant. Chaque lieu peut porter ses images et ses vidéos." },
    { title: "Il répond le dimanche", body: "Et le samedi, et au mois d'août, et à onze heures du soir. Quand l'office est fermé, les questions arrivent quand même — et trouvent une réponse." },
    { title: "Notifications push", body: "La fête de samedi, la route fermée, le concert sur la place : uniquement aux visiteurs qui ont donné leur accord, révocable à tout moment." },
  ],
  contentTitle: "Tout le territoire, dans votre poche",
  contentBody1: "Un nouvel hôtel, un horaire qui change, la fête de septembre : vous l'écrivez dans le panneau et l'assistant le sait aussitôt. Sans appeler personne.",
  contentBody2: "Et il ne répond qu'avec ce que vous avez saisi. Si une information manque, il le dit : il ne l'invente pas. Un nom, un numéro ou un horaire absent de vos fiches est retiré de la réponse avant l'envoi.",
  contentTypes: ["Hôtels et chambres d'hôtes", "Restaurants et fermes-auberges", "Randonnées et refuges", "Fêtes et événements", "Produits du terroir", "Villages et points de vue", "Châteaux et églises", "Histoire locale", "Équipements sportifs", "Numéros utiles"],
  pricingTitle: "Des prix clairs, sans surprise",
  pricingSub: "L'abonnement couvre le service. La consommation est facturée à part, uniquement à l'usage.",
  revenueEyebrow: "Modèle économique",
  revenueTitle: "Les commerçants peuvent se sponsoriser sur le canal",
  revenueBody1: "Un hôtel, un restaurant, un loueur de matériel — par exemple — peuvent se sponsoriser sur votre canal, avec un message qui atteint les visiteurs qui ont donné leur accord. Vous fixez le prix, le système compte le nombre d'envois effectués.",
  revenueBody2: "Pour beaucoup d'offices de tourisme, cela suffit à couvrir le coût du service. Ce qui vient après est du gain.",
  retentionEyebrow: "Le bon message, au bon moment",
  retentionTitle: "Pendant qu'ils sont là, et une fois rentrés chez eux.",
  retentionBody1: "Le visiteur qui vous a écrit une fois est le contact le plus précieux que vous ayez : il connaît l'endroit, il s'y est plu, et il vous a laissé son numéro. Pendant les vacances, il reçoit ce dont il a besoin maintenant ; ensuite, ce qui le fait revenir.",
  retentionBody2: "Avant Noël, Pâques ou l'été, il reçoit vos offres pour les prochaines vacances — mais seulement s'il a donné son consentement, et un simple NON suffit pour ne plus rien recevoir.",
  retentionSteps: [
    { t: "Pendant le séjour", d: "Un changement de météo, un événement ce soir, une fête reportée pour cause de pluie : l'alerte arrive à ceux qui sont au village à ce moment-là. Personne à l'office n'a rien à faire." },
    { t: "Avant les fêtes", d: "Les vacances finies, le contact reste. Quelques semaines avant Noël, Pâques ou l'été, il reçoit offres et événements de la saison à venir — le moment où l'on choisit vraiment où aller." },
    { t: "Toujours avec le consentement", d: "Le consentement est demandé dans la conversation, et il suffit d'écrire NON pour ne plus rien recevoir. Avant chaque envoi, le système vérifie aussi qu'il ne répète pas ce qu'une autre campagne a déjà dit." },
  ],
  faqTitle: "Les questions qu'on nous pose toujours",
  faqItems: [
    { q: "Faut-il un nouveau numéro WhatsApp ?", a: "Non, vous pouvez utiliser celui que vous avez déjà, à condition qu'il ne soit pas lié à l'application WhatsApp sur un téléphone. Si vous préférez garder le numéro de l'office à part, nous en activons un dédié : c'est vous qui décidez." },
    { q: "Qui met à jour les informations ?", a: "Vous, depuis un panneau qui s'utilise comme un tableur : on ouvre la fiche de l'événement, on change l'horaire, on enregistre. Personne n'a à toucher au code et il n'est pas nécessaire de nous appeler pour une modification." },
    { q: "Et si l'assistant ne sait pas répondre ?", a: "Il le dit, au lieu d'inventer. Si la question sort du catalogue — ou si la personne demande à parler à quelqu'un — la conversation passe à un vrai opérateur, qui la voit et répond depuis le panneau." },
    { q: "Combien de temps avant de démarrer ?", a: "Cela dépend presque uniquement du matériel dont vous disposez déjà. Avec une liste d'événements et d'hébergements à importer, on démarre en quelques jours ; s'il faut construire le catalogue de zéro, comptez quelques semaines de collecte." },
    { q: "Où vont les données des visiteurs ?", a: "Elles restent les vôtres. Les contacts et les conversations sont dans votre espace, séparés de ceux de tout autre organisme, et la gestion est conforme au RGPD. Elles ne servent jamais à entraîner des modèles ni ne sont cédées à des tiers." },
    { q: "Cela marche-t-il si nous ne sommes pas en montagne ?", a: "Oui. L'assistant ne sait rien de la montagne en particulier : il sait ce qui figure dans votre catalogue. Mer, ville d'art, lac ou village changent les fiches, pas le fonctionnement." },
  ],
  revenueSteps: [
    { t: "Le commerçant achète un forfait", d: "Dix, cinquante, cent messages. C'est vous qui fixez le prix." },
    { t: "Il prépare son message", d: "Texte et photo de son offre, que vous validez avant l'envoi." },
    { t: "Il ne part qu'aux personnes consentantes", d: "Et chaque envoi est décompté de son forfait, sans rien à compter de votre côté." },
  ],
  closingBody: "Au guichet et au téléphone, le plus souvent avec la file qui attend. Désormais l'assistant répond pour vous — avec ce que vous avez saisi, dans la langue de celui qui demande.",
  demoTitle: "Essayez la démo",
  demoSub: "Scannez le code et posez-lui la question qu'un visiteur vous poserait.",
  demoOpen: "Ouvrir sur WhatsApp",
  surveyEyebrow: "Questionnaire",
  surveyTitle: "Aidez-nous à construire l'assistant qu'il vous faut",
  surveyBody: "Répondez à quelques questions sur votre territoire et sur ce que les visiteurs vous demandent : nous vous montrons comment l'assistant travaillerait pour vous. Deux minutes, sans engagement.",
  surveyCta: "Commencer le questionnaire →",
  privacyBadge: "Conforme au RGPD",
  privacyTitle: "Privacy by design",
  privacyBody: "Les données de vos visiteurs restent les vôtres. Aucune donnée sensible ne part vers des tiers ou des modèles d'IA, les notifications ne vont qu'à ceux qui ont consenti, et ce consentement est révocable à tout moment.",
  privacyCta: "Comment ça marche",
  ctaBand: "Nous aimerions faire votre connaissance et comprendre vos besoins : chaque territoire a les siens, et les questions que vous recevez ne sont celles de personne d'autre. Écrivez-nous, sans engagement.",
  ctaBandBtn: "Contactez-nous",
  footTagline: "Assistance WhatsApp pour offices de tourisme et consortiums.",
  footResources: "Ressources",
  footLegal: "Légal",
  footPrivacy: "Confidentialité",
  footTerms: "Conditions",
  footer: "eChatbot — assistance WhatsApp pour offices de tourisme et syndicats d'initiative.",
}

const de: HomeCopy = {
  galleryTitle: "Ihre Region, wie sie wirklich ist",
  gallerySubtitle: "Jeder Eintrag kann eigene Fotos mitbringen: Der Gast sieht den Ort, bevor er ankommt.",
  audience: "für Tourismusverbände",
  navPricing: "Preise",
  navDemo: "Demo",
  navContact: "Kontakt",
  eyebrow: "Nur für Tourismusbüros",
  slogan1: "Ihre Region antwortet",
  slogan2: "auf WhatsApp",
  lede: "Ein Assistent, der Wetter, die Wünsche des Gastes und Ihr lokales Wissen verbindet, um ihn durch den ganzen Urlaub zu begleiten — rund um die Uhr, in seiner Muttersprache, direkt über WhatsApp.",
  chipMulti: "Jede Sprache",
  chip24: "Rund um die Uhr",
  chipFaq: "Die üblichen Fragen",
  chipPush: "Push-Nachrichten",
  chipMix: "Wetter, Events, Vorlieben",
  loginTitle: "Zu Ihrem Kanal anmelden",
  loginSub: "Inhalte, Benachrichtigungen und Gespräche verwalten.",
  email: "E-Mail",
  password: "Passwort",
  loginCta: "Anmelden",
  loginLoading: "Anmeldung läuft...",
  forgot: "Passwort vergessen?",
  orDivider: "oder",
  errBadCredentials: "E-Mail oder Passwort sind falsch.",
  errGeneric: "Anmeldung fehlgeschlagen. Bitte gleich noch einmal versuchen.",
  benefitsTitle: "Was sich für Ihre Gäste ändert",
  benefitsSub: "Und für die Person am Schalter, die jeden Tag dieselben Fragen beantwortet.",
  benefits: [
    { title: "Jeder Gast in seiner Sprache", body: "Ein Deutscher schreibt auf Deutsch, ein Franzose auf Französisch. Sie schreiben die Inhalte ein einziges Mal: Das Übersetzen übernimmt der Assistent." },
    { title: "Niemand wartet, bis er dran ist", body: "Hundert Gäste können gleichzeitig fragen, jeder bekommt seine Antwort. Am Schalter steht man dagegen an." },
    { title: "Willkommensnachricht", body: "Wer zum ersten Mal schreibt, wird begrüßt und nicht ausgefragt. Der Assistent stellt sich vor und versteht, was gebraucht wird." },
    { title: "Fotos und Videos, nicht nur Text", body: "Einen Wasserfall versteht man besser, wenn man ihn sieht. Jeder Ort kann seine Bilder und Videos mitbringen." },
    { title: "Antwortet auch sonntags", body: "Und samstags, und mitten im August, und um elf Uhr abends. Wenn das Büro zu ist, kommen die Fragen trotzdem — und werden trotzdem beantwortet." },
    { title: "Push-Benachrichtigungen", body: "Das Fest am Samstag, die gesperrte Straße, das Konzert am Platz: nur an Gäste mit Einwilligung, jederzeit widerrufbar." },
  ],
  contentTitle: "Die ganze Region, in der Tasche",
  contentBody1: "Ein neues Hotel, eine geänderte Öffnungszeit, das Fest im September: Sie tragen es im Panel ein, und der Assistent weiß es sofort. Ohne jemanden anzurufen.",
  contentBody2: "Und er antwortet nur mit dem, was Sie hinterlegt haben. Fehlt eine Angabe, sagt er das — er erfindet sie nicht. Ein Name, eine Nummer oder eine Uhrzeit, die nicht in Ihren Daten steht, wird aus der Antwort entfernt, bevor sie rausgeht.",
  contentTypes: ["Hotels und Pensionen", "Restaurants und Almhütten", "Wanderungen und Schutzhütten", "Feste und Veranstaltungen", "Regionale Produkte", "Dörfer und Aussichtspunkte", "Burgen und Kirchen", "Ortsgeschichte", "Sportanlagen", "Wichtige Nummern"],
  pricingTitle: "Klare Preise, keine Überraschungen",
  pricingSub: "Die Gebühr deckt den Dienst. Der Verbrauch wird getrennt abgerechnet, nur bei Nutzung.",
  revenueEyebrow: "Geschäftsmodell",
  revenueTitle: "Betriebe können sich auf dem Kanal präsentieren",
  revenueBody1: "Ein Hotel, ein Restaurant, ein Materialverleih — zum Beispiel — können sich auf Ihrem Kanal präsentieren, mit einer Nachricht an Gäste mit Einwilligung. Sie legen den Preis fest, das System zählt mit, wie viele Nachrichten gesendet wurden.",
  revenueBody2: "Für viele Tourismusbüros deckt das die Kosten des Dienstes. Was danach kommt, ist Gewinn.",
  retentionEyebrow: "Die richtige Nachricht im richtigen Moment",
  retentionTitle: "Solange sie hier sind — und wenn sie wieder zu Hause sind.",
  retentionBody1: "Ein Gast, der Ihnen einmal geschrieben hat, ist der wertvollste Kontakt, den Sie haben: Er kennt den Ort, es hat ihm gefallen, und er hat Ihnen seine Nummer hinterlassen. Im Urlaub bekommt er, was er jetzt braucht; danach das, was ihn zurückholt.",
  retentionBody2: "Vor Weihnachten, Ostern oder dem Sommer bekommt er Ihre Angebote für den nächsten Urlaub — aber nur, wenn er seine Einwilligung gegeben hat, und ein einziges NEIN genügt, um nichts mehr zu erhalten.",
  retentionSteps: [
    { t: "Während des Aufenthalts", d: "Wetterumschwung, eine Veranstaltung heute Abend, ein wegen Regen verschobenes Fest: Die Meldung erreicht, wer gerade im Ort ist. Niemand im Büro muss etwas drücken." },
    { t: "Vor den Feiertagen", d: "Nach dem Urlaub bleibt der Kontakt. Einige Wochen vor Weihnachten, Ostern oder dem Sommer erhält er Angebote und Veranstaltungen der kommenden Saison — genau dann, wenn entschieden wird, wohin es geht." },
    { t: "Immer mit Einwilligung", d: "Die Einwilligung wird im Chat eingeholt, und ein NEIN genügt, um nichts mehr zu bekommen. Vor jedem Versand prüft das System zudem, dass es nicht wiederholt, was eine andere Kampagne schon gesagt hat." },
  ],
  faqTitle: "Die Fragen, die uns immer gestellt werden",
  faqItems: [
    { q: "Brauchen wir eine neue WhatsApp-Nummer?", a: "Nein, Sie können Ihre bestehende Nummer nutzen, solange sie nicht mit der WhatsApp-App auf einem Telefon verknüpft ist. Wenn Sie die Büronummer lieber getrennt halten, richten wir eine eigene ein — Sie entscheiden." },
    { q: "Wer aktualisiert die Informationen?", a: "Sie selbst, über ein Panel, das sich wie eine Tabelle bedienen lässt: Veranstaltung öffnen, Uhrzeit ändern, speichern. Niemand muss Code anfassen, und für eine Änderung müssen Sie uns nicht anrufen." },
    { q: "Und wenn der Assistent nicht antworten kann?", a: "Dann sagt er das, statt sich etwas auszudenken. Fällt die Frage aus dem Katalog — oder bittet die Person darum, mit jemandem zu sprechen — geht das Gespräch an eine echte Person, die es sieht und aus dem Panel antwortet." },
    { q: "Wie lange dauert es bis zum Start?", a: "Das hängt fast nur davon ab, wie viel Material Sie schon haben. Mit einer Liste von Veranstaltungen und Unterkünften zum Importieren starten Sie in wenigen Tagen; muss der Katalog von Grund auf entstehen, rechnen Sie mit einigen Wochen Datenerfassung." },
    { q: "Wo landen die Gästedaten?", a: "Sie bleiben Ihre. Kontakte und Gespräche liegen in Ihrem eigenen Bereich, getrennt von denen jeder anderen Einrichtung, und die Verarbeitung ist DSGVO-konform. Sie werden nicht zum Training von Modellen genutzt und nicht an Dritte weitergegeben." },
    { q: "Funktioniert es auch, wenn wir nicht in den Bergen liegen?", a: "Ja. Der Assistent weiß nichts über Berge im Besonderen: Er weiß, was in Ihrem Katalog steht. Meer, Kunststadt, See oder Dorf ändern die Einträge, nicht die Funktionsweise." },
  ],
  revenueSteps: [
    { t: "Der Betrieb kauft ein Paket", d: "Zehn, fünfzig, hundert Nachrichten. Den Preis bestimmen Sie." },
    { t: "Er bereitet seine Nachricht vor", d: "Text und Foto seines Angebots, das Sie vor dem Versand freigeben." },
    { t: "Sie geht nur an Einwilligende", d: "Und jeder Versand wird von seinem Paket abgezogen, ohne dass Sie zählen müssen." },
  ],
  closingBody: "Am Schalter und am Telefon, meist mit wartender Schlange. Ab jetzt antwortet der Assistent für Sie — mit dem, was Sie eingetragen haben, in der Sprache des Gastes.",
  demoTitle: "Testen Sie die Demo",
  demoSub: "Scannen Sie den Code und fragen Sie, was ein Gast Sie fragen würde.",
  demoOpen: "In WhatsApp öffnen",
  surveyEyebrow: "Fragebogen",
  surveyTitle: "Helfen Sie uns, den richtigen Assistenten für Sie zu bauen",
  surveyBody: "Beantworten Sie ein paar Fragen zu Ihrer Region und dazu, was Gäste Sie fragen — wir zeigen Ihnen, wie der Assistent für Sie arbeiten würde. Zwei Minuten, unverbindlich.",
  surveyCta: "Fragebogen starten →",
  privacyBadge: "DSGVO-konform",
  privacyTitle: "Privacy by design",
  privacyBody: "Die Daten Ihrer Gäste bleiben Ihre. Keine sensiblen Daten gehen an Dritte oder KI-Modelle, Benachrichtigungen erhalten nur Gäste mit Einwilligung, und diese lässt sich jederzeit widerrufen.",
  privacyCta: "So funktioniert es",
  ctaBand: "Wir würden Sie gern kennenlernen und verstehen, was Sie brauchen: Jede Region hat ihre eigenen Anforderungen, und die Fragen, die bei Ihnen ankommen, sind die von niemandem sonst. Schreiben Sie uns, unverbindlich.",
  ctaBandBtn: "Kontakt aufnehmen",
  footTagline: "WhatsApp-Assistenz für Tourismusbüros und Verbände.",
  footResources: "Ressourcen",
  footLegal: "Rechtliches",
  footPrivacy: "Datenschutz",
  footTerms: "AGB",
  footer: "eChatbot — WhatsApp-Assistenz für Tourismusverbände und Tourismusbüros.",
}

const COPY: Record<HomeLang, HomeCopy> = { it, en, es, de, fr, ca }

/** Italian is the fallback: this product is sold in Italy first. */
export function homeCopy(lang: string | undefined): HomeCopy {
  return COPY[(lang as HomeLang) ?? "it"] ?? it
}
