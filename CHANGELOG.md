# Changelog

All notable changes to this project are documented here.

---

## 0.2.0 — 2026-09-11

### Highlights

- Blocks in a rendered document now get a blank line between them — a bold paragraph standing in for a heading no longer runs straight into the list beneath it. Lists stay tight internally, code fences stay whole, and thematic breaks get air on both sides; the spacing is computed at document level, so viewport scrolling and per-block layout stay correct. Line counts in any test that snapshots them will shift accordingly. ([cf4093a](https://github.com/kud/ink-markdown/commit/cf4093a834cadacef782b2378bab561b5ab00fd6))
- Bare `http(s)://` URLs are now recognised and styled as links automatically, matching the look of an explicit `[text](url)`. Trailing punctuation and a wrapping closing parenthesis are kept outside the link, and an explicit link around a URL still takes precedence. ([cf4093a](https://github.com/kud/ink-markdown/commit/cf4093a834cadacef782b2378bab561b5ab00fd6))

---
