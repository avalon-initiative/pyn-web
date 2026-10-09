<script setup lang="ts">
defineProps<{ open?: boolean }>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :data-open="open ? '' : undefined"
    aria-hidden="true"
  >
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path v-if="open" d="M8 11V8a4 4 0 0 1 7.5-2" />
    <path v-else d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
</template>
