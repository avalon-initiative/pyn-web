<script setup lang="ts">
import { PynTagsPage } from '@avalon-initiative/pyn-common-ui'
import type { NewTag } from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { describeError } from '../api/client'
import { createTag, deleteTag, listTags } from '../api/tags'
import { useAction } from '../state/action.state'
import { repoKey } from '../state/context.state'
import { canWrite } from '../state/freeze.state'
import { newestFirst, tagItem } from '../state/tags.state'
import type { Tag } from '../types/repo.types'

const { target, permissions, frozen, branches, reloadTags } = inject(repoKey)!
const route = useRoute()
const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const page = ref(1)
const tags = ref<Tag[]>([])
const items = computed(() => tags.value.map(tagItem))
const loading = ref(true)
const { error, attempt } = useAction()
const writable = computed(() => canWrite(permissions.value.includes('checkin'), frozen.value))
const creating = ref(false)
const deleting = ref('')
const busy = ref(false)
const dialogError = ref('')
const now = ref(new Date())
let seq = 0

async function load() {
  const mine = ++seq
  const t = target.value
  now.value = new Date()
  await attempt(async () => {
    const list = await listTags(t)
    if (mine === seq) tags.value = newestFirst(list)
  })
  if (mine === seq) loading.value = false
}

async function run(request: () => Promise<unknown>, done: () => void) {
  busy.value = true
  dialogError.value = ''
  try {
    await request()
    done()
    await Promise.all([load(), reloadTags?.()])
  } catch (e) {
    dialogError.value = describeError(e)
  } finally {
    busy.value = false
  }
}

const create = (tag: NewTag) =>
  run(
    () =>
      createTag(target.value, {
        name: tag.name,
        target: tag.target || undefined,
        message: tag.message || undefined,
      }),
    () => (creating.value = false),
  )

const remove = (name: string) =>
  run(
    () => deleteTag(target.value, name),
    () => (deleting.value = ''),
  )

// A dialog opened afresh shows no error from the last one.
watch([creating, deleting], () => (dialogError.value = ''))

watch(target, () => {
  tags.value = []
  loading.value = true
  void load()
})
onMounted(load)
</script>

<template>
  <PynTagsPage
    v-model:query="query"
    v-model:page="page"
    v-model:creating="creating"
    v-model:deleting="deleting"
    :tags="items"
    :branches="branches ?? []"
    :can-create="writable"
    :can-delete="writable"
    :loading="loading"
    :error="error || undefined"
    :busy="busy"
    :dialog-error="dialogError || undefined"
    :now="now"
    @create="create"
    @delete="remove"
  />
</template>
