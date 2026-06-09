## Why

The public survey page (`/survey` → `QuestionnairePage.tsx`) looks visually inconsistent with the rest of the marketing site. It renders its own hand-written header — different background, smaller logo, a different language selector, no top-bar — instead of the shared `SiteHeader` used everywhere else. The survey cards and the green option buttons are also more saturated and use tighter radii/shadows than the site's "official" cards (e.g. `FeaturesPage`, `HomeShowcase`). This breaks the visual continuity a lead experiences when moving from the homepage into the survey.

## What Changes

- **Header**: Remove the custom `<header>` in `QuestionnairePage` and mount the shared `<SiteHeader />` so the survey matches the rest of the site (same background `#070d18`, full-size logo, inline-flag language selector, Survey | Demo | Contact top-bar).
- **Cards**: Align the survey cards (intro, steps, contact form, success, no-contact) to the site's reference card style — `rounded-3xl`, `shadow-2xl`, and a soft green outer glow (`from-green-500/20 to-emerald-500/10 blur-xl`) instead of the flat saturated look. Remove the solid green banner at the top of the intro card.
- **Option buttons**: Soften the selected state of the radio/multi option buttons from the loud `border-2 border-[#25D366] bg-[#25D366]/10 text-[#25D366]` to a **soft green** treatment — thin `border-[#25D366]/60`, faint `bg-[#25D366]/8`, text stays white (not all-green), with the green confined to the radio dot / checkmark.
- **Cleanup**: Remove now-unused pieces — the `LanguageSelector` import and the `header_back` / `header_brand` translation keys in the local `QT` dictionaries (4 languages).
- Recalibrate the content min-height offsets that assumed the old ~40px header now that `SiteHeader` is taller (~70px).

No survey logic changes (steps, navigation, conditional steps, submit, validation, API payload all stay identical). This is a presentation-only change.

## Capabilities

### New Capabilities
- `survey-page-presentation`: Visual/layout requirements for the public survey page — that it reuses the shared site header and that its cards and option controls follow the site's design language for a consistent lead experience.

### Modified Capabilities
<!-- None — no existing spec captures survey behavior, and survey functional behavior is unchanged. -->

## Impact

- **Code**: `apps/frontend/src/pages/QuestionnairePage.tsx` (header replacement, card classes, option-button states, removed translation keys, min-height offsets). Adds import of `apps/frontend/src/components/layout/SiteHeader.tsx`.
- **Behavior**: None — survey flow, conditional steps, submission payload, and validation are untouched.
- **Dependencies**: None added. Reuses the existing `SiteHeader` component and `LanguageContext`.
- **Auth note**: `SiteHeader` reflects logged-in state (avatar, plan badge, support inbox). The survey is a public lead-capture page; design.md decides whether to show the auth-aware header as-is or force the public/marketing variant.
