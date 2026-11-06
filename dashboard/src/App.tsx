import { useEffect, useRef, useState } from "react"
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Inbox,
  LogOut,
  Menu,
  Trees,
  X,
} from "lucide-react"
import { Brand, ThemeToggle } from "@/components/workspace"
import { Button } from "@/components/ui/button"
import { isLoggedIn, logout } from "@/lib/api"
import { hashPage } from "@/lib/navigation"
import { EventsPage } from "@/pages/events"
import { KnowledgeBasePage } from "@/pages/knowledge-base"
import { LoginPage } from "@/pages/login"
import { TicketsPage } from "@/pages/tickets"

const navigation = [
  { id: "events", label: "Activity overview", icon: Activity },
  { id: "tickets", label: "Conversations", icon: Inbox },
  { id: "knowledge-base", label: "Knowledge base", icon: BookOpen },
] as const
type Page = (typeof navigation)[number]["id"]
function currentPage(): Page {
  const hash = hashPage()
  return navigation.some((item) => item.id === hash) ? (hash as Page) : "events"
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn)
  const [page, setPage] = useState<Page>(currentPage)
  const [mobileOpen, setMobileOpen] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!mobileOpen) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const elements = sidebarRef.current?.querySelectorAll<HTMLElement>(
      "a[href], button:not(:disabled)"
    )
    elements?.[0]?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false)
      if (event.key !== "Tab" || !elements?.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener("keydown", keyboard)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", keyboard)
      previousFocus?.focus()
    }
  }, [mobileOpen])

  useEffect(() => {
    const changePage = () => {
      if (!navigation.some((item) => item.id === hashPage())) return
      const next = currentPage()
      if (
        next !== page &&
        !window.dispatchEvent(
          new Event("dashboard-before-navigate", { cancelable: true })
        )
      ) {
        window.history.replaceState(null, "", `#${page}`)
        return
      }
      setPage(next)
      setMobileOpen(false)
    }
    const expired = () => {
      setMobileOpen(false)
      setLoggedIn(false)
    }
    window.addEventListener("hashchange", changePage)
    window.addEventListener("dashboard-session-expired", expired)
    return () => {
      window.removeEventListener("hashchange", changePage)
      window.removeEventListener("dashboard-session-expired", expired)
    }
  }, [page])

  if (!loggedIn) return <LoginPage onLogin={() => setLoggedIn(true)} />

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        className={`sidebar ${mobileOpen ? "is-open" : ""}`}
        aria-label="Workspace navigation"
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-avatar">H</span>
          <div>
            <strong>Harbor &amp; Pine</strong>
            <span>Support workspace</span>
          </div>
          <span className="workspace-tag">H&amp;P</span>
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav>
          {navigation.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={page === id ? "page" : undefined}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>{label}</span>
              {page === id && <ChevronRight size={15} />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="care-card">
            <div className="care-card-icon">
              <Trees size={25} strokeWidth={1.4} />
            </div>
            <strong>A little more human.</strong>
            <p>
              AI handles the routine.
              <br />
              You bring the thoughtful touch.
            </p>
            <a href="#knowledge-base">
              Shape your AI’s knowledge <ArrowUpRight size={14} />
            </a>
          </div>
          <button
            className="profile-button"
            onClick={() => {
              if (
                window.dispatchEvent(
                  new Event("dashboard-before-navigate", { cancelable: true })
                )
              ) {
                logout()
                setMobileOpen(false)
                setLoggedIn(false)
              }
            }}
          >
            <span className="profile-avatar">HP</span>
            <span>
              <strong>Support team</strong>
              <small>Log out of workspace</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu />
            </Button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {navigation.find((item) => item.id === page)?.label}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="workspace-label">
              <span className="small-dot" /> Support workspace
            </span>
            <ThemeToggle />
            <span
              className="topbar-avatar"
              aria-label="Harbor and Pine support team"
            >
              HP
            </span>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          {page === "events" ? (
            <EventsPage />
          ) : page === "tickets" ? (
            <TicketsPage />
          ) : (
            <KnowledgeBasePage />
          )}
        </main>
        <footer className="app-footer">
          <span>
            Harbor &amp; Pine <span className="footer-divider">/</span> Customer
            experience, considered.
          </span>
          <span>Powered by your support knowledge</span>
        </footer>
      </div>
    </div>
  )
}
