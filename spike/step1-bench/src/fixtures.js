// Deterministic fixture generators (seeded PRNG — reproducible across runs).

const makeRng = (seed) => () => {
  seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

const WORDS =
  "the quick brown fox jumps over a lazy dog terminal renderer viewport layout stream diff block cache token latency reconcile yoga ink opentui markdown engine width unicode span highlight".split(
    " ",
  )

const CODE_SNIPPETS = [
  {
    lang: "js",
    code: `const load = async (id) => {\n  const res = await fetch('/api/' + id);\n  if (!res.ok) throw new Error('bad status ' + res.status);\n  return res.json();\n};`,
  },
  {
    lang: "ts",
    code: `interface Block {\n  id: string;\n  type: BlockType;\n  lines: readonly string[];\n}\n\nconst measure = (b: Block): number => b.lines.length;`,
  },
  {
    lang: "py",
    code: `def fib(n: int) -> int:\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a`,
  },
  {
    lang: "go",
    code: `func Sum(xs []int) int {\n\ttotal := 0\n\tfor _, x := range xs {\n\t\ttotal += x\n\t}\n\treturn total\n}`,
  },
]

const sentence = (rng, n) =>
  Array.from({ length: n }, () => WORDS[Math.floor(rng() * WORDS.length)]).join(
    " ",
  )

// ~targetLines of mixed Markdown: headings, prose, code, lists, quotes.
export const techDoc = (targetLines) => {
  const rng = makeRng(1)
  const out = []
  let n = 0
  let section = 0
  while (n < targetLines) {
    const roll = rng()
    if (roll < 0.12) {
      out.push(`## Section ${++section}: ${sentence(rng, 3)}`, "")
      n += 2
    } else if (roll < 0.4) {
      const para = sentence(rng, 40 + Math.floor(rng() * 40))
      out.push(`Some **bold** and \`inline code\` — ${para}.`, "")
      n += 2
    } else if (roll < 0.62) {
      const s = CODE_SNIPPETS[Math.floor(rng() * CODE_SNIPPETS.length)]
      out.push("```" + s.lang, s.code, "```", "")
      n += s.code.split("\n").length + 3
    } else if (roll < 0.82) {
      const items = 3 + Math.floor(rng() * 4)
      for (let k = 0; k < items; k++)
        out.push(`- ${sentence(rng, 6 + Math.floor(rng() * 8))}`)
      out.push("")
      n += items + 1
    } else {
      out.push(`> ${sentence(rng, 12)}`, "")
      n += 2
    }
  }
  return out.join("\n")
}

// ~targetLines of unified diff across many files.
export const unifiedDiff = (targetLines) => {
  const rng = makeRng(7)
  const out = []
  let n = 0
  let file = 0
  while (n < targetLines) {
    const path = `src/module${++file}/handler.ts`
    out.push(
      `diff --git a/${path} b/${path}`,
      `index ${Math.floor(rng() * 1e6).toString(16)}..${Math.floor(rng() * 1e6).toString(16)} 100644`,
      `--- a/${path}`,
      `+++ b/${path}`,
    )
    n += 4
    const hunks = 1 + Math.floor(rng() * 3)
    for (let hk = 0; hk < hunks; hk++) {
      const at = 1 + Math.floor(rng() * 200)
      out.push(`@@ -${at},7 +${at},7 @@ function handler${hk}()`)
      n += 1
      const body = 6 + Math.floor(rng() * 8)
      for (let b = 0; b < body; b++) {
        const kind = rng()
        if (kind < 0.3) out.push(`-  ${sentence(rng, 5)}`)
        else if (kind < 0.6) out.push(`+  ${sentence(rng, 5)}`)
        else out.push(`   ${sentence(rng, 5)}`)
        n += 1
      }
    }
  }
  return out.join("\n")
}

// Hundreds of tiny code blocks interleaved with one-line prose.
export const codeHeavy = (blocks) => {
  const rng = makeRng(3)
  const out = []
  for (let i = 0; i < blocks; i++) {
    out.push(`Example ${i + 1}:`)
    const s = CODE_SNIPPETS[Math.floor(rng() * CODE_SNIPPETS.length)]
    out.push("```" + s.lang, s.code, "```", "")
  }
  return out.join("\n")
}

export const fixtures = () => ({
  "readme-1k": techDoc(1000),
  "doc-10k": techDoc(10000),
  "diff-5k": unifiedDiff(5000),
  "codeheavy-300": codeHeavy(300),
})
