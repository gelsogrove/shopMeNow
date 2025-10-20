/**
 * Offers Data - Auto-generated from database
 * Last updated: 2025-10-20T10:51:38.526Z
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
    value: 10,
    validFrom: new Date("2025-10-20T07:41:05.436Z"),
    validUntil: new Date("2025-11-19T07:41:05.436Z"),
    isActive: true,
    categoryId: "b4f29db7-d23f-4ea8-9af7-1d1b0c7866ee",
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
    categoryId: "dd8cba85-aa69-4e77-b636-c9be86537c4a",
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
    categoryId: "dd8cba85-aa69-4e77-b636-c9be86537c4a",
    categoryName: "Pasta",
    categoryNames: [],
  }
]
