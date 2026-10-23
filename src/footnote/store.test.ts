import { describe, expect, it, vi } from 'vitest'
import { FootnoteStore } from './store.js'

const settled = (...entries: [string, string][]) => new Map(entries)

describe('FootnoteStore', () => {
  it('starts from its initial footnotes', () => {
    const store = new FootnoteStore({ settled: settled(['1', 'one']) })
    expect(store.get('1')).toBe('one')
    expect(store.get('2')).toBeUndefined()
  })

  it('notifies only the identifiers whose content changed', () => {
    const store = new FootnoteStore({ settled: settled(['1', 'one']) })
    const one = vi.fn()
    const two = vi.fn()
    store.subscribe('1', one)
    store.subscribe('2', two)
    store.sync({ settled: settled(['1', 'one'], ['2', 'two']) })
    expect(one).not.toHaveBeenCalled()
    expect(two).toHaveBeenCalledOnce()
    expect(store.get('2')).toBe('two')
  })

  it('leaves the open footnote alone until it settles', () => {
    const store = new FootnoteStore({ settled: settled(['1', 'old']) })
    const listener = vi.fn()
    store.subscribe('1', listener)
    store.sync({ settled: settled(), open: '1' })
    expect(store.get('1')).toBe('old')
    expect(listener).not.toHaveBeenCalled()
    store.sync({ settled: settled(['1', 'new']) })
    expect(store.get('1')).toBe('new')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('drops footnotes gone from the document', () => {
    const store = new FootnoteStore({ settled: settled(['1', 'one']) })
    const listener = vi.fn()
    store.subscribe('1', listener)
    store.sync({ settled: settled() })
    expect(store.get('1')).toBeUndefined()
    expect(listener).toHaveBeenCalledOnce()
  })

  it('stops notifying after unsubscribe', () => {
    const store = new FootnoteStore()
    const listener = vi.fn()
    store.subscribe('1', listener)()
    store.sync({ settled: settled(['1', 'one']) })
    expect(listener).not.toHaveBeenCalled()
  })
})
