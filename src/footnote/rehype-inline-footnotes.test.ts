import { createHtmlSession } from '@pierre/words'
import type { Element, Root } from 'hast'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { describe, expect, it } from 'vitest'
import { splitDocument } from '../parse/blocks.js'
import { rehypeInlineFootnotes } from './rehype-inline-footnotes.js'

const processor = unified().use(rehypeInlineFootnotes)

/** The references in the body of `md`, which inline mode renders without its footnote section. */
function refs(md: string) {
  const html = splitDocument(
    createHtmlSession().render(md).html,
    'inline',
  ).blocks.join('')
  const tree = processor.runSync(fromHtmlIsomorphic(html, { fragment: true }))
  const found: Element['properties'][] = []
  visit(tree as Root, 'element', (node) => {
    if (node.tagName === 'sup') found.push({ sup: true })
    if (node.tagName === 'footnote-ref') found.push(node.properties)
  })
  return found
}

describe('rehypeInlineFootnotes', () => {
  it('turns a linked reference into a footnote-ref with its number', () => {
    expect(refs('A[^note] and B[^note]\n\n[^note]: Def.')).toEqual([
      { label: '1', footnote: '1' },
      { label: '1', footnote: '1' },
    ])
  })

  it('turns an unlinked reference into a footnote-ref with its label', () => {
    expect(refs('A[^Note], B[^x][^y].')).toEqual([
      { label: 'Note' },
      { label: 'x' },
      { label: 'y' },
    ])
  })

  it('leaves references inside code alone', () => {
    expect(refs('`[^1]`\n\n```\n[^2]\n```')).toEqual([])
  })
})
