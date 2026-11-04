import type { Element, ElementContent, Root } from 'hast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import { findCode, textOf } from './processor.js'

function isFenceClosed(source: string, node: Element): boolean {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  if (start === undefined || end === undefined) return true

  const markdown = source.slice(start, end)
  const opening = /^ {0,3}(`{3,}|~{3,})[^\r\n]*(?:\r?\n|$)/.exec(markdown)
  const fence = opening?.[1]
  if (!fence) return true

  const fenceCharacter = fence[0]
  const closing = new RegExp(
    `^ {0,3}${fenceCharacter}{${fence.length},}[\\t ]*$`,
  )
  const lines = markdown.split(/\r?\n/)
  return closing.test(lines[lines.length - 1] ?? '')
}

interface Replacement {
  siblings: ElementContent[]
  index: number
  node: ElementContent
}

/**
 * Builds a rehype plugin that replaces every `<pre><code class="language-X">`
 * fenced block with a custom `<tagName code="…" isClosed={…}>` element.
 * `isClosed` stays `false` until the closing fence has streamed in. Other
 * languages are left as native `<pre><code>`.
 */
export function fencedBlockPlugin(
  language: string,
  tagName: string,
): Plugin<[], Root, Root> {
  const className = `language-${language}`
  const matches = (classes: unknown): boolean =>
    Array.isArray(classes) && classes.includes(className)

  return () => (tree, file) => {
    const source = String(file.value)
    const replacements: Replacement[] = []
    visit(tree, 'element', (el, index, parent) => {
      if (!parent || index === null || index === undefined) return
      if (el.tagName !== 'pre') return
      const code = findCode(el)
      if (!code || !matches(code.properties?.className)) return
      replacements.push({
        siblings: parent.children as ElementContent[],
        index,
        node: {
          type: 'element',
          tagName,
          properties: {
            code: textOf(code),
            isClosed: isFenceClosed(source, el),
          },
          children: [],
        },
      })
    })
    replacements.sort((a, b) => b.index - a.index)
    for (const r of replacements) r.siblings.splice(r.index, 1, r.node)
  }
}
