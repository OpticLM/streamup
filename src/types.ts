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

export interface PacingConfig {
  /** Consumer tick interval in ms. Default 33 (~30fps). `<= 0` disables pacing (synchronous passthrough). */
  tickMs?: number
  /** Buffer size (code points) below which the consumer slows to mask stalls. Default 5. */
  low?: number
  /** Buffer size (code points) at/above which the consumer speeds up to drain bursts. Default 50. */
  high?: number
  /** Reveal rate (code points/sec) when buffer < `low`. Default 15 (≈ 1 char / 2 ticks at 30fps). */
  slowCps?: number
  /** Reveal rate (code points/sec) when `low` <= buffer < `high`. Default 30 (≈ 1 cp/tick). */
  normCps?: number
  /** Base reveal rate (code points/sec) when buffer >= `high`. Default 120 (≈ 4 cp/tick). */
  fastCps?: number
  /** Scale `fastCps` up with `buffer / high` (capped at 10x) so large bursts drain in bounded time. Default true. */
  scaleFast?: boolean
}

export interface StreamupProps {
  children?: string
  streaming?: boolean
  /**
   * Adaptive typewriter pacing. `false` (or `tickMs <= 0`) disables it (synchronous
   * passthrough). `undefined` enables it with defaults when `streaming` is on, and
   * disables it when `streaming` is off. An object tunes the leaky bucket.
   */
  pacing?: PacingConfig | boolean
  components?: StreamupComponents
  plugins?: StreamupPlugin[]
  singleDollarTextMath?: boolean
}
