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
// LANGUAGE: fully translated to the public-site languages (it / en / es / pt),
// driven by the `lang` prop. Unsupported codes (fr / ca) fall back to Spanish.
// The Arabic tab keeps its Arabic bubbles in every language (it is the live
// proof that the bot speaks Arabic + RTL); only its labels/captions translate.
// ----------------------------------------------------------------------------
import { useEffect, useMemo, useRef, useState } from "react"

type Lang = "it" | "en" | "es" | "pt"
const norm = (l: string): Lang =>
  (["it", "en", "es", "pt"].includes(l) ? l : "es") as Lang

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
type Scene = { id: string; label: string; caps: Cap[]; s: Step[] }

// Per-language UI labels.
const TRY: Record<Lang, string> = {
  es: "Pruébalo ahora →",
  it: "Provalo ora →",
  en: "Try it now →",
  pt: "Experimenta agora →",
}
const ONLINE: Record<Lang, string> = { es: "en línea", it: "online", en: "online", pt: "online" }
const TYPING: Record<Lang, string> = { es: "escribiendo…", it: "sta scrivendo…", en: "typing…", pt: "a escrever…" }
const RECORDING: Record<Lang, string> = { es: "grabando audio…", it: "registra audio…", en: "recording…", pt: "a gravar…" }

