import { createHtmlSession } from '@pierre/words'
import type { Element } from 'hast'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'
import { visit } from 'unist-util-visit'
import { describe, expect, it } from 'vitest'
import { splitDocument } from '../parse/blocks.js'
import { inlineFootnotes } from './inline-footnotes.js'

/** The references in the body of `md`, which inline mode renders without its footnote section. */
function refs(md: string) {
  const html = splitDocument(
    createHtmlSession().render(md).html,
    'inline',
  ).blocks.join('')
  const tree = fromHtmlIsomorphic(html, { fragment: true })
  inlineFootnotes(tree)
  const found: Element['properties'][] = []
  visit(tree, 'element', (node) => {
    if (node.tagName === 'sup') found.push({ sup: true })
    if (node.tagName === 'footnote-ref') found.push(node.properties)
  })
  return found
}

describe('inlineFootnotes', () => {
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
