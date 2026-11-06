import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import App from "@/App"
import { ThemeProvider } from "@/components/theme-provider"
import { EventsPage } from "@/pages/events"
import { KnowledgeBasePage } from "@/pages/knowledge-base"
import { LoginPage } from "@/pages/login"
import { TicketsPage } from "@/pages/tickets"
import type { Entry, SupportEvent, Ticket } from "@/lib/types"

const created = "2026-11-06T12:00:00Z"
const events: SupportEvent[] = [
  {
    id: 3,
    gmail_message_id: "gmail-a",
    subject: "A damaged bookcase",
    ticket_id: 10,
    message_id: 1,
    status: "processed",
    attempts: 1,
    error: null,
    created_at: created,
    result: { action: "escalate" },
  },
  {
    id: 2,
    gmail_message_id: "gmail-b",
    subject: "Shipping confirmation",
    ticket_id: 11,
    message_id: 2,
    status: "skipped",
    attempts: 1,
    error: null,
    created_at: created,
  },
  {
    id: 1,
    gmail_message_id: "gmail-c",
    subject: "Delivery delay",
    ticket_id: 10,
    message_id: 3,
    status: "failed",
    attempts: 3,
    error: "Gmail timed out",
    created_at: created,
  },
]
const tickets: Ticket[] = [
  {
    id: 10,
    subject: "A damaged bookcase",
    customer_email: "alex@example.test",
    category: "bookcases",
    status: "escalated",
    proposed_action: "ship-panels",
    updated_at: created,
  },
  {
    id: 11,
    subject: "Shipping question",
    customer_email: "sam@example.test",
    category: "shipping",
    status: "answered",
    proposed_action: null,
    updated_at: created,
  },
]
const entries: Entry[] = [
  {
    id: 20,
    section: "shipping",
    title: "Delivery times",
    content: "Standard delivery takes five working days.",
  },
  {
    id: 21,
    section: "returns",
    title: "Return policy",
    content: "Contact support before returning your item.",
  },
]
function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
function mockApi() {
  const fetch = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url)
      if (path === "/api/login") return response({ ok: true })
      if (path === "/api/events") return response(events)
      if (path === "/api/tickets") return response(tickets)
      if (path === "/api/tickets/10") return response(tickets[0])
      if (/\/api\/tickets\/\d+\/messages/.test(path))
        return response([
          {
            id: 1,
            direction: "in",
            from_address: "alex@example.test",
            body: "One panel arrived damaged.",
            created_at: created,
          },
        ])
      if (path === "/api/knowledge-base") return response(entries)
      if (path === "/api/knowledge-base/20" && init?.method === "PUT")
        return response({ ...entries[0], ...JSON.parse(String(init.body)) })
      if (path === "/api/poll" && init?.method === "POST")
        return response({ messages: 0 })
      throw new Error(`Unexpected request: ${path}`)
    }
  )
  vi.stubGlobal("fetch", fetch)
  return fetch
}
function workspace(page = "events") {
  sessionStorage.setItem("dashboard-login", btoa("test:password"))
  window.history.replaceState(null, "", `/#${page}`)
  return render(
    <ThemeProvider defaultTheme="light">
      <App />
    </ThemeProvider>
  )
}

describe("sign in and session", () => {
  it("submits Basic authentication and opens the existing workspace", async () => {
    const fetch = mockApi()
    const onLogin = vi.fn()
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <LoginPage onLogin={onLogin} />
      </ThemeProvider>
    )
    await user.type(screen.getByLabelText("Username"), "agent")
    await user.type(screen.getByLabelText("Password"), "secret")
    await user.click(screen.getByRole("button", { name: "Show password" }))
    expect(screen.getByLabelText("Password").getAttribute("type")).toBe("text")
    await user.click(
      screen.getByRole("button", { name: "Sign in to workspace" })
    )
    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce())
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: `Basic ${btoa("agent:secret")}`,
    })
  })

  it("shows an authentication error and clears rejected credentials", async () => {
    vi.mocked(fetch).mockResolvedValue(
      response({ detail: "Wrong username or password" }, 401)
    )
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <LoginPage onLogin={vi.fn()} />
      </ThemeProvider>
    )
    await user.type(screen.getByLabelText("Username"), "agent")
    await user.type(screen.getByLabelText("Password"), "wrong")
    await user.click(
      screen.getByRole("button", { name: "Sign in to workspace" })
    )
    expect((await screen.findByRole("alert")).textContent).toContain(
      "username or password"
    )
    expect(sessionStorage.getItem("dashboard-login")).toBeNull()
  })

  it("returns an expired session to sign in", async () => {
    vi.mocked(fetch).mockResolvedValue(response({}, 401))
    workspace()
    expect(
      await screen.findByRole("heading", { name: "Welcome back." })
    ).toBeTruthy()
    expect(sessionStorage.getItem("dashboard-login")).toBeNull()
  })
})

