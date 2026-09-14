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
  chipNoApp: string
  loginTitle: string
  loginSub: string
  email: string
  password: string
  loginCta: string
  loginLoading: string
  forgot: string
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
  closingTitle: string
  closingBody: string
  closingCta: string
  footer: string
}

const it: HomeCopy = {
  audience: "per Pro Loco e Consorzi",
  eyebrow: "Per gli uffici turistici",
  slogan1: "Il vostro territorio risponde",
  slogan2: "su WhatsApp",
  lede: "Un assistente che conosce i vostri hotel, i sentieri, le sagre e i numeri utili — e li racconta a ogni ospite nella sua lingua, a qualsiasi ora.",
  chipMulti: "Multilingua",
  chip24: "24 ore su 24",
  chipNoApp: "Nessuna app da installare",
  loginTitle: "Accedi al tuo canale",
  loginSub: "Gestisci contenuti, notifiche e conversazioni.",
  email: "Email",
  password: "Password",
  loginCta: "Accedi",
  loginLoading: "Accesso in corso...",
  forgot: "Password dimenticata?",
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
  contentBody1: "Inserite i contenuti dal pannello, come compilereste una scheda. L'assistente li usa dal momento in cui li salvate — nessuna configurazione, nessun tecnico da chiamare.",
  contentBody2: "Scrivete nella vostra lingua: le traduzioni arrivano da sole, e restano allineate ogni volta che cambiate una riga.",
  contentTypes: ["Hotel e B&B", "Ristoranti e agriturismi", "Escursioni e rifugi", "Sagre ed eventi", "Prodotti tipici", "Borghi e punti panoramici", "Castelli e chiese", "Cenni storici", "Numeri utili"],
  pricingTitle: "Tre piani, nessuna sorpresa",
  pricingSub: "Il canone copre il servizio. I consumi si pagano a parte, solo quando li usate.",
  revenueEyebrow: "Non solo un costo",
  revenueTitle: "Gli esercenti pagano per farsi conoscere",
  revenueBody1: "L'albergo, il ristorante, il noleggio sci: ognuno può comprare da voi un messaggio ai turisti che hanno dato il consenso. Voi vendete lo spazio, il sistema tiene il conto dei messaggi rimasti a ciascuno.",
  revenueBody2: "Per molti uffici turistici è la voce che ripaga il servizio — e poi diventa un'entrata.",
  revenueSteps: [
    { t: "L'esercente compra un pacchetto", d: "Dieci, cinquanta, cento messaggi. Decidete voi il prezzo." },
    { t: "Prepara il suo messaggio", d: "Testo e foto della sua offerta, che approvate prima dell'invio." },
    { t: "Parte solo a chi ha acconsentito", d: "E ogni invio scala dal suo pacchetto, senza che dobbiate contare nulla." },
  ],
  closingTitle: "Il turista ha già WhatsApp",
  closingBody: "Nessuna app da far scaricare, nessun account da creare. Scrive come scriverebbe a un amico, e trova qualcuno che conosce il posto.",
  closingCta: "Accedi al tuo canale",
  footer: "eChatbot — assistenza su WhatsApp per Pro Loco e Consorzi turistici.",
}

