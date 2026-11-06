import { useState } from "react"
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Inbox,
  LoaderCircle,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import {
  EmptyState,
  LoadingState,
  Metric,
  Notice,
  PageHeader,
  SearchField,
} from "@/components/workspace"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/api"
import { conversationHref } from "@/lib/navigation"
import { formatDate, type SupportEvent } from "@/lib/types"
import { useResource } from "@/lib/use-resource"

export function EventsPage() {
  const { data, loading, error, refresh } =
    useResource<SupportEvent[]>("/events")
  const [checking, setChecking] = useState(false)
  const [pollError, setPollError] = useState("")
  const [notice, setNotice] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("all")
  const [page, setPage] = useState(0)
  const events = data ?? []
  const filtered = events.filter(
    (event) =>
      (filter === "all" || event.status === filter) &&
      `${event.id} ${event.subject ?? ""} ${event.gmail_message_id} ${event.status} ${event.error ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase())
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10))
  const current = Math.min(page, pageCount - 1)
  const sent = events.filter((event) =>
    ["processed", "sent", "replied", "resolved", "completed"].includes(
      event.status
    )
  ).length

  async function checkInbox() {
    setChecking(true)
    setPollError("")
    setNotice("")
    try {
      const result = await api<{ messages: number }>("/poll", {
        method: "POST",
      })
      setNotice(
        result.messages
          ? `Inbox checked. ${result.messages} message${result.messages === 1 ? "" : "s"} found; review the activity below for results.`
          : "You’re all caught up. No new messages to process."
      )
      refresh()
    } catch {
      setPollError(
        "The inbox check couldn’t finish. Check the Gmail connection and try again."
      )
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="THE BIG PICTURE"
        title="Good support starts here."
        description="A clear view of your AI’s work. A little more room for yours."
      >
        <Button
          variant="outline"
          onClick={refresh}
          disabled={loading || checking}
          aria-label="Refresh activity"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} />
          <span className="refresh-label">Refresh</span>
        </Button>
        <Button onClick={checkInbox} disabled={checking}>
          {checking ? <LoaderCircle className="animate-spin" /> : <Inbox />}
          {checking ? "Checking inbox…" : "Check inbox now"}
        </Button>
      </PageHeader>
      {pollError && <Notice onRetry={checkInbox}>{pollError}</Notice>}
      {notice && <Notice success>{notice}</Notice>}
      {error && <Notice onRetry={refresh}>{error}</Notice>}
      <section className="overview-banner">
        <div className="banner-copy">
          <span className="banner-label">
            <span className="small-dot" /> YOUR SUPPORT, CONNECTED
          </span>
          <h2>
            Thoughtful care.
            <br />
            <span>Working together.</span>
          </h2>
          <p>
            From the first question to the right answer.
            <br className="desktop-break" /> Your knowledge and AI, with your
            team when it matters.
          </p>
          <a href="#tickets">
            Explore conversations <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="workflow-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-card art-incoming">
            <span className="art-icon">
              <ArrowDownLeft size={18} />
            </span>
            <div>
              <strong>A question comes in</strong>
              <small>Every conversation matters</small>
            </div>
            <span className="art-line" />
          </div>
          <div className="art-connector">
            <span />
            <span />
            <span />
          </div>
          <div className="art-card art-answer">
            <span className="art-icon">
              <CheckCheck size={19} />
            </span>
            <div>
              <strong>A helpful answer goes out</strong>
              <small>Grounded in your knowledge</small>
            </div>
            <span className="art-check">
              <CheckCheck size={16} />
            </span>
          </div>
          <div className="art-human">
            <ShieldCheck size={14} /> A human touch, when needed
          </div>
        </div>
      </section>
      <div className="section-caption">
        <span>WORKSPACE SNAPSHOT</span>
        <span>
          Latest {events.length || "available"} events · not limited to today
        </span>
      </div>
      <section className="metrics-grid" aria-label="Activity summary">
        <Metric
          label="Messages received"
          value={loading || error ? "—" : events.length}
          caption="In the latest activity"
          icon={Inbox}
        />
        <Metric
          label="Replies sent"
          value={loading || error ? "—" : sent}
          caption="Handled by your support AI"
          icon={MailCheck}
        />
        <Metric
          label="Human handoffs"
          value={
            loading || error
              ? "—"
              : events.filter(
                  (e) =>
                    e.status === "escalated" ||
                    (e.status === "processed" &&
                      e.result?.action === "escalate")
                ).length
          }
          caption="Flagged for a personal touch"
          icon={UserRound}
          tone="amber"
        />
        <Metric
          label="Failed events"
          value={
            loading || error
              ? "—"
              : events.filter((e) => e.status === "failed").length
          }
          caption="May need your attention"
          icon={CircleAlert}
          tone="red"
        />
      </section>
      <section className="panel activity-panel">
        <div className="panel-heading">
          <div>
            <h2>
              Recent activity{" "}
              <span className="count-badge">{events.length}</span>
            </h2>
            <p>Follow each message through your support workflow.</p>
          </div>
          <span className="panel-label">
            <Activity size={14} /> Activity log
          </span>
        </div>
        <div className="panel-toolbar">
          <SearchField
            value={query}
            onChange={(v) => {
              setQuery(v)
              setPage(0)
            }}
            placeholder="Search subjects or message IDs…"
          />
          <select
            className="filter-select"
            aria-label="Filter events by status"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setPage(0)
            }}
          >
            <option value="all">All statuses</option>
            {[...new Set(events.map((e) => e.status))].sort().map((status) => (
              <option key={status} value={status}>
                {status.replaceAll(/[-_]/g, " ")}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <LoadingState label="Loading recent activity…" />
        ) : error ? (
          <EmptyState
            icon={CircleAlert}
            title="Activity is unavailable"
            description="Your support data will appear here once the connection is restored."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={
              events.length
                ? "No matching events"
                : "A fresh start for your inbox"
            }
            description={
              events.length
                ? "Try another search or status filter."
                : "Check your inbox to start processing new customer messages."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">SUBJECT / MESSAGE</TableHead>
                <TableHead>STATUS</TableHead>
                <TableHead>ATTEMPTS</TableHead>
                <TableHead>DETAILS</TableHead>
                <TableHead className="pr-6 text-right">RECEIVED</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(current * 10, current * 10 + 10).map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="pl-6">
                    <div className="event-id">
                      {event.ticket_id ? (
                        <a
                          className="event-symbol event-conversation-link"
                          href={conversationHref(
                            event.ticket_id,
                            event.message_id
                          )}
                          aria-label={`Open conversation: ${event.subject || "No subject"}`}
                          title="Open this message in Conversations"
                        >
                          <ArrowUpRight size={15} />
                        </a>
                      ) : (
                        <span
                          className="event-symbol"
                          title="No saved conversation is available for this message"
                        >
                          <ArrowDownLeft size={15} />
                        </span>
                      )}
                      <div>
                        <strong
                          className="event-subject"
                          title={event.subject || undefined}
                        >
                          {event.subject ||
                            (event.ticket_id
                              ? "(No subject)"
                              : "Subject unavailable")}
                        </strong>
                        <small title={event.gmail_message_id}>
                          {event.gmail_message_id}
                        </small>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={event.status} />
                  </TableCell>
                  <TableCell>
                    <span className="attempt-count">{event.attempts}</span>
                  </TableCell>
                  <TableCell>
                    {event.error ? (
                      <details className="event-error">
                        <summary>View error</summary>
                        <p>{event.error}</p>
                      </details>
                    ) : (
                      <span className="subtle">No errors reported</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-6 text-right text-xs text-muted-foreground">
                    <time dateTime={event.created_at}>
                      {formatDate(event.created_at)}
                    </time>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="table-footer">
          <span>
            {filtered.length
              ? `${current * 10 + 1}–${Math.min((current + 1) * 10, filtered.length)} of ${filtered.length} events`
              : "0 events"}
          </span>
          <div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous events page"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft />
            </Button>
            <span>
              {current + 1} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next events page"
              disabled={current + 1 >= pageCount}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </section>
      <div className="below-panel-note">
        <ShieldCheck size={15} />
        <span>
          Your knowledge guides the answers. Your team handles the exceptions.
        </span>
        <a href="#knowledge-base">
          Review knowledge base <ArrowRight size={13} />
        </a>
      </div>
    </div>
  )
}
