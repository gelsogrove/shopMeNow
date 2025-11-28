/**
 * Sales Representatives Data - Auto-generated from database
 * Last updated: 2025-10-30T16:02:52.319Z
 * Seed data for ShopME
 */

export interface SalesRepData {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  isActive: boolean
}

export const salesReps: SalesRepData[] = [
  {
    firstName: "Marco",
    lastName: "Bianchi",
    email: "marco.bianchi@altrogusto.com",
    phone: "+393331234567",
    isActive: true,
  },
  {
    firstName: "Laura",
    lastName: "Conti",
    email: "laura.conti@altrogusto.com",
    phone: "+393337654321",
    isActive: true,
  },
  {
    firstName: "Giuseppe",
    lastName: "Ferretti",
    email: "giuseppe.ferretti@altrogusto.com",
    phone: "+393339876543",
    isActive: true,
  },
  {
    firstName: "Francesca",
    lastName: "Moretti",
    email: "francesca.moretti@altrogusto.com",
    phone: "+393334567890",
    isActive: true,
  },
  {
    firstName: "Alessandro",
    lastName: "Romano",
    email: "alessandro.romano@altrogusto.com",
    phone: "+393338901234",
    isActive: true,
  }
]
