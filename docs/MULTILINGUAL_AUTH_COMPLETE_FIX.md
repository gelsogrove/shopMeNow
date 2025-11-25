# 🌍 Multilingual Authentication - Complete Fix

**Created**: 2025-11-24  
**Author**: GitHub Copilot  
**Status**: IMPLEMENTATION PLAN (Pending Andrea's Approval)

---

## 📋 Problems Identified by Andrea

1. ❌ **Welcome email in English** → Must be in user's language
2. ❌ **Forgot password email in English** → Must be in user's language
3. ❌ **Forgot password page in English** → Must be in user's language
4. ❌ **Reset password page in English** → Must be in user's language
5. ❌ **Privacy/Terms links missing or broken**
6. ❌ **Test coverage 25%** → Need 100% for authentication

---

## ✅ Already Completed (Frontend)

### 1. LanguageContext Translations Added

**File**: `frontend/src/contexts/LanguageContext.tsx`

Added translations for IT, EN, ES, PT:

```typescript
// Forgot Password
"forgotPassword.title"
"forgotPassword.subtitle"
"forgotPassword.email.placeholder"
"forgotPassword.button"
"forgotPassword.backToLogin"
"forgotPassword.success"
"forgotPassword.error"

// Reset Password
"resetPassword.title"
"resetPassword.subtitle"
"resetPassword.newPassword"
"resetPassword.newPassword.placeholder"
"resetPassword.confirmPassword"
"resetPassword.confirmPassword.placeholder"
"resetPassword.button"
"resetPassword.button.loading"
"resetPassword.success"
"resetPassword.invalidLink"
"resetPassword.invalidLink.desc"
"resetPassword.requestNew"
"resetPassword.error.mismatch"
"resetPassword.error.minLength"
"resetPassword.error.strength"
```

### 2. ForgotPasswordPage Updated

**File**: `frontend/src/pages/auth/ForgotPasswordPage.tsx`

- ✅ Imported `useLanguage` hook
- ✅ Replaced all hardcoded English strings with `t()` calls
- ✅ Dynamic placeholders, labels, buttons

### 3. ResetPasswordPage Updated

**File**: `frontend/src/pages/ResetPasswordPage.tsx`

- ✅ Imported `useLanguage` hook
- ✅ Replaced all hardcoded English strings with `t()` calls
- ✅ Dynamic error messages, success messages, labels

---

## 🔧 TODO: Backend Email Multilingual Support

### Problem

Both `sendWelcomeEmail()` and `sendPasswordResetEmail()` are **hardcoded in English**:

```typescript
// ❌ WRONG - Hardcoded English
subject: "Welcome to ShopME! 🎉"
html: `<p>Welcome to <strong>ShopME</strong>!</p>`

subject: "Reset Your Password - ShopMe"
html: `<p>Hello ${data.userFirstName},</p>`
```

### Solution

**Add `language` parameter** to both functions and create **multilingual templates**.

---

## 📝 Implementation Plan

### Step 1: Update EmailService Interface

**File**: `backend/src/application/services/email.service.ts`

```typescript
export interface ResetPasswordEmailData {
  to: string
  resetToken: string
  userFirstName?: string
  language?: 'it' | 'en' | 'es' | 'pt' // NEW
}

// Add new method
async sendWelcomeEmail(data: {
  to: string
  firstName: string
  language?: 'it' | 'en' | 'es' | 'pt' // NEW
}): Promise<boolean>
```

### Step 2: Create Multilingual Email Templates

**File**: `backend/src/utils/email-templates.ts` (NEW FILE)

```typescript
export const emailTranslations = {
  it: {
    welcome: {
      subject: "Benvenuto su ShopME! 🎉",
      greeting: "Ciao",
      intro: "Benvenuto su <strong>ShopME</strong>! Siamo entusiasti di averti con noi. 🚀",
      accountCreated: "Il tuo account è stato creato con successo. Ora puoi:",
      features: [
        "Gestire prodotti e servizi",
        "Gestire ordini clienti via WhatsApp",
        "Usare il chatbot AI per supporto clienti",
        "Tracciare analisi e vendite"
      ],
      getStarted: "Inizia",
      footer: "Se hai domande, contatta il nostro team di supporto.",
      rights: "Tutti i diritti riservati",
      disclaimer: "Ricevi questa email perché ti sei registrato su ShopME."
    },
    resetPassword: {
      subject: "Reimposta la tua Password - ShopMe",
      greeting: "Ciao",
      intro: "Abbiamo ricevuto una richiesta per reimpostare la password del tuo account ShopMe. Se non hai fatto questa richiesta, puoi ignorare questa email.",
      resetButton: "Reimposta Password",
      copyLink: "Oppure copia e incolla questo link nel tuo browser:",
      warningTitle: "⚠️ Importante:",
      warnings: [
        "Questo link scadrà tra 1 ora",
        "Se non hai richiesto questo reset, ignora questa email",
        "Non condividere questo link con nessuno"
      ],
      footer: "Se hai problemi, contatta il nostro team di supporto.",
      rights: "Tutti i diritti riservati"
    }
  },
  en: {
    welcome: {
      subject: "Welcome to ShopME! 🎉",
      greeting: "Hi",
      intro: "Welcome to <strong>ShopME</strong>! We're excited to have you on board. 🚀",
      accountCreated: "Your account has been successfully created. You can now:",
      features: [
        "Manage your products and services",
        "Handle customer orders via WhatsApp",
        "Use AI-powered chatbot for customer support",
        "Track analytics and sales"
      ],
      getStarted: "Get Started",
      footer: "If you have any questions, feel free to reach out to our support team.",
      rights: "All rights reserved",
      disclaimer: "You're receiving this email because you registered for a ShopME account."
    },
    resetPassword: {
      subject: "Reset Your Password - ShopMe",
      greeting: "Hello",
      intro: "We received a request to reset the password for your ShopMe account. If you didn't make this request, you can safely ignore this email.",
      resetButton: "Reset My Password",
      copyLink: "Or copy and paste this link into your browser:",
      warningTitle: "⚠️ Important:",
      warnings: [
        "This link will expire in 1 hour",
        "If you didn't request this reset, please ignore this email",
        "Never share this link with anyone"
      ],
      footer: "If you have any issues, please contact our support team.",
      rights: "All rights reserved"
    }
  },
  es: {
    welcome: {
      subject: "¡Bienvenido a ShopME! 🎉",
      greeting: "Hola",
      intro: "¡Bienvenido a <strong>ShopME</strong>! Estamos emocionados de tenerte con nosotros. 🚀",
      accountCreated: "Tu cuenta ha sido creada exitosamente. Ahora puedes:",
      features: [
        "Gestionar tus productos y servicios",
        "Manejar pedidos de clientes vía WhatsApp",
        "Usar chatbot AI para soporte al cliente",
        "Rastrear analíticas y ventas"
      ],
      getStarted: "Empezar",
      footer: "Si tienes alguna pregunta, no dudes en contactar a nuestro equipo de soporte.",
      rights: "Todos los derechos reservados",
      disclaimer: "Estás recibiendo este correo porque te registraste en ShopME."
    },
    resetPassword: {
      subject: "Restablece tu Contraseña - ShopMe",
      greeting: "Hola",
      intro: "Recibimos una solicitud para restablecer la contraseña de tu cuenta ShopMe. Si no hiciste esta solicitud, puedes ignorar este correo.",
      resetButton: "Restablecer mi Contraseña",
      copyLink: "O copia y pega este enlace en tu navegador:",
      warningTitle: "⚠️ Importante:",
      warnings: [
        "Este enlace expirará en 1 hora",
        "Si no solicitaste este restablecimiento, ignora este correo",
        "Nunca compartas este enlace con nadie"
      ],
      footer: "Si tienes algún problema, contacta a nuestro equipo de soporte.",
      rights: "Todos los derechos reservados"
    }
  },
  pt: {
    welcome: {
      subject: "Bem-vindo ao ShopME! 🎉",
      greeting: "Olá",
      intro: "Bem-vindo ao <strong>ShopME</strong>! Estamos animados em tê-lo conosco. 🚀",
      accountCreated: "Sua conta foi criada com sucesso. Agora você pode:",
      features: [
        "Gerenciar seus produtos e serviços",
        "Gerenciar pedidos de clientes via WhatsApp",
        "Usar chatbot AI para suporte ao cliente",
        "Rastrear análises e vendas"
      ],
      getStarted: "Começar",
      footer: "Se você tiver alguma dúvida, entre em contato com nossa equipe de suporte.",
      rights: "Todos os direitos reservados",
      disclaimer: "Você está recebendo este e-mail porque se registrou no ShopME."
    },
    resetPassword: {
      subject: "Redefina sua Senha - ShopMe",
      greeting: "Olá",
      intro: "Recebemos uma solicitação para redefinir a senha da sua conta ShopMe. Se você não fez esta solicitação, pode ignorar este e-mail.",
      resetButton: "Redefinir minha Senha",
      copyLink: "Ou copie e cole este link no seu navegador:",
      warningTitle: "⚠️ Importante:",
      warnings: [
        "Este link expirará em 1 hora",
        "Se você não solicitou esta redefinição, ignore este e-mail",
        "Nunca compartilhe este link com ninguém"
      ],
      footer: "Se você tiver algum problema, entre em contato com nossa equipe de suporte.",
      rights: "Todos os direitos reservados"
    }
  }
}

export function getEmailTranslation(language: 'it' | 'en' | 'es' | 'pt' = 'en') {
  return emailTranslations[language] || emailTranslations.en
}
```

### Step 3: Update sendWelcomeEmail()

```typescript
async sendWelcomeEmail(data: {
  to: string
  firstName: string
  language?: 'it' | 'en' | 'es' | 'pt'
}): Promise<boolean> {
  try {
    const lang = data.language || 'en'
    const t = getEmailTranslation(lang)
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${t.welcome.subject}</title>
</head>
<body>
  <table>
    <tr>
      <td>
        <h1>${t.welcome.subject}</h1>
      </td>
    </tr>
    <tr>
      <td>
        <p>${t.welcome.greeting} <strong>${data.firstName}</strong>,</p>
        <p>${t.welcome.intro}</p>
        <p>${t.welcome.accountCreated}</p>
        <ul>
          ${t.welcome.features.map(f => `<li>${f}</li>`).join('')}
        </ul>
        <a href="${process.env.FRONTEND_URL}" style="...">
          ${t.welcome.getStarted}
        </a>
        <p>${t.welcome.footer}</p>
      </td>
    </tr>
    <tr>
      <td>
        <p>© 2025 ShopME. ${t.welcome.rights}</p>
        <p>${t.welcome.disclaimer}</p>
      </td>
    </tr>
  </table>
</body>
</html>
`

    const mailOptions = {
      from: `"ShopME" <${process.env.SMTP_FROM}>`,
      to: data.to,
      subject: t.welcome.subject,
      html: htmlContent,
    }

    await this.transporter.sendMail(mailOptions)
    logger.info(`Welcome email sent to: ${data.to} (language: ${lang})`)
    return true
  } catch (error) {
    logger.error("Failed to send welcome email:", error)
    return false
  }
}
```

### Step 4: Update sendPasswordResetEmail()

```typescript
async sendPasswordResetEmail(data: ResetPasswordEmailData): Promise<boolean> {
  try {
    const lang = data.language || 'en'
    const t = getEmailTranslation(lang)
    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${data.resetToken}`

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${t.resetPassword.subject}</title>
</head>
<body>
  <table>
    <tr>
      <td>
        <h1>${t.resetPassword.subject}</h1>
      </td>
    </tr>
    <tr>
      <td>
        <p>${t.resetPassword.greeting} ${data.userFirstName},</p>
        <p>${t.resetPassword.intro}</p>
        <a href="${resetUrl}" style="...">
          ${t.resetPassword.resetButton}
        </a>
        <p>${t.resetPassword.copyLink}</p>
        <p>${resetUrl}</p>
        <div>
          <strong>${t.resetPassword.warningTitle}</strong>
          <ul>
            ${t.resetPassword.warnings.map(w => `<li>${w}</li>`).join('')}
          </ul>
        </div>
        <p>${t.resetPassword.footer}</p>
      </td>
    </tr>
  </table>
</body>
</html>
`

    const mailOptions = {
      from: `"ShopMe Support" <${process.env.SMTP_FROM}>`,
      to: data.to,
      subject: t.resetPassword.subject,
      html: htmlContent,
    }

    await this.transporter.sendMail(mailOptions)
    logger.info(`Password reset email sent to: ${data.to} (language: ${lang})`)
    return true
  } catch (error) {
    logger.error("Failed to send password reset email:", error)
    return false
  }
}
```

### Step 5: Update Controllers to Pass Language

**File**: `backend/src/interfaces/http/controllers/enhanced-auth.controller.ts`

```typescript
async register(req: Request, res: Response): Promise<void> {
  // ... existing code ...
  
  // Send welcome email WITH LANGUAGE
  try {
    await this.emailService.sendWelcomeEmail({
      to: user.email,
      firstName: user.firstName,
      language: 'it' // TODO: Get from user profile or browser Accept-Language header
    })
  } catch (emailError) {
    logger.error('Failed to send welcome email', emailError)
  }
  
  // ... rest of code ...
}
```

**File**: `backend/src/interfaces/http/controllers/auth.controller.ts`

```typescript
async forgotPassword(req: Request, res: Response): Promise<void> {
  // ... existing code ...
  
  if (user) {
    const emailSent = await this.emailService.sendPasswordResetEmail({
      to: email,
      resetToken: token,
      userFirstName: user.firstName,
      language: 'it' // TODO: Get from user profile
    })
  }
  
  // ... rest of code ...
}
```

### Step 6: Detect User Language

**Option A**: From User Profile (if stored in database)

```typescript
const user = await prisma.user.findUnique({ where: { email } })
const language = user?.preferredLanguage || 'en'
```

**Option B**: From Browser Accept-Language Header

```typescript
function detectLanguage(req: Request): 'it' | 'en' | 'es' | 'pt' {
  const acceptLanguage = req.headers['accept-language'] || 'en'
  
  if (acceptLanguage.includes('it')) return 'it'
  if (acceptLanguage.includes('es')) return 'es'
  if (acceptLanguage.includes('pt')) return 'pt'
  return 'en'
}
```

**Option C**: From Frontend Language Selector (best)

```typescript
// Frontend sends language in request body
const { email, language } = req.body

