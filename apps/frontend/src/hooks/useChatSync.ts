import { logger } from "@/lib/logger"

export function useChatSync() {
  // DISABLED: BroadcastChannel causes infinite loop with multiple tabs
  // Polling will handle updates with a 4-second delay instead

  const notifyOtherTabs = () => {
    // No-op: Cross-tab sync is disabled
    logger.info("📢 Cross-tab sync disabled - relying on polling instead")
  }

  return { notifyOtherTabs }
}
