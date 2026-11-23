<script setup lang="ts">
import { PynPageNotFound } from '@avalon-initiative/pyn-common-ui'
import { useRouter } from 'vue-router'
import { previousPath } from '../state/navigation.state'

// A fresh load has no previous page, so only the home link shows.
const previous = previousPath(useRouter())
</script>

<template>
  <PynPageNotFound :back-href="previous" back-label="Go back to the previous page" />
</template>
