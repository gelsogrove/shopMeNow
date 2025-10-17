/**
 * RepeatOrder - LLM-Callable Function
 *
 * Ripete l'ultimo ordine (o un ordine specifico) aggiungendo tutti i prodotti al carrello.
 * Utilizzata quando l'utente chiede: "Ripeti il mio ultimo ordine", "Ordina di nuovo come l'ultima volta", etc.
 *
 * @see docs/prompt_agent.md - Sezione "repeatOrder()"
 */

export interface RepeatOrderRequest {
  customerId: string
  workspaceId: string
  orderCode?: string // Se non specificato, usa ultimo ordine del cliente
}

export interface RepeatOrderResult {
  success: boolean
  message: string
  cartCode?: string // Codice carrello
  orderCode?: string // Codice ordine copiato
  productsAdded?: number // Numero di prodotti aggiunti
  cartUrl?: string // URL pubblico del carrello con token
  expiresAt?: string
  timestamp: string
  error?: string
}

/**
 * Ripete un ordine precedente aggiungendo i prodotti al carrello
 *
 * @param request - Request parameters
 * @returns Result con confirmazione e link carrello
 */
export async function RepeatOrder(
  request: RepeatOrderRequest
): Promise<RepeatOrderResult> {
  try {
    console.log("🔄 RepeatOrder called with:", {
      customerId: request.customerId,
      workspaceId: request.workspaceId,
      orderCode: request.orderCode,
    })

    // Validazione parametri obbligatori
    if (!request.customerId || !request.workspaceId) {
      console.error("❌ Missing required parameters in RepeatOrder")
      return {
        success: false,
        error: "Parametri richiesti mancanti",
        message: "Impossibile ripetere l'ordine. Parametri incompleti.",
        timestamp: new Date().toISOString(),
      }
    }

    const { PrismaClient } = require("@prisma/client")
    const prisma = new PrismaClient()

    try {
      // Trova il cliente
      const customer = await prisma.customers.findFirst({
        where: {
          id: request.customerId,
          workspaceId: request.workspaceId,
        },
      })

      if (!customer) {
        console.error("❌ Customer not found in RepeatOrder")
        return {
          success: false,
          error: "Cliente non trovato",
          message:
            "Non riesco a trovare il tuo account. Contatta il nostro supporto.",
          timestamp: new Date().toISOString(),
        }
      }

      // Se orderCode non è specificato, prendi l'ultimo ordine
      let order
      if (request.orderCode) {
        order = await prisma.orders.findFirst({
          where: {
            orderCode: request.orderCode,
            customerId: request.customerId,
            workspaceId: request.workspaceId,
          },
          include: {
            items: {
              include: {
                product: true,
                service: true,
              },
            },
          },
        })
      } else {
        // Prendi l'ultimo ordine (più recente)
        order = await prisma.orders.findFirst({
          where: {
            customerId: request.customerId,
            workspaceId: request.workspaceId,
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            items: {
              include: {
                product: true,
                service: true,
              },
            },
          },
        })
      }

      if (!order || !order.items || order.items.length === 0) {
        console.error("❌ No order found to repeat")
        return {
          success: false,
          error: "Nessun ordine trovato",
          message:
            "Non trovo ordini precedenti da ripetere. Fai un nuovo ordine!",
          timestamp: new Date().toISOString(),
        }
      }

      // Svuota il carrello esistente (opzionale, per ricominciare pulito)
      let cart = await prisma.carts.findFirst({
        where: {
          customerId: request.customerId,
          workspaceId: request.workspaceId,
        },
      })

      if (!cart) {
        // Crea carrello se non esiste
        cart = await prisma.carts.create({
          data: {
            customerId: request.customerId,
            workspaceId: request.workspaceId,
          },
        })
      }

      // Opzionale: svuota il carrello prima di aggiungere i nuovi prodotti
      // Commenta questa sezione se vuoi aggiungere ai prodotti esistenti
      await prisma.cartItems.deleteMany({
        where: {
          cartId: cart.id,
        },
      })

      // Aggiungi tutti i prodotti/servizi dell'ordine al carrello
      let productsAdded = 0
      for (const item of order.items) {
        if (item.itemType === "PRODUCT" && item.productId) {
          // Verifica che il prodotto esista ancora e sia in stock
          const product = await prisma.products.findUnique({
            where: { id: item.productId },
          })

          if (product && product.stock > 0) {
            await prisma.cartItems.create({
              data: {
                cartId: cart.id,
                productId: item.productId,
                quantity: item.quantity,
                itemType: "PRODUCT",
                notes: item.notes,
              },
            })
            productsAdded++
          }
        } else if (item.itemType === "SERVICE" && item.serviceId) {
          // Aggiungi servizio al carrello
          await prisma.cartItems.create({
            data: {
              cartId: cart.id,
              serviceId: item.serviceId,
              quantity: item.quantity,
              itemType: "SERVICE",
              notes: item.notes,
            },
          })
          productsAdded++
        }
      }

      // Genera link carrello con token sicuro
      const {
        SecureTokenService,
      } = require("../../application/services/secure-token.service")
      const secureTokenService = new SecureTokenService()

      const token = secureTokenService.generateToken({
        customerId: request.customerId,
        workspaceId: request.workspaceId,
        type: "cart",
      })

      await prisma.$disconnect()

      const cartUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/cart?token=${token}`

      console.log("✅ RepeatOrder success: added", productsAdded, "products")

      return {
        success: true,
        message: `Perfetto! Ho aggiunto ${productsAdded} prodotto/i dal tuo ultimo ordine al carrello.`,
        cartCode: cart.id,
        orderCode: order.orderCode,
        productsAdded,
        cartUrl,
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1 ora
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error("❌ Error in RepeatOrder database operations:", error)
      await prisma.$disconnect()

      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore del database",
        message: "Impossibile ripetere l'ordine. Riprova più tardi.",
        timestamp: new Date().toISOString(),
      }
    }
  } catch (error) {
    console.error("❌ Error in RepeatOrder:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore interno",
      message: "Impossibile ripetere l'ordine. Riprova più tardi.",
      timestamp: new Date().toISOString(),
    }
  }
}
