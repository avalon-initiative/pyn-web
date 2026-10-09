<script setup lang="ts">
import PynLockIcon from './PynLockIcon.vue'
import styles from '../styles/PynCheckoutCard.module.scss'
</script>

<template>
  <aside :class="styles.card" aria-labelledby="checkout-title">
    <span :class="styles.badge"><PynLockIcon :class="styles.icon" /></span>
    <div>
      <h2 id="checkout-title" :class="styles.title">Exclusive File Checkout</h2>
      <p :class="styles.text">
        Files that cannot be merged, like configs and binary assets, can only be edited by one
        person at a time. Check one out to lock it; everything else can be worked on in parallel.
      </p>
    </div>
  </aside>
</template>
