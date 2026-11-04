import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import type { StreamupPlugin } from '../types.js'
import { findCode, textOf } from './processor.js'

export const MERMAID_BLOCK_TAG = 'mermaid-block'

const isMermaid = (classes: unknown): boolean =>
  Array.isArray(classes) && classes.includes('language-mermaid')

function isFenceClosed(source: string, node: Element): boolean {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  if (start === undefined || end === undefined) return true

  const markdown = source.slice(start, end)
  const opening = /^ {0,3}(`{3,}|~{3,})[^\r\n]*(?:\r?\n|$)/.exec(markdown)
  const fence = opening?.[1]
  if (!fence) return true

  const fenceCharacter = fence[0]
  const closing = new RegExp(`^${fenceCharacter}{${fence.length},}[\\t ]*$`)
  const lines = markdown.split(/\r?\n/)
  // Past the first line, the source still carries the fence's container
  // prefix (`> ` of a blockquote, a list item's indentation): drop it.
  const last = (lines[lines.length - 1] ?? '').replace(/^[ \t>]*/, '')
  return closing.test(last)
}

/**
 * Rehype plugin that turns ` ```mermaid ` fenced blocks into a custom
 * `<mermaid-block code="…" isClosed={…}>` element. It only finds the diagram;
 * map `components['mermaid-block']` to whatever draws it, such as
 * `MermaidRenderer` (`@opticlm/streamup/mermaid`) or `PeleRenderer`
 * (`@opticlm/streamup/pele`). Other code stays native `<pre><code>` for
 * typeset. Runs after `rehype-sanitize`.
 */
export const rehypeMermaid: Plugin<[], Root, Root> = () => (tree, file) => {
  const source = String(file.value)
  visit(tree, 'element', (el, index, parent) => {
    if (!parent || index === undefined || el.tagName !== 'pre') return
    const code = findCode(el)
    if (!code || !isMermaid(code.properties?.className)) return
    // One node for one node: siblings keep their indices, so swap in place.
    parent.children[index] = {
      type: 'element',
      tagName: MERMAID_BLOCK_TAG,
      properties: { code: textOf(code), isClosed: isFenceClosed(source, el) },
      children: [],
    }
  })
}

/** `StreamupPlugin` wrapper around {@link rehypeMermaid}. */
export function mermaid(): StreamupPlugin {
  return { rehypePlugins: [rehypeMermaid] }
}
