/**
 * SettingsPageHeader - "Settings" title + section dropdown, reused on pages
 * reached FROM the Settings dropdown (FAQPage, FlowCategoriesPage, FlowsPage)
 * so navigating there still reads as being inside Settings instead of a
 * separate, disconnected page.
 */
import { useNavigate } from "react-router-dom"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { SettingsDropdown } from "./SettingsDropdown"
import { getVisibleSections, navigateToSection, SectionKey } from "./settingsSections"

interface SettingsPageHeaderProps {
  currentSection: SectionKey
}

export function SettingsPageHeader({ currentSection }: SettingsPageHeaderProps) {
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const isCustomChatbot = workspace?.channelMode === "FLOW" || workspace?.channelMode === "PRO_LOCO"
  const isProLoco = workspace?.channelMode === "PRO_LOCO"
  const sections = getVisibleSections(isCustomChatbot, isProLoco)
  // PRO_LOCO: FAQs is a card inside the Content hub, not a dropdown entry —
  // on /faq the dropdown highlights Content instead of an unknown section.
  const effectiveSection = sections.some((s) => s.key === currentSection)
    ? currentSection
    : "tourist-content"

  return (
    <div className="flex items-center gap-4">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <SettingsDropdown
        sections={sections}
        currentSection={effectiveSection}
        onSectionChange={(key) => navigateToSection(key, navigate)}
      />
    </div>
  )
}
