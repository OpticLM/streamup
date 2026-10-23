import type { ReactNode } from 'react'
import { useCallback, useSyncExternalStore } from 'react'
import type { Footnotes } from './types.js'

type Listener = () => void

/**
 * Rendered footnote content by identifier, observable per identifier so a
 * footnote change re-renders only the references to that footnote.
 */
export class FootnoteStore {
  readonly #contents = new Map<string, ReactNode>()
  readonly #listeners = new Map<string, Set<Listener>>()

  constructor(initial?: Footnotes<ReactNode>) {
    if (initial) this.sync(initial)
  }

  get(identifier: string): ReactNode {
    return this.#contents.get(identifier)
  }

  subscribe(identifier: string, listener: Listener): () => void {
    const listeners = this.#listeners.get(identifier) ?? new Set()
    this.#listeners.set(identifier, listeners)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) this.#listeners.delete(identifier)
    }
  }

  /**
   * Reconcile with the latest parse. A settled footnote whose content differs
   * from the stored one is written; the open one is left alone until it
   * settles, so streaming it costs no renders; footnotes gone from the
   * document are dropped. Only the changed identifiers notify.
   */
  sync({ settled, open }: Footnotes<ReactNode>): void {
    const changed: string[] = []
    for (const [identifier, content] of settled) {
      if (this.#contents.get(identifier) === content) continue
      this.#contents.set(identifier, content)
      changed.push(identifier)
    }
    for (const identifier of this.#contents.keys()) {
      if (identifier === open || settled.has(identifier)) continue
      this.#contents.delete(identifier)
      changed.push(identifier)
    }
    for (const identifier of changed) {
      for (const listener of this.#listeners.get(identifier) ?? []) listener()
    }
  }
}

/** Subscribe to one footnote's content in `store`. */
export function useFootnote(
  store: FootnoteStore,
  identifier: string,
): ReactNode {
  const subscribe = useCallback(
    (listener: Listener) => store.subscribe(identifier, listener),
    [store, identifier],
  )
  const read = () => store.get(identifier)
  return useSyncExternalStore(subscribe, read, read)
}
