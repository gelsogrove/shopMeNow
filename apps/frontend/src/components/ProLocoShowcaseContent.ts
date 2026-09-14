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
 */
export const proLocoShowcaseContent: ShowcaseContent = {
  title: "Dal primo “ciao” al ritorno l'anno dopo.",
  subtitle:
    "Un solo assistente accoglie l'ospite, gli organizza la vacanza, gli prenota il tavolo, gli chiede com'è andata e lo invita a tornare. Su WhatsApp, in ogni lingua, 24 ore su 24.",
  everyLang: "Parla ogni lingua del mondo.",
  online: "online",
  opLabel: "PRO LOCO",
  voiceLabel: "Messaggio vocale",

  // Ordered to match the story: the highlight travels top→bottom as it plays.
  features: [
    {
      icon: "👋",
      title: "Messaggio di benvenuto",
      desc: "Accoglie chi scrive per la prima volta, anche con un video del territorio.",
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
      icon: "📅",
      title: "Prenota l'appuntamento",
      desc: "Visite guidate, tavoli, noleggi: fissa l'orario e lo ricorda all'ospite.",
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
        { role: "in", text: "Ciao! Veniamo a Sappada la settimana prossima 🏔️" },
        {
          role: "out",
          text: "Ciao e benvenuti! 👋 Sono l'assistente della Pro Loco. Vi do una mano con alloggi, sentieri, eventi e tutto il resto — a qualsiasi ora.",
        },
        {
          role: "out",
          video: true,
          text: "Intanto guardate com'è il posto in questa stagione 🎥",
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
          text: "Rifugio Sorgenti del Piave — 1h45 di salita, aperto fino a settembre. Cucina casalinga, meglio prenotare: 0435 469…",
        },
        {
          role: "out",
          text: "Se preferite qualcosa di più corto, le Cascatelle sono una passeggiata facile dal ponte di legno.",
        },
      ],
    },

    // 3 — Photos
    {
      feature: 2,
      msgs: [
        { role: "in", text: "Come sono le Cascatelle?" },
        {
          role: "out",
          image: true,
          text: "Eccole 📸 Venti minuti a piedi, ombra tutto il percorso — perfette anche col caldo.",
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
          text: "Guten Tag! 👋 Ja — der Weg zu den Cascatelle ist flach und schattig, etwa 20 Minuten. Ideal mit Kindern.",
          sub: "L'ospite scrive in tedesco, l'assistente risponde in tedesco. I contenuti restano scritti in italiano.",
        },
      ],
    },

    // 5 — Appointment
    {
      feature: 4,
      reset: true,
      msgs: [
        { role: "in", text: "C'è una visita guidata al borgo?" },
        {
          role: "out",
          text: "Sì, giovedì alle 10:00, ritrovo davanti alla chiesa. Vi segno in due?",
        },
        { role: "in", text: "Perfetto, sì" },
        {
          role: "out",
          status: true,
          text: "Appuntamento registrato…",
        },
        {
          role: "out",
          text: "Fatto ✅ Giovedì 24 alle 10:00, due posti. Vi mando un promemoria il giorno prima.",
        },
      ],
    },

    // 6 — Flow: step-by-step
    {
      feature: 5,
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

    // 7 — End of stay: feedback
    {
      feature: 6,
      reset: true,
      msgs: [
        {
          role: "out",
          text: "Buongiorno! Ieri siete ripartiti da Sappada 🏔️ Posso chiedervi com'è andata?",
          sub: "Parte da solo il giorno dopo la partenza, una volta sola per vacanza.",
        },
        {
          role: "in",
          text: "Benissimo! Bellissime le Cascatelle, peccato la pioggia di giovedì ⭐⭐⭐⭐",
        },
        {
          role: "out",
          text: "Grazie di cuore 🙏 Me lo segno: la prossima volta vi propongo qualcosa al coperto per i giorni di pioggia.",
        },
      ],
    },

    // 8 — Push campaign, months later
    {
      feature: 7,
      reset: true,
      msgs: [
        {
          role: "out",
          image: true,
          text: "Il Carnevale di Sappada è dal 12 al 16 febbraio 🎭 Le maschere tradizionali sfilano per le borgate. Vi aspettiamo!",
          sub: "Inviato solo a chi ha dato il consenso. Basta una parola per non riceverne più.",
        },
        { role: "in", text: "Che bello! Quest'anno veniamo d'inverno 😍" },
      ],
    },
  ],
}
