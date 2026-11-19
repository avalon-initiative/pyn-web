<script setup lang="ts">
import {
  PynPeopleList,
  PynPeopleSearch,
  PynViewHeader,
  PynViewNotice,
} from '@avalon-initiative/pyn-common-ui'
import { onMounted } from 'vue'
import { usePeople } from '../state/people.state'

const { people, next, query, loaded, busy, error, search, more } = usePeople()

onMounted(() => search(''))
</script>

<template>
  <PynViewHeader title="People" />
  <PynPeopleSearch :busy="busy" @search="search" />
  <PynViewNotice v-if="error" tone="warning">{{ error }}</PynViewNotice>
  <PynPeopleList
    v-if="loaded"
    :people="people"
    :more="!!next"
    :busy="busy"
    :empty="query ? `No one matches “${query}”.` : 'No one to show yet.'"
    @more="more"
  />
</template>
