## Context

`/survey` is a public, multi-language lead-capture page implemented in a single large component, `apps/frontend/src/pages/QuestionnairePage.tsx` (~1457 lines). It currently ships its own hand-written `<header>` (lines ~978-993) with a self-contained translation dictionary (`QT`) and a `LanguageSelector`, completely separate from the shared `SiteHeader` (`apps/frontend/src/components/layout/SiteHeader.tsx`) used by every other public page.

The site's reference card style lives in `FeaturesPage.tsx` and `HomeShowcase.tsx`: `bg-slate-900/50 backdrop-blur rounded-3xl shadow-2xl border border-white/10`, fronted by a soft green glow layer (`absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-3xl blur-xl`). The survey cards already share the base (`bg-slate-900/50 backdrop-blur border-white/10`) but use tighter `rounded-2xl`, lighter `shadow-xl`, no glow, a solid green intro banner, and loud all-green selected option buttons.

This is a presentation-only change. Survey logic (steps, conditional steps, submit, validation, payload) is untouched.

## Goals / Non-Goals

**Goals:**
- Make `/survey` visually continuous with the rest of the marketing site.
- Reuse the shared `SiteHeader` instead of a bespoke header.
- Bring survey cards and option buttons in line with the site's design language (soft green, larger radius, elevated shadow, soft glow).
- Leave no dead code (unused imports / translation keys).

**Non-Goals:**
- No changes to survey questions, flow, conditional logic, star gating, contact-form gating, submission payload, or validation.
- No changes to the step images themselves.
- No refactor of the component's structure beyond what the header swap and class changes require.
- No changes to `SiteHeader` itself.

## Decisions

**D1 — Replace custom header with shared `SiteHeader`.**
Mount `<SiteHeader />` at the top of the returned tree and delete the custom `<header>`. Rationale: a single source of truth for the header guarantees lasting consistency; adapting the custom header would only re-converge the styling temporarily and leave two headers to maintain. The survey already reads `useLanguage()`, so the header's global language selector drives survey content with no extra wiring.
- *Alternative considered:* adapt the custom header's values (background, logo, flags) to match. Rejected — keeps duplicate header logic and drifts again over time.

**D2 — Remove now-dead code.**
After D1, the `LanguageSelector` import and the `header_back` / `header_brand` keys across the 4 `QT` language blocks become unused. Remove them (Repository Cleanliness rule). The `header_brand`/`header_back` strings are not referenced anywhere else.

**D3 — Recalibrate content offsets.**
The content wrapper uses `min-h-[calc(100vh-52px)]` / `min-h-[calc(100vh-64px)]` tuned to the old ~40px header. `SiteHeader` is taller (~70px). Recompute these offsets so the first card clears the sticky header at all breakpoints. Both headers are `sticky top-0`, so this is a height-offset adjustment only.

**D4 — Card style → site reference.**
For each view (intro, steps, contact_form, success, no_contact): `rounded-2xl → rounded-3xl`, `shadow-xl → shadow-2xl`, and wrap each card in the soft green glow layer used by `FeaturesPage` (a positioned gradient div behind a `relative` card). Remove the solid green intro banner (`linear-gradient(#25D366,#1ea952)`) and present the title inside the card's normal design language.

**D5 — Option buttons → soft green selected state.**
Change the selected branch of both the `radio` and `multi` button class expressions from `border-2 border-[#25D366] bg-[#25D366]/10 text-[#25D366]` to a soft treatment: thin `border-[#25D366]/60`, faint `bg-[#25D366]/8`, label text stays `text-white`. Keep green only on the radio dot / checkmark. Unselected state stays `border-white/10 bg-slate-900/40 text-slate-200`.

## Risks / Trade-offs

- [`SiteHeader` shows auth state (avatar, plan badge, support inbox) when a user is logged in, which may look odd on a public lead page] → See Open Questions; default recommendation is to accept the auth-aware header as-is since `/survey` is normally hit by anonymous leads.
- [Header height change could clip the first card on small screens] → D3 recalibrates offsets; verify visually at mobile + desktop breakpoints during apply.
- [Removing translation keys could break a reference elsewhere] → Grep `header_brand` / `header_back` before removal to confirm they are local-only.
- [Soft glow layers add a few DOM nodes per card] → Negligible; matches the pattern already shipping on `FeaturesPage`.

## Open Questions

- **Auth-aware header on a public page:** Should `/survey` show the full auth-aware `SiteHeader` (avatar/plan/inbox when logged in), or always the public/marketing variant? *Recommendation:* ship the shared `SiteHeader` as-is (auth-aware) for true consistency and minimal scope; revisit only if a logged-in lead view looks wrong. To be confirmed with Andrea at apply time.
