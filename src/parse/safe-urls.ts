import type { Root } from 'hast'
import { visit } from 'unist-util-visit'

/** URL schemes allowed per attribute, as in rehype-sanitize's default schema plus `tel`. */
const PROTOCOLS = {
  href: ['http', 'https', 'mailto', 'tel', 'xmpp', 'irc', 'ircs'],
  src: ['http', 'https'],
} as const

/** A colon after the first `/`, `?` or `#` is part of a relative URL, not a scheme. */
function isSafe(url: string, protocols: readonly string[]): boolean {
  const colon = url.indexOf(':')
  if (colon === -1 || /[/?#]/.test(url.slice(0, colon))) return true
  return protocols.includes(url.slice(0, colon).toLowerCase())
}

/**
 * Drop `href` and `src` values with any other scheme, such as `javascript:`
 * or `data:`. Words omits raw HTML, but keeps link and image destinations as
 * written.
 */
export function safeUrls(tree: Root): void {
  visit(tree, 'element', (node) => {
    for (const key of ['href', 'src'] as const) {
      const url = node.properties[key]
      if (typeof url === 'string' && !isSafe(url, PROTOCOLS[key]))
        delete node.properties[key]
    }
  })
}
