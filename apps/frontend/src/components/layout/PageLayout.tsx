import { WhatsAppChatModal } from "@/components/shared/WhatsAppChatModal"
import { useWorkspace } from "@/hooks/use-workspace"
import { useGlobalNewMessageNotifier } from "@/hooks/useGlobalNewMessageNotifier"
import { Chat } from "@/types/chat"
import { ReactNode, useState } from "react"

interface PageLayoutProps {
  children: ReactNode
  selectedChat?: Chat | null
}

/**
 * Standard layout wrapper for all main pages in the application
 * Ensures consistent page structure and spacing
 */
export function PageLayout({ children, selectedChat }: PageLayoutProps) {
  const { workspace } = useWorkspace()
  const [showPlaygroundDialog, setShowPlaygroundDialog] =
    useState<boolean>(false)

  // Global background polling for new message notifications
  useGlobalNewMessageNotifier()

  const handlePlaygroundClick = () => {
    setShowPlaygroundDialog(true)
  }

  const handleClosePlayground = () => {
    setShowPlaygroundDialog(false)
    // Rimosso il ricaricamento della pagina che causava problemi di autenticazione
  }

  return (
    <div className="container pl-0 pr-4 pt-4 pb-4 relative">
      <div className="grid grid-cols-12 gap-0">
        <div className="col-span-11 col-start-1">{children}</div>
      </div>

      {/* Playground Chat Modal */}
      <WhatsAppChatModal
        isOpen={showPlaygroundDialog}
        onClose={handleClosePlayground}
        channelName="WhatsApp Chat"
        phoneNumber={selectedChat?.customerPhone || ""}
        workspaceId={workspace?.id}
        selectedChat={selectedChat}
      />
    </div>
  )
}
