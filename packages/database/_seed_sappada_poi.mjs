// Seed for the four categories Andrea added on 2026-09-14 ("per la proloco
// dobbiamo aggiungere delle categorie: chiese, castelli, punti panoramici,
// locali... trova i dati e li metti con foto e occhio miraccomando che non
// dobbiamo averli doppi").
//
// SOURCES — every row below was verified against a public source; nothing is
// invented (CLAUDE.md §1: no data the DB did not give us). Where a fact could
// not be verified the field is simply absent rather than guessed:
//   - Wikipedia IT (Santa Margherita, Sant'Osvaldo, Regina Pacis, Castello di
//     Pieve di Cadore)
//   - borghibellifvg.it — official "Borghi più belli d'Italia FVG" (the eight
//     borgata chapels, with their years and Sappadino names)
//   - visitsappada.it — Pro Loco (Sorgenti del Piave, Colle Bellavista,
//     Forra dell'Acquatona, Cascatelle di Mühlbach, Calvario)
//   - sappada.info (bars/cafés with their phone numbers)
//   - visitdolomitibellunesi.com (Forte di Monte Ricco)
//
// PHOTOS: only Wikimedia Commons images are attached — freely licensed, so the
// Pro Loco can legally show them. The caption carries the attribution because
// CC BY-SA requires it wherever the photo is displayed, and custom-client-
// chatbot.service.ts appends that caption right after the photo URL it sends.
// Items with no free image get no photo rather than a hotlinked one.
//
// NO DUPLICATES, by construction:
//   1. Names are canonicalised (Santa Margherita is NOT also "Pieve di Santa
//      Margherita"; Forra dell'Acquatona is NOT also "Orrido dell'Acquatona").
//   2. Before inserting, the script checks the row's name against the target
//      table AND against every other tourist_* table of this workspace, so a
//      place already entered as an excursion/refuge/restaurant is skipped and
//      reported instead of being created twice.
//   3. Re-running is safe: an existing name in the same table is skipped.
//
// DELIBERATE EXCLUSIONS (would duplicate other categories):
//   - Rifugio Sorgenti del Piave / Calvi / Siera / Sappada 2000 → refuges.
//     The SORGENTI themselves are a viewpoint; the rifugio of the same name
//     is not, and is not inserted here.
//   - Monte Peralba, Laghi d'Olbe → already excursion material; inserted as
//     viewpoints ONLY if not already present as excursions (check 2 above).
//   - Val Sesis → folded into the Sorgenti del Piave description; a separate
//     row would make the bot answer the same thing twice.
//   - Birreria Pizzeria Ti Spiazza → it is also a pizzeria and may already be
//     a restaurant; check 2 decides.
//
// CASTLES: Sappada itself has NO castle — it was founded as a 13th-century
// farming colony and never had a military or feudal role. Rather than invent
// one, the category is filled with the verified fortifications of the
// surrounding Cadore, reachable as a day trip, each saying so in its own
// description.
//
// Usage:
//   node _seed_sappada_poi.mjs            # dry-run, prints what it would do
//   node _seed_sappada_poi.mjs --apply    # writes
import { PrismaClient } from "./src/generated/prisma/index.js"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const WS = process.env.WORKSPACE_ID || "7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c"
const APPLY = process.argv.includes("--apply")

