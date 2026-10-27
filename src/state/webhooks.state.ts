import type {
  WebhookDelivery as ViewDelivery,
  WebhookDeliveryStatus,
} from '@avalon-initiative/pyn-common-ui'
import type { WebhookDelivery } from '../types/webhook.types'

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
