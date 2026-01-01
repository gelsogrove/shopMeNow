/**
 * 🚧 WIP MODAL COMPONENT
 *
 * Displays a "Work in Progress" modal when a feature is disabled.
 * Used when canLogin or canRegister flags are false.
 *
 * Features:
 * - Multilingual support (IT, EN, ES, PT)
 * - Auto-detects browser language
 * - Customizable feature name
 * - Optional onClose callback
 *
 * Usage:
 * ```tsx
 * <WIPModal
 *   isOpen={!canLogin}
 *   feature="login"
 *   onClose={() => navigate('/')}
 * />
 * ```
 *
 * @author Andrea Gelso - eChatbot Platform
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

// Multilingual translations
const translations = {
  it: {
    title: "Work in Progress",
    description:
      "Stiamo implementando nuove funzionalità. Torna a trovarci presto!",
    close: "Chiudi",
    backHome: "Torna alla Home",
  },
  en: {
    title: "Work in Progress",
    description:
      "We are working on implementing new features. Please come back soon.",
    close: "Close",
    backHome: "Back to Home",
  },
  es: {
    title: "Work in Progress",
    description:
      "Estamos implementando nuevas funcionalidades. ¡Vuelve pronto!",
    close: "Cerrar",
    backHome: "Volver al Inicio",
  },
  pt: {
    title: "Work in Progress",
    description:
      "Estamos implementando novas funcionalidades. Volte em breve!",
    close: "Fechar",
    backHome: "Voltar para Home",
  },
}

type SupportedLanguage = keyof typeof translations
type FeatureType = "login" | "register" | "chatbot"

interface WIPModalProps {
  isOpen: boolean
  feature?: FeatureType
  onClose?: () => void
  showBackHome?: boolean
  onBackHome?: () => void
}

/**
 * Detect browser language and return supported language code
 */
function detectLanguage(): SupportedLanguage {
  const browserLang = navigator.language.toLowerCase().split("-")[0]
  if (browserLang in translations) {
    return browserLang as SupportedLanguage
  }
  return "en" // Default to English
}

export function WIPModal({
  isOpen,
  feature: _feature,
  onClose,
  showBackHome = false,
  onBackHome,
}: WIPModalProps) {
  const lang = detectLanguage()
  const t = translations[lang]

  return (
    <Dialog open={isOpen} onOpenChange={onClose ? () => onClose() : undefined}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-10 w-10 text-red-600" />
          </div>
          <DialogTitle className="text-center text-xl">{t.title}</DialogTitle>
          <DialogDescription className="text-center">
            <p className="mt-2 text-muted-foreground">{t.description}</p>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {showBackHome && onBackHome && (
            <Button onClick={onBackHome} variant="default">
              {t.backHome}
            </Button>
          )}
          {onClose && (
            <Button onClick={onClose} variant="outline">
              {t.close}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Maintenance Mode Modal
 * Shows when maintenanceMode flag is true
 * Note: No close button - user can't dismiss maintenance modal
 */
export function MaintenanceModal({ isOpen }: { isOpen: boolean }) {
  const lang = detectLanguage()

  const maintenanceText = {
    it: {
      title: "Manutenzione in Corso",
      description:
        "Il sistema è attualmente in manutenzione. Torneremo online il prima possibile!",
    },
    en: {
      title: "Maintenance in Progress",
      description:
        "The system is currently under maintenance. We'll be back online as soon as possible!",
    },
    es: {
      title: "Mantenimiento en Curso",
      description:
        "El sistema está actualmente en mantenimiento. ¡Volveremos en línea lo antes posible!",
    },
    pt: {
      title: "Manutenção em Andamento",
      description:
        "O sistema está atualmente em manutenção. Voltaremos online o mais rápido possível!",
    },
  }

  const t = maintenanceText[lang]

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Construction className="h-8 w-8 text-blue-600" />
          </div>
          <DialogTitle className="text-center text-xl">{t.title}</DialogTitle>
          <DialogDescription className="text-center">
            <p className="mt-2 text-muted-foreground">{t.description}</p>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}

export default WIPModal
