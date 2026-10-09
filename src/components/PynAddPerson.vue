<script setup lang="ts">
import { reactive } from 'vue'
import styles from '../styles/PynAddPerson.module.scss'
import type { NewUser } from '../types/repo.types'

const props = defineProps<{ roles: string[]; busy?: boolean; error?: string }>()
const emit = defineEmits<{ addUser: [NewUser] }>()

const form = reactive<NewUser>({ username: '', password: '', role: props.roles[0] ?? 'reader' })

function add() {
  emit('addUser', { ...form })
  form.username = ''
  form.password = ''
}
</script>

<template>
  <form :class="styles.form" @submit.prevent="add">
    <h3 :class="styles.subheading">Add a person</h3>
    <label :class="styles.field"
      >User name
      <input v-model="form.username" :class="styles.input" required autocapitalize="none" />
    </label>
    <label :class="styles.field"
      >Initial password (10 characters or more)
      <input
        v-model="form.password"
        :class="styles.input"
        type="password"
        minlength="10"
        required
        autocomplete="new-password"
      />
    </label>
    <label :class="styles.field"
      >Role
      <select v-model="form.role" :class="styles.input">
        <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
      </select>
    </label>
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <button type="submit" :class="styles.primary" :disabled="busy">Add</button>
  </form>
</template>
