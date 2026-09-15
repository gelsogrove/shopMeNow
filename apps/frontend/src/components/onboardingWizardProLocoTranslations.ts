/**
 * Extra copy for OnboardingWizardProLoco — only the one screen that differs
 * from the generic wizard (name + WhatsApp number). Everything else (auth,
 * creating, qr, done, back/next) is reused from onboardingWizardTranslations
 * via OWT, so it never drifts from the generic wizard's wording.
 */
import type { OWTLang } from './onboardingWizardTranslations'

export const OWPL: Record<OWTLang, {
  business: { title: string; subtitle: string; name: string; namePh: string; phone: string; phoneHint: string }
  errors: { nameRequired: string; phoneFormat: string }
}> = {
  it: {
    business: {
      title: 'Come si chiama il vostro ufficio?',
      subtitle: 'I vostri turisti vedranno questo nome su WhatsApp',
      name: 'Nome dell\'ufficio turistico',
      namePh: 'es. Pro Loco di Sappada',
      phone: 'Numero WhatsApp del chatbot',
      phoneHint: 'È il numero su cui l\'assistente risponderà ai turisti. Con prefisso internazionale, es. +39 — potete collegarlo anche dopo',
    },
    errors: { nameRequired: 'Campo obbligatorio', phoneFormat: 'Il numero deve iniziare con + e il prefisso internazionale (es. +39...)' },
  },
  en: {
    business: {
      title: 'What\'s your tourist office called?',
      subtitle: 'Your visitors will see this name on WhatsApp',
      name: 'Tourist office name',
      namePh: 'e.g. Sappada Tourist Office',
      phone: 'Chatbot\'s WhatsApp number',
      phoneHint: 'This is the number the assistant will reply from. With country code, e.g. +39 — optional, you can connect it later',
    },
    errors: { nameRequired: 'This field is required', phoneFormat: 'Phone number must start with + and country code (e.g. +39...)' },
  },
  es: {
    business: {
      title: '¿Cómo se llama vuestra oficina de turismo?',
      subtitle: 'Vuestros turistas verán este nombre en WhatsApp',
      name: 'Nombre de la oficina de turismo',
      namePh: 'ej. Oficina de Turismo de Sappada',
      phone: 'Número de WhatsApp del chatbot',
      phoneHint: 'Es el número desde el que responderá el asistente a los turistas. Con prefijo internacional, ej. +39 — podéis conectarlo más tarde',
    },
    errors: { nameRequired: 'Campo obligatorio', phoneFormat: 'El número debe empezar con + y el prefijo internacional (ej. +39...)' },
  },
  ca: {
    business: {
      title: 'Com es diu la vostra oficina de turisme?',
      subtitle: 'Els vostres turistes veuran aquest nom a WhatsApp',
      name: 'Nom de l\'oficina de turisme',
      namePh: 'ex. Oficina de Turisme de Sappada',
      phone: 'Número de WhatsApp',
      phoneHint: 'Amb prefix internacional, ex. +39 — podeu connectar-lo més tard',
    },
    errors: { nameRequired: 'Camp obligatori', phoneFormat: 'El número ha de començar amb + i el prefix internacional (ex. +39...)' },
  },
  fr: {
    business: {
      title: 'Comment s\'appelle votre office de tourisme ?',
      subtitle: 'Vos visiteurs verront ce nom sur WhatsApp',
      name: 'Nom de l\'office de tourisme',
      namePh: 'ex. Office de Tourisme de Sappada',
      phone: 'Numéro WhatsApp',
      phoneHint: 'Avec l\'indicatif international, ex. +39 — vous pouvez le connecter plus tard',
    },
    errors: { nameRequired: 'Champ requis', phoneFormat: 'Le numéro doit commencer par + et l\'indicatif international (ex. +39...)' },
  },
  de: {
    business: {
      title: 'Wie heißt Ihr Tourismusbüro?',
      subtitle: 'Ihre Gäste sehen diesen Namen auf WhatsApp',
      name: 'Name des Tourismusbüros',
      namePh: 'z.B. Tourismusbüro Sappada',
      phone: 'WhatsApp-Nummer',
      phoneHint: 'Mit Landesvorwahl, z.B. +39 — Sie können sie auch später verbinden',
    },
    errors: { nameRequired: 'Pflichtfeld', phoneFormat: 'Die Nummer muss mit + und der Landesvorwahl beginnen (z.B. +39...)' },
  },
}
