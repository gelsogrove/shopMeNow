import { PrismaClient, Suppliers } from "@echatbot/database"

// prisma imported

export interface CreateSupplierData {
  companyName: string
  description?: string
  website?: string
  phone?: string
  email?: string
  contactName?: string
  region?: string
  country?: string
  logoUrl?: string
  workspaceId: string
}

export interface UpdateSupplierData {
  companyName?: string
  description?: string
  website?: string
  phone?: string
  email?: string
  contactName?: string
  region?: string
  country?: string
  logoUrl?: string
  isActive?: boolean
}

export class SupplierRepository {
  async findAll(workspaceId: string): Promise<Suppliers[]> {
    return prisma.suppliers.findMany({
      where: {
        workspaceId,
        isActive: true,
      },
      orderBy: {
        companyName: "asc",
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    })
  }

  async findById(id: string, workspaceId: string): Promise<Suppliers | null> {
    return prisma.suppliers.findFirst({
      where: {
        id,
        workspaceId,
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    })
  }

  async create(data: CreateSupplierData): Promise<Suppliers> {
    return prisma.suppliers.create({
      data,
    })
  }

  async update(
    id: string,
    workspaceId: string,
    data: UpdateSupplierData
  ): Promise<Suppliers> {
    return prisma.suppliers.update({
      where: {
        id,
        workspaceId,
      },
      data,
    })
  }

  async delete(id: string, workspaceId: string): Promise<Suppliers> {
    return prisma.suppliers.update({
      where: {
        id,
        workspaceId,
      },
      data: {
        isActive: false,
      },
    })
  }

  async count(workspaceId: string): Promise<number> {
    return prisma.suppliers.count({
      where: {
        workspaceId,
        isActive: true,
      },
    })
  }
}
