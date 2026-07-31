/**
 * Shared Settings section config + navigation logic.
 *
 * Extracted from SettingsPage so that the pages navigated to FROM the
 * Settings dropdown (FAQPage, FlowCategoriesPage, FlowsPage) can render the
 * same dropdown and jump between sections without it feeling like leaving
 * Settings entirely.
 */
import { SettingsSection } from "./SettingsDropdown"

export type SectionKey =
  | "ai-personality"
  | "business"
  | "whatsapp"
  | "widget"
  | "widget-support"
  | "security"
  | "functions"
  | "calendar"
  | "demorobot"
  | "faqs"
  | "system-prompt"

// F50 — Andrea 2026-05-13: when the workspace runs a custom chatbot module
// (`customChatbotId` set, e.g. "ecolaundry"), sections that are not used by
// the custom flow are filtered out at render time:
//   - Appointments & Calendar (no booking)
//   - Custom Tools (no external functions / sub-agents)
// The remaining sections stay visible because they still configure
// platform-wide concerns (Business Config, WhatsApp, Widget, Human Support,
// Security), the Custom Chatbot ID field itself, or — for AI Personality —
// the Assistant Name / Welcome Message fields the flow-builder paradigm
// reads straight from the Workspace row at runtime.
export const ALL_SECTIONS: SettingsSection[] = [
  { key: "business", label: "Preferences", description: "Company info and preferences" },
  { key: "ai-personality", label: "AI Personality", description: "Bot identity, messages and rules" },
  { key: "whatsapp", label: "WhatsApp Channel", description: "WhatsApp Business API settings" },
  { key: "widget", label: "Website Widget", description: "Chat widget for your website" },
  { key: "widget-support", label: "Human Support", description: "Escalation to human operators" },
  { key: "calendar", label: "Appointments & Calendar", description: "Google Calendar, reminders" },
  { key: "security", label: "Security", description: "Access control and domains" },
  { key: "functions", label: "Custom Tools", description: "External functions and webhooks" },
]

export const HIDDEN_FOR_CUSTOM_CHATBOT: Array<SectionKey> = ["functions"]

// "Flows" (demorobot) only makes sense once a custom chatbot module
// is running — it's added, not filtered out, unlike HIDDEN_FOR_CUSTOM_CHATBOT.
export const DEMOROBOT_SECTION: SettingsSection = {
  key: "demorobot",
  label: "Flows",
  description: "Visual flow-builder for this chatbot's diagnostic conversations",
}

// FAQs are injected as a fixed prompt block for custom chatbots (see
// custom-demorobot/agent.ts) — same "added, not filtered" treatment as
// Manage Flows, always visible for custom chatbot workspaces.
export const FAQS_SECTION: SettingsSection = {
  key: "faqs",
  label: "FAQs",
  description: "Quick answers always included in the chatbot's prompt",
}

// Editable main/system prompt (workspace.customChatbotSystemPrompt) — the
// fixed prompt block the custom chatbot module reads every turn instead of
// its static common.md when set. Same "added" treatment as the other two.
export const SYSTEM_PROMPT_SECTION: SettingsSection = {
  key: "system-prompt",
  label: "Main Prompt",
  description: "Edit the fixed system prompt this chatbot reads every turn",
}

export function getVisibleSections(isCustomChatbot: boolean): SettingsSection[] {
  if (!isCustomChatbot) return ALL_SECTIONS
  // Requested order: Business Config -> Main Prompt -> Manage Flows -> FAQs
  // -> everything else (WhatsApp/Human Support/Calendar/Security etc).
  const business = ALL_SECTIONS.find((s) => s.key === "business")!
  const rest = ALL_SECTIONS.filter(
    (s) => s.key !== "business" && !HIDDEN_FOR_CUSTOM_CHATBOT.includes(s.key as SectionKey),
  )
  return [business, SYSTEM_PROMPT_SECTION, DEMOROBOT_SECTION, FAQS_SECTION, ...rest]
}

// Sections that navigate to their own dedicated route instead of rendering
// inline inside SettingsPage's two-column layout.
export const SECTION_ROUTES: Partial<Record<SectionKey, string>> = {
  demorobot: "/settings/demorobot",
  faqs: "/faq",
}

/**
 * Shared "jump to a settings section" handler for the pages reached via
 * SECTION_ROUTES (FAQPage, FlowCategoriesPage, FlowsPage) — routes to /settings
 * for inline sections, or to the section's own dedicated route.
 */
export function navigateToSection(
  sectionKey: string,
  navigate: (path: string) => void,
  onInlineSection?: (sectionKey: SectionKey) => void,
) {
  const route = SECTION_ROUTES[sectionKey as SectionKey]
  if (route) {
    navigate(route)
    return
  }
  try {
    localStorage.setItem("settings-last-section", sectionKey)
  } catch {
    // Ignore localStorage errors
  }
  navigate("/settings")
  onInlineSection?.(sectionKey as SectionKey)
}
