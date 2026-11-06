import { useState } from "react"
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  MessageSquare,
  ShieldCheck,
  Trees,
} from "lucide-react"
import { Brand, Notice, ThemeToggle } from "@/components/workspace"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, logout, saveLogin } from "@/lib/api"

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError("")
    try {
      saveLogin(username, password)
      await api("/login")
      onLogin()
    } catch (error) {
      logout()
      setError(
        error instanceof Error && error.message === "Wrong username or password"
          ? "That username or password isn’t right. Please try again."
          : "We couldn’t connect to your workspace. Please try again shortly."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-layout">
      <section className="login-story">
        <Brand />
        <div className="login-story-content">
          <span className="login-eyebrow">
            <span className="small-dot" /> CARE, IN EVERY CONVERSATION
          </span>
          <h1>
            Great support.
            <br />A human feeling.
          </h1>
          <p>
            Give every customer a thoughtful answer.
            <br />
            Give your team the space to do their best work.
          </p>
          <div className="login-art" aria-hidden="true">
            <div className="login-art-orbit" />
            <div className="login-message-card">
              <span className="login-customer-icon">
                <MessageSquare size={20} />
              </span>
              <div>
                <span>A customer has a question</span>
                <div className="skeleton-line long" />
                <div className="skeleton-line" />
              </div>
            </div>
            <div className="login-answer-card">
              <span className="answer-tree">
                <Trees size={23} />
              </span>
              <div>
                <strong>You’re in good hands.</strong>
                <p>A helpful answer. A thoughtful next step.</p>
                <span>
                  <Check size={12} /> Grounded in your knowledge
                </span>
              </div>
            </div>
            <span className="login-art-caption">
              <ShieldCheck size={14} /> AI efficiency. Human consideration.
            </span>
          </div>
        </div>
        <div className="login-story-footer">
          <span>Harbor &amp; Pine</span>
          <span>Made for better customer experiences.</span>
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-mobile-brand">
          <Brand />
        </div>
        <div className="login-theme">
          <ThemeToggle />
        </div>
        <div className="login-form-wrap">
          <span className="login-lock">
            <LockKeyhole size={20} strokeWidth={1.5} />
          </span>
          <p className="eyebrow">YOUR SUPPORT WORKSPACE</p>
          <h2>Welcome back.</h2>
          <p className="login-description">
            A little clarity for your day.
            <br />
            Sign in to see how your customers are doing.
          </p>
          <form onSubmit={submit}>
            <div className="login-field">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                placeholder="Your workspace username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div className="login-field">
              <Label htmlFor="password">Password</Label>
              <div className="password-field">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={busy}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            {error && <Notice>{error}</Notice>}
            <Button type="submit" className="login-submit" disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" /> : null}
              {busy ? "Opening your workspace…" : "Sign in to workspace"}
              {!busy && <ArrowRight size={17} />}
            </Button>
          </form>
          <p className="login-security">
            <ShieldCheck size={14} /> A private workspace for your support team.
          </p>
          <div className="login-help">
            Need access? Ask your workspace administrator.
          </div>
        </div>
        <p className="login-copyright">
          © {new Date().getFullYear()} Harbor &amp; Pine. Thoughtful by nature.
        </p>
      </section>
    </div>
  )
}
