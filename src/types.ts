import type { Element } from 'hast'
import type * as React from 'react'
import type { ComponentType } from 'react'
import type { CodeBlockProps } from './code-block.js'
import type { FootnoteMode, FootnoteRefProps } from './footnote/types.js'
import type { CaretShape } from './parse/streaming.js'

export type { CaretShape }

/**
 * Map tag names to React components, passed to `Streamup` as `components`.
 *
 * Native HTML/SVG tag names get their usual JSX props plus the hast `node`.
 * Two more names stand for Streamup's own elements: `'code-block'`, which
 * every fenced code block renders through (default `CodeBlock`), and
 * `'footnote-ref'` in inline footnote mode.
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
  'footnote-ref'?: ComponentType<FootnoteRefProps>
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
  /** Render TeX between dollar signs, and `math` fences, as SVG. Default `true`. */
  math?: boolean
  /**
   * `'section'` (default) renders GFM footnotes. `'inline'` renders each
   * reference through `components['footnote-ref']` with its footnote's
   * content, keeping the body's blocks independent of the footnote section.
   */
  footnotes?: FootnoteMode
  /**
   * Fade in new text while streaming, as Words does: each arrival is wrapped
   * in `<span data-markdown="token">` until the stream ends. Code blocks do
   * not fade. Needs `@opticlm/streamup/styles.css`. Default `false`.
   */
  animated?: boolean
  /**
   * Show a caret where text arrives while streaming: a zero-width
   * `<span data-markdown="caret" data-shape>` whose glyph comes from
   * `@opticlm/streamup/styles.css`. Off by default.
   */
  caret?: CaretShape
}
