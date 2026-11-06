export function StatusBadge({ status }: { status: string }) {
  const tone = [
    "sent",
    "replied",
    "answered",
    "completed",
    "resolved",
    "processed",
  ].includes(status)
    ? "green"
    : ["failed", "error"].includes(status)
      ? "red"
      : ["escalated", "needs-human"].includes(status)
        ? "amber"
        : ["processing", "pending", "open"].includes(status)
          ? "blue"
          : "neutral"
  return (
    <span className={`status-badge status-${tone}`}>
      <span />
      {status.replaceAll(/[-_]/g, " ")}
    </span>
  )
}
