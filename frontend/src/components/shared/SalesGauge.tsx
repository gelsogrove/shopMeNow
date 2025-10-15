import GaugeChart from "react-gauge-chart"

interface SalesGaugeProps {
  salesScore: number // 0-100
  size?: "sm" | "md" | "lg"
  showValue?: boolean
  className?: string
}

export function SalesGauge({
  salesScore,
  size = "sm",
  showValue = true,
  className = "",
}: SalesGaugeProps) {
  // Clamp value between 0 and 100
  const score = Math.max(0, Math.min(100, salesScore))
  const percent = score / 100

  // Size configurations
  const sizeConfig = {
    sm: { width: 50, arcWidth: 0.25, fontSize: "9px" },
    md: { width: 80, arcWidth: 0.3, fontSize: "12px" },
    lg: { width: 120, arcWidth: 0.35, fontSize: "16px" },
  }

  const config = sizeConfig[size]

  // Color zones: Red (0-30), Yellow (30-70), Green (70-100)
  const getScoreLabel = () => {
    if (score < 30) return "Slow"
    if (score < 70) return "Normal"
    return "Hot!"
  }

  const getScoreColor = () => {
    if (score < 30) return "text-red-600"
    if (score < 70) return "text-yellow-600"
    return "text-green-600"
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div style={{ width: config.width }}>
        <GaugeChart
          id={`gauge-${Math.random()}`}
          nrOfLevels={3}
          percent={percent}
          colors={["#EF4444", "#F59E0B", "#10B981"]} // Red, Yellow, Green
          arcWidth={config.arcWidth}
          hideText={true}
          needleColor="#374151"
          needleBaseColor="#374151"
          animate={false} // Disable animation for performance
        />
      </div>
      {showValue && (
        <div className="flex flex-col items-center mt-[-8px]">
          <span
            className={`font-bold ${getScoreColor()}`}
            style={{ fontSize: config.fontSize }}
          >
            {Math.round(score)}
          </span>
          <span
            className="text-gray-500 uppercase tracking-wider"
            style={{ fontSize: "7px" }}
          >
            {getScoreLabel()}
          </span>
        </div>
      )}
    </div>
  )
}
