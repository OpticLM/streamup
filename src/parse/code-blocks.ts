import type { Element, Root } from 'hast'
import { SKIP, visit } from 'unist-util-visit'

export const CODE_BLOCK_TAG = 'code-block'

function languageOf(code: Element): string {
  const classes = code.properties.className
  if (!Array.isArray(classes)) return ''
  for (const c of classes) {
    if (typeof c === 'string' && c.startsWith('language-'))
      return c.slice('language-'.length)
  }
  return ''
}

const textOf = (node: Element): string =>
  node.children.map((c) => (c.type === 'text' ? c.value : '')).join('')

/**
 * Turn every fenced code block (`<pre><code class="language-x">`) into a
 * `<code-block code language isIncomplete>` element, which renders through
 * `components['code-block']`. Inline `<code>` stays. Words marks a fence
 * still streaming as `<pre data-markdown-incomplete>`.
 */
export function codeBlocks(tree: Root): void {
  visit(tree, 'element', (pre, index, parent) => {
    if (pre.tagName !== 'pre' || !parent || index === undefined) return
    const code = pre.children.find(
      (c): c is Element => c.type === 'element' && c.tagName === 'code',
    )
    if (!code) return
    parent.children[index] = {
      type: 'element',
      tagName: CODE_BLOCK_TAG,
      properties: {
        code: textOf(code),
        language: languageOf(code),
        isIncomplete: pre.properties.dataMarkdownIncomplete !== undefined,
      },
      children: [],
    }
    return SKIP
  })
}
