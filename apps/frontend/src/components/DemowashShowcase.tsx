// ----------------------------------------------------------------------------
// DemowashShowcase — animated, tabbed WhatsApp demo widget.
//
// Shared by the laundry franchising landing hero (LaundryServicePage.tsx) and
// the DemoWash welcome popup (AboutDemowashPopup in PlaygroundPage.tsx) so the
// two stay pixel-identical (Andrea: "deve essere uguale alla popup").
//
// Each tab is a short, scripted, self-playing conversation that demonstrates
// ONE capability inside a real laundry scenario. The customer writes FIRST
// (real WhatsApp pattern) — EXCEPT the "Promo Push" tab, which is a business
// initiated marketing campaign, so the bot writes first by design.
//
// LANGUAGE: fully translated to the public-site languages (it / en / es / de),
// driven by the `lang` prop. Unsupported codes (fr / ca) fall back to Spanish.
// The Arabic tab keeps its Arabic bubbles in every language (it is the live
// proof that the bot speaks Arabic + RTL); only its labels/captions translate.
// ----------------------------------------------------------------------------
import { useEffect, useMemo, useRef, useState } from "react"

type Lang = "it" | "en" | "es" | "de"
const norm = (l: string): Lang =>
  (["it", "en", "es", "de"].includes(l) ? l : "es") as Lang

// --- static HTML snippet builders (rendered as-is) -------------------------
const time = (t: string) => `<span class="dws-t">${t}</span>`
const ytCard = (title: string) =>
  `<div class="dws-yt"><div class="dws-yt-thumb"><div class="dws-yt-play">▶</div><span class="dws-yt-dur">2:14</span></div><div class="dws-yt-meta"><div class="dws-yt-title">${title}</div><div class="dws-yt-host">YouTube · youtube.com</div></div></div>`
const voice = (d: string) =>
  `<div class="dws-voice"><div class="dws-pp">▶</div><div class="dws-wave"></div><span class="dws-vt">${d}</span></div>`
const fileCard = (n: string, k: string) =>
  `<div class="dws-file"><div class="dws-file-ic">PDF</div><div><div class="dws-file-n">${n}</div><div class="dws-file-s">${k}</div></div></div>`
const arabic = (t: string) => `<span dir="rtl" class="dws-ar">${t}</span>`

type Step = {
  w: "in" | "out" | "op" | "psys" | "psysblue"
  h: string
  pre?: number
  ty?: number
  hold?: number
  rec?: boolean
  name?: string
  cp?: number
}
type Cap = [string, string, string]
type Scene = { id: string; label: string; sub?: string; caps: Cap[]; s: Step[] }

// Per-language UI labels.
const TRY: Record<Lang, string> = {
  es: "Pruébalo ahora →",
  it: "Provalo ora →",
  en: "Try it now →",
  de: "Jetzt ausprobieren →",
}
const ONLINE: Record<Lang, string> = { es: "en línea", it: "online", en: "online", de: "online" }
const TYPING: Record<Lang, string> = { es: "escribiendo…", it: "sta scrivendo…", en: "typing…", de: "schreibt…" }
const RECORDING: Record<Lang, string> = { es: "grabando audio…", it: "registra audio…", en: "recording…", de: "nimmt Audio auf…" }
const TODAY: Record<Lang, string> = { es: "Hoy", it: "Oggi", en: "Today", de: "Heute" }

