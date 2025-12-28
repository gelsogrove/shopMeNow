# 🚀 Deploy Frontend su Netlify - Guida Rapida

## 📋 Setup Iniziale (5 minuti)

### 1. Crea Account Netlify
- Vai su https://app.netlify.com/signup
- Login con GitHub (consigliato) o email

### 2. Collega Repository
1. Click **"Add new site"** → **"Import an existing project"**
2. Scegli **GitHub**
3. Autorizza Netlify ad accedere ai tuoi repo
4. Seleziona repository: **shopmenow/shopME**

### 3. Configura Build
**Base directory**: `apps/frontend`
**Build command**: `npm run build`
**Publish directory**: `apps/frontend/dist`

### 4. Aggiungi Environment Variables
Nel dashboard Netlify → **Site settings** → **Environment variables**:

```
VITE_API_URL=https://echatbot-production-5db591247cec.herokuapp.com
VITE_GOOGLE_CLIENT_ID=988195920488-drdmtlruo5s47nkk4g8prui6k9mb0pln.apps.googleusercontent.com
VITE_MODE=production
```

### 5. Deploy!
Click **"Deploy site"** - il primo deploy richiede ~2 minuti

---

## 🔧 Dopo il Deploy

### 1. Ottieni URL Netlify
Sarà tipo: `https://echatbot-xxxx.netlify.app`
Puoi personalizzarlo: **Site settings** → **Domain management** → **Change site name** → `echatbot`

### 2. Aggiorna Google OAuth
Google Cloud Console → Credentials → OAuth 2.0 Client ID:
- **Authorized JavaScript origins**: Aggiungi `https://echatbot.netlify.app`
- **Authorized redirect URIs**: Aggiungi `https://echatbot.netlify.app`

### 3. Aggiorna Backend (Heroku)
```bash
heroku config:set FRONTEND_URL=https://echatbot.netlify.app --app echatbot-production
```

### 4. (Opzionale) Custom Domain
Se hai un dominio tipo `echatbot.ai`:
- Netlify → **Domain management** → **Add custom domain**
- Configura DNS:
  - `A` record → `75.2.60.5` (Netlify IP)
  - `CNAME` www → `echatbot.netlify.app`

---

## ✅ Verifica Funzionamento

1. Apri `https://echatbot.netlify.app`
2. Controlla che login/register funzionino
3. Testa Google OAuth
4. Verifica redirect al backoffice per Platform Admin

---

## 🔄 Deploy Automatici

Ogni `git push` su `main` triggera deploy automatico su Netlify!

---

## 📞 Backoffice

Il backoffice (`/backoffice`) rimane separato - verrà deployato su un altro Netlify site:
1. Crea secondo site Netlify
2. Base directory: `apps/backoffice`
3. Publish directory: `apps/backoffice/dist`
4. Deploy!

---

## 🆘 Troubleshooting

**Build fallisce?**
- Verifica che `netlify.toml` sia presente in `apps/frontend/`
- Check che environment variables siano configurate

**CORS errors?**
- Verifica che backend (Heroku) abbia il CORS aggiornato con dominio Netlify

**Google OAuth 400?**
- Aggiungi URL Netlify in Google Cloud Console
- Aspetta 5-10 minuti per propagazione Google
