import { createHtmlSession } from '@pierre/words'
import type { ReactNode } from 'react'
import { Fragment, useMemo, useRef, useState } from 'react'
import { CodeBlock } from './code-block.js'
import { FootnoteProvider, FootnoteRef } from './footnote/footnote-ref.js'
import { FOOTNOTE_REF_TAG } from './footnote/inline-footnotes.js'
import {
  holdPendingFootnote,
  settleOpenFence,
  splitDocument,
} from './parse/blocks.js'
import { CODE_BLOCK_TAG } from './parse/code-blocks.js'
import { renderBlock } from './parse/render-block.js'
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

  // A block's element depends on its HTML and `renderComponents` alone, which
  // also changes with `footnotes`: one identity check guards the cache.
  const cacheRef = useRef({
    components: renderComponents,
    map: new Map<string, ReactNode>(),
  })
  const rendered = useMemo(() => {
    if (cacheRef.current.components !== renderComponents) {
      cacheRef.current = {
        components: renderComponents,
        map: new Map<string, ReactNode>(),
      }
    }
    const cache = cacheRef.current.map
    const next = new Map<string, ReactNode>()
    const render = (block: string) => {
      const element =
        cache.get(block) ??
        renderBlock(block, { components: renderComponents, footnotes })
      next.set(block, element)
      return element
    }
    // Footnote contents share the cache, so an unchanged definition renders
    // to the very same element and the store sees no change.
    const result = {
      blocks: blocks.map(render),
      footnotes: new Map(
        Array.from(definitions, ([footnote, content]) => [
          footnote,
          render(content),
        ]),
      ),
    }
    cacheRef.current.map = next
    return result
  }, [blocks, definitions, renderComponents, footnotes])

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