// Builds the laundry scenario list translated into `lang`. One source of
// truth: every string carries its 4 translations inline via L().
function buildLaundryScenes(lang: Lang): Scene[] {
  const L = (es: string, it: string, en: string, de: string) =>
    ({ es, it, en, de }[lang] ?? es)

  return [
    {
      id: "welcome",
      label: "👋 " + L("Bienvenida", "Benvenuto", "Welcome", "Willkommen"),
      sub: L("Recibe a cada cliente nuevo y lo guía al instante", "Accoglie ogni nuovo cliente e lo guida da subito", "Greets every new customer and guides them instantly", "Begrüßt jeden neuen Kunden und führt ihn sofort"),
      caps: [
        ["👋", L("Saludo automático", "Saluto automatico", "Auto greeting", "Automatische Begrüßung"), L("Recibe a cada cliente.", "Accoglie ogni cliente.", "Greets every customer.", "Begrüßt jeden Kunden.")],
        ["🎬", L("Vídeo de presentación", "Video di presentazione", "Intro video", "Vorstellungsvideo"), L("Directo en el chat.", "Direttamente in chat.", "Right in the chat.", "Direkt im Chat.")],
        ["🚀", L("Guía a la acción", "Guida all'azione", "Drives to action", "Führt zur Aktion"), L("Lleva al siguiente paso.", "Porta al passo dopo.", "To the next step.", "Zum nächsten Schritt.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1000, h: L("Hola 👋 Me interesa abrir una lavandería en franquicia", "Ciao 👋 Vorrei aprire una lavanderia in franchising", "Hi 👋 I'd like to open a laundry franchise", "Hallo 👋 Ich möchte einen Waschsalon als Franchise eröffnen") + time("12:53") },
        { w: "in", cp: 0, ty: 1000, h: L("¡Hola! 👋 Soy el asistente de Demowash 😊", "Ciao! 👋 Sono l'assistente di Demowash 😊", "Hi! 👋 I'm the Demowash assistant 😊", "Hallo! 👋 Ich bin der Demowash-Assistent 😊") + time("12:53") },
        { w: "in", cp: 1, ty: 800, h: L("Te dejo una breve presentación 👇", "Ti lascio una breve presentazione 👇", "Here's a quick intro 👇", "Hier eine kurze Vorstellung 👇") + time("12:53") },
        { w: "in", cp: 1, ty: 1100, h: ytCard(L("Demowash · Franquicia", "Demowash · Franchising", "Demowash · Franchise", "Demowash · Franchise")) + time("12:54") },
        { w: "in", cp: 2, ty: 1100, h: L("¿Quieres una consultoría gratuita? 🚀", "Vuoi una consulenza gratuita? 🚀", "Want a free consultation? 🚀", "Möchtest du eine kostenlose Beratung? 🚀") + time("12:54") },
      ],
    },
    {
      id: "cita",
      label: "🗓️ " + L("Pedir cita", "Prenota", "Book a call", "Termin buchen"),
      sub: L("Agenda una consultoría de franquicia sin operadores", "Prenota una consulenza di franchising senza operatori", "Books a franchise consultation with no operators", "Bucht eine Franchise-Beratung ganz ohne Mitarbeiter"),
      caps: [
        ["🗓️", L("Agenda citas solo", "Prenota da solo", "Books on its own", "Bucht selbstständig"), L("Sin operador.", "Senza operatore.", "No operator.", "Ohne Mitarbeiter.")],
        ["📝", L("Recoge los datos", "Raccoglie i dati", "Collects the data", "Erfasst die Daten"), L("Nombre, email, ciudad.", "Nome, email, città.", "Name, email, city.", "Name, E-Mail, Stadt.")],
        ["📅", L("Conectado al calendario", "Collegato al calendario", "Calendar-connected", "Mit Kalender verbunden"), L("Crea el evento.", "Crea l'evento.", "Creates the event.", "Erstellt den Termin.")],
        ["🔗", L("Envía Zoom + email", "Invia Zoom + email", "Sends Zoom + email", "Sendet Zoom + E-Mail"), L("Confirmación auto.", "Conferma automatica.", "Auto confirmation.", "Auto-Bestätigung.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1100, h: L("Me gustaría abrir una lavandería en Sitges. ¿Tenéis franquicia?", "Vorrei aprire una lavanderia a Sitges. Avete il franchising?", "I'd like to open a laundry in Sitges. Do you offer a franchise?", "Ich möchte einen Waschsalon in Sitges eröffnen. Bietet ihr Franchise an?") + time("12:53") },
        { w: "in", cp: 0, ty: 1100, h: L("¡Claro! Ofrecemos una consultoría gratuita. ¿La agendamos?", "Certo! Offriamo una consulenza gratuita. La prenotiamo?", "Of course! We offer a free consultation. Shall we book it?", "Klar! Wir bieten eine kostenlose Beratung an. Sollen wir einen Termin vereinbaren?") + time("12:54") },
        { w: "out", cp: 1, ty: 500, h: L("Sí, perfecto", "Sì, volentieri", "Yes, please", "Ja, gerne") + time("12:54") },
        { w: "in", cp: 1, ty: 700, h: L("Genial. ¿Cómo te llamas?", "Perfetto. Come ti chiami?", "Great. What's your name?", "Super. Wie heißt du?") + time("12:54") },
        { w: "out", cp: 1, ty: 700, h: "Marco Rossi" + time("12:54") },
        { w: "in", cp: 1, ty: 700, h: L("¿Cuál es tu email?", "Qual è la tua email?", "What's your email?", "Wie lautet deine E-Mail?") + time("12:54") },
        { w: "out", cp: 1, ty: 800, h: "marco.rossi@email.com" + time("12:54") },
        { w: "in", cp: 1, ty: 700, h: L("¿En qué ciudad quieres abrir?", "In quale città vuoi aprire?", "Which city do you want to open in?", "In welcher Stadt möchtest du eröffnen?") + time("12:54") },
        { w: "out", cp: 1, ty: 500, h: "Sitges" + time("12:54") },
        { w: "in", cp: 2, ty: 1300, h: L("Estos son los horarios disponibles: 1) Lun 10:00 · 2) Lun 15:00 · 3) Mar 11:00. ¿Cuál prefieres? (1/2/3)", "Ecco gli orari disponibili: 1) Lun 10:00 · 2) Lun 15:00 · 3) Mar 11:00. Quale preferisci? (1/2/3)", "Here are the available slots: 1) Mon 10:00 · 2) Mon 15:00 · 3) Tue 11:00. Which do you prefer? (1/2/3)", "Hier die verfügbaren Termine: 1) Mo 10:00 · 2) Mo 15:00 · 3) Di 11:00. Welcher passt dir? (1/2/3)") + time("12:54") },
        { w: "out", cp: 2, ty: 500, h: "3" + time("12:55") },
        { w: "psys", cp: 2, hold: 1500, h: L("Creando la cita…", "Sto creando l'appuntamento…", "Creating the appointment…", "Termin wird erstellt…") },
        { w: "in", cp: 3, ty: 1300, h: L("✅ ¡Cita confirmada! Mar 11 jun · 11:00. Zoom + calendario por email 👋", "✅ Appuntamento confermato! Mar 11 giu · 11:00. Zoom + calendario via email 👋", "✅ Booked! Tue Jun 11 · 11:00. Zoom + calendar by email 👋", "✅ Termin bestätigt! Di 11. Juni · 11:00. Zoom + Kalender per E-Mail 👋") + time("12:55") },
      ],
    },
    {
      id: "machine",
      label: "🔌 " + L("Desbloqueo", "Sblocco", "Unlock", "Entsperrung"),
      sub: L("Se conecta a la máquina y la desbloquea en remoto", "Si collega alla macchina e la sblocca da remoto", "Connects to the machine and unlocks it remotely", "Verbindet sich mit der Maschine und entsperrt sie aus der Ferne"),
      caps: [
        ["💬", L("Entiende el problema", "Capisce il problema", "Understands the issue", "Versteht das Problem"), L("Como habla el cliente.", "Come parla il cliente.", "As the customer speaks.", "So wie der Kunde spricht.")],
        ["📍", L("Encuentra la sede", "Trova la sede", "Finds the location", "Findet den Standort"), L("Conoce los locales.", "Conosce i locali.", "Knows every store.", "Kennt alle Filialen.")],
        ["🔌", L("Se conecta a la máquina", "Si collega alla macchina", "Connects to the machine", "Verbindet sich mit der Maschine"), L("Comandos en remoto.", "Comandi da remoto.", "Remote commands.", "Fernbefehle.")],
        ["✅", L("Resuelve solo, 24/7", "Risolve da solo, 24/7", "Solves alone, 24/7", "Löst es allein, 24/7"), L("Sin operadores.", "Senza operatori.", "No operators.", "Ohne Mitarbeiter.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 900, h: L("No consigo abrir la lavadora 😟", "Non riesco ad aprire la lavatrice 😟", "I can't open the washer 😟", "Ich kann die Waschmaschine nicht öffnen 😟") + time("18:02") },
        { w: "in", cp: 1, ty: 1000, h: L("¡Vaya! ¿En qué lavandería te encuentras?", "Mi dispiace! In quale lavanderia ti trovi?", "Oh no! Which laundromat are you at?", "Oh nein! In welchem Waschsalon bist du?") + time("18:02") },
        { w: "out", cp: 1, ty: 600, h: "Barcelona" + time("18:03") },
        { w: "in", cp: 1, ty: 1100, h: L("Tenemos dos en Barcelona: 📍 Eixample y 📍 Gràcia. ¿En cuál estás?", "Ne abbiamo due a Barcellona: 📍 Eixample e 📍 Gràcia. In quale ti trovi?", "We have two in Barcelona: 📍 Eixample and 📍 Gràcia. Which one?", "Wir haben zwei in Barcelona: 📍 Eixample und 📍 Gràcia. In welchem bist du?") + time("18:03") },
        { w: "out", cp: 1, ty: 500, h: "Eixample" + time("18:03") },
        { w: "in", cp: 2, ty: 900, h: L("¿Qué número de máquina es?", "Qual è il numero della macchina?", "Which machine number is it?", "Welche Maschinennummer ist es?") + time("18:03") },
        { w: "out", cp: 2, ty: 900, h: L("La número 4, ha terminado pero no se abre", "La numero 4, ha finito ma non si apre", "Number 4, it's finished but won't open", "Die Nummer 4, sie ist fertig, aber öffnet nicht") + time("18:04") },
        { w: "in", cp: 2, ty: 900, h: L("Me conecto a la máquina #4… 🔌", "Mi collego alla macchina #4… 🔌", "Connecting to machine #4… 🔌", "Ich verbinde mich mit Maschine #4… 🔌") + time("18:04") },
        { w: "psys", cp: 2, hold: 1500, h: L("Comando de desbloqueo enviado", "Comando di sblocco inviato", "Unlock command sent", "Entsperrbefehl gesendet") },
        { w: "in", cp: 3, ty: 1000, h: L("✅ ¡Máquina #4 desbloqueada! 👕", "✅ Macchina #4 sbloccata! 👕", "✅ Machine #4 unlocked! 👕", "✅ Maschine #4 entsperrt! 👕") + time("18:04") },
        { w: "out", cp: 3, ty: 600, h: L("¡Gracias! 🙏", "Grazie! 🙏", "Thanks! 🙏", "Danke! 🙏") + time("18:05") },
      ],
    },
    {
      id: "human",
      label: "🙋 " + L("Soporte humano", "Supporto umano", "Human support", "Menschlicher Support"),
      sub: L("Cuando hace falta, un operador toma el control", "Quando serve, un operatore prende il controllo", "When needed, a human operator takes over", "Wenn nötig, übernimmt ein Mitarbeiter die Kontrolle"),
      caps: [
        ["🧠", L("Detecta el caso", "Rileva il caso", "Spots the case", "Erkennt den Fall"), L("Sabe cuándo no basta.", "Sa quando non basta.", "Knows when it's not enough.", "Weiß, wann es nicht reicht.")],
        ["🙋", L("Avisa al operador", "Avvisa l'operatore", "Alerts an operator", "Benachrichtigt den Mitarbeiter"), L("Al instante.", "All'istante.", "Instantly.", "Sofort.")],
        ["👩‍💼", L("Toma el control", "Prende il controllo", "Takes over", "Übernimmt die Kontrolle"), L("Pausa el bot.", "Mette in pausa il bot.", "Pauses the bot.", "Pausiert den Bot.")],
        ["🤝", L("Continuidad total", "Continuità totale", "Seamless handover", "Nahtlose Übergabe"), L("El cliente ni lo nota.", "Il cliente non se ne accorge.", "The customer never notices.", "Der Kunde merkt nichts.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1100, h: L("Me habéis cobrado dos veces en la tarjeta 😟", "Mi avete addebitato due volte sulla carta 😟", "I've been charged twice on my card 😟", "Mir wurde zweimal von der Karte abgebucht 😟") + time("19:05") },
        { w: "in", cp: 0, ty: 1000, h: L("¡Lo siento! Paso tu caso a un operador para revisar el doble cobro.", "Mi dispiace! Passo il tuo caso a un operatore per verificare il doppio addebito.", "So sorry! I'll pass your case to an operator to check the double charge.", "Tut mir leid! Ich gebe deinen Fall an einen Mitarbeiter weiter, um die doppelte Abbuchung zu prüfen.") + time("19:05") },
        { w: "psysblue", cp: 1, hold: 1500, h: L("Un operador se está conectando…", "Un operatore si sta collegando…", "An operator is connecting…", "Ein Mitarbeiter verbindet sich…") },
        { w: "op", cp: 2, ty: 1100, name: L("Giulia · Operadora", "Giulia · Operatrice", "Giulia · Operator", "Giulia · Mitarbeiterin"), h: L("Soy Giulia, de Eixample 😊", "Sono Giulia, di Eixample 😊", "I'm Giulia, from Eixample 😊", "Ich bin Giulia, aus Eixample 😊") + time("19:06") },
        { w: "op", cp: 3, ty: 1300, h: L("Lo he verificado: te devuelvo el cobro duplicado, lo verás en 3-5 días. ¿Todo bien?", "Verificato: ti rimborso l'addebito doppio, lo vedrai in 3-5 giorni. Tutto ok?", "Checked it: I'll refund the duplicate charge, you'll see it in 3-5 days. All good?", "Geprüft: Ich erstatte dir die doppelte Abbuchung, du siehst sie in 3-5 Tagen. Alles gut?") + time("19:06") },
        { w: "out", cp: 3, ty: 600, h: L("¡Gracias!", "Grazie!", "Thanks!", "Danke!") + time("19:07") },
      ],
    },
    {
      id: "invoice",
      label: "🧾 " + L("Factura", "Fattura", "Invoice", "Rechnung"),
      sub: L("Encuentra el pedido y envía la factura por WhatsApp", "Trova l'ordine e invia la fattura su WhatsApp", "Finds the order and sends the invoice on WhatsApp", "Findet die Bestellung und sendet die Rechnung per WhatsApp"),
      caps: [
        ["💬", L("Entiende la petición", "Capisce la richiesta", "Understands the ask", "Versteht die Anfrage"), L("Solo hay que pedirla.", "Basta chiederla.", "Just ask for it.", "Einfach danach fragen.")],
        ["🔎", L("Encuentra el pedido", "Trova l'ordine", "Finds the order", "Findet die Bestellung"), L("En el sistema.", "Nel gestionale.", "In the system.", "Im System.")],
        ["📄", L("Envía el PDF", "Invia il PDF", "Sends the PDF", "Sendet das PDF"), L("Por WhatsApp.", "Su WhatsApp.", "Over WhatsApp.", "Per WhatsApp.")],
        ["✅", L("Todo en el chat", "Tutto in chat", "All in chat", "Alles im Chat"), L("Sin emails.", "Senza email.", "No emails.", "Ohne E-Mails.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1000, h: L("Necesito la factura del último lavado", "Mi serve la fattura dell'ultimo lavaggio", "I need the invoice for my last wash", "Ich brauche die Rechnung für meine letzte Wäsche") + time("10:11") },
        { w: "in", cp: 1, ty: 800, h: L("¡Claro! La busco enseguida…", "Certo! La cerco subito…", "Of course! Let me find it…", "Klar! Ich suche sie sofort…") + time("10:11") },
        { w: "psys", cp: 1, hold: 1300, h: L("Buscando el pedido…", "Sto cercando l'ordine…", "Looking up the order…", "Bestellung wird gesucht…") },
        { w: "in", cp: 1, ty: 1100, h: L("📦 Pedido #A-1042 — 5 jun, 12,50€", "📦 Ordine #A-1042 — 5 giu, 12,50€", "📦 Order #A-1042 — Jun 5, €12.50", "📦 Bestellung #A-1042 — 5. Juni, 12,50€") + time("10:11") },
        { w: "in", cp: 2, ty: 1000, h: fileCard("factura-A1042.pdf", "86 KB") + time("10:12") },
        { w: "in", cp: 3, ty: 800, h: L("Aquí tienes ✅", "Eccola ✅", "Here it is ✅", "Hier ist sie ✅") + time("10:12") },
        { w: "out", cp: 3, ty: 600, h: L("¡Gracias!", "Grazie!", "Thanks!", "Danke!") + time("10:12") },
      ],
    },
    {
      id: "pricing",
      label: "💲 " + L("Precios y horarios", "Prezzi e orari", "Prices & hours", "Preise & Öffnungszeiten"),
      sub: L("Precios, horarios y promociones de cada sede", "Prezzi, orari e promozioni di ogni sede", "Prices, hours and promotions for each location", "Preise, Öffnungszeiten und Aktionen jeder Filiale"),
      caps: [
        ["🏪", L("Datos de la sede", "Dati della sede", "Store details", "Filialdaten"), L("Dirección y horario reales.", "Indirizzo e orari reali.", "Real address & hours.", "Echte Adresse & Zeiten.")],
        ["💲", L("Lista de precios", "Listino prezzi", "Price list", "Preisliste"), L("Tarifa exacta del local.", "Tariffa esatta del locale.", "Exact store rates.", "Exakte Filialpreise.")],
        ["🕐", L("Horario al día", "Orari aggiornati", "Up-to-date hours", "Aktuelle Öffnungszeiten"), L("Siempre actualizado.", "Sempre aggiornato.", "Always current.", "Immer aktuell.")],
        ["📣", L("Promociones", "Promozioni", "Promotions", "Aktionen"), L("Ofertas de la sede.", "Offerte della sede.", "Store offers.", "Angebote der Filiale.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1100, h: L("¿Me dices el horario y los precios de Demowash Eixample?", "Mi dici orari e prezzi della sede Demowash Eixample?", "Can you tell me the hours and prices for Demowash Eixample?", "Kannst du mir die Öffnungszeiten und Preise von Demowash Eixample sagen?") + time("12:30") },
        { w: "in", cp: 0, ty: 1000, h: "🏪 <b>Demowash Eixample</b> — C/ Aragó 211" + time("12:30") },
        { w: "in", cp: 2, ty: 1000, h: L("🕐 Lun–Dom 8:00–22:00", "🕐 Lun–Dom 8:00–22:00", "🕐 Mon–Sun 8:00–22:00", "🕐 Mo–So 8:00–22:00") + time("12:30") },
        { w: "in", cp: 1, ty: 1300, h: L("💲 Lavado 8kg <b>6€</b> · Secado <b>4€</b> · Edredón <b>15€</b> · Detergente <b>1€</b>", "💲 Lavaggio 8kg <b>6€</b> · Asciugatura <b>4€</b> · Piumone <b>15€</b> · Detersivo <b>1€</b>", "💲 Wash 8kg <b>€6</b> · Dry <b>€4</b> · Duvet <b>€15</b> · Detergent <b>€1</b>", "💲 Waschen 8kg <b>6€</b> · Trocknen <b>4€</b> · Bettdecke <b>15€</b> · Waschmittel <b>1€</b>") + time("12:30") },
        { w: "in", cp: 3, ty: 1200, h: L("📣 Esta semana: <b>2x1 en secadora</b> los martes 🎉", "📣 Questa settimana: <b>2x1 sull'asciugatrice</b> il martedì 🎉", "📣 This week: <b>2-for-1 on dryers</b> on Tuesdays 🎉", "📣 Diese Woche: <b>2-für-1 am Trockner</b> dienstags 🎉") + time("12:30") },
        { w: "out", cp: 3, ty: 700, h: L("¡Perfecto, gracias!", "Perfetto, grazie!", "Perfect, thanks!", "Perfekt, danke!") + time("12:31") },
      ],
    },
    {
      id: "push",
      label: "📣 " + L("Promo Push", "Promo Push", "Push promo", "Promo Push"),
      sub: L("Lanza campañas y ofertas a tus clientes", "Lancia campagne e offerte ai tuoi clienti", "Launches campaigns and offers to your customers", "Startet Kampagnen und Angebote an deine Kunden"),
      caps: [
        ["📣", L("Campañas push", "Campagne push", "Push campaigns", "Push-Kampagnen"), L("Tú escribes primero.", "Scrivi tu per primo.", "You message first.", "Du schreibst zuerst.")],
        ["🎯", L("Segmenta clientes", "Segmenta i clienti", "Segments customers", "Segmentiert Kunden"), L("Al público adecuado.", "Al pubblico giusto.", "The right audience.", "Die richtige Zielgruppe.")],
        ["🎟️", L("Cupones y ofertas", "Coupon e offerte", "Coupons & offers", "Coupons & Angebote"), L("Directo en WhatsApp.", "Diretto su WhatsApp.", "Right in WhatsApp.", "Direkt in WhatsApp.")],
        ["📈", L("Reactiva ventas", "Riattiva le vendite", "Reactivates sales", "Reaktiviert Verkäufe"), L("Vuelven los dormidos.", "Tornano i clienti dormienti.", "Win back dormant clients.", "Holt inaktive Kunden zurück.")],
      ],
      s: [
        { w: "in", cp: 0, pre: 300, ty: 1300, h: L("🎉 ¡Hola María! Promo flash en Demowash Gràcia: -30% en edredones este finde 🧺", "🎉 Ciao Maria! Promo flash da Demowash Gràcia: -30% sui piumoni questo weekend 🧺", "🎉 Hi María! Flash promo at Demowash Gràcia: -30% on duvets this weekend 🧺", "🎉 Hallo Maria! Flash-Aktion bei Demowash Gràcia: -30% auf Bettdecken dieses Wochenende 🧺") + time("17:00") },
        { w: "out", cp: 1, ty: 800, h: L("¡Genial! ¿Cómo lo uso?", "Ottimo! Come lo uso?", "Great! How do I use it?", "Super! Wie löse ich sie ein?") + time("17:01") },
        { w: "in", cp: 2, ty: 1300, h: L("Enseña este cupón en caja 🎟️ <b>DUVET30</b>. ¡Válido hasta el domingo!", "Mostra questo coupon alla cassa 🎟️ <b>DUVET30</b>. Valido fino a domenica!", "Show this coupon at checkout 🎟️ <b>DUVET30</b>. Valid until Sunday!", "Zeig diesen Coupon an der Kasse 🎟️ <b>DUVET30</b>. Gültig bis Sonntag!") + time("17:01") },
        { w: "out", cp: 3, ty: 600, h: L("¡Gracias! 🙌", "Grazie! 🙌", "Thanks! 🙌", "Danke! 🙌") + time("17:01") },
      ],
    },
    {
      id: "audio",
      label: "🎤 Audio",
      sub: L("Entiende los audios y responde con voz", "Capisce i vocali e risponde a voce", "Understands voice notes and replies by voice", "Versteht Sprachnachrichten und antwortet mit Stimme"),
      caps: [
        ["🎤", L("El cliente habla", "Il cliente parla", "The customer speaks", "Der Kunde spricht"), L("No escribe.", "Non scrive.", "No typing.", "Kein Tippen.")],
        ["🎧", L("Entiende el audio", "Capisce l'audio", "Understands the audio", "Versteht das Audio"), L("Escucha e interpreta.", "Ascolta e interpreta.", "Listens & interprets.", "Hört zu und versteht.")],
        ["🔊", L("Responde con audio", "Risponde con audio", "Replies with audio", "Antwortet mit Audio"), L("El bot manda voz.", "Il bot manda voce.", "The bot sends voice.", "Der Bot sendet Sprache.")],
        ["⚡", L("Cómodo y rápido", "Comodo e veloce", "Quick & easy", "Bequem & schnell"), L("Como una llamada.", "Come una telefonata.", "Like a call.", "Wie ein Anruf.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 900, rec: true, h: voice("0:06") + time("16:40") },
        { w: "in", cp: 1, ty: 1100, h: L("He escuchado tu audio 🎧 Tu edredón ya está listo, puedes recogerlo a partir de mañana a las 17:00.", "Ho ascoltato il tuo messaggio 🎧 Il piumone è pronto, puoi ritirarlo da domani alle 17:00.", "I've listened to your audio 🎧 Your duvet is ready, you can pick it up from tomorrow at 17:00.", "Ich habe deine Sprachnachricht gehört 🎧 Deine Bettdecke ist fertig, du kannst sie ab morgen um 17:00 abholen.") + time("16:40") },
        { w: "in", cp: 2, ty: 1000, rec: true, h: voice("0:08") + time("16:41") },
        { w: "out", cp: 3, ty: 700, h: L("¡Perfecto, gracias!", "Perfetto, grazie!", "Perfect, thanks!", "Perfekt, danke!") + time("16:41") },
      ],
    },
    {
      id: "arabic",
      label: "🌍 " + L("Multilingüe", "Multilingue", "Multilingual", "Mehrsprachig"),
      sub: L("Habla el idioma de cada cliente, en automático", "Parla la lingua di ogni cliente, in automatico", "Speaks every customer's language, automatically", "Spricht die Sprache jedes Kunden, automatisch"),
      caps: [
        ["🌍", L("Detecta el idioma", "Rileva la lingua", "Detects the language", "Erkennt die Sprache"), L("Sin configurar nada.", "Senza configurare nulla.", "Zero setup.", "Ohne Konfiguration.")],
        ["🗣️", L("Cualquier idioma", "Qualsiasi lingua", "Any language", "Jede Sprache"), L("Entiende y responde.", "Capisce e risponde.", "Understands & replies.", "Versteht und antwortet.")],
        ["💬", L("Respuesta nativa", "Risposta nativa", "Native reply", "Muttersprachliche Antwort"), L("Natural y local.", "Naturale e locale.", "Natural & local.", "Natürlich & lokal.")],
        ["🤝", L("Sin barreras", "Senza barriere", "No barriers", "Keine Barrieren"), L("Clientes de todo el mundo.", "Clienti da tutto il mondo.", "Customers worldwide.", "Kunden aus aller Welt.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1000, h: arabic("مرحبا، هل لديكم فرع في برشلونة؟") + time("11:20") },
        { w: "in", cp: 1, ty: 1200, h: arabic("مرحبا! 👋 نعم، لدينا فرعان: Eixample و Gràcia 📍") + time("11:20") },
        { w: "out", cp: 1, ty: 800, h: arabic("كم سعر غسل لحاف؟") + time("11:21") },
        { w: "in", cp: 2, ty: 1000, h: arabic("🧺 لحاف مزدوج: <b>15€</b>") + time("11:21") },
        { w: "out", cp: 3, ty: 600, h: arabic("شكرا! 🙏") + time("11:21") },
        { w: "in", cp: 3, ty: 1000, h: arabic("على الرحب والسعة! 😊") + time("11:21") },
      ],
    },
  ]
}


const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
type Bubble = { w: Step["w"]; h: string; key: number; opName?: string }

export function DemowashShowcase({
  lang = "es",
  onTryNow,
  tryLabel,
}: {
  lang?: string
  onTryNow?: () => void
  tryLabel?: string
}) {
  const L = norm(lang)
  const brand = "Demowash"
  const scenes = useMemo(() => buildLaundryScenes(L), [L])
  const [active, setActive] = useState(0)
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [typing, setTyping] = useState(false)
  const [status, setStatus] = useState(ONLINE[L])
  const [op, setOp] = useState<string | null>(null)
  const [lit, setLit] = useState(0)
  const msgsRef = useRef<HTMLDivElement>(null)

  const scene = scenes[active] ?? scenes[0]

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [bubbles, typing])

  useEffect(() => {
    let alive = true
    let key = 0
    const run = async () => {
      setBubbles([])
      setOp(null)
      setStatus(ONLINE[L])
        for (const s of scene.s) {
          if (!alive) return
          if (s.cp != null) setLit(s.cp)
          await sleep(s.pre ?? 300)
          if (!alive) return
          if (s.w === "op" && s.name) setOp(s.name)
          if (s.w === "psys" || s.w === "psysblue") {
            setBubbles((b) => [...b, { w: s.w, h: s.h, key: key++ }])
            await sleep(s.hold ?? 900)
            continue
          }
          if (s.ty) {
            if (s.w === "out") {
              setStatus(s.rec ? RECORDING[L] : ONLINE[L])
              await sleep(s.ty)
            } else {
              setTyping(true)
              setStatus(s.rec ? RECORDING[L] : TYPING[L])
              await sleep(s.ty)
              if (!alive) return
              setTyping(false)
              setStatus(ONLINE[L])
            }
          }
          if (!alive) return
          setBubbles((b) => [...b, { w: s.w, h: s.h, key: key++, opName: s.name }])
        }
      await sleep(2600)
      if (alive) setActive((a) => (a + 1) % scenes.length)
    }
    run()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, L])

  return (
    <div className="dws">
      <style>{CSS}</style>

      <div className="dws-head" key={active}>
        <div className="dws-title">{scene.label}</div>
        {scene.sub && <div className="dws-sub">{scene.sub}</div>}
      </div>

      <div className="dws-stage">
        <button
          type="button"
          aria-label="prev"
          className="dws-arrow l"
          onClick={() => setActive((a) => (a - 1 + scenes.length) % scenes.length)}
        >
          <span className="dws-arrow-ic">‹</span>
        </button>
        <button
          type="button"
          aria-label="next"
          className="dws-arrow r"
          onClick={() => setActive((a) => (a + 1) % scenes.length)}
        >
          <span className="dws-arrow-ic">›</span>
        </button>
        <div className="dws-body" key={active}>
        <div className="dws-phone">
          <div className="dws-notch" />
          <div className="dws-screen">
            <div className={"dws-ph" + (op ? " op" : "")}>
              <div className="dws-av">{op ? "👩‍💼" : "🧺"}</div>
              <div>
                <div className="dws-nm">{op ?? brand}</div>
                <div className="dws-st">{status}</div>
              </div>
            </div>
            <div className="dws-msgs" ref={msgsRef}>
              <div className="dws-date">{TODAY[L]}</div>
              {bubbles.map((b) => {
                if (b.w === "psys" || b.w === "psysblue") {
                  return (
                    <div key={b.key} className={"dws-sys" + (b.w === "psysblue" ? " blue" : "")}>
                      <span className="dws-sp" />
                      <span dangerouslySetInnerHTML={{ __html: b.h }} />
                    </div>
                  )
                }
                const cls = b.w === "op" ? "in" : b.w
                return (
                  <div key={b.key} className={"dws-m dws-" + cls}>
                    {b.w === "op" && <div className="dws-opn">{b.opName}</div>}
                    <span dangerouslySetInnerHTML={{ __html: b.h }} />
                  </div>
                )
              })}
              {typing && (
                <div className="dws-typing">
                  <i /> <i /> <i />
                </div>
              )}
            </div>
            <div className="dws-inbar">
              <div className="dws-inbox">Mensaje</div>
              <div className="dws-mic">🎤</div>
            </div>
          </div>
        </div>

        <div className="dws-side">
          <div className="dws-caps">
            {scene.caps.map((c, i) => (
              <div key={i} className={"dws-cap" + (i === lit ? " on" : "")}>
                <div className="dws-cap-ic">{c[0]}</div>
                <div>
                  <h4>{c[1]}</h4>
                  <p>{c[2]}</p>
                </div>
              </div>
            ))}
          </div>
          {onTryNow && (
            <button type="button" className="dws-try" onClick={onTryNow}>
              {tryLabel ?? TRY[L]}
            </button>
          )}
        </div>
        </div>
      </div>

      <div className="dws-dots">
        {scenes.map((sc, i) => (
          <button
            key={sc.id}
            type="button"
            aria-label={sc.label}
            onClick={() => setActive(i)}
            className={"dws-dot" + (i === active ? " on" : "")}
          />
        ))}
      </div>
    </div>
  )
}

// Scoped styles (dws- prefix) so the WhatsApp look is self-contained.
const CSS = `
.dws{--g600:#16a34a;--g700:#15803d;--g50:#f0fdf4;--g100:#dcfce7;--line:#e5e7eb;--mut:#6b7280;--wa-out:#d9fdd3;--wa-bg:#efeae2;font-family:-apple-system,"Segoe UI",Helvetica,sans-serif;color:#0b1220;container-type:inline-size;background:linear-gradient(160deg,#ffffff 0%,#f7fdf9 55%,#eafaf0 100%);border:1px solid #e6efe9;border-radius:26px;box-shadow:0 40px 80px -38px rgba(2,44,34,.32),0 2px 8px -4px rgba(2,44,34,.08);overflow:hidden}
.dws-head{display:flex;flex-direction:column;align-items:center;gap:4px;padding:22px 24px 6px;background:transparent}
.dws-title{text-align:center;font-size:21px;font-weight:800;letter-spacing:-.01em;background:linear-gradient(90deg,var(--g700),var(--g600));-webkit-background-clip:text;background-clip:text;color:transparent;animation:dws-slidein .4s cubic-bezier(.22,1,.36,1)}
.dws-sub{text-align:center;font-size:13.5px;color:var(--mut);max-width:560px;animation:dws-slidein .45s cubic-bezier(.22,1,.36,1)}
@keyframes dws-slidein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.dws-stage{position:relative}
.dws-arrow{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border:none;cursor:pointer;z-index:6;display:grid;place-items:center;padding:0;border-radius:999px;background:#fff;color:var(--g700);font-size:24px;line-height:1;box-shadow:0 8px 22px -8px rgba(2,44,34,.35);transition:.2s}
.dws-arrow.l{left:12px}
.dws-arrow.r{right:12px}
.dws-arrow:hover{background:var(--g600);color:#fff;transform:translateY(-50%) scale(1.1)}
.dws-arrow:active{transform:translateY(-50%) scale(.95)}
.dws-arrow-ic{display:block;margin-top:-2px}
@container (max-width:520px){.dws-arrow{width:38px;height:38px;font-size:21px}}
.dws-body{display:grid;grid-template-columns:1fr;gap:22px;padding:6px 64px 22px;background:transparent;align-items:center;justify-items:center;animation:dws-fadein .45s ease}
@container (min-width:760px){.dws-body{grid-template-columns:300px 1fr;gap:40px;padding:10px 70px 26px;justify-items:stretch}}
@keyframes dws-fadein{from{opacity:0}to{opacity:1}}
.dws-phone{width:300px;height:560px;background:#0b1220;border-radius:42px;padding:11px;box-shadow:0 28px 56px -22px rgba(8,15,30,.55);position:relative;margin:0 auto}
.dws-notch{position:absolute;top:11px;left:50%;transform:translateX(-50%);width:110px;height:21px;background:#0b1220;border-radius:0 0 16px 16px;z-index:6}
.dws-screen{width:100%;height:100%;border-radius:32px;overflow:hidden;display:flex;flex-direction:column;background:var(--wa-bg);background-image:radial-gradient(rgba(0,0,0,.04) 1px,transparent 1px);background-size:16px 16px}
.dws-ph{background:#075e54;color:#fff;padding:30px 13px 10px;display:flex;align-items:center;gap:9px;flex:0 0 auto;transition:.3s}
.dws-ph.op{background:#1d4ed8}
.dws-ph .dws-av{width:32px;height:32px;border-radius:50%;background:#25d366;display:grid;place-items:center;font-size:15px}
.dws-ph.op .dws-av{background:#fbbf24}
.dws-nm{font-weight:600;font-size:13.5px}.dws-st{font-size:10.5px;opacity:.85}
.dws-msgs{flex:1;overflow:hidden;padding:12px 11px;display:flex;flex-direction:column;gap:6px;justify-content:flex-start}
.dws-date{align-self:center;background:#fff;color:#54656f;font-size:10px;font-weight:500;padding:3px 10px;border-radius:7px;box-shadow:0 1px 1px rgba(0,0,0,.08);margin-bottom:4px}
.dws-m{max-width:85%;padding:8px 12px;border-radius:8px;font-size:13.5px;line-height:1.42;box-shadow:0 1px 1px rgba(0,0,0,.08);animation:dws-pop .4s}
@keyframes dws-pop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.dws-in{background:#fff;align-self:flex-start;border-top-left-radius:2px}
.dws-out{background:var(--wa-out);align-self:flex-end;border-top-right-radius:2px}
.dws-t{font-size:9px;color:#8a93a3;float:right;margin:5px 0 -2px 8px}
.dws-opn{font-size:10.5px;font-weight:600;color:#1d4ed8;margin-bottom:1px}
.dws-ar{display:block;text-align:right}
.dws-sys{align-self:center;font-size:10px;padding:5px 10px;border-radius:7px;text-align:center;background:#ede9fe;color:#5b21b6;display:flex;gap:6px;align-items:center;animation:dws-pop .4s}
.dws-sys.blue{background:#dbeafe;color:#1e40af}
.dws-sp{width:8px;height:8px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:dws-spin .8s linear infinite;opacity:.6;flex:0 0 auto}
@keyframes dws-spin{to{transform:rotate(360deg)}}
.dws-voice{display:flex;align-items:center;gap:7px;min-width:140px}
.dws-pp{width:22px;height:22px;border-radius:50%;background:#00a884;color:#fff;display:grid;place-items:center;font-size:9px;flex:0 0 auto}
.dws-in .dws-pp{background:#075e54}
.dws-wave{flex:1;height:17px;background:repeating-linear-gradient(90deg,#9aa8ad 0 2px,transparent 2px 5px);border-radius:3px}
.dws-vt{font-size:9px;color:#778}
.dws-file{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.05);border-radius:6px;padding:7px;min-width:160px}
.dws-file-ic{width:26px;height:32px;border-radius:4px;background:#d23;color:#fff;display:grid;place-items:center;font-size:8px;font-weight:700}
.dws-file-n{font-size:11px;font-weight:600}.dws-file-s{font-size:9px;color:#667781}
.dws-yt{width:195px;border-radius:7px;overflow:hidden;border:1px solid rgba(0,0,0,.12)}
.dws-yt-thumb{height:96px;background:linear-gradient(135deg,#202020,#3a3a3a);display:grid;place-items:center;position:relative}
.dws-yt-play{width:40px;height:28px;background:#f00;border-radius:7px;display:grid;place-items:center;color:#fff;font-size:12px}
.dws-yt-dur{position:absolute;bottom:4px;right:5px;background:rgba(0,0,0,.7);color:#fff;font-size:8px;padding:1px 3px;border-radius:3px}
.dws-yt-meta{padding:5px 8px;background:#fff}
.dws-yt-title{font-size:10.5px;font-weight:600}.dws-yt-host{font-size:8.5px;color:#777}
.dws-typing{align-self:flex-start;background:#fff;border-radius:8px;padding:7px 10px;display:flex;gap:3px;box-shadow:0 1px 1px rgba(0,0,0,.08)}
.dws-typing i{width:5px;height:5px;border-radius:50%;background:#9aa3b2;animation:dws-bl 1.2s infinite}
.dws-typing i:nth-child(2){animation-delay:.2s}.dws-typing i:nth-child(3){animation-delay:.4s}
@keyframes dws-bl{0%,60%,100%{opacity:.3}30%{opacity:1}}
.dws-inbar{flex:0 0 auto;padding:8px 9px 11px;display:flex;gap:7px;align-items:center}
.dws-inbox{flex:1;background:#fff;border-radius:999px;padding:7px 12px;color:#9aa3b2;font-size:11px}
.dws-mic{width:30px;height:30px;border-radius:50%;background:var(--g600);color:#fff;display:grid;place-items:center;font-size:13px}
.dws-side{display:flex;flex-direction:column;gap:14px}
.dws-caps{display:flex;flex-direction:column;gap:11px;width:100%}
.dws-cap{display:flex;gap:14px;align-items:center;background:transparent;border:1.5px solid rgba(2,44,34,.08);border-radius:15px;padding:14px 18px;opacity:.55;transition:.35s}
.dws-cap.on{opacity:1;background:var(--g50);border-color:var(--g600);box-shadow:0 16px 34px -18px rgba(22,163,74,.45);transform:translateX(4px)}
.dws-cap-ic{width:46px;height:46px;border-radius:13px;background:rgba(22,163,74,.10);display:grid;place-items:center;font-size:23px;flex:0 0 auto;transition:.35s}
.dws-cap.on .dws-cap-ic{background:var(--g100)}
.dws-cap h4{font-size:15.5px;margin:0 0 2px}.dws-cap p{font-size:13px;color:var(--mut);margin:0}
.dws-try{align-self:flex-start;background:var(--g600);color:#fff;border:none;font-weight:700;font-size:15px;border-radius:999px;padding:13px 26px;cursor:pointer;box-shadow:0 12px 26px -12px rgba(22,163,74,.7)}
.dws-try:hover{background:var(--g700)}
.dws-dots{display:flex;justify-content:center;align-items:center;gap:9px;padding:18px 16px 22px;background:transparent;flex-wrap:wrap}
.dws-dot{width:10px;height:10px;border-radius:999px;background:#cbd5e1;border:none;cursor:pointer;transition:.25s;padding:0}
.dws-dot:hover{background:#9ca3af}
.dws-dot.on{background:var(--g600);width:30px}
`
