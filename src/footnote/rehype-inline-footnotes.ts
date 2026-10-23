import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

export const FOOTNOTE_REF_TAG = 'footnote-ref'

const REFERENCE_SOURCE = /^\[\^(.+)\]$/

/**
 * Rehype plugin for inline footnote mode: turns each footnote reference
 * (`<sup><a data-footnote-ref>`) into a `<footnote-ref label="…">` element,
 * and drops the `<section data-footnotes>` that remark-rehype appends for
 * definitions in the same tree — inline mode shows footnotes at their
 * references instead.
 *
 * Runs after rehype-sanitize, which strips unknown properties but keeps
 * positions, so the label is read back from the source: the reference's
 * `href` only carries a URI-encoded, lowercased form of it.
 */
export const rehypeInlineFootnotes: Plugin<[], Root> = () => (tree, file) => {
  const source = String(file.value)
  visit(tree, 'element', (node, index, parent) => {
    if (!parent || index === undefined) return
    if (
      node.tagName === 'section' &&
      node.properties.dataFootnotes !== undefined
    ) {
      parent.children.splice(index, 1)
      return [SKIP, index]
    }
    const label =
      node.tagName === 'sup' ? referenceLabel(node, source) : undefined
    if (label === undefined) return
    parent.children[index] = {
      type: 'element',
      tagName: FOOTNOTE_REF_TAG,
      properties: { label },
      children: [],
    }
    return SKIP
  })
}

function referenceLabel(sup: Element, source: string): string | undefined {
  const [link] = sup.children
  if (link?.type !== 'element' || link.properties.dataFootnoteRef === undefined)
    return undefined
  const start = sup.position?.start.offset
  const end = sup.position?.end.offset
  if (start === undefined || end === undefined) return undefined
  return REFERENCE_SOURCE.exec(source.slice(start, end))?.[1]
}
