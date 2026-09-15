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
  galleryTitle: string
  gallerySubtitle: string
  closingTitle: string
  closingQuestions: string[]
  closingBody: string
  closingCta: string
  footer: string
}

const it: HomeCopy = {
  galleryTitle: "Il vostro territorio, com'è davvero",
  gallerySubtitle: "Ogni scheda può portarsi dietro le sue foto: l'ospite vede il posto prima di arrivarci.",
  audience: "per Pro Loco e Consorzi",
  eyebrow: "Per gli uffici turistici",
  slogan1: "Il vostro territorio risponde",
  slogan2: "su WhatsApp",
  lede: "Un assistente che incrocia il meteo, le esigenze dell'ospite e le informazioni del territorio per assisterlo durante tutta la vacanza, 24 ore su 24, nella sua lingua madre, direttamente su WhatsApp.",
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
  benefitsTitle: "Cosa cambia per i vostri ospiti",
  benefitsSub: "E per chi, in ufficio, risponde ogni giorno alle stesse domande.",
  benefits: [
    { title: "Ogni ospite nella sua lingua", body: "Un tedesco scrive in tedesco, un francese in francese. Voi scrivete i contenuti una volta sola: alla traduzione pensa l'assistente." },
    { title: "Aperto 24 ore su 24", body: "Alle sette di sera, di domenica, a ferragosto. Le domande arrivano quando l'ufficio è chiuso — e trovano risposta lo stesso." },
    { title: "Messaggio di benvenuto", body: "Chi scrive per la prima volta viene accolto, non interrogato. L'assistente si presenta e capisce di cosa ha bisogno." },
    { title: "Foto e video, non solo testo", body: "Una cascata si capisce meglio vedendola. Ogni luogo può portarsi dietro le sue immagini e i suoi video." },
    { title: "Notifiche push", body: "La sagra di sabato, la strada chiusa, il concerto in piazza: solo agli ospiti che hanno dato il consenso, revocabile sempre." },
    { title: "Su WhatsApp, non su un'app", body: "Nessuna installazione, nessuna registrazione. L'applicazione che il turista ha già sul telefono." },
  ],
  contentTitle: "Tutto il territorio, in un posto solo",
  contentBody1: "Un albergo nuovo, un orario che cambia, la sagra di settembre: lo scrivete nel pannello e l'assistente lo sa subito. Senza chiamare nessuno.",
  contentBody2: "E risponde solo con quello che avete caricato voi. Se un dato non c'è, lo dice: non lo inventa. Un nome, un numero o un orario che non è nelle vostre schede viene tolto dalla risposta prima che parta.",
  contentTypes: ["Hotel e B&B", "Ristoranti e agriturismi", "Escursioni e rifugi", "Sagre ed eventi", "Prodotti tipici", "Borghi e punti panoramici", "Castelli e chiese", "Cenni storici", "Numeri utili"],
  pricingTitle: "Prezzi chiari, nessuna sorpresa",
  pricingSub: "Il canone copre il servizio. I consumi si pagano a parte, solo quando li usate.",
  revenueEyebrow: "Il canale che si ripaga",
  revenueTitle: "Gli esercenti possono sponsorizzarsi sul canale",
  revenueBody1: "L'albergo, il ristorante, il noleggio sci: ognuno può comprare da voi un messaggio ai turisti che hanno dato il consenso. Voi vendete lo spazio, il sistema tiene il conto dei messaggi rimasti a ciascuno.",
  revenueBody2: "Per molti uffici turistici è la voce che ripaga il servizio — e poi diventa un'entrata.",
  revenueSteps: [
    { t: "L'esercente compra un pacchetto", d: "Dieci, cinquanta, cento messaggi. Decidete voi il prezzo." },
    { t: "Prepara il suo messaggio", d: "Testo e foto della sua offerta, che approvate prima dell'invio." },
    { t: "Parte solo a chi ha acconsentito", d: "E ogni invio scala dal suo pacchetto, senza che dobbiate contare nulla." },
  ],
  closingTitle: "Ogni giorno, le stesse",
  closingQuestions: ["Sono celiaco, dove andiamo a mangiare?", "Che escursioni possiamo fare?", "Che eventi ci sono questa settimana?", "Quali sono i piatti tipici?", "A che ora chiudono gli impianti?"],
  closingBody: "Allo sportello e al telefono, spesso mentre c'è la fila. Da adesso l'assistente risponde per voi — con quello che avete caricato, nella lingua di chi chiede. Voi restate per le cose che meritano una persona.",
  closingCta: "Accedi al tuo canale",
  footer: "eChatbot — assistenza su WhatsApp per Pro Loco e Consorzi turistici.",
}