const en: HomeCopy = {
  audience: "for Tourist Offices",
  eyebrow: "For tourist information offices",
  slogan1: "Your region answers",
  slogan2: "on WhatsApp",
  lede: "An assistant that knows your hotels, trails, festivals and useful numbers — and tells every visitor about them in their own language, at any hour.",
  chipMulti: "Every language",
  chip24: "24 hours a day",
  chipNoApp: "No app to install",
  loginTitle: "Sign in to your channel",
  loginSub: "Manage content, notifications and conversations.",
  email: "Email",
  password: "Password",
  loginCta: "Sign in",
  loginLoading: "Signing in...",
  forgot: "Forgot your password?",
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
  contentBody1: "Add content from the panel, like filling in a form. The assistant uses it the moment you save — no configuration, no technician to call.",
  contentBody2: "Write in your own language: translations follow by themselves, and stay in step every time you change a line.",
  contentTypes: ["Hotels and B&Bs", "Restaurants and farm stays", "Hikes and mountain huts", "Festivals and events", "Local produce", "Villages and viewpoints", "Castles and churches", "Local history", "Useful numbers"],
  pricingTitle: "Three plans, no surprises",
  pricingSub: "The subscription covers the service. Usage is billed separately, only when you use it.",
  revenueEyebrow: "Not only a cost",
  revenueTitle: "Local businesses pay to be seen",
  revenueBody1: "The hotel, the restaurant, the ski rental: each can buy a message to visitors who opted in. You sell the space, the system keeps count of what each has left.",
  revenueBody2: "For many tourist offices this is what pays for the service — and then becomes income.",
  revenueSteps: [
    { t: "The business buys a bundle", d: "Ten, fifty, a hundred messages. You set the price." },
    { t: "They prepare their message", d: "Text and a photo of their offer, which you approve before it goes out." },
    { t: "It only reaches those who opted in", d: "And each send comes off their bundle, with nothing for you to count." },
  ],
  closingTitle: "Visitors already have WhatsApp",
  closingBody: "No app to download, no account to create. They write as they would to a friend, and find someone who knows the place.",
  closingCta: "Sign in to your channel",
  footer: "eChatbot — WhatsApp assistance for tourist offices and visitor centres.",
}

const es: HomeCopy = {
  audience: "para Oficinas de Turismo",
  eyebrow: "Para oficinas de turismo",
  slogan1: "Vuestro territorio responde",
  slogan2: "por WhatsApp",
  lede: "Un asistente que conoce vuestros hoteles, senderos, fiestas y teléfonos útiles — y se lo cuenta a cada visitante en su idioma, a cualquier hora.",
  chipMulti: "Todos los idiomas",
  chip24: "24 horas al día",
  chipNoApp: "Sin app que instalar",
  loginTitle: "Accede a tu canal",
  loginSub: "Gestiona contenidos, notificaciones y conversaciones.",
  email: "Email",
  password: "Contraseña",
  loginCta: "Acceder",
  loginLoading: "Accediendo...",
  forgot: "¿Has olvidado la contraseña?",
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
  contentBody1: "Añadid los contenidos desde el panel, como rellenaríais una ficha. El asistente los usa desde el momento en que los guardáis — sin configuración, sin llamar a ningún técnico.",
  contentBody2: "Escribid en vuestro idioma: las traducciones llegan solas y se mantienen al día cada vez que cambiáis una línea.",
  contentTypes: ["Hoteles y casas rurales", "Restaurantes y agroturismos", "Rutas y refugios", "Fiestas y eventos", "Productos típicos", "Pueblos y miradores", "Castillos e iglesias", "Historia local", "Teléfonos útiles"],
  pricingTitle: "Tres planes, sin sorpresas",
  pricingSub: "La cuota cubre el servicio. El consumo se paga aparte, solo cuando se usa.",
  revenueEyebrow: "No solo un gasto",
  revenueTitle: "Los negocios pagan por darse a conocer",
  revenueBody1: "El hotel, el restaurante, el alquiler de esquís: cada uno puede compraros un mensaje para los turistas que dieron su consentimiento. Vosotros vendéis el espacio, el sistema lleva la cuenta de lo que le queda a cada uno.",
  revenueBody2: "Para muchas oficinas de turismo es lo que paga el servicio — y después se convierte en un ingreso.",
  revenueSteps: [
    { t: "El negocio compra un paquete", d: "Diez, cincuenta, cien mensajes. El precio lo ponéis vosotros." },
    { t: "Prepara su mensaje", d: "Texto y foto de su oferta, que aprobáis antes del envío." },
    { t: "Solo llega a quien dio su consentimiento", d: "Y cada envío se descuenta de su paquete, sin que tengáis que contar nada." },
  ],
  closingTitle: "El turista ya tiene WhatsApp",
  closingBody: "Ninguna app que descargar, ninguna cuenta que crear. Escribe como le escribiría a un amigo, y encuentra a alguien que conoce el sitio.",
  closingCta: "Accede a tu canal",
  footer: "eChatbot — asistencia por WhatsApp para oficinas de turismo y patronatos.",
}

