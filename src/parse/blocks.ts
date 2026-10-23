import type { FootnoteDefinition, Root as MdastRoot, RootContent } from 'mdast'
import remend from 'remend'
import { visit } from 'unist-util-visit'
import type { FootnoteMode, Footnotes } from '../footnote/types.js'
import type { MdProcessor } from './processor.js'

export interface SplitOptions {
  /**
   * The source is a prefix of a document still arriving: heal its trailing
   * block, and keep its trailing footnote definition open.
   */
  live: boolean
  footnotes?: FootnoteMode
}

export interface SplitDocument {
  blocks: string[]
  /** Root-level footnote definitions as standalone markdown (inline mode). */
  footnotes: Footnotes<string>
}

/** Nodes whose text is literal, so it never holds footnote syntax. */
const LITERAL_TYPES = new Set(['code', 'html', 'math'])

/**
 * A tail that may still turn into footnote syntax: a block that is so far
 * just the opening of a definition (`[`, `[^label`, `[^label]`), or an
 * unclosed `[^label` reference.
 */
const PENDING_FOOTNOTE = /(?:^\[(?:\^[^\s[\]]*\]?)?|\[\^[^\s[\]]*)$/

/** A continuation line's indent inside a footnote definition: up to 4 columns. */
const CONTINUATION_INDENT = /\n(?: {0,3}\t| {1,4})/g

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

function sliceOf(markdown: string, node: RootContent): string {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  return start !== undefined && end !== undefined
    ? markdown.slice(start, end)
    : ''
}

/** A definition's content as standalone markdown: no marker, no indent. */
function definitionContent(markdown: string, node: FootnoteDefinition): string {
  const start = node.children[0]?.position?.start.offset
  const end = node.position?.end.offset
  if (start === undefined || end === undefined) return ''
  return markdown.slice(start, end).replace(CONTINUATION_INDENT, '\n')
}

function healTail(
  block: string,
  node: RootContent,
  footnotes: FootnoteMode,
): string {
  // Inline mode holds back pending footnote syntax: a definition's opening
  // would flash as a paragraph, and remend would close `[^label` as a link,
  // which then parses as a reference followed by the link's literal URL.
  const held =
    footnotes === 'inline' && !LITERAL_TYPES.has(node.type)
      ? block.replace(PENDING_FOOTNOTE, '')
      : block
  return remend(held)
}

export function splitBlocks(
  markdown: string,
  processor: MdProcessor,
  { live, footnotes = 'section' }: SplitOptions,
): SplitDocument {
  const tree = processor.parse(markdown) as MdastRoot
  if (footnotes === 'section' && hasFootnote(tree)) {
    return {
      blocks: [live ? remend(markdown) : markdown],
      footnotes: { settled: new Map() },
    }
  }

  const tail = live ? tree.children.at(-1) : undefined
  const blocks: string[] = []
  const settled = new Map<string, string>()
  let open: string | undefined
  for (const node of tree.children) {
    if (footnotes === 'inline' && node.type === 'footnoteDefinition') {
      // The first definition of a label wins, as in remark-rehype.
      if (settled.has(node.identifier)) continue
      if (node === tail) open = node.identifier
      else settled.set(node.identifier, definitionContent(markdown, node))
      continue
    }
    const block = sliceOf(markdown, node)
    const healed = node === tail ? healTail(block, node, footnotes) : block
    if (healed !== '') blocks.push(healed)
  }
  return { blocks, footnotes: { settled, open } }
}
