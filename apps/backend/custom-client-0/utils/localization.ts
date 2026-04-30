// Base-language (Spanish) strings for system-generated questions.
// History LLM translates them to the customer's language inline.
// To add a new language: update language.txt and settings.json only. No changes here.

export const QUESTIONS = {
  location: '¿En qué pueblo está la lavandería autoservicio?',
  locationClarification:
    'Perdona, necesito el pueblo exacto de la lavandería donde estás. ¿En qué pueblo estás?',
  machineType: '¿Es una lavadora o una secadora?',
  machineNumberWasher: '¿Cuál es el número de la lavadora?',
  machineNumberDryer: '¿Cuál es el número de la secadora?',
  payment: '¿Has pagado?',
  dryerStarted: '¿La secadora arrancó?',
  dryerCycleContext:
    '¿Es el primer secado de esta ropa o añadiste minutos a un ciclo que ya estaba en marcha?',
  serviceCompleted: '¿Pudiste completar el lavado o secado?',
  doubleChargeNarrative:
    'Explícame, por favor, paso a paso qué has hecho desde que has entrado.',
  last4Digits: '¿Cuáles son los últimos 4 dígitos de la tarjeta con la que pagaste?',
  paymentProof: '¿Tienes una captura de pantalla del pago o comprobante?',
  displayWasher: '¿Qué aparece exactamente en la pantalla de la lavadora?',
  displayDryer: '¿Qué aparece exactamente en la pantalla de la secadora?',
  defaultHelp: 'Dime el siguiente detalle útil y te ayudaré paso a paso.',
} as const

