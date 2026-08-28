// Who is in the party, read from the guest's own words by CODE.
//
// Closed vocabularies only (CLAUDE.md §14): digits, number-words, the party
// categories (bambini/adulti/anziani), "coppia", and the nouns a guest uses
// to name the people with them. No phrase detection, no intent: this file
// turns "siamo due adulti e un bimbo" and "io e mio marito" into counts, and
// nothing else. Pure, no I/O — extracted from agent.ts so it can be tested on
// its own (iron rule 5).

export function parseParty(msg: string): ParsedParty {
  const WORD_NUM: Record<string, number> = {
    un: 1, uno: 1, una: 1, one: 1, eins: 1, deux: 2, due: 2, dos: 2, dois: 2, two: 2, zwei: 2, twee: 2, to: 2,
    tre: 3, three: 3, drei: 3, trois: 3, tres: 3, drie: 3,
    quattro: 4, four: 4, vier: 4, quatre: 4, cuatro: 4, quatro: 4, fire: 4,
    cinque: 5, five: 5, cinq: 5, cinco: 5, vijf: 5, fem: 5,
    sei: 6, six: 6, sechs: 6, seis: 6, zes: 6, seks: 6,
    sette: 7, seven: 7, sieben: 7, sept: 7, siete: 7, sete: 7, zeven: 7, syv: 7,
    otto: 8, eight: 8, acht: 8, huit: 8, ocho: 8, oito: 8, otte: 8,
    nove: 9, nine: 9, neun: 9, neuf: 9, nueve: 9, negen: 9, ni: 9,
    dieci: 10, ten: 10, zehn: 10, dix: 10, diez: 10, dez: 10, tien: 10, ti: 10,
  }
  const isDayWord = (t: string): boolean =>
    /^(giorn|nott|day|nigh|tag|naech|nacht|jour|nuit|dia|noch|dag|naet)/.test(t)
  const cat = (t: string): 'children' | 'adults' | 'seniors' | null =>
    /^(bamb|bimb|figl|kind|child|enfant|nin|crian|born)/.test(t)
      ? 'children'
      : /^(adul|erwa|volw|voks)/.test(t)
        ? 'adults'
        : /^(anzi|senio|nonn|aelt|alte[rn])/.test(t)
          ? 'seniors'
          : null
  const toks = msg
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const out: ParsedParty = {}
  let loose: number | undefined
  for (let i = 0; i < toks.length; i++) {
    // "coppia"/"couple": a closed-vocabulary word that IS a headcount, same
    // §14 class as the number-words above. "mio marito ed io siamo una
    // coppia di 50enni" told the machine nothing, the headcount stayed
    // open, and "Ci sono bambini o anziani?" went out at two adults who
    // had just introduced themselves (Andrea, 2026-08-28 live, 01:57).
    if (/^(coppia|couple|paar|pareja|casal|par)$/.test(toks[i])) {
      if (out.adults === undefined) out.adults = 2
      continue
    }
    const n = /^\d+$/.test(toks[i]) ? parseInt(toks[i], 10) : WORD_NUM[toks[i]]
    if (n === undefined || n < 1 || n > 30) continue
    const nextTok = toks[i + 1]
    const c = nextTok ? cat(nextTok) : null
    // "un"/"una"/"one" are articles far more often than counts: "siamo UN
    // gruppo di persone" read as one adult, which then anchored the
    // model's invented adults:5 (sim, 2026-08-28). The word counts only
    // when the next word says WHAT it counts ("un bambino", "una notte");
    // on its own it is grammar, not a number. The digit "1" is unaffected.
    const isArticle = !/^\d+$/.test(toks[i]) && n === 1
    if (isArticle && !c && !(nextTok && isDayWord(nextTok))) continue
    if (c) out[c] = n
    // "3 giorni" / "2 notti": a number is a DURATION only when its own
    // next word says so — the positional "second number = days" guess
    // read the 2 of "2 adulti" as two days and invented a departure
    // date nobody stated (2026-08-25, live).
    else if (nextTok && isDayWord(nextTok)) out.days = n
    else if (loose === undefined) loose = n
  }
  if (out.adults === undefined && loose !== undefined) out.adults = loose

  // People NAMED one by one, with no number anywhere: "io e mio marito",
  // "my wife and I", "ich und meine Frau", "con la nonna". A closed
  // vocabulary of the words a guest uses to name who is with them — the
  // same §14 class as "coppia" and the category words above, not a phrase
  // list. Each noun is one person in its category; the first-person pronoun
  // is the speaker. Only when no number was read: a number is more exact
  // than a list. Born of the live 15:44 turn (2026-08-28): the production
  // model saved adults 2 for "io e mip marito" WITHOUT the provenance
  // fields, the guard refused, "E in quanti siete?" went out — the code now
  // reads the headcount itself, whatever the model sends.
  if (out.adults === undefined && out.children === undefined && out.seniors === undefined) {
    const persons = countNamedPersons(toks)
    if (persons.total > 0) {
      out.adults = persons.adults
      out.children = persons.children
      out.seniors = persons.seniors
      out.enumerated = true
    }
  }
  return out
}

