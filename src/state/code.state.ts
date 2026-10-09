import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import go from 'highlight.js/lib/languages/go'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import lua from 'highlight.js/lib/languages/lua'
import makefile from 'highlight.js/lib/languages/makefile'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import scss from 'highlight.js/lib/languages/scss'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

const LANGUAGES = {
  bash,
  c,
  cpp,
  csharp,
  css,
  diff,
  dockerfile,
  go,
  ini,
  java,
  javascript,
  json,
  lua,
  makefile,
  python,
  rust,
  scss,
  sql,
  typescript,
  xml,
  yaml,
}
for (const [name, def] of Object.entries(LANGUAGES)) hljs.registerLanguage(name, def)

const BY_EXTENSION: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  uproject: 'json',
  uplugin: 'json',
  html: 'xml',
  htm: 'xml',
  xml: 'xml',
  svg: 'xml',
  vue: 'xml',
  csproj: 'xml',
  css: 'css',
  scss: 'scss',
  py: 'python',
  rs: 'rust',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  cs: 'csharp',
  java: 'java',
  go: 'go',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',
  sql: 'sql',
  diff: 'diff',
  patch: 'diff',
  lua: 'lua',
}

const BY_NAME: Record<string, string> = { makefile: 'makefile', dockerfile: 'dockerfile' }

const ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  shell: 'bash',
  py: 'python',
  rs: 'rust',
  yml: 'yaml',
  html: 'xml',
  toml: 'ini',
  'c++': 'cpp',
  cs: 'csharp',
}

/** Highlighting above this size is skipped; the text is shown plain. */
export const HIGHLIGHT_LIMIT = 256 * 1024

export const fileExtension = (path: string): string => {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}

/** A registered highlight language for the file name, or null. */
export function languageFor(path: string): string | null {
  const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase()
  return BY_NAME[name] ?? BY_EXTENSION[fileExtension(path)] ?? null
}

/** A registered language for a markdown fence tag, or null. */
export function languageFromTag(tag: string): string | null {
  const t = tag.trim().toLowerCase()
  const name = ALIASES[t] ?? t
  return name in LANGUAGES ? name : null
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Highlighted (or escaped) HTML for the text; falls back to plain for big input. */
export function highlight(text: string, language: string | null): string {
  if (!language || text.length > HIGHLIGHT_LIMIT) return escapeHtml(text)
  return hljs.highlight(text, { language, ignoreIllegals: true }).value
}

/** One HTML string per line; spans that cross a newline are closed and reopened. */
export function highlightLines(text: string, language: string | null): string[] {
  const lines: string[] = []
  const open: string[] = []
  let cur = ''
  for (const tok of highlight(text, language).split(/(<span[^>]*>|<\/span>|\n)/)) {
    if (tok === '\n') {
      lines.push(cur + '</span>'.repeat(open.length))
      cur = open.join('')
    } else {
      if (tok.startsWith('<span')) open.push(tok)
      else if (tok === '</span>') open.pop()
      cur += tok
    }
  }
  if (!text.endsWith('\n')) lines.push(cur)
  return lines
}
