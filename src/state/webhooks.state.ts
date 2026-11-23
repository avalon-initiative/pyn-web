import type {
  WebhookDelivery as ViewDelivery,
  WebhookDeliveryStatus,
} from '@avalon-initiative/pyn-common-ui'
import { ref } from 'vue'
import type { MultiSelectOption } from '@avalon-initiative/pyn-common-ui'
import { ApiError, describeError } from '../api/client'
import type { WebhookDelivery, WebhookEventTypeInfo } from '../types/webhook.types'

/** The library types the event id as text; the wire sends a number. */
export const toViewDelivery = (d: WebhookDelivery): ViewDelivery => ({
  ...d,
  event_id: String(d.event_id),
})

export const replaceById = <T extends { id: number }>(items: T[], next: T): T[] =>
  items.map((i) => (i.id === next.id ? next : i))

export const replaceDelivery = (items: WebhookDelivery[], next: WebhookDelivery) =>
  items.map((i) => (i.id === next.id ? next : i))

/** A status the filter control sent, or '' for all. */
export const asStatus = (s: string): WebhookDeliveryStatus | '' =>
  s === 'pending' || s === 'delivered' || s === 'failed' ? s : ''

export const toEventTypeOptions = (types: WebhookEventTypeInfo[]): MultiSelectOption[] =>
  types.map((t) => ({ value: t.name, label: t.name, description: t.description }))

/** Loads the server's event types once per call of `load`, for the create and edit forms. */
export function useEventTypes(fetchTypes: () => Promise<WebhookEventTypeInfo[]>) {
  const options = ref<MultiSelectOption[]>([])
  const loading = ref(false)
  const error = ref('')

  async function load() {
    loading.value = true
    error.value = ''
    try {
      options.value = toEventTypeOptions(await fetchTypes())
    } catch (e) {
      error.value = `Could not load the event types. ${describeError(e)}`
    } finally {
      loading.value = false
    }
  }

  return { options, loading, error, load }
}

/** A `400 invalid_request` on save is an event type or field the server refuses. */
export function webhookError(e: unknown): string {
  if (e instanceof ApiError && e.status === 400 && e.code === 'invalid_request')
    return `The server did not accept this webhook: ${e.message}. Check the name, the address and the event types, then try again.`
  return describeError(e)
}
