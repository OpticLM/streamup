import type { Element, Parents } from 'hast'
import type { Schema } from 'hast-util-sanitize'
import type { ComponentType, JSX } from 'react'
import type { PluggableList } from 'unified'

export interface ExtraProps {
  node?: Element | undefined
}

export type Components = {
  [Key in keyof JSX.IntrinsicElements]?:
    | ComponentType<JSX.IntrinsicElements[Key] & ExtraProps>
    | keyof JSX.IntrinsicElements
} & {
  inlineCode?: ComponentType<JSX.IntrinsicElements['code'] & ExtraProps>
  [key: string]:
    | ComponentType<Record<string, unknown> & ExtraProps>
    | keyof JSX.IntrinsicElements
    | undefined
}

export interface StreamupPlugin {
  remarkPlugins?: PluggableList
  rehypePlugins?: PluggableList
}

export interface StreamupProps {
  children?: string
  streaming?: boolean
  components?: Partial<Components>
  plugins?: StreamupPlugin[]
  className?: string
  /** Enable `$...$` inline math syntax (default: false, only `$$...$$` block math) */
  singleDollarTextMath?: boolean
  /** Custom sanitization schema. Replaces the default — spread `defaultSanitizeSchema` to extend. */
  sanitizeSchema?: Schema
  /** Transform or remove URLs before rendering. Return null to remove the URL. */
  urlTransform?: UrlTransform
  /** Filter elements. Return false to remove the element (replaced by its children). */
  allowElement?: AllowElement
}

export type AllowElement = (
  element: Readonly<Element>,
  index: number,
  parent: Readonly<Parents> | undefined,
) => boolean | null | undefined

export type UrlTransform = (
  url: string,
  key: string,
  node: Readonly<Element>,
) => string | null | undefined

export type { Schema as SanitizeSchema } from 'hast-util-sanitize'