// Builds the laundry scenario list translated into `lang`. One source of
// truth: every string carries its 4 translations inline via L().
function buildLaundryScenes(lang: Lang): Scene[] {
  const L = (es: string, it: string, en: string, pt: string) =>
    ({ es, it, en, pt }[lang] ?? es)

  return [
    {
      id: "welcome",
      label: "👋 " + L("Bienvenida", "Benvenuto", "Welcome", "Boas-vindas"),
      caps: [
        ["👋", L("Saludo automático", "Saluto automatico", "Auto greeting", "Saudação automática"), L("Recibe a cada cliente.", "Accoglie ogni cliente.", "Greets every customer.", "Recebe cada cliente.")],
        ["🎬", L("Vídeo de presentación", "Video di presentazione", "Intro video", "Vídeo de apresentação"), L("Directo en el chat.", "Direttamente in chat.", "Right in the chat.", "Direto no chat.")],
        ["🚀", L("Guía a la acción", "Guida all'azione", "Drives to action", "Leva à ação"), L("Lleva al siguiente paso.", "Porta al passo dopo.", "To the next step.", "Para o passo seguinte.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1000, h: L("Hola, ¿tenéis franquicia?", "Ciao, avete il franchising?", "Hi, do you offer franchising?", "Olá, têm franquia?") + time("12:53") },
        { w: "in", cp: 0, ty: 1000, h: L("¡Hola! 👋 Soy el asistente de Demowash 😊", "Ciao! 👋 Sono l'assistente di Demowash 😊", "Hi! 👋 I'm the Demowash assistant 😊", "Olá! 👋 Sou o assistente da Demowash 😊") + time("12:53") },
        { w: "in", cp: 1, ty: 800, h: L("Te dejo una breve presentación 👇", "Ti lascio una breve presentazione 👇", "Here's a quick intro 👇", "Deixo uma breve apresentação 👇") + time("12:53") },
        { w: "in", cp: 1, ty: 1100, h: ytCard(L("Demowash · Franquicia", "Demowash · Franchising", "Demowash · Franchise", "Demowash · Franquia")) + time("12:54") },
        { w: "in", cp: 2, ty: 1100, h: L("¿Quieres una consultoría gratuita? 🚀", "Vuoi una consulenza gratuita? 🚀", "Want a free consultation? 🚀", "Queres uma consultoria gratuita? 🚀") + time("12:54") },
      ],
    },
    {
      id: "cita",
      label: "🗓️ " + L("Pedir cita", "Prenota", "Book a call", "Agendar"),
      caps: [
        ["🗓️", L("Agenda citas solo", "Prenota da solo", "Books on its own", "Agenda sozinho"), L("Sin operador.", "Senza operatore.", "No operator.", "Sem operador.")],
        ["📝", L("Recoge los datos", "Raccoglie i dati", "Collects the data", "Recolhe os dados"), L("Nombre, email, ciudad.", "Nome, email, città.", "Name, email, city.", "Nome, email, cidade.")],
        ["📅", L("Conectado al calendario", "Collegato al calendario", "Calendar-connected", "Ligado ao calendário"), L("Crea el evento.", "Crea l'evento.", "Creates the event.", "Cria o evento.")],
        ["🔗", L("Envía Zoom + email", "Invia Zoom + email", "Sends Zoom + email", "Envia Zoom + email"), L("Confirmación auto.", "Conferma automatica.", "Auto confirmation.", "Confirmação auto.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1100, h: L("Quiero abrir en Sitges. ¿Franquicia?", "Voglio aprire a Sitges. Franchising?", "I want to open in Sitges. Franchise?", "Quero abrir em Sitges. Franquia?") + time("12:53") },
        { w: "in", cp: 0, ty: 1100, h: L("¡Claro! Consultoría gratuita. ¿Agendamos?", "Certo! Consulenza gratuita. Prenotiamo?", "Sure! Free consultation. Shall we book?", "Claro! Consultoria gratuita. Agendamos?") + time("12:54") },
        { w: "out", cp: 1, ty: 500, h: L("Sí", "Sì", "Yes", "Sim") + time("12:54") },
        { w: "in", cp: 1, ty: 700, h: L("¿Tu nombre?", "Il tuo nome?", "Your name?", "O teu nome?") + time("12:54") },
        { w: "out", cp: 1, ty: 700, h: "Marco Rossi" + time("12:54") },
        { w: "in", cp: 1, ty: 700, h: L("¿Tu email?", "La tua email?", "Your email?", "O teu email?") + time("12:54") },
        { w: "out", cp: 1, ty: 800, h: "marco.rossi@email.com" + time("12:54") },
        { w: "in", cp: 1, ty: 700, h: L("¿En qué ciudad?", "In che città?", "Which city?", "Em que cidade?") + time("12:54") },
        { w: "out", cp: 1, ty: 500, h: "Sitges" + time("12:54") },
        { w: "in", cp: 2, ty: 1300, h: L("Horarios: 1) Lun 10:00 · 2) Lun 15:00 · 3) Mar 11:00 (1/2/3)", "Orari: 1) Lun 10:00 · 2) Lun 15:00 · 3) Mar 11:00 (1/2/3)", "Slots: 1) Mon 10:00 · 2) Mon 15:00 · 3) Tue 11:00 (1/2/3)", "Horários: 1) Seg 10:00 · 2) Seg 15:00 · 3) Ter 11:00 (1/2/3)") + time("12:54") },
        { w: "out", cp: 2, ty: 500, h: "3" + time("12:55") },
        { w: "psys", cp: 2, hold: 1500, h: L("Creando la cita…", "Creo l'appuntamento…", "Creating the appointment…", "A criar a marcação…") },
        { w: "in", cp: 3, ty: 1300, h: L("✅ ¡Cita confirmada! Mar 11 jun · 11:00. Zoom + calendario por email 👋", "✅ Appuntamento confermato! Mar 11 giu · 11:00. Zoom + calendario via email 👋", "✅ Booked! Tue Jun 11 · 11:00. Zoom + calendar by email 👋", "✅ Marcação confirmada! Ter 11 jun · 11:00. Zoom + calendário por email 👋") + time("12:55") },
      ],
    },
    {
      id: "machine",
      label: "🔌 " + L("Desbloqueo", "Sblocco", "Unlock", "Desbloqueio"),
      caps: [
        ["💬", L("Entiende el problema", "Capisce il problema", "Understands the issue", "Entende o problema"), L("Como habla el cliente.", "Come parla il cliente.", "As the customer speaks.", "Como o cliente fala.")],
        ["📍", L("Encuentra la sede", "Trova la sede", "Finds the location", "Encontra a sede"), L("Conoce los locales.", "Conosce i locali.", "Knows every store.", "Conhece os locais.")],
        ["🔌", L("Se conecta a la máquina", "Si collega alla macchina", "Connects to the machine", "Liga-se à máquina"), L("Comandos en remoto.", "Comandi da remoto.", "Remote commands.", "Comandos remotos.")],
        ["✅", L("Resuelve solo, 24/7", "Risolve da solo, 24/7", "Solves alone, 24/7", "Resolve sozinho, 24/7"), L("Sin operadores.", "Senza operatori.", "No operators.", "Sem operadores.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 900, h: L("No consigo abrir la lavadora 😟", "Non riesco ad aprire la lavatrice 😟", "I can't open the washer 😟", "Não consigo abrir a máquina 😟") + time("18:02") },
        { w: "in", cp: 1, ty: 1000, h: L("¡Vaya! ¿En qué lavandería estás?", "Mi dispiace! In quale lavanderia sei?", "Sorry! Which laundromat are you at?", "Que pena! Em que lavandaria estás?") + time("18:02") },
        { w: "out", cp: 1, ty: 600, h: "Barcelona" + time("18:03") },
        { w: "in", cp: 1, ty: 1100, h: L("Tenemos dos: 📍 Eixample y 📍 Gràcia. ¿Cuál?", "Ne abbiamo due: 📍 Eixample e 📍 Gràcia. Quale?", "We have two: 📍 Eixample and 📍 Gràcia. Which?", "Temos duas: 📍 Eixample e 📍 Gràcia. Qual?") + time("18:03") },
        { w: "out", cp: 1, ty: 500, h: "Eixample" + time("18:03") },
        { w: "in", cp: 2, ty: 900, h: L("¿Número de máquina?", "Numero macchina?", "Machine number?", "Número da máquina?") + time("18:03") },
        { w: "out", cp: 2, ty: 900, h: L("La 4, ha terminado pero no abre", "La 4, ha finito ma non si apre", "No. 4, finished but won't open", "A 4, terminou mas não abre") + time("18:04") },
        { w: "in", cp: 2, ty: 900, h: L("Me conecto a la máquina #4… 🔌", "Mi collego alla macchina #4… 🔌", "Connecting to machine #4… 🔌", "A ligar à máquina #4… 🔌") + time("18:04") },
        { w: "psys", cp: 2, hold: 1500, h: L("Comando de desbloqueo enviado", "Comando di sblocco inviato", "Unlock command sent", "Comando de desbloqueio enviado") },
        { w: "in", cp: 3, ty: 1000, h: L("✅ ¡Máquina #4 desbloqueada! 👕", "✅ Macchina #4 sbloccata! 👕", "✅ Machine #4 unlocked! 👕", "✅ Máquina #4 desbloqueada! 👕") + time("18:04") },
        { w: "out", cp: 3, ty: 600, h: L("¡Gracias! 🙏", "Grazie! 🙏", "Thanks! 🙏", "Obrigado! 🙏") + time("18:05") },
      ],
    },
    {
      id: "human",
      label: "🙋 " + L("Soporte humano", "Supporto umano", "Human support", "Suporte humano"),
      caps: [
        ["🧠", L("Detecta el caso", "Rileva il caso", "Spots the case", "Deteta o caso"), L("Sabe cuándo no basta.", "Sa quando non basta.", "Knows when it's not enough.", "Sabe quando não chega.")],
        ["🙋", L("Avisa al operador", "Avvisa l'operatore", "Alerts an operator", "Avisa o operador"), L("Al instante.", "All'istante.", "Instantly.", "Ao instante.")],
        ["👩‍💼", L("Toma el control", "Prende il controllo", "Takes over", "Assume o controlo"), L("Pausa el bot.", "Mette in pausa il bot.", "Pauses the bot.", "Pausa o bot.")],
        ["🤝", L("Continuidad total", "Continuità totale", "Seamless handover", "Continuidade total"), L("El cliente ni lo nota.", "Il cliente non se ne accorge.", "The customer never notices.", "O cliente nem nota.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1000, h: L("Me habéis estropeado la chaqueta, 2ª vez 😡", "Mi avete rovinato la giacca, 2ª volta 😡", "You ruined my jacket, 2nd time 😡", "Estragaram o meu casaco, 2ª vez 😡") + time("19:05") },
        { w: "in", cp: 0, ty: 1000, h: L("Lo siento mucho 🙏 Paso tu caso a un operador.", "Mi dispiace 🙏 Passo il caso a un operatore.", "So sorry 🙏 Passing you to an operator.", "Lamento muito 🙏 Passo o caso a um operador.") + time("19:05") },
        { w: "psysblue", cp: 1, hold: 1500, h: L("Un operador se está conectando…", "Un operatore si sta collegando…", "An operator is connecting…", "Um operador está a ligar-se…") },
        { w: "op", cp: 2, ty: 1100, name: L("Giulia · Operadora", "Giulia · Operatrice", "Giulia · Operator", "Giulia · Operadora"), h: L("Soy Giulia, de Eixample 😊", "Sono Giulia, di Eixample 😊", "I'm Giulia, from Eixample 😊", "Sou a Giulia, de Eixample 😊") + time("19:06") },
        { w: "op", cp: 3, ty: 1100, h: L("Te lo relavamos gratis + cupón 20%. ¿Ok?", "Lo rilaviamo gratis + buono 20%. Ok?", "We'll rewash it free + 20% coupon. Ok?", "Relavamos grátis + cupão 20%. Ok?") + time("19:06") },
        { w: "out", cp: 3, ty: 600, h: L("¡Gracias!", "Grazie!", "Thanks!", "Obrigado!") + time("19:07") },
      ],
    },
    {
      id: "invoice",
      label: "🧾 " + L("Factura", "Fattura", "Invoice", "Fatura"),
      caps: [
        ["💬", L("Entiende la petición", "Capisce la richiesta", "Understands the ask", "Entende o pedido"), L("Solo hay que pedirla.", "Basta chiederla.", "Just ask for it.", "Basta pedir.")],
        ["🔎", L("Encuentra el pedido", "Trova l'ordine", "Finds the order", "Encontra o pedido"), L("En el sistema.", "Nel gestionale.", "In the system.", "No sistema.")],
        ["📄", L("Envía el PDF", "Invia il PDF", "Sends the PDF", "Envia o PDF"), L("Por WhatsApp.", "Su WhatsApp.", "Over WhatsApp.", "Por WhatsApp.")],
        ["✅", L("Todo en el chat", "Tutto in chat", "All in chat", "Tudo no chat"), L("Sin emails.", "Senza email.", "No emails.", "Sem emails.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1000, h: L("Necesito la factura del último lavado", "Mi serve la fattura dell'ultimo lavaggio", "I need the invoice for my last wash", "Preciso da fatura da última lavagem") + time("10:11") },
        { w: "in", cp: 1, ty: 800, h: L("¡Claro! La busco…", "Certo! La cerco…", "Sure! Let me find it…", "Claro! Vou procurar…") + time("10:11") },
        { w: "psys", cp: 1, hold: 1300, h: L("Buscando pedido…", "Cerco l'ordine…", "Looking up the order…", "A procurar o pedido…") },
        { w: "in", cp: 1, ty: 1100, h: L("📦 Pedido #A-1042 — 5 jun, 12,50€", "📦 Ordine #A-1042 — 5 giu, 12,50€", "📦 Order #A-1042 — Jun 5, €12.50", "📦 Pedido #A-1042 — 5 jun, 12,50€") + time("10:11") },
        { w: "in", cp: 2, ty: 1000, h: fileCard("factura-A1042.pdf", "86 KB") + time("10:12") },
        { w: "in", cp: 3, ty: 800, h: L("Aquí tienes ✅", "Eccola ✅", "Here it is ✅", "Aqui está ✅") + time("10:12") },
        { w: "out", cp: 3, ty: 600, h: L("¡Gracias!", "Grazie!", "Thanks!", "Obrigado!") + time("10:12") },
      ],
    },
    {
      id: "pricing",
      label: "💲 " + L("Precios y horarios", "Prezzi e orari", "Prices & hours", "Preços e horários"),
      caps: [
        ["🏪", L("Datos de la sede", "Dati della sede", "Store details", "Dados da loja"), L("Dirección y horario reales.", "Indirizzo e orari reali.", "Real address & hours.", "Morada e horário reais.")],
        ["💲", L("Lista de precios", "Listino prezzi", "Price list", "Lista de preços"), L("Tarifa exacta del local.", "Tariffa esatta del locale.", "Exact store rates.", "Tarifa exata da loja.")],
        ["🕐", L("Horario al día", "Orari aggiornati", "Up-to-date hours", "Horário atualizado"), L("Siempre actualizado.", "Sempre aggiornato.", "Always current.", "Sempre atual.")],
        ["🌍", L("Multilingüe", "Multilingue", "Multilingual", "Multilíngue"), L("En su idioma.", "Nella sua lingua.", "In their language.", "No seu idioma.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1100, h: L("¿Horario y precios de Demowash Eixample?", "Orari e prezzi di Demowash Eixample?", "Hours and prices for Demowash Eixample?", "Horário e preços da Demowash Eixample?") + time("12:30") },
        { w: "in", cp: 0, ty: 1000, h: "🏪 <b>Demowash Eixample</b> — C/ Aragó 211" + time("12:30") },
        { w: "in", cp: 2, ty: 1000, h: L("🕐 Lun–Dom 8:00–22:00", "🕐 Lun–Dom 8:00–22:00", "🕐 Mon–Sun 8:00–22:00", "🕐 Seg–Dom 8:00–22:00") + time("12:30") },
        { w: "in", cp: 1, ty: 1300, h: L("💲 Lavado 8kg <b>6€</b> · Secado <b>4€</b> · Edredón <b>15€</b> · Detergente <b>1€</b>", "💲 Lavaggio 8kg <b>6€</b> · Asciugatura <b>4€</b> · Piumone <b>15€</b> · Detersivo <b>1€</b>", "💲 Wash 8kg <b>€6</b> · Dry <b>€4</b> · Duvet <b>€15</b> · Detergent <b>€1</b>", "💲 Lavagem 8kg <b>6€</b> · Secagem <b>4€</b> · Edredão <b>15€</b> · Detergente <b>1€</b>") + time("12:30") },
        { w: "out", cp: 3, ty: 700, h: L("¡Perfecto, gracias!", "Perfetto, grazie!", "Perfect, thanks!", "Perfeito, obrigado!") + time("12:31") },
      ],
    },
    {
      id: "push",
      label: "📣 " + L("Promo Push", "Promo Push", "Push promo", "Promo Push"),
      caps: [
        ["📣", L("Campañas push", "Campagne push", "Push campaigns", "Campanhas push"), L("Tú escribes primero.", "Scrivi tu per primo.", "You message first.", "Escreves tu primeiro.")],
        ["🎯", L("Segmenta clientes", "Segmenta i clienti", "Segments customers", "Segmenta clientes"), L("Al público adecuado.", "Al pubblico giusto.", "The right audience.", "Ao público certo.")],
        ["🎟️", L("Cupones y ofertas", "Coupon e offerte", "Coupons & offers", "Cupões e ofertas"), L("Directo en WhatsApp.", "Diretto su WhatsApp.", "Right in WhatsApp.", "Direto no WhatsApp.")],
        ["📈", L("Reactiva ventas", "Riattiva le vendite", "Reactivates sales", "Reativa vendas"), L("Vuelven los dormidos.", "Tornano i clienti dormienti.", "Win back dormant clients.", "Recupera clientes parados.")],
      ],
      s: [
        { w: "in", cp: 0, pre: 300, ty: 1300, h: L("🎉 ¡Hola María! Promo flash en Demowash Gràcia: -30% en edredones este finde 🧺", "🎉 Ciao Maria! Promo flash da Demowash Gràcia: -30% sui piumoni questo weekend 🧺", "🎉 Hi María! Flash promo at Demowash Gràcia: -30% on duvets this weekend 🧺", "🎉 Olá Maria! Promo flash na Demowash Gràcia: -30% em edredões este fim de semana 🧺") + time("17:00") },
        { w: "out", cp: 1, ty: 800, h: L("¡Genial! ¿Cómo lo uso?", "Forte! Come lo uso?", "Great! How do I use it?", "Boa! Como uso?") + time("17:01") },
        { w: "in", cp: 2, ty: 1300, h: L("Enseña este cupón en caja 🎟️ <b>DUVET30</b>. ¡Válido hasta el domingo!", "Mostra questo coupon in cassa 🎟️ <b>DUVET30</b>. Valido fino a domenica!", "Show this coupon at checkout 🎟️ <b>DUVET30</b>. Valid until Sunday!", "Mostra este cupão na caixa 🎟️ <b>DUVET30</b>. Válido até domingo!") + time("17:01") },
        { w: "out", cp: 3, ty: 600, h: L("¡Gracias! 🙌", "Grazie! 🙌", "Thanks! 🙌", "Obrigado! 🙌") + time("17:01") },
      ],
    },
    {
      id: "audio",
      label: "🎤 Audio",
      caps: [
        ["🎤", L("El cliente habla", "Il cliente parla", "The customer speaks", "O cliente fala"), L("No escribe.", "Non scrive.", "No typing.", "Não escreve.")],
        ["🎧", L("Entiende el audio", "Capisce l'audio", "Understands the audio", "Entende o áudio"), L("Escucha e interpreta.", "Ascolta e interpreta.", "Listens & interprets.", "Ouve e interpreta.")],
        ["🔊", L("Responde con audio", "Risponde con audio", "Replies with audio", "Responde com áudio"), L("El bot manda voz.", "Il bot manda voce.", "The bot sends voice.", "O bot envia voz.")],
        ["⚡", L("Cómodo y rápido", "Comodo e veloce", "Quick & easy", "Cómodo e rápido"), L("Como una llamada.", "Come una telefonata.", "Like a call.", "Como uma chamada.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 900, rec: true, h: voice("0:06") + time("16:40") },
        { w: "in", cp: 1, ty: 1100, h: L("Lo he escuchado 🎧 Tu edredón está listo, recógelo desde mañana 17:00.", "L'ho ascoltato 🎧 Il piumone è pronto, ritiralo da domani 17:00.", "Got your audio 🎧 Your duvet is ready, pick it up from tomorrow 17:00.", "Ouvi 🎧 O edredão está pronto, levanta a partir de amanhã 17:00.") + time("16:40") },
        { w: "in", cp: 2, ty: 1000, rec: true, h: voice("0:08") + time("16:41") },
        { w: "out", cp: 3, ty: 700, h: L("¡Perfecto, gracias!", "Perfetto, grazie!", "Perfect, thanks!", "Perfeito, obrigado!") + time("16:41") },
      ],
    },
    {
      id: "arabic",
      label: "🌍 " + L("Multilingüe", "Multilingue", "Multilingual", "Multilíngue"),
      caps: [
        ["🌍", L("Detecta el idioma", "Rileva la lingua", "Detects the language", "Deteta o idioma"), L("Sin configurar nada.", "Senza configurare nulla.", "Zero setup.", "Sem configurar nada.")],
        ["🗣️", L("Cualquier idioma", "Qualsiasi lingua", "Any language", "Qualquer idioma"), L("Entiende y responde.", "Capisce e risponde.", "Understands & replies.", "Entende e responde.")],
        ["💬", L("Respuesta nativa", "Risposta nativa", "Native reply", "Resposta nativa"), L("Natural y local.", "Naturale e locale.", "Natural & local.", "Natural e local.")],
        ["🤝", L("Sin barreras", "Senza barriere", "No barriers", "Sem barreiras"), L("Clientes de todo el mundo.", "Clienti da tutto il mondo.", "Customers worldwide.", "Clientes do mundo todo.")],
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

// Generic (brand-agnostic "eChatbot") scenarios for the homepage hero.
function buildGenericScenes(lang: Lang): Scene[] {
  const L = (es: string, it: string, en: string, pt: string) =>
    ({ es, it, en, pt }[lang] ?? es)

  return [
    {
      id: "welcome",
      label: "👋 " + L("Bienvenida", "Benvenuto", "Welcome", "Boas-vindas"),
      caps: [
        ["👋", L("Saludo automático", "Saluto automatico", "Auto greeting", "Saudação automática"), L("Recibe a cada cliente.", "Accoglie ogni cliente.", "Greets every customer.", "Recebe cada cliente.")],
        ["🎬", L("Vídeo de presentación", "Video di presentazione", "Intro video", "Vídeo de apresentação"), L("Directo en el chat.", "Direttamente in chat.", "Right in the chat.", "Direto no chat.")],
        ["🚀", L("Guía a la acción", "Guida all'azione", "Drives to action", "Leva à ação"), L("Lleva al siguiente paso.", "Porta al passo dopo.", "To the next step.", "Para o passo seguinte.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1000, h: L("Hola, ¿qué ofrecéis?", "Ciao, cosa offrite?", "Hi, what do you offer?", "Olá, o que oferecem?") + time("12:53") },
        { w: "in", cp: 0, ty: 1000, h: L("¡Hola! 👋 Soy el asistente de eChatbot 😊", "Ciao! 👋 Sono l'assistente di eChatbot 😊", "Hi! 👋 I'm the eChatbot assistant 😊", "Olá! 👋 Sou o assistente da eChatbot 😊") + time("12:53") },
        { w: "in", cp: 1, ty: 800, h: L("Te dejo una breve presentación 👇", "Ti lascio una breve presentazione 👇", "Here's a quick intro 👇", "Deixo uma breve apresentação 👇") + time("12:53") },
        { w: "in", cp: 1, ty: 1100, h: ytCard("eChatbot · WhatsApp AI") + time("12:54") },
        { w: "in", cp: 2, ty: 1100, h: L("¿Cómo puedo ayudarte hoy? 🚀", "Come posso aiutarti oggi? 🚀", "How can I help you today? 🚀", "Como posso ajudar hoje? 🚀") + time("12:54") },
      ],
    },
    {
      id: "order",
      label: "🛒 " + L("Pedidos", "Ordini", "Orders", "Pedidos"),
      caps: [
        ["🛒", L("Estado del pedido", "Stato dell'ordine", "Order status", "Estado do pedido"), L("Solo hay que preguntar.", "Basta chiedere.", "Just ask.", "Basta perguntar.")],
        ["🔎", L("Lo encuentra", "Lo trova", "Finds it", "Encontra-o"), L("En el sistema.", "Nel gestionale.", "In the system.", "No sistema.")],
        ["🚚", L("Seguimiento", "Tracciamento", "Tracking", "Rastreio"), L("Envío y entrega.", "Spedizione e consegna.", "Shipping & delivery.", "Envio e entrega.")],
        ["✅", L("Sin esperas", "Senza attese", "No waiting", "Sem esperas"), L("Respuesta al instante.", "Risposta all'istante.", "Instant reply.", "Resposta imediata.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 900, h: L("¿Dónde está mi pedido?", "Dov'è il mio ordine?", "Where's my order?", "Onde está o meu pedido?") + time("10:11") },
        { w: "in", cp: 1, ty: 800, h: L("¡Claro! Un momento… 🔎", "Certo! Un attimo… 🔎", "Sure! One sec… 🔎", "Claro! Um momento… 🔎") + time("10:11") },
        { w: "psys", cp: 1, hold: 1300, h: L("Buscando pedido…", "Cerco l'ordine…", "Looking up the order…", "A procurar o pedido…") },
        { w: "in", cp: 2, ty: 1200, h: L("📦 Pedido #1042: enviado ayer. Llega mañana 🚚", "📦 Ordine #1042: spedito ieri. Arriva domani 🚚", "📦 Order #1042: shipped yesterday. Arrives tomorrow 🚚", "📦 Pedido #1042: enviado ontem. Chega amanhã 🚚") + time("10:11") },
        { w: "out", cp: 3, ty: 700, h: L("¡Genial, gracias!", "Ottimo, grazie!", "Great, thanks!", "Ótimo, obrigado!") + time("10:12") },
      ],
    },
    {
      id: "cita",
      label: "🗓️ " + L("Pedir cita", "Prenota", "Book a call", "Agendar"),
      caps: [
        ["🗓️", L("Agenda citas solo", "Prenota da solo", "Books on its own", "Agenda sozinho"), L("Sin operador.", "Senza operatore.", "No operator.", "Sem operador.")],
        ["📝", L("Recoge los datos", "Raccoglie i dati", "Collects the data", "Recolhe os dados"), L("Nombre y email.", "Nome ed email.", "Name & email.", "Nome e email.")],
        ["📅", L("Conectado al calendario", "Collegato al calendario", "Calendar-connected", "Ligado ao calendário"), L("Crea el evento.", "Crea l'evento.", "Creates the event.", "Cria o evento.")],
        ["🔗", L("Envía Zoom + email", "Invia Zoom + email", "Sends Zoom + email", "Envia Zoom + email"), L("Confirmación auto.", "Conferma automatica.", "Auto confirmation.", "Confirmação auto.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1000, h: L("Quiero reservar una cita", "Voglio prenotare un appuntamento", "I'd like to book a call", "Quero marcar uma reunião") + time("12:53") },
        { w: "in", cp: 1, ty: 900, h: L("¡Claro! ¿Tu nombre?", "Certo! Il tuo nome?", "Sure! Your name?", "Claro! O teu nome?") + time("12:53") },
        { w: "out", cp: 1, ty: 700, h: "Marco Rossi" + time("12:54") },
        { w: "in", cp: 1, ty: 700, h: L("¿Tu email?", "La tua email?", "Your email?", "O teu email?") + time("12:54") },
        { w: "out", cp: 1, ty: 800, h: "marco.rossi@email.com" + time("12:54") },
        { w: "in", cp: 2, ty: 1200, h: L("Horarios: 1) Lun 10:00 · 2) Mar 11:00 (1/2)", "Orari: 1) Lun 10:00 · 2) Mar 11:00 (1/2)", "Slots: 1) Mon 10:00 · 2) Tue 11:00 (1/2)", "Horários: 1) Seg 10:00 · 2) Ter 11:00 (1/2)") + time("12:54") },
        { w: "out", cp: 2, ty: 500, h: "2" + time("12:55") },
        { w: "psys", cp: 2, hold: 1500, h: L("Creando la cita…", "Creo l'appuntamento…", "Creating the appointment…", "A criar a marcação…") },
        { w: "in", cp: 3, ty: 1300, h: L("✅ ¡Cita confirmada! Mar 11:00. Zoom + calendario por email 👋", "✅ Appuntamento confermato! Mar 11:00. Zoom + calendario via email 👋", "✅ Booked! Tue 11:00. Zoom + calendar by email 👋", "✅ Marcação confirmada! Ter 11:00. Zoom + calendário por email 👋") + time("12:55") },
      ],
    },
    {
      id: "invoice",
      label: "🧾 " + L("Factura", "Fattura", "Invoice", "Fatura"),
      caps: [
        ["💬", L("Entiende la petición", "Capisce la richiesta", "Understands the ask", "Entende o pedido"), L("Solo hay que pedirla.", "Basta chiederla.", "Just ask for it.", "Basta pedir.")],
        ["🔎", L("Encuentra el pedido", "Trova l'ordine", "Finds the order", "Encontra o pedido"), L("En el sistema.", "Nel gestionale.", "In the system.", "No sistema.")],
        ["📄", L("Envía el PDF", "Invia il PDF", "Sends the PDF", "Envia o PDF"), L("Por WhatsApp.", "Su WhatsApp.", "Over WhatsApp.", "Por WhatsApp.")],
        ["✅", L("Todo en el chat", "Tutto in chat", "All in chat", "Tudo no chat"), L("Sin emails.", "Senza email.", "No emails.", "Sem emails.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1000, h: L("Necesito la factura de mi compra", "Mi serve la fattura del mio acquisto", "I need the invoice for my purchase", "Preciso da fatura da minha compra") + time("10:11") },
        { w: "in", cp: 1, ty: 800, h: L("¡Claro! La busco…", "Certo! La cerco…", "Sure! Let me find it…", "Claro! Vou procurar…") + time("10:11") },
        { w: "psys", cp: 1, hold: 1300, h: L("Buscando pedido…", "Cerco l'ordine…", "Looking up the order…", "A procurar o pedido…") },
        { w: "in", cp: 1, ty: 1100, h: L("📦 Pedido #1042 — 49,90€", "📦 Ordine #1042 — 49,90€", "📦 Order #1042 — €49.90", "📦 Pedido #1042 — 49,90€") + time("10:11") },
        { w: "in", cp: 2, ty: 1000, h: fileCard("factura-1042.pdf", "86 KB") + time("10:12") },
        { w: "in", cp: 3, ty: 800, h: L("Aquí tienes ✅", "Eccola ✅", "Here it is ✅", "Aqui está ✅") + time("10:12") },
        { w: "out", cp: 3, ty: 600, h: L("¡Gracias!", "Grazie!", "Thanks!", "Obrigado!") + time("10:12") },
      ],
    },
    {
      id: "pricing",
      label: "💲 " + L("Precios", "Prezzi", "Pricing", "Preços"),
      caps: [
        ["💲", L("Conoce los planes", "Conosce i piani", "Knows the plans", "Conhece os planos"), L("Precios al día.", "Prezzi aggiornati.", "Up-to-date prices.", "Preços atualizados.")],
        ["📋", L("Detalle claro", "Dettaglio chiaro", "Clear details", "Detalhe claro"), L("Qué incluye cada plan.", "Cosa include ogni piano.", "What each plan includes.", "O que cada plano inclui.")],
        ["🌍", L("Multilingüe", "Multilingue", "Multilingual", "Multilíngue"), L("En su idioma.", "Nella sua lingua.", "In their language.", "No seu idioma.")],
        ["📅", L("Listo para demo", "Pronto per la demo", "Ready to demo", "Pronto para demo"), L("Cierra en el chat.", "Chiude in chat.", "Closes in chat.", "Fecha no chat.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1000, h: L("¿Cuánto cuesta el plan Pro?", "Quanto costa il piano Pro?", "How much is the Pro plan?", "Quanto custa o plano Pro?") + time("12:30") },
        { w: "in", cp: 1, ty: 1300, h: L("💲 Plan Pro: <b>49€/mes</b> — chats ilimitados, multilingüe y soporte.", "💲 Piano Pro: <b>49€/mese</b> — chat illimitate, multilingua e supporto.", "💲 Pro plan: <b>€49/mo</b> — unlimited chats, multilingual & support.", "💲 Plano Pro: <b>49€/mês</b> — chats ilimitados, multilíngue e suporte.") + time("12:30") },
        { w: "in", cp: 3, ty: 900, h: L("¿Quieres una demo? 📅", "Vuoi una demo? 📅", "Want a demo? 📅", "Queres uma demo? 📅") + time("12:30") },
        { w: "out", cp: 3, ty: 600, h: L("Sí", "Sì", "Yes", "Sim") + time("12:31") },
        { w: "in", cp: 3, ty: 900, h: L("¡Genial! Te la agendo 👍", "Ottimo! Te la fisso 👍", "Great! I'll book it 👍", "Ótimo! Vou agendar 👍") + time("12:31") },
      ],
    },
    {
      id: "push",
      label: "📣 " + L("Promo Push", "Promo Push", "Push promo", "Promo Push"),
      caps: [
        ["📣", L("Campañas push", "Campagne push", "Push campaigns", "Campanhas push"), L("Tú escribes primero.", "Scrivi tu per primo.", "You message first.", "Escreves tu primeiro.")],
        ["🎯", L("Segmenta clientes", "Segmenta i clienti", "Segments customers", "Segmenta clientes"), L("Al público adecuado.", "Al pubblico giusto.", "The right audience.", "Ao público certo.")],
        ["🎟️", L("Cupones y ofertas", "Coupon e offerte", "Coupons & offers", "Cupões e ofertas"), L("Directo en WhatsApp.", "Diretto su WhatsApp.", "Right in WhatsApp.", "Direto no WhatsApp.")],
        ["📈", L("Reactiva ventas", "Riattiva le vendite", "Reactivates sales", "Reativa vendas"), L("Vuelven los dormidos.", "Tornano i dormienti.", "Win back dormant clients.", "Recupera clientes parados.")],
      ],
      s: [
        { w: "in", cp: 0, pre: 300, ty: 1300, h: L("🎉 ¡Hola! Oferta de lanzamiento: -30% en el plan anual este mes 🚀", "🎉 Ciao! Offerta lancio: -30% sul piano annuale questo mese 🚀", "🎉 Hi! Launch offer: -30% on the annual plan this month 🚀", "🎉 Olá! Oferta de lançamento: -30% no plano anual este mês 🚀") + time("17:00") },
        { w: "out", cp: 1, ty: 800, h: L("¿Cómo lo aprovecho?", "Come ne approfitto?", "How do I get it?", "Como aproveito?") + time("17:01") },
        { w: "in", cp: 2, ty: 1300, h: L("Usa el código 🎟️ <b>LAUNCH30</b> al pagar. ¡Hasta fin de mes!", "Usa il codice 🎟️ <b>LAUNCH30</b> al pagamento. Fino a fine mese!", "Use code 🎟️ <b>LAUNCH30</b> at checkout. Until month end!", "Usa o código 🎟️ <b>LAUNCH30</b> no pagamento. Até ao fim do mês!") + time("17:01") },
        { w: "out", cp: 3, ty: 600, h: L("¡Gracias! 🙌", "Grazie! 🙌", "Thanks! 🙌", "Obrigado! 🙌") + time("17:01") },
      ],
    },
    {
      id: "audio",
      label: "🎤 Audio",
      caps: [
        ["🎤", L("El cliente habla", "Il cliente parla", "The customer speaks", "O cliente fala"), L("No escribe.", "Non scrive.", "No typing.", "Não escreve.")],
        ["🎧", L("Entiende el audio", "Capisce l'audio", "Understands the audio", "Entende o áudio"), L("Escucha e interpreta.", "Ascolta e interpreta.", "Listens & interprets.", "Ouve e interpreta.")],
        ["🔊", L("Responde con audio", "Risponde con audio", "Replies with audio", "Responde com áudio"), L("El bot manda voz.", "Il bot manda voce.", "The bot sends voice.", "O bot envia voz.")],
        ["⚡", L("Cómodo y rápido", "Comodo e veloce", "Quick & easy", "Cómodo e rápido"), L("Como una llamada.", "Come una telefonata.", "Like a call.", "Como uma chamada.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 900, rec: true, h: voice("0:06") + time("16:40") },
        { w: "in", cp: 1, ty: 1100, h: L("Lo he escuchado 🎧 Te confirmo: tu pedido llega mañana.", "L'ho ascoltato 🎧 Confermo: il tuo ordine arriva domani.", "Got your audio 🎧 Confirmed: your order arrives tomorrow.", "Ouvi 🎧 Confirmo: o teu pedido chega amanhã.") + time("16:40") },
        { w: "in", cp: 2, ty: 1000, rec: true, h: voice("0:08") + time("16:41") },
        { w: "out", cp: 3, ty: 700, h: L("¡Perfecto, gracias!", "Perfetto, grazie!", "Perfect, thanks!", "Perfeito, obrigado!") + time("16:41") },
      ],
    },
    {
      id: "human",
      label: "🙋 " + L("Soporte humano", "Supporto umano", "Human support", "Suporte humano"),
      caps: [
        ["🧠", L("Detecta el caso", "Rileva il caso", "Spots the case", "Deteta o caso"), L("Sabe cuándo no basta.", "Sa quando non basta.", "Knows when it's not enough.", "Sabe quando não chega.")],
        ["🙋", L("Avisa al agente", "Avvisa l'agente", "Alerts an agent", "Avisa o agente"), L("Al instante.", "All'istante.", "Instantly.", "Ao instante.")],
        ["👩‍💼", L("Toma el control", "Prende il controllo", "Takes over", "Assume o controlo"), L("Pausa el bot.", "Mette in pausa il bot.", "Pauses the bot.", "Pausa o bot.")],
        ["🤝", L("Continuidad total", "Continuità totale", "Seamless handover", "Continuidade total"), L("El cliente ni lo nota.", "Il cliente non se ne accorge.", "The customer never notices.", "O cliente nem nota.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1000, h: L("Tengo un problema con mi pedido 😡", "Ho un problema con il mio ordine 😡", "I have a problem with my order 😡", "Tenho um problema com o meu pedido 😡") + time("19:05") },
        { w: "in", cp: 0, ty: 1000, h: L("Lo siento 🙏 Te paso a un agente.", "Mi dispiace 🙏 Ti passo a un agente.", "So sorry 🙏 Passing you to an agent.", "Lamento 🙏 Passo-te a um agente.") + time("19:05") },
        { w: "psysblue", cp: 1, hold: 1500, h: L("Un agente se está conectando…", "Un agente si sta collegando…", "An agent is connecting…", "Um agente está a ligar-se…") },
        { w: "op", cp: 2, ty: 1100, name: L("Laura · Soporte", "Laura · Supporto", "Laura · Support", "Laura · Suporte"), h: L("Soy Laura, del equipo 😊", "Sono Laura, del team 😊", "I'm Laura, from the team 😊", "Sou a Laura, da equipa 😊") + time("19:06") },
        { w: "op", cp: 3, ty: 1100, h: L("Lo soluciono ahora mismo + un cupón por las molestias.", "Lo risolvo subito + un buono per il disturbo.", "I'll fix it now + a coupon for the trouble.", "Resolvo já + um cupão pelo incómodo.") + time("19:06") },
        { w: "out", cp: 3, ty: 600, h: L("¡Gracias!", "Grazie!", "Thanks!", "Obrigado!") + time("19:07") },
      ],
    },
    {
      id: "arabic",
      label: "🌍 " + L("Multilingüe", "Multilingue", "Multilingual", "Multilíngue"),
      caps: [
        ["🌍", L("Detecta el idioma", "Rileva la lingua", "Detects the language", "Deteta o idioma"), L("Sin configurar nada.", "Senza configurare nulla.", "Zero setup.", "Sem configurar nada.")],
        ["🗣️", L("Cualquier idioma", "Qualsiasi lingua", "Any language", "Qualquer idioma"), L("Entiende y responde.", "Capisce e risponde.", "Understands & replies.", "Entende e responde.")],
        ["💬", L("Respuesta nativa", "Risposta nativa", "Native reply", "Resposta nativa"), L("Natural y local.", "Naturale e locale.", "Natural & local.", "Natural e local.")],
        ["🤝", L("Sin barreras", "Senza barriere", "No barriers", "Sem barreiras"), L("Clientes de todo el mundo.", "Clienti da tutto il mondo.", "Customers worldwide.", "Clientes do mundo todo.")],
      ],
      s: [
        { w: "out", cp: 0, pre: 300, ty: 1000, h: arabic("مرحبا، هل يمكنني الطلب أونلاين؟") + time("11:20") },
        { w: "in", cp: 1, ty: 1200, h: arabic("مرحبا! 👋 نعم، يمكنك الطلب مباشرة من هنا 🛒") + time("11:20") },
        { w: "out", cp: 1, ty: 800, h: arabic("كم تكلفة الشحن؟") + time("11:21") },
        { w: "in", cp: 2, ty: 1000, h: arabic("🚚 الشحن مجاني للطلبات فوق <b>50€</b>") + time("11:21") },
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
  variant = "laundry",
  onTryNow,
  tryLabel,
}: {
  lang?: string
  variant?: "laundry" | "generic"
  onTryNow?: () => void
  tryLabel?: string
}) {
  const L = norm(lang)
  const brand = variant === "generic" ? "eChatbot" : "Demowash"
  const scenes = useMemo(
    () => (variant === "generic" ? buildGenericScenes(L) : buildLaundryScenes(L)),
    [L, variant]
  )
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

      <div className="dws-head">
        <button
          type="button"
          aria-label="prev"
          className="dws-nav"
          onClick={() => setActive((a) => (a - 1 + scenes.length) % scenes.length)}
        >
          ‹
        </button>
        <div className="dws-title" key={active}>
          {scene.label}
        </div>
        <button
          type="button"
          aria-label="next"
          className="dws-nav"
          onClick={() => setActive((a) => (a + 1) % scenes.length)}
        >
          ›
        </button>
      </div>

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
.dws{--g600:#16a34a;--g700:#15803d;--g50:#f0fdf4;--g100:#dcfce7;--line:#e5e7eb;--mut:#6b7280;--wa-out:#d9fdd3;--wa-bg:#efeae2;font-family:-apple-system,"Segoe UI",Helvetica,sans-serif;color:#0b1220;container-type:inline-size}
.dws-head{display:flex;align-items:center;justify-content:center;gap:16px;padding:14px 16px 6px;background:linear-gradient(180deg,#ecfdf3,var(--g50))}
.dws-title{text-align:center;font-size:23px;font-weight:800;letter-spacing:-.01em;background:linear-gradient(90deg,var(--g700),var(--g600));-webkit-background-clip:text;background-clip:text;color:transparent;animation:dws-slidein .45s cubic-bezier(.22,1,.36,1)}
@keyframes dws-slidein{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
.dws-nav{width:42px;height:42px;border-radius:999px;border:1.5px solid var(--g100);background:#fff;color:var(--g700);font-size:24px;line-height:1;cursor:pointer;display:grid;place-items:center;transition:.18s;flex:0 0 auto;box-shadow:0 4px 12px -6px rgba(22,163,74,.3)}
.dws-nav:hover{background:var(--g600);color:#fff;border-color:var(--g600);transform:scale(1.08)}
.dws-nav:active{transform:scale(.95)}
.dws-body{display:grid;grid-template-columns:1fr;gap:22px;padding:18px 20px 24px;background:linear-gradient(180deg,var(--g50),#fff);align-items:center;justify-items:center;animation:dws-fadein .5s ease}
@container (min-width:760px){.dws-body{grid-template-columns:360px 1fr;gap:38px;padding:18px 34px 24px;justify-items:stretch}}
@keyframes dws-fadein{from{opacity:0}to{opacity:1}}
.dws-phone{width:300px;height:560px;background:#0b1220;border-radius:42px;padding:11px;box-shadow:0 28px 56px -22px rgba(8,15,30,.55);position:relative;margin:0 auto}
.dws-notch{position:absolute;top:11px;left:50%;transform:translateX(-50%);width:110px;height:21px;background:#0b1220;border-radius:0 0 16px 16px;z-index:6}
.dws-screen{width:100%;height:100%;border-radius:32px;overflow:hidden;display:flex;flex-direction:column;background:var(--wa-bg);background-image:radial-gradient(rgba(0,0,0,.04) 1px,transparent 1px);background-size:16px 16px}
.dws-ph{background:#075e54;color:#fff;padding:30px 13px 10px;display:flex;align-items:center;gap:9px;flex:0 0 auto;transition:.3s}
.dws-ph.op{background:#1d4ed8}
.dws-ph .dws-av{width:32px;height:32px;border-radius:50%;background:#25d366;display:grid;place-items:center;font-size:15px}
.dws-ph.op .dws-av{background:#fbbf24}
.dws-nm{font-weight:600;font-size:13.5px}.dws-st{font-size:10.5px;opacity:.85}
.dws-msgs{flex:1;overflow:hidden;padding:12px 11px;display:flex;flex-direction:column;gap:6px;justify-content:flex-end}
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
.dws-cap{display:flex;gap:14px;align-items:center;background:#fff;border:1.5px solid var(--line);border-radius:15px;padding:14px 18px;opacity:.7;transition:.4s}
.dws-cap.on{opacity:1;border-color:var(--g600);box-shadow:0 16px 32px -16px rgba(22,163,74,.5);transform:translateX(4px)}
.dws-cap-ic{width:46px;height:46px;border-radius:13px;background:var(--g50);display:grid;place-items:center;font-size:23px;flex:0 0 auto}
.dws-cap.on .dws-cap-ic{background:var(--g100)}
.dws-cap h4{font-size:15.5px;margin:0 0 2px}.dws-cap p{font-size:13px;color:var(--mut);margin:0}
.dws-try{align-self:flex-start;background:var(--g600);color:#fff;border:none;font-weight:700;font-size:15px;border-radius:999px;padding:13px 26px;cursor:pointer;box-shadow:0 12px 26px -12px rgba(22,163,74,.7)}
.dws-try:hover{background:var(--g700)}
.dws-dots{display:flex;justify-content:center;align-items:center;gap:9px;padding:18px 16px 22px;background:#fff;flex-wrap:wrap}
.dws-dot{width:10px;height:10px;border-radius:999px;background:#cbd5e1;border:none;cursor:pointer;transition:.25s;padding:0}
.dws-dot:hover{background:#9ca3af}
.dws-dot.on{background:var(--g600);width:30px}
`
