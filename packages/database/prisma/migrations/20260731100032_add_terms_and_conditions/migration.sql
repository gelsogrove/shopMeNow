-- Custom Terms & Conditions text, for future use in widget/WhatsApp opt-in
-- screens. Settings container only for now — not yet wired into ChatWidget
-- or WhatsApp opt-in runtime.

ALTER TABLE "Workspace" ADD COLUMN "termsAndConditions" TEXT;
