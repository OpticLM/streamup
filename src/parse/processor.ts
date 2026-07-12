import type { Element, Root } from 'hast'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkCjkFriendly from 'remark-cjk-friendly'
import remarkCjkFriendlyGfmStrikethrough from 'remark-cjk-friendly-gfm-strikethrough'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import type { PluggableList } from 'unified'
import { unified } from 'unified'
import type { StreamupComponents } from '../types.js'
import { remarkCjkAutolinkBoundary } from './remark-cjk-autolink-boundary.js'

const sanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), 'tel'],
  },
}

export interface ProcessorOptions {
  extraRemarkPlugins?: PluggableList
  extraRehypePlugins?: PluggableList
  singleDollarTextMath?: boolean
}

export function createProcessor(options: ProcessorOptions = {}) {
  return unified()
    .use(remarkParse)
    .use(remarkCjkFriendly)
    .use(remarkGfm)
    .use(remarkCjkAutolinkBoundary)
    .use(remarkCjkFriendlyGfmStrikethrough)
    .use(remarkMath, {
      singleDollarTextMath: options.singleDollarTextMath ?? false,
    })
    .use(options.extraRemarkPlugins ?? [])
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, sanitizeSchema)
    .use(options.extraRehypePlugins ?? [])
}

export type MdProcessor = ReturnType<typeof createProcessor>

export function extractLanguage(className: unknown): string {
  const classes = Array.isArray(className)
    ? className
    : className
      ? [className]
      : []
  for (const c of classes) {
    if (typeof c === 'string' && c.startsWith('language-'))
      return c.slice('language-'.length)
  }
  return ''
}

export function findCode(pre: Element): Element | undefined {
  return pre.children.find(
    (c): c is Element => c.type === 'element' && c.tagName === 'code',
  )
}

export function textOf(node: Element): string {
  return (node.children ?? [])
    .map((c) => (c.type === 'text' ? c.value : ''))
    .join('')
}

export function renderBlock(
  block: string,
  {
    processor,
    components,
  }: { processor: MdProcessor; components?: StreamupComponents },
) {
  const tree = processor.runSync(processor.parse(block), block) as Root
  return toJsxRuntime(tree, {
    Fragment,
    components,
    ignoreInvalidStyle: true,
    jsx,
    jsxs,
    passKeys: true,
    passNode: true,
  })
}
