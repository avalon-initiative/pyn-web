<script setup lang="ts">
const paths: Record<string, string> = {
  home: 'M4 11 12 4l8 7M6 10v10h12V10',
  repo: 'M6 4h12v16H6zM6 16h12M9 8h6',
  settings:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12l2-1-2-4-2 1a7 7 0 0 0-2-1l-1-2H10L9 7a7 7 0 0 0-2 1L5 7l-2 4 2 1a7 7 0 0 0 0 2l-2 1 2 4 2-1a7 7 0 0 0 2 1l1 2h4l1-2a7 7 0 0 0 2-1l2 1 2-4-2-1a7 7 0 0 0 0-2z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l5 5',
  plus: 'M12 5v14M5 12h14',
  chevron: 'm6 9 6 6 6-6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  key: 'M8 14a4 4 0 1 1 3-6.5L21 7v4h-3v3h-3v-3h-4.5A4 4 0 0 1 8 14z',
  folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5',
  branch: 'M7 4v12M17 8a2 2 0 1 0 0-.01M7 18a2 2 0 1 0 0-.01M17 10c0 4-10 2-10 6',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 20c1-4 4-6 8-6s7 2 8 6',
}

defineProps<{ name: string }>()
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
    aria-hidden="true"
  >
    <path :d="paths[name] ?? ''" />
  </svg>
</template>
