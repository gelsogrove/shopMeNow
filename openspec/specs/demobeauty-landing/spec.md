# demobeauty-landing Specification

## Purpose

Defines the public marketing landing page for the Demobeauty product at `/beauty`, including its section structure, FAQ content (multi-calendar and catalog management), and internationalization.

## Requirements

### Requirement: Beauty landing page at /beauty
The system SHALL serve a public marketing landing page at `/beauty` following the same structure as `/laundries` and `/real-estate`.

#### Scenario: Page loads at /beauty
- **WHEN** a visitor navigates to /beauty
- **THEN** the page renders with hero, problem/solution, features, demo CTA, FAQ, and footer sections

### Requirement: Landing page FAQ includes multi-calendar question
The FAQ section SHALL include a question about managing multiple calendars with the answer "yes, one calendar per sede, all integrated".

#### Scenario: Multi-calendar FAQ visible
- **WHEN** a visitor reads the FAQ section
- **THEN** they see the question "Posso gestire più calendari?" with a positive answer explaining per-sede calendar isolation

### Requirement: Landing page FAQ includes catalog management question
The FAQ section SHALL include a question about managing product and service catalogs with the answer "yes, each sede has its own updatable catalog".

#### Scenario: Catalog FAQ visible
- **WHEN** a visitor reads the FAQ section
- **THEN** they see the question about product/service catalog management with a positive answer

### Requirement: Landing page i18n
The page SHALL support at least Italian and English via the same i18n pattern used by `/laundries`.

#### Scenario: Language switch
- **WHEN** the visitor's browser language is English
- **THEN** the page renders in English
