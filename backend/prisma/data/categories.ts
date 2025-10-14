/**
 * Food Categories Data - Altro Gusto
 * Exported for use in seed script
 *
 * Italian titles with English descriptions (as per requirements)
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
    name: "Salumi",
    slug: "salumi",
    description:
      "Artisanal cured meats sliced to order, ideal for antipasti boards and gourmet panini.",
  },
  {
    name: "Formaggi",
    slug: "formaggi",
    description:
      "Fine Italian cheeses with DOP heritage, offering a balanced mix of fresh and aged specialties.",
  },
  {
    name: "Condimenti",
    slug: "condimenti",
    description:
      "Sauces, oils, and pantry condiments that elevate Italian recipes with bold flavour and aroma.",
  },
  {
    name: "Dolci",
    slug: "dolci",
    description:
      "Classic Italian desserts and biscuits to finish every meal with a sweet touch.",
  },
  {
    name: "Bevande",
    slug: "bevande",
    description:
      "Signature Italian beverages, wines, and coffee selections curated for premium service.",
  },
  {
    name: "Specialità",
    slug: "specialita",
    description:
      "Limited-edition regional delicacies that showcase Italy's culinary diversity.",
  },
  {
    name: "Sottolio e Conserve",
    slug: "sottolio-e-conserve",
    description:
      "Vegetables preserved in olive oil and brine, ready to serve as refined antipasti or garnishes.",
  },
]
