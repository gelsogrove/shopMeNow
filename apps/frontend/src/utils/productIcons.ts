/**
 * Product Icon Mapping
 * Maps product names/keywords to emoji icons for better UX
 */

interface ProductIconMap {
  [key: string]: string
}

// Specific product mappings (exact matches)
const EXACT_PRODUCT_ICONS: ProductIconMap = {
  // Dairy & Cheese
  mozzarella: "🧀",
  burrata: "🧀",
  ricotta: "🥛",
  parmigiano: "🧀",
  grana: "🧀",
  pecorino: "🧀",
  gorgonzola: "🧀",
  mascarpone: "🥛",
  scamorza: "🧀",
  provolone: "🧀",
  caciocavallo: "🧀",
  fontina: "🧀",
  taleggio: "🧀",
  asiago: "🧀",
  emmenthal: "🧀",
  brie: "🧀",
  camembert: "🧀",
  feta: "🧀",
  halloumi: "🧀",
  cheddar: "🧀",

  // Meats & Salumi
  prosciutto: "🥓",
  salame: "🍖",
  salami: "🍖",
  mortadella: "🥓",
  bresaola: "🥩",
  speck: "🥓",
  pancetta: "🥓",
  guanciale: "🥓",
  salsiccia: "🌭",
  chorizo: "🌭",
  coppa: "🥓",
  nduja: "🌶️",
  lardo: "🥓",
  culatello: "🥓",

  // Pasta
  pasta: "🍝",
  spaghetti: "🍝",
  penne: "🍝",
  fusilli: "🍝",
  farfalle: "🍝",
  rigatoni: "🍝",
  linguine: "🍝",
  tagliatelle: "🍝",
  fettuccine: "🍝",
  ravioli: "🥟",
  tortellini: "🥟",
  lasagne: "🍝",
  cannelloni: "🍝",
  gnocchi: "🥔",
  orecchiette: "🍝",

  // Bread & Bakery
  pane: "🍞",
  focaccia: "🥖",
  grissini: "🥖",
  taralli: "🥨",
  pizza: "🍕",
  calzone: "🥟",
  ciabatta: "🥖",
  baguette: "🥖",
  cornetto: "🥐",
  brioche: "🥐",

  // Vegetables
  pomodoro: "🍅",
  melanzana: "🍆",
  zucchina: "🥒",
  peperone: "🫑",
  cipolla: "🧅",
  aglio: "🧄",
  carota: "🥕",
  patata: "🥔",
  insalata: "🥬",
  lattuga: "🥬",
  rucola: "🥬",
  spinaci: "🥬",
  broccoli: "🥦",
  cavolfiore: "🥦",
  funghi: "🍄",
  asparagi: "🌿",
  carciofi: "🌿",
  olive: "🫒",

  // Fruits
  limone: "🍋",
  arancia: "🍊",
  mela: "🍎",
  pera: "🍐",
  banana: "🍌",
  fragola: "🍓",
  ciliegia: "🍒",
  uva: "🍇",
  anguria: "🍉",
  melone: "🍈",
  pesca: "🍑",
  albicocca: "🍑",
  prugna: "🍑",
  fico: "🫐",
  kiwi: "🥝",
  ananas: "🍍",
  mango: "🥭",
  avocado: "🥑",

  // Oils & Condiments
  olio: "🫒",
  aceto: "🧴",
  sale: "🧂",
  pepe: "🫚",
  peperoncino: "🌶️",
  basilico: "🌿",
  origano: "🌿",
  rosmarino: "🌿",
  salvia: "🌿",
  prezzemolo: "🌿",

  // Seafood
  pesce: "🐟",
  salmone: "🐟",
  tonno: "🐟",
  merluzzo: "🐟",
  orata: "🐟",
  branzino: "🐟",
  gamberi: "🦐",
  scampi: "🦐",
  calamari: "🦑",
  polpo: "🐙",
  cozze: "🦪",
  vongole: "🦪",
  ostriche: "🦪",
  aragosta: "🦞",

  // Sweets & Desserts
  cioccolato: "🍫",
  gelato: "🍨",
  torta: "🍰",
  biscotti: "🍪",
  miele: "🍯",
  marmellata: "🍓",
  nutella: "🍫",
  tiramisu: "🍰",
  "panna cotta": "🍮",
  cannoli: "🥐",
  amaretti: "🍪",
  panettone: "🍞",
  pandoro: "🍞",

  // Beverages
  vino: "🍷",
  birra: "🍺",
  acqua: "💧",
  caffè: "☕",
  tè: "🍵",
  latte: "🥛",
  succo: "🧃",
  spritz: "🍹",
  prosecco: "🥂",
  champagne: "🍾",
  liquore: "🥃",
  grappa: "🥃",
  amaro: "🥃",
  limoncello: "🍋",

  // Grains & Legumes
  riso: "🍚",
  farro: "🌾",
  orzo: "🌾",
  quinoa: "🌾",
  lenticchie: "🫘",
  ceci: "🫘",
  fagioli: "🫘",
  piselli: "🫘",
}

