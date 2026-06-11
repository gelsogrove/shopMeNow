import { motion } from "framer-motion"

// ---------------------------------------------------------------------------
// HeroRobot — friendly mascot for the homepage hero.
//
// Pure inline SVG (no external image): a small WhatsApp-green robot that
// floats gently, blinks, and pulses its antenna light. It sits to the left of
// the brand slogan so the hero is not "all text". Scales down on mobile.
//
// WhatsApp green (#25D366) to match the brand. Soft radial glow behind it.
// ---------------------------------------------------------------------------

const WA_GREEN = "#25D366"

interface HeroRobotProps {
  className?: string
}

export default function HeroRobot({ className = "" }: HeroRobotProps) {
  return (
    <motion.div
      className={`relative flex-shrink-0 ${className}`}
      initial={{ opacity: 0, scale: 0.8, x: -20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      aria-hidden="true"
    >
      {/* Soft glow halo behind the robot */}
      <div
        className="absolute inset-0 -z-10 blur-2xl opacity-40 animate-blob"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${WA_GREEN} 0%, rgba(37,211,102,0.25) 35%, transparent 70%)`,
        }}
      />

      {/* The robot bobs up and down forever */}
      <div className="animate-float">
        <svg
          width="150"
          height="170"
          viewBox="0 0 150 170"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-28 h-32 sm:w-32 sm:h-36 lg:w-[150px] lg:h-[170px] drop-shadow-[0_8px_24px_rgba(37,211,102,0.35)]"
        >
          <defs>
            <linearGradient id="robotBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#D7F8E7" />
            </linearGradient>
            <linearGradient id="robotScreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0B2018" />
              <stop offset="100%" stopColor="#10341F" />
            </linearGradient>
            <radialGradient id="cheek" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={WA_GREEN} stopOpacity="0.55" />
              <stop offset="100%" stopColor={WA_GREEN} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Antenna */}
          <line x1="75" y1="30" x2="75" y2="14" stroke="#9FE7C2" strokeWidth="3" strokeLinecap="round" />
          <circle cx="75" cy="11" r="6" fill={WA_GREEN}>
            <animate attributeName="opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="r" values="6;7;6" dur="1.6s" repeatCount="indefinite" />
          </circle>

          {/* Ears / side knobs */}
          <rect x="14" y="62" width="12" height="34" rx="6" fill="#B6F0D2" />
          <rect x="124" y="62" width="12" height="34" rx="6" fill="#B6F0D2" />

          {/* Head */}
          <rect x="22" y="30" width="106" height="92" rx="26" fill="url(#robotBody)" stroke="#9FE7C2" strokeWidth="2" />

          {/* Face screen */}
          <rect x="34" y="44" width="82" height="64" rx="18" fill="url(#robotScreen)" />

          {/* Cheeks */}
          <circle cx="50" cy="86" r="9" fill="url(#cheek)" />
          <circle cx="100" cy="86" r="9" fill="url(#cheek)" />

          {/* Eyes — blink on a loop */}
          <g fill={WA_GREEN}>
            <rect x="50" y="62" width="13" height="18" rx="6.5">
              <animate attributeName="height" values="18;18;2;18;18" keyTimes="0;0.45;0.5;0.55;1" dur="4s" repeatCount="indefinite" />
              <animate attributeName="y" values="62;62;70;62;62" keyTimes="0;0.45;0.5;0.55;1" dur="4s" repeatCount="indefinite" />
            </rect>
            <rect x="87" y="62" width="13" height="18" rx="6.5">
              <animate attributeName="height" values="18;18;2;18;18" keyTimes="0;0.45;0.5;0.55;1" dur="4s" repeatCount="indefinite" />
              <animate attributeName="y" values="62;62;70;62;62" keyTimes="0;0.45;0.5;0.55;1" dur="4s" repeatCount="indefinite" />
            </rect>
          </g>

          {/* Smile */}
          <path d="M58 92 Q75 104 92 92" stroke={WA_GREEN} strokeWidth="3.5" strokeLinecap="round" fill="none" />

          {/* Body */}
          <rect x="40" y="124" width="70" height="34" rx="14" fill="url(#robotBody)" stroke="#9FE7C2" strokeWidth="2" />

          {/* WhatsApp-style chat bubble on the chest */}
          <g transform="translate(75 141)">
            <circle r="11" fill={WA_GREEN} />
            <path
              d="M-4.6 -3.4 a6 6 0 1 1 -1.4 6.1 l-2.2 0.7 0.7 -2.1 a6 6 0 0 1 2.9 -4.7 z"
              fill="#FFFFFF"
            />
          </g>
        </svg>
      </div>
    </motion.div>
  )
}
