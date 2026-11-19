import type { FootnoteMode } from '../footnote/types.js'

export interface SplitDocument {
  /** The HTML of each top-level block. */
  blocks: string[]
  /** Footnote contents as HTML, keyed by number (inline mode). */
  footnotes: ReadonlyMap<string, string>
}

/** Elements Words writes without a closing tag or `/>`. */
const VOID = /<(?:br|hr|img|input)[\s/>]/y

/** The section Words appends for footnote definitions. */
const FOOTNOTE_SECTION = '<section class="footnotes" data-footnotes>'

const FOOTNOTE_ITEM = /^<li id="fn-([^"]+)">/

/** A footnote's links back to its references, which only the section needs. */
const BACKREF = /\s*<a [^>]*class="footnote-backref"[^>]*>.*?<\/a>/g

/**
 * A tail that may still turn into footnote syntax: a line that is so far just
 * the opening of a definition (`[`, `[^label`, `[^label]`), or an unclosed
 * `[^label` reference.
 */
const PENDING_FOOTNOTE = /(?:(?<=^|\n)\[(?:\^[^\s[\]]*\]?)?|\[\^[^\s[\]]*)$/

/**
 * Split HTML written by Words into its top-level elements. Words escapes `<`
 * in text and in attribute values, so every `<` opens a tag and the next `>`
 * closes it.
 */
export function splitHtml(html: string): string[] {
  const blocks: string[] = []
  let depth = 0
  let start = 0
  for (let at = html.indexOf('<'); at !== -1; at = html.indexOf('<', at + 1)) {
    const end = html.indexOf('>', at) + 1
    if (depth === 0) start = at
    VOID.lastIndex = at
    if (html[at + 1] === '/') depth--
    else if (html[end - 2] !== '/' && !VOID.test(html)) depth++
    if (depth === 0) blocks.push(html.slice(start, end))
  }
  return blocks
}

/**
 * Split a rendered document into blocks. Inline footnote mode lifts the
 * footnote section out of the body, as one content per footnote.
 */
export function splitDocument(
  html: string,
  footnotes: FootnoteMode = 'section',
): SplitDocument {
  const blocks = splitHtml(html)
  const section = blocks.at(-1)
  if (footnotes === 'section' || !section?.startsWith(FOOTNOTE_SECTION))
    return { blocks, footnotes: new Map() }
  blocks.pop()
  const list = section.slice(
    section.indexOf('<ol>') + '<ol>'.length,
    section.lastIndexOf('</ol>'),
  )
  const contents = new Map<string, string>()
  for (const item of splitHtml(list)) {
    const open = FOOTNOTE_ITEM.exec(item)
    if (!open?.[1]) continue
    const content = item
      .slice(open[0].length, -'</li>'.length)
      .replace(BACKREF, '')
      .trim()
    // A definition with no content yet, such as `[^1]:`, has nothing to show.
    if (content !== '') contents.set(open[1], content)
  }
  return { blocks, footnotes: contents }
}

/**
 * Hold back pending footnote syntax at the end of a stream. A definition's
 * opening would flash as a paragraph, and an unclosed `[^label` as text.
 */
export function holdPendingFootnote(markdown: string): string {
  return markdown.replace(PENDING_FOOTNOTE, '')
}
