import type { ShowcaseContent } from "./HomeShowcase"

/**
 * The story the Pro Loco landing page plays: ONE guest's whole holiday, from
 * the first "ciao" to the campaign that brings them back next year (Andrea,
 * 2026-09-14: "mi piacerebbe nella chat iniziale far vedere tutto il viaggio
 * dell'utente… ciao, welcome message, fino a fine vacanza, poi feedback e
 * push pubblicitario").
 *
 * Kept OUT of HomeShowcase.tsx on purpose: that component is the stage, this
 * is one of the plays. The laundry story it ships with is still the default
 * and is untouched.
 *
 * 🚨 Every capability below exists in the product — welcome message, photos
 * and video, multilingual replies, appointment booking, the flow runtime, the
 * end-of-stay feedback request and consent-gated campaigns. Nothing here is a
 * feature we do not have.
 *
 * Italian only: this page is sold to Italian tourist offices. The chatbot
 * itself answers guests in their own language — which is what step 4 shows.
 *
 * 🚨 NO place names at all — not even invented ones (Andrea, 2026-09-15:
 * "togli tutti i riferimenti a qualsiasi posto"). No town, no named refuge,
 * no named waterfall, no phone number. The page is sold to ANY Pro Loco, so
 * it must not read as one specific place's demo; and a real-looking phone
 * number on a public landing page is somebody's line ringing.
 *
 * The answers stay concrete through DETAILS instead of names — "1h45 di
 * salita, aperto fino a settembre", "venti minuti, ombra tutto il percorso".
 * That is what shows the assistant is reading loaded content rather than
 * improvising, which is the whole point of the demo. Keep it that way: if a
 * line ever needs a name to make sense, rewrite the line, don't add a name.
 */
export const proLocoShowcaseContent: ShowcaseContent = {
  title: "Accoglie, consiglia, ricorda.",
  subtitle:
    "Un assistente che risponde al turista prima, durante e dopo la vacanza — su WhatsApp, nella sua lingua, 24 ore su 24.",
  everyLang: "Parla ogni lingua del mondo.",
  online: "online",
  opLabel: "PRO LOCO",
  voiceLabel: "Messaggio vocale",

  // Ordered to match the story: the highlight travels top→bottom as it plays.
  features: [
    {
      icon: "🎬",
      title: "Video di benvenuto",
      desc: "Chi scrive per la prima volta viene accolto con un video del territorio.",
    },
    {
      icon: "🏔️",
      title: "Tutto il territorio",
      desc: "Hotel, rifugi, sentieri, sagre, borghi, numeri utili: risponde con quello che avete caricato voi.",
    },
    {
      icon: "📸",
      title: "Foto e video",
      desc: "Ogni luogo si porta dietro le sue immagini: una cascata si capisce vedendola.",
    },
    {
      icon: "🌍",
      title: "Ogni ospite nella sua lingua",
      desc: "Voi scrivete in italiano una volta sola. Lui risponde in tedesco, francese, inglese.",
    },
    {
      icon: "🧭",
      title: "Percorsi guidati",
      desc: "Quando servono più risposte in fila, l'assistente conduce l'ospite passo per passo.",
    },
    {
      icon: "⭐",
      title: "Feedback di fine vacanza",
      desc: "Il giorno dopo la partenza chiede com'è andata, e la risposta resta sulla scheda dell'ospite.",
    },
    {
      icon: "📣",
      title: "Notifiche push",
      desc: "La sagra, la neve, l'offerta di primavera — solo a chi ha dato il consenso, revocabile sempre.",
    },
  ],

  script: [
    // 1 — Welcome
    {
      feature: 0,
      msgs: [
        {
          role: "out",
          text: "Ciao e benvenuti! 👋 Sono l'assistente della Pro Loco. Vi do una mano con alloggi, sentieri, eventi e tutto il resto — a qualsiasi ora.",
        },
        {
          role: "out",
          video: true,
          text: "Ecco una breve presentazione del luogo 🎥",
        },
        { role: "out", text: "Quanti siete e quanto vi fermate?" },
        { role: "in", text: "Io e mia moglie, dal 20 al 26 🙂" },
      ],
    },

    // 2 — The territory answers
    {
      feature: 1,
      msgs: [
        { role: "in", text: "Cerchiamo un rifugio dove mangiare in quota" },
        {
          role: "out",
          text: "Il rifugio in quota — 1h45 di salita, aperto fino a settembre. Cucina casalinga, meglio prenotare: trovate il numero sulla scheda.",
        },
        {
          role: "out",
          text: "Se preferite qualcosa di più corto, la cascata è una passeggiata facile dal ponte di legno.",
        },
      ],
    },

    // 3 — Photos
    {
      feature: 2,
      msgs: [
        { role: "in", text: "Com'è il sentiero della cascata?" },
        {
          role: "out",
          image: true,
          text: "Eccola 📸 Venti minuti a piedi, ombra tutto il percorso — perfetta anche col caldo.",
        },
      ],
    },

    // 4 — Another language, same assistant
    {
      feature: 3,
      reset: true,
      msgs: [
        { role: "in", text: "Guten Tag, gibt es hier einen Wanderweg für Kinder?" },
        {
          role: "out",
          text: "Guten Tag! 👋 Ja — der Weg zum Wasserfall ist flach und schattig, etwa 20 Minuten. Ideal mit Kindern.",
          sub: "L'ospite scrive in tedesco, l'assistente risponde in tedesco. I contenuti restano scritti in italiano.",
        },
      ],
    },

    // 5 — Flow: step-by-step
    {
      feature: 4,
      reset: true,
      msgs: [
        { role: "in", text: "Vorrei un programma per i nostri giorni" },
        {
          role: "out",
          text: "Volentieri. Preferite camminare, o qualcosa di più tranquillo?",
        },
        { role: "in", text: "Camminare, ma niente di estremo" },
        { role: "out", text: "C'è qualcosa che vi limita? Un cane, un'intolleranza, l'auto?" },
        { role: "in", text: "Siamo senza auto" },
        {
          role: "out",
          text: "Allora vi preparo tre giornate raggiungibili a piedi o col bus, con una sosta in rifugio 🧭",
          sub: "Una domanda alla volta, nell'ordine giusto: è il percorso guidato che decide cosa chiedere.",
        },
      ],
    },

    // 6 — End of stay: feedback
    {
      feature: 5,
      reset: true,
      msgs: [
        {
          role: "out",
          text: "Buongiorno! Ieri siete ripartiti 🏔️ Posso chiedervi com'è andata?",
          sub: "Parte da solo il giorno dopo la partenza, una volta sola per vacanza.",
        },
        {
          role: "in",
          text: "Benissimo! Bellissimo il sentiero della cascata, peccato la pioggia di giovedì ⭐⭐⭐⭐",
        },
        {
          role: "out",
          text: "Grazie di cuore 🙏 Me lo segno: la prossima volta vi propongo qualcosa al coperto per i giorni di pioggia.",
        },
      ],
    },

    // 7 — Push campaign, months later
    {
      feature: 6,
      reset: true,
      msgs: [
        {
          role: "out",
          image: true,
          text: "Il Carnevale è dal 12 al 16 febbraio 🎭 Le maschere tradizionali sfilano per le borgate. Vi aspettiamo!",
          sub: "Inviato solo a chi ha dato il consenso. Basta una parola per non riceverne più.",
        },
        { role: "in", text: "Che bello! Quest'anno veniamo d'inverno 😍" },
      ],
    },
  ],
}
