import type { Root } from 'hast'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { inlineFootnotes } from '../footnote/inline-footnotes.js'
import type { FootnoteMode } from '../footnote/types.js'
import type { StreamupComponents } from '../types.js'
import { cjkAutolinkBoundary } from './cjk-autolink-boundary.js'
import { codeBlocks } from './code-blocks.js'
import { safeUrls } from './safe-urls.js'

export interface RenderBlockOptions {
  components: StreamupComponents
  footnotes: FootnoteMode
  /** A last step on the block's tree, such as the streaming effects. */
  decorate?: (tree: Root) => void
}

/** Render a block of Words' HTML to React. */
export function renderBlock(
  html: string,
  { components, footnotes, decorate }: RenderBlockOptions,
) {
  const tree = fromHtmlIsomorphic(html, { fragment: true })
  safeUrls(tree)
  cjkAutolinkBoundary(tree)
  if (footnotes === 'inline') inlineFootnotes(tree)
  codeBlocks(tree)
  decorate?.(tree)
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
