export function hashPage() {
  return window.location.hash.slice(1).split("?")[0]
}

export function conversationHref(ticketId: number, messageId?: number | null) {
  const params = new URLSearchParams({ ticket: String(ticketId) })
  if (messageId) params.set("message", String(messageId))
  return `#tickets?${params}`
}

export function conversationTarget() {
  const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "")
  const id = (key: string) => {
    const value = Number(params.get(key))
    return Number.isSafeInteger(value) && value > 0 ? value : null
  }
  return {
    ticketId: hashPage() === "tickets" ? id("ticket") : null,
    messageId: hashPage() === "tickets" ? id("message") : null,
  }
}
