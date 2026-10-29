<script setup lang="ts">
import { PynOwnerUsage, PynViewError, repoPath, splitRepo } from '@avalon-initiative/pyn-common-ui'
import type { RepoUsage } from '@avalon-initiative/pyn-common-ui'
import { inject } from 'vue'
import { useRouter } from 'vue-router'
import { getOwnerUsage } from '../api/usage'
import { orgKey } from '../state/context.state'
import { useOwnerUsage } from '../state/usage.state'

const { name } = inject(orgKey)!
const router = useRouter()
const { usage, loaded, error } = useOwnerUsage(name, getOwnerUsage)

const open = (row: RepoUsage) => router.push(repoPath(splitRepo(row.repository)))
</script>

<template>
  <PynViewError v-if="error">{{ error }}</PynViewError>
  <PynOwnerUsage v-else-if="loaded && usage" :usage="usage" @open="open" />
</template>