export interface ParsedParty {
  adults?: number
  children?: number
  seniors?: number
  days?: number
  /** True when the counts come from people named one by one, not a number. */
  enumerated?: boolean
}

const SPEAKER = /^(io|i|ich|je|yo|eu|jo|me|moi)$/
// Nouns that name ONE person each, by category. Singular only: "figli",
// "nonni", "amici" say "more than one" without saying how many, and a guess
// is what this module refuses to make.
const ADULT_PERSON =
  /^(marito|moglie|compagn[oa]|partner|fidanzat[oa]|sposo|sposa|amic[oa]|colleg[ao]|mamma|madre|pap[aà]|padre|fratello|sorella|cognat[oa]|zi[oa]|husband|wife|boyfriend|girlfriend|friend|colleague|mum|mom|mother|dad|father|brother|sister|ehemann|ehefrau|mann|frau|freund|freundin|mutter|vater|bruder|schwester|mari|femme|copain|copine|ami|amie|m[eè]re|p[eè]re|fr[eè]re|soeur|sœur|marido|mujer|esposo|esposa|novio|novia|amigo|amiga|madre|padre|hermano|hermana|marit|dona|company|companya|xicot|xicota|germ[aà]|germana|esposo|esposa|namorado|namorada|irm[aã]o|irm[aã])$/
const SENIOR_PERSON =
  /^(nonn[oa]|grandmother|grandfather|grandma|grandpa|granny|oma|opa|gro[sß]mutter|gro[sß]vater|grand-m[eè]re|grand-p[eè]re|mamie|papi|abuel[oa]|avi|[aà]via|av[oó]|av[oô])$/
const CHILD_PERSON = /^(figli[oa]|bambin[oa]|bimb[oa]|neonat[oa]|son|daughter|child|kid|baby|toddler|sohn|tochter|fils|fille|b[eé]b[eé]|hij[oa]|beb[eé]|fill|filla|nen|nena|filh[oa])$/

function countNamedPersons(toks: string[]): { adults: number; children: number; seniors: number; total: number } {
  let adults = 0
  let children = 0
  let seniors = 0
  let speaker = false
  for (const t of toks) {
    if (SPEAKER.test(t)) speaker = true
    else if (SENIOR_PERSON.test(t)) seniors += 1
    else if (CHILD_PERSON.test(t)) children += 1
    else if (ADULT_PERSON.test(t)) adults += 1
  }
  // The speaker counts only alongside someone else: a lone "io" is grammar.
  const named = adults + children + seniors
  if (speaker && named > 0) adults += 1
  return { adults, children, seniors, total: named > 0 ? adults + children + seniors : 0 }
}

