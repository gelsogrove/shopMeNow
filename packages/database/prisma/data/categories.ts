/**
 * Categories Data - Auto-generated from database
 * Last updated: 2025-10-30T16:02:52.294Z
 * Seed data for ShopME
 */

export interface CategoryData {
  name: string
  description: string
  slug: string
  isActive?: boolean
}

export const categories: CategoryData[] = [
  {
    name: "Pasta",
    description: "Pasta tradizionale italiana di semola di grano duro, perfetta per autentici primi piatti.",
    slug: "pasta",
    isActive: true,
  },
  {
    name: "Salumi",
    description: "Salumi artigianali affettati al momento, ideali per taglieri e panini gourmet.",
    slug: "salumi",
    isActive: true,
  },
  {
    name: "Formaggi",
    description: "Formaggi italiani DOP, un mix equilibrato di specialità fresche e stagionate.",
    slug: "formaggi",
    isActive: true,
  },
  {
    name: "Condimenti",
    description: "Salse, oli e condimenti da dispensa che esaltano le ricette italiane.",
    slug: "condimenti",
    isActive: true,
  },
  {
    name: "Dolci",
    description: "Dolci e biscotti italiani classici per concludere ogni pasto con dolcezza.",
    slug: "dolci",
    isActive: true,
  },
  {
    name: "Bevande",
    description: "Bevande italiane, vini e caffè selezionati per un servizio premium.",
    slug: "bevande",
    isActive: true,
  },
  {
    name: "Specialità",
    description: "Prelibatezze regionali in edizione limitata che celebrano la diversità culinaria italiana.",
    slug: "specialita",
    isActive: true,
  },
  {
    name: "Conserve",
    description: "Verdure conservate sott'olio e in salamoia, pronte come antipasti o contorni.",
    slug: "conserve",
    isActive: true,
  },
  {
    name: "Surgelati",
    description: "Prodotti surgelati italiani di alta qualità. Attualmente con sconto del 20%!",
    slug: "surgelati",
    isActive: true,
  }
]
