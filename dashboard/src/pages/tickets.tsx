import { useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  Inbox,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import {
  EmptyState,
  LoadingState,
  Notice,
  PageHeader,
  SearchField,
} from "@/components/workspace"
import { Button } from "@/components/ui/button"
import { formatDate, type Message, type Ticket } from "@/lib/types"
import { useResource } from "@/lib/use-resource"
import { conversationHref, conversationTarget } from "@/lib/navigation"

export function TicketsPage() {
  const { data, loading, error, refresh } = useResource<Ticket[]>("/tickets")
  const [target, setTarget] = useState(conversationTarget)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("all")
  const tickets = data ?? []
  const listedTicket = tickets.find((ticket) => ticket.id === target.ticketId)
  const linkedTicket = useResource<Ticket>(
    target.ticketId && !listedTicket && !loading
      ? `/tickets/${target.ticketId}`
      : null
  )
  const selected = listedTicket ?? linkedTicket.data

  useEffect(() => {
    const updateTarget = () => setTarget(conversationTarget())
    window.addEventListener("hashchange", updateTarget)
    return () => window.removeEventListener("hashchange", updateTarget)
  }, [])

  function select(ticketId: number | null) {
    window.location.hash = ticketId ? conversationHref(ticketId) : "#tickets"
  }
  const filtered = tickets.filter(
    (ticket) =>
      (filter === "all" || ticket.status === filter) &&
      `${ticket.subject} ${ticket.customer_email} ${ticket.category ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase())
  )

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="THE HUMAN SIDE"
        title="Every conversation matters."
        description="The full story behind every question, answer, and handoff."
      >
        <Button
          variant="outline"
          onClick={() => {
            select(null)
            refresh()
          }}
          disabled={loading}
        >
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </PageHeader>
      {error && <Notice onRetry={refresh}>{error}</Notice>}
      <div className="conversation-summary">
        <span>
          <Inbox size={16} />
          <strong>{tickets.length}</strong> recent conversations
        </span>
        <span>
          <span className="small-dot amber" />
          <strong>
            {tickets.filter((t) => t.status === "escalated").length}
          </strong>{" "}
          human handoffs
        </span>
        <span className="summary-note">
          Showing up to 100 most recent tickets
        </span>
      </div>
      <div
        className={`conversation-workspace panel ${target.ticketId ? "has-selection" : ""}`}
      >
        <section className="conversation-list" aria-label="Ticket list">
          <div className="conversation-list-heading">
            <h2>
              Inbox <span className="count-badge">{tickets.length}</span>
            </h2>
            <Mail size={17} className="subtle" />
          </div>
          <div className="conversation-filters">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search conversations…"
            />
            <select
              className="filter-select"
              aria-label="Filter conversations by status"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All conversations</option>
              {[...new Set(tickets.map((t) => t.status))]
                .sort()
                .map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll(/[-_]/g, " ")}
                  </option>
                ))}
            </select>
          </div>
          <div className="ticket-list-scroll">
            {loading ? (
              <LoadingState label="Loading conversations…" />
            ) : error ? (
              <EmptyState
                icon={Inbox}
                title="Inbox unavailable"
                description="Try refreshing the connection."
              />
            ) : filtered.length ? (
              filtered.map((ticket) => (
                <button
                  className={`ticket-item ${selected?.id === ticket.id ? "selected" : ""}`}
                  key={ticket.id}
                  onClick={() => select(ticket.id)}
                  aria-pressed={selected?.id === ticket.id}
                >
                  <span className="ticket-avatar">
                    {ticket.customer_email.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="ticket-preview">
                    <div className="ticket-preview-top">
                      <strong>{ticket.customer_email}</strong>
                      <span>#{ticket.id}</span>
                    </div>
                    <h3>{ticket.subject || "(No subject)"}</h3>
                    <div className="ticket-preview-bottom">
                      <StatusBadge status={ticket.status} />
                      <span>{ticket.category || "Uncategorized"}</span>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <EmptyState
                icon={Inbox}
                title={
                  tickets.length
                    ? "No matches found"
                    : "Your inbox has room to breathe"
                }
                description={
                  tickets.length
                    ? "Try a different search or status."
                    : "Customer conversations will appear here as messages are processed."
                }
              />
            )}
          </div>
        </section>
        <section
          className="conversation-detail"
          aria-label="Conversation reader"
        >
          {selected ? (
            <Conversation
              key={selected.id}
              ticket={selected}
              messageId={target.messageId}
              onClose={() => select(null)}
            />
          ) : target.ticketId ? (
            linkedTicket.error ? (
              <div className="linked-ticket-error">
                <Notice onRetry={linkedTicket.refresh}>
                  This conversation couldn’t be opened. It may no longer be
                  available.
                </Notice>
                <Button variant="outline" onClick={() => select(null)}>
                  Back to conversations
                </Button>
              </div>
            ) : (
              <LoadingState label="Opening the linked conversation…" />
            )
          ) : (
            <div className="conversation-placeholder">
              <div className="conversation-illustration" aria-hidden="true">
                <div className="illustration-message">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="illustration-reply">
                  <MessageSquare size={24} strokeWidth={1.3} />
                  <span />
                  <span />
                </div>
                <span className="illustration-check">
                  <ShieldCheck size={22} />
                </span>
              </div>
              <h2>Good conversations start with listening.</h2>
              <p>
                Select a conversation to see the customer’s message,
                <br className="desktop-break" /> your AI’s response, and what
                comes next.
              </p>
              <span className="reader-hint">
                <Mail size={14} /> Your customer’s story, all in one place
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Conversation({
  ticket,
  onClose,
  messageId,
}: {
  ticket: Ticket
  onClose: () => void
  messageId: number | null
}) {
  const { data, loading, error, refresh } = useResource<Message[]>(
    `/tickets/${ticket.id}/messages`
  )
  const focusedMessage = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!loading && data && messageId) {
      focusedMessage.current?.scrollIntoView?.({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      })
      focusedMessage.current?.focus({ preventScroll: true })
    }
  }, [data, loading, messageId])
  return (
    <>
      <div className="reader-header">
        <div className="reader-heading">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to conversations"
            onClick={onClose}
          >
            <ArrowLeft />
          </Button>
          <span>CONVERSATION #{ticket.id}</span>
          <StatusBadge status={ticket.status} />
        </div>
        <h2>{ticket.subject || "(No subject)"}</h2>
        <p>
          <UserRound size={13} />
          {ticket.customer_email}
        </p>
        <div className="reader-metadata">
          <span>{ticket.category || "Uncategorized"}</span>
          <span>
            <Clock3 size={12} />
            Updated {formatDate(ticket.updated_at)}
          </span>
        </div>
      </div>
      {ticket.proposed_action && (
        <div className="proposed-action">
          <ShieldCheck size={19} />
          <div>
            <strong>Suggested next step</strong>
            <p>{ticket.proposed_action.replaceAll(/[-_]/g, " ")}</p>
          </div>
          <ArrowUpRight size={16} />
        </div>
      )}
      <div className="message-thread">
        {loading ? (
          <LoadingState label="Opening the conversation…" />
        ) : error ? (
          <Notice onRetry={refresh}>{error}</Notice>
        ) : !data?.length ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description="Saved messages for this conversation will appear here."
          />
        ) : (
          data.map((message) => (
            <article
              key={message.id}
              ref={message.id === messageId ? focusedMessage : undefined}
              tabIndex={message.id === messageId ? -1 : undefined}
              aria-label={
                message.id === messageId
                  ? "Message from recent activity"
                  : undefined
              }
              className={`message-item ${message.direction === "out" ? "outgoing" : "incoming"} ${message.id === messageId ? "message-highlight" : ""}`}
            >
              <div className="message-meta">
                <span className="message-avatar">
                  {message.direction === "out" ? (
                    <ShieldCheck size={15} />
                  ) : (
                    <UserRound size={15} />
                  )}
                </span>
                <strong>
                  {message.direction === "out"
                    ? "Harbor & Pine support"
                    : "Customer"}
                </strong>
                <time dateTime={message.created_at}>
                  {formatDate(message.created_at)}
                </time>
              </div>
              <div className="message-bubble">
                <span className="message-address">{message.from_address}</span>
                <p>{message.body}</p>
              </div>
            </article>
          ))
        )}
      </div>
      <div className="reader-footer">
        <ShieldCheck size={14} />
        <span>
          Conversation history · Replies are sent through your connected inbox.
        </span>
      </div>
    </>
  )
}
