<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import styles from '../styles/PynOrgRepoPolicy.module.scss'
import {
  MEMBER_CREATION,
  RULE_EFFECTS,
  RULE_KINDS,
  RULE_SCOPES,
  ruleKey,
  ruleSubjects,
} from '../state/org.state'
import type { MemberCreation, RepoPolicy, RuleRef, RuleScope } from '../types/org.types'

const props = defineProps<{
  policy: RepoPolicy
  /** Team slugs and member names offered as rule subjects. */
  teams: string[]
  members: string[]
  busy?: boolean
  error?: string
}>()
const emit = defineEmits<{
  setBase: [MemberCreation]
  setRule: [{ rule: RuleRef; scope: RuleScope }]
  removeRule: [RuleRef]
}>()

const form = reactive<RuleRef & { scope: RuleScope }>({
  effect: 'allow',
  kind: 'team',
  subject: '',
  scope: 'both',
})
const subjects = computed(() => ruleSubjects(form.kind, form.effect, props.teams, props.members))
watch([() => form.kind, () => form.effect], () => (form.subject = ''))

function add() {
  const { scope, ...rule } = form
  emit('setRule', { rule, scope })
  form.subject = ''
}

const rescope = (rule: RuleRef, e: Event) =>
  emit('setRule', { rule, scope: (e.target as HTMLSelectElement).value as RuleScope })
</script>

<template>
  <section :class="styles.page">
    <h3 :class="styles.heading">Repository creation</h3>
    <p :class="styles.note">
      Owners can always create repositories. Rules refine what other members may create; a deny
      beats an allow.
    </p>
    <label :class="styles.field"
      >Members may create
      <select
        :class="styles.input"
        :value="policy.member_creation"
        :disabled="busy"
        @change="emit('setBase', ($event.target as HTMLSelectElement).value as MemberCreation)"
      >
        <option v-for="o in MEMBER_CREATION" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>

    <ul v-if="policy.rules.length" :class="styles.list">
      <li v-for="r in policy.rules" :key="ruleKey(r)" :class="styles.item">
        <span :class="styles.subject">
          <span :class="styles.pill" :data-effect="r.effect">{{ r.effect }}</span>
          <span :class="styles.kind">{{ r.kind }}</span>
          <strong>{{ r.subject }}</strong>
        </span>
        <span :class="styles.actions">
          <select
            :class="styles.input"
            :value="r.scope"
            :aria-label="`Scope of ${r.effect} ${r.kind} ${r.subject}`"
            :disabled="busy"
            @change="rescope(r, $event)"
          >
            <option v-for="s in RULE_SCOPES" :key="s" :value="s">{{ s }}</option>
          </select>
          <button
            type="button"
            :class="styles.danger"
            :disabled="busy"
            :aria-label="`Remove ${r.effect} ${r.kind} ${r.subject}`"
            @click="emit('removeRule', r)"
          >
            Remove
          </button>
        </span>
      </li>
    </ul>
    <p v-else :class="styles.note">No rules.</p>

    <form :class="styles.form" @submit.prevent="add">
      <h4 :class="styles.subheading">Add a rule</h4>
      <div :class="styles.row">
        <label :class="styles.field"
          >Effect
          <select v-model="form.effect" :class="styles.input">
            <option v-for="e in RULE_EFFECTS" :key="e" :value="e">{{ e }}</option>
          </select>
        </label>
        <label :class="styles.field"
          >Applies to
          <select v-model="form.kind" :class="styles.input">
            <option v-for="k in RULE_KINDS" :key="k" :value="k">{{ k }}</option>
          </select>
        </label>
        <label :class="styles.field"
          >Subject
          <select v-model="form.subject" :class="styles.input" required>
            <option value="" disabled>Choose a {{ form.kind }}</option>
            <option v-for="s in subjects" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
        <label :class="styles.field"
          >Scope
          <select v-model="form.scope" :class="styles.input">
            <option v-for="s in RULE_SCOPES" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
      </div>
      <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
      <button type="submit" :class="styles.primary" :disabled="busy">Add rule</button>
    </form>
  </section>
</template>
