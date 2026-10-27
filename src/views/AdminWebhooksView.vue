<script setup lang="ts">
import {
  PynDrawer,
  PynPageNotFound,
  PynViewHeader,
  PynViewStack,
  PynWebhookDetail,
  PynWebhooks,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref } from 'vue'
import {
  deleteWebhook,
  getWebhook,
  listWebhookDeliveries,
  listWebhooks,
  redeliverWebhook,
  retireWebhookSecret,
  rotateWebhookSecret,
  updateWebhook,
} from '../api/webhooks'
import { useAction } from '../state/action.state'
import { sessionKey } from '../state/context.state'
import { asStatus, replaceById, replaceDelivery, toViewDelivery } from '../state/webhooks.state'
import type { WebhookUpdate } from '@avalon-initiative/pyn-common-ui'
import type { Webhook, WebhookDelivery, WebhookDeliveryStatus } from '../types/webhook.types'

const { admin } = inject(sessionKey)!
const webhooks = ref<Webhook[]>([])
const selectedId = ref<number | null>(null)
const secret = ref('')
const deliveries = ref<WebhookDelivery[]>([])
const status = ref<WebhookDeliveryStatus | ''>('')
const nextBefore = ref<number | null>(null)
const redelivering = ref('')
const list = useAction()
const detail = useAction()
const feed = useAction()

const selected = computed(() => webhooks.value.find((w) => w.id === selectedId.value) ?? null)
const stale = (id: number) => selectedId.value !== id

const loadList = () =>
  list.attempt(async () => {
    webhooks.value = await listWebhooks()
  })

const loadDeliveries = (id: number, more = false) =>
  feed.attempt(async () => {
    const page = await listWebhookDeliveries(
      id,
      status.value,
      more ? (nextBefore.value ?? undefined) : undefined,
    )
    if (stale(id)) return
    deliveries.value = more ? [...deliveries.value, ...page.deliveries] : page.deliveries
    nextBefore.value = page.next_before
  })

const refresh = async (id: number) => {
  const fresh = await getWebhook(id)
  webhooks.value = replaceById(webhooks.value, fresh)
}

const select = async (id: number) => {
  selectedId.value = id
  secret.value = ''
  status.value = ''
  deliveries.value = []
  nextBefore.value = null
  detail.error.value = ''
  await Promise.all([detail.attempt(() => refresh(id)), loadDeliveries(id)])
}

const close = () => {
  selectedId.value = null
  secret.value = ''
  deliveries.value = []
}

const update = (id: number, body: WebhookUpdate) =>
  detail.attempt(async () => {
    webhooks.value = replaceById(webhooks.value, await updateWebhook(id, body))
  })

const remove = (id: number) =>
  detail.attempt(async () => {
    await deleteWebhook(id)
    webhooks.value = webhooks.value.filter((w) => w.id !== id)
    close()
  })

const rotate = (id: number) =>
  detail.attempt(async () => {
    const rotated = await rotateWebhookSecret(id)
    await refresh(id)
    if (!stale(id)) secret.value = rotated.secret
  })

const retire = (id: number, secretId: number) =>
  detail.attempt(async () => {
    await retireWebhookSecret(id, secretId)
    await refresh(id)
  })

const filter = (value: string) => {
  status.value = asStatus(value)
  return selectedId.value === null ? undefined : loadDeliveries(selectedId.value)
}

const redeliver = async (id: number, deliveryId: string) => {
  redelivering.value = deliveryId
  await feed.attempt(async () => {
    const next = await redeliverWebhook(id, deliveryId)
    deliveries.value = replaceDelivery(deliveries.value, next)
  })
  redelivering.value = ''
}

onMounted(() => {
  if (admin.value) loadList()
})
</script>

<template>
  <PynPageNotFound v-if="!admin" />
  <PynViewStack v-else>
    <PynViewHeader title="Webhooks" />
    <PynWebhooks
      :webhooks="webhooks"
      :selected-id="selectedId ?? undefined"
      :loading="list.busy.value"
      :error="list.error.value"
      @select="select"
    />
    <PynDrawer :open="selected !== null" :title="selected?.name ?? 'Webhook'" @close="close">
      <PynWebhookDetail
        v-if="selected"
        :webhook="selected"
        :secret="secret"
        :busy="detail.busy.value"
        :error="detail.error.value"
        :deliveries="deliveries.map(toViewDelivery)"
        :deliveries-status="status"
        :deliveries-has-more="nextBefore !== null"
        :deliveries-loading="feed.busy.value"
        :deliveries-error="feed.error.value"
        can-redeliver
        :redelivering-id="redelivering"
        @dismiss="secret = ''"
        @update="(body) => update(selected!.id, body)"
        @delete="remove"
        @rotate-secret="rotate"
        @retire-secret="(secretId) => retire(selected!.id, secretId)"
        @filter="filter"
        @load-more="loadDeliveries(selected!.id, true)"
        @redeliver="(deliveryId) => redeliver(selected!.id, deliveryId)"
      />
    </PynDrawer>
  </PynViewStack>
</template>
