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
 * @author Andrea Gelso - ShopME Platform
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Construction, AlertCircle } from "lucide-react"

// Multilingual translations
const translations = {
  it: {
    title: "Funzionalità in Sviluppo",
    description: "Stiamo lavorando per migliorare questa funzionalità. Sarà disponibile presto!",
    featureDisabled: "La funzionalità {{feature}} è temporaneamente disabilitata.",
    login: "accesso",
    register: "registrazione",
    chatbot: "chatbot",
    close: "Chiudi",
    backHome: "Torna alla Home",
  },
  en: {
    title: "Feature Under Development",
    description: "We're working to improve this feature. It will be available soon!",
    featureDisabled: "The {{feature}} feature is temporarily disabled.",
    login: "login",
    register: "registration",
    chatbot: "chatbot",
    close: "Close",
    backHome: "Back to Home",
  },
  es: {
    title: "Funcionalidad en Desarrollo",
    description: "Estamos trabajando para mejorar esta funcionalidad. ¡Pronto estará disponible!",
    featureDisabled: "La funcionalidad de {{feature}} está temporalmente deshabilitada.",
    login: "inicio de sesión",
    register: "registro",
    chatbot: "chatbot",
    close: "Cerrar",
    backHome: "Volver al Inicio",
  },
  pt: {
    title: "Funcionalidade em Desenvolvimento",
    description: "Estamos trabalhando para melhorar esta funcionalidade. Estará disponível em breve!",
    featureDisabled: "A funcionalidade de {{feature}} está temporariamente desativada.",
    login: "login",
    register: "registro",
    chatbot: "chatbot",
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
  feature,
  onClose,
  showBackHome = true,
  onBackHome,
}: WIPModalProps) {
  const lang = detectLanguage()
  const t = translations[lang]

  const getFeatureName = (feat?: FeatureType): string => {
    if (!feat) return ""
    return t[feat] || feat
  }

  const description = feature
    ? t.featureDisabled.replace("{{feature}}", getFeatureName(feature))
    : t.description

  return (
    <Dialog open={isOpen} onOpenChange={onClose ? () => onClose() : undefined}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Construction className="h-8 w-8 text-amber-600" />
          </div>
          <DialogTitle className="text-center text-xl">{t.title}</DialogTitle>
          <DialogDescription className="text-center">
            <div className="mt-2 flex items-center justify-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">{description}</span>
            </div>
            <p className="mt-4 text-muted-foreground">{t.description}</p>
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
