/**
 * RepeatOrder - LLM-Callable Function
 *
 * Repeats a previous order by adding all its items to the current cart.
 * Used when customer says: "Voglio riordinare", "Ripeti l'ordine", "Riordino", etc.
 *
 * ⚠️ IMPORTANTE: Questa funzione aggiunge al carrello esistente (non lo sostituisce)
 *
 * @see docs/prompt_agent.md - Sezione "repeatOrder()"
 */

import logger from "../../utils/logger"

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
    logger.info("🔄 RepeatOrder called with:", {
      customerId: request.customerId,
      workspaceId: request.workspaceId,
      orderCode: request.orderCode,
    })

    // Validazione parametri obbligatori
    if (!request.customerId || !request.workspaceId) {
      logger.error("❌ Missing required parameters in RepeatOrder")
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
        logger.error("❌ Customer not found in RepeatOrder")
        return {
          success: false,
          error: "Cliente non trovato",
          message:
            "Ops {{nameUser}}! 😅\n\n" +
            "Non riesco a trovare il tuo account nel sistema. Questo è strano!\n\n" +
            "📞 Contatta il nostro supporto: {{agentPhone}}\n" +
            "📧 Email: {{agentEmail}}\n\n" +
            "Ti aiuteremo subito! 🚀",
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
        logger.error("❌ No order found to repeat")
        return {
          success: false,
          error: "Nessun ordine trovato",
          message:
            "Ciao {{nameUser}}! 👋\n\n" +
            "Non trovo ordini precedenti da ripetere. È la prima volta che ordini da noi? 🎉\n\n" +
            "Nessun problema! Dai un'occhiata alle nostre **offerte speciali** e ai prodotti disponibili!\n\n" +
            "💡 Hai uno sconto del **{{discountUser}}%** su tutti i prodotti! 🛍️\n\n" +
            "Cosa ti piacerebbe ordinare oggi? 😊",
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

      const token = await secureTokenService.createToken(
        "cart",
        request.workspaceId,
        { customerId: request.customerId },
        undefined,
        undefined,
        undefined,
        undefined,
        request.customerId
      )

      // Genera short URL del carrello (come addProductToCart)
      const {
        linkGeneratorService,
      } = require("../../application/services/link-generator.service")
      const cartUrl = await linkGeneratorService.generateCheckoutLink(
        token,
        request.workspaceId
      )

      await prisma.$disconnect()

      logger.info("✅ RepeatOrder success: added", productsAdded, "products")
      return {
        success: true,
        message:
          `Perfetto {{nameUser}}! ✅\n\n` +
          `Ho aggiunto **${productsAdded} prodotto/i** dal tuo ultimo ordine (${order.orderCode}) al carrello! 🛒\n\n` +
          `🛒 **Vai al checkout**:\n` +
          `[LINK_CHECKOUT_WITH_TOKEN]\n\n` +
          `⏰ Link valido per {{TOKEN_DURATION}}\n\n` +
          `💡 **Ricorda**: hai uno sconto del **{{discountUser}}%** applicato automaticamente! 🎉\n\n` +
          `Vuoi procedere con l'ordine o modificare qualcosa? 😊`,
        cartCode: cart.id,
        orderCode: order.orderCode,
        productsAdded,
        cartUrl,
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1 ora
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      logger.error("❌ Error in RepeatOrder database operations:", error)
      await prisma.$disconnect()

      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore del database",
        message:
          "Ops {{nameUser}}! 😅\n\n" +
          "Si è verificato un problema tecnico durante il ripristino del tuo ordine.\n\n" +
          "Non preoccuparti! Puoi:\n" +
          "• Riprovare tra qualche minuto ⏰\n" +
          "• Fare un nuovo ordine manualmente 🛍️\n" +
          "• Contattare il supporto: {{agentPhone}} 📞\n\n" +
          "Ci scusiamo per l'inconveniente! 🙏",
        timestamp: new Date().toISOString(),
      }
    }
  } catch (error) {
    logger.error("❌ Error in RepeatOrder:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore interno",
      message:
        "Ops {{nameUser}}! 😅\n\n" +
        "Si è verificato un problema tecnico durante il ripristino del tuo ordine.\n\n" +
        "Non preoccuparti! Puoi:\n" +
        "• Riprovare tra qualche minuto ⏰\n" +
        "• Fare un nuovo ordine manualmente 🛍️\n" +
        "• Contattare il supporto: {{agentPhone}} 📞\n\n" +
        "Ci scusiamo per l'inconveniente! 🙏",
      timestamp: new Date().toISOString(),
    }
  }
}
