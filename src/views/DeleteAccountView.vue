<script setup lang="ts">
import { PynAccountDelete } from '@avalon-initiative/pyn-common-ui'
import type { AccountDeleteBlockers } from '@avalon-initiative/pyn-common-ui'
import { inject, onMounted, ref } from 'vue'
import { fetchMe } from '../api/admin'
import { scheduleDeletion } from '../api/account-deletion'
import { ApiError } from '../api/client'
import { useAction } from '../state/action.state'
import { sessionKey } from '../state/context.state'

const session = inject(sessionKey)!
const external = ref(false)
const blockers = ref<AccountDeleteBlockers | undefined>()
const { busy, error, attempt } = useAction()

onMounted(async () => {
  external.value = (await fetchMe().catch(() => null))?.has_password === false
})

const remove = (password?: string) =>
  attempt(async () => {
    blockers.value = undefined
    try {
      session.scheduled?.(await scheduleDeletion(password))
    } catch (e) {
      if (e instanceof ApiError && e.blockers) blockers.value = e.blockers
      throw e
    }
  })
</script>

<template>
  <PynAccountDelete
    :external="external"
    :blockers="blockers"
    :busy="busy"
    :error="error"
    @remove="remove"
  />
</template>
