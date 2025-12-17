/**
 * Services Data - Auto-generated from database
 * Last updated: 2025-10-30T16:02:52.305Z
 * Seed data for eChatbot
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
    name: "Confezione Regalo",
    code: "GFT001",
    description: "Servizio di confezione regalo di lusso con messaggio personalizzato e materiali premium.",
    price: 30,
    isActive: true,
    imageUrl: ["/uploads/services/GFT001_1760563067773_otbvy8.webp"],
  }
]
