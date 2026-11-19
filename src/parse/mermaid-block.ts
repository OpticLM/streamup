import type { Root } from 'hast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import type { StreamupPlugin } from '../types.js'
import { findCode, textOf } from './processor.js'

export const MERMAID_BLOCK_TAG = 'mermaid-block'

const isMermaid = (classes: unknown): boolean =>
  Array.isArray(classes) && classes.includes('language-mermaid')

/**
 * Rehype plugin that turns ` ```mermaid ` fenced blocks into a custom
 * `<mermaid-block code="…" isClosed={…}>` element. It only finds the diagram;
 * map `components['mermaid-block']` to whatever draws it, such as
 * `MermaidRenderer` (`@opticlm/streamup/mermaid`) or `PeleRenderer`
 * (`@opticlm/streamup/pele`). Other code stays native `<pre><code>` for
 * typeset. Words marks a fence still streaming as `<pre data-markdown-incomplete>`.
 */
export const rehypeMermaid: Plugin<[], Root, Root> = () => (tree) => {
  visit(tree, 'element', (el, index, parent) => {
    if (!parent || index === undefined || el.tagName !== 'pre') return
    const code = findCode(el)
    if (!code || !isMermaid(code.properties?.className)) return
    // One node for one node: siblings keep their indices, so swap in place.
    parent.children[index] = {
      type: 'element',
      tagName: MERMAID_BLOCK_TAG,
      properties: {
        code: textOf(code),
        isClosed: el.properties.dataMarkdownIncomplete === undefined,
      },
      children: [],
    }
  })
}

/** `StreamupPlugin` wrapper around {@link rehypeMermaid}. */
export function mermaid(): StreamupPlugin {
  return { rehypePlugins: [rehypeMermaid] }
}
