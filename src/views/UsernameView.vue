<script setup lang="ts">
import { PynUsernameChange, repoSlug } from '@avalon-initiative/pyn-common-ui'
import type { RenameForm } from '@avalon-initiative/pyn-common-ui'
import { inject, onMounted, ref } from 'vue'
import { fetchMe } from '../api/admin'
import { listRepos } from '../api/repos'
import { restoreSession } from '../api/auth'
import { renameAccount } from '../api/username'
import { useAction } from '../state/action.state'
import { sessionKey } from '../state/context.state'

const session = inject(sessionKey)!
const hasPassword = ref(true)
const repositories = ref<string[]>([])
const { busy, error, attempt } = useAction()

async function load() {
  hasPassword.value = (await fetchMe().catch(() => null))?.has_password !== false
  const own = await listRepos(session.user.value).catch(() => [])
  repositories.value = own.map(repoSlug)
}

const rename = (form: RenameForm) =>
  attempt(async () => {
    const renamed = await renameAccount(form)
    session.user.value = (await restoreSession())?.user ?? renamed.new_name
    repositories.value = renamed.repositories
    hasPassword.value = (await fetchMe().catch(() => null))?.has_password !== false
  })

onMounted(load)
</script>

<template>
  <PynUsernameChange
    :current="session.user.value"
    :has-password="hasPassword"
    :repositories="repositories"
    :busy="busy"
    :error="error"
    @rename="rename"
  />
</template>
