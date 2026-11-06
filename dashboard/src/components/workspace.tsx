import type { LucideIcon } from "lucide-react"
import {
  AlertCircle,
  LoaderCircle,
  Moon,
  Search,
  Sun,
  Trees,
} from "lucide-react"
import type { ReactNode } from "react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Trees size={23} strokeWidth={1.6} />
      </span>
      <div>
        <strong>
          Harbor &amp; Pine<span className="brand-period">.</span>
        </strong>
        <span className="brand-caption">CUSTOMER EXPERIENCE</span>
      </div>
    </div>
  )
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="search-field">
      <Search size={16} />
      <Input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          className="search-clear"
          aria-label="Clear search"
          onClick={() => onChange("")}
        >
          ×
        </button>
      )}
    </div>
  )
}

export function Notice({
  children,
  onRetry,
  success = false,
}: {
  children: ReactNode
  onRetry?: () => void
  success?: boolean
}) {
  return (
    <div
      className={`notice ${success ? "notice-success" : "notice-error"}`}
      role={success ? "status" : "alert"}
    >
      <AlertCircle size={17} />
      <span>{children}</span>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={25} strokeWidth={1.5} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  )
}

export function LoadingState({
  label = "Loading your workspace…",
}: {
  label?: string
}) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="animate-spin" size={20} />
      <span>{label}</span>
    </div>
  )
}

export function Metric({
  label,
  value,
  caption,
  icon: Icon,
  tone = "green",
}: {
  label: string
  value: string | number
  caption: string
  icon: LucideIcon
  tone?: string
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon tone-${tone}`}>
          <Icon size={17} />
        </span>
      </div>
      <strong className="metric-value">{value}</strong>
      <p>{caption}</p>
    </div>
  )
}
