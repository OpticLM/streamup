import type { Root as MdastRoot } from 'mdast'
import remend from 'remend'
import { visit } from 'unist-util-visit'
import type { MdProcessor } from './processor.js'

function hasFootnote(tree: MdastRoot): boolean {
  let found = false
  visit(tree, (node) => {
    if (
      node.type === 'footnoteReference' ||
      node.type === 'footnoteDefinition'
    ) {
      found = true
      return false
    }
    return true
  })
  return found
}

export function splitBlocks(
  markdown: string,
  processor: MdProcessor,
  streaming: boolean,
): string[] {
  const tree = processor.parse(markdown) as MdastRoot
  if (hasFootnote(tree)) return [streaming ? remend(markdown) : markdown]
  const blocks = tree.children
    .map((node) => {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      return start !== undefined && end !== undefined
        ? markdown.slice(start, end)
        : ''
    })
    .filter((block) => block !== '')
  if (!streaming || blocks.length === 0) return blocks
  const last = blocks[blocks.length - 1]
  if (last === undefined) return blocks
  const healed = remend(last)
  if (healed !== last) blocks[blocks.length - 1] = healed
  return blocks
}
