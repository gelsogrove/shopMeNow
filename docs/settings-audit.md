# Settings Audit Table

Source: `apps/frontend/src/pages/SettingsPage.tsx` FormData + repo scan.

Columns:
- `Column?`: field exists as a column in `WorkspaceProps` or `SettingsProps`
- `Code?`: used somewhere in code (backend/frontend/scheduler) excluding `SettingsPage.tsx`
- `Prompt?`: prompt variable appears in default templates under `apps/backend/src/templates`
- `Calling?`: used in `apps/backend/src/domain/calling-functions`
- `Tested?`: referenced in `__tests__`
- `Correct?`: heuristic (`missing-column`, `unused`, `check`)

| Section | Setting | Column? | Code? | Prompt? | Calling? | Tested? | Correct? | Prompt var |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AI Personality | `chatbotName` | yes | yes | yes | no | yes | check | chatbotName |
| AI Personality | `botIdentityResponse` | yes | yes | yes | no | yes | check | botIdentityResponse |
| AI Personality | `toneOfVoice` | yes | yes | yes | no | yes | check | toneOfVoice |
| AI Personality | `logoUrl` | yes | yes | no | no | yes | check | - |
| Business | `name` | yes | yes | yes | yes | yes | check | companyName |
| Business | `adminEmail` | yes | yes | no | yes | yes | check | adminEmail |
| Business | `url` | yes | yes | no | yes | yes | check | workspaceUrl |
| Business | `businessType` | yes | yes | no | no | yes | check | businessType |
| Business | `currency` | yes | yes | no | yes | yes | check | - |
| Business | `defaultLanguage` | yes | yes | no | no | yes | check | - |
| Business | `sellsProductsAndServices` | yes | yes | no | no | yes | check | sellsProductsAndServices |
| Channels | `channelStatus` | yes | yes | no | no | yes | check | - |
| Channels | `debugMode` | yes | yes | no | no | yes | check | - |
| Channels | `enableWhatsapp` | yes | yes | no | no | yes | check | - |
| Channels | `enableWidget` | yes | yes | no | no | yes | check | - |
| Channels | `whatsappPhoneNumber` | yes | yes | no | no | yes | check | - |
| Channels | `whatsappApiKey` | yes | yes | no | no | yes | check | - |
| Channels | `whatsappAppName` | yes | yes | no | no | no | check | - |
| Channels | `whatsappAppSecret` | yes | yes | no | no | no | check | - |
| Channels | `whatsappPhoneNumberId` | yes | yes | no | no | yes | check | - |
| Channels | `whatsappVerifyToken` | yes | yes | no | no | yes | check | - |
| Channels | `whatsappBusinessAccountId` | yes | yes | no | no | yes | check | - |
| Channels | `whatsappWebhookId` | no | yes | no | no | no | missing-column | - |
| Channels | `whatsappWebhookUrl` | yes | yes | no | no | yes | check | - |
| Channels | `whatsappProvider` | yes | yes | no | no | yes | check | - |
| Channels | `ultraMsgInstanceId` | yes | yes | no | no | yes | check | - |
| Channels | `ultraMsgToken` | yes | yes | no | no | yes | check | - |
| Channels | `ultraMsgApiUrl` | yes | yes | no | no | no | check | - |
| Channels | `widgetTitle` | yes | yes | no | no | yes | check | - |
| Channels | `widgetPrimaryColor` | yes | yes | no | no | yes | check | - |
| Channels | `widgetLanguage` | yes | yes | no | no | yes | check | - |
| Channels | `widgetIcon` | yes | yes | no | no | yes | check | - |
| Channels | `widgetUseChannelLogo` | yes | yes | no | no | yes | check | - |
| Channels | `widgetAutoSuggestionsEnabled` | yes | yes | no | no | yes | check | - |
| Channels | `widgetQuickReplies` | yes | yes | no | no | yes | check | - |
| AI Config | `customAiRules` | yes | yes | yes | no | yes | check | customAiRules |
| AI Config | `welcomeMessage` | yes | yes | no | no | yes | check | - |
| AI Config | `wipMessage` | yes | yes | no | no | yes | check | - |
| Security | `allowedExternalLinks` | yes | yes | yes | no | yes | check | allowedExternalLinks |
| Security | `hasHumanSupport` | yes | yes | no | yes | yes | check | hasHumanSupport |
| Security | `hasSalesAgents` | yes | yes | no | yes | yes | check | hasSalesAgents |
| Security | `operatorContactMethod` | yes | yes | yes | yes | yes | check | operatorContactMethod |
| Security | `operatorWhatsappNumber` | yes | yes | yes | yes | yes | check | operatorWhatsappNumber |
| Security | `humanSupportInstructions` | yes | yes | yes | yes | yes | check | humanSupportInstructions |
| Security | `frustrationEscalationInstructions` | yes | yes | yes | yes | yes | check | frustrationEscalationInstructions |
| Security | `address` | yes | yes | yes | yes | yes | check | address |
| Security | `registrationPage` | yes | yes | no | no | yes | check | - |
| Security | `requireManualApproval` | yes | yes | no | no | yes | check | - |
| Webhooks | `webhookUrl` | yes | yes | no | no | yes | check | - |
| Webhooks | `webhookTimeout` | no | yes | no | no | yes | missing-column | - |
| Calendar & Appointments | `enableCalendarBooking` | yes | yes | no | yes | yes | check | - |
| Calendar & Appointments | `timezone` | yes | yes | no | no | yes | check | - |
| Calendar & Appointments | `appointmentReminder24hEnabled` | no | yes | no | no | no | missing-column | - |
| Calendar & Appointments | `appointmentReminder24hMessage` | no | yes | no | no | no | missing-column | - |
| Calendar & Appointments | `appointmentReminder1hEnabled` | no | yes | no | no | no | missing-column | - |
| Calendar & Appointments | `appointmentReminder1hMessage` | no | yes | no | no | no | missing-column | - |
| Calendar & Appointments | `appointmentReminder30mEnabled` | no | yes | no | no | no | missing-column | - |
| Calendar & Appointments | `appointmentReminder30mMessage` | no | yes | no | no | no | missing-column | - |
| Calendar & Appointments | `appointmentReminderChannel` | yes | yes | no | no | yes | check | - |

## Notes
- `Prompt?` is based on default templates only. If prompts were edited in DB, this may differ.
- `Code?` does not guarantee correct behavior; it only indicates usage elsewhere in repo.
- `Correct?` is a heuristic; I can do a manual pass for critical settings.