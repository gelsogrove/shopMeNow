import { helios } from './helios'
import './style.css'

// ---------------------------------------------------------------------------
// 10" test clip — "il primo push" (Scena 2, script_video/03-scena-2-desiderio.md)
// Timeline: a tavola (0-4s) -> BIP + freeze (4s) -> sting Mascotte (4.3s)
// -> bolla WhatsApp "Pro Loco" che si scrive (4.6s-10s)
// ---------------------------------------------------------------------------

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div class="scene" id="scene">
    <div class="table-emoji">🍝</div>
    <div class="caption">A tavola, tutti ridono...</div>
  </div>
  <div class="freeze-flash" id="flash"></div>
  <div class="mascot" id="mascot">
    <div class="eye left"></div>
    <div class="eye right"></div>
  </div>
  <div class="wa-wrap" id="wa">
    <div class="wa-bubble">
      <div class="wa-sender">
        <div class="wa-avatar">🏔️</div>
        <div class="wa-sender-name">Pro Loco</div>
      </div>
      <div class="wa-text" id="wa-text"></div>
    </div>
  </div>
`

// Build the 5x5 QR-style mascot body once
const mascot = document.getElementById('mascot')!
const qrPattern = [
  1,1,1,0,1,
  1,0,1,0,1,
  1,1,1,0,0,
  0,0,1,1,1,
  1,0,1,0,1,
]
qrPattern.forEach((on) => {
  const cell = document.createElement('div')
  cell.className = 'cell' + (on ? '' : ' off')
  mascot.appendChild(cell)
})

const scene = document.getElementById('scene')!
const flash = document.getElementById('flash')!
const waWrap = document.getElementById('wa')!
const waText = document.getElementById('wa-text')!

const FULL_MESSAGE =
  'Ehy, sono il tuo assistente di viaggio! Oggi pomeriggio è soleggiato ☀️ — ti consiglio il Rifugio Stella Alpina.'

// Timing (seconds)
const T_FREEZE = 4.0
const T_FLASH_END = 4.15
const T_MASCOT_IN = 4.3
const T_MASCOT_SETTLE = 4.6
const T_BUBBLE_IN = 4.6
const T_TYPE_START = 4.9
const T_TYPE_END = 9.2

let beeped = false
let audioCtx: AudioContext | null = null

function playBeep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = audioCtx
    const now = ctx.currentTime

    // WhatsApp-style two-tone notification (evocative, not the copyrighted asset)
    const freqs = [1046.5, 1318.5] // C6 -> E6
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      const start = now + i * 0.09
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.35, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.25)
    })
  } catch {
    // Audio may be blocked until user interaction during headless render; non-fatal for the visual test.
  }
}

helios.subscribe((state) => {
  const t = state.currentTime

  // --- Freeze flash ---
  if (t < T_FREEZE) {
    flash.style.opacity = '0'
    scene.style.transform = 'scale(1)'
  } else if (t < T_FLASH_END) {
    const p = (t - T_FREEZE) / (T_FLASH_END - T_FREEZE)
    flash.style.opacity = String(Math.sin(p * Math.PI) * 0.9)
    scene.style.transform = 'scale(1)'
    if (!beeped) {
      beeped = true
      playBeep()
    }
  } else {
    flash.style.opacity = '0'
  }

  // --- Mascot sting (spring-like overshoot via CSS timing) ---
  if (t < T_MASCOT_IN) {
    mascot.style.transform = 'translate(-50%, -50%) scale(0)'
  } else if (t < T_MASCOT_SETTLE) {
    const p = (t - T_MASCOT_IN) / (T_MASCOT_SETTLE - T_MASCOT_IN)
    // simple overshoot: 0 -> 1.15 -> 1
    const scale = p < 0.7 ? (p / 0.7) * 1.15 : 1.15 - ((p - 0.7) / 0.3) * 0.15
    mascot.style.transform = `translate(-50%, -50%) scale(${scale})`
  } else {
    mascot.style.transform = 'translate(-50%, -50%) scale(1)'
  }

  // --- WhatsApp bubble rise-in ---
  if (t < T_BUBBLE_IN) {
    waWrap.style.opacity = '0'
    waWrap.style.transform = 'translateX(-50%) translateY(40px)'
  } else {
    const p = Math.min(1, (t - T_BUBBLE_IN) / 0.4)
    waWrap.style.opacity = String(p)
    waWrap.style.transform = `translateX(-50%) translateY(${40 * (1 - p)}px)`
  }

  // --- Typewriter text ---
  if (t < T_TYPE_START) {
    waText.innerHTML = ''
  } else {
    const p = Math.min(1, (t - T_TYPE_START) / (T_TYPE_END - T_TYPE_START))
    const chars = Math.floor(p * FULL_MESSAGE.length)
    const shown = FULL_MESSAGE.slice(0, chars)
    const cursor = p < 1 ? '<span class="cursor"></span>' : ''
    waText.innerHTML = shown + cursor
  }
})
