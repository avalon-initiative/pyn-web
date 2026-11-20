<script setup lang="ts">
import {
  PynAccessSessionList,
  PynAccessSessionStartForm,
  PynPeopleSearch,
  PynViewHeader,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import { ref } from 'vue'
import { useAccessSessions } from '../state/admin-access-sessions.state'

const target = ref('')
const { sessions, started, load, start, end, dismiss, busy, error } = useAccessSessions()

load()
</script>

<template>
  <PynViewStack>
    <PynViewHeader title="Access sessions" />
    <PynPeopleSearch placeholder="Account name to act as" @search="(q) => (target = q.trim())" />
    <PynAccessSessionStartForm
      v-if="target"
      :user="target"
      :busy="busy"
      :error="error"
      @submit="(r) => start(target, r)"
    />
    <PynAccessSessionList
      :sessions="sessions"
      :started="started ?? undefined"
      :busy="busy"
      @end="end"
      @dismiss="dismiss"
    />
  </PynViewStack>
</template>
