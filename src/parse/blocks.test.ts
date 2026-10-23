import { describe, expect, it } from 'vitest'
import { splitBlocks } from './blocks.js'
import { createProcessor } from './processor.js'

const processor = createProcessor({})
const split = (md: string, live = false) =>
  splitBlocks(md, processor, { live }).blocks

describe('splitBlocks', () => {
  it('splits paragraphs into separate blocks', () => {
    const blocks = split('Hello\n\nWorld')
    const nonEmpty = blocks.filter((b) => b.trim().length > 0)
    expect(nonEmpty.length).toBe(2)
  })

  it('keeps code blocks as a single block', () => {
    const md = '```js\nconst x = 1\nconst y = 2\n```'
    const blocks = split(md)
    expect(blocks.length).toBe(1)
    expect(blocks[0]).toContain('const x = 1')
  })

  it('splits HTML blocks at blank lines (standard CommonMark)', () => {
    const md = '<div>\n\ninner content\n\n</div>'
    const blocks = split(md)
    // remark ends an HTML block at a blank line; the old marked-based splitter
    // non-standardly merged this into one block. Standard behavior is to split.
    expect(blocks.length).toBeGreaterThan(1)
    expect(blocks.join('\n')).toContain('inner content')
  })

  it('keeps math blocks with an unclosed $$ as a single block', () => {
    const md = '$$\nx = 1\n\ny = 2\n$$'
    const blocks = split(md)
    expect(blocks.length).toBe(1)
  })

  it('does not merge $$ inside code blocks', () => {
    const md = '```\n$$\n```\n\nsome text'
    const blocks = split(md)
    expect(blocks.length).toBeGreaterThan(1)
  })

  it('returns a single block when footnotes are present', () => {
    const md = 'Hello[^1]\n\n[^1]: footnote'
    const blocks = split(md)
    expect(blocks.length).toBe(1)
  })

  it('handles empty input', () => {
    const blocks = split('')
    expect(blocks.length).toBe(0)
  })

  it('heals the trailing block in streaming mode', () => {
    const blocks = split('# Heading\n\nfirst para\n\n**bo', true)
    expect(blocks[blocks.length - 1]).toContain('**bo**')
  })

  it('does not heal in non-streaming mode', () => {
    const blocks = split('# Heading\n\nfirst para\n\n**bo')
    expect(blocks[blocks.length - 1]).not.toContain('**bo**')
  })
})

describe('splitBlocks with inline footnotes', () => {
  const inline = createProcessor({ footnotes: 'inline' })
  const split = (md: string, live = false) =>
    splitBlocks(md, inline, { live, footnotes: 'inline' })

  it('keeps blocks split and lifts definitions out of the body', () => {
    const { blocks, footnotes } = split(
      'Alpha[^1].\n\nBeta[^b].\n\n[^1]: One.\n\n[^b]: Two.',
    )
    expect(blocks).toEqual(['Alpha[^1].', 'Beta[^b].'])
    expect(footnotes.settled).toEqual(
      new Map([
        ['1', 'One.'],
        ['b', 'Two.'],
      ]),
    )
    expect(footnotes.open).toBeUndefined()
  })

  it('keys definitions by identifier', () => {
    const { footnotes } = split('A[^Note].\n\n[^Note]: Def.')
    expect([...footnotes.settled.keys()]).toEqual(['note'])
  })

  it('keeps the trailing definition open while live', () => {
    const { footnotes } = split('A[^1][^2].\n\n[^1]: One.\n\n[^2]: Tw', true)
    expect(footnotes.settled).toEqual(new Map([['1', 'One.']]))
    expect(footnotes.open).toBe('2')
  })

  it('settles a definition once body content follows it', () => {
    const { blocks, footnotes } = split('[^1]: One.\n\nMore body', true)
    expect(footnotes.settled.get('1')).toBe('One.')
    expect(blocks).toEqual(['More body'])
  })

  it('settles every definition once the stream ends', () => {
    const { footnotes } = split('A[^1].\n\n[^1]: One.')
    expect(footnotes.settled.get('1')).toBe('One.')
    expect(footnotes.open).toBeUndefined()
  })

  it('keeps the first of duplicate definitions', () => {
    const { footnotes } = split('[^1]: First.\n\n[^1]: Second.', true)
    expect(footnotes.settled.get('1')).toBe('First.')
    expect(footnotes.open).toBeUndefined()
  })

  it('strips the continuation indent from multi-block definitions', () => {
    const { footnotes } = split(
      '[^1]: First para.\n\n    Second para.\n\n    - item\n      cont\n\nAfter',
    )
    expect(footnotes.settled.get('1')).toBe(
      'First para.\n\nSecond para.\n\n- item\n  cont',
    )
  })

  it('reads a definition that starts on the next line', () => {
    const { footnotes } = split('[^1]:\n    Next line.')
    expect(footnotes.settled.get('1')).toBe('Next line.')
  })

  it('reads an empty definition as empty content', () => {
    expect(split('[^1]:').footnotes.settled.get('1')).toBe('')
  })

  it('does not heal a complete body block followed by a definition', () => {
    const { blocks } = split('Literal ** stars.\n\n[^1]: Op', true)
    expect(blocks).toEqual(['Literal ** stars.'])
  })

  it.each(['[', '[^', '[^2', '[^2]'])(
    'holds back the opening of a definition (%s) while live',
    (opening) => {
      const { blocks } = split(`A[^1].\n\n[^1]: One.\n\n${opening}`, true)
      expect(blocks).toEqual(['A[^1].'])
    },
  )

  it('holds back an unclosed reference instead of healing it into a link', () => {
    const { blocks } = split('Claim[^1', true)
    expect(blocks).toEqual(['Claim'])
  })

  it('leaves an unclosed reference inside code alone', () => {
    const { blocks } = split('```\n/[^a-z', true)
    expect(blocks[0]).toContain('/[^a-z')
  })

  it('renders a pending opening once the stream ends', () => {
    expect(split('Body\n\n[^2]').blocks).toEqual(['Body', '[^2]'])
  })
})
