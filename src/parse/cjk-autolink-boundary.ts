import type { Root } from 'hast'
import { visit } from 'unist-util-visit'

/** CJK punctuation that ends a literal autolink: `。`, `，`, `（`, `」`, … */
const BOUNDARY = /[、。〈-】！（），．：；？]/

const AUTOLINK = /^(?:https?:\/\/|mailto:|www\.)/i

/**
 * End a literal autolink at CJK punctuation, so
 * `https://example.com。下一句` links only `https://example.com`. GFM stops an
 * autolink at whitespace only, and CJK text has none between sentences.
 */
export function cjkAutolinkBoundary(tree: Root): void {
  visit(tree, 'element', (node, index, parent) => {
    if (node.tagName !== 'a' || !parent || index === undefined) return
    const [text] = node.children
    const href = node.properties.href
    if (node.children.length !== 1 || text?.type !== 'text') return
    if (typeof href !== 'string' || !AUTOLINK.test(text.value)) return
    const at = text.value.search(BOUNDARY)
    if (at <= 0) return
    // Words percent-encodes the link text into `href`: cut both at the boundary.
    const trailing = text.value.slice(at)
    const encoded = encodeURI(trailing)
    if (!href.endsWith(encoded)) return
    text.value = text.value.slice(0, at)
    node.properties.href = href.slice(0, -encoded.length)
    parent.children.splice(index + 1, 0, { type: 'text', value: trailing })
    return index + 2
  })
}
