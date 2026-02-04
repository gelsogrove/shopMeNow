/**
 * WhatsApp Provider Factory
 * 
 * Creates the appropriate WhatsApp provider based on workspace configuration
 * 
 * @architecture Factory Pattern
 * @critical ALWAYS reads workspace.whatsappProvider to determine which provider to use
 */

import { Workspace } from '@echatbot/database'
import logger from '../../utils/logger'
import { WhatsAppProvider } from './whatsapp-provider.interface'
import { MetaWhatsAppProvider } from './meta-whatsapp-provider'
import { UltraMsgWhatsAppProvider } from './ultramsg-whatsapp-provider'

export class WhatsAppProviderFactory {
  /**
   * Create WhatsApp provider based on workspace configuration
   * 
   * @param workspace - Workspace with provider configuration
   * @returns Configured WhatsApp provider instance
   * @throws Error if provider is not configured properly
   */
  static create(workspace: any): WhatsAppProvider {
    const provider = workspace.whatsappProvider || 'meta'

    logger.info('🏭 WhatsAppProviderFactory: Creating provider', {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      provider,
    })

    // UltraMsg Provider
    if (provider === 'ultramsg') {
      if (!workspace.ultraMsgInstanceId || !workspace.ultraMsgToken) {
        const error = 'UltraMsg provider selected but credentials not configured'
        logger.error('❌ WhatsAppProviderFactory: Configuration error', {
          workspaceId: workspace.id,
          error,
        })
        throw new Error(error)
      }

      logger.info('✅ WhatsAppProviderFactory: Creating UltraMsg provider', {
        workspaceId: workspace.id,
        instanceId: workspace.ultraMsgInstanceId,
      })

      return new UltraMsgWhatsAppProvider({
        instanceId: workspace.ultraMsgInstanceId,
        token: workspace.ultraMsgToken,
      })
    }

    // Meta Provider (default)
    if (!workspace.metaPhoneNumberId || !workspace.metaAccessToken) {
      const error = 'Meta provider selected but credentials not configured'
      logger.error('❌ WhatsAppProviderFactory: Configuration error', {
        workspaceId: workspace.id,
        error,
      })
      throw new Error(error)
    }

    logger.info('✅ WhatsAppProviderFactory: Creating Meta provider', {
      workspaceId: workspace.id,
      phoneNumberId: workspace.metaPhoneNumberId,
    })

    return new MetaWhatsAppProvider({
      phoneNumberId: workspace.metaPhoneNumberId,
      accessToken: workspace.metaAccessToken,
    })
  }

  /**
   * Check if workspace has a WhatsApp provider configured
   */
  static isConfigured(workspace: any): boolean {
    const provider = workspace.whatsappProvider || 'meta'

    if (provider === 'ultramsg') {
      return !!(workspace.ultraMsgInstanceId && workspace.ultraMsgToken)
    }

    // Meta
    return !!(workspace.metaPhoneNumberId && workspace.metaAccessToken)
  }

  /**
   * Get provider name for display
   */
  static getProviderDisplayName(workspace: any): string {
    const provider = workspace.whatsappProvider || 'meta'
    return provider === 'ultramsg' ? 'UltraMsg' : 'Meta Business API'
  }
}
