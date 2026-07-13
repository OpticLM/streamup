import type { Root } from 'hast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

const CLOBBER_PREFIX = 'user-content-'
const DOUBLED_PREFIX = `${CLOBBER_PREFIX}${CLOBBER_PREFIX}`
const FOOTNOTE_ID_PREFIX = `${DOUBLED_PREFIX}fn`

/**
 * Collapse the doubled `user-content-` prefix that rehype-sanitize adds to
 * footnote ids.
 *
 * remark-rehype already emits footnote `fn-`/`fnref-` ids and their matching
 * `#fn-`/`#fnref-` hrefs with a single `user-content-` clobber prefix baked in.
 * rehype-sanitize then clobbers `id` again (prefixing it once more) but leaves
 * `href` untouched, so ids become `user-content-user-content-fn-1` while the
 * hrefs stay `#user-content-fn-1`. The pairs no longer match, so clicking a
 * footnote reference (or its backref) jumps nowhere.
 *
 * This restores the single prefix on footnote ids only. Other clobbered ids
 * (raw HTML from rehype-raw, the `footnote-label` heading) keep their
 * namespacing, so markdown-authored ids can't clobber the host page.
 */
export const rehypeFixFootnoteIds: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (node) => {
    const id = node.properties.id
    if (typeof id === 'string' && id.startsWith(FOOTNOTE_ID_PREFIX)) {
      node.properties.id = CLOBBER_PREFIX + id.slice(DOUBLED_PREFIX.length)
    }
  })
}
