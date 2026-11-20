import type { Element, ElementContent, Root } from 'hast'
import { SKIP, visit } from 'unist-util-visit'

export const FOOTNOTE_REF_TAG = 'footnote-ref'

/** GFM's footnote call: a label without whitespace or brackets. */
const REFERENCE = /\[\^([^\s[\]]+)\]/g

/** Elements whose text is code or drawing, never footnote syntax. */
const LITERAL = new Set(['code', 'pre', 'svg'])

const footnoteRef = (label: string, footnote?: string): Element => ({
  type: 'element',
  tagName: FOOTNOTE_REF_TAG,
  properties: footnote === undefined ? { label } : { label, footnote },
  children: [],
})

/** The number of the footnote a `<sup>` from Words links to, if it is a reference. */
function linkedFootnote(sup: Element): string | undefined {
  const [link] = sup.children
  if (link?.type !== 'element' || link.properties.dataFootnoteRef === undefined)
    return undefined
  const href = link.properties.href
  return typeof href === 'string' ? href.replace(/^#fn-/, '') : undefined
}

/** `[^label]` in `value` as text and unlinked references, or `undefined` if there is none. */
function splitReferences(value: string): ElementContent[] | undefined {
  const parts: ElementContent[] = []
  let last = 0
  for (const match of value.matchAll(REFERENCE)) {
    if (match.index > last)
      parts.push({ type: 'text', value: value.slice(last, match.index) })
    parts.push(footnoteRef(match[1] ?? ''))
    last = match.index + match[0].length
  }
  if (parts.length === 0) return undefined
  if (last < value.length)
    parts.push({ type: 'text', value: value.slice(last) })
  return parts
}

/**
 * For inline footnote mode: every reference becomes a
 * `<footnote-ref label="…">` element:
 *
 * - one Words has linked to its footnote (`<sup><a data-footnote-ref>`) also
 *   carries the footnote's number, and is labelled with it;
 * - `[^label]` that Words left as text, because no definition has arrived
 *   (yet), carries only its label.
 */
export function inlineFootnotes(tree: Root): void {
  visit(tree, (node, index, parent) => {
    if (!parent || index === undefined) return
    const siblings = parent.children as ElementContent[]
    if (node.type === 'text') {
      const parts = splitReferences(node.value)
      if (!parts) return
      siblings.splice(index, 1, ...parts)
      return index + parts.length
    }
    if (node.type !== 'element') return
    if (LITERAL.has(node.tagName)) return SKIP
    const footnote = node.tagName === 'sup' ? linkedFootnote(node) : undefined
    if (footnote === undefined) return
    siblings[index] = footnoteRef(footnote, footnote)
    return SKIP
  })
}
