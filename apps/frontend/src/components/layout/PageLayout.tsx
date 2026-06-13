import { WhatsAppChatModal } from "@/components/shared/WhatsAppChatModal"
import { useWorkspace } from "@/hooks/use-workspace"
import { useGlobalNewMessageNotifier } from "@/hooks/useGlobalNewMessageNotifier"
import { Chat } from "@/types/chat"
import { ReactNode, useState } from "react"

interface PageLayoutProps {
  children: ReactNode
  selectedChat?: Chat | null
  fullscreen?: boolean
}

/**
 * Standard layout wrapper for all main pages in the application
 * Ensures consistent page structure and spacing
 */
export function PageLayout({ children, selectedChat, fullscreen = false }: PageLayoutProps) {
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
    <div className={fullscreen ? "flex flex-col h-full w-full relative" : "container mx-auto px-4 pt-4 pb-4 relative"}>
      {children}

      {/* Playground Chat Modal */}
      <WhatsAppChatModal
        isOpen={showPlaygroundDialog}
        onClose={handleClosePlayground}
        channelName="WhatsApp Chat"
        phoneNumber={selectedChat?.customerPhone || ""}
        workspaceId={workspace?.id}
        selectedChat={selectedChat}
        logoUrl={workspace?.logoUrl}
      />
    </div>
  )
}
