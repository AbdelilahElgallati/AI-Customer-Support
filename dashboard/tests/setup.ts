import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach, vi } from "vitest"

beforeEach(() => {
  window.history.replaceState(null, "", "/")
  sessionStorage.clear()
  localStorage.clear()
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches: false,
      media: "(prefers-color-scheme: dark)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  )
  // No test may accidentally reach Gmail or the real API.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("Unmocked request"))
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
