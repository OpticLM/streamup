import type { ReactNode } from 'react'

/**
 * How footnotes render, set with `Streamup`'s `footnotes` prop.
 *
 * - `'section'` (default): GFM — numbered references linking to a trailing
 *   `<section data-footnotes>`.
 * - `'inline'`: every reference renders through `components['footnote-ref']`,
 *   which receives the footnote's content; definitions render nowhere else.
 *   A footnote's content changing re-renders only the references to it.
 */
export type FootnoteMode = 'section' | 'inline'

/** Props of `components['footnote-ref']` in inline footnote mode. */
export interface FootnoteRefProps {
  /**
   * The footnote's number once its definition has arrived, as GFM displays
   * it; until then, the label as written (`note` for `[^note]`).
   */
  label: string
  /**
   * The rendered footnote content: blocks such as `<p>`, so render it where
   * blocks are allowed (e.g. a popover), not inside the reference's paragraph.
   * `undefined` until its definition starts streaming in — or for good, if
   * the document never defines the label.
   */
  children?: ReactNode
}
