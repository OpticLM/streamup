import { useEffect, useRef, useState } from 'react'

/**
 * Adaptive leaky-bucket "typewriter" pacing for a streaming string.
 *
 * `received` is the full text arrived from the network so far; the hook returns a
 * growing prefix of it (`displayed`) revealed at a paced rate. The unrevealed suffix
 * (`received` minus `displayed`) is the buffer; a scheduled consumer drains it each
 * `tickMs`, so the reveal rate is decoupled from the network rate.
 *
 * The drain rate adapts to the buffer depth (measured in code points):
 *  - buffer < `low`: the network has stalled — drain at `slowCps` to stretch the
 *    remaining tokens and mask the pause.
 *  - `low` <= buffer < `high`: drain at `normCps` — a steady typewriter cadence.
 *  - buffer >= `high`: a burst arrived — drain at `fastCps` (scaled up with
 *    `buffer / high`, capped at 10x when `scaleFast` is on) to catch up.
 *
 * Fractional cp/tick rates (e.g. `slowCps` 15 at 30fps = 0.5 cp/tick = 1 char every
 * 2 ticks) are realized with a credit accumulator. Emission advances by code point
 * so a surrogate pair (emoji) is never split.
 *
 * When pacing is disabled (`enabled` false or `tickMs <= 0`) the hook returns
 * `received` synchronously with no timer — the same contract as the old
 * `throttleMs = 0` passthrough. On any enable/disable transition `displayed` snaps
 * to `received` so content never visibly rewinds and a re-enable doesn't replay
 * backlog; `streaming` flipping to `false` thus flushes the full document instantly.
 *
 * Uses `setInterval` (not `requestAnimationFrame`) so it works under jsdom and is
 * controllable with vitest fake timers. The interval is keyed on the primitive
 * options only — not `received`, not object identity — so it never restarts on a
 * parent re-render with equal config (robust to a non-memoized `pacing` prop).
 */
export interface PacingOptions {
  enabled: boolean
  tickMs: number
  low: number
  high: number
  slowCps: number
  normCps: number
  fastCps: number
  scaleFast: boolean
}

function codePointLength(s: string): number {
  let n = 0
  let i = 0
  while (i < s.length) {
    const cp = s.codePointAt(i) as number
    i += cp > 0xffff ? 2 : 1
    n++
  }
  return n
}

/** Advance a UTF-16 offset by `count` code points, never splitting a surrogate pair. */
function advanceCp(s: string, start: number, count: number): number {
  let i = start
  let left = count
  while (left > 0 && i < s.length) {
    const cp = s.codePointAt(i) as number
    i += cp > 0xffff ? 2 : 1
    left--
  }
  return i
}

function rateFor(buffer: number, o: PacingOptions): number {
  if (buffer <= 0) return 0
  if (buffer < o.low) return o.slowCps
  if (buffer >= o.high) {
    if (!o.scaleFast) return o.fastCps
    return o.fastCps * Math.min(10, buffer / o.high)
  }
  return o.normCps
}

export function usePacedStream(received: string, o: PacingOptions): string {
  const [displayed, setDisplayed] = useState(received)

  // Destructure once per render so the effect closes over value-compared
  // primitives instead of the `o` object — the interval is keyed on these
  // (not object identity), so a parent re-rendering with an equal inline
  // `pacing` prop never restarts the timer.
  const { enabled, tickMs, low, high, slowCps, normCps, fastCps, scaleFast } = o

  const receivedRef = useRef(received)
  receivedRef.current = received
  // `receivedCpRef` is valid only for `receivedForCpRef.current`; recompute lazily
  // when `received` actually changes (value-compared), not on every re-render.
  const receivedForCpRef = useRef(received)
  const receivedCpRef = useRef(codePointLength(received))
  if (receivedForCpRef.current !== received) {
    receivedForCpRef.current = received
    receivedCpRef.current = codePointLength(received)
  }

  const displayedLenRef = useRef(received.length)
  const displayedCpRef = useRef(codePointLength(received))
  const creditRef = useRef(0)
  const wasEnabledRef = useRef(enabled && tickMs > 0)

  useEffect(() => {
    const active = enabled && tickMs > 0
    const rec = receivedRef.current
    const recCp = receivedCpRef.current

    // On an enable/disable transition (or mount), snap `displayed` to `received`
    // so visible content never rewinds and a re-enable doesn't replay backlog.
    if (active !== wasEnabledRef.current) {
      if (displayedLenRef.current !== rec.length) {
        displayedLenRef.current = rec.length
        displayedCpRef.current = recCp
        setDisplayed(rec)
      }
      creditRef.current = 0
      wasEnabledRef.current = active
    }

    if (!active) return

    const opts: PacingOptions = {
      enabled,
      tickMs,
      low,
      high,
      slowCps,
      normCps,
      fastCps,
      scaleFast,
    }

    const tick = () => {
      const rec = receivedRef.current
      const recCp = receivedCpRef.current
      const dispCp = displayedCpRef.current

      // Received shrank below what we've revealed (parent reset): clamp.
      if (dispCp > recCp) {
        displayedLenRef.current = rec.length
        displayedCpRef.current = recCp
        creditRef.current = 0
        setDisplayed(rec)
        return
      }

      const buffer = recCp - dispCp
      if (buffer <= 0) {
        creditRef.current = 0
        return
      }

      const rate = rateFor(buffer, opts)
      creditRef.current += (rate * tickMs) / 1000
      const emit = Math.min(Math.floor(creditRef.current), buffer)
      if (emit <= 0) return // no advancement -> no setState -> no re-render/parse
      creditRef.current -= emit

      const nextLen = advanceCp(rec, displayedLenRef.current, emit)
      displayedLenRef.current = nextLen
      displayedCpRef.current += emit
      setDisplayed(rec.slice(0, nextLen))
    }

    const timer = setInterval(tick, tickMs)
    return () => clearInterval(timer)
  }, [enabled, tickMs, low, high, slowCps, normCps, fastCps, scaleFast])

  return enabled && tickMs > 0 ? displayed : received
}