const en: HomeCopy = {
  galleryTitle: "Your region, as it really is",
  gallerySubtitle: "Every entry can carry its own photos: the visitor sees the place before they get there.",
  audience: "for Tourist Offices",
  eyebrow: "For tourist information offices",
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
    { title: "Open 24 hours a day", body: "Seven in the evening, Sundays, mid-August. Questions arrive when the office is closed — and get answered anyway." },
    { title: "Welcome message", body: "First-time visitors are welcomed, not interrogated. The assistant introduces itself and works out what they need." },
    { title: "Photos and video, not just text", body: "A waterfall makes more sense once you see it. Every place can carry its own images and videos." },
    { title: "Push notifications", body: "Saturday's festival, the closed road, the concert in the square: only to visitors who opted in, and they can opt out any time." },
    { title: "On WhatsApp, not an app", body: "No install, no sign-up. The app the visitor already has on their phone." },
  ],
  contentTitle: "The whole region, in one place",
  contentBody1: "A new hotel, a changed opening time, September's festival: you write it in the panel and the assistant knows it straight away. Without calling anyone.",
  contentBody2: "And it answers only with what you loaded. If something is not there, it says so instead of inventing it. A name, a number or a time that is not in your records is removed from the reply before it is sent.",
  contentTypes: ["Hotels and B&Bs", "Restaurants and farm stays", "Hikes and mountain huts", "Festivals and events", "Local produce", "Villages and viewpoints", "Castles and churches", "Local history", "Useful numbers"],
  pricingTitle: "Clear pricing, no surprises",
  pricingSub: "The subscription covers the service. Usage is billed separately, only when you use it.",
  revenueEyebrow: "The channel that pays for itself",
  revenueTitle: "Local businesses can sponsor themselves on the channel",
  revenueBody1: "The hotel, the restaurant, the ski rental: each can buy a message to visitors who opted in. You sell the space, the system keeps count of what each has left.",
  revenueBody2: "For many tourist offices this is what pays for the service — and then becomes income.",
  revenueSteps: [
    { t: "The business buys a bundle", d: "Ten, fifty, a hundred messages. You set the price." },
    { t: "They prepare their message", d: "Text and a photo of their offer, which you approve before it goes out." },
    { t: "It only reaches those who opted in", d: "And each send comes off their bundle, with nothing for you to count." },
  ],
  closingTitle: "Every day, the same ones",
  closingQuestions: ["I'm coeliac, where can we eat?", "What hikes can we do?", "What's on this week?", "What are the local dishes?", "When do the lifts close?"],
  closingBody: "At the desk and on the phone, usually with a queue waiting. From now on the assistant answers for you — from what you loaded, in the language they asked in. You stay for the things that deserve a person.",
  closingCta: "Sign in to your channel",
  footer: "eChatbot — WhatsApp assistance for tourist offices and visitor centres.",
}

