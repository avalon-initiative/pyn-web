import { PynViewNotice } from '@avalon-initiative/pyn-common-ui'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = (f: string) => readFileSync(`src/views/${f}`, 'utf8')

describe('dismissible notices', () => {
  it('exposes the library props the views rely on', () => {
    expect(Object.keys(PynViewNotice.props ?? {})).toEqual(
      expect.arrayContaining(['dismissible', 'autoDismissMs', 'persistent']),
    )
  })

  it('fades only the transient confirmations and action errors', () => {
    expect(source('AdminAccountsView.vue')).toMatch(
      /<PynViewNotice[^>]*title="Done"[^>]*dismissible/,
    )
    expect(source('RepoView.vue')).not.toMatch(/dismissible/)
  })
})
