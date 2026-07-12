import type { Element, ElementContent, Root } from 'hast'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'
import type { KatexOptions as KatexRenderOptions } from 'katex'
import { renderToString } from 'katex'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import type { StreamupPlugin } from '../types.js'

export type KatexOptions = Omit<
  KatexRenderOptions,
  'displayMode' | 'throwOnError'
>

const isMath = (classes: unknown): boolean =>
  Array.isArray(classes) && classes.includes('language-math')

const findCode = (pre: Element): Element | undefined =>
  pre.children.find(
    (c): c is Element => c.type === 'element' && c.tagName === 'code',
  )

const textOf = (node: Element): string =>
  (node.children ?? []).map((c) => (c.type === 'text' ? c.value : '')).join('')

function renderMath(
  tex: string,
  displayMode: boolean,
  options: KatexOptions,
): ElementContent[] {
  try {
    const html = renderToString(tex, {
      ...options,
      displayMode,
      throwOnError: true,
    })
    return fromHtmlIsomorphic(html, { fragment: true })
      .children as ElementContent[]
  } catch {
    return [{ type: 'text', value: tex }]
  }
}

export const rehypeKatex: Plugin<[KatexOptions], Root, Root> =
  (options) => (tree) => {
    const opts = options ?? {}
    type Replacement = {
      siblings: ElementContent[]
      index: number
      nodes: ElementContent[]
    }
    const replacements: Replacement[] = []
    visit(tree, 'element', (el, index, parent) => {
      if (!parent || index === null || index === undefined) return
      if (el.tagName === 'pre') {
        const code = findCode(el)
        if (code && isMath(code.properties?.className)) {
          replacements.push({
            siblings: parent.children as ElementContent[],
            index,
            nodes: renderMath(textOf(code), true, opts),
          })
        }
        return
      }
      if (
        el.tagName === 'code' &&
        parent.type === 'element' &&
        parent.tagName !== 'pre' &&
        isMath(el.properties?.className)
      ) {
        replacements.push({
          siblings: parent.children as ElementContent[],
          index,
          nodes: renderMath(textOf(el), false, opts),
        })
      }
    })
    replacements.sort((a, b) => b.index - a.index)
    for (const r of replacements) r.siblings.splice(r.index, 1, ...r.nodes)
  }

export function katex(options?: KatexOptions): StreamupPlugin {
  return { rehypePlugins: [[rehypeKatex, options ?? {}]] }
}
