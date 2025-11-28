import React from "react"

interface Step {
  num: number
  label: string
}

interface ProgressStepsProps {
  currentStep: number
  steps: Step[]
  onStepClick?: (stepNum: number) => void
}

/**
 * Modern Progress Steps Component - Mobile-First & Responsive
 * Works in both portrait and landscape orientations
 * Completed steps are clickable
 */
export const ProgressSteps: React.FC<ProgressStepsProps> = ({
  currentStep,
  steps,
  onStepClick,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm px-3 py-3 sm:px-4 sm:py-3">
      {/* Unified Layout: Numbers with labels below + connecting line */}
      <div className="relative">
        {/* Connecting Line - Behind everything */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{
              width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
            }}
          />
        </div>

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step) => {
            const isCompleted = step.num < currentStep
            const isClickable = isCompleted && onStepClick

            return (
              <div
                key={step.num}
                className="flex flex-col items-center"
                style={{ flex: 1 }}
                onClick={() => isClickable && onStepClick(step.num)}
              >
                {/* Circle with number/checkmark */}
                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-sm sm:text-base font-bold transition-all relative z-10 ${
                    step.num === currentStep
                      ? "bg-green-600 text-white shadow-lg ring-4 ring-green-100 scale-110"
                      : isCompleted
                      ? "bg-green-500 text-white cursor-pointer hover:bg-green-600 hover:scale-105"
                      : "bg-white text-gray-400 border-2 border-gray-300"
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    step.num
                  )}
                </div>

                {/* Label below */}
                <span
                  className={`mt-1.5 text-xs sm:text-sm font-medium text-center px-1 ${
                    step.num === currentStep
                      ? "text-green-700 font-bold"
                      : isCompleted
                      ? "text-green-600 cursor-pointer"
                      : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