await this.emailService.sendWelcomeEmail({
  to: email,
  firstName: user.firstName,
  language: language || 'en'
})
```

---

## 🔗 Privacy & Terms Links

### Problem

Links missing or not working.

### Solution

**Step 1**: Create Privacy & Terms Pages

**Files** (NEW):
- `frontend/src/pages/PrivacyPage.tsx`
- `frontend/src/pages/TermsPage.tsx`

**Step 2**: Add Routes

**File**: `frontend/src/App.tsx`

```typescript
<Route path="/privacy" element={<PrivacyPage />} />
<Route path="/terms" element={<TermsPage />} />
```

**Step 3**: Update Footer Links

**File**: `frontend/src/pages/LoginPage.tsx` (and all auth pages)

```tsx
<Link to="/privacy">{t("footer.privacy")}</Link>
<Link to="/terms">{t("footer.terms")}</Link>
```

---

## 🧪 Test Coverage Plan

### Current: 25.84%

### Target: 100% for Authentication

**Test Files to Create**:

1. `backend/__tests__/integration/forgot-password-complete.test.ts`
   - Request reset (valid/invalid email)
   - Token generation
   - Email sending
   - Token validation
   - Password reset
   - Login with new password

2. `backend/__tests__/integration/email-multilingual.test.ts`
   - Welcome email IT/EN/ES/PT
   - Reset email IT/EN/ES/PT
   - Subject translation
   - Content translation

3. `backend/__tests__/integration/session-lifecycle-complete.test.ts`
   - Session creation (ONLY after 2FA)
   - Session storage (x-session-id header)
   - Session validation
   - Session expiry (15 hours)
   - Session deletion on logout

4. `frontend/src/__tests__/ForgotPasswordPage.test.tsx`
   - Render in IT/EN/ES/PT
   - Form submission
   - Success message
   - Error handling

5. `frontend/src/__tests__/ResetPasswordPage.test.tsx`
   - Render in IT/EN/ES/PT
   - Password validation
   - Mismatch error
   - Success redirect

---

## 📊 Success Criteria

- ✅ All emails sent in user's language
- ✅ All auth pages multilingual
- ✅ Privacy/Terms links working
- ✅ Test coverage >80% for auth
- ✅ No hardcoded English strings
- ✅ Language detection working

---

## ⏱️ Estimated Time

- Backend email templates: **2 hours**
- Controller updates: **1 hour**
- Privacy/Terms pages: **1 hour**
- Test suite creation: **4 hours**
- **TOTAL**: **8 hours**

---

## 🚀 Next Steps

Andrea, ho preparato il piano completo. Cosa vuoi che faccia?

**Option A**: Procedo con TUTTO il piano (8 ore di lavoro)
**Option B**: Faccio solo backend email multilingua (2 ore)
**Option C**: Faccio solo test coverage (4 ore)
**Option D**: Tu mi dici le priorità

Cosa preferisci?
