import { ApiError, describeError } from '../api/client'

const ICON_ERRORS: Record<string, string> = {
  object_too_large: 'That image is over 1 MiB. Pick a smaller one.',
  unsupported_image: 'That file is not a PNG, JPEG or WebP image.',
}

/** Words an icon upload's refusal; the size and format codes are shared with other uploads, so they are worded here. */
export function describeIconError(e: unknown): string {
  return (e instanceof ApiError && ICON_ERRORS[e.code]) || describeError(e)
}
