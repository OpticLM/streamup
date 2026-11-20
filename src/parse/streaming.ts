import type { Element, ElementContent, Root, RootContent, Text } from 'hast'
import { CODE_BLOCK_TAG } from './code-blocks.js'

/** The shape of the caret `Streamup` shows where text arrives. */
export type CaretShape = 'block' | 'circle'

/** What a block showed last render, and where each later arrival starts. */
export interface Fading {
  /** The block's fading text, in document order. */
  text: string
  /** Offsets in `text` where each fading arrival starts, ascending. */
  starts: number[]
}

type Parent = Root | Element

/** Drawings, whose text is never cut into spans. */
const STILL = new Set(['svg'])

/** Text that can fade: anything but whitespace, which shows nothing. */
const fades = (node: RootContent): node is Text =>
  node.type === 'text' && node.value.trim() !== ''

/** The last child that shows something: an element or visible text. */
function lastShown(parent: Parent): RootContent | undefined {
  for (let i = parent.children.length - 1; i >= 0; i--) {
    const child = parent.children[i]
    if (child && (child.type === 'element' || fades(child))) return child
  }
  return undefined
}

function textOf(parent: Parent): string {
  let text = ''
  for (const child of parent.children) {
    if (fades(child)) text += child.value
    else if (child.type === 'element' && !STILL.has(child.tagName))
      text += textOf(child)
  }
  return text
}

const token = (value: string): Element => ({
  type: 'element',
  tagName: 'span',
  properties: { dataMarkdown: 'token' },
  children: [{ type: 'text', value }],
})

/** Wrap each arrival's text in its own `<span data-markdown="token">`. */
function wrap(
  parent: Parent,
  starts: readonly number[],
  at: { offset: number },
) {
  const first = starts[0] ?? Number.POSITIVE_INFINITY
  const children: RootContent[] = []
  for (const child of parent.children) {
    if (!fades(child)) {
      if (child.type === 'element' && !STILL.has(child.tagName))
        wrap(child, starts, at)
      children.push(child)
      continue
    }
    const start = at.offset
    const end = start + child.value.length
    at.offset = end
    if (end <= first) {
      children.push(child)
      continue
    }
    // Cut the node where an arrival starts; what comes before the first stays text.
    let from = start
    for (const to of [...starts.filter((s) => s > start && s < end), end]) {
      const value = child.value.slice(from - start, to - start)
      children.push(from < first ? { type: 'text', value } : token(value))
      from = to
    }
  }
  parent.children = children as ElementContent[]
}

/**
 * Fade in the text a block gained since `previous`. Unchanged text keeps
 * its spans, so a fade already running goes on; text after the first change
 * since last render is a new arrival. Returns the block's new state.
 */
export function fadeIn(tree: Root, previous: Fading | undefined): Fading {
  const text = textOf(tree)
  const before = previous?.text ?? ''
  let same = 0
  const max = Math.min(before.length, text.length)
  while (same < max && before.charCodeAt(same) === text.charCodeAt(same)) same++
  const starts = (previous?.starts ?? []).filter((s) => s < same)
  if (same < text.length) starts.push(same)
  if (starts.length > 0) wrap(tree, starts, { offset: 0 })
  return { text, starts }
}

/** The state of a block already on screen, whose text does not fade. */
export const shown = (tree: Root): Fading => ({
  text: textOf(tree),
  starts: [],
})

/** Elements the caret goes into, to reach the end of the text. */
const BLOCKS = new Set([
  'blockquote',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'ol',
  'p',
  'section',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
])

/**
 * Put a `<span data-markdown="caret">` at the end of the text, where Words
 * puts its own: inside the deepest last block. A code block gets it as its
 * `children`, to show at the end of the code.
 */
export function placeCaret(tree: Root, shape: CaretShape): void {
  let parent: Parent = tree
  for (;;) {
    const last = lastShown(parent)
    if (last?.type !== 'element') break
    if (last.tagName !== CODE_BLOCK_TAG && !BLOCKS.has(last.tagName)) break
    parent = last
    if (last.tagName === CODE_BLOCK_TAG) break
  }
  parent.children.push({
    type: 'element',
    tagName: 'span',
    properties: { dataMarkdown: 'caret', dataShape: shape, ariaHidden: 'true' },
    children: [],
  })
}