describe("activity", () => {
  it("counts real backend statuses, filters events, and exposes full errors", async () => {
    mockApi()
    const user = userEvent.setup()
    render(<EventsPage />)
    await screen.findByText("A damaged bookcase")
    expect(
      screen.getByText("Replies sent").closest(".metric-card")?.textContent
    ).toContain("1")
    expect(
      screen.getByText("Human handoffs").closest(".metric-card")?.textContent
    ).toContain("1")
    await user.selectOptions(
      screen.getByLabelText("Filter events by status"),
      "failed"
    )
    expect(screen.queryByText("A damaged bookcase")).toBeNull()
    await user.click(screen.getByText("View error"))
    expect(screen.getByText("Gmail timed out")).toBeTruthy()
    await user.type(
      screen.getByLabelText("Search subjects or message IDs…"),
      "nonexistent"
    )
    expect(screen.getByText("No matching events")).toBeTruthy()
  })

  it("checks the inbox only on request and reports the result", async () => {
    const fetch = mockApi()
    const user = userEvent.setup()
    render(<EventsPage />)
    await screen.findByText("A damaged bookcase")
    expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false
    )
    await user.click(screen.getByRole("button", { name: "Check inbox now" }))
    expect(await screen.findByText(/No new messages to process/)).toBeTruthy()
    expect(
      fetch.mock.calls.filter(([path]) => path === "/api/poll")
    ).toHaveLength(1)
  })

  it("recovers from a failed request with Try again", async () => {
    const fetch = mockApi()
    fetch.mockRejectedValueOnce(new Error("Offline"))
    const user = userEvent.setup()
    render(<EventsPage />)
    await screen.findByRole("alert")
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("A damaged bookcase")).toBeTruthy()
  })

  it("paginates the activity without losing records", async () => {
    mockApi().mockResolvedValue(
      response(
        Array.from({ length: 12 }, (_, index) => ({
          ...events[0],
          id: index + 1,
          subject: `Subject ${index + 1}`,
        }))
      )
    )
    const user = userEvent.setup()
    render(<EventsPage />)
    await screen.findByText("Subject 10")
    expect(screen.queryByText("Subject 11")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Next events page" }))
    expect(screen.getByText("Subject 12")).toBeTruthy()
    expect(screen.queryByText("Subject 1")).toBeNull()
  })
})

describe("conversations", () => {
  it("opens the exact message when its activity icon is clicked", async () => {
    mockApi()
    const user = userEvent.setup()
    workspace()
    await user.click(
      await screen.findByRole("link", {
        name: "Open conversation: A damaged bookcase",
      })
    )
    const message = await screen.findByRole("article", {
      name: "Message from recent activity",
    })
    expect(message.textContent).toContain("One panel arrived damaged.")
    expect(message.classList.contains("message-highlight")).toBe(true)
    expect(document.activeElement).toBe(message)
    expect(window.location.hash).toBe("#tickets?ticket=10&message=1")
  })

  it("opens a deep-linked ticket outside the latest 100 conversations", async () => {
    const fetch = mockApi()
    const original = fetch.getMockImplementation()!
    fetch.mockImplementation((url, init) =>
      String(url) === "/api/tickets"
        ? Promise.resolve(response([]))
        : original(url, init)
    )
    workspace("tickets?ticket=10&message=1")
    expect(
      await screen.findByRole("heading", { name: "A damaged bookcase" })
    ).toBeTruthy()
    expect(
      await screen.findByRole("article", {
        name: "Message from recent activity",
      })
    ).toBeTruthy()
    expect(fetch.mock.calls.some(([url]) => url === "/api/tickets/10")).toBe(
      true
    )
  })

  it("does not offer a broken conversation link for an unsaved message", async () => {
    mockApi().mockResolvedValue(
      response([
        { ...events[1], subject: null, ticket_id: null, message_id: null },
      ])
    )
    render(<EventsPage />)
    expect(await screen.findByText("Subject unavailable")).toBeTruthy()
    expect(
      screen.queryByRole("link", { name: /Open conversation:/ })
    ).toBeNull()
  })

  it("searches tickets and opens the conversation and proposed action", async () => {
    mockApi()
    const user = userEvent.setup()
    render(<TicketsPage />)
    await screen.findByText("A damaged bookcase")
    await user.type(screen.getByLabelText("Search conversations…"), "alex")
    expect(screen.queryByText("Shipping question")).toBeNull()
    await user.click(screen.getByRole("button", { name: /A damaged bookcase/ }))
    expect(await screen.findByText("One panel arrived damaged.")).toBeTruthy()
    expect(screen.getByText("ship panels")).toBeTruthy()
    await user.click(
      screen.getByRole("button", { name: "Back to conversations" })
    )
    expect(screen.queryByText("One panel arrived damaged.")).toBeNull()
  })

  it("discards a late response from the previously selected ticket", async () => {
    const fetch = mockApi()
    let resolveOld!: (value: Response) => void
    const oldResponse = new Promise<Response>((resolve) => {
      resolveOld = resolve
    })
    const original = fetch.getMockImplementation()!
    fetch.mockImplementation((url, init) =>
      String(url) === "/api/tickets/10/messages"
        ? oldResponse
        : original(url, init)
    )
    const user = userEvent.setup()
    render(<TicketsPage />)
    await user.click(
      await screen.findByRole("button", { name: /A damaged bookcase/ })
    )
    await user.click(screen.getByRole("button", { name: /Shipping question/ }))
    await screen.findByText("One panel arrived damaged.")
    await act(async () =>
      resolveOld(
        response([
          {
            id: 9,
            direction: "in",
            from_address: "old@example.test",
            body: "Stale conversation",
            created_at: created,
          },
        ])
      )
    )
    expect(screen.queryByText("Stale conversation")).toBeNull()
  })
})

