import type { ReactNode } from 'react'
import { useCallback, useSyncExternalStore } from 'react'

type Listener = () => void

/**
 * Rendered footnote content by number, observable per footnote so a change
 * re-renders only the references to that footnote.
 */
export class FootnoteStore {
  readonly #contents = new Map<string, ReactNode>()
  readonly #listeners = new Map<string, Set<Listener>>()

  constructor(initial?: ReadonlyMap<string, ReactNode>) {
    if (initial) this.sync(initial)
  }

  get(footnote: string): ReactNode {
    return this.#contents.get(footnote)
  }

  subscribe(footnote: string, listener: Listener): () => void {
    const listeners = this.#listeners.get(footnote) ?? new Set()
    this.#listeners.set(footnote, listeners)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) this.#listeners.delete(footnote)
    }
  }

  /**
   * Reconcile with the latest render: a footnote whose content differs from
   * the stored one is written, and footnotes gone from the document are
   * dropped. Only the changed footnotes notify.
   */
  sync(contents: ReadonlyMap<string, ReactNode>): void {
    const changed: string[] = []
    for (const [footnote, content] of contents) {
      if (this.#contents.get(footnote) === content) continue
      this.#contents.set(footnote, content)
      changed.push(footnote)
    }
    for (const footnote of this.#contents.keys()) {
      if (contents.has(footnote)) continue
      this.#contents.delete(footnote)
      changed.push(footnote)
    }
    for (const footnote of changed) {
      for (const listener of this.#listeners.get(footnote) ?? []) listener()
    }
  }
}

const noop = () => {}

/** Subscribe to one footnote's content in `store`, if there is a footnote. */
export function useFootnote(
  store: FootnoteStore,
  footnote: string | undefined,
): ReactNode {
  const subscribe = useCallback(
    (listener: Listener) =>
      footnote === undefined ? noop : store.subscribe(footnote, listener),
    [store, footnote],
  )
  const read = () => (footnote === undefined ? undefined : store.get(footnote))
  return useSyncExternalStore(subscribe, read, read)
}