// DATABASE_URL must be supplied by the caller (Andrea runs this against the
// target DB himself, as with the other one-shot scripts in this folder).
const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  console.error("DATABASE_URL non impostata — passala tu al lancio.")
  process.exit(1)
}
const pool = new Pool({
  connectionString: DB_URL,
  ssl: DB_URL.includes("localhost") ? undefined : { rejectUnauthorized: false },
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const CC = () => "foto: Wikimedia Commons"

// ─────────────────────────────── CHIESE ───────────────────────────────
const churches = [
  {
    name: "Chiesa di Santa Margherita",
    description:
      "Chiesa arcipretale di Sappada, dedicata a Santa Margherita Vergine e Martire. È documentata per la prima volta nel 1327 con il nome «Santa Margarita de Longaplave»; ricostruita nel 1666, fu riedificata in forme barocche dal maestro Tommaso da Lienz tra il 1777 e il 1779 sul modello di altre chiese tirolesi. All'interno si trovano gli affreschi di Francesco Barazzuti del 1906 e la pala dell'altare maggiore di Johann Renzler del 1802. Il campanile ha tre campane e un torrino ottagonale con cuspide decorata.",
    century: "1777-1779 (origini 1327)",
    style: "barocco",
    location: "Borgata Granvilla",
    link: "https://it.wikipedia.org/wiki/Chiesa_di_Santa_Margherita_(Sappada)",
    photo: {
      url: "https://upload.wikimedia.org/wikipedia/commons/2/2d/Sappada_St.Margareta.jpg",
      caption: CC(),
    },
  },
  {
    name: "Chiesa di Sant'Osvaldo",
    description:
      "Chiesa di Cima Sappada, chiamata in sappadino Zepódarkirche. La cappella primitiva, rifatta nel XVII secolo, fu sostituita dall'edificio attuale nel 1732, ampliato e restaurato nel 1773; divenne mansioneria nel 1803, con ulteriori interventi nel 1819, 1906 e 1954. Oltre all'altare maggiore dedicato a Sant'Osvaldo, una cappella laterale ospita un secondo altare con statua della Madonna; sul soffitto un affresco raffigura la Vergine Maria in cielo.",
    century: "1732, ampliata nel 1773",
    style: "alpino",
    location: "Cima Sappada",
    link: "https://it.wikipedia.org/wiki/Chiesa_di_Sant'Osvaldo_(Cima_Sappada)",
    photo: {
      url: "https://upload.wikimedia.org/wikipedia/commons/a/a3/Cima_Sappada_St.Oswald.jpg",
      caption: CC(),
    },
  },
  {
    name: "Santuario della Regina Pacis",
    description:
      "Santuario mariano costruito tra il 1971 e il 1973 su progetto dell'architetto Luciano Ria. Fu edificato per sciogliere un voto fatto alla Madonna della Pace durante la seconda guerra mondiale da alcuni sappadini internati nei lager. All'interno si trova una grande scultura di Augusto Murer che raffigura le sofferenze della guerra.",
    century: "1971-1973",
    style: "contemporaneo",
    location: "Borgata Soravia",
    link: "http://santuarioreginapacis.it/",
  },
  // Le chiesette delle borgate — ognuna con il suo nome sappadino, dalla
  // scheda ufficiale dei Borghi più belli d'Italia FVG.
  {
    name: "Chiesa di Sant'Antonio di Padova (Bach)",
    description:
      "Chiesetta della borgata Bach, in sappadino Schantantònimaindl, costruita nel 1726. Fa parte delle chiesette delle borgate attorno alle quali si è sviluppato ciascun nucleo abitato di Sappada.",
    century: "1726",
    location: "Borgata Bach",
    link: "https://www.borghibellifvg.it/it/i-borghi/sappada/luoghi-da-scoprire/chiese-e-cappelle-votive/le-chiesette-delle-borgate-",
  },
  {
    name: "Cappella della Trinità",
    description:
      "Cappella della borgata Cretta, in sappadino Krèttarmaindl, costruita nel 1727.",
    century: "1727",
    location: "Borgata Cretta",
    link: "https://www.borghibellifvg.it/it/i-borghi/sappada/luoghi-da-scoprire/chiese-e-cappelle-votive/le-chiesette-delle-borgate-",
  },
  {
    name: "Chiesa di San Giovanni Bosco",
    description:
      "Chiesetta della borgata Hoffe, in sappadino Houvarmaindl, edificata tra il 1856 e il 1954.",
    century: "1856-1954",
    location: "Borgata Hoffe",
    link: "https://www.borghibellifvg.it/it/i-borghi/sappada/luoghi-da-scoprire/chiese-e-cappelle-votive/le-chiesette-delle-borgate-",
  },
  {
    name: "Chiesa di San Giuseppe",
    description:
      "Chiesetta della borgata Soravia, in sappadino Begarmaindl, costruita nel 1891.",
    century: "1891",
    location: "Borgata Soravia",
    link: "https://www.borghibellifvg.it/it/i-borghi/sappada/luoghi-da-scoprire/chiese-e-cappelle-votive/le-chiesette-delle-borgate-",
  },
  {
    name: "Chiesa della Madonna del Rosario",
    description:
      "Chiesetta della borgata Puiche, in sappadino Puicharmaindl, costruita nel 1901.",
    century: "1901",
    location: "Borgata Puiche",
    link: "https://www.borghibellifvg.it/it/i-borghi/sappada/luoghi-da-scoprire/chiese-e-cappelle-votive/le-chiesette-delle-borgate-",
  },
  {
    name: "Chiesa del Sacro Cuore di Gesù",
    description:
      "Chiesetta della borgata Mühlbach, in sappadino Hèrz Jesus maindl, costruita nel 1908. Nella stessa borgata si trova anche un crocifisso del XIX secolo.",
    century: "1908",
    location: "Borgata Mühlbach",
    link: "https://www.borghibellifvg.it/it/i-borghi/sappada/luoghi-da-scoprire/chiese-e-cappelle-votive/le-chiesette-delle-borgate-",
  },
  {
    name: "Chiesa della Madonna di Lourdes",
    description: "Chiesetta in sappadino Khrotarmaind, costruita nel 1920.",
    century: "1920",
    location: "Borgata Kratten",
    link: "https://www.borghibellifvg.it/it/i-borghi/sappada/luoghi-da-scoprire/chiese-e-cappelle-votive/le-chiesette-delle-borgate-",
  },
  {
    name: "Chiesa di Sant'Antonio di Padova (Ecche)",
    description:
      "Chiesetta della borgata Ecche, in sappadino Ekkarmaindl, costruita nel 1930. È distinta dall'omonima chiesetta della borgata Bach, più antica.",
    century: "1930",
    location: "Borgata Ecche",
    link: "https://www.borghibellifvg.it/it/i-borghi/sappada/luoghi-da-scoprire/chiese-e-cappelle-votive/le-chiesette-delle-borgate-",
  },
  {
    name: "Il Calvario",
    description:
      "Percorso devozionale con quattordici cappelline illuminate, che costituiscono le stazioni della Via Crucis.",
    location: "Sappada",
    link: "https://www.visitsappada.it/calvario.php",
  },
]

// ────────────────────────────── CASTELLI ──────────────────────────────
// Sappada non ha castelli: vedi la nota in testa al file. Questi sono nel
// Cadore, in giornata, e ognuno lo dichiara nella propria descrizione.
const castles = [
  {
    name: "Forte di Monte Ricco",
    description:
      "Non si trova a Sappada ma a Pieve di Cadore, raggiungibile in giornata in auto. Forte costruito a 953 metri di quota negli ultimi vent'anni dell'Ottocento secondo i criteri dell'architettura militare medievale e rinascimentale, completo di fossato e ponte levatoio; era il cuore del campo trincerato di Pieve di Cadore. Riaperto al pubblico nel maggio 2017 dopo un lungo restauro, ospita mostre ed eventi culturali. Si raggiunge con una camminata di circa venti minuti dal centro di Pieve di Cadore.",
    century: "fine XIX secolo",
    visitInfo: "Visitabile, ospita mostre ed eventi culturali",
    location: "Pieve di Cadore (BL)",
    link: "https://www.visitdolomitibellunesi.com/it/pois/forte-di-monte-ricco",
  },
  {
    name: "Castello di Pieve di Cadore",
    description:
      "Non si trova a Sappada ma a Pieve di Cadore, raggiungibile in giornata in auto. Fortificazione medievale anteriore al X secolo, è il primo luogo fortificato di cui si abbia notizia in Cadore; sorgeva su un'altura alla confluenza del Boite nel Piave. Ebbe un ruolo di rilievo durante la guerra della Lega di Cambrai (1508-1511), quando fu occupato e riconquistato più volte. Dopo la caduta di Venezia perse le funzioni militari e cadde in rovina: oggi si presenta allo stato di rudere. È una struttura distinta dal vicino Forte di Monte Ricco, che sorge sullo stesso rilievo ma è di epoca ottocentesca.",
    century: "anteriore al X secolo",
    visitInfo: "Allo stato di rudere",
    location: "Pieve di Cadore (BL)",
    link: "https://it.wikipedia.org/wiki/Castello_di_Pieve_di_Cadore",
  },
  {
    name: "Forte Col Vidal",
    description:
      "Non si trova a Sappada ma a Lozzo di Cadore, raggiungibile in giornata. Opera fortificata della Fortezza Cadore-Maè, la linea difensiva che si estendeva da Pian dei Buoi e Col Vidal fino al Longaronese: era una delle postazioni di artiglieria sulle alture che dominano il sistema difensivo. Le fortificazioni sono oggi aperte alle visite e ospitano occasionalmente mostre ed eventi culturali.",
    visitInfo: "Aperto alle visite, mostre ed eventi occasionali",
    location: "Lozzo di Cadore (BL)",
    link: "http://www.laggiodicadore.it/testocadoremae.html",
  },
]

// ───────────────────────── PUNTI PANORAMICI ──────────────────────────
const viewpoints = [
  {
    name: "Sorgenti del Piave",
    description:
      "Situate in Val Sesis a 1.830 metri di quota, ai piedi del Monte Peralba, sono uno dei luoghi naturalistici più suggestivi delle Dolomiti orientali: qui nasce il Piave. L'acqua sgorga in una fontana di pietra sormontata da un monumento che ricorda la nascita del fiume e il suo ruolo nella Prima guerra mondiale. Si raggiungono in auto lungo la strada della Val Sesis e da qui partono le escursioni verso il Monte Peralba, l'Avanza, il Chiadenis e i Laghi d'Olbe.",
    altitude: 1830,
    access: "in auto",
    difficulty: "facile",
    location: "Val Sesis, Cima Sappada",
    link: "https://www.visitsappada.it/sorgenti-del-piave.php",
    photo: {
      url: "https://upload.wikimedia.org/wikipedia/commons/2/20/Cartello_sorgenti_Piave.jpg",
      caption: CC(),
    },
  },
  {
    name: "Monte Peralba",
    description:
      "Con i suoi 2.694 metri è la cima più alta di Sappada, in Val Sesis. La via normale parte dal Rifugio Calvi ed è intitolata a Giovanni Paolo II, che salì in vetta nel 1988. L'itinerario ad anello dal Rifugio Sorgenti del Piave copre circa 8 chilometri con 850 metri di dislivello e richiede circa quattro ore e mezza.",
    altitude: 2694,
    access: "a piedi",
    difficulty: "difficile",
    location: "Val Sesis",
    photo: {
      url: "https://upload.wikimedia.org/wikipedia/commons/b/b3/Monte_Peralba_Hochwei%C3%9Fenstein_Karnische_Alpen_20070707.jpg",
      caption: CC(),
    },
  },
  {
    name: "Laghi d'Olbe",
    description:
      "Tre conche glaciali naturali a circa 2.150 metri di quota in Val d'Olbe, sopra Sappada. Si raggiungono con la seggiovia fino al Rifugio Sappada 2000 e poi con circa un'ora di cammino su sentiero sterrato. Dai laghi si gode la vista sulle Alpi Carniche e sulle cime di Sappada, in particolare la Cresta d'Enghe, il Monte Siera e la Creta Forata. L'impianto è attivo in estate e in inverno.",
    altitude: 2150,
    access: "seggiovia",
    difficulty: "media",
    location: "Val d'Olbe",
    photo: {
      url: "https://upload.wikimedia.org/wikipedia/commons/8/85/Sappada_Laghid%27Olbe.jpg",
      caption: CC(),
    },
  },
  {
    name: "Forra dell'Acquatona",
    description:
      "Profonda forra scavata dal Piave nel punto in cui incontra il Rio Acquatona, dove il fiume precipita con un salto di oltre cinquanta metri. La cascata è visibile da un ponte lungo la strada provinciale, poco prima dell'inizio del territorio comunale di Sappada. Nel 2023 è stato realizzato un percorso attrezzato con tre passerelle sospese sull'acqua a diverse altezze, con pareti attrezzate con cavi e gradini, fino a circa cinquanta metri dal fondo della forra.",
    access: "in auto (vista dal ponte); percorso attrezzato per la forra",
    difficulty: "facile dal ponte, difficile il percorso attrezzato",
    location: "Ingresso di Sappada, lungo la SR355",
    link: "https://www.visitsappada.it/forra-acquatona.php",
    photo: {
      url: "https://upload.wikimedia.org/wikipedia/commons/c/ca/Orrido_acquatona_gorge_sappada.jpg",
      caption: CC(),
    },
  },
  {
    name: "Cascatelle di Mühlbach",
    description:
      "Cascate a breve distanza dal centro di Sappada, in uno stretto e ripido corridoio naturale attraversato dal torrente Mühlbach, le cui acque compiono un salto di una ventina di metri prima di confluire nel Piave.",
    access: "a piedi",
    difficulty: "facile",
    location: "Borgata Mühlbach",
    link: "https://www.visitsappada.it/cascatelle-sappada.php",
    photo: {
      url: "https://upload.wikimedia.org/wikipedia/commons/8/82/Sappada_Cascatelle_di_M%C3%BChlbach.jpg",
      caption: CC(),
    },
  },
  {
    name: "Colle Bellavista",
    description:
      "Caratteristica sommità verde che domina la piana di Cima Sappada, con un panorama ampio nonostante la quota modesta. Il percorso parte dalla piazza di Cima Sappada seguendo le indicazioni per Val Sesis e Rifugio Calvi, e sale per una larga strada forestale nel bosco sul versante nord del colle. In cima si trovano un ricovero in pietra restaurato e una statua della Madonna, con vista sulla Valle del Sole e sui gruppi montuosi circostanti. Il dislivello è di 175 metri, per circa un'ora e dieci minuti di cammino; stagione consigliata da maggio a ottobre.",
    altitude: 1517,
    access: "a piedi",
    difficulty: "facile",
    location: "Cima Sappada",
    link: "https://www.visitsappada.it/colle-bellavista.php",
  },
]

// ─────────────────────────────── LOCALI ───────────────────────────────
// Bar, caffè, enoteche e birrerie — i ristoranti veri restano in
// tourist_restaurants. Telefoni da sappada.info.
const venues = [
  { name: "Bar Nardi", venueType: "bar", location: "Borgata Lerpa", phone: "0435 469139" },
  { name: "Bar Posta", venueType: "bar", location: "Borgata Palù", phone: "0435 469620" },
  { name: "Bar Sannas Stube", venueType: "bar", location: "Borgata Bach", phone: "0435 469679" },
  {
    name: "Bar Al Solito Posto",
    description:
      "Locale con ampi spazi interni ed esterni, con selezione di vini, cocktail e bollicine. Organizza serate a tema ed eventi con musica dal vivo e DJ set.",
    venueType: "bar",
    location: "Borgata Bach",
    phone: "0435 466449",
  },
  {
    name: "Enoteca da Franz",
    venueType: "enoteca",
    location: "Borgata Cottern",
    phone: "0435 469379",
  },
  {
    name: "Bar All'Amicizia",
    venueType: "bar",
    location: "Cima Sappada",
    phone: "0435 469472",
  },
  {
    name: "Bar Edelweiss",
    description:
      "Tra i locali più frequentati di Sappada, noto per gli aperitivi. Arredamento in stile montano classico, propone piatti tipici locali e organizza happy hour con DJ set e musica dal vivo.",
    venueType: "bar",
    location: "Borgata Palù",
    phone: "0435 469132",
  },
  {
    name: "Bar Pasticceria Gelateria Sartor",
    venueType: "pasticceria e gelateria",
    location: "Borgata Granvilla",
    phone: "0435 469310",
  },
  {
    name: "Bar Gelateria Kratter",
    venueType: "gelateria",
    location: "Borgata Bach",
    phone: "0435 66106",
  },
  {
    name: "Birreria Pizzeria Ti Spiazza",
    venueType: "birreria",
    location: "Borgata Palù",
    phone: "0435 469544",
  },
]

// Tables that must not already contain a row with the same name — a place
// already entered as an excursion/refuge/restaurant must not reappear here
// under a second category (Andrea: "non dobbiamo averli doppi").
const CROSS_TABLES = [
  ["touristRestaurant", "ristoranti"],
  ["touristHotel", "alberghi"],
  ["touristExcursion", "escursioni"],
  ["touristRefuge", "rifugi"],
  ["touristApartment", "appartamenti"],
  ["touristEvent", "eventi"],
  ["touristSportsFacility", "strutture sportive"],
  ["touristSkiFacility", "impianti di sci"],
  ["touristChurch", "chiese"],
  ["touristCastle", "castelli"],
  ["touristViewpoint", "punti panoramici"],
  ["touristVenue", "locali"],
]

const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9àèéìòù]+/g, " ")
    .trim()

