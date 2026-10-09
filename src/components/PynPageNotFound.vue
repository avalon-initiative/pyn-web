<script setup lang="ts">
import styles from '../styles/PynRepoNotFound.module.scss'
</script>

<template>
  <section :class="styles.box" role="alert">
    <h2 :class="styles.heading">Page not found</h2>
    <p :class="styles.note">There is nothing here, or your account may not see it.</p>
    <a href="/" :class="styles.link">Back to your repositories</a>
  </section>
</template>
