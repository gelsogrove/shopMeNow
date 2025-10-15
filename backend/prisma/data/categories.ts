/**
 * Food Categories Data - Altro Gusto
 * Exported for use in seed script
 *
 * English titles and descriptions
 */

export interface CategoryData {
  name: string
  slug: string
  description: string
}

export const foodCategories: CategoryData[] = [
  {
    name: "Pasta",
    slug: "pasta",
    description:
      "Traditional Italian pasta shapes crafted from durum wheat semolina, perfect for authentic first courses.",
  },
  {
    name: "Cured Meats",
    slug: "cured-meats",
    description:
      "Artisanal cured meats sliced to order, ideal for antipasti boards and gourmet panini.",
  },
  {
    name: "Cheeses",
    slug: "cheeses",
    description:
      "Fine Italian cheeses with DOP heritage, offering a balanced mix of fresh and aged specialties.",
  },
  {
    name: "Condiments",
    slug: "condiments",
    description:
      "Sauces, oils, and pantry condiments that elevate Italian recipes with bold flavour and aroma.",
  },
  {
    name: "Desserts",
    slug: "desserts",
    description:
      "Classic Italian desserts and biscuits to finish every meal with a sweet touch.",
  },
  {
    name: "Beverages",
    slug: "beverages",
    description:
      "Signature Italian beverages, wines, and coffee selections curated for premium service.",
  },
  {
    name: "Specialties",
    slug: "specialties",
    description:
      "Limited-edition regional delicacies that showcase Italy's culinary diversity.",
  },
  {
    name: "Preserves",
    slug: "preserves",
    description:
      "Vegetables preserved in olive oil and brine, ready to serve as refined antipasti or garnishes.",
  },
]
