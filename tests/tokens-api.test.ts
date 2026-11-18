import { describe, expect, it } from 'vitest'
import { tokenBody, tokenInfo } from '../src/api/tokens'

describe('token request mapping', () => {
  it('maps the old permission names onto the strongest grant per resource, with metadata', () => {
    const body = tokenBody({
      name: 'ci',
      repos: ['alice/game'],
      permissions: ['read', 'checkin', 'restore', 'lock', 'force_unlock'],
      expires_at: '2027-01-01T00:00:00Z',
    })
    expect(body.repository_access).toEqual({ mode: 'selected', repos: ['alice/game'] })
    expect(body.expires_at).toBe('2027-01-01T00:00:00Z')
    expect(body.never).toBeUndefined()
    expect(body.permissions).toEqual([
      { resource: 'metadata', level: 'read' },
      { resource: 'contents', level: 'write' },
      { resource: 'locks', level: 'admin' },
    ])
  })

  it('gives a contents grant without a locks grant locks read, as the server does', () => {
    const body = tokenBody({ name: 'x', repos: [], permissions: ['read'], expires_at: null })
    expect(body.permissions).toEqual([
      { resource: 'metadata', level: 'read' },
      { resource: 'contents', level: 'read' },
      { resource: 'locks', level: 'read' },
    ])
    const none = tokenBody({ name: 'x', repos: [], permissions: ['view_audit'], expires_at: null })
    expect(none.permissions.some((p) => p.resource === 'locks')).toBe(false)
  })

  it('uses all repositories without a list and never without an expiry', () => {
    const body = tokenBody({ name: 'x', repos: [], permissions: ['view_audit'], expires_at: null })
    expect(body.repository_access).toEqual({ mode: 'all' })
    expect(body.never).toBe(true)
    expect(body.expires_at).toBeUndefined()
  })

  it('skips a permission name it does not know', () => {
    const body = tokenBody({ name: 'x', repos: [], permissions: ['nope'], expires_at: null })
    expect(body.permissions).toEqual([{ resource: 'metadata', level: 'read' }])
  })
})

describe('token response mapping', () => {
  it('shows grants as resource:level and the selected repositories', () => {
    const info = tokenInfo({
      id: 't1',
      user: 'alice',
      name: 'ci',
      owner: 'alice',
      created_at: '2026-11-17T00:00:00Z',
      sign_in: false,
      repository_access: { mode: 'selected', repos: ['alice/game'] },
      permissions: [
        { resource: 'metadata', level: 'read' },
        { resource: 'contents', level: 'write' },
      ],
    })
    expect(info.repos).toEqual(['alice/game'])
    expect(info.permissions).toEqual(['metadata:read', 'contents:write'])
    expect(info.id).toBe('t1')
  })
})
