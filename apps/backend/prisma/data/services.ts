/**
 * Services Data - Auto-generated from database
 * Last updated: 2025-10-30T16:02:52.305Z
 * DO NOT EDIT MANUALLY - Use npm run db:export
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
    imageUrl: ["/uploads/services/SHP001_1760565437670_4yuoes.jpg"],
  },
  {
    name: "Gift Wrapping",
    code: "GFT001",
    description: "Luxury gift wrapping service with personalized message and premium packaging materials.",
    price: 30,
    isActive: true,
    imageUrl: ["/uploads/services/GFT001_1760563067773_otbvy8.webp"],
  }
]
