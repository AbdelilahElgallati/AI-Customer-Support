import { useEffect, useState } from "react"
import {
  ArrowUpRight,
  BookOpen,
  Check,
  FileText,
  FolderOpen,
  LoaderCircle,
  Save,
  ShieldCheck,
} from "lucide-react"
import {
  EmptyState,
  LoadingState,
  Notice,
  PageHeader,
  SearchField,
} from "@/components/workspace"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import type { Entry } from "@/lib/types"
import { useResource } from "@/lib/use-resource"

export function KnowledgeBasePage() {
  const { data, loading, error, refresh } =
    useResource<Entry[]>("/knowledge-base")
  const [updates, setUpdates] = useState<Record<number, Entry>>({})
  const [selected, setSelected] = useState<Entry | null>(null)
  const [query, setQuery] = useState("")
  const [dirty, setDirty] = useState(false)
  const entries = (data ?? []).map((entry) => updates[entry.id] ?? entry)
  const filtered = entries.filter((entry) =>
    `${entry.title} ${entry.section} ${entry.content}`
      .toLowerCase()
      .includes(query.toLowerCase())
  )
  const sections = [...new Set(filtered.map((entry) => entry.section))]

  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    const beforeNavigate = (event: Event) => {
      if (!window.confirm("You have unsaved changes. Leave without saving?"))
        event.preventDefault()
    }
    window.addEventListener("beforeunload", beforeUnload)
    window.addEventListener("dashboard-before-navigate", beforeNavigate)
    return () => {
      window.removeEventListener("beforeunload", beforeUnload)
      window.removeEventListener("dashboard-before-navigate", beforeNavigate)
    }
  }, [dirty])

  function select(entry: Entry) {
    if (entry.id === selected?.id) return
    if (
      dirty &&
      !window.confirm(
        "You have unsaved changes. Open another article without saving?"
      )
    )
      return
    setDirty(false)
    setSelected(entry)
  }

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="KNOWLEDGE THAT CARES"
        title="Better knowledge. Better answers."
        description="Give your AI the context to help customers with confidence."
      >
        <span className="header-count">
          <BookOpen size={16} />
          {entries.length} articles{" "}
          <span>
            in {[...new Set(entries.map((e) => e.section))].length} sections
          </span>
        </span>
      </PageHeader>
      <div className="knowledge-note">
        <span className="knowledge-note-icon">
          <BookOpen size={20} />
        </span>
        <div>
          <strong>Your expertise, behind every answer.</strong>
          <p>
            Keep product details, shipping information, and policies up to date.
            Your AI reads this knowledge when helping customers.
          </p>
        </div>
        <ShieldCheck size={24} strokeWidth={1.3} />
      </div>
      {error && <Notice onRetry={refresh}>{error}</Notice>}
      <div className="knowledge-workspace panel">
        <nav className="knowledge-library" aria-label="Knowledge articles">
          <div className="library-heading">
            <h2>
              Library <span className="count-badge">{entries.length}</span>
            </h2>
            <FolderOpen size={17} className="subtle" />
          </div>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Find an article…"
          />
          <div className="library-sections">
            {loading ? (
              <LoadingState label="Loading articles…" />
            ) : error ? (
              <EmptyState
                icon={BookOpen}
                title="Library unavailable"
                description="Restore the connection to see your knowledge."
              />
            ) : !sections.length ? (
              <EmptyState
                icon={FileText}
                title={
                  entries.length
                    ? "No articles found"
                    : "Your knowledge starts here"
                }
                description={
                  entries.length
                    ? "Try another title or keyword."
                    : "Articles will appear here once your knowledge base has been populated."
                }
              />
            ) : (
              sections.map((section) => (
                <div className="library-section" key={section}>
                  <h3>
                    {section.replaceAll(/[-_]/g, " ")}
                    <span>
                      {filtered.filter((e) => e.section === section).length}
                    </span>
                  </h3>
                  {filtered
                    .filter((e) => e.section === section)
                    .map((entry) => (
                      <button
                        className={`article-link ${entry.id === selected?.id ? "selected" : ""}`}
                        key={entry.id}
                        onClick={() => select(entry)}
                        aria-current={
                          entry.id === selected?.id ? "true" : undefined
                        }
                      >
                        <FileText size={16} />
                        <span>{entry.title}</span>
                        {entry.id === selected?.id && (
                          <span className="small-dot" />
                        )}
                      </button>
                    ))}
                </div>
              ))
            )}
          </div>
          <div className="library-footer">
            <ShieldCheck size={13} /> The source behind your AI’s answers
          </div>
        </nav>
        <section className="knowledge-editor" aria-label="Article editor">
          {selected ? (
            <ArticleEditor
              key={selected.id}
              entry={selected}
              onDirty={setDirty}
              onSaved={(updated) => {
                setUpdates((current) => ({ ...current, [updated.id]: updated }))
                setSelected(updated)
              }}
            />
          ) : (
            <div className="editor-placeholder">
              <div className="document-illustration" aria-hidden="true">
                <FileText size={47} strokeWidth={1} />
                <span />
                <span />
                <span />
                <span className="document-badge">
                  <Check size={18} />
                </span>
              </div>
              <span className="eyebrow">A SHARED SOURCE OF TRUTH</span>
              <h2>
                A good answer starts
                <br />
                with what you know.
              </h2>
              <p>
                Choose an article from your library to review
                <br className="desktop-break" /> and refine the knowledge your
                AI relies on.
              </p>
              <div className="editor-placeholder-tags">
                <span>
                  <FileText size={13} /> Clear information
                </span>
                <span>
                  <ShieldCheck size={13} /> Confident answers
                </span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ArticleEditor({
  entry,
  onDirty,
  onSaved,
}: {
  entry: Entry
  onDirty: (dirty: boolean) => void
  onSaved: (entry: Entry) => void
}) {
  const [title, setTitle] = useState(entry.title)
  const [content, setContent] = useState(entry.content)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const dirty = title !== entry.title || content !== entry.content
  useEffect(() => {
    onDirty(dirty)
  }, [dirty, onDirty])

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !dirty) return
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      const updated = await api<Entry>(`/knowledge-base/${entry.id}`, {
        method: "PUT",
        body: JSON.stringify({ title: title.trim(), content }),
      })
      setTitle(updated.title)
      setContent(updated.content)
      onSaved(updated)
      onDirty(false)
      setSaved(true)
    } catch {
      setError(
        "Your changes couldn’t be saved. They’re still here; please try again."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="article-form" onSubmit={save}>
      <div className="editor-topbar">
        <span>
          <FileText size={15} />
          {entry.section.replaceAll(/[-_]/g, " ")}
          <span className="subtle">/</span> Article #{entry.id}
        </span>
        <span
          className={`save-state ${saved && !dirty ? "is-saved" : ""}`}
          role="status"
        >
          {saving
            ? "Saving…"
            : dirty
              ? "Unsaved changes"
              : saved
                ? "All changes saved"
                : "Ready to edit"}
        </span>
      </div>
      <div className="editor-fields">
        <div className="editor-label">
          <span className="eyebrow">KNOWLEDGE ARTICLE</span>
          <span>
            <BookOpen size={13} /> Used by your support AI
          </span>
        </div>
        <Label htmlFor="article-title">Article title</Label>
        <Input
          id="article-title"
          className="article-title"
          value={title}
          required
          disabled={saving}
          onChange={(e) => {
            setTitle(e.target.value)
            setSaved(false)
          }}
        />
        <div className="content-label">
          <Label htmlFor="article-content">Content</Label>
          <span>
            {content.trim() ? content.trim().split(/\s+/).length : 0} words
          </span>
        </div>
        <Textarea
          id="article-content"
          className="article-content"
          value={content}
          disabled={saving}
          onChange={(e) => {
            setContent(e.target.value)
            setSaved(false)
          }}
        />
        <p className="editor-hint">
          Be specific and factual. Include the details your customers need to
          make their next step clear.
        </p>
        {error && <Notice>{error}</Notice>}
      </div>
      <div className="editor-bottom">
        <span>
          <ShieldCheck size={14} /> Changes apply to future AI answers.
        </span>
        <Button type="submit" disabled={saving || !dirty || !title.trim()}>
          {saving ? (
            <LoaderCircle className="animate-spin" />
          ) : saved && !dirty ? (
            <Check />
          ) : (
            <Save />
          )}
          {saving ? "Saving…" : "Save changes"}
          <ArrowUpRight size={14} />
        </Button>
      </div>
    </form>
  )
}
