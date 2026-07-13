// FNV-1a — cheap, stable content hash used for block identity and layout-cache keys.
export const hash = (input: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}
