/**
 * Trial Expired Dialog
 * 
 * Modal che appare quando un utente con trial scaduto cerca di fare operazioni.
 * Blocca l'utente e lo forza a scegliere un piano.
 */

import { useNavigate } from "react-router-dom"
import { AlertCircle, CreditCard, ArrowRight } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/LanguageContext"

interface TrialExpiredDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    attemptedAction?: string // Optional: what was the user trying to do
}

export function TrialExpiredDialog({
    open,
    onOpenChange,
    attemptedAction,
}: TrialExpiredDialogProps) {
    const navigate = useNavigate()
    const { t } = useLanguage()

    const handleUpgrade = () => {
        onOpenChange(false)
        navigate("/billing")
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                            <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                        </div>
                        <AlertDialogTitle className="text-2xl">
                            {t("billing.trialExpired")}
                        </AlertDialogTitle>
                    </div>

                    <AlertDialogDescription className="text-base space-y-3 pt-2">
                        <p className="text-sm text-muted-foreground">
                            {attemptedAction
                                ? `You cannot perform this action: "${attemptedAction}"`
                                : t("billing.trialExpiredWarning")}
                        </p>

                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-4">
                            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                                ⏰ Your free trial period has ended. Choose a plan to continue using eChatbot.
                            </p>
                        </div>

                        <div className="space-y-2 pt-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                What happens now?
                            </p>
                            <ul className="text-sm space-y-1.5 text-muted-foreground">
                                <li className="flex items-start gap-2">
                                    <span className="text-red-500 mt-0.5">•</span>
                                    <span>No new WhatsApp messages will be sent</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-red-500 mt-0.5">•</span>
                                    <span>Chatbot will not respond to customers</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-500 mt-0.5">✓</span>
                                    <span>Your data is safe and will be preserved</span>
                                </li>
                            </ul>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="w-full sm:w-auto"
                    >
                        Close
                    </Button>
                    <AlertDialogAction
                        onClick={handleUpgrade}
                        className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                        <CreditCard className="h-4 w-4 mr-2" />
                        {t("billing.choosePlan")}
                        <ArrowRight className="h-4 w-4 ml-2" />
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
