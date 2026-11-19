import type { Element, Root } from 'hast'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import type { PluggableList } from 'unified'
import { unified } from 'unified'
import { rehypeInlineFootnotes } from '../footnote/rehype-inline-footnotes.js'
import type { FootnoteMode } from '../footnote/types.js'
import type { StreamupComponents } from '../types.js'
import { rehypeCjkAutolinkBoundary } from './rehype-cjk-autolink-boundary.js'
import { rehypeSafeUrls } from './rehype-safe-urls.js'

export interface ProcessorOptions {
  rehypePlugins?: PluggableList
  footnotes?: FootnoteMode
}

/** The rehype plugins every block of Words' HTML runs through. */
export function createProcessor(options: ProcessorOptions = {}) {
  return unified()
    .use(rehypeSafeUrls)
    .use(rehypeCjkAutolinkBoundary)
    .use(options.footnotes === 'inline' ? [rehypeInlineFootnotes] : [])
    .use(options.rehypePlugins ?? [])
}

export type BlockProcessor = ReturnType<typeof createProcessor>

export function extractLanguage(className: unknown): string {
  const classes = Array.isArray(className)
    ? className
    : className
      ? [className]
      : []
  for (const c of classes) {
    if (typeof c === 'string' && c.startsWith('language-'))
      return c.slice('language-'.length)
  }
  return ''
}

export function findCode(pre: Element): Element | undefined {
  return pre.children.find(
    (c): c is Element => c.type === 'element' && c.tagName === 'code',
  )
}

export function textOf(node: Element): string {
  return (node.children ?? [])
    .map((c) => (c.type === 'text' ? c.value : ''))
    .join('')
}

/** Render a block of Words' HTML to React. */
export function renderBlock(
  html: string,
  {
    processor,
    components,
  }: { processor: BlockProcessor; components?: StreamupComponents },
) {
  const tree = processor.runSync(
    fromHtmlIsomorphic(html, { fragment: true }),
  ) as Root
  return toJsxRuntime(tree, {
    Fragment,
    components,
    ignoreInvalidStyle: true,
    jsx,
    jsxs,
    passKeys: true,
    passNode: true,
  })
}
