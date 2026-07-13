import cliHighlight from "cli-highlight"
import { hash } from "./hash.js"

// Sync syntax highlighter behind a tiny cache. Cache key = (lang, codeHash) so a code
// block is highlighted once and reused across every scroll frame and resize. Unknown
// languages / failures degrade to plain text — highlighting must never break rendering.
const { highlight } = cliHighlight
const cache = new Map()

export const stats = { calls: 0, hits: 0 }

export const highlightCode = (code, lang) => {
  const key = `${lang}:${hash(code)}`
  const cached = cache.get(key)
  if (cached !== undefined) {
    stats.hits++
    return cached
  }
  stats.calls++
  let out
  try {
    out = highlight(code, { language: lang || undefined, ignoreIllegals: true })
  } catch {
    out = code // unsupported language or parse failure → plain fallback
  }
  cache.set(key, out)
  return out
}

export const resetHighlightStats = () => {
  stats.calls = 0
  stats.hits = 0
}
