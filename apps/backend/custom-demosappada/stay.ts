// The stay lifecycle: when a finished holiday is archived and rolled over,
// how many days are left, the campaign tags, and the QUESTO OSPITE block
// that renders the whole profile — and dictates the next intake question —
// for the model. The intake ORDER itself lives in intake-machine.ts.

import type { Settings, StayProfile } from './agent.js'
import { nextIntakeStep, type IntakeContext } from './intake-machine.js'
import { TIMEZONE } from './weather.js'

/**
 * Tags the module maintains on the customer record.
 *
 * They exist for the campaign side of the product: a promotion for tonight's
 * dinner must reach only the guests who are IN TOWN tonight, and an offer on
 * accommodation only those who agreed to hear about accommodation. Segmenting
 * at send time is what makes the consent worth something.
 *
 * `INLOCO` is DERIVED from the stay dates, never asked and never set by the
 * model: the guest does not announce their departure, the calendar does.
 */
/**
 * Renewed consent for the NEXT holiday, given on the way home.
 *
 * The counterpart of INLOCO: that one says "is here now" and is kept in sync
 * from the dates; this one says "wants to hear from us before coming back",
 * and is set only when the guest says yes to the renewal (contratto.md).
 */
export const TAG_NOT_IN_LOCO = 'NO-INLOCO'
/**
 * A prospect writing from home, with no stay at all (contratto.md,
 * 2026-08-27). Deliberately NOT `NO-INLOCO`: that one records a CONSENT (the
 * renewal for the next holiday) and reusing it here would drop people who
 * never agreed to anything into a consented campaign segment. This tag only
 * says who they are; any push to them still needs its own consent.
 */
export const TAG_REMOTE_PROSPECT = 'NO-A-SAPPADA'
export const TAG_INTEREST_EVENTS = 'INTERESSE-EVENTI'
export const TAG_INTEREST_LODGING = 'INTERESSE-ALLOGGI'
export const TAG_INTEREST_OFFERS = 'INTERESSE-OFFERTE'

// isCurrentlyInTown and TAG_IN_LOCO moved to shared/stay-inloco.ts: the
// scheduler's stale-inloco-cleanup job needs the SAME derivation for guests
// who departed and never wrote again. One authority, imported by both.

/**
 * Days after departure before the finished stay is archived.
 *
 * Three, not zero: the days right after leaving are when the goodbye happens
 * — the feedback, the consent, the "we left a jacket at the rifugio". Wiping
 * the stay there would take the conversation's subject away mid-sentence.
 *
 * After that the holiday is closed: the profile is archived, the itinerary
 * and what-they-did are cleared, and the guest goes back to being a contact.
 * When they write again — next week or next February — the assistant starts
 * a fresh stay and asks the dates anew, which is exactly the service being
 * offered to them a second time.
 */
const ARCHIVE_STAY_AFTER_DEPARTURE_DAYS = 3

/**
 * Has this guest come back for a fresh holiday?
 *
 * Detected from the calendar, never asked: a returning guest does not
 * announce a new stay, they just say hello. Without this the profile stays
 * frozen on last summer — the assistant keeps insisting the holiday is over,
 * never asks the new dates, and refuses to propose the Cascatelle because
 * they were done in August (Andrea, 2026-08-23).
 */
export function isStayOverAndClosed(profile: StayProfile | null, now: Date): boolean {
  const departure = profile?.departureDate
  if (!departure) return false
  const departureMs = Date.parse(`${departure}T23:59:59`)
  if (Number.isNaN(departureMs)) return false
  const daysSince = (now.getTime() - departureMs) / 86_400_000
  return daysSince > ARCHIVE_STAY_AFTER_DEPARTURE_DAYS
}

/**
 * Roll the current stay into history and clear what belongs to one holiday.
 *
 * Kept: where they come from, who they are, the consent (a legal record, not
 * a holiday detail) and everything already archived.
 * Cleared: dates, the questions asked, what they did, the itinerary answer —
 * all of it is about a trip that is over.
 */
