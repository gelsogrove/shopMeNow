## 1. Header — swap to shared SiteHeader

- [x] 1.1 Import `SiteHeader` from `@/components/layout/SiteHeader` in `QuestionnairePage.tsx`
- [x] 1.2 Mount `<SiteHeader />` at the top of the returned tree (right after the `<SEO />` block)
- [x] 1.3 Delete the custom `<header>` block (the hand-written header markup)
- [x] 1.4 Recalibrate the content wrapper offsets (`min-h-[calc(100vh-52px)]` / `min-h-[calc(100vh-64px)]`) for the taller shared header
- [x] 1.5 Verify the first card clears the sticky header on mobile and desktop breakpoints

## 2. Cleanup — remove dead code

- [x] 2.1 Grep `header_brand` and `header_back` to confirm they are referenced only by the removed custom header
- [x] 2.2 Remove the `header_back` and `header_brand` keys from all 4 `QT` language blocks (it, en, es, pt)
- [x] 2.3 Remove the now-unused `LanguageSelector` import
- [x] 2.4 Confirm no other unused imports remain after the header swap

## 3. Cards — align to site reference style

- [x] 3.1 Update intro card: `rounded-2xl → rounded-3xl`, `shadow-xl → shadow-2xl`, add the soft green glow layer (`from-green-500/20 to-emerald-500/10 blur-xl` behind a `relative` card)
- [x] 3.2 Remove the solid green intro banner (`linear-gradient(#25D366,#1ea952)`) and present the title within the card's design language
- [x] 3.3 Apply the same radius/shadow/glow treatment to the steps card
- [x] 3.4 Apply the same treatment to the contact_form card
- [x] 3.5 Apply the same treatment to the success and no_contact cards

## 4. Option buttons — soft green selected state

- [x] 4.1 Update the `radio` option button selected branch to soft green (thin `border-[#25D366]/60`, faint `bg-[#25D366]/8`, `text-white`), green confined to the radio dot
- [x] 4.2 Update the `multi` option button selected branch to the same soft green treatment, green confined to the checkmark
- [x] 4.3 Confirm unselected state stays neutral (`border-white/10`, `bg-slate-900/40`, light text)

## 5. Verify

- [x] 5.1 Confirm survey flow is unchanged: step order, conditional steps, star gating, contact-form gating, submission payload, validation
- [x] 5.2 Run `npm run test:unit` and confirm green
- [x] 5.3 Confirm TypeScript build passes (no unused-import or missing-key errors)
- [x] 5.4 Confirm with Andrea the open question on auth-aware header vs. public-only variant (see design.md) — DECISION: keep SiteHeader auth-aware as-is, no public-only variant; SiteHeader untouched
