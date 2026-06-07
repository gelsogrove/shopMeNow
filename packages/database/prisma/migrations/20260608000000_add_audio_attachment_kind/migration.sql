-- Add AUDIO to AttachmentKind enum so WhatsApp voice notes (inbound customer
-- voice notes + outbound bot TTS replies) can be stored as MessageAttachment
-- rows and played back in /chat.
ALTER TYPE "AttachmentKind" ADD VALUE IF NOT EXISTS 'AUDIO';
