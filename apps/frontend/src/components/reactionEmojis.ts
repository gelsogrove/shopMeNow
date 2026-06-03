/**
 * Shared WhatsApp reaction emoji set.
 *
 * The compact set used for *reactions* (long-press a bubble), as requested:
 * ok / ko / heart / love / laugh / smile / applause / strength / pray / angel /
 * angry / sad, plus a few generally useful ones. These are plain WhatsApp
 * Unicode emojis — the same characters WhatsApp itself renders.
 *
 * Used by ReactionPicker in both the demo (PlaygroundPage) and the operator
 * chat (ChatPage), so the two surfaces stay consistent.
 */

export interface ReactionEmoji {
  emoji: string
  /** English label (project rule #15) — used as accessible name / tooltip. */
  label: string
}

export const REACTION_EMOJIS: ReactionEmoji[] = [
  { emoji: "👍", label: "Ok" },
  { emoji: "👎", label: "Ko" },
  { emoji: "❤️", label: "Heart" },
  { emoji: "😍", label: "Love" },
  { emoji: "😂", label: "Laugh" },
  { emoji: "🙂", label: "Smile" },
  { emoji: "👏", label: "Applause" },
  { emoji: "💪", label: "Strength" },
  { emoji: "🙏", label: "Pray" },
  { emoji: "😇", label: "Angel" },
  { emoji: "😠", label: "Angry" },
  { emoji: "😢", label: "Sad" },
  { emoji: "😮", label: "Wow" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "🎉", label: "Celebrate" },
  { emoji: "✅", label: "Done" },
  { emoji: "❌", label: "No" },
]
