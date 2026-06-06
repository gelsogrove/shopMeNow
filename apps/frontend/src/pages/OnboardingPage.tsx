/**
 * OnboardingPage
 *
 * Standalone /onboarding route.
 * Renders the OnboardingWizardModal in full-page mode: the Dialog portal
 * fills the entire viewport (it has its own thin header identical to /neapolis).
 *
 * "Close" behaviour: navigate back to the homepage.
 */

import { useNavigate } from 'react-router-dom'
import { OnboardingWizardModal } from '@/components/OnboardingWizardModal'
import { SEO } from '@/components/SEO'

export default function OnboardingPage() {
  const navigate = useNavigate()

  const handleClose = () => {
    navigate('/')
  }

  return (
    <>
      <SEO
        title="Get Started — eChatbot.AI"
        description="Set up your AI chatbot in minutes. Choose your industry, channel, and preferences to get started with eChatbot."
        keywords="get started whatsapp chatbot, setup ai chatbot, onboarding echatbot, create whatsapp bot"
        url="/onboarding"
      />
      {/* The modal is always open — it fills the whole screen with its own header */}
      <OnboardingWizardModal open={true} onClose={handleClose} />
    </>
  )
}
