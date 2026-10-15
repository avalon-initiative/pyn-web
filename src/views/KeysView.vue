<script setup lang="ts">
import { PynKeys } from '@avalon-initiative/pyn-common-ui'
import { onMounted, ref } from 'vue'
import { addKey, listKeys, removeKey } from '../api/keys'
import { useAction } from '../state/action.state'
import type { SshKey } from '@avalon-initiative/pyn-common-ui'

const keys = ref<SshKey[]>([])
const { busy, error, attempt } = useAction()

const load = () =>
  attempt(async () => {
    keys.value = await listKeys()
  })

const add = (form: { key: string; title: string }) =>
  attempt(async () => {
    await addKey(form.key, form.title)
    keys.value = await listKeys()
  })

const remove = (id: string) =>
  attempt(async () => {
    await removeKey(id)
    keys.value = await listKeys()
  })

onMounted(load)
</script>

<template>
  <PynKeys :keys="keys" :busy="busy" :error="error" @add="add" @remove="remove" />
</template>
