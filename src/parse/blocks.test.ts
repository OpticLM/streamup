import { describe, expect, it } from 'vitest'
import { splitBlocks } from './blocks.js'
import { createProcessor } from './processor.js'

const processor = createProcessor({})

describe('splitBlocks', () => {
  it('splits paragraphs into separate blocks', () => {
    const blocks = splitBlocks('Hello\n\nWorld', processor, false)
    const nonEmpty = blocks.filter((b) => b.trim().length > 0)
    expect(nonEmpty.length).toBe(2)
  })

  it('keeps code blocks as a single block', () => {
    const md = '```js\nconst x = 1\nconst y = 2\n```'
    const blocks = splitBlocks(md, processor, false)
    expect(blocks.length).toBe(1)
    expect(blocks[0]).toContain('const x = 1')
  })

  it('splits HTML blocks at blank lines (standard CommonMark)', () => {
    const md = '<div>\n\ninner content\n\n</div>'
    const blocks = splitBlocks(md, processor, false)
    // remark ends an HTML block at a blank line; the old marked-based splitter
    // non-standardly merged this into one block. Standard behavior is to split.
    expect(blocks.length).toBeGreaterThan(1)
    expect(blocks.join('\n')).toContain('inner content')
  })

  it('keeps math blocks with an unclosed $$ as a single block', () => {
    const md = '$$\nx = 1\n\ny = 2\n$$'
    const blocks = splitBlocks(md, processor, false)
    expect(blocks.length).toBe(1)
  })

  it('does not merge $$ inside code blocks', () => {
    const md = '```\n$$\n```\n\nsome text'
    const blocks = splitBlocks(md, processor, false)
    expect(blocks.length).toBeGreaterThan(1)
  })

  it('returns a single block when footnotes are present', () => {
    const md = 'Hello[^1]\n\n[^1]: footnote'
    const blocks = splitBlocks(md, processor, false)
    expect(blocks.length).toBe(1)
  })

  it('handles empty input', () => {
    const blocks = splitBlocks('', processor, false)
    expect(blocks.length).toBe(0)
  })

  it('heals the trailing block in streaming mode', () => {
    const blocks = splitBlocks(
      '# Heading\n\nfirst para\n\n**bo',
      processor,
      true,
    )
    expect(blocks[blocks.length - 1]).toContain('**bo**')
  })

  it('does not heal in non-streaming mode', () => {
    const blocks = splitBlocks(
      '# Heading\n\nfirst para\n\n**bo',
      processor,
      false,
    )
    expect(blocks[blocks.length - 1]).not.toContain('**bo**')
  })
})