// Category-based fallback icons
const CATEGORY_ICONS: ProductIconMap = {
  latticini: "🥛",
  formaggi: "🧀",
  salumi: "🥓",
  carne: "🥩",
  pesce: "🐟",
  pasta: "🍝",
  pane: "🍞",
  verdura: "🥬",
  frutta: "🍎",
  dolci: "🍰",
  bevande: "🥤",
  vini: "🍷",
  birre: "🍺",
  olio: "🫒",
  condimenti: "🧂",
  spezie: "🌿",
  conserve: "🥫",
  surgelati: "❄️",
  gastronomia: "🍽️",
  bakery: "🥖",
  dairy: "🥛",
  meat: "🥩",
  seafood: "🐟",
  vegetables: "🥬",
  fruits: "🍎",
  drinks: "🥤",
  sweets: "🍰",
}

/**
 * Get icon for a product based on its name and category
 */
export function getProductIcon(
  productName: string,
  categoryName?: string
): string {
  const normalizedName = productName.toLowerCase().trim()
  const normalizedCategory = categoryName?.toLowerCase().trim()

  // 1. Try exact match on product name
  for (const [keyword, icon] of Object.entries(EXACT_PRODUCT_ICONS)) {
    if (normalizedName.includes(keyword)) {
      return icon
    }
  }

  // 2. Try category match
  if (normalizedCategory) {
    for (const [keyword, icon] of Object.entries(CATEGORY_ICONS)) {
      if (normalizedCategory.includes(keyword)) {
        return icon
      }
    }
  }

  // 3. Default fallback
  return "📦"
}

// Service icon mappings
const SERVICE_ICONS: ProductIconMap = {
  // Installation & Technical
  installazione: "🔧",
  montaggio: "🔧",
  riparazione: "🔨",
  manutenzione: "🛠️",
  assistenza: "👷",
  consulenza: "💼",

  // Delivery & Transport
  consegna: "🚚",
  trasporto: "🚛",
  spedizione: "📦",

  // Cleaning & Maintenance
  pulizia: "🧹",
  lavaggio: "💧",
  sanificazione: "🧼",

  // Design & Planning
  progettazione: "📐",
  design: "🎨",
  planning: "📋",

  // Training & Support
  formazione: "📚",
  training: "🎓",
  supporto: "🆘",
  help: "❓",

  // Default
  servizio: "🛠️",
  service: "🛠️",
}

/**
 * Get icon for a service based on its name
 */
export function getServiceIcon(serviceName: string): string {
  const normalizedName = serviceName.toLowerCase().trim()

  // Try to match service keywords
  for (const [keyword, icon] of Object.entries(SERVICE_ICONS)) {
    if (normalizedName.includes(keyword)) {
      return icon
    }
  }

  // Default service icon
  return "🛠️"
}

/**
 * Get all available icons (for testing/preview)
 */
export function getAllProductIcons(): ProductIconMap {
  return { ...EXACT_PRODUCT_ICONS, ...CATEGORY_ICONS }
}
