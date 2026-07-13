import type { ReactNode } from 'react'
import { Fragment, useMemo, useRef } from 'react'
import type { PluggableList } from 'unified'
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
}: StreamupProps) {
  const markdown = children ?? ''
  const pacingOptions = useMemo(
    () => resolvePacing(pacing, streaming),
    [pacing, streaming],
  )
  const source = usePacedStream(markdown, pacingOptions)

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
      }),
    [extraRemarkPlugins, extraRehypePlugins, singleDollarTextMath],
  )

  const blocks = useMemo(
    () => splitBlocks(source, processor, streaming || pacingOptions.enabled),
    [source, processor, streaming, pacingOptions.enabled],
  )

  const cacheRef = useRef({
    processor,
    components,
    map: new Map<string, ReactNode>(),
  })
  const rendered = useMemo(() => {
    if (
      cacheRef.current.processor !== processor ||
      cacheRef.current.components !== components
    ) {
      cacheRef.current = {
        processor,
        components,
        map: new Map<string, ReactNode>(),
      }
    }
    const cache = cacheRef.current.map
    const next = new Map<string, ReactNode>()
    const result = blocks.map((block) => {
      const cached = cache.get(block)
      if (cached) {
        next.set(block, cached)
        return cached
      }
      const element = renderBlock(block, { processor, components })
      next.set(block, element)
      return element
    })
    cacheRef.current.map = next
    return result
  }, [blocks, processor, components])

  return (
    <>
      {rendered.map((element, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocks are positional during streaming
        <Fragment key={i}>{element}</Fragment>
      ))}
    </>
  )
}