const ca: HomeCopy = {
  ...es,
  audience: "per a Oficines de Turisme",
  eyebrow: "Per a oficines de turisme",
  slogan1: "El vostre territori respon",
  slogan2: "per WhatsApp",
  lede: "Un assistent que coneix els vostres hotels, camins, festes i telèfons útils — i ho explica a cada visitant en la seva llengua, a qualsevol hora.",
  chipMulti: "Totes les llengües",
  chip24: "24 hores al dia",
  chipNoApp: "Sense cap app per instal·lar",
  loginTitle: "Accedeix al teu canal",
  loginSub: "Gestiona continguts, notificacions i converses.",
  password: "Contrasenya",
  loginCta: "Accedeix",
  loginLoading: "Accedint...",
  forgot: "Has oblidat la contrasenya?",
  errBadCredentials: "Correu o contrasenya incorrectes.",
  errGeneric: "No s'ha pogut accedir. Torna-ho a provar d'aquí a una estona.",
  benefitsTitle: "Què canvia per als vostres visitants",
  benefitsSub: "I per a qui respon cada dia les mateixes preguntes a l'oficina.",
  contentTitle: "Tot el territori, en un sol lloc",
  pricingTitle: "Tres plans, sense sorpreses",
  revenueTitle: "Els negocis paguen per donar-se a conèixer",
  closingTitle: "El turista ja té WhatsApp",
  closingCta: "Accedeix al teu canal",
  footer: "eChatbot — assistència per WhatsApp per a oficines de turisme i consorcis.",
}

const fr: HomeCopy = {
  audience: "pour Offices de Tourisme",
  eyebrow: "Pour les offices de tourisme",
  slogan1: "Votre territoire répond",
  slogan2: "sur WhatsApp",
  lede: "Un assistant qui connaît vos hôtels, vos sentiers, vos fêtes et vos numéros utiles — et les raconte à chaque visiteur dans sa langue, à toute heure.",
  chipMulti: "Toutes les langues",
  chip24: "24 heures sur 24",
  chipNoApp: "Aucune application à installer",
  loginTitle: "Connectez-vous à votre canal",
  loginSub: "Gérez contenus, notifications et conversations.",
  email: "Email",
  password: "Mot de passe",
  loginCta: "Se connecter",
  loginLoading: "Connexion...",
  forgot: "Mot de passe oublié ?",
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
  contentBody1: "Saisissez les contenus depuis le panneau, comme vous rempliriez une fiche. L'assistant les utilise dès que vous enregistrez — aucune configuration, aucun technicien à appeler.",
  contentBody2: "Écrivez dans votre langue : les traductions suivent toutes seules et restent à jour à chaque modification.",
  contentTypes: ["Hôtels et chambres d'hôtes", "Restaurants et fermes-auberges", "Randonnées et refuges", "Fêtes et événements", "Produits du terroir", "Villages et points de vue", "Châteaux et églises", "Histoire locale", "Numéros utiles"],
  pricingTitle: "Trois formules, sans surprise",
  pricingSub: "L'abonnement couvre le service. La consommation est facturée à part, uniquement à l'usage.",
  revenueEyebrow: "Pas seulement une dépense",
  revenueTitle: "Les commerçants paient pour se faire connaître",
  revenueBody1: "L'hôtel, le restaurant, le loueur de skis : chacun peut vous acheter un message vers les visiteurs qui ont donné leur accord. Vous vendez l'espace, le système compte ce qu'il reste à chacun.",
  revenueBody2: "Pour beaucoup d'offices de tourisme, c'est ce qui paie le service — puis cela devient une recette.",
  revenueSteps: [
    { t: "Le commerçant achète un forfait", d: "Dix, cinquante, cent messages. C'est vous qui fixez le prix." },
    { t: "Il prépare son message", d: "Texte et photo de son offre, que vous validez avant l'envoi." },
    { t: "Il ne part qu'aux personnes consentantes", d: "Et chaque envoi est décompté de son forfait, sans rien à compter de votre côté." },
  ],
  closingTitle: "Le touriste a déjà WhatsApp",
  closingBody: "Aucune application à télécharger, aucun compte à créer. Il écrit comme il écrirait à un ami, et trouve quelqu'un qui connaît l'endroit.",
  closingCta: "Connectez-vous à votre canal",
  footer: "eChatbot — assistance WhatsApp pour offices de tourisme et syndicats d'initiative.",
}

