import type { Element, ElementContent, Nodes, Root } from 'hast'
import type { Schema } from 'hast-util-sanitize'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { urlAttributes } from 'html-url-attributes'
import type { ReactElement } from 'react'
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
import type { AllowElement, Components, UrlTransform } from '../types.js'
import { remarkCjkAutolinkBoundary } from './remark-cjk-autolink-boundary.js'
import { remarkCodeMeta } from './remark-code-meta.js'

export const defaultSanitizeSchema: Schema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), 'tel'],
  },
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...((defaultSchema.attributes?.code as string[]) ?? []),
      'metastring',
    ],
  },
}

export interface ProcessorOptions {
  extraRemarkPlugins?: PluggableList
  extraRehypePlugins?: PluggableList
  singleDollarTextMath?: boolean
  sanitizeSchema?: Schema
}

// Unified's Processor type mutates at every .use() call, making it
// impossible to express the final type without `any`. Streamdown does
// the same — this is a known limitation of unified's generics.
// biome-ignore lint/suspicious/noExplicitAny: unified processor type limitation
const processorCache = new Map<string, any>()

const serializePlugins = (plugins: PluggableList): string => {
  if (plugins.length === 0) return ''
  return plugins
    .map((p) => {
      if (Array.isArray(p)) {
        const fn = p[0]
        return `${typeof fn === 'function' ? fn.name : String(fn)}:${JSON.stringify(p[1])}`
      }
      return typeof p === 'function' ? p.name : String(p)
    })
    .join(',')
}

const serializeOptions = (options: ProcessorOptions): string => {
  const parts: string[] = []
  parts.push(`r:${serializePlugins(options.extraRemarkPlugins ?? [])}`)
  parts.push(`h:${serializePlugins(options.extraRehypePlugins ?? [])}`)
  if (options.singleDollarTextMath) parts.push('math:1')
  if (options.sanitizeSchema)
    parts.push(`s:${JSON.stringify(options.sanitizeSchema)}`)
  return parts.join('|')
}

const createProcessor = (options: ProcessorOptions) =>
  unified()
    .use(remarkParse)
    .use(remarkCjkFriendly)
    .use(remarkGfm)
    .use(remarkCodeMeta)
    .use(remarkCjkAutolinkBoundary)
    .use(remarkCjkFriendlyGfmStrikethrough)
    .use(remarkMath, {
      singleDollarTextMath: options.singleDollarTextMath ?? false,
    })
    .use(options.extraRemarkPlugins ?? [])
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, options.sanitizeSchema ?? defaultSanitizeSchema)
    .use(options.extraRehypePlugins ?? [])

const getProcessor = (options: ProcessorOptions) => {
  const key = serializeOptions(options)
  const cached = processorCache.get(key)
  if (cached) return cached

  const processor = createProcessor(options)
  processorCache.set(key, processor)
  return processor
}

/** Walk the HAST tree and transform URL attributes. */
function applyUrlTransform(tree: Root, transform: UrlTransform): void {
  const visit = (node: Nodes) => {
    if (node.type === 'element') {
      const element = node as Element
      const properties = element.properties
      if (properties) {
        for (const key of Object.keys(properties)) {
          const tags = urlAttributes[key]
          if (tags === undefined) continue
          if (tags !== null && !tags.includes(element.tagName)) continue
          const value = properties[key]
          if (typeof value === 'string') {
            const result = transform(value, key, element)
            if (result === null || result === undefined) {
              delete properties[key]
            } else {
              properties[key] = result
            }
          }
        }
      }
      for (const child of element.children) {
        visit(child)
      }
    }
    if (node.type === 'root') {
      for (const child of (node as Root).children) {
        visit(child)
      }
    }
  }
  visit(tree)
}

/** Walk the HAST tree and filter elements. Elements returning false are replaced by their children. */
function applyAllowElement(tree: Root, allow: AllowElement): void {
  const filter = (
    children: ElementContent[],
    parent: Element | Root,
  ): ElementContent[] => {
    const result: ElementContent[] = []
    for (const [i, child] of children.entries()) {
      if (child.type === 'element') {
        child.children = filter(child.children, child)
        const allowed = allow(child, i, parent as Element)
        if (allowed === false) {
          result.push(...child.children)
        } else {
          result.push(child)
        }
      } else {
        result.push(child)
      }
    }
    return result
  }
  tree.children = filter(tree.children as ElementContent[], tree)
}

export interface ProcessMarkdownOptions {
  components?: Components
  processorOptions?: ProcessorOptions
  urlTransform?: UrlTransform
  allowElement?: AllowElement
}

export function processMarkdown(
  content: string,
  options?: ProcessMarkdownOptions,
): ReactElement {
  const processor = getProcessor(options?.processorOptions ?? {})
  const tree = processor.runSync(processor.parse(content), content) as Root

  if (options?.urlTransform) {
    applyUrlTransform(tree, options.urlTransform)
  }

  if (options?.allowElement) {
    applyAllowElement(tree, options.allowElement)
  }

  return toJsxRuntime(tree, {
    Fragment,
    components: options?.components,
    ignoreInvalidStyle: true,
    jsx,
    jsxs,
    passKeys: true,
    passNode: true,
  })
}
