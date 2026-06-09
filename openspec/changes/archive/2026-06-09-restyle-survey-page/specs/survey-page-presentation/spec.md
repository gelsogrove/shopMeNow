## ADDED Requirements

### Requirement: Survey page uses the shared site header

The public survey page (`/survey`) SHALL render the shared `SiteHeader` component used across the marketing site, and MUST NOT define its own custom header markup. This guarantees the survey header matches the rest of the site (background color, logo size, language selector, and top-bar links).

#### Scenario: Header matches the site

- **WHEN** a visitor opens `/survey`
- **THEN** the page header is the shared `SiteHeader`, with the same background (`#070d18`), full-size `eChatbot.AI` logo, inline-flag language selector, and Survey | Demo | Contact top-bar as every other public page

#### Scenario: Language selection still drives survey content

- **WHEN** the visitor changes the language via the header's language selector
- **THEN** the survey content (questions, options, buttons) re-renders in the selected language, because it reads the global language context

#### Scenario: No leftover custom-header code

- **WHEN** the change is implemented
- **THEN** the custom `<header>` block, the `LanguageSelector` import, and the `header_back` / `header_brand` translation keys are removed from `QuestionnairePage`, with no unused imports or dead translation keys remaining

### Requirement: Survey content clears the shared header

The survey content area SHALL remain fully visible and correctly spaced below the shared header at all breakpoints, accounting for the shared header's height rather than the previous custom header's height.

#### Scenario: Content not clipped by the taller header

- **WHEN** the survey renders on mobile and desktop
- **THEN** the first card and its content are not hidden behind or overlapped by the sticky header, and the vertical centering/offset is recalibrated for the shared header's height

### Requirement: Survey cards follow the site card style

The survey cards (intro, steps, contact form, success, and no-contact views) SHALL follow the site's reference card design language so they read as part of the same product. Cards MUST use the site's larger corner radius and elevated shadow, and SHALL present a soft green accent rather than a flat saturated fill. The solid green banner at the top of the intro card SHALL be removed.

#### Scenario: Cards match the reference style

- **WHEN** any survey view is displayed
- **THEN** its card uses the rounded-3xl radius and shadow-2xl elevation consistent with the site's reference cards (e.g. FeaturesPage), with a soft green outer glow rather than a flat saturated panel

#### Scenario: Intro card has no solid green banner

- **WHEN** the intro view is displayed
- **THEN** the title is presented within the card's design language without a full-width saturated green banner

### Requirement: Survey option buttons use a soft green selected state

The radio and multi-select option buttons SHALL use a soft green treatment for their selected state instead of a loud saturated fill. The selected state MUST use a thin green border, a faint green background, and text that stays light/white; the green color SHALL be confined to the radio dot or checkmark.

#### Scenario: Selected option is softly highlighted

- **WHEN** a visitor selects a radio or multi-select option
- **THEN** the button shows a thin green border (`border-[#25D366]/60`), a faint green background (`bg-[#25D366]/8`), white/light label text, and a green radio dot or checkmark — not an all-green filled button

#### Scenario: Unselected option stays neutral

- **WHEN** an option is not selected
- **THEN** it uses the neutral dark style (`border-white/10`, `bg-slate-900/40`, light text) consistent with the site's controls

### Requirement: Survey behavior is unchanged

This is a presentation-only change. The survey's functional behavior SHALL remain identical: step order, conditional steps, navigation, star-rating gating, contact form gating, submission payload, and validation.

#### Scenario: Functional flow preserved

- **WHEN** a visitor completes the survey before and after this change
- **THEN** the same steps appear (including conditional steps), the same gating to the contact form occurs, and the same payload is submitted to the questionnaire API
