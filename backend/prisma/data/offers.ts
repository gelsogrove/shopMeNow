/**
 * Offers Data - Auto-generated from database
 * Last updated: 2025-10-20T08:07:41.507Z
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
    categoryId: "441d50c6-9eda-465d-a640-572c2ac25a6b",
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
    categoryId: "1291e690-2dad-403b-ad32-4832d2cbbfff",
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
    categoryId: "1291e690-2dad-403b-ad32-4832d2cbbfff",
    categoryName: "Pasta",
    categoryNames: [],
  },
]