const de: HomeCopy = {
  audience: "für Tourismusverbände",
  eyebrow: "Für Tourismusbüros",
  slogan1: "Ihre Region antwortet",
  slogan2: "auf WhatsApp",
  lede: "Ein Assistent, der Ihre Hotels, Wege, Feste und wichtigen Nummern kennt — und sie jedem Gast in seiner Sprache erzählt, zu jeder Uhrzeit.",
  chipMulti: "Jede Sprache",
  chip24: "Rund um die Uhr",
  chipNoApp: "Keine App nötig",
  loginTitle: "Zu Ihrem Kanal anmelden",
  loginSub: "Inhalte, Benachrichtigungen und Gespräche verwalten.",
  email: "E-Mail",
  password: "Passwort",
  loginCta: "Anmelden",
  loginLoading: "Anmeldung läuft...",
  forgot: "Passwort vergessen?",
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
  contentBody1: "Inhalte im Panel eintragen, wie beim Ausfüllen eines Formulars. Der Assistent nutzt sie ab dem Moment des Speicherns — keine Konfiguration, kein Techniker.",
  contentBody2: "Schreiben Sie in Ihrer Sprache: Die Übersetzungen kommen von selbst und bleiben bei jeder Änderung aktuell.",
  contentTypes: ["Hotels und Pensionen", "Restaurants und Almhütten", "Wanderungen und Schutzhütten", "Feste und Veranstaltungen", "Regionale Produkte", "Dörfer und Aussichtspunkte", "Burgen und Kirchen", "Ortsgeschichte", "Wichtige Nummern"],
  pricingTitle: "Drei Tarife, keine Überraschungen",
  pricingSub: "Die Gebühr deckt den Dienst. Der Verbrauch wird getrennt abgerechnet, nur bei Nutzung.",
  revenueEyebrow: "Nicht nur eine Ausgabe",
  revenueTitle: "Betriebe zahlen dafür, sichtbar zu sein",
  revenueBody1: "Das Hotel, das Restaurant, der Skiverleih: Jeder kann bei Ihnen eine Nachricht an Gäste mit Einwilligung kaufen. Sie verkaufen den Platz, das System zählt mit, was jedem noch bleibt.",
  revenueBody2: "Für viele Tourismusbüros trägt das die Kosten des Dienstes — und wird dann zur Einnahme.",
  revenueSteps: [
    { t: "Der Betrieb kauft ein Paket", d: "Zehn, fünfzig, hundert Nachrichten. Den Preis bestimmen Sie." },
    { t: "Er bereitet seine Nachricht vor", d: "Text und Foto seines Angebots, das Sie vor dem Versand freigeben." },
    { t: "Sie geht nur an Einwilligende", d: "Und jeder Versand wird von seinem Paket abgezogen, ohne dass Sie zählen müssen." },
  ],
  closingTitle: "Der Gast hat WhatsApp längst",
  closingBody: "Keine App zum Herunterladen, kein Konto zum Anlegen. Er schreibt wie einem Freund — und trifft jemanden, der den Ort kennt.",
  closingCta: "Zu Ihrem Kanal anmelden",
  footer: "eChatbot — WhatsApp-Assistenz für Tourismusverbände und Tourismusbüros.",
}

const COPY: Record<HomeLang, HomeCopy> = { it, en, es, de, fr, ca }

/** Italian is the fallback: this product is sold in Italy first. */
export function homeCopy(lang: string | undefined): HomeCopy {
  return COPY[(lang as HomeLang) ?? "it"] ?? it
}
