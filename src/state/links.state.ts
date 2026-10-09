/** The in-app path of a plain left click on a same-origin link, or null to let the browser handle it. */
export function internalPath(e: MouseEvent, origin: string): string | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
    return null
  const a = (e.target as Element | null)?.closest?.('a')
  if (!a || a.target || a.hasAttribute('download')) return null
  const url = new URL(a.href, origin)
  return url.origin === origin ? url.pathname + url.search : null
}
