import { afterEach, describe, expect, it, vi } from 'vitest'
import { rememberedUser, rememberUser } from '../src/state/remember.state'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('remembered username', () => {
  it('stores the name on request and forgets it otherwise', () => {
    expect(rememberedUser()).toBe('')
    rememberUser('wendy', true)
    expect(rememberedUser()).toBe('wendy')
    rememberUser('wendy', false)
    expect(rememberedUser()).toBe('')
  })

  it('works without storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => rememberUser('wendy', true)).not.toThrow()
    expect(rememberedUser()).toBe('')
  })
})
