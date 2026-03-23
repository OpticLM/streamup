import type { Link, Root, Text } from 'mdast'
import type { Plugin } from 'unified'
import type { Parent } from 'unist'
import { visit } from 'unist-util-visit'

const CJK_AUTOLINK_BOUNDARY_CHARS = new Set<string>([
  '\u3002',
  '\uFF0E',
  '\uFF0C',
  '\u3001',
  '\uFF1F',
  '\uFF01',
  '\uFF1A',
  '\uFF1B',
  '\uFF08',
  '\uFF09',
  '\u3010',
  '\u3011',
  '\u300C',
  '\u300D',
  '\u300E',
  '\u300F',
  '\u3008',
  '\u3009',
  '\u300A',
  '\u300B',
])

const AUTOLINK_PREFIX_PATTERN = /^(https?:\/\/|mailto:|www\.)/i

const isAutolinkLiteral = (node: Link): node is Link & { children: [Text] } => {
  if (node.children.length !== 1) return false
  const child = node.children[0]
  return child?.type === 'text' && child.value === node.url
}

const findCjkBoundaryIndex = (url: string): number | null => {
  let index = 0
  for (const char of url) {
    if (CJK_AUTOLINK_BOUNDARY_CHARS.has(char)) return index
    index += char.length
  }
  return null
}

export const remarkCjkAutolinkBoundary: Plugin<[], Root> = () => (tree) => {
  visit(
    tree,
    'link',
    (node: Link, index: number | null | undefined, parent?: Parent) => {
      if (!parent || typeof index !== 'number') return
      if (!isAutolinkLiteral(node)) return
      if (!AUTOLINK_PREFIX_PATTERN.test(node.url)) return

      const boundaryIndex = findCjkBoundaryIndex(node.url)
      if (boundaryIndex === null || boundaryIndex === 0) return

      const trimmedUrl = node.url.slice(0, boundaryIndex)
      const trailing = node.url.slice(boundaryIndex)

      const trimmedLink: Link = {
        ...node,
        url: trimmedUrl,
        children: [{ type: 'text', value: trimmedUrl }],
      }
      const trailingText: Text = { type: 'text', value: trailing }

      parent.children.splice(index, 1, trimmedLink, trailingText)
      return index + 1
    },
  )
}
