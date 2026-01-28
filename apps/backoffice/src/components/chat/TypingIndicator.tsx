/**
 * TypingIndicator Component
 * Shows 3 animated dots while bot is typing (like WhatsApp)
 * 
 * Usage:
 * <TypingIndicator primaryColor="#22c55e" />
 */

import React from "react"

interface TypingIndicatorProps {
  primaryColor?: string
}

export function TypingIndicator({ primaryColor = "#22c55e" }: TypingIndicatorProps) {
  return (
    <div className="flex items-center gap-1 p-3 bg-white rounded-2xl rounded-bl-md border border-slate-200 shadow-sm max-w-[85px]">
      <div
        className="w-2 h-2 rounded-full animate-bounce"
        style={{
          backgroundColor: primaryColor,
          animationDelay: "0ms",
          animationDuration: "1s !important",
        }}
      />
      <div
        className="w-2 h-2 rounded-full animate-bounce"
        style={{
          backgroundColor: primaryColor,
          animationDelay: "150ms",
          animationDuration: "1s !important",
        }}
      />
      <div
        className="w-2 h-2 rounded-full animate-bounce"
        style={{
          backgroundColor: primaryColor,
          animationDelay: "300ms",
          animationDuration: "1s !important",
        }}
      />
    </div>
  )
}
