import type { ElementContent, Root } from 'hast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import { extractLanguage, findCode, textOf } from '../parse/processor.js'
import type { StreamupPlugin } from '../types.js'
import type { CodeBlockProps } from './types.js'

export const CODE_BLOCK_TAG = 'code-block'

interface Replacement {
  siblings: ElementContent[]
  index: number
  node: ElementContent
}

/**
 * Rehype plugin that turns fenced code blocks (`<pre><code class="language-x">`)
 * into a custom `<code-block language="x" code="…">` element. Map it via
 * `components['code-block']` so your component receives a clean
 * `{ language, code }` contract instead of digging through the hast node.
 * Runs after `rehype-sanitize`, so the custom element survives. Inline
 * `<code>` is left untouched. When combining with `katex()` or `rehypeMermaid()`,
 * list those first — this plugin consumes every remaining fenced block.
 */
export const rehypeCodeBlocksPlugin: Plugin<[], Root, Root> = () => (tree) => {
  const replacements: Replacement[] = []
  visit(tree, 'element', (el, index, parent) => {
    if (!parent || index === null || index === undefined) return
    if (el.tagName !== 'pre') return
    const code = findCode(el)
    if (!code) return
    replacements.push({
      siblings: parent.children as ElementContent[],
      index,
      node: {
        type: 'element',
        tagName: CODE_BLOCK_TAG,
        properties: {
          language: extractLanguage(code.properties?.className),
          code: textOf(code),
        },
        children: [],
      },
    })
  })
  replacements.sort((a, b) => b.index - a.index)
  for (const r of replacements) r.siblings.splice(r.index, 1, r.node)
}

/** `StreamupPlugin` wrapper around {@link rehypeCodeBlocksPlugin}. */
export function rehypeCodeBlocks(): StreamupPlugin {
  return { rehypePlugins: [rehypeCodeBlocksPlugin] }
}

/**
 * Native `<pre><code class="language-x">` renderer, for composition: a custom
 * `code-block` component can delegate non-special blocks here to keep the
 * typeset-native output. Omit the class when the block has no language.
 */
export function DefaultCodeBlock({ language, code }: CodeBlockProps) {
  return (
    <pre>
      <code className={language ? `language-${language}` : undefined}>
        {code}
      </code>
    </pre>
  )
}
