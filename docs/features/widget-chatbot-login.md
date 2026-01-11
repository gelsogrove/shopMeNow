# Widget Chatbot on Login Page

## Overview

This feature allows platform administrators to display a customizable chatbot widget on the login page. The widget can be configured via the Backoffice Platform Settings.

## Components

### 1. Platform Configuration (Database)

Two new entries in `platform_config` table:

| Key | Type | Description |
|-----|------|-------------|
| `showWidgetChatbot` | FLAG | Boolean flag to enable/disable widget display |
| `widgetChatbotCode` | FLAG (text) | HTML/JS embed code for the widget |

### 2. Backend API Endpoints

#### GET /api/platform-config/widget-code (Public)
Returns the widget embed code.

**Response:**
```json
{
  "success": true,
  "data": {
    "code": "<script>...</script>"
  }
}
```

#### PUT /api/platform-config/widget-code (Admin Only)
Saves the widget embed code.

**Request Body:**
```json
{
  "code": "<!-- eChatbot Widget -->\n<script>...</script>"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Widget code saved successfully"
}
```

#### GET /api/platform-config/flags/check (Public)
Includes `showWidgetChatbot` flag in response.

**Response:**
```json
{
  "success": true,
  "data": {
    "canLogin": true,
    "canRegister": true,
    "workingInProgress": false,
    "registerFirst": false,
    "cantryDemo": true,
    "showWidgetChatbot": true
  }
}
```

### 3. Backoffice UI (Platform Settings)

Located in **Platform Settings** page:

1. **Show Widget Chatbot** toggle switch in the flags grid
2. **Widget Chatbot Code** textarea (only visible when flag is enabled)
3. **Save Widget Code** button

### 4. Frontend Integration (Login Page)

The `LoginPage.tsx` uses the `useFeatureFlags()` hook which:
1. Fetches `showWidgetChatbot` flag and `widgetCode` from API
2. If flag is `true` AND code exists, renders the widget using `dangerouslySetInnerHTML`

```tsx
{showWidgetChatbot && widgetCode && (
  <div dangerouslySetInnerHTML={{ __html: widgetCode }} />
)}
```

## Usage

### Setting Up the Widget

1. Go to **Backoffice → Platform Settings**
2. Enable the **"Show Widget Chatbot"** toggle
3. A textarea will appear
4. Paste your widget embed code (from Widget Settings page in frontend)
5. Click **"Save Widget Code"**

### Widget Embed Code Format

```html
<!-- eChatbot Widget -->
<script>
  window.eChatbotConfig = {
    "workspaceId": "your-workspace-id",
    "title": "eChatbot Support 💬",
    "logoUrl": "",
    "language": "en",
    "primaryColor": "#22c55e"
  };
</script>
<script src="https://echatbot.ai/widget.js" async></script>
```

## Security Considerations

1. **Widget Code Injection**: The `dangerouslySetInnerHTML` is used, but only admin users can set the code via authenticated PUT endpoint
2. **Public Read**: Widget code is public (needed for login page), but cannot be modified without admin auth
3. **CSP Headers**: Ensure Content-Security-Policy allows inline scripts if using this feature

## Database Seed

The seed includes default values:
- `showWidgetChatbot`: `true`
- `widgetChatbotCode`: Default template with placeholder `ECHATBOT_SUPPORT_WORKSPACE_ID`

## Files Modified

### Backend
- `apps/backend/src/services/platform-config.service.ts` - Added methods
- `apps/backend/src/interfaces/http/controllers/platform-config.controller.ts` - Added endpoints
- `apps/backend/src/interfaces/http/routes/platform-config.routes.ts` - Added routes

### Frontend
- `apps/frontend/src/hooks/usePlatformConfig.ts` - Added widget code fetching
- `apps/frontend/src/pages/LoginPage.tsx` - Dynamic widget rendering

### Backoffice
- `apps/backoffice/src/pages/PlatformsPage.tsx` - Added UI for widget config
- `apps/backoffice/src/services/api.ts` - Added API methods

### Database
- `packages/database/prisma/data/platformConfig.ts` - Added seed data

## Testing

Unit tests in:
- `apps/backend/__tests__/unit/controllers/widget-chatbot-config.spec.ts`
- `apps/backend/__tests__/unit/services/platform-config.service.spec.ts`
