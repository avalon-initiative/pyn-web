<script setup lang="ts">
import { PynProfileForm } from '@avalon-initiative/pyn-common-ui'
import type { ProfileValues } from '@avalon-initiative/pyn-common-ui'
import { inject, onMounted, ref } from 'vue'
import { fetchMe } from '../api/admin'
import { removeAvatar, saveProfile, uploadAvatar } from '../api/profile'
import type { Profile } from '../api/profile'
import { useAction } from '../state/action.state'
import { ownProfile } from '../state/own-profile.state'
import { sessionKey } from '../state/context.state'

const session = inject(sessionKey)!
const profile = ref<Profile>({})
const keep = (next: Profile) => (ownProfile.value = profile.value = next)
const success = ref('')
const avatarError = ref('')
const { busy, error, attempt } = useAction()
const avatar = useAction()

onMounted(async () => {
  profile.value = (await fetchMe().catch(() => null))?.profile ?? {}
})

const save = (values: ProfileValues) =>
  attempt(async () => {
    success.value = ''
    keep(await saveProfile(values))
    success.value = 'Profile saved.'
  })

async function changeAvatar(change: () => Promise<Profile>) {
  avatarError.value = ''
  const ok = await avatar.attempt(async () => {
    keep(await change())
  })
  if (!ok) avatarError.value = avatar.error.value
}
</script>

<template>
  <PynProfileForm
    :profile="profile"
    :user="session.user.value"
    :avatar-url="profile.avatar_url ?? undefined"
    :busy="busy"
    :avatar-busy="avatar.busy.value"
    :error="error"
    :avatar-error="avatarError"
    :success="success"
    @save="save"
    @avatar="(file: File) => changeAvatar(() => uploadAvatar(file))"
    @remove-avatar="changeAvatar(removeAvatar)"
  />
</template>
