import type { ReactNode } from 'react'

/**
 * How footnotes render, set with `Streamup`'s `footnotes` prop.
 *
 * - `'section'` (default): GFM — numbered references linking to a trailing
 *   `<section data-footnotes>`. Once a footnote appears, the whole document
 *   renders as a single block.
 * - `'inline'`: every reference renders through `components['footnote-ref']`,
 *   which receives the footnote's content; definitions render nowhere else.
 *   Body blocks stay independent of the definitions, so streaming the footnote
 *   section re-renders only the references whose footnote changed.
 */
export type FootnoteMode = 'section' | 'inline'

/** Props of `components['footnote-ref']` in inline footnote mode. */
export interface FootnoteRefProps {
  /** The label as written in the reference, e.g. `note` for `[^note]`. */
  label: string
  /**
   * The rendered footnote content: blocks such as `<p>`, so render it where
   * blocks are allowed (e.g. a popover), not inside the reference's paragraph.
   * `undefined` until its definition has fully streamed in — or for good, if
   * the document never defines the label.
   */
  children?: ReactNode
}

/** A document's root-level footnote definitions, keyed by identifier. */
export interface Footnotes<Content> {
  /** Definitions the stream has moved past: appending can't change them. */
  settled: ReadonlyMap<string, Content>
  /** Identifier of the trailing definition the stream is still writing. */
  open?: string
}