describe("knowledge base", () => {
  it("edits and saves the existing title/content API payload", async () => {
    const fetch = mockApi()
    const user = userEvent.setup()
    render(<KnowledgeBasePage />)
    await user.click(
      await screen.findByRole("button", { name: "Delivery times" })
    )
    await user.clear(screen.getByLabelText("Article title"))
    await user.type(
      screen.getByLabelText("Article title"),
      "Updated delivery times"
    )
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    await screen.findByText("All changes saved")
    const request = fetch.mock.calls.find(([, init]) => init?.method === "PUT")
    expect(request?.[0]).toBe("/api/knowledge-base/20")
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      title: "Updated delivery times",
      content: entries[0].content,
    })
    expect(
      screen.getByRole("button", { name: "Updated delivery times" })
    ).toBeTruthy()
  })

  it("retains an unsaved edit when navigation is declined", async () => {
    mockApi()
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    const user = userEvent.setup()
    workspace("knowledge-base")
    await user.click(
      await screen.findByRole("button", { name: "Delivery times" })
    )
    await user.type(screen.getByLabelText("Content"), " Revised.")
    await user.click(screen.getByRole("link", { name: "Conversations" }))
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
    expect(
      (screen.getByLabelText("Content") as HTMLTextAreaElement).value
    ).toContain("Revised.")
    expect(window.location.hash).toBe("#knowledge-base")
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole("link", { name: "Conversations" }))
    expect(
      await screen.findByRole("heading", {
        name: "Every conversation matters.",
      })
    ).toBeTruthy()
  })

  it("keeps the draft visible after a save failure", async () => {
    const fetch = mockApi()
    const original = fetch.getMockImplementation()!
    fetch.mockImplementation((url, init) =>
      init?.method === "PUT"
        ? Promise.resolve(response({}, 500))
        : original(url, init)
    )
    const user = userEvent.setup()
    render(<KnowledgeBasePage />)
    await user.click(
      await screen.findByRole("button", { name: "Delivery times" })
    )
    await user.type(screen.getByLabelText("Content"), " Draft.")
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    expect((await screen.findByRole("alert")).textContent).toContain(
      "couldn’t be saved"
    )
    expect(
      (screen.getByLabelText("Content") as HTMLTextAreaElement).value
    ).toContain("Draft.")
  })
})

describe("workspace controls", () => {
  it("switches theme, navigates, and logs out", async () => {
    mockApi()
    const user = userEvent.setup()
    workspace()
    await user.click(
      screen.getByRole("button", { name: "Switch to dark theme" })
    )
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    await user.click(screen.getByRole("link", { name: "Conversations" }))
    await screen.findByRole("heading", { name: "Every conversation matters." })
    await user.click(
      screen.getByRole("button", { name: /Log out of workspace/ })
    )
    expect(
      await screen.findByRole("heading", { name: "Welcome back." })
    ).toBeTruthy()
    expect(sessionStorage.getItem("dashboard-login")).toBeNull()
  })

  it("keeps skip-to-content navigation on the current page", async () => {
    mockApi()
    const user = userEvent.setup()
    workspace("tickets")
    await screen.findByRole("heading", { name: "Every conversation matters." })
    await user.click(screen.getByRole("link", { name: "Skip to content" }))
    expect(
      screen.getByRole("heading", { name: "Every conversation matters." })
    ).toBeTruthy()
    expect(
      within(screen.getByRole("main")).queryByText("Good support starts here.")
    ).toBeNull()
  })
})
