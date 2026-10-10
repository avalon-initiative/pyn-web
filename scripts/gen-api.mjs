// Generates src/api/schema.gen.ts from pyn-server's OpenAPI document.
// Source: PYN_OPENAPI (path or URL), else the sibling pyn checkout. `--check` fails on drift.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(import.meta.url), '../..')
const source = process.env.PYN_OPENAPI ?? resolve(root, '../pyn/docs/generated/openapi.json')
const target = resolve(root, 'src/api/schema.gen.ts')
const bin = (name) => resolve(root, 'node_modules/.bin', name)

const raw = execFileSync(bin('openapi-typescript'), [source], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
const generated = execFileSync(bin('prettier'), ['--stdin-filepath', target], {
  input: raw,
  encoding: 'utf8',
})

if (process.argv.includes('--check')) {
  if (generated !== readFileSync(target, 'utf8')) {
    console.error('src/api/schema.gen.ts is out of date: run `npm run api:generate`')
    process.exit(1)
  }
} else {
  writeFileSync(target, generated)
}
