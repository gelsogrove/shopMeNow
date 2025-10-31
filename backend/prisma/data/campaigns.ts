/**
 * Campaigns Data - Auto-generated from database
 * Last updated: 2025-10-30T16:02:52.316Z
 * DO NOT EDIT MANUALLY - Use npm run db:export
 */

export interface CampaignData {
  name: string
  messagePreview: string
  frequency: string
  isActive: boolean
  targetType: string
  customerIds?: string[]
  templateName?: string | null
  templateParams?: any | null
  lastRunAt?: Date | null
}

export const campaigns: CampaignData[] = [
  {
    name: "Richiesta Feedback Trimestrale",
    messagePreview: "Ciao {{nome}}! 👋\n\nCi piacerebbe sapere cosa pensi dei nostri prodotti. [FEEDBACK]\n\nGrazie per il tuo tempo! 🙏",
    frequency: "QUARTERLY",
    isActive: true,
    targetType: "ALL",
    customerIds: [],
    templateName: null,
    templateParams: null,
    lastRunAt: new Date("2025-10-20T08:00:00.030Z"),
  }
]
