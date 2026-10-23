import type { ReactNode } from 'react'
import { Fragment, useMemo, useRef } from 'react'
import type { PluggableList } from 'unified'
import { FootnoteProvider, FootnoteRef } from './footnote/footnote-ref.js'
import { FOOTNOTE_REF_TAG } from './footnote/rehype-inline-footnotes.js'
import type { Footnotes } from './footnote/types.js'
import { splitBlocks } from './parse/blocks.js'
import type { MdProcessor } from './parse/processor.js'
import { createProcessor, renderBlock } from './parse/processor.js'
import type { PacingConfig, StreamupProps } from './types.js'
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
  plugins,
  singleDollarTextMath,
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

  const extraRemarkPlugins = useMemo<PluggableList>(
    () => (plugins ?? []).flatMap((p) => p.remarkPlugins ?? []),
    [plugins],
  )
  const extraRehypePlugins = useMemo<PluggableList>(
    () => (plugins ?? []).flatMap((p) => p.rehypePlugins ?? []),
    [plugins],
  )

  const processor = useMemo<MdProcessor>(
    () =>
      createProcessor({
        extraRemarkPlugins,
        extraRehypePlugins,
        singleDollarTextMath,
        footnotes,
      }),
    [extraRemarkPlugins, extraRehypePlugins, singleDollarTextMath, footnotes],
  )

  const { blocks, footnotes: definitions } = useMemo(
    () => splitBlocks(source, processor, { live, footnotes }),
    [source, processor, live, footnotes],
  )

  const renderComponents = useMemo(
    () =>
      footnotes === 'inline'
        ? { ...components, [FOOTNOTE_REF_TAG]: FootnoteRef }
        : components,
    [components, footnotes],
  )

  const cacheRef = useRef({
    processor,
    components: renderComponents,
    map: new Map<string, ReactNode>(),
  })
  const rendered = useMemo(() => {
    if (
      cacheRef.current.processor !== processor ||
      cacheRef.current.components !== renderComponents
    ) {
      cacheRef.current = {
        processor,
        components: renderComponents,
        map: new Map<string, ReactNode>(),
      }
    }
    const cache = cacheRef.current.map
    const next = new Map<string, ReactNode>()
    const render = (md: string) => {
      const element =
        cache.get(md) ??
        renderBlock(md, { processor, components: renderComponents })
      next.set(md, element)
      return element
    }
    // Footnote contents share the cache, so an unchanged definition renders
    // to the very same element and the store sees no change.
    const result = {
      blocks: blocks.map(render),
      footnotes: {
        settled: new Map(
          Array.from(definitions.settled, ([id, content]) => [
            id,
            render(content),
          ]),
        ),
        open: definitions.open,
      } satisfies Footnotes<ReactNode>,
    }
    cacheRef.current.map = next
    return result
  }, [blocks, definitions, processor, renderComponents])

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
