/**
 * Services Data - Auto-generated from database
 * Last updated: 2025-10-15T21:58:07.664Z
 * DO NOT EDIT MANUALLY - Use npm run db:export-to-seed
 */

export interface ServiceData {
  name: string
  code: string
  description: string
  price: number
  isActive: boolean
  imageUrl?: string[]
}

export const services: ServiceData[] = [
  {
    name: "Shipping",
    code: "SHP001",
    description: "Standard shipping service for orders within Italy. Delivery within 3-5 business days.",
    price: 5,
    isActive: true,
    imageUrl: [],
  },
  {
    name: "Gift Wrapping",
    code: "GFT001",
    description: "Luxury gift wrapping service with personalized message and premium packaging materials.",
    price: 30,
    isActive: true,
    imageUrl: [],
  }
]