const es: HomeCopy = {
  galleryTitle: "Vuestro territorio, tal y como es",
  gallerySubtitle: "Cada ficha puede llevar sus fotos: el visitante ve el sitio antes de llegar.",
  audience: "para Oficinas de Turismo",
  eyebrow: "Para oficinas de turismo",
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
    { title: "Abierto 24 horas al día", body: "A las siete de la tarde, en domingo, en agosto. Las preguntas llegan con la oficina cerrada — y encuentran respuesta igual." },
    { title: "Mensaje de bienvenida", body: "A quien escribe por primera vez se le acoge, no se le interroga. El asistente se presenta y entiende qué necesita." },
    { title: "Fotos y vídeo, no solo texto", body: "Una cascada se entiende mejor viéndola. Cada lugar puede llevar consigo sus imágenes y sus vídeos." },
    { title: "Notificaciones push", body: "La fiesta del sábado, la carretera cortada, el concierto en la plaza: solo a quienes dieron su consentimiento, revocable siempre." },
    { title: "En WhatsApp, no en una app", body: "Sin instalación, sin registro. La aplicación que el turista ya tiene en el móvil." },
  ],
  contentTitle: "Todo el territorio, en un solo sitio",
  contentBody1: "Un hotel nuevo, un horario que cambia, la fiesta de septiembre: lo escribís en el panel y el asistente lo sabe al momento. Sin llamar a nadie.",
  contentBody2: "Y responde solo con lo que habéis cargado. Si un dato no está, lo dice: no se lo inventa. Un nombre, un número o un horario que no esté en vuestras fichas se elimina de la respuesta antes de enviarla.",
  contentTypes: ["Hoteles y casas rurales", "Restaurantes y agroturismos", "Rutas y refugios", "Fiestas y eventos", "Productos típicos", "Pueblos y miradores", "Castillos e iglesias", "Historia local", "Teléfonos útiles"],
  pricingTitle: "Precios claros, sin sorpresas",
  pricingSub: "La cuota cubre el servicio. El consumo se paga aparte, solo cuando se usa.",
  revenueEyebrow: "El canal que se paga solo",
  revenueTitle: "Los negocios pueden patrocinarse en el canal",
  revenueBody1: "El hotel, el restaurante, el alquiler de esquís: cada uno puede compraros un mensaje para los turistas que dieron su consentimiento. Vosotros vendéis el espacio, el sistema lleva la cuenta de lo que le queda a cada uno.",
  revenueBody2: "Para muchas oficinas de turismo es lo que paga el servicio — y después se convierte en un ingreso.",
  revenueSteps: [
    { t: "El negocio compra un paquete", d: "Diez, cincuenta, cien mensajes. El precio lo ponéis vosotros." },
    { t: "Prepara su mensaje", d: "Texto y foto de su oferta, que aprobáis antes del envío." },
    { t: "Solo llega a quien dio su consentimiento", d: "Y cada envío se descuenta de su paquete, sin que tengáis que contar nada." },
  ],
  closingTitle: "Cada día, las mismas",
  closingQuestions: ["Soy celíaco, ¿dónde podemos comer?", "¿Qué excursiones podemos hacer?", "¿Qué eventos hay esta semana?", "¿Cuáles son los platos típicos?", "¿A qué hora cierran los remontes?"],
  closingBody: "En el mostrador y por teléfono, casi siempre con cola esperando. A partir de ahora responde el asistente — con lo que habéis cargado, en el idioma de quien pregunta. Vosotros quedáis para lo que merece una persona.",
  closingCta: "Accede a tu canal",
  footer: "eChatbot — asistencia por WhatsApp para oficinas de turismo y patronatos.",
}

const ca: HomeCopy = {
  ...es,
  galleryTitle: "El vostre territori, tal com és",
  gallerySubtitle: "Cada fitxa pot portar les seves fotos: el visitant veu el lloc abans d'arribar-hi.",
  audience: "per a Oficines de Turisme",
  eyebrow: "Per a oficines de turisme",
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
    { title: "Obert 24 hores al dia", body: "A les set del vespre, en diumenge, a l'agost. Les preguntes arriben amb l'oficina tancada — i troben resposta igualment." },
    { title: "Missatge de benvinguda", body: "A qui escriu per primera vegada se l'acull, no se l'interroga. L'assistent es presenta i entén què necessita." },
    { title: "Fotos i vídeo, no només text", body: "Una cascada s'entén millor veient-la. Cada lloc pot portar amb ell les seves imatges i els seus vídeos." },
    { title: "Notificacions push", body: "La festa de dissabte, la carretera tallada, el concert a la plaça: només a qui hi ha donat el consentiment, revocable sempre." },
    { title: "A WhatsApp, no en una app", body: "Sense instal·lació, sense registre. L'aplicació que el turista ja té al mòbil." },
  ],
  contentTitle: "Tot el territori, en un sol lloc",
  contentBody1: "Un hotel nou, un horari que canvia, la festa de setembre: ho escriviu al tauler i l'assistent ho sap de seguida. Sense trucar a ningú.",
  contentBody2: "I respon només amb allò que heu carregat. Si una dada no hi és, ho diu: no se la inventa. Un nom, un número o un horari que no sigui a les vostres fitxes s'elimina de la resposta abans d'enviar-la.",
  contentTypes: ["Hotels i cases rurals", "Restaurants i agroturismes", "Rutes i refugis", "Festes i esdeveniments", "Productes típics", "Pobles i miradors", "Castells i esglésies", "Història local", "Telèfons útils"],
  pricingTitle: "Preus clars, sense sorpreses",
  pricingSub: "La quota cobreix el servei. El consum es paga a part, només quan es fa servir.",
  revenueEyebrow: "No només una despesa",
  revenueTitle: "Els negocis poden patrocinar-se al canal",
  revenueBody1: "L'hotel, el restaurant, el lloguer d'esquís: cadascun us pot comprar un missatge per als turistes que hi han donat el consentiment. Vosaltres veneu l'espai, el sistema porta el compte del que li queda a cadascun.",
  revenueBody2: "Per a moltes oficines de turisme és el que paga el servei — i després es converteix en un ingrés.",
  revenueSteps: [
    { t: "El negoci compra un paquet", d: "Deu, cinquanta, cent missatges. El preu el poseu vosaltres." },
    { t: "Prepara el seu missatge", d: "Text i foto de la seva oferta, que aproveu abans de l'enviament." },
    { t: "Només arriba a qui hi ha consentit", d: "I cada enviament es descompta del seu paquet, sense que hàgiu de comptar res." },
  ],
  closingTitle: "Cada dia, les mateixes",
  closingQuestions: ["Sóc celíac, on podem menjar?", "Quines excursions podem fer?", "Quins esdeveniments hi ha aquesta setmana?", "Quins són els plats típics?", "A quina hora tanquen els remuntadors?"],
  closingBody: "Al taulell i per telèfon, gairebé sempre amb cua esperant. A partir d'ara respon l'assistent — amb el que heu carregat, en la llengua de qui pregunta. Vosaltres quedeu per al que mereix una persona.",
  closingCta: "Accedeix al teu canal",
  footer: "eChatbot — assistència per WhatsApp per a oficines de turisme i consorcis.",
}

