/**
 * Offers Data - Auto-generated from database
 * Last updated: 2025-10-17T15:45:07.373Z
 * DO NOT EDIT MANUALLY - Use npm run db:export-to-seed
 */

export interface OfferData {
  name: string
  description: string
  type: string
  value: number
  validFrom: Date
  validUntil: Date
  isActive: boolean
}

export const offers: OfferData[] = [
  {
    name: "Frozen Products 20% Offer",
    description: "20% discount on all frozen products!",
    type: null,
    value: null,
    validFrom: null,
    validUntil: null,
    isActive: true,
  },
  {
    name: "Black Friday Special",
    description: "Huge discounts on all products for Black Friday weekend!",
    type: null,
    value: null,
    validFrom: null,
    validUntil: null,
    isActive: false,
  },
  {
    name: "Summer Sale",
    description: "Special summer discounts on selected products!",
    type: null,
    value: null,
    validFrom: null,
    validUntil: null,
    isActive: false,
  }
]
