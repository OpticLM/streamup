import { createHtmlSession } from '@pierre/words'
import type { ReactNode } from 'react'
import { Fragment, useMemo, useRef, useState } from 'react'
import { CodeBlock } from './code-block.js'
import { FootnoteProvider, FootnoteRef } from './footnote/footnote-ref.js'
import { FOOTNOTE_REF_TAG } from './footnote/inline-footnotes.js'
import {
  holdPendingFootnote,
  isFootnoteSection,
  settleOpenFence,
  splitDocument,
} from './parse/blocks.js'
import { CODE_BLOCK_TAG } from './parse/code-blocks.js'
import { renderBlock } from './parse/render-block.js'
import type { Fading } from './parse/streaming.js'
import { fadeIn, placeCaret, shown } from './parse/streaming.js'
import type {
  PacingConfig,
  StreamupComponents,
  StreamupProps,
} from './types.js'
import type { PacingOptions } from './usePacedStream.js'
import { usePacedStream } from './usePacedStream.js'

const DEFAULT_PACING = {
  tickMs: 33,
  low: 5,
  high: 50,
  slowCps: 15,
  normCps: 30,
  fastCps: 120,
  scaleFast: true,
}

function resolvePacing(
  pacing: PacingConfig | boolean | undefined,
  streaming: boolean,
): PacingOptions {
  if (pacing === false) return { ...DEFAULT_PACING, tickMs: 0, enabled: false }
  if (pacing === true) return { ...DEFAULT_PACING, enabled: true }
  if (pacing === undefined) return { ...DEFAULT_PACING, enabled: streaming }
  const tickMs = pacing.tickMs ?? DEFAULT_PACING.tickMs
  return {
    tickMs,
    low: pacing.low ?? DEFAULT_PACING.low,
    high: pacing.high ?? DEFAULT_PACING.high,
    slowCps: pacing.slowCps ?? DEFAULT_PACING.slowCps,
    normCps: pacing.normCps ?? DEFAULT_PACING.normCps,
    fastCps: pacing.fastCps ?? DEFAULT_PACING.fastCps,
    scaleFast: pacing.scaleFast ?? DEFAULT_PACING.scaleFast,
    enabled: tickMs > 0,
  }
}

export function Streamup({
  children,
  streaming = false,
  pacing,
  components,
  math = true,
  footnotes = 'section',
  animated = false,
  caret,
}: StreamupProps) {
  const markdown = children ?? ''
  const pacingOptions = useMemo(
    () => resolvePacing(pacing, streaming),
    [pacing, streaming],
  )
  const source = usePacedStream(markdown, pacingOptions)
  // More is coming until the stream ends and pacing has revealed all of it.
  const live = streaming || source !== markdown

  // A Words session keeps the completed HTML and reparses only the end.
  const [session] = useState(createHtmlSession)
  const html = useMemo(() => {
    const input =
      live && footnotes === 'inline' ? holdPendingFootnote(source) : source
    const { html } = session.render(input, {
      incomplete: live,
      cjk: true,
      math,
    })
    return settleOpenFence(html, input, live)
  }, [session, source, live, math, footnotes])
  const { blocks, footnotes: definitions } = useMemo(
    () => splitDocument(html, footnotes),
    [html, footnotes],
  )

  const renderComponents = useMemo<StreamupComponents>(
    () => ({
      [CODE_BLOCK_TAG]: CodeBlock,
      ...components,
      ...(footnotes === 'inline' && { [FOOTNOTE_REF_TAG]: FootnoteRef }),
    }),
    [components, footnotes],
  )

  // Streaming effects exist only while more text is coming, so the finished
  // document is the same HTML as without them.
  const fade = animated && live
  const shape = live ? caret : undefined
  // The caret goes into the last block of the body, not the footnote section.
  let caretAt = shape === undefined ? -1 : blocks.length - 1
  while (caretAt >= 0 && isFootnoteSection(blocks[caretAt] ?? '')) caretAt--

  // A block's element depends on its HTML, on `renderComponents` (which also
  // changes with `footnotes`), and on whether text fades. When either of the
  // last two changes, the cache starts over: once the stream ends, every
  // block renders again without its fade spans.
  const cacheRef = useRef({
    components: renderComponents,
    fade,
    map: new Map<string, ReactNode>(),
    fading: new Map<string, Fading>(),
  })
  const rendered = useMemo(() => {
    let onScreen: ReadonlyMap<string, ReactNode> | undefined
    if (
      cacheRef.current.components !== renderComponents ||
      cacheRef.current.fade !== fade
    ) {
      // Text already on screen does not fade in again.
      if (fade) onScreen = cacheRef.current.map
      cacheRef.current = {
        components: renderComponents,
        fade,
        map: new Map(),
        fading: new Map(),
      }
    }
    const { map: cache, fading } = cacheRef.current
    const next = new Map<string, ReactNode>()
    const nextFading = new Map<string, Fading>()
    // `place` names where the block is, which its fade state belongs to.
    const render = (place: string, block: string, withCaret = false) => {
      const id = withCaret ? `\0${block}` : block
      let element = cache.get(id)
      if (element === undefined) {
        element = renderBlock(block, {
          components: renderComponents,
          footnotes,
          decorate: (tree) => {
            if (fade)
              nextFading.set(
                place,
                onScreen?.has(block)
                  ? shown(tree)
                  : fadeIn(tree, fading.get(place)),
              )
            if (withCaret && shape) placeCaret(tree, shape)
          },
        })
      } else {
        const state = fading.get(place)
        if (state) nextFading.set(place, state)
      }
      next.set(id, element)
      return element
    }
    // Footnote contents share the cache, so an unchanged definition renders
    // to the very same element and the store sees no change.
    const result = {
      blocks: blocks.map((block, i) => render(`${i}`, block, i === caretAt)),
      footnotes: new Map(
        Array.from(definitions, ([footnote, content]) => [
          footnote,
          render(`fn-${footnote}`, content),
        ]),
      ),
    }
    cacheRef.current.map = next
    cacheRef.current.fading = nextFading
    return result
  }, [blocks, definitions, renderComponents, footnotes, fade, shape, caretAt])

  const body = rendered.blocks.map((element, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: blocks are positional during streaming
    <Fragment key={i}>{element}</Fragment>
  ))
  if (footnotes === 'section') return <>{body}</>
  return (
    <FootnoteProvider
      footnotes={rendered.footnotes}
      component={components?.[FOOTNOTE_REF_TAG]}
    >
      {body}
    </FootnoteProvider>
  )
}
