import { useInput } from "ink"

export type MarkdownScrollOptions = {
  totalLines: number
  height: number
  offset: number
  onChange: (offset: number) => void
  /** Disable the key handler (e.g. when another pane has focus). */
  active?: boolean
}

const clamp = (value: number, max: number): number =>
  Math.max(0, Math.min(value, max))

// Optional keyboard controller — the core owns scrolling *primitives* (offset in/out), not
// keybindings. Apps that want their own bindings ignore this and drive `scrollOffset` directly.
export const useMarkdownScroll = ({
  totalLines,
  height,
  offset,
  onChange,
  active = true,
}: MarkdownScrollOptions): void => {
  const max = Math.max(0, totalLines - height)
  useInput(
    (input, key) => {
      if (key.downArrow || input === "j") onChange(clamp(offset + 1, max))
      else if (key.upArrow || input === "k") onChange(clamp(offset - 1, max))
      else if (key.pageDown || input === " ")
        onChange(clamp(offset + height, max))
      else if (key.pageUp || input === "b")
        onChange(clamp(offset - height, max))
      else if (input === "g") onChange(0)
      else if (input === "G") onChange(max)
    },
    { isActive: active },
  )
}
