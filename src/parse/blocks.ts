import { Lexer } from 'marked'

const footnoteReferencePattern = /\[\^[\w-]{1,200}\](?!:)/
const footnoteDefinitionPattern = /\[\^[\w-]{1,200}\]:/
const openingTagPattern = /<(\w+)[\s>]/

const voidElements = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const openTagPatternCache = new Map<string, RegExp>()
const closeTagPatternCache = new Map<string, RegExp>()

const getOpenTagPattern = (tagName: string): RegExp => {
  const key = tagName.toLowerCase()
  let pattern = openTagPatternCache.get(key)
  if (!pattern) {
    pattern = new RegExp(`<${key}(?=[\\s>/])[^>]*>`, 'gi')
    openTagPatternCache.set(key, pattern)
  }
  return pattern
}

const getCloseTagPattern = (tagName: string): RegExp => {
  const key = tagName.toLowerCase()
  let pattern = closeTagPatternCache.get(key)
  if (!pattern) {
    pattern = new RegExp(`</${key}(?=[\\s>])[^>]*>`, 'gi')
    closeTagPatternCache.set(key, pattern)
  }
  return pattern
}

const countNonSelfClosingOpenTags = (
  block: string,
  tagName: string,
): number => {
  if (voidElements.has(tagName.toLowerCase())) return 0
  const matches = block.match(getOpenTagPattern(tagName))
  if (!matches) return 0
  let count = 0
  for (const match of matches) {
    if (!match.trimEnd().endsWith('/>')) count += 1
  }
  return count
}

const countClosingTags = (block: string, tagName: string): number => {
  const matches = block.match(getCloseTagPattern(tagName))
  return matches ? matches.length : 0
}

const countDoubleDollars = (str: string): number => {
  let count = 0
  for (let i = 0; i < str.length - 1; i += 1) {
    if (str[i] === '$' && str[i + 1] === '$') {
      count += 1
      i += 1
    }
  }
  return count
}

export const parseMarkdownIntoBlocks = (markdown: string): string[] => {
  const hasFootnoteReference = footnoteReferencePattern.test(markdown)
  const hasFootnoteDefinition = footnoteDefinitionPattern.test(markdown)

  if (hasFootnoteReference || hasFootnoteDefinition) {
    return [markdown]
  }

  const tokens = Lexer.lex(markdown, { gfm: true })
  const mergedBlocks: string[] = []
  const htmlStack: string[] = []
  let previousTokenWasCode = false

  for (const token of tokens) {
    const currentBlock = token.raw
    const len = mergedBlocks.length

    if (htmlStack.length > 0) {
      mergedBlocks[len - 1] += currentBlock
      const trackedTag = htmlStack.at(-1) as string
      const newOpen = countNonSelfClosingOpenTags(currentBlock, trackedTag)
      const newClose = countClosingTags(currentBlock, trackedTag)
      for (let i = 0; i < newOpen; i += 1) htmlStack.push(trackedTag)
      for (let i = 0; i < newClose; i += 1) {
        if (htmlStack.length > 0 && htmlStack.at(-1) === trackedTag)
          htmlStack.pop()
      }
      continue
    }

    if (token.type === 'html' && 'block' in token && token.block) {
      const openMatch = currentBlock.match(openingTagPattern)
      if (openMatch?.[1]) {
        const tagName = openMatch[1]
        const openTags = countNonSelfClosingOpenTags(currentBlock, tagName)
        const closeTags = countClosingTags(currentBlock, tagName)
        if (openTags > closeTags) htmlStack.push(tagName)
      }
    }

    if (len > 0 && !previousTokenWasCode) {
      const previousBlock = mergedBlocks[len - 1]
      if (previousBlock !== undefined) {
        const prevDollarCount = countDoubleDollars(previousBlock)
        if (prevDollarCount % 2 === 1) {
          mergedBlocks[len - 1] = previousBlock + currentBlock
          continue
        }
      }
    }

    mergedBlocks.push(currentBlock)

    if (token.type !== 'space') {
      previousTokenWasCode = token.type === 'code'
    }
  }

  return mergedBlocks
}