export function rolloverStay(profile: StayProfile): StayProfile {
  const history = [...(profile.pastStays ?? [])]
  if (profile.arrivalDate || profile.departureDate || profile.doneAlready) {
    history.push({
      arrivalDate: profile.arrivalDate,
      departureDate: profile.departureDate,
      doneAlready: profile.doneAlready,
      // What they thought of it is the most valuable thing the stay produced:
      // it is what makes the next welcome-back worth reading.
      feedback: profile.lastFeedback,
    })
  }

  return {
    // Facts that outlive a single holiday: who they are and where they come
    // from do not change between one August and the next.
    adults: profile.adults,
    children: profile.children,
    childrenAges: profile.childrenAges,
    seniors: profile.seniors,
    origin: profile.origin,
    consentAsked: profile.consentAsked,
    // Told once, remembered for good: a returning guest already knows how to
    // opt out, and hearing it again on a new holiday reads like nagging.
    pushOptOutHintSent: profile.pushOptOutHintSent,
    // Written by a person at the Pro Loco, never by this module. Wiping it
    // would delete someone else's work.
    operatorNotes: profile.operatorNotes,
    // The bot's own card goes with the holiday it described: "coppia senza
    // auto, la moglie è celiaca, 22-26 agosto" is about a stay that is over,
    // and carrying it into the next one filters a holiday nobody has
    // described yet (contratto.md: "cancelliamo le note e itinerario").
    //
    // Cleared HERE, at the rollover, not when the guest accepts the renewal:
    // the renewal is asked on the last day, while they are still in Sappada
    // and can still write — wiping the card then would strip their coeliac
    // and their lack of a car mid-conversation (conflitto sciolto con Andrea,
    // opzione C, 2026-08-25).
    notes: undefined,
    // Kept in history, cleared from the live stay.
    pastStays: history.slice(-5),
    // Everything below is deliberately absent: a new holiday, asked afresh.
    arrivalDate: undefined,
    departureDate: undefined,
    doneAlready: undefined,
    itinerary: undefined,
    // The plan belonged to the days that are over. Left behind it would be
    // presented as "il vostro programma" on the first turn of a holiday whose
    // dates we do not even know yet.
    itineraryPlan: undefined,
    // Both are about THIS trip: what limited them last winter (a plaster cast,
    // a pregnancy) and what they felt like doing then are not facts about the
    // person, and carrying them over silently filters a holiday they have not
    // described yet. Asked again, like the dates.
    constraints: undefined,
    interests: undefined,
    asked: [],
    // Consumed: the restart it asked for has just happened.
    restartRequested: undefined,
    intakeIntroSent: undefined,
    pendingRequest: undefined,
    pendingRequestCarried: undefined,
    feedbackGiven: undefined,
    lastFeedback: undefined,
    // videoSent is NOT cleared: they have seen the presentation once, and a
    // returning guest does not need to be introduced to Sappada again.
    videoSent: profile.videoSent,
  }
}

/**
 * Days of holiday left, or null when we do not know the departure.
 * Zero or negative means today is the last day (or it is already over).
 */
export function daysLeftInStay(profile: StayProfile | null, now: Date): number | null {
  const departure = profile?.departureDate
  if (!departure) return null
  const departureMs = Date.parse(`${departure}T23:59:59`)
  if (Number.isNaN(departureMs)) return null
  return Math.ceil((departureMs - now.getTime()) / 86_400_000)
}

/**
 * Render the stay for the model, with the days remaining computed HERE.
 *
 * The count is derived from `departureDate` on every turn, never stored:
 * "3 giorni" written down on Monday is wrong by Wednesday, and the whole
 * point of knowing the stay is to concentrate the suggestions into the time
 * that is actually left.
 */
/**
 * What formatStayBlock produced: the prompt text, and WHICH intake question it
 * put in front of the model.
 *
 * The key used to be a module-level `let` that the function assigned as a side
 * effect. Two turns being served at once on the same dyno shared it, so one
 * guest's pending question leaked into another's turn — and any turn that
 * returned early left the previous value standing (CLAUDE.md §10: no shared
 * state across conversations).
 */
/**
 * The intake steps, in the order they are put to the guest.
 *
 * A union rather than free strings: the key ties together the settings entry
 * that supplies the wording, the `asked` marker that retires it, and the
 * save_preferences enum — a typo in any one of them would otherwise make a question
 * repeat forever or vanish silently.
 */
