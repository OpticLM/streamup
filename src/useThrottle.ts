import { useEffect, useRef, useState } from 'react'

/**
 * Throttle a rapidly-changing value to at most one commit per `ms`.
 *
 * Commits the latest value on a fixed `ms` cadence (a self-rescheduling
 * interval), so the output rate is decoupled from the input rate: burst or
 * trickle, the snapshot advances at most once per `ms` and always holds the
 * newest value. When `ms <= 0` the value passes through untouched (no
 * throttling, no timer) so non-streaming renders stay synchronous.
 *
 * Uses `setInterval` (not `requestAnimationFrame`) so it works under jsdom and
 * is controllable with vitest fake timers.
 */
export function useThrottle<T>(value: T, ms: number): T {
  const [snapshot, setSnapshot] = useState(value)
  const ref = useRef(value)
  ref.current = value

  useEffect(() => {
    if (ms <= 0) return
    setSnapshot(ref.current)
    const timer = setInterval(() => setSnapshot(ref.current), ms)
    return () => clearInterval(timer)
  }, [ms])

  return ms <= 0 ? value : snapshot
}
