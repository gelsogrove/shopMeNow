import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

const BASE =
  "inline-flex items-center justify-center gap-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 active:scale-100 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-xl"

const SIZE = {
  sm: "px-6 py-3 text-sm",
  md: "px-8 py-4 text-base",
  lg: "px-10 py-5 text-lg",
} as const

type Size = keyof typeof SIZE

type BaseProps = {
  children: React.ReactNode
  icon?: React.ReactNode
  size?: Size
  className?: string
}

type ButtonProps = BaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & { to?: undefined }

type LinkProps = BaseProps & { to: string }

export function GreenCtaButton(props: ButtonProps | LinkProps) {
  const { children, icon, size = "lg", className } = props
  const classes = cn(BASE, SIZE[size], className)
  const content = (
    <>
      {icon !== undefined && <span className="text-2xl leading-none">{icon}</span>}
      {children}
    </>
  )

  if ("to" in props && props.to !== undefined) {
    return (
      <Link to={props.to} className={classes}>
        {content}
      </Link>
    )
  }

  const { icon: _i, size: _s, to: _t, ...rest } = props as ButtonProps
  return (
    <button {...rest} className={classes}>
      {content}
    </button>
  )
}
