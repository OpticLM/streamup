import type { Element } from 'hast'
import type * as React from 'react'
import type { ComponentType } from 'react'
import type { PluggableList } from 'unified'
import type { CodeBlockProps } from './code-block/types.js'

export interface StreamupPlugin {
  remarkPlugins?: PluggableList
  rehypePlugins?: PluggableList
}

/**
 * Map hast tag names to React components, passed to `Streamup` as `components`.
 *
 * Native HTML/SVG tag names get their usual JSX props plus an optional hast
 * `node` (because `passNode` is on). Custom element names — e.g. the
 * `'code-block'` produced by `rehypeCodeBlocks()` — are mapped here too, so a
 * fenced code block can render with a clean `{ language, code }` contract
 * instead of digging through the hast node.
 */
// An open tagName→component map must accept components with arbitrary prop
// shapes, so the index signature uses `any` while the named keys stay typed.
// biome-ignore lint/suspicious/noExplicitAny: required for an open component map (contravariance — narrower types break assignability of the specific keys)
type AnyComponent = ComponentType<any>

export type StreamupComponents = {
  [TagName in keyof React.JSX.IntrinsicElements]?:
    | ComponentType<React.JSX.IntrinsicElements[TagName] & { node?: Element }>
    | keyof React.JSX.IntrinsicElements
} & {
  'code-block'?: ComponentType<CodeBlockProps>
  [tagName: string]:
    | AnyComponent
    | keyof React.JSX.IntrinsicElements
    | undefined
}

export interface StreamupProps {
  children?: string
  streaming?: boolean
  throttleMs?: number
  components?: StreamupComponents
  plugins?: StreamupPlugin[]
  singleDollarTextMath?: boolean
}
