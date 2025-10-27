/**
 * Offers Data - Auto-generated from database
 * Last updated: 2025-10-26T20:38:25.363Z
 * DO NOT EDIT MANUALLY - Use npm run db:export
 */

export interface OfferData {
  name: string
  description: string
  type: string | null
  value: number | null
  validFrom: Date | null
  validUntil: Date | null
  isActive: boolean
  categoryId?: string | null
  categoryName?: string | null
  categoryNames?: string[]
}

export const offers: OfferData[] = [
  {
    name: "Frozen Products 20% Offer",
    description: "20% discount on all frozen products!",
    type: null,
    value: 20,
    validFrom: new Date("2025-10-20T07:41:05.436Z"),
    validUntil: new Date("2025-11-19T07:41:05.436Z"),
    isActive: true,
    categoryId: "49d3c610-32a0-4661-93df-27d9e205b177",
    categoryName: "Frozen Products",
    categoryNames: [],
  },
  {
    name: "Black Friday Special",
    description: "Huge discounts on all products for Black Friday weekend!",
    type: null,
    value: 10,
    validFrom: new Date("2025-10-20T07:41:05.437Z"),
    validUntil: new Date("2025-11-19T07:41:05.437Z"),
    isActive: false,
    categoryId: "0bfb097c-91ae-468e-8d86-b432e86b36a5",
    categoryName: "Pasta",
    categoryNames: [],
  },
  {
    name: "Summer Sale",
    description: "Special summer discounts on selected products!",
    type: null,
    value: 10,
    validFrom: new Date("2025-10-20T07:41:05.438Z"),
    validUntil: new Date("2025-11-19T07:41:05.438Z"),
    isActive: false,
    categoryId: "0bfb097c-91ae-468e-8d86-b432e86b36a5",
    categoryName: "Pasta",
    categoryNames: [],
  }
]
