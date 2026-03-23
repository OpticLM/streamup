import { describe, expect, it } from 'vitest'
import { parseMarkdownIntoBlocks } from './blocks.js'

describe('parseMarkdownIntoBlocks', () => {
  it('splits paragraphs into separate blocks', () => {
    const blocks = parseMarkdownIntoBlocks('Hello\n\nWorld')
    // Marked lexer may emit a trailing space token
    const nonEmpty = blocks.filter((b) => b.trim().length > 0)
    expect(nonEmpty.length).toBe(2)
  })

  it('keeps code blocks as a single block', () => {
    const md = '```js\nconst x = 1\nconst y = 2\n```'
    const blocks = parseMarkdownIntoBlocks(md)
    expect(blocks.length).toBe(1)
    expect(blocks[0]).toContain('const x = 1')
  })

  it('merges HTML blocks with unclosed tags', () => {
    const md = '<div>\n\ninner content\n\n</div>'
    const blocks = parseMarkdownIntoBlocks(md)
    expect(blocks.length).toBe(1)
    expect(blocks[0]).toContain('inner content')
  })

  it('merges math blocks with unclosed $$', () => {
    const md = '$$\nx = 1\n\ny = 2\n$$'
    const blocks = parseMarkdownIntoBlocks(md)
    expect(blocks.length).toBe(1)
  })

  it('does not merge $$ inside code blocks', () => {
    const md = '```\n$$\n```\n\nsome text'
    const blocks = parseMarkdownIntoBlocks(md)
    expect(blocks.length).toBeGreaterThan(1)
  })

  it('returns single block when footnotes are present', () => {
    const md = 'Hello[^1]\n\n[^1]: footnote'
    const blocks = parseMarkdownIntoBlocks(md)
    expect(blocks.length).toBe(1)
  })

  it('handles empty input', () => {
    const blocks = parseMarkdownIntoBlocks('')
    expect(blocks.length).toBe(0)
  })
})
