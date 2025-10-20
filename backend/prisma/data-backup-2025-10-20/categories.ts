/**
 * Categories Data - Auto-generated from database
 * Last updated: 2025-10-20T08:07:41.491Z
 * DO NOT EDIT MANUALLY - Use npm run db:export
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
    description:
      "Traditional Italian pasta shapes crafted from durum wheat semolina, perfect for authentic first courses.",
    slug: "pasta",
    isActive: true,
  },
  {
    name: "Cured Meats",
    description:
      "Artisanal cured meats sliced to order, ideal for antipasti boards and gourmet panini.",
    slug: "cured-meats",
    isActive: true,
  },
  {
    name: "Cheeses",
    description:
      "Fine Italian cheeses with DOP heritage, offering a balanced mix of fresh and aged specialties.",
    slug: "cheeses",
    isActive: true,
  },
  {
    name: "Condiments",
    description:
      "Sauces, oils, and pantry condiments that elevate Italian recipes with bold flavour and aroma.",
    slug: "condiments",
    isActive: true,
  },
  {
    name: "Desserts",
    description:
      "Classic Italian desserts and biscuits to finish every meal with a sweet touch.",
    slug: "desserts",
    isActive: true,
  },
  {
    name: "Beverages",
    description:
      "Signature Italian beverages, wines, and coffee selections curated for premium service.",
    slug: "beverages",
    isActive: true,
  },
  {
    name: "Specialties",
    description:
      "Limited-edition regional delicacies that showcase Italy's culinary diversity.",
    slug: "specialties",
    isActive: true,
  },
  {
    name: "Preserves",
    description:
      "Vegetables preserved in olive oil and brine, ready to serve as refined antipasti or garnishes.",
    slug: "preserves",
    isActive: true,
  },
  {
    name: "Frozen Products",
    description:
      "High-quality frozen Italian products, from seafood to ready-made dishes. Currently with 20% discount!",
    slug: "frozen-products",
    isActive: true,
  },
]