const fr: HomeCopy = {
  galleryTitle: "Votre territoire, tel qu'il est",
  gallerySubtitle: "Chaque fiche peut porter ses photos : le visiteur voit le lieu avant d'y arriver.",
  audience: "pour Offices de Tourisme",
  eyebrow: "Pour les offices de tourisme",
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
    { title: "Ouvert 24 heures sur 24", body: "À sept heures du soir, le dimanche, au mois d'août. Les questions arrivent quand l'office est fermé — et trouvent une réponse quand même." },
    { title: "Message de bienvenue", body: "Celui qui écrit pour la première fois est accueilli, pas interrogé. L'assistant se présente et comprend ce dont il a besoin." },
    { title: "Photos et vidéos, pas que du texte", body: "Une cascade se comprend mieux en la voyant. Chaque lieu peut porter ses images et ses vidéos." },
    { title: "Notifications push", body: "La fête de samedi, la route fermée, le concert sur la place : uniquement aux visiteurs qui ont donné leur accord, révocable à tout moment." },
    { title: "Sur WhatsApp, pas une application", body: "Aucune installation, aucune inscription. L'application que le touriste a déjà sur son téléphone." },
  ],
  contentTitle: "Tout le territoire, au même endroit",
  contentBody1: "Un nouvel hôtel, un horaire qui change, la fête de septembre : vous l'écrivez dans le panneau et l'assistant le sait aussitôt. Sans appeler personne.",
  contentBody2: "Et il ne répond qu'avec ce que vous avez saisi. Si une information manque, il le dit : il ne l'invente pas. Un nom, un numéro ou un horaire absent de vos fiches est retiré de la réponse avant l'envoi.",
  contentTypes: ["Hôtels et chambres d'hôtes", "Restaurants et fermes-auberges", "Randonnées et refuges", "Fêtes et événements", "Produits du terroir", "Villages et points de vue", "Châteaux et églises", "Histoire locale", "Numéros utiles"],
  pricingTitle: "Des prix clairs, sans surprise",
  pricingSub: "L'abonnement couvre le service. La consommation est facturée à part, uniquement à l'usage.",
  revenueEyebrow: "Le canal qui se rembourse",
  revenueTitle: "Les commerçants peuvent se sponsoriser sur le canal",
  revenueBody1: "L'hôtel, le restaurant, le loueur de skis : chacun peut vous acheter un message vers les visiteurs qui ont donné leur accord. Vous vendez l'espace, le système compte ce qu'il reste à chacun.",
  revenueBody2: "Pour beaucoup d'offices de tourisme, c'est ce qui paie le service — puis cela devient une recette.",
  revenueSteps: [
    { t: "Le commerçant achète un forfait", d: "Dix, cinquante, cent messages. C'est vous qui fixez le prix." },
    { t: "Il prépare son message", d: "Texte et photo de son offre, que vous validez avant l'envoi." },
    { t: "Il ne part qu'aux personnes consentantes", d: "Et chaque envoi est décompté de son forfait, sans rien à compter de votre côté." },
  ],
  closingTitle: "Chaque jour, les mêmes",
  closingQuestions: ["Je suis cœliaque, où peut-on manger ?", "Quelles randonnées peut-on faire ?", "Quels événements cette semaine ?", "Quels sont les plats typiques ?", "À quelle heure ferment les remontées ?"],
  closingBody: "Au guichet et au téléphone, le plus souvent avec la file qui attend. Désormais l'assistant répond pour vous — avec ce que vous avez saisi, dans la langue de celui qui demande. Vous restez pour ce qui mérite quelqu'un.",
  closingCta: "Connectez-vous à votre canal",
  footer: "eChatbot — assistance WhatsApp pour offices de tourisme et syndicats d'initiative.",
}

