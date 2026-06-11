import { motion } from "framer-motion"

// ---------------------------------------------------------------------------
// HeroRobot — official mascot for the homepage hero.
//
// Renders the brand robot image (/robot.png) with a gentle float, a soft
// green glow halo behind it, and a fade-in entrance. It sits to the left of
// the brand slogan so the hero is not "all text". Scales down on mobile.
//
// Drop the mascot file at: apps/frontend/public/robot.png
// (ideally a transparent-background PNG so it blends on the dark hero).
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

      {/* The mascot bobs up and down forever */}
      <div className="animate-float">
        <img
          src="/robot.png"
          alt="eChatbot mascot"
          className="w-28 sm:w-32 lg:w-40 h-auto drop-shadow-[0_8px_24px_rgba(37,211,102,0.35)] select-none"
          draggable={false}
        />
      </div>
    </motion.div>
  )
}
