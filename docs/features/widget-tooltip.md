# ChatWidget Tooltip Feature

## 📋 Overview

Il widget chat ora include un **tooltip balloon** che appare sopra il pulsante quando l'utente passa il mouse, mostrando un messaggio di benvenuto personalizzato.

## 🎨 Design Features

### 1. **Widget Button**
- **Dimensioni**: 64x64px (più piccolo rispetto a prima 80x80px)
- **Icona Chat**: 36x36px (più grande per migliore visibilità)
- **Stile**: Cerchio bianco con icona chat verde
- **Status Indicator**: Pallino in alto a destra
  - 🟢 **Verde**: Modalità normale (online)
  - 🔴 **Rosso**: Debug mode attivo

### 2. **Tooltip Balloon**
- **Posizionamento**: Sopra il pulsante widget
- **Dimensioni**: 280px larghezza fissa
- **Stile**: Sfondo bianco, bordo grigio, ombra pronunciata
- **Animazione**: Fade-in + slide-in dal basso
- **Pointer**: Triangolo che punta al pulsante
- **Close Button**: X in alto a destra per chiudere manualmente

### 3. **Comportamento**
- **Show**: Appare quando l'utente passa il mouse sul pulsante
- **Hide**: 
  - Quando il mouse esce dal pulsante (con delay 300ms)
  - Quando si clicca sulla X
  - Quando si apre il widget
- **Persistenza**: Non viene memorizzato, appare sempre all'hover

## 🌍 Multilingua

Il testo del tooltip è automaticamente tradotto in base alla lingua del workspace:

```typescript
const translations = {
  it: "Ciao! 👋 Sono qui per aiutarti con qualsiasi domanda: come posso aiutarti oggi?",
  en: "Hello! 👋 I'm here to help you with any question: how can I help you today?",
  es: "¡Hola! 👋 Estoy aquí para ayudarte con cualquier pregunta: ¿cómo puedo ayudarte hoy?",
  pt: "Olá! 👋 Estou aqui para ajudá-lo com qualquer pergunta: como posso ajudá-lo hoje?",
}
```

**Fallback**: Se la lingua non è supportata, usa inglese.

## 🔧 Props

```typescript
interface ChatWidgetProps {
  workspaceId: string
  language?: string          // Lingua per tooltip (it, en, es, pt)
  debugMode?: boolean        // Status indicator color (green/red)
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left"
  primaryColor?: string      // Colore primario per icona
  // ... altre props esistenti
}
```

## 📊 Usage Example

```tsx
<ChatWidget
  workspaceId="workspace-123"
  language="it"
  debugMode={false}
  position="bottom-right"
  primaryColor="#22c55e"
/>
```

## ⚙️ Implementation Details

### State Management

```typescript
const [showTooltip, setShowTooltip] = useState(false)
```

### Event Handlers

```typescript
// Show tooltip on hover
onMouseEnter={() => setShowTooltip(true)}

// Hide tooltip on leave (with delay)
onMouseLeave={() => setTimeout(() => setShowTooltip(false), 300)}

// Hide when clicking button (opening chat)
onClick={() => {
  setIsOpen(true)
  setShowTooltip(false)
}}
```

### Styling with !important

Per garantire che gli stili non vengano sovrascritti da altri CSS:

```typescript
style={{
  width: "280px !important",
  padding: "16px !important",
  borderRadius: "16px !important",
  // ...
}}
```

## 🧪 Testing

Test coverage per:
- ✅ Tooltip show/hide su hover
- ✅ Close button funziona
- ✅ Tooltip scompare quando widget si apre
- ✅ Traduzioni corrette per ogni lingua
- ✅ Status indicator colore corretto (verde/rosso)
- ✅ Dimensioni button e icona corrette
- ✅ Posizionamento tooltip sopra button

## 🎯 Future Improvements

1. **Personalizzazione Admin**: Permettere admin di personalizzare il testo del tooltip
2. **Animazioni**: Aggiungere più animazioni fluide
3. **Mobile**: Ottimizzare comportamento su dispositivi touch
4. **Analytics**: Tracciare quante volte il tooltip viene visualizzato

## 📝 Notes

- **!important**: Usato per garantire che gli stili non vengano sovrascritti
- **300ms delay**: Previene il tooltip da scomparire troppo rapidamente
- **z-index**: Tooltip usa z-index alto per apparire sopra altri elementi
- **Triangle pointer**: Creato con CSS transform rotate-45 e border

## 🔗 Related Files

- `/apps/backoffice/src/components/ChatWidget.tsx` - Main component
- `/apps/backoffice/__tests__/unit/components/ChatWidget-tooltip.test.tsx` - Unit tests
- `/apps/backoffice/src/pages/ChannelsPage.tsx` - Usage example with debugMode prop
