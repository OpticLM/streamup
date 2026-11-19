import { describe, expect, it, vi } from 'vitest'
import { FootnoteStore } from './store.js'

const contents = (...entries: [string, string][]) => new Map(entries)

describe('FootnoteStore', () => {
  it('starts from its initial footnotes', () => {
    const store = new FootnoteStore(contents(['1', 'one']))
    expect(store.get('1')).toBe('one')
    expect(store.get('2')).toBeUndefined()
  })

  it('notifies only the footnotes whose content changed', () => {
    const store = new FootnoteStore(contents(['1', 'one']))
    const one = vi.fn()
    const two = vi.fn()
    store.subscribe('1', one)
    store.subscribe('2', two)
    store.sync(contents(['1', 'one'], ['2', 'two']))
    expect(one).not.toHaveBeenCalled()
    expect(two).toHaveBeenCalledOnce()
    expect(store.get('2')).toBe('two')
  })

  it('drops footnotes gone from the document', () => {
    const store = new FootnoteStore(contents(['1', 'one']))
    const listener = vi.fn()
    store.subscribe('1', listener)
    store.sync(contents())
    expect(store.get('1')).toBeUndefined()
    expect(listener).toHaveBeenCalledOnce()
  })

  it('stops notifying after unsubscribe', () => {
    const store = new FootnoteStore()
    const listener = vi.fn()
    store.subscribe('1', listener)()
    store.sync(contents(['1', 'one']))
    expect(listener).not.toHaveBeenCalled()
  })
})
