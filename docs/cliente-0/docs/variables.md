# Settings — Campi usati nel chatbot FLOW

```
Legenda agenti: Router=01 | Security=02 | Translation=03 | History=05 | Profile=06 | Support=07 | subLLM=DB

🔝 HEADER
├── channelStatus          (abilita/disabilita tutto il pipeline — webhook)
└── debugMode              (logging verboso backend)

══════════════════════════════════════════════════════
1. BUSINESS CONFIG
══════════════════════════════════════════════════════
├── name                   ✅ {{companyName}}         — Router(01), History(05), Security(02)
├── adminEmail             ✅ {{supportEmail}}         — contactOperator (email notifica)
├── url                    ✅ {{workspaceUrl}}          — Router(01) link generici
├── businessType           ✅ {{businessType}}          — Router(01)
├── currency               ✅ {{currency}}              — Router(01): valuta per formattare prezzi (EUR, USD, GBP...)
├── defaultLanguage        ✅ {{defaultLanguage}}       — Translation(03) lingua base
├── channelMode            ✅ seleziona pipeline FLOW   — routing backend
├── enableWhatsapp         ✅ attiva canale WhatsApp    — webhook
├── enableWidget           ✅ attiva canale Widget      — widget JS
├── address                ✅ {{address}}              — Router(01)
├── registrationPage       ✅ {{registrationPage}}      — link registrazione cliente
├── needRegistration       ✅ Feature 174               — blocca prezzi se non registrato
├── requireManualApproval  ✅ {{requireManualApproval}} — flow registrazione
├── hasProductCatalog      ❌ non usato in FLOW         — solo ecommerce
├── hasCart                ❌ non usato in FLOW         — solo ecommerce
├── hasOrderTracking       ❌ non usato in FLOW         — solo ecommerce
└── hasHumanSupport        ✅ {{hasHumanSupport}}       — Router(01), Support(07) if/else

══════════════════════════════════════════════════════
2. AI PERSONALITY
══════════════════════════════════════════════════════
├── chatbotName            ✅ {{chatbotName}}           — Router(01), History(05), subLLM
├── botIdentityResponse    ✅ {{botIdentityResponse}}   — Router(01), History(05)
├── toneOfVoice            ✅ {{toneOfVoice}}           — Router(01), History(05), subLLM
├── welcomeMessage         ✅ primo messaggio al cliente — welcome handler
├── enableWelcomeMessage   ✅ Feature E0a               — abilita/disabilita welcome
├── sessionResetTimeout    ✅ Feature E0b               — reset sessione dopo N sec
├── customAiRules          ✅ {{customAiRules}}         — Router(01), History(05)
├── customChatbotId        ✅ modulo chatbot custom     — seleziona custom-client-N (es. "cliente-0"). Quando impostato + channelMode=FLOW → bypassa AI agents standard e usa chatbotFn custom.
└── wipMessage             ✅ canale offline             — risposta quando channelStatus=false

══════════════════════════════════════════════════════
3. WHATSAPP CHANNEL
══════════════════════════════════════════════════════
├── enableWhatsapp         ✅ attiva webhook Meta/UltraMsg
├── whatsappProvider       ✅ meta | ultramsg           — seleziona provider
├── whatsappPhoneNumber    ✅ mittente messaggi
├── whatsappApiKey         ✅ auth token API Meta
├── whatsappAppName        ✅ verifica webhook Meta
├── whatsappAppSecret      ✅ firma HMAC webhook Meta
├── whatsappPhoneNumberId  ✅ ID per send message API
├── whatsappVerifyToken    ✅ setup webhook Meta
├── whatsappBusinessAccountId ✅ WABA ID Meta
├── whatsappWebhookId      ✅ read-only — generato
├── whatsappWebhookUrl     ✅ read-only — URL da configurare su Meta
├── ultraMsgInstanceId     ✅ solo se provider=ultramsg
├── ultraMsgToken          ✅ solo se provider=ultramsg
└── ultraMsgApiUrl         ✅ solo se provider=ultramsg

══════════════════════════════════════════════════════
4. WEBSITE WIDGET
══════════════════════════════════════════════════════
├── enableWidget           ✅ attiva canale widget JS
├── widgetTitle            ✅ header del widget
├── widgetPrimaryColor     ✅ colore tema widget
├── widgetLanguage         ✅ lingua UI widget
├── widgetIcon             ✅ icona pulsante widget
├── widgetUseChannelLogo   ✅ usa logo come avatar
├── logoUrl                ✅ logo nel widget
├── widgetAutoSuggestionsEnabled ✅ suggerimenti automatici
└── widgetQuickReplies     ✅ bottoni risposta rapida (max 4)

══════════════════════════════════════════════════════
5. HUMAN SUPPORT
══════════════════════════════════════════════════════
├── hasHumanSupport        ✅ {{hasHumanSupport}}       — Router(01) e Support(07): mostra/nasconde sezione contactOperator
├── hasSalesAgents         ✅ {{hasSalesAgents}}        — contactOperator: routing email → sales agent specifico
├── operatorContactMethod  ✅ {{operatorContactMethod}} — contactOperator: email o whatsapp
├── adminEmail             ✅ {{supportEmail}}          — contactOperator: destinatario notifica
├── operatorWhatsappNumber ✅ {{operatorWhatsappNumber}}— contactOperator: WA notifica
└── humanSupportInstructions ✅ {{humanSupportInstructions}} — Router(01): quando escalare

══════════════════════════════════════════════════════
6. APPOINTMENTS & CALENDAR
══════════════════════════════════════════════════════
├── enableCalendarBooking  ✅ {{hasCalendarEnabled}}    — Router(01): mostra sezione booking
├── timezone               ✅ listAvailableSlots         — timezone slot
├── minBookingBufferHours  ✅ listAvailableSlots         — buffer minimo prenotazione
├── appointmentReminderChannel ✅ scheduler              — canale reminder (wa/email)
├── appointmentReminder24hEnabled  ✅ scheduler          — invia 24h prima
├── appointmentReminder24hMessage  ✅ scheduler          — messaggio custom 24h
├── appointmentReminder1hEnabled   ✅ scheduler          — invia 1h prima
├── appointmentReminder1hMessage   ✅ scheduler          — messaggio custom 1h
├── appointmentReminder30mEnabled  ✅ scheduler          — invia 30min prima
└── appointmentReminder30mMessage  ✅ scheduler          — messaggio custom 30min

══════════════════════════════════════════════════════
7. SECURITY
══════════════════════════════════════════════════════
└── allowedExternalLinks   ✅ {{allowedExternalLinks}}  — Security Agent(02): domini whitelist

══════════════════════════════════════════════════════
8. CUSTOM TOOLS  (ui separata)
══════════════════════════════════════════════════════
└── CallingFunctions       ✅ Router(01): availableFunctions del Router FlowConfig
                              subLLM: calling functions specifiche per ogni macchina
```
