/*
  Warnings:

  - The `welcomeMessage` column on the `Workspace` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `wipMessage` column on the `Workspace` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "welcomeMessage",
ADD COLUMN     "welcomeMessage" JSONB DEFAULT '{"en": "Welcome! I''m SofiA, your digital assistant. I can help you discover Italian gourmet products, answer questions, and manage orders. How can I help you today?", "es": "¡Bienvenido! Soy SofiA, tu asistente digital. Puedo ayudarte a descubrir productos gourmet italianos, responder preguntas y gestionar pedidos. ¿Cómo puedo ayudarte hoy?", "it": "Benvenuto! Sono SofiA, il tuo assistente digitale. Posso aiutarti a scoprire prodotti gourmet italiani, rispondere alle tue domande e gestire ordini. Come posso aiutarti oggi?", "pt": "Bem-vindo! Sou a SofiA, a sua assistente digital. Posso ajudá-lo a descobrir produtos gourmet italianos, responder perguntas e gerir encomendas. Como posso ajudá-lo hoje?"}',
DROP COLUMN "wipMessage",
ADD COLUMN     "wipMessage" JSONB DEFAULT '{"en": "Work in progress. Please contact us later.", "es": "Trabajos en curso. Por favor, contáctenos más tarde.", "it": "Lavori in corso. Contattaci più tardi.", "pt": "Em manutenção. Por favor, contacte-nos mais tarde."}';
