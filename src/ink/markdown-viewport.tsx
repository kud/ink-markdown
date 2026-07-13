import type { FC } from "react"
import { Text } from "ink"

export type MarkdownViewportProps = {
  source: string
  width: number
  height: number
}

export const MarkdownViewport: FC<MarkdownViewportProps> = ({ source }) => (
  <Text>{source}</Text>
)
