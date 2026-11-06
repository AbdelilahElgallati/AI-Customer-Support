import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api"

// Abort stale requests when navigating, refreshing, or switching conversations.
export function useResource<T>(path: string | null) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{
    path: string
    revision: number
    data: T | null
    error: string
  } | null>(null)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    let active = true
    api<T>(path, { signal: controller.signal })
      .then((data) => {
        if (active) setResult({ path, revision, data, error: "" })
      })
      .catch(() => {
        if (active)
          setResult({
            path,
            revision,
            data: null,
            error:
              "We couldn’t load this data. Check your connection and try again.",
          })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [path, revision])

  const current = result?.path === path && result?.revision === revision
  return {
    data: current ? result.data : null,
    loading: Boolean(path) && !current,
    error: current ? result.error : "",
    refresh,
  }
}
