import { NextFunction, Request, Response } from 'express'
import logger from '../../../utils/logger'

/**
 * 🔧 LINK CORRECTOR MIDDLEWARE - BYPASS LLM HARDCODED LINKS
 * 
 * Questo middleware intercetta le risposte contenenti link hardcoded sbagliati
 * e li corregge automaticamente con i link corretti
 */

// Mapping dei link sbagliati -> link corretti
const LINK_CORRECTIONS = {
  // Profile management links
  '/profile-management': '/customer-profile',
  
  // ❌ REMOVED: '/orders/' -> '/orders-public/' 
  // This was dangerous because it creates links without tokens!
  // The LLM MUST use [LINK_ORDERS_WITH_TOKEN] token instead
  
  // Altri link comuni sbagliati
  'https://laltrait.com/profile-management': '/customer-profile'
}

export const linkCorrectorMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Intercetta il metodo json() per modificare la risposta
  const originalJson = res.json
  
  res.json = function(body: any) {
    try {
      // Se la risposta contiene un messaggio di testo, correggi i link
      if (body && typeof body.message === 'string') {
        let correctedMessage = body.message
        
        // Applica tutte le correzioni
        for (const [wrongLink, correctLink] of Object.entries(LINK_CORRECTIONS)) {
          if (correctedMessage.includes(wrongLink)) {
            logger.info(`🔧 LINK CORRECTOR: Fixing ${wrongLink} -> ${correctLink}`)
            
            // Sostituisci il link sbagliato con quello corretto
            const regex = new RegExp(wrongLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
            correctedMessage = correctedMessage.replace(regex, correctLink)
            
            // TOKEN-ONLY: Non serve più aggiungere phone parameter
            // Il token contiene già tutte le informazioni necessarie
          }
        }
        
        // Aggiorna il body con il messaggio corretto
        if (correctedMessage !== body.message) {
          body.message = correctedMessage
          logger.info(`🔧 LINK CORRECTOR: Message corrected`)
        }
      }
      
      // Chiama il metodo json originale con il body (eventualmente) modificato
      return originalJson.call(this, body)
    } catch (error) {
      logger.error('Error in linkCorrectorMiddleware:', error)
      // In caso di errore, usa il metodo originale
      return originalJson.call(this, body)
    }
  }
  
  next()
}