export type IntakeKey =
  | 'location'
  | 'remoteNeeds'
  | 'party'
  | 'headcount'
  | 'stay'
  | 'composition'
  | 'childrenAges'
  | 'constraints'
  | 'interests'
  | 'itinerary'
  | 'consent'
  | 'name'

export interface StayBlock {
  text: string
  askedKey: string | null
  /** Every intake key shown this turn. All of them get marked as asked. */
  askedKeys: string[]
  /**
   * The configured wording dictated this turn. Carried out so the
   * one-question guard can tell OUR question — which may legitimately span
   * several sentences — from questions the model added on its own.
   */
  askedQuestion: string | null
}

/**
 * The exact sentence to put to the guest for this intake step.
 *
 * Resolution order, CLAUDE.md §1A: the workspace's own text (edited in the
 * backoffice and merged into settings by the host) → this module's
 * settings.json default → `null`, meaning nothing is asked at all.
 *
 * `null` is a real answer, not a failure to paper over: a question nobody
 * configured is better skipped than improvised by the model or sent in the
 * wrong language.
 */
export function intakeQuestionFor(key: IntakeKey, settings: Settings): string | null {
  const configured = settings.intakeQuestions?.[key]
  return configured?.trim() ? configured.trim() : null
}

export function formatStayBlock(
  profile: StayProfile | null,
  now: Date,
  returningGuest = false,
  /**
   * The guest's name, when the host already knows it (widget registration
   * form) or the `remember` tool has captured it. Passed in so the intake can
   * skip a question we already have the answer to — on WhatsApp there is no
   * form, and without asking, the assistant never learns it at all.
   */
  knownName: string | undefined,
  /** Carries `intakeQuestions` — the wording this block dictates. */
  settings: Settings,
): StayBlock {
  // A guest with no saved profile is precisely the one everything still has to
  // be asked of. Returning early here meant the FIRST message — the only turn
  // where the intake has not started at all — got no question and no key: the
  // model improvised a seven-day plan for two people it knew nothing about,
  // and the single-question guard stayed off because there was no pending key
  // to guard (Andrea, live, 2026-08-23).
  const stay: StayProfile = profile ?? ({} as StayProfile)

  const lines: string[] = []

  // First line in the block, on purpose: the guest's own words come before
  // anything else, including the welcome-back copy below. A request made
  // before the intake even had a chance to run — "un'escursione max 4h, 500m
  // dislivello, pranzo in rifugio" on the FIRST message — was answered with
  // only the welcome and the first intake question, and was gone again two
  // turns later once the guest had answered something else in between
  // (Andrea, 2026-08-28 live: "non hai risposto alla domanda"). The rule has
  // no exception for "it depends on who they are" (Andrea, 2026-08-28:
  // "devi rispondere e poi portare l'utente a rispondere alle tue domande") —
  // answer FIRST, even one line, even generic if the data is not all in yet,
  // THEN ask. Cleared by the model via save_preferences.pendingRequest the
  // moment it has actually served it.
  if (stay.pendingRequest) {
    lines.push(
      `RICHIESTA IN SOSPESO: "${stay.pendingRequest}"`,
      'Questa richiesta viene SEMPRE PRIMA di qualsiasi domanda tua, in questo messaggio: rispondi ad ' +
        'essa — anche in una riga, anche in modo generico se non hai ancora tutti i dati — e SOLO DOPO, ' +
        'in coda, fai la tua domanda. Non è una scelta legata a chi sia l\'ospite: vale sempre, senza ' +
        'eccezioni. Quando la tua risposta la soddisfa davvero, chiama save_preferences con ' +
        'pendingRequest="RISOLTO" così smette di essere ripetuta.',
    )
  }

  if (returningGuest && profile) {
    const last = stay.pastStays?.[stay.pastStays.length - 1]
    lines.push(
      'È TORNATO — nuova vacanza. Salutalo come si saluta chi si rivede, non come uno sconosciuto:',
      last?.doneAlready
        ? `  la volta scorsa aveva fatto: ${last.doneAlready}. Ricordaglielo con piacere, e proponigli ` +
          'qualcosa di nuovo oppure la stessa cosa in un\'altra stagione (le Cascatelle d\'inverno sono ' +
          'un\'altra cosa).'
        : '  non sappiamo cosa avesse fatto la volta scorsa.',
      // The archived feedback is the sharpest thing we hold about a returning
      // guest: it says what to steer AWAY from, which `doneAlready` alone
      // never does.
      ...(last?.feedback
        ? [
            `  alla fine ci aveva detto: ${last.feedback}. Che gli sia piaciuto o no, orienta le ` +
              'proposte di quest\'anno di conseguenza.',
          ]
        : []),
      '  Le date di questa vacanza NON le sai ancora: chiediglielo.',
    )
  }
  const party: string[] = []
  if (stay.adults) party.push(`${stay.adults} adulti`)
  if (stay.children) {
    party.push(
      stay.childrenAges
        ? `${stay.children} bambini (${stay.childrenAges})`
        : `${stay.children} bambini`,
    )
  }
  if (stay.seniors) party.push(`${stay.seniors} anziani`)
  if (party.length > 0) lines.push(`In vacanza: ${party.join(', ')}`)
  if (stay.origin) lines.push(`Arrivano da: ${stay.origin}`)
  if (stay.presence === 'remote') {
    lines.push(
      '🚨 NON È A SAPPADA e non ha una vacanza in programma: è un contatto che scrive da casa. ' +
        'NIENTE domande sul soggiorno (quanti siete, cosa vi piace, fino a quando…): aiutalo su ' +
        'alloggi, eventi e informazioni con i fatti delle schede. Se dice che verrà o che sta ' +
        "programmando una vacanza, salva SUBITO save_preferences presence='planned' (o 'in_loco' " +
        'se è appena arrivato): da lì riparte il flusso normale.',
    )
  } else if (stay.presence === 'planned') {
    lines.push(
      'HA UNA VACANZA IN PROGRAMMA ma non è ancora a Sappada: trattalo come un ospite futuro — ' +
        "date, con chi viene e interessi valgono per quando arriverà, e l'itinerario glielo puoi " +
        'proporre per quelle date. Quando ti dice che è arrivato, salva ' +
        "save_preferences presence='in_loco'.",
    )
  }
  if (stay.interests) {
    lines.push(
      `🚨 GLI INTERESSA: ${stay.interests}. Te l'hanno detto loro, rispondendo a una domanda ` +
        'esplicita: il PRIMO consiglio che dai deve essere di questo tipo. Un guest che ha ' +
        'risposto "sport" e si è sentito proporre il museo ha capito che la domanda era finta ' +
        '(Andrea, 2026-08-25). Se il meteo o un vincolo rendono impraticabile quello che vogliono, ' +
        'dillo e proponi la cosa più vicina — non cambiare argomento in silenzio. Il resto lo ' +
        'proponi dopo, se serve.',
    )
  }

  if (stay.constraints) {
    lines.push(
      `⚠️ DA TENERE PRESENTE SEMPRE: ${stay.constraints}. Filtra OGNI proposta su questo, senza ` +
        'ricordarglielo ogni volta: se non puoi rispettarlo, dillo apertamente e proponi altro.',
    )
  }
  if (stay.arrivalDate) {
    const arrivalDay = new Date(`${stay.arrivalDate}T12:00:00`)
    const arrivalLabel = Number.isNaN(arrivalDay.getTime())
      ? stay.arrivalDate
      : arrivalDay.toLocaleDateString('it-IT', {
          timeZone: TIMEZONE,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
    lines.push(`Arrivo: ${stay.arrivalDate} (${arrivalLabel})`)
  }

  if (stay.departureDate) {
    const departure = Date.parse(`${stay.departureDate}T23:59:59`)
    if (!Number.isNaN(departure)) {
      // Counted between CALENDAR DAYS in Sappada, not from a millisecond
      // difference: `T23:59:59` is parsed in the host's zone, so on a UTC dyno
      // the small hours of a Rome day still belonged to the previous one and
      // the count came out a day short (Andrea, live, 2026-08-23).
      //
      // DAYS OF PRESENCE, not nights: a guest who says "restiamo 5 giorni" is
      // counting the days they are here, arrival day included — so the day of
      // departure itself is 1, not 0 (Andrea's call, 2026-08-23). The +1 is
      // what turns a calendar gap into that count.
      const todayInSappada = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
      const daysLeft =
        Math.round(
          (Date.parse(`${stay.departureDate}T12:00:00Z`) -
            Date.parse(`${todayInSappada}T12:00:00Z`)) /
            86_400_000,
        ) + 1
      // With the weekday spelled out: the model said "giovedì 2 settembre"
    // about a date it had just saved as the 3rd — the day of the week is
    // arithmetic, and arithmetic is not what a language model is for
    // (Andrea, 2026-08-23).
    const departureDay = new Date(`${stay.departureDate}T12:00:00`)
    const departureLabel = Number.isNaN(departureDay.getTime())
      ? stay.departureDate
      : departureDay.toLocaleDateString('it-IT', {
          timeZone: TIMEZONE,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
    lines.push(
      `Partenza: ${stay.departureDate} (${departureLabel}) — usa QUESTO giorno della settimana, non calcolarlo tu`,
    )
      if (daysLeft > 1) {
        lines.push(
          `GIORNI RIMANENTI: ${daysLeft}. Concentra i consigli in questo tempo: proponi prima le cose ` +
            `che non vorresti si perdessero.`,
        )
      } else if (daysLeft === 1) {
        lines.push(
          'OGGI È IL GIORNO DELLA PARTENZA. Proponi solo cose che stanno in una mattinata, e chiedi come ' +
            'è andata la vacanza (cosa è piaciuto e cosa no) e salvala con save_feedback, poi salutali ' +
            'dicendo che li aspettiamo di nuovo.',
        )
      } else if (daysLeft <= 0) {
        // Not an ending: the guest can write whenever they like, and often
        // does (a phone left behind, a recipe, a question about next year).
        // What changes is the JOB — from planning their days to closing the
        // relationship well and keeping it open (Andrea, 2026-08-23).
        lines.push(
          'LA VACANZA È FINITA (o finisce oggi). Non proporre più attività da fare qui: non sono più in ' +
            'zona. Continua però a rispondere normalmente a qualsiasi cosa ti chiedano.',
          'In questo momento hai tre cose da fare, una per messaggio, senza affollarle:',
          '  1. Chiedi come è andata — cosa è piaciuto e cosa no — e salva con save_feedback.',
          '  2. Il consenso che avevano dato valeva SOLO per la permanenza, che ora è finita. Chiedi se ' +
            'vogliono RINNOVARLO per la prossima volta: ' +
            'gli eventi dell\'anno (il Carnevale, le feste d\'estate) e le offerte di alloggio. ' +
            'SOLO QUESTE DUE: fuori stagione le promozioni generiche del territorio non servono a chi ' +
            'non è qui, e un rinnovo più leggero si ottiene molto più facilmente. Chiedi su quale ' +
            'delle due, o entrambe, e registra con save_push_consent indicando SOLO i topics che ' +
            'hanno nominato — mai `offers` in questo momento. Ricorda anche qui, in una riga, che ' +
            'possono farli smettere quando vogliono, basta che ce lo dicano. ' +
            'Chiederlo ADESSO ha senso: hanno appena vissuto il posto, e un sì dato ora vale più di uno ' +
            'dato all\'arrivo.',
          '  3. Salutali dicendo che li aspettiamo di nuovo, con calore, come si saluta un ospite sulla porta.',
          stay.feedbackGiven
            ? '  ⚠️ IL FEEDBACK È GIÀ STATO DATO: non richiederlo, passa direttamente al punto 2 e 3.'
            : '  Il feedback non è ancora stato raccolto.',
        )
      }
    }
  }

  if (stay.operatorNotes) {
    lines.push(
      `NOTA DELLA PRO LOCO su questo ospite: ${stay.operatorNotes}. Tienine conto, ma non citarla ` +
        'mai apertamente: è scritta per noi, non per lui.',
    )
  }

  lines.push(
    'Se il cliente CORREGGE o AGGIORNA uno di questi dati — partono prima, si è aggiunta una persona, ' +
      'cambia l\'alloggio — richiama subito save_preferences con il valore NUOVO: sovrascrive quello vecchio, ' +
      'e da lì in poi i giorni rimanenti e i consigli si ricalcolano da soli.',
  )

  // The card the Pro Loco reads. Shown back to the model so it rewrites the
  // paragraph it already wrote instead of starting a new one each time.
  if (stay.notes) {
    lines.push(`SCHEDA (come l'hai scritta finora): ${stay.notes}`)
  }
  lines.push(
    'OGNI VOLTA che impari qualcosa di nuovo su di loro, insieme al campo giusto risalva anche `notes` ' +
      'con save_preferences: è la scheda che legge la Pro Loco, tutta la vacanza in un paragrafo — chi sono, ' +
      'quando ci sono, da dove vengono, cosa li limita, cosa gli piace, cosa hanno già fatto. ' +
      'Riscrivila INTERA ogni volta, non aggiungere righe in fondo. Non è un messaggio per il cliente: ' +
      'non parlargliene mai.',
  )

  if (stay.doneAlready) {
    lines.push(
      `GIÀ FATTO (non riproporlo, semmai costruiscici sopra): ${stay.doneAlready}`,
      // Not proposing it again is half the job. The other half is READING the
      // reaction: a walk that was too tiring rules out the other long ones,
      // a disappointing dinner means suggest a different kind of place, and
      // something they loved is the direction to go further in (Andrea,
      // 2026-08-23). This is what makes the next proposal follow from the
      // last one instead of restarting from a generic list.
      'Se accanto a una di queste cose c\'è come è andata, USALA per scegliere la prossima: se una ' +
        'non è piaciuta NON proporne una simile, cambia genere; se una è piaciuta molto, vai in ' +
        'quella direzione. Non commentare il fatto che te lo ricordi, usalo e basta.',
    )
  }

  // What they told us at the end of a PREVIOUS holiday. Saved and archived
  // since the beginning, but never shown to the model, so it changed nothing
  // (live check, 2026-08-23).
  if (stay.lastFeedback) {
    lines.push(
      `COSA CI AVEVA DETTO L'ULTIMA VOLTA: ${stay.lastFeedback}. Tienine conto in ogni proposta.`,
    )
  }

  // What is still open, and what must never be asked again. Computed here so
  // the model is told plainly instead of inferring it from absence — absence
  // is exactly what it gets wrong, re-asking a question the guest ignored.
  const asked = new Set(stay.asked ?? [])

  // WHICH question comes next is decided by the intake machine — one
  // declarative table, in intake-machine.ts, that is also consulted after the
  // model saves the guest's answer. Two callers, one authority: that is what
  // stops the queue and the guards from disagreeing (Andrea, 2026-08-25).
  const intakeCtx: IntakeContext = { profile: stay, asked, knownName }
  const nextStep = nextIntakeStep(intakeCtx)

  const askedKey = nextStep?.key ?? null
  // Only the key actually put to the guest is marked as asked.
  //
  // `party` used to retire `stay` with it, back when one question stood for
  // both. Now `stay` is its own step, asked when the guest answers only half
  // ("siamo due adulti") — and retiring it here meant it was gone before it
  // could ever be asked, so nobody learned the dates (2026-08-25).
  const askedKeys = askedKey ? [askedKey] : []

  // The question is DICTATED, not described.
  //
  // This block used to explain each question to the model and let it compose
  // the sentence ("with whom — NAME THE THREE CATEGORIES…"). Describing invites
  // composing, and composing is how three questions ended up in one numbered
  // list on a first turn (Andrea, live, 2026-08-24: "una alla volta le
  // domande"). The same lesson custom-demorobot learned: the code owns WHICH
  // question and its WORDING, the model owns only the language it is said in.
  const question = askedKey ? intakeQuestionFor(askedKey as IntakeKey, settings) : null

  if (askedKey && question) {
    lines.push(
      '🚨 RISPONDI SEMPRE PRIMA A QUELLO CHE TI HA CHIESTO. Se il cliente ha fatto una domanda — un',
      'prezzo, un orario, un consiglio, qualsiasi cosa — quella ha la precedenza assoluta: rispondi',
      'davvero, con i fatti che hai, e SOLO DOPO aggiungi la domanda qui sotto.',
      '',
      '## LA DOMANDA DA FARE ADESSO',
      '',
      'Questa istruzione ha la precedenza su qualsiasi altra cosa tu possa dedurre dalla',
      'conversazione. Fai QUESTA domanda, alla lettera, tradotta nella lingua del cliente:',
      '',
      question,
      '',
      // The sentence demorobot has and demosappada did not: the question IS
      // the reply, not something appended to one. Without it the model wrote
      // three museums with addresses, an offer of more detail and a link, and
      // put the question at the bottom (Andrea, 2026-08-25: "devono essere
      // domande secche una dopo l'altra").
      ...(askedKey === 'itinerary'
        ? []
        : [
            'MANDALA COME RISPOSTA INTERA. Se il cliente non ti ha chiesto niente, il tuo messaggio',
            'è SOLO questa domanda: niente consigli, niente elenchi di posti, niente link, niente',
            'meteo, niente offerte di ulteriori dettagli, nemmeno mezza riga di introduzione.',
          ]),
      'Se invece il cliente TI HA CHIESTO qualcosa, rispondi prima a lui — davvero, con i fatti',
      'che hai — e la domanda va in coda, da sola.',
      'NON aggiungere altre domande. NON elencarne altre. NON anticipare le prossime.',
      'NON riformularla e non aggiungere spiegazioni sul perché la fai: dilla e basta.',
      'NON toccare il campo `asked` di save_preferences: lo registra il sistema.',
    )

    // The branch question needs its reading key: the answer decides which of
    // the three flows this guest gets, and the model is the one reading the
    // nuance (contratto.md, 2026-08-27: "devi essere intelligente... in tutti
    // i casi il sistema deve rispondere bene").
    if (askedKey === 'location') {
      lines.push(
        '',
        'La risposta ti dice DOVE si trova, e va salvata SUBITO con save_preferences:',
        "- è già a Sappada («sì», «siamo qui», «arrivati ieri») → presence='in_loco'",
        "- la vacanza è decisa ma non è ancora qui («veniamo il prossimo mese», «arriviamo sabato») → presence='planned', e salva anche le date che nomina",
        "- non è qui e non ha piani («no», «cerco solo informazioni») → presence='remote'",
        'Se la risposta non chiarisce nulla, non salvare niente: la domanda resta aperta.',
      )
    }

    // The turn that closes the intake. Every question has been answered, the
    // guest has just given their name, and this is the first message where the
    // assistant has the whole picture — so it is the one that must READ like
    // it (Andrea, 2026-08-24: "Ciao [nome] oggi il meteo a Sappada è...").
    //
    // Shaped here rather than left to the model: without it the plan question
    // arrives bare, on the turn where using their name for the first time is
    // worth the most. The CONTENT stays the model's — the weather is whatever
    // get_weather returned, the suggestion whatever fits their card.
    if (askedKey === 'itinerary') {
      lines.push(
        '',
        '## COME SI APRE QUESTO MESSAGGIO',
        '',
        'È il messaggio che chiude le domande: hai tutte le risposte e sai come si chiama.',
        'Scrivilo in QUEST\'ORDINE, quattro pezzi e nient\'altro:',
        // The name is NOT interpolated here: on the very turn the guest gives
        // it, `remember` writes it to state AFTER this prompt was built, so
        // it would still be empty. The model has the name in front of it — it
        // is the message it is answering — so it is told to use it.
        '1. "Perfetto <NOME>," — chiamalo per nome, con il nome che ti ha appena detto.',
        '2. Com\'è il meteo a Sappada (il dato VERO da get_weather, mai stimato).',
        '3. UN consiglio solo, coerente con quel meteo e con la sua scheda.',
        '4. La domanda qui sopra, alla lettera, da sola in fondo.',
        ...(settings.closingLine?.trim()
          ? [`5. E per chiudere, esattamente questa riga: "${settings.closingLine.trim()}"`]
          : []),
        'Niente elenchi numerati di posti, niente riepilogo di quello che ti ha detto,',
        'niente altre domande, e NON offrire nulla che non ti abbia chiesto.',
      )
    }
  } else if (askedKey && !question) {
    // Configuration says nothing for this key, so nothing is asked. Silence
    // beats an English sentence sent to a guest writing in Italian, and beats
    // the model improvising a question of its own (CLAUDE.md §1A).
    // eslint-disable-next-line no-console
    console.error(`[demosappada][intake] no question configured for "${askedKey}" — skipped`)
    lines.push('NON FARE DOMANDE sul suo soggiorno in questo messaggio.')
  } else {
    lines.push('NON CHIEDERE PIÙ NULLA sul suo soggiorno: sai già tutto quello che serve.')
  }

  if (asked.size > 0 || stay.consentAsked || stay.itinerary) {
    // The key being dictated THIS turn must not also sit in the "never ask
    // again" list — since the second intake pass (intake-machine.ts) a
    // still-unanswered question CAN be dictated a second time, and listing
    // it here as forbidden would have the prompt contradict itself.
    const done = [
      ...Array.from(asked).filter((k) => k !== askedKey),
      ...(stay.consentAsked ? ['consent'] : []),
      ...(stay.itinerary ? ['itinerary'] : []),
    ]
    lines.push(
      `GIÀ CHIESTO (non richiederlo MAI più, nemmeno se non ha risposto): ${done.join(', ')}`,
    )
  }

  if (stay.consentAsked) {
    lines.push(
      'Il consenso per la permanenza è già stato chiesto. Non richiederlo ora: si torna sul tema SOLO ' +
        'alla partenza, e lì riguarda il rinnovo per la prossima volta (eventi dell\'anno e alloggi).',
    )
  }

  // The switch, always live. Not tied to consentAsked: someone can ask to be
  // left alone before anyone has asked them anything, and the request must be
  // honoured the moment it is made.
  lines.push(
    'SE IN QUALSIASI MOMENTO ti dicono che non vogliono più ricevere messaggi — anche solo "basta ' +
      'notifiche", "non scriveteci più" — chiama SUBITO save_push_consent con granted=false, ' +
      'confermaglielo in una riga e non tornarci sopra. Se invece chiedono di ricevere di nuovo ' +
      'qualcosa, chiama save_push_consent con granted=true e SOLO i topics che hanno nominato ' +
      '(eventi, alloggi, offerte del territorio). Non chiedere loro di scrivere UNSUBSCRIBE: ' +
      'basta che te lo dicano a parole.',
  )

  if (stay.itineraryPlan) {
    lines.push(
      'PROGRAMMA CONCORDATO (è il vostro piano: portalo avanti, non ricominciare da capo):',
      ...stay.itineraryPlan.split('\n').map((line) => `  ${line}`),
      'Quando qualcosa cambia — meteo, una cosa già fatta, una partenza anticipata — aggiorna SOLO i ' +
        'giorni interessati e risalvalo INTERO con save_itinerary.',
      // Asking during the stay, not only at the end: the answer is what feeds
      // `doneAlready`, and `doneAlready` is what stops the same excursion
      // being proposed twice. Left to the end of the holiday it arrives too
      // late to be useful to THIS guest (Andrea, 2026-08-23).
      'Se il programma prevedeva qualcosa per IERI o per OGGI e non sai ancora com\'è andata, chiedilo ' +
        'in una riga, con naturalezza, in coda alla tua risposta: sapere se ci sono stati e se è ' +
        'piaciuto è quello che ti evita di riproporglielo. Quello che ti dicono va salvato subito con ' +
        'save_preferences in `doneAlready`. Non insistere se non rispondono.',
    )
  }

  if (stay.itinerary === 'no') {
    lines.push('Ha detto che NON vuole un programma: rispondi solo alle sue domande, non pianificare.')
  } else if (stay.itinerary === 'yes') {
    lines.push('Vuole il programma: sei il suo pianificatore, porta avanti il piano.')
  }

  if (lines.length === 0) return { text: '', askedKey, askedKeys, askedQuestion: question }
  return { text: ['', '═══ QUESTO OSPITE ═══', ...lines].join('\n'), askedKey, askedKeys, askedQuestion: question }
}
