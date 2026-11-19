import { describe, expect, it } from 'vitest'
import { DEFAULT_SAMPLE_STATE, readSampleState, sampleSearch, withSampleState } from './sample-plan-url'

const read = (query: string) => readSampleState(new URLSearchParams(query))

describe('sample plan URL state', () => {
  it('opens plan C, loading, stop 1, diagonal view when the link has no parameters', () => {
    expect(read('')).toStrictEqual({ plan: 'C', mode: 'load', stop: 1, view: 'goc-cheo' })
    expect(DEFAULT_SAMPLE_STATE).toStrictEqual(read(''))
  })

  it('reads the shared example link: plan B, unloading at stop 2', () => {
    expect(read('phuong-an=b&che-do=do&diem=2')).toStrictEqual({ plan: 'B', mode: 'unload', stop: 2, view: 'goc-cheo' })
    expect(read('phuong-an=A&che-do=xep&goc=tren')).toStrictEqual({ plan: 'A', mode: 'load', stop: 1, view: 'tren' })
  })

  it('falls back to the default for unknown or out-of-range values instead of failing', () => {
    expect(read('phuong-an=d&che-do=bay&diem=9&goc=gam-xe')).toStrictEqual(DEFAULT_SAMPLE_STATE)
    expect(read('diem=0').stop).toBe(1)
    expect(read('diem=2.5').stop).toBe(1)
    expect(read('diem=4').stop).toBe(4)
  })

  it('writes unaccented Vietnamese slugs, the stop when unloading or not stop 1, and the view only when not the default', () => {
    expect(sampleSearch({ plan: 'B', mode: 'unload', stop: 2, view: 'goc-cheo' }).toString()).toBe('phuong-an=b&che-do=do&diem=2')
    expect(sampleSearch({ plan: 'C', mode: 'load', stop: 1, view: 'cua-sau' }).toString()).toBe('phuong-an=c&che-do=xep&goc=cua-sau')
    expect(sampleSearch({ plan: 'A', mode: 'load', stop: 3, view: 'goc-cheo' }).toString()).toBe('phuong-an=a&che-do=xep&diem=3')
  })

  it('replaces only its own parameters when the state changes, keeping the language and debug flags', () => {
    const next = withSampleState(new URLSearchParams('lang=en&phuong-an=c&diem=4&debug'), { plan: 'A', mode: 'unload', stop: 3, view: 'tren' })
    expect(next.toString()).toBe('lang=en&debug=&phuong-an=a&che-do=do&diem=3&goc=tren')
  })

  it('round-trips every state it writes', () => {
    for (const plan of ['A', 'B', 'C'] as const) {
      for (const mode of ['load', 'unload'] as const) {
        for (const stop of [1, 2, 3, 4]) {
          for (const view of ['goc-cheo', 'cua-sau', 'ben-hong', 'tren'] as const) {
            const state = { plan, mode, stop, view }
            expect(readSampleState(sampleSearch(state))).toStrictEqual(state)
          }
        }
      }
    }
  })
})
