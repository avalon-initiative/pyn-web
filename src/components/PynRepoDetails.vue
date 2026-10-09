<script setup lang="ts">
import styles from '../styles/PynRepoDetails.module.scss'
import { formatAgo } from '../state/tree.state'
import type { Visibility } from '../types/repo.types'

defineProps<{
  owner: string
  visibility: Visibility
  leaseHours: number
  createdAt: string
  updatedAt?: string | null
  files: number
  exclusiveFiles: number
  sharedFiles: number
  now?: Date
}>()
</script>

<template>
  <section :class="styles.card" aria-labelledby="details-title">
    <h2 id="details-title" :class="styles.title">Repository details</h2>
    <dl :class="styles.list">
      <dt>Owner</dt>
      <dd>{{ owner }}</dd>
      <dt>Visibility</dt>
      <dd :class="styles.cap">{{ visibility }}</dd>
      <dt>Lease</dt>
      <dd>{{ leaseHours }} hours</dd>
      <dt>Created</dt>
      <dd>{{ createdAt.slice(0, 10) }}</dd>
      <dt>Last revision</dt>
      <dd>{{ updatedAt ? formatAgo(updatedAt, now ?? new Date()) : 'None yet' }}</dd>
      <dt>Files</dt>
      <dd>{{ files }}</dd>
      <dt>Exclusive</dt>
      <dd>{{ exclusiveFiles }}</dd>
      <dt>Shared</dt>
      <dd>{{ sharedFiles }}</dd>
    </dl>
  </section>
</template>
