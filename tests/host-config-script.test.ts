import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

const script = join(__dirname, '..', 'docker', 'entrypoint', '25-pyn-web-config.sh')
const dir = mkdtempSync(join(tmpdir(), 'pyn-host-config-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function run(env: Record<string, string>) {
  const out = join(dir, 'config.json')
  const r = spawnSync('sh', [script], {
    env: { PATH: process.env.PATH ?? '', PYN_CONFIG_OUT: out, ...env },
    encoding: 'utf8',
  })
  return { status: r.status, stderr: r.stderr, config: JSON.parse(readFileSync(out, 'utf8')) }
}

function file(name: string, content: string) {
  const p = join(dir, name)
  writeFileSync(p, content)
  return p
}

describe('25-pyn-web-config.sh', () => {
  it('writes the defaults when nothing is set or the values are blank', () => {
    for (const env of [
      {} as Record<string, string>,
      { PYN_FONT_SET: '', PYN_ICON_PACK_FILE: '' },
    ]) {
      const r = run(env)
      expect(r.status).toBe(0)
      expect(r.stderr).toBe('')
      expect(r.config).toEqual({ font_set: 'default', icon_pack: null })
    }
  })

  it('lowercases the font set', () => {
    expect(run({ PYN_FONT_SET: 'Arcade' }).config.font_set).toBe('arcade')
  })

  it('warns and uses the default for a malformed font set', () => {
    const r = run({ PYN_FONT_SET: 'bad"set' })
    expect(r.status).toBe(0)
    expect(r.stderr).toContain('PYN_FONT_SET')
    expect(r.config.font_set).toBe('default')
  })

  it('embeds a JSON object icon pack', () => {
    const p = file('ok.json', '\n  {"repo": "<rect />"}\n')
    const r = run({ PYN_ICON_PACK_FILE: p })
    expect(r.stderr).toBe('')
    expect(r.config.icon_pack).toEqual({ repo: '<rect />' })
  })

  it('warns and uses null for an unreadable or non-object icon pack', () => {
    for (const p of [join(dir, 'missing.json'), file('arr.json', '[1]'), file('empty.json', '')]) {
      const r = run({ PYN_ICON_PACK_FILE: p })
      expect(r.status).toBe(0)
      expect(r.stderr).toContain('PYN_ICON_PACK_FILE')
      expect(r.config.icon_pack).toBeNull()
    }
  })

  it('fails when the output cannot be written', () => {
    const r = spawnSync('sh', [script], {
      env: { PATH: process.env.PATH ?? '', PYN_CONFIG_OUT: join(dir, 'no', 'such', 'config.json') },
      encoding: 'utf8',
    })
    expect(r.status).not.toBe(0)
  })
})
