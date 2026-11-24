import { staticText } from './http'

/** The raw host configuration from /config.json, or undefined when there is none or it is not JSON. */
export async function fetchHostConfig(): Promise<unknown> {
  try {
    const text = await staticText('/config.json')
    return text === null ? undefined : JSON.parse(text)
  } catch {
    return undefined
  }
}