async function findElsewhere(name, ownModel) {
  for (const [model, label] of CROSS_TABLES) {
    const field = model === "touristEvent" ? "title" : "name"
    const rows = await prisma[model].findMany({
      where: { workspaceId: WS },
      select: { [field]: true },
    })
    const hit = rows.find((r) => norm(r[field]) === norm(name))
    if (hit) return { label, same: model === ownModel }
  }
  return null
}

async function seed(model, contentType, label, rows) {
  console.log(`\n── ${label} (${rows.length} candidati) ──`)
  let created = 0
  let skipped = 0
  let order = 0

  for (const row of rows) {
    const { photo, ...data } = row
    const clash = await findElsewhere(data.name, model)
    if (clash) {
      console.log(
        `  SKIP  ${data.name} — già presente in ${clash.label}${clash.same ? " (stessa categoria)" : " ⚠️ ALTRA CATEGORIA"}`
      )
      skipped++
      continue
    }

    console.log(`  ${APPLY ? "ADD " : "DRY "}  ${data.name}${photo ? "  [+foto]" : ""}`)
    created++
    if (!APPLY) continue

    const item = await prisma[model].create({
      data: { ...data, workspaceId: WS, order: order++, isActive: true },
    })

    if (photo) {
      // Photos are stored as base64 like every other gallery image, so the
      // public /api/public/tourist-photos/:id/image.jpg route can serve them
      // to WhatsApp. Fetched once here rather than hotlinked at answer time.
      //
      // Throttled: Wikimedia returned HTTP 429 on the first run when the
      // images were fetched back-to-back, and every photo after the second
      // was lost. One second between downloads is well inside their limits
      // for a one-shot script of this size.
      await new Promise((r) => setTimeout(r, 1000))
      try {
        const res = await fetch(photo.url, {
          headers: {
            "User-Agent": "echatbot-proloco-seed/1.0 (tourism chatbot)",
          },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const mime = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg"
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length > 4 * 1024 * 1024) {
          console.log(
            `        ⚠️  foto oltre 4MB, saltata (${(buf.length / 1048576).toFixed(1)}MB)`
          )
        } else {
          await prisma.touristPhoto.create({
            data: {
              workspaceId: WS,
              contentType,
              contentId: item.id,
              imageBase64: `data:${mime};base64,${buf.toString("base64")}`,
              caption: photo.caption,
              order: 0,
            },
          })
        }
      } catch (err) {
        console.log(`        ⚠️  foto non scaricata: ${err.message}`)
      }
    }
  }

  console.log(`  → ${created} da creare, ${skipped} saltati`)
  return { created, skipped }
}

console.log(APPLY ? "APPLY — scrive nel DB" : "DRY-RUN — nessuna scrittura (usa --apply)")
console.log(`workspace: ${WS}`)

const totals = []
totals.push(await seed("touristChurch", "CHURCH", "CHIESE", churches))
totals.push(await seed("touristCastle", "CASTLE", "CASTELLI", castles))
totals.push(await seed("touristViewpoint", "VIEWPOINT", "PUNTI PANORAMICI", viewpoints))
totals.push(await seed("touristVenue", "VENUE", "LOCALI", venues))

const created = totals.reduce((n, t) => n + t.created, 0)
const skipped = totals.reduce((n, t) => n + t.skipped, 0)
console.log(
  `\n════ TOTALE: ${created} righe${APPLY ? " create" : " da creare"}, ${skipped} saltate ════`
)

await prisma.$disconnect()
await pool.end()