const de: HomeCopy = {
  galleryTitle: "Ihre Region, wie sie wirklich ist",
  gallerySubtitle: "Jeder Eintrag kann eigene Fotos mitbringen: Der Gast sieht den Ort, bevor er ankommt.",
  audience: "für Tourismusverbände",
  eyebrow: "Für Tourismusbüros",
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
    { title: "Rund um die Uhr geöffnet", body: "Um sieben Uhr abends, sonntags, mitten im August. Die Fragen kommen, wenn das Büro zu ist — und werden trotzdem beantwortet." },
    { title: "Willkommensnachricht", body: "Wer zum ersten Mal schreibt, wird begrüßt und nicht ausgefragt. Der Assistent stellt sich vor und versteht, was gebraucht wird." },
    { title: "Fotos und Videos, nicht nur Text", body: "Einen Wasserfall versteht man besser, wenn man ihn sieht. Jeder Ort kann seine Bilder und Videos mitbringen." },
    { title: "Push-Benachrichtigungen", body: "Das Fest am Samstag, die gesperrte Straße, das Konzert am Platz: nur an Gäste mit Einwilligung, jederzeit widerrufbar." },
    { title: "Auf WhatsApp, keine App", body: "Keine Installation, keine Registrierung. Die App, die der Gast ohnehin auf dem Handy hat." },
  ],
  contentTitle: "Die ganze Region, an einem Ort",
  contentBody1: "Ein neues Hotel, eine geänderte Öffnungszeit, das Fest im September: Sie tragen es im Panel ein, und der Assistent weiß es sofort. Ohne jemanden anzurufen.",
  contentBody2: "Und er antwortet nur mit dem, was Sie hinterlegt haben. Fehlt eine Angabe, sagt er das — er erfindet sie nicht. Ein Name, eine Nummer oder eine Uhrzeit, die nicht in Ihren Daten steht, wird aus der Antwort entfernt, bevor sie rausgeht.",
  contentTypes: ["Hotels und Pensionen", "Restaurants und Almhütten", "Wanderungen und Schutzhütten", "Feste und Veranstaltungen", "Regionale Produkte", "Dörfer und Aussichtspunkte", "Burgen und Kirchen", "Ortsgeschichte", "Wichtige Nummern"],
  pricingTitle: "Klare Preise, keine Überraschungen",
  pricingSub: "Die Gebühr deckt den Dienst. Der Verbrauch wird getrennt abgerechnet, nur bei Nutzung.",
  revenueEyebrow: "Der Kanal, der sich selbst trägt",
  revenueTitle: "Betriebe können sich auf dem Kanal präsentieren",
  revenueBody1: "Das Hotel, das Restaurant, der Skiverleih: Jeder kann bei Ihnen eine Nachricht an Gäste mit Einwilligung kaufen. Sie verkaufen den Platz, das System zählt mit, was jedem noch bleibt.",
  revenueBody2: "Für viele Tourismusbüros trägt das die Kosten des Dienstes — und wird dann zur Einnahme.",
  revenueSteps: [
    { t: "Der Betrieb kauft ein Paket", d: "Zehn, fünfzig, hundert Nachrichten. Den Preis bestimmen Sie." },
    { t: "Er bereitet seine Nachricht vor", d: "Text und Foto seines Angebots, das Sie vor dem Versand freigeben." },
    { t: "Sie geht nur an Einwilligende", d: "Und jeder Versand wird von seinem Paket abgezogen, ohne dass Sie zählen müssen." },
  ],
  closingTitle: "Jeden Tag dieselben",
  closingQuestions: ["Ich bin Zöliakiebetroffener, wo können wir essen?", "Welche Wanderungen gibt es?", "Was ist diese Woche los?", "Was sind die typischen Gerichte?", "Wann schließen die Lifte?"],
  closingBody: "Am Schalter und am Telefon, meist mit wartender Schlange. Ab jetzt antwortet der Assistent für Sie — mit dem, was Sie eingetragen haben, in der Sprache des Gastes. Sie bleiben für das, was einen Menschen verdient.",
  closingCta: "Zu Ihrem Kanal anmelden",
  footer: "eChatbot — WhatsApp-Assistenz für Tourismusverbände und Tourismusbüros.",
}

const COPY: Record<HomeLang, HomeCopy> = { it, en, es, de, fr, ca }

/** Italian is the fallback: this product is sold in Italy first. */
export function homeCopy(lang: string | undefined): HomeCopy {
  return COPY[(lang as HomeLang) ?? "it"] ?? it
}
