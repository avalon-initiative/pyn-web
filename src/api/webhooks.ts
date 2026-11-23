import type { WebhookUpdate } from '@avalon-initiative/pyn-common-ui'
import type {
  CreatedWebhook,
  RotatedWebhookSecret,
  Webhook,
  WebhookDelivery,
  WebhookDeliveryPage,
  WebhookDeliveryStatus,
} from '../types/webhook.types'
import { api, call } from './http'
import type { Schemas } from './schema'

const at = (id: number) => ({ params: { path: { id } } })

export const listWebhooks = () => call<Webhook[]>(api.GET('/v1/admin/webhooks'))

export const getWebhook = (id: number) => call<Webhook>(api.GET('/v1/admin/webhooks/{id}', at(id)))

type EventTypes = Schemas['WebhookEventType'][]

export const createWebhook = (body: { name: string; url: string; event_types?: string[] }) =>
  call<CreatedWebhook>(
    api.POST('/v1/admin/webhooks', {
      body: { ...body, event_types: body.event_types as EventTypes | undefined },
    }),
  )

export const updateWebhook = (id: number, body: WebhookUpdate) =>
  call<Webhook>(
    api.PATCH('/v1/admin/webhooks/{id}', {
      ...at(id),
      body: { ...body, event_types: body.event_types as EventTypes | undefined },
    }),
  )

export const deleteWebhook = (id: number) =>
  call<void>(api.DELETE('/v1/admin/webhooks/{id}', at(id)))

export const rotateWebhookSecret = (id: number) =>
  call<RotatedWebhookSecret>(api.POST('/v1/admin/webhooks/{id}/secrets', at(id)))

export const retireWebhookSecret = (id: number, secretId: number) =>
  call<void>(
    api.DELETE('/v1/admin/webhooks/{id}/secrets/{secret_id}', {
      params: { path: { id, secret_id: secretId } },
    }),
  )

export const listWebhookDeliveries = (
  id: number,
  status: WebhookDeliveryStatus | '',
  before?: number,
) =>
  call<WebhookDeliveryPage>(
    api.GET('/v1/admin/webhooks/{id}/deliveries', {
      params: { path: { id }, query: { status: status || undefined, before } },
    }),
  )

export const redeliverWebhook = (id: number, deliveryId: string) =>
  call<WebhookDelivery>(
    api.POST('/v1/admin/webhooks/{id}/deliveries/{delivery_id}/redeliver', {
      params: { path: { id, delivery_id: deliveryId } },
    }),
  )
